from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from app.db.database import get_db
from app.db.models import hash_api_key, mask_api_key


@asynccontextmanager
async def request_transaction() -> AsyncGenerator:
    """Context manager that wraps a request recording session in a single transaction.

    All record_* calls within the block will share one transaction.
    On success: commit once. On exception: rollback.
    """
    db = await get_db()
    try:
        yield db
        await db.commit()
    except Exception:
        await db.rollback()
        raise


async def ensure_project(db, api_key: str, model: str) -> int:
    api_key_hash = hash_api_key(api_key)
    api_key_prefix = mask_api_key(api_key)

    cursor = await db.execute(
        """
        INSERT INTO projects (api_key_hash, api_key_prefix, model) VALUES (?, ?, ?)
        ON CONFLICT(api_key_hash, model) DO UPDATE SET api_key_prefix = api_key_prefix
        RETURNING id
        """,
        (api_key_hash, api_key_prefix, model),
    )
    row = await cursor.fetchone()
    return row[0]


async def create_request(
    db, api_key: str, model: str, api_format: str, is_stream: bool
) -> tuple[int, str]:
    project_id = await ensure_project(db, api_key, model)
    request_id = str(uuid.uuid4())

    cursor = await db.execute(
        "INSERT INTO requests (project_id, request_id, api_format, is_stream) VALUES (?, ?, ?, ?)",
        (project_id, request_id, api_format, int(is_stream)),
    )
    return cursor.lastrowid, request_id


async def record_system_prompt(db, request_row_id: int, content: str) -> None:
    await db.execute(
        "INSERT INTO system_prompts (request_id, content) VALUES (?, ?)",
        (request_row_id, content),
    )


async def record_tool_definition(
    db, request_row_id: int, name: str, description: str | None, parameters: dict | None
) -> None:
    await db.execute(
        "INSERT INTO tool_definitions (request_id, name, description, parameters) VALUES (?, ?, ?, ?)",
        (
            request_row_id,
            name,
            description,
            json.dumps(parameters) if parameters else None,
        ),
    )


async def record_input_messages(
    db, request_row_id: int, messages: list[dict]
) -> None:
    for seq, msg in enumerate(messages):
        role = msg.get("role", "")
        content = msg.get("content")
        tool_calls = msg.get("tool_calls")
        tool_call_id = msg.get("tool_call_id")

        await db.execute(
            "INSERT INTO messages (request_id, role, content, tool_calls, tool_call_id, direction, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                request_row_id,
                role,
                json.dumps(content) if isinstance(content, (dict, list)) else content,
                json.dumps(tool_calls) if tool_calls else None,
                tool_call_id,
                "input",
                seq,
            ),
        )


async def record_output_message(
    db, request_row_id: int, role: str, content: str | None, tool_calls: list | None, tool_call_id: str | None, sequence: int
) -> None:
    await db.execute(
        "INSERT INTO messages (request_id, role, content, tool_calls, tool_call_id, direction, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            request_row_id,
            role,
            content,
            json.dumps(tool_calls) if tool_calls else None,
            tool_call_id,
            "output",
            sequence,
        ),
    )


async def record_stream_events_batch(
    db, request_row_id: int, events: list[tuple[str, dict | None, int]]
) -> None:
    """Batch insert stream events after streaming completes to avoid DB contention."""
    await db.executemany(
        "INSERT INTO stream_events (request_id, event_type, event_data, sequence) VALUES (?, ?, ?, ?)",
        [
            (request_row_id, event_type, json.dumps(data) if data else None, seq)
            for event_type, data, seq in events
        ],
    )
