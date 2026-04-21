from __future__ import annotations

import json
from typing import AsyncGenerator

import httpx

from app.config import settings

# Shared HTTP client (initialized in lifespan)
_http_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    return _http_client


def init_http_client() -> httpx.AsyncClient:
    global _http_client
    _http_client = httpx.AsyncClient(timeout=120.0)
    return _http_client


async def close_http_client():
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None


class UpstreamError(Exception):
    """Error from upstream API, with status code and response body."""

    def __init__(self, status_code: int, body: dict | str):
        self.status_code = status_code
        self.body = body

    def to_json(self) -> dict:
        if isinstance(self.body, dict):
            return self.body
        return {"error": {"message": str(self.body), "type": "upstream_error"}}


def _get_upstream_url(path: str) -> str:
    base = settings.upstream_api_base_url.rstrip("/")
    return f"{base}{path}"


def _default_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.upstream_api_key}",
        "Content-Type": "application/json",
    }


async def forward_stream(
    path: str, payload: dict, extra_headers: dict | None = None
) -> AsyncGenerator[dict, None]:
    url = _get_upstream_url(path)
    headers = _default_headers()
    if extra_headers:
        headers.update(extra_headers)

    client = get_http_client()
    try:
        async with client.stream(
            "POST", url, json=payload, headers=headers
        ) as response:
            if response.status_code >= 400:
                body = await response.aread()
                try:
                    error_body = json.loads(body)
                except json.JSONDecodeError:
                    error_body = body.decode(errors="replace")
                raise UpstreamError(response.status_code, error_body)

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data.strip() == "[DONE]":
                    yield {"done": True}
                    return
                try:
                    chunk = json.loads(data)
                    yield chunk
                except json.JSONDecodeError:
                    continue
    except UpstreamError:
        raise
    except httpx.ConnectError as e:
        raise UpstreamError(502, {"error": {"message": f"Upstream connection failed: {e}", "type": "connection_error"}}) from e
    except httpx.TimeoutException as e:
        raise UpstreamError(504, {"error": {"message": f"Upstream request timed out: {e}", "type": "timeout_error"}}) from e


async def forward_non_stream(
    path: str, payload: dict, extra_headers: dict | None = None
) -> dict:
    url = _get_upstream_url(path)
    headers = _default_headers()
    if extra_headers:
        headers.update(extra_headers)

    client = get_http_client()
    try:
        response = await client.post(url, json=payload, headers=headers)
    except httpx.ConnectError as e:
        raise UpstreamError(502, {"error": {"message": f"Upstream connection failed: {e}", "type": "connection_error"}}) from e
    except httpx.TimeoutException as e:
        raise UpstreamError(504, {"error": {"message": f"Upstream request timed out: {e}", "type": "timeout_error"}}) from e

    if response.status_code >= 400:
        try:
            error_body = response.json()
        except json.JSONDecodeError:
            error_body = response.text
        raise UpstreamError(response.status_code, error_body)

    return response.json()
