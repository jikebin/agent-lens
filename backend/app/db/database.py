import asyncio

import aiosqlite

from app.config import settings

_db: aiosqlite.Connection | None = None
_db_lock = asyncio.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_hash TEXT NOT NULL,
    api_key_prefix TEXT NOT NULL,
    model TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMP DEFAULT (datetime('now','localtime')),
    UNIQUE(api_key_hash, model)
);

CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    request_id TEXT NOT NULL UNIQUE,
    api_format TEXT NOT NULL,
    is_stream INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS system_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tool_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    name TEXT NOT NULL,
    description TEXT,
    parameters TEXT,
    created_at TIMESTAMP DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    role TEXT NOT NULL,
    content TEXT,
    tool_calls TEXT,
    tool_call_id TEXT,
    direction TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS stream_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    event_type TEXT NOT NULL,
    event_data TEXT,
    sequence INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT (datetime('now','localtime'))
);
"""


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is not None:
        return _db
    async with _db_lock:
        if _db is not None:
            return _db
        _db = await aiosqlite.connect(settings.sqlite_path)
        _db.row_factory = aiosqlite.Row
        await _db.executescript(SCHEMA)
        await _db.commit()
    return _db


async def close_db():
    global _db
    async with _db_lock:
        if _db is not None:
            await _db.close()
            _db = None
