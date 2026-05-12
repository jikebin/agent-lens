from __future__ import annotations

import json
import time
import uuid
from typing import Any

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
    update_request_status,
    update_request_usage,
)

router = APIRouter()


def _extract_api_key(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.headers.get("api-key", "")


def _content_to_text(content: Any, output_type: str = "output_text") -> str | None:
    if content is None:
        return None
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, str):
                text_parts.append(item)
            elif isinstance(item, dict):
                item_type = item.get("type")
                if item_type in {"input_text", "output_text", "text"}:
                    text_parts.append(item.get("text", ""))
                elif item_type == output_type:
                    text_parts.append(item.get("text", ""))
        if text_parts:
            return "\n".join(part for part in text_parts if part)
    return json.dumps(content, ensure_ascii=False)


def _extract_input_items(body: dict) -> tuple[list[str], list[dict]]:
    system_prompts: list[str] = []
    messages: list[dict] = []

    instructions = body.get("instructions")
    if instructions:
        if isinstance(instructions, str):
            system_prompts.append(instructions)
        else:
            system_prompts.append(json.dumps(instructions, ensure_ascii=False))

    input_value = body.get("input", [])
    if isinstance(input_value, str):
        return system_prompts, [{"role": "user", "content": input_value}]
    if not isinstance(input_value, list):
        return system_prompts, [{"role": "user", "content": json.dumps(input_value, ensure_ascii=False)}]

    for item in input_value:
        if not isinstance(item, dict):
            messages.append({"role": "user", "content": str(item)})
            continue

        item_type = item.get("type")
        role = item.get("role")

        if role in {"system", "developer"}:
            content = _content_to_text(item.get("content"), "input_text")
            if content:
                system_prompts.append(content)
            continue

        if item_type == "message" or role:
            messages.append({
                "role": role or "user",
                "content": _content_to_text(item.get("content"), "input_text"),
            })
        elif item_type in {"function_call_output", "custom_tool_call_output"}:
            messages.append({
                "role": "tool",
                "content": _content_to_text(item.get("output"), "input_text"),
                "tool_call_id": item.get("call_id"),
            })
        elif item_type in {"function_call", "custom_tool_call"}:
            name = item.get("name", "")
            arguments = item.get("arguments", item.get("input", ""))
            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [{
                    "id": item.get("call_id") or item.get("id", ""),
                    "type": "function",
                    "function": {
                        "name": name,
                        "arguments": arguments if isinstance(arguments, str) else json.dumps(arguments, ensure_ascii=False),
                    },
                }],
            })
        else:
            messages.append({
                "role": item_type or "input",
                "content": json.dumps(item, ensure_ascii=False),
            })

    return system_prompts, messages


def _tool_name(tool: dict) -> str:
    if tool.get("type") == "function":
        return tool.get("name", "")
    if tool.get("type") == "custom":
        return tool.get("name", "")
    return tool.get("type", "")


def _usage_tokens(usage: dict | None) -> tuple[int, int]:
    if not usage:
        return 0, 0
    prompt_tokens = usage.get("input_tokens", usage.get("prompt_tokens", 0)) or 0
    completion_tokens = usage.get("output_tokens", usage.get("completion_tokens", 0)) or 0
    return prompt_tokens, completion_tokens


