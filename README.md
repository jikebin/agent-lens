# Agent Lens

AI Agent 轨迹分析与可视化套件。作为代理中间件拦截 AI API 调用，记录中间轨迹数据（系统提示词、工具定义、消息变化、流式事件等），并提供可视化仪表板。

## 架构

```
Client (OpenAI SDK)  ──→ /v1/chat/completions    ──→ ┐
Client (OpenAI SDK)  ──→ /v1/responses           ──→ ┤
Client (Claude SDK)   ──→ /anthropic/v1/messages  ──→ ┘
                                                       │
                                                       ↓
                                             Proxy ──→ OpenAI-Compatible API
                                                       ↓
                                                 SQLite (轨迹存储)
                                                       │
Browser Dashboard ──→ /api/... ──→ FastAPI ──→ SQLite (查询/可视化)
```

- **多 API 兼容**：通过不同 URL 路径同时兼容 OpenAI Chat Completions、OpenAI Responses 和 Anthropic API 格式
- **流式 + 非流式**：根据请求的 `stream` 参数自动切换，支持 SSE 事件流和普通 JSON 响应
- **轨迹记录**：系统提示词、工具定义与参数、输入输出消息、流式事件全量记录
- **安全存储**：API Key 使用 SHA256 哈希存储，界面仅展示前缀（如 `sk-ab...xyz`）
- **项目组管理**：按 API Key + Model 自动分组，支持删除整个项目组及其关联数据
- **Event Stream 分页**：流式事件按需分页加载，避免大量数据一次性拉取
- **Timeline Mode**：时间线模式，按步骤浏览消息、查看 Diff、状态轴定位、工具侧边栏

## 项目结构

```
agent-lens/
├── backend/              # FastAPI 代理 + 仪表板 API
│   └── app/
│       ├── main.py       # 应用入口，CORS 与路由注册
│       ├── config.py     # pydantic-settings 配置
│       ├── proxy/        # API 代理转发层
│       │   ├── forwarder.py        # httpx 上游转发（流式/非流式）
│       │   ├── openai_adapter.py   # OpenAI 格式适配
│       │   ├── responses_adapter.py# OpenAI Responses 格式适配
│       │   └── anthropic_adapter.py# Anthropic 格式适配
│       ├── recorder/     # 轨迹记录层
│       │   └── trajectory.py       # 事务化轨迹写入
│       ├── db/           # 数据层
│       │   ├── database.py         # SQLite 连接与 Schema
│       │   └── models.py           # 数据模型与工具函数
│       └── dashboard/    # 仪表板 API
│           └── routes.py           # RESTful 查询/删除端点
├── frontend/             # Next.js 可视化仪表板
│   └── src/
│       ├── app/          # Next.js App Router 页面
│       ├── components/   # React 组件
│       ├── lib/          # API 客户端与工具函数
│       └── types/        # TypeScript 类型定义
└── data/                 # SQLite 数据文件目录
```

## 快速开始

### 前置条件

- Python >= 3.12
- Node.js >= 18
- [uv](https://docs.astral.sh/uv/)（Python 包管理）

### 后端

```bash
cd backend
cp .env.example .env   # 编辑 .env 填入实际配置
PYTHONPATH=. uv run uvicorn app.main:app --reload --port 8000
```

环境变量说明：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `UPSTREAM_API_BASE_URL` | 实际模型 API 地址 | `https://api.openai.com/v1` |
| `UPSTREAM_API_KEY` | 实际 API Key | - |
| `UPSTREAM_MODEL` | 转发到上游时使用的模型名称，为空则使用客户端请求中的模型名 | - |
| `SQLITE_PATH` | SQLite 数据库文件路径 | `./data/agent_lens.db` |
| `SERVER_HOST` | 服务监听地址 | `0.0.0.0` |
| `SERVER_PORT` | 服务监听端口 | `8000` |

### 前端

```bash
cd frontend
cp .env.example .env   # 编辑 .env 配置后端地址
npm install
npm run dev
```

访问 `http://localhost:3000` 查看仪表板。

环境变量说明：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NEXT_PUBLIC_API_BASE` | 后端 API 地址（含端口） | `http://localhost:8000` |

前端通过 `NEXT_PUBLIC_API_BASE` 自动连接后端，修改该值即可适配不同后端端口。

## API 使用

### OpenAI 兼容端点

将 OpenAI SDK 的 `base_url` 指向代理即可：

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="your-api-key"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True
)
```

### Anthropic 兼容端点

将 Anthropic SDK 的 `base_url` 指向代理：

```python
import anthropic

client = anthropic.Anthropic(
    base_url="http://localhost:8000/anthropic",
    api_key="your-api-key"
)

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
    stream=True
)
```

### OpenAI Responses API 兼容端点

同样将 OpenAI SDK 的 `base_url` 指向代理，并使用 Responses API：

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="your-api-key"
)

response = client.responses.create(
    model="gpt-4.1",
    instructions="You are a helpful assistant.",
    input="Hello",
    stream=False
)
```

### cURL 示例

```bash
# OpenAI 格式 - 流式
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}],"stream":true}'

# Anthropic 格式 - 非流式
curl http://localhost:8000/anthropic/v1/messages \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":1024,"messages":[{"role":"user","content":"Hello"}]}'

# OpenAI Responses 格式 - 非流式
curl http://localhost:8000/v1/responses \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4.1","instructions":"You are a helpful assistant.","input":"Hello"}'
```

## 仪表板 API

### 项目管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/projects` | GET | 项目列表（按 API Key + Model 分组） |
| `/api/projects/{id}` | DELETE | 删除项目及其所有关联数据（级联删除 requests、messages、events 等） |
| `/api/projects/{id}/requests` | GET | 项目下的请求列表 |

### 请求查询

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/requests/{id}` | GET | 请求详情 |
| `/api/requests/{id}/messages` | GET | 请求消息列表 |
| `/api/requests/{id}/tools` | GET | 请求工具定义 |
| `/api/requests/{id}/system-prompt` | GET | 请求系统提示词 |

### 事件查询

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/requests/{id}/events` | GET | 请求流式事件（分页） |
| `/api/requests/{id}/events/count` | GET | 请求事件总数（轻量） |
| `/api/requests/{id}/events-stream` | GET | 请求事件 SSE 实时流 |

### 分页参数

`GET /api/requests/{id}/events` 支持以下查询参数：

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `page` | int | 1 | >= 1 | 页码 |
| `page_size` | int | 50 | 1 ~ 200 | 每页条数 |

返回格式：

```json
{
  "items": [...],
  "total": 1234,
  "page": 1,
  "page_size": 50,
  "total_pages": 25
}
```

## 技术栈

- **后端**：Python 3.12 / FastAPI / httpx / aiosqlite / pydantic-settings
- **前端**：Next.js 16 / React 19 / TypeScript / Tailwind CSS 4
- **存储**：SQLite
