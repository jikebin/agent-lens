# Agent Lens — Backend

FastAPI 代理中间件 + 仪表板 API 服务。拦截 OpenAI Chat Completions / OpenAI Responses / Anthropic API 调用，记录轨迹数据到 SQLite，并提供 RESTful 查询接口。

## 目录结构

```
backend/
├── .env.example          # 环境变量模板
├── app/
│   ├── main.py           # 应用入口，CORS 与路由注册
│   ├── config.py         # pydantic-settings 配置
│   ├── proxy/            # API 代理转发层
│   │   ├── forwarder.py            # httpx 上游转发（流式/非流式）
│   │   ├── openai_adapter.py       # OpenAI 格式适配 + 轨迹记录
│   │   ├── responses_adapter.py    # OpenAI Responses 格式适配 + 轨迹记录
│   │   └── anthropic_adapter.py    # Anthropic 格式适配 + 轨迹记录
│   ├── recorder/         # 轨迹记录层
│   │   └── trajectory.py           # 事务化轨迹写入
│   ├── db/               # 数据层
│   │   ├── database.py             # SQLite 连接管理 & Schema 定义
│   │   └── models.py               # 数据模型 (dataclass) 与 hash/mask 工具函数
│   └── dashboard/        # 仪表板 API
│       └── routes.py               # RESTful 端点（查询、删除、分页）
└── data/                 # SQLite 数据文件目录（运行时生成）
```

## 快速开始

```bash
cd backend
cp .env.example .env      # 编辑 .env 填入实际配置
PYTHONPATH=. uv run uvicorn app.main:app --reload --port 7000
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `UPSTREAM_API_BASE_URL` | 上游模型 API 地址 | `https://api.openai.com/v1` |
| `UPSTREAM_API_KEY` | 上游 API Key | - |
| `UPSTREAM_MODEL` | 转发到上游时的模型名，为空则透传客户端请求中的模型名 | - |
| `SQLITE_PATH` | SQLite 数据库文件路径 | `./data/agent_lens.db` |
| `SERVER_HOST` | 服务监听地址 | `0.0.0.0` |
| `SERVER_PORT` | 服务监听端口 | `8000` |

## 数据库 Schema

SQLite，6 张表，启动时自动建表：

```
projects          ← 按 (api_key_hash, model) 唯一索引的项目组
  └─ requests     ← 每次 API 调用一条记录
       ├─ system_prompts    ← 系统提示词
       ├─ tool_definitions  ← 工具定义与参数
       ├─ messages          ← 输入/输出消息
       └─ stream_events     ← 流式事件
```

> SQLite 默认不强制外键约束，删除操作在应用层按深度顺序级联执行。

## 依赖

| 包 | 用途 |
|------|------|
| fastapi | Web 框架 |
| uvicorn | ASGI 服务器 |
| httpx | 异步 HTTP 客户端（上游转发） |
| aiosqlite | 异步 SQLite 驱动 |
| pydantic / pydantic-settings | 配置管理与数据校验 |
| openai | OpenAI 响应解析 |
| anthropic | Anthropic 响应解析 |

## API 端点

### 代理端点（客户端调用）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/chat/completions` | POST | OpenAI 格式代理 |
| `/v1/responses` | POST | OpenAI Responses 格式代理 |
| `/anthropic/v1/messages` | POST | Anthropic 格式代理 |

### 仪表板端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/projects` | GET | 项目列表（含 request_count） |
| `/api/projects/{id}` | DELETE | 删除项目及所有关联数据 |
| `/api/projects/{id}/requests` | GET | 项目下的请求列表 |
| `/api/requests/{id}` | GET | 请求详情 |
| `/api/requests/{id}/messages` | GET | 请求消息列表 |
| `/api/requests/{id}/tools` | GET | 请求工具定义 |
| `/api/requests/{id}/system-prompt` | GET | 请求系统提示词 |
| `/api/requests/{id}/events` | GET | 请求流式事件（分页：`?page=1&page_size=50`） |
| `/api/requests/{id}/events/count` | GET | 请求事件总数 |
| `/api/requests/{id}/events-stream` | GET | 请求事件 SSE 实时流 |

### 分页响应格式

```json
{
  "items": [...],
  "total": 1234,
  "page": 1,
  "page_size": 50,
  "total_pages": 25
}
```

`page_size` 范围 1 ~ 200，默认 50。
