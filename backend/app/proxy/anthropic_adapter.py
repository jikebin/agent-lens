from __future__ import annotations

import json
import uuid

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

router = APIRouter(prefix="/anthropic")


def _extract_api_key(request: Request) -> str:
    auth = request.headers.get("x-api-key", "")
    if not auth:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            auth = auth_header[7:]
    return auth


def _anthropic_to_openai_request(body: dict) -> dict:
    """Convert Anthropic Messages API request to OpenAI Chat Completions format."""
    messages = []

    system = body.get("system", "")
    if system:
        if isinstance(system, str):
            messages.append({"role": "system", "content": system})
        elif isinstance(system, list):
            text_parts = []
            for block in system:
                if isinstance(block, dict) and block.get("type") == "text":
                    text_parts.append(block.get("text", ""))
                elif isinstance(block, str):
                    text_parts.append(block)
            if text_parts:
                messages.append({"role": "system", "content": "\n".join(text_parts)})

    for msg in body.get("messages", []):
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if isinstance(content, list):
            text_parts = []
            tool_calls = []
            tool_results = []

            for block in content:
                block_type = block.get("type", "")

                if block_type == "text":
                    text_parts.append(block.get("text", ""))

                elif block_type == "tool_use":
                    tool_calls.append({
                        "id": block.get("id", ""),
                        "type": "function",
                        "function": {
                            "name": block.get("name", ""),
                            "arguments": json.dumps(block.get("input", {})),
                        },
                    })

                elif block_type == "tool_result":
                    result_content = block.get("content", "")
                    if isinstance(result_content, list):
                        text_from_blocks = []
                        for cb in result_content:
                            if isinstance(cb, dict) and cb.get("type") == "text":
                                text_from_blocks.append(cb.get("text", ""))
                            elif isinstance(cb, str):
                                text_from_blocks.append(cb)
                        result_content = "\n".join(text_from_blocks) if text_from_blocks else ""
                    tool_results.append({
                        "tool_call_id": block.get("tool_use_id", ""),
                        "content": result_content,
                    })

            if role == "assistant":
                openai_msg: dict = {"role": "assistant"}
                if text_parts:
                    openai_msg["content"] = "\n".join(text_parts)
                if tool_calls:
                    openai_msg["tool_calls"] = tool_calls
                if not text_parts and not tool_calls:
                    openai_msg["content"] = None
                messages.append(openai_msg)
            else:
                for tr in tool_results:
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tr["tool_call_id"],
                        "content": tr["content"],
                    })
                if text_parts:
                    messages.append({"role": "user", "content": "\n".join(text_parts)})
        else:
            messages.append({"role": role, "content": content})

    openai_tools = []
    for tool in body.get("tools", []):
        openai_tools.append({
            "type": "function",
            "function": {
                "name": tool.get("name", ""),
                "description": tool.get("description", ""),
                "parameters": tool.get("input_schema", {}),
            },
        })

    result: dict = {
        "model": body.get("model", ""),
        "messages": messages,
        "stream": body.get("stream", False),
    }
    if openai_tools:
        result["tools"] = openai_tools

    if body.get("max_tokens"):
        result["max_tokens"] = body["max_tokens"]
    if body.get("temperature") is not None:
        result["temperature"] = body["temperature"]
    if body.get("top_p") is not None:
        result["top_p"] = body["top_p"]
    if body.get("stop_sequences"):
        result["stop"] = body["stop_sequences"]

    return result


def _openai_to_anthropic_response(openai_resp: dict, model: str) -> dict:
    """Convert OpenAI Chat Completions response to Anthropic Messages format."""
    content = []
    tool_use_blocks = []

    for choice in openai_resp.get("choices", []):
        msg = choice.get("message", {})

        if msg.get("content"):
            content.append({"type": "text", "text": msg["content"]})

        for tc in msg.get("tool_calls") or []:
            func = tc.get("function", {})
            try:
                input_data = json.loads(func.get("arguments", "{}"))
            except json.JSONDecodeError:
                input_data = {}
            tool_use_blocks.append({
                "type": "tool_use",
                "id": tc.get("id", ""),
                "name": func.get("name", ""),
                "input": input_data,
            })

    content.extend(tool_use_blocks)

    finish_reason = openai_resp.get("choices", [{}])[0].get("finish_reason", "")
    stop_reason = "end_turn"
    if finish_reason == "tool_calls" or tool_use_blocks:
        stop_reason = "tool_use"
    elif finish_reason == "length":
        stop_reason = "max_tokens"

    return {
        "id": openai_resp.get("id", f"msg_{uuid.uuid4().hex[:24]}"),
        "type": "message",
        "role": "assistant",
        "content": content if content else [{"type": "text", "text": ""}],
        "model": model,
        "stop_reason": stop_reason,
        "stop_sequence": None,
        "usage": {
            "input_tokens": openai_resp.get("usage", {}).get("prompt_tokens", 0),
            "output_tokens": openai_resp.get("usage", {}).get("completion_tokens", 0),
        },
    }