def _responses_to_chat_request(body: dict) -> dict:
    messages: list[dict] = []

    instructions = body.get("instructions")
    if instructions:
        content = instructions if isinstance(instructions, str) else json.dumps(instructions, ensure_ascii=False)
        messages.append({"role": "system", "content": content})

    input_value = body.get("input", [])
    if isinstance(input_value, str):
        messages.append({"role": "user", "content": input_value})
    elif isinstance(input_value, list):
        for item in input_value:
            if not isinstance(item, dict):
                messages.append({"role": "user", "content": str(item)})
                continue

            item_type = item.get("type")
            role = item.get("role")

            if item_type == "message" or role:
                chat_role = role or "user"
                if chat_role == "developer":
                    chat_role = "system"
                messages.append({
                    "role": chat_role,
                    "content": _content_to_text(item.get("content"), "input_text") or "",
                })
            elif item_type in {"function_call", "custom_tool_call"}:
                arguments = item.get("arguments", item.get("input", ""))
                messages.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": item.get("call_id") or item.get("id", ""),
                        "type": "function",
                        "function": {
                            "name": item.get("name", ""),
                            "arguments": arguments if isinstance(arguments, str) else json.dumps(arguments, ensure_ascii=False),
                        },
                    }],
                })
            elif item_type in {"function_call_output", "custom_tool_call_output"}:
                messages.append({
                    "role": "tool",
                    "tool_call_id": item.get("call_id"),
                    "content": _content_to_text(item.get("output"), "input_text") or "",
                })
    else:
        messages.append({"role": "user", "content": json.dumps(input_value, ensure_ascii=False)})

    chat_tools = []
    for tool in body.get("tools", []):
        if not isinstance(tool, dict):
            continue
        if tool.get("type") in {"function", "custom"} and tool.get("name"):
            chat_tools.append({
                "type": "function",
                "function": {
                    "name": tool.get("name", ""),
                    "description": tool.get("description", ""),
                    "parameters": tool.get("parameters") or {"type": "object", "properties": {}},
                },
            })

    result: dict = {
        "model": body.get("model", ""),
        "messages": messages,
        "stream": body.get("stream", False),
    }
    if chat_tools:
        result["tools"] = chat_tools

    passthrough_fields = (
        "temperature",
        "top_p",
        "max_tokens",
        "max_completion_tokens",
        "frequency_penalty",
        "presence_penalty",
        "stop",
        "seed",
        "parallel_tool_calls",
    )
    for field in passthrough_fields:
        if body.get(field) is not None:
            result[field] = body[field]

    if body.get("max_output_tokens") is not None:
        result["max_tokens"] = body["max_output_tokens"]

    return result


