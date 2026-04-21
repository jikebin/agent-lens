from __future__ import annotations

import json

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.config import settings
from app.proxy.forwarder import UpstreamError, forward_non_stream, forward_stream
from app.recorder.trajectory import (
    create_request,
    record_input_messages,
    record_output_message,
    record_stream_events_batch,
    record_system_prompt,
    record_tool_definition,
    request_transaction,
)

router = APIRouter()


def _extract_api_key(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.headers.get("api-key", "")


def _extract_system_and_messages(messages: list[dict]) -> tuple[str | None, list[dict]]:
    system_content = None
    filtered = []
    for msg in messages:
        if msg.get("role") == "system" and system_content is None:
            content = msg.get("content", "")
            system_content = json.dumps(content) if isinstance(content, (dict, list)) else content
        else:
            filtered.append(msg)
    return system_content, filtered


@router.post("/v1/chat/completions")
async def openai_chat_completions(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"error": {"message": "Invalid JSON in request body", "type": "invalid_request_error"}},
        )

    api_key = _extract_api_key(request)
    model = body.get("model", "unknown")
    is_stream = body.get("stream", False)
    messages = body.get("messages", [])
    tools = body.get("tools", [])

    # Record trajectory in a single transaction
    async with request_transaction() as db:
        request_row_id, request_id = await create_request(
            db, api_key=api_key, model=model, api_format="openai", is_stream=is_stream
        )

        system_content, non_system_messages = _extract_system_and_messages(messages)
        if system_content:
            await record_system_prompt(db, request_row_id, system_content)

        for tool in tools:
            func = tool.get("function", {})
            await record_tool_definition(
                db, request_row_id,
                name=func.get("name", ""),
                description=func.get("description"),
                parameters=func.get("parameters"),
            )

        await record_input_messages(db, request_row_id, non_system_messages)

    # Forward request (outside transaction — streaming is long-lived)
    if settings.upstream_model:
        body["model"] = settings.upstream_model

    if is_stream:
        return StreamingResponse(
            _stream_openai(request_row_id, body),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    else:
        try:
            result = await forward_non_stream("/chat/completions", body)
        except UpstreamError as e:
            return JSONResponse(status_code=e.status_code, content=e.to_json())

        # Record output in a transaction
        async with request_transaction() as db:
            for choice in result.get("choices", []):
                msg = choice.get("message", {})
                await record_output_message(
                    db, request_row_id,
                    role=msg.get("role", "assistant"),
                    content=msg.get("content"),
                    tool_calls=msg.get("tool_calls"),
                    tool_call_id=None,
                    sequence=0,
                )
        return JSONResponse(content=result)


async def _stream_openai(request_row_id: int, body: dict):
    seq = 0
    full_content_parts: list[str] = []
    tool_calls_map: dict[int, dict] = {}
    buffered_events: list[tuple[str, dict | None, int]] = []

    try:
        async for chunk in forward_stream("/chat/completions", body):
            buffered_events.append(("openai_chunk", chunk, seq))
            seq += 1

            yield f"data: {json.dumps(chunk)}\n\n"

            if chunk.get("done"):
                break
            for choice in chunk.get("choices", []):
                delta = choice.get("delta", {})
                if delta.get("content"):
                    full_content_parts.append(delta["content"])
                if delta.get("tool_calls"):
                    for tc in delta["tool_calls"]:
                        idx = tc.get("index", 0)
                        if idx not in tool_calls_map:
                            tool_calls_map[idx] = {
                                "id": tc.get("id", ""),
                                "type": "function",
                                "function": {"name": "", "arguments": ""},
                            }
                        if tc.get("id"):
                            tool_calls_map[idx]["id"] = tc["id"]
                        func = tc.get("function", {})
                        if func.get("name"):
                            tool_calls_map[idx]["function"]["name"] = func["name"]
                        if func.get("arguments"):
                            tool_calls_map[idx]["function"]["arguments"] += func["arguments"]
    except UpstreamError as e:
        error_event = {
            "error": e.to_json(),
            "status_code": e.status_code,
        }
        yield f"data: {json.dumps(error_event)}\n\n"
        yield "data: [DONE]\n\n"
        if buffered_events:
            async with request_transaction() as db:
                await record_stream_events_batch(db, request_row_id, buffered_events)
        return
    except Exception:
        error_event = {"error": {"message": "Stream interrupted", "type": "stream_error"}}
        yield f"data: {json.dumps(error_event)}\n\n"
        yield "data: [DONE]\n\n"
        if buffered_events:
            async with request_transaction() as db:
                await record_stream_events_batch(db, request_row_id, buffered_events)
        return

    yield "data: [DONE]\n\n"

    async with request_transaction() as db:
        if buffered_events:
            await record_stream_events_batch(db, request_row_id, buffered_events)

        full_content = "".join(full_content_parts) if full_content_parts else None
        tool_calls_list = list(tool_calls_map.values()) if tool_calls_map else None
        await record_output_message(
            db, request_row_id,
            role="assistant",
            content=full_content,
            tool_calls=tool_calls_list,
            tool_call_id=None,
            sequence=0,
        )
