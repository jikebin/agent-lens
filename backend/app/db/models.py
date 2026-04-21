from __future__ import annotations

import hashlib
from dataclasses import dataclass, field


@dataclass
class Project:
    id: int | None = None
    api_key_hash: str = ""
    api_key_prefix: str = ""
    model: str = ""
    name: str | None = None
    created_at: str = ""


@dataclass
class Request:
    id: int | None = None
    project_id: int = 0
    request_id: str = ""
    api_format: str = ""  # "openai" or "anthropic"
    is_stream: bool = False
    status: str = "success"
    error_type: str | None = None
    error_message: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    created_at: str = ""


@dataclass
class SystemPrompt:
    id: int | None = None
    request_id: int = 0
    content: str = ""
    created_at: str = ""


@dataclass
class ToolDefinition:
    id: int | None = None
    request_id: int = 0
    name: str = ""
    description: str | None = None
    parameters: str | None = None  # JSON string
    created_at: str = ""


@dataclass
class Message:
    id: int | None = None
    request_id: int = 0
    role: str = ""
    content: str | None = None
    tool_calls: str | None = None  # JSON string
    tool_call_id: str | None = None
    direction: str = ""  # "input" or "output"
    sequence: int = 0
    created_at: str = ""


@dataclass
class StreamEvent:
    id: int | None = None
    request_id: int = 0
    event_type: str = ""
    event_data: str | None = None  # JSON string
    sequence: int = 0
    created_at: str = ""


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()


def mask_api_key(api_key: str) -> str:
    if len(api_key) <= 8:
        return api_key[:2] + "..." + api_key[-2:] if len(api_key) > 4 else api_key
    return api_key[:4] + "..." + api_key[-4:]