def _chat_to_responses_response(chat_resp: dict, requested_model: str) -> dict:
    choice = (chat_resp.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    output = []

    content = message.get("content")
    if content is not None:
        output.append({
            "id": f"msg_{uuid.uuid4().hex[:24]}",
            "type": "message",
            "status": "completed",
            "role": message.get("role", "assistant"),
            "content": [{
                "type": "output_text",
                "text": content,
                "annotations": [],
            }],
        })

    for tc in message.get("tool_calls") or []:
        func = tc.get("function", {})
        output.append({
            "id": f"fc_{uuid.uuid4().hex[:24]}",
            "type": "function_call",
            "status": "completed",
            "call_id": tc.get("id", ""),
            "name": func.get("name", ""),
            "arguments": func.get("arguments", ""),
        })

    prompt_tokens, completion_tokens = _usage_tokens(chat_resp.get("usage"))
    return {
        "id": chat_resp.get("id", f"resp_{uuid.uuid4().hex[:24]}"),
        "object": "response",
        "created_at": chat_resp.get("created", int(time.time())),
        "status": "completed",
        "error": None,
        "incomplete_details": None,
        "instructions": None,
        "model": chat_resp.get("model", requested_model),
        "output": output,
        "output_text": "\n".join(
            content_item.get("text", "")
            for item in output
            if item.get("type") == "message"
            for content_item in item.get("content", [])
            if content_item.get("type") == "output_text"
        ),
        "parallel_tool_calls": True,
        "temperature": None,
        "tool_choice": "auto",
        "tools": [],
        "top_p": None,
        "usage": {
            "input_tokens": prompt_tokens,
            "output_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
    }


async def _record_response_output(db, request_row_id: int, response: dict) -> None:
    recorded_any = False
    sequence = 0
    for item in response.get("output") or []:
        if not isinstance(item, dict):
            continue
        item_type = item.get("type")
        if item_type == "message":
            content = _content_to_text(item.get("content"), "output_text")
            await record_output_message(
                db, request_row_id,
                role=item.get("role", "assistant"),
                content=content,
                tool_calls=None,
                tool_call_id=None,
                sequence=sequence,
            )
            recorded_any = True
            sequence += 1
        elif item_type in {"function_call", "custom_tool_call"}:
            arguments = item.get("arguments", item.get("input", ""))
            await record_output_message(
                db, request_row_id,
                role="assistant",
                content=None,
                tool_calls=[{
                    "id": item.get("call_id") or item.get("id", ""),
                    "type": "function",
                    "function": {
                        "name": item.get("name", ""),
                        "arguments": arguments if isinstance(arguments, str) else json.dumps(arguments, ensure_ascii=False),
                    },
                }],
                tool_call_id=item.get("call_id") or item.get("id"),
                sequence=sequence,
            )
            recorded_any = True
            sequence += 1

    if not recorded_any and response.get("output_text") is not None:
        await record_output_message(
            db, request_row_id,
            role="assistant",
            content=response.get("output_text"),
            tool_calls=None,
            tool_call_id=None,
            sequence=0,
        )


@router.post("/v1/responses")
async def openai_responses(request: Request):
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

    async with request_transaction() as db:
        request_row_id, _ = await create_request(
            db, api_key=api_key, model=model, api_format="responses", is_stream=is_stream
        )

        system_prompts, input_messages = _extract_input_items(body)
        for prompt in system_prompts:
            await record_system_prompt(db, request_row_id, prompt)

        for tool in body.get("tools", []):
            if isinstance(tool, dict):
                await record_tool_definition(
                    db, request_row_id,
                    name=_tool_name(tool),
                    description=tool.get("description"),
                    parameters=tool.get("parameters") or tool.get("grammar"),
                )

        await record_input_messages(db, request_row_id, input_messages)

    requested_model = model
    upstream_body = _responses_to_chat_request(body)
    if settings.upstream_model:
        upstream_body["model"] = settings.upstream_model

    if is_stream:
        return StreamingResponse(
            _stream_responses(request_row_id, upstream_body, requested_model),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    try:
        result = await forward_non_stream("/chat/completions", upstream_body)
    except UpstreamError as e:
        async with request_transaction() as db:
            await update_request_status(
                db, request_row_id, "error", "upstream_error",
                f"HTTP {e.status_code}: {json.dumps(e.to_json())[:500]}",
            )
        return JSONResponse(status_code=e.status_code, content=e.to_json())

    async with request_transaction() as db:
        responses_result = _chat_to_responses_response(result, requested_model)
        await _record_response_output(db, request_row_id, responses_result)
        prompt_tokens, completion_tokens = _usage_tokens(responses_result.get("usage"))
        await update_request_usage(db, request_row_id, prompt_tokens, completion_tokens)

    return JSONResponse(content=responses_result)


def _sse_event(event: dict) -> str:
    event_type = event.get("type", "response.event")
    return f"event: {event_type}\ndata: {json.dumps(event)}\n\n"


async def _stream_responses(request_row_id: int, chat_body: dict, requested_model: str):
    seq = 0
    buffered_events: list[tuple[str, dict | None, int]] = []
    output_text_parts: list[str] = []
    function_calls: dict[str, dict] = {}
    prompt_tokens = 0
    completion_tokens = 0
    response_id = f"resp_{uuid.uuid4().hex[:24]}"
    message_id = f"msg_{uuid.uuid4().hex[:24]}"
    message_started = False
    message_output_index = 0
    next_output_index = 0
    created_at = int(time.time())
    model = chat_body.get("model") or requested_model

    def add_event(event: dict) -> str:
        nonlocal seq
        buffered_events.append((event.get("type", "response.event"), event, seq))
        seq += 1
        return _sse_event(event)

    response_base = {
        "id": response_id,
        "object": "response",
        "created_at": created_at,
        "status": "in_progress",
        "error": None,
        "incomplete_details": None,
        "instructions": None,
        "model": model,
        "output": [],
        "parallel_tool_calls": True,
        "temperature": None,
        "tool_choice": "auto",
        "tools": [],
        "top_p": None,
        "usage": None,
    }

    yield add_event({"type": "response.created", "response": response_base})
    yield add_event({"type": "response.in_progress", "response": response_base})

    try:
        async for chunk in forward_stream("/chat/completions", chat_body):
            if chunk.get("done"):
                break

            buffered_events.append(("openai_chunk_raw", chunk, seq))
            seq += 1

            usage = chunk.get("usage")
            if usage:
                prompt_tokens, completion_tokens = _usage_tokens(usage)

            for choice in chunk.get("choices", []):
                delta = choice.get("delta", {})
                if delta.get("content"):
                    if not message_started:
                        message_started = True
                        message_output_index = next_output_index
                        next_output_index += 1
                        yield add_event({
                            "type": "response.output_item.added",
                            "output_index": message_output_index,
                            "item": {
                                "id": message_id,
                                "type": "message",
                                "status": "in_progress",
                                "role": "assistant",
                                "content": [],
                            },
                        })
                        yield add_event({
                            "type": "response.content_part.added",
                            "item_id": message_id,
                            "output_index": message_output_index,
                            "content_index": 0,
                            "part": {"type": "output_text", "text": "", "annotations": []},
                        })
                    output_text_parts.append(delta["content"])
                    yield add_event({
                        "type": "response.output_text.delta",
                        "item_id": message_id,
                        "output_index": message_output_index,
                        "content_index": 0,
                        "delta": delta["content"],
                    })

                for tc in delta.get("tool_calls") or []:
                    idx = tc.get("index", 0)
                    key = str(idx)
                    if key not in function_calls:
                        function_calls[key] = {
                            "id": f"fc_{uuid.uuid4().hex[:24]}",
                            "call_id": tc.get("id", ""),
                            "name": "",
                            "arguments": "",
                            "output_index": next_output_index,
                        }
                        next_output_index += 1
                        yield add_event({
                            "type": "response.output_item.added",
                            "output_index": function_calls[key]["output_index"],
                            "item": {
                                "id": function_calls[key]["id"],
                                "type": "function_call",
                                "status": "in_progress",
                                "call_id": function_calls[key]["call_id"],
                                "name": "",
                                "arguments": "",
                            },
                        })

                    if tc.get("id"):
                        function_calls[key]["call_id"] = tc["id"]
                    func = tc.get("function", {})
                    if func.get("name"):
                        function_calls[key]["name"] = func["name"]
                    if func.get("arguments"):
                        function_calls[key]["arguments"] += func["arguments"]
                        yield add_event({
                            "type": "response.function_call_arguments.delta",
                            "item_id": function_calls[key]["id"],
                            "output_index": function_calls[key]["output_index"],
                            "delta": func["arguments"],
                        })
    except UpstreamError as e:
        error_event = {
            "type": "error",
            "error": e.to_json(),
            "status_code": e.status_code,
        }
        yield _sse_event(error_event)
        yield "data: [DONE]\n\n"
        async with request_transaction() as db:
            if buffered_events:
                await record_stream_events_batch(db, request_row_id, buffered_events)
            await update_request_status(
                db, request_row_id, "error", "upstream_error",
                f"HTTP {e.status_code}: {json.dumps(e.to_json())[:500]}",
            )
        return
    except Exception:
        error_event = {"type": "error", "error": {"message": "Stream interrupted", "type": "stream_error"}}
        yield _sse_event(error_event)
        yield "data: [DONE]\n\n"
        async with request_transaction() as db:
            if buffered_events:
                await record_stream_events_batch(db, request_row_id, buffered_events)
            await update_request_status(db, request_row_id, "error", "stream_error", "Stream interrupted")
        return

    full_content = "".join(output_text_parts)
    output_items = []
    if full_content:
        output_items.append({
            "id": message_id,
            "type": "message",
            "status": "completed",
            "role": "assistant",
            "content": [{
                "type": "output_text",
                "text": full_content,
                "annotations": [],
            }],
        })
        yield add_event({
            "type": "response.output_text.done",
            "item_id": message_id,
            "output_index": message_output_index,
            "content_index": 0,
            "text": full_content,
        })
        yield add_event({
            "type": "response.content_part.done",
            "item_id": message_id,
            "output_index": message_output_index,
            "content_index": 0,
            "part": {"type": "output_text", "text": full_content, "annotations": []},
        })
        yield add_event({
            "type": "response.output_item.done",
            "output_index": message_output_index,
            "item": output_items[-1],
        })

    for call in function_calls.values():
        call_item = {
            "id": call["id"],
            "type": "function_call",
            "status": "completed",
            "call_id": call["call_id"],
            "name": call["name"],
            "arguments": call["arguments"],
        }
        output_items.append(call_item)
        yield add_event({
            "type": "response.function_call_arguments.done",
            "item_id": call["id"],
            "output_index": call["output_index"],
            "arguments": call["arguments"],
        })
        yield add_event({
            "type": "response.output_item.done",
            "output_index": call["output_index"],
            "item": call_item,
        })

    completed_response = {
        **response_base,
        "status": "completed",
        "output": output_items,
        "usage": {
            "input_tokens": prompt_tokens,
            "output_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
    }
    yield add_event({"type": "response.completed", "response": completed_response})
    yield "data: [DONE]\n\n"

    async with request_transaction() as db:
        if buffered_events:
            await record_stream_events_batch(db, request_row_id, buffered_events)

        await record_output_message(
            db, request_row_id,
            role="assistant",
            content=full_content or None,
            tool_calls=[
                {
                    "id": item.get("call_id") or item.get("id", ""),
                    "type": "function",
                    "function": {
                        "name": item.get("name", ""),
                        "arguments": item.get("arguments", item.get("input", "")),
                    },
                }
                for item in function_calls.values()
            ] or None,
            tool_call_id=None,
            sequence=0,
        )
        await update_request_usage(db, request_row_id, prompt_tokens, completion_tokens)
