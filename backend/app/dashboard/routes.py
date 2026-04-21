from __future__ import annotations

import json
import math

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.db.database import get_db

router = APIRouter(prefix="/api")


@router.get("/projects")
async def list_projects(search: str | None = Query(None)):
    db = await get_db()

    params = []
    where_clause = ""
    if search:
        where_clause = "WHERE (p.model LIKE ? OR p.api_key_prefix LIKE ? OR COALESCE(p.name,'') LIKE ?)"
        params = [f"%{search}%", f"%{search}%", f"%{search}%"]

    cursor = await db.execute(
        f"""
        SELECT p.id, p.api_key_hash, p.api_key_prefix, p.model, p.name, p.created_at,
               COUNT(r.id) as request_count,
               COALESCE(SUM(r.total_tokens), 0) as total_tokens,
               SUM(CASE WHEN r.status='error' THEN 1 ELSE 0 END) as error_count
        FROM projects p
        LEFT JOIN requests r ON r.project_id = p.id
        {where_clause}
        GROUP BY p.id
        ORDER BY p.created_at DESC
        """,
        params,
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
async def list_project_requests(
    project_id: int,
    status: str | None = Query(None, pattern="^(success|error)$"),
    api_format: str | None = Query(None, pattern="^(openai|anthropic)$"),
    search: str | None = Query(None),
):
    db = await get_db()

    conditions = ["project_id = ?"]
    params: list = [project_id]

    if status:
        conditions.append("status = ?")
        params.append(status)
    if api_format:
        conditions.append("api_format = ?")
        params.append(api_format)
    if search:
        conditions.append("request_id LIKE ?")
        params.append(f"%{search}%")

    where = " AND ".join(conditions)

    cursor = await db.execute(
        f"""
        SELECT id, request_id, api_format, is_stream, created_at,
               status, error_type, error_message, prompt_tokens, completion_tokens, total_tokens
        FROM requests
        WHERE {where}
        ORDER BY created_at DESC
        """,
        params,
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.get("/requests/{request_row_id}")
async def get_request_detail(request_row_id: int):
    db = await get_db()
    cursor = await db.execute(
        """
        SELECT r.id, r.request_id, r.api_format, r.is_stream, r.created_at,
               r.status, r.error_type, r.error_message,
               r.prompt_tokens, r.completion_tokens, r.total_tokens,
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


@router.get("/projects/{project_id}/stats")
async def get_project_stats(project_id: int):
    db = await get_db()

    cursor = await db.execute(
        """
        SELECT COUNT(*) as total_requests,
               SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as error_count,
               SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as success_count,
               COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
               COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
               COALESCE(SUM(total_tokens), 0) as total_tokens
        FROM requests
        WHERE project_id = ?
        """,
        (project_id,),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")

    stats = dict(row)
    total = stats["total_requests"] or 0
    error_count = stats["error_count"] or 0
    success_count = stats["success_count"] or 0
    total_tokens = stats["total_tokens"] or 0

    stats["error_rate"] = round(error_count / total, 4) if total > 0 else 0
    stats["avg_tokens_per_request"] = round(total_tokens / total) if total > 0 else 0
    stats["avg_tokens_success"] = round(total_tokens / success_count) if success_count > 0 else 0

    # Daily token trend for last 30 days
    cursor = await db.execute(
        """
        SELECT DATE(created_at) as date,
               SUM(prompt_tokens) as prompt_tokens,
               SUM(completion_tokens) as completion_tokens,
               SUM(total_tokens) as total_tokens,
               COUNT(*) as request_count
        FROM requests
        WHERE project_id = ? AND created_at >= DATE('now', '-30 days')
        GROUP BY DATE(created_at)
        ORDER BY date
        """,
        (project_id,),
    )
    daily_rows = await cursor.fetchall()
    stats["daily_token_trend"] = [dict(r) for r in daily_rows]

    return stats


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