@router.post("/v1/messages")
async def anthropic_messages(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"type": "error", "error": {"type": "invalid_request_error", "message": "Invalid JSON in request body"}},
        )

    api_key = _extract_api_key(request)
    model = body.get("model", "unknown")
    is_stream = body.get("stream", False)

    # Record trajectory in a single transaction
    async with request_transaction() as db:
        request_row_id, request_id = await create_request(
            db, api_key=api_key, model=model, api_format="anthropic", is_stream=is_stream
        )

        system = body.get("system", "")
        if system:
            if isinstance(system, str):
                await record_system_prompt(db, request_row_id, system)
            elif isinstance(system, list):
                text_parts = []
                for block in system:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text_parts.append(block.get("text", ""))
                    elif isinstance(block, str):
                        text_parts.append(block)
                if text_parts:
                    await record_system_prompt(db, request_row_id, "\n".join(text_parts))

        for tool in body.get("tools", []):
            await record_tool_definition(
                db, request_row_id,
                name=tool.get("name", ""),
                description=tool.get("description"),
                parameters=tool.get("input_schema"),
            )

        await record_input_messages(db, request_row_id, body.get("messages", []))

    # Convert to OpenAI format and forward
    openai_body = _anthropic_to_openai_request(body)
    if settings.upstream_model:
        openai_body["model"] = settings.upstream_model

    if is_stream:
        return StreamingResponse(
            _stream_anthropic(request_row_id, openai_body, model),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    else:
        try:
            result = await forward_non_stream("/chat/completions", openai_body)
        except UpstreamError as e:
            async with request_transaction() as db:
                await update_request_status(db, request_row_id, "error", "upstream_error",
                    f"HTTP {e.status_code}: {json.dumps(e.to_json())[:500]}")
            error_resp = {
                "type": "error",
                "error": {
                    "type": "api_error",
                    "message": f"Upstream returned {e.status_code}",
                },
            }
            if isinstance(e.body, dict) and "error" in e.body:
                error_resp["error"] = e.body["error"]
            return JSONResponse(status_code=e.status_code, content=error_resp)

        anthropic_resp = _openai_to_anthropic_response(result, model)

        # Record output in a transaction
        async with request_transaction() as db:
            for block in anthropic_resp.get("content", []):
                if block.get("type") == "text":
                    await record_output_message(
                        db, request_row_id, role="assistant", content=block["text"],
                        tool_calls=None, tool_call_id=None, sequence=0,
                    )
                elif block.get("type") == "tool_use":
                    await record_output_message(
                        db, request_row_id, role="assistant",
                        content=None,
                        tool_calls=[{
                            "id": block["id"],
                            "type": "function",
                            "function": {
                                "name": block["name"],
                                "arguments": json.dumps(block.get("input", {})),
                            },
                        }],
                        tool_call_id=block["id"],
                        sequence=1,
                    )
            usage = result.get("usage", {})
            await update_request_usage(db, request_row_id,
                usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0))

        return JSONResponse(content=anthropic_resp)


