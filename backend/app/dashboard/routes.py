from __future__ import annotations

import json
import math

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.db.database import get_db

router = APIRouter(prefix="/api")


@router.get("/projects")
async def list_projects():
    db = await get_db()
    cursor = await db.execute(
        """
        SELECT p.id, p.api_key_hash, p.api_key_prefix, p.model, p.name, p.created_at,
               COUNT(r.id) as request_count
        FROM projects p
        LEFT JOIN requests r ON r.project_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
        """
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.delete("/projects/{project_id}")
async def delete_project(project_id: int):
    db = await get_db()
    # Check project exists
    cursor = await db.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Project not found")
    # Get all request IDs for this project
    cursor = await db.execute("SELECT id FROM requests WHERE project_id = ?", (project_id,))
    request_ids = [row["id"] for row in await cursor.fetchall()]
    if request_ids:
        placeholders = ",".join("?" for _ in request_ids)
        await db.execute(f"DELETE FROM stream_events WHERE request_id IN ({placeholders})", request_ids)
        await db.execute(f"DELETE FROM messages WHERE request_id IN ({placeholders})", request_ids)
        await db.execute(f"DELETE FROM tool_definitions WHERE request_id IN ({placeholders})", request_ids)
        await db.execute(f"DELETE FROM system_prompts WHERE request_id IN ({placeholders})", request_ids)
    await db.execute("DELETE FROM requests WHERE project_id = ?", (project_id,))
    await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    await db.commit()
    return {"deleted": True}


@router.get("/projects/{project_id}/requests")
async def list_project_requests(project_id: int):
    db = await get_db()
    cursor = await db.execute(
        """
        SELECT id, request_id, api_format, is_stream, created_at
        FROM requests
        WHERE project_id = ?
        ORDER BY created_at DESC
        """,
        (project_id,),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.get("/requests/{request_row_id}")
async def get_request_detail(request_row_id: int):
    db = await get_db()
    cursor = await db.execute(
        """
        SELECT r.id, r.request_id, r.api_format, r.is_stream, r.created_at,
               p.id as project_id, p.api_key_prefix, p.model
        FROM requests r
        JOIN projects p ON p.id = r.project_id
        WHERE r.id = ?
        """,
        (request_row_id,),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return dict(row)


@router.get("/requests/{request_row_id}/messages")
async def get_request_messages(request_row_id: int):
    db = await get_db()
    cursor = await db.execute(
        """
        SELECT id, role, content, tool_calls, tool_call_id, direction, sequence, created_at
        FROM messages
        WHERE request_id = ?
        ORDER BY direction, sequence
        """,
        (request_row_id,),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.get("/requests/{request_row_id}/tools")
async def get_request_tools(request_row_id: int):
    db = await get_db()
    cursor = await db.execute(
        """
        SELECT id, name, description, parameters, created_at
        FROM tool_definitions
        WHERE request_id = ?
        """,
        (request_row_id,),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.get("/requests/{request_row_id}/events/count")
async def get_request_event_count(request_row_id: int):
    db = await get_db()
    cursor = await db.execute(
        "SELECT COUNT(*) as count FROM stream_events WHERE request_id = ?",
        (request_row_id,),
    )
    row = await cursor.fetchone()
    return {"count": row["count"]}


@router.get("/requests/{request_row_id}/events")
async def get_request_events(
    request_row_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    db = await get_db()
    # Get total count
    cursor = await db.execute(
        "SELECT COUNT(*) as total FROM stream_events WHERE request_id = ?",
        (request_row_id,),
    )
    total = (await cursor.fetchone())["total"]
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    # Paginated query
    offset = (page - 1) * page_size
    cursor = await db.execute(
        """
        SELECT id, event_type, event_data, sequence, created_at
        FROM stream_events
        WHERE request_id = ?
        ORDER BY sequence
        LIMIT ? OFFSET ?
        """,
        (request_row_id, page_size, offset),
    )
    rows = await cursor.fetchall()
    return {
        "items": [dict(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/requests/{request_row_id}/system-prompt")
async def get_request_system_prompt(request_row_id: int):
    db = await get_db()
    cursor = await db.execute(
        """
        SELECT id, content, created_at
        FROM system_prompts
        WHERE request_id = ?
        """,
        (request_row_id,),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.get("/requests/{request_row_id}/events-stream")
async def stream_request_events(request_row_id: int):
    """SSE endpoint to stream events for a specific request."""

    async def event_generator():
        db = await get_db()
        cursor = await db.execute(
            """
            SELECT event_type, event_data, sequence
            FROM stream_events
            WHERE request_id = ?
            ORDER BY sequence
            """,
            (request_row_id,),
        )
        rows = await cursor.fetchall()
        for row in rows:
            event_data = row["event_data"] if row["event_data"] else "{}"
            yield f"event: {row['event_type']}\ndata: {event_data}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
