from __future__ import annotations

from app.db.database import get_db


_MIGRATIONS = {
    1: """
        ALTER TABLE requests ADD COLUMN status TEXT NOT NULL DEFAULT 'success';
        ALTER TABLE requests ADD COLUMN error_type TEXT;
        ALTER TABLE requests ADD COLUMN error_message TEXT;
        ALTER TABLE requests ADD COLUMN prompt_tokens INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE requests ADD COLUMN completion_tokens INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE requests ADD COLUMN total_tokens INTEGER NOT NULL DEFAULT 0;
    """,
    2: """
        UPDATE projects SET created_at = datetime(created_at, 'localtime') WHERE created_at IS NOT NULL;
        UPDATE requests SET created_at = datetime(created_at, 'localtime') WHERE created_at IS NOT NULL;
        UPDATE system_prompts SET created_at = datetime(created_at, 'localtime') WHERE created_at IS NOT NULL;
        UPDATE tool_definitions SET created_at = datetime(created_at, 'localtime') WHERE created_at IS NOT NULL;
        UPDATE messages SET created_at = datetime(created_at, 'localtime') WHERE created_at IS NOT NULL;
        UPDATE stream_events SET created_at = datetime(created_at, 'localtime') WHERE created_at IS NOT NULL;
    """,
}


async def run_migrations() -> None:
    db = await get_db()
    await db.executescript(
        "CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY);"
    )
    await db.commit()

    cursor = await db.execute("SELECT version FROM _migrations")
    applied = {row[0] for row in await cursor.fetchall()}

    for version in sorted(_MIGRATIONS):
        if version not in applied:
            await db.executescript(_MIGRATIONS[version])
            await db.execute(
                "INSERT INTO _migrations (version) VALUES (?)", (version,)
            )
            await db.commit()