async def _stream_anthropic(request_row_id: int, openai_body: dict, model: str):
    msg_id = f"msg_{uuid.uuid4().hex[:24]}"

    buffered_events: list[tuple[str, dict | None, int]] = []

    message_start = {
        "type": "message_start",
        "message": {
            "id": msg_id,
            "type": "message",
            "role": "assistant",
            "content": [],
            "model": model,
            "stop_reason": None,
            "stop_sequence": None,
            "usage": {"input_tokens": 0, "output_tokens": 0},
        },
    }
    yield f"event: message_start\ndata: {json.dumps(message_start)}\n\n"
    buffered_events.append(("message_start", message_start, 0))

    text_block_start = {
        "type": "content_block_start",
        "index": 0,
        "content_block": {"type": "text", "text": ""},
    }
    yield f"event: content_block_start\ndata: {json.dumps(text_block_start)}\n\n"
    buffered_events.append(("content_block_start", text_block_start, 1))

    seq = 2
    full_content_parts: list[str] = []
    # tool_calls_map tracks tool call state across stream chunks.
    # Each entry: {"id": str, "name": str, "input": str, "started": bool,
    #              "pending_args": list[str]}
    # "started" is True once content_block_start has been emitted (requires name != "").
    # "pending_args" buffers argument fragments received before the start event.
    tool_calls_map: dict[int, dict] = {}

    try:
        async for chunk in forward_stream("/chat/completions", openai_body):
            buffered_events.append(("openai_chunk_raw", chunk, seq))
            seq += 1

            if chunk.get("done"):
                break

            for choice in chunk.get("choices", []):
                delta = choice.get("delta", {})

                if delta.get("content"):
                    full_content_parts.append(delta["content"])
                    text_delta = {
                        "type": "content_block_delta",
                        "index": 0,
                        "delta": {"type": "text_delta", "text": delta["content"]},
                    }
                    yield f"event: content_block_delta\ndata: {json.dumps(text_delta)}\n\n"
                    buffered_events.append(("content_block_delta", text_delta, seq))
                    seq += 1

                if delta.get("tool_calls"):
                    for tc in delta["tool_calls"]:
                        idx = tc.get("index", 0)
                        func = tc.get("function", {})

                        if idx not in tool_calls_map:
                            tool_calls_map[idx] = {
                                "id": tc.get("id", ""),
                                "name": func.get("name", ""),
                                "input": "",
                                "started": False,
                                "pending_args": [],
                            }
                        else:
                            if tc.get("id"):
                                tool_calls_map[idx]["id"] = tc["id"]
                            if func.get("name"):
                                tool_calls_map[idx]["name"] = func["name"]

                        if func.get("arguments"):
                            tool_calls_map[idx]["input"] += func["arguments"]

                        tc_state = tool_calls_map[idx]

                        # --- Emit content_block_start once name is available ---
                        if not tc_state["started"]:
                            if not tc_state["name"]:
                                # Name not yet received — buffer arguments for later
                                if func.get("arguments"):
                                    tc_state["pending_args"].append(func["arguments"])
                                continue

                            # Name is available now; emit start event
                            tc_state["started"] = True
                            tool_start = {
                                "type": "content_block_start",
                                "index": idx + 1,
                                "content_block": {
                                    "type": "tool_use",
                                    "id": tc_state["id"],
                                    "name": tc_state["name"],
                                },
                            }
                            yield f"event: content_block_start\ndata: {json.dumps(tool_start)}\n\n"
                            buffered_events.append(("content_block_start_tool", tool_start, seq))
                            seq += 1

                            # Flush any argument fragments that were buffered
                            # plus the current chunk's arguments (name and args
                            # can arrive in the same OpenAI delta).
                            args_to_flush = tc_state["pending_args"]
                            tc_state["pending_args"] = []
                            if func.get("arguments"):
                                args_to_flush.append(func["arguments"])

                            for args_fragment in args_to_flush:
                                args_delta = {
                                    "type": "content_block_delta",
                                    "index": idx + 1,
                                    "delta": {
                                        "type": "input_json_delta",
                                        "partial_json": args_fragment,
                                    },
                                }
                                yield f"event: content_block_delta\ndata: {json.dumps(args_delta)}\n\n"
                                buffered_events.append(("content_block_delta_tool", args_delta, seq))
                                seq += 1

                        elif func.get("arguments"):
                            # Already started, emit argument delta directly
                            args_delta = {
                                "type": "content_block_delta",
                                "index": idx + 1,
                                "delta": {
                                    "type": "input_json_delta",
                                    "partial_json": func["arguments"],
                                },
                            }
                            yield f"event: content_block_delta\ndata: {json.dumps(args_delta)}\n\n"
                            buffered_events.append(("content_block_delta_tool", args_delta, seq))
                            seq += 1
    except UpstreamError as e:
        error_event = {
            "type": "error",
            "error": {"type": "api_error", "message": f"Upstream error: {e.status_code}"},
        }
        yield f"event: error\ndata: {json.dumps(error_event)}\n\n"
        async with request_transaction() as db:
            if buffered_events:
                await record_stream_events_batch(db, request_row_id, buffered_events)
            await update_request_status(db, request_row_id, "error", "upstream_error",
                f"HTTP {e.status_code}: {json.dumps(e.to_json())[:500]}")
        return
    except Exception:
        error_event = {
            "type": "error",
            "error": {"type": "stream_error", "message": "Stream interrupted"},
        }
        yield f"event: error\ndata: {json.dumps(error_event)}\n\n"
        async with request_transaction() as db:
            if buffered_events:
                await record_stream_events_batch(db, request_row_id, buffered_events)
            await update_request_status(db, request_row_id, "error", "stream_error",
                "Stream interrupted")
        return

    text_block_stop = {"type": "content_block_stop", "index": 0}
    yield f"event: content_block_stop\ndata: {json.dumps(text_block_stop)}\n\n"
    buffered_events.append(("content_block_stop", text_block_stop, seq))
    seq += 1

    for idx, tc_state in tool_calls_map.items():
        # Force-flush any tool that never received a name (shouldn't happen
        # with a well-behaved upstream, but handle gracefully).
        if not tc_state["started"]:
            tc_state["started"] = True
            tool_start = {
                "type": "content_block_start",
                "index": idx + 1,
                "content_block": {
                    "type": "tool_use",
                    "id": tc_state["id"],
                    "name": tc_state["name"] or "unknown",
                },
            }
            yield f"event: content_block_start\ndata: {json.dumps(tool_start)}\n\n"
            buffered_events.append(("content_block_start_tool", tool_start, seq))
            seq += 1
            for args_fragment in tc_state["pending_args"]:
                args_delta = {
                    "type": "content_block_delta",
                    "index": idx + 1,
                    "delta": {
                        "type": "input_json_delta",
                        "partial_json": args_fragment,
                    },
                }
                yield f"event: content_block_delta\ndata: {json.dumps(args_delta)}\n\n"
                buffered_events.append(("content_block_delta_tool", args_delta, seq))
                seq += 1
            tc_state["pending_args"] = []

        tool_block_stop = {"type": "content_block_stop", "index": idx + 1}
        yield f"event: content_block_stop\ndata: {json.dumps(tool_block_stop)}\n\n"
        buffered_events.append(("content_block_stop_tool", tool_block_stop, seq))
        seq += 1

    stop_reason = "tool_use" if tool_calls_map else "end_turn"

    prompt_tokens = 0
    output_tokens = 0
    for ev_type, ev_data, _ in reversed(buffered_events):
        if ev_type == "openai_chunk_raw" and isinstance(ev_data, dict):
            usage = ev_data.get("usage")
            if usage and usage.get("completion_tokens"):
                output_tokens = usage["completion_tokens"]
                prompt_tokens = usage.get("prompt_tokens", 0)
                break

    message_delta = {
        "type": "message_delta",
        "delta": {"stop_reason": stop_reason, "stop_sequence": None},
        "usage": {"output_tokens": output_tokens},
    }
    yield f"event: message_delta\ndata: {json.dumps(message_delta)}\n\n"
    buffered_events.append(("message_delta", message_delta, seq))
    seq += 1

    message_stop = {"type": "message_stop"}
    yield f"event: message_stop\ndata: {json.dumps(message_stop)}\n\n"
    buffered_events.append(("message_stop", message_stop, seq))

    # Batch write in a single transaction
    async with request_transaction() as db:
        if buffered_events:
            await record_stream_events_batch(db, request_row_id, buffered_events)

        full_content = "".join(full_content_parts) if full_content_parts else None
        if full_content:
            await record_output_message(
                db, request_row_id, role="assistant", content=full_content,
                tool_calls=None, tool_call_id=None, sequence=0,
            )
        for idx, tc in tool_calls_map.items():
            await record_output_message(
                db, request_row_id, role="assistant", content=None,
                tool_calls=[{
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": tc["input"],
                    },
                }],
                tool_call_id=tc["id"],
                sequence=idx + 1,
            )
        await update_request_usage(db, request_row_id, prompt_tokens, output_tokens)
