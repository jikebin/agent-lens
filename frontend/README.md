# Agent Lens — Frontend

Next.js 可视化仪表板，用于浏览和分析 Agent Lens 后端记录的 AI 轨迹数据。

## 目录结构

```
frontend/
├── .env.example              # 环境变量模板
├── src/
│   ├── app/                  # Next.js App Router 页面
│   │   ├── page.tsx          # 首页 — 项目列表
│   │   ├── layout.tsx        # 全局布局
│   │   ├── error.tsx         # 错误边界
│   │   ├── loading.tsx       # 全局加载状态
│   │   ├── not-found.tsx     # 404 页面
│   │   ├── globals.css       # 全局样式（Tailwind）
│   │   ├── projects/
│   │   │   └── [id]/
│   │   │       └── page.tsx  # 项目详情 — 请求列表 + 删除按钮
│   │   └── requests/
│   │       └── [id]/
│   │           └── page.tsx  # 请求详情 — 轨迹视图
│   ├── components/           # React 组件
│   │   ├── ProjectList.tsx          # 项目列表
│   │   ├── RequestList.tsx          # 请求列表
│   │   ├── DeleteProjectButton.tsx  # 项目删除按钮（两步确认）
│   │   ├── TrajectoryView.tsx       # 轨迹 Tab 视图
│   │   ├── MessageFlow.tsx          # 消息流
│   │   ├── SystemPrompt.tsx         # 系统提示词
│   │   ├── ToolList.tsx             # 工具定义列表
│   │   └── EventStream.tsx          # 流式事件列表（分页加载）
│   ├── lib/                  # 工具库
│   │   ├── api.ts           # API 客户端（封装 fetch + 数据解析）
│   │   └── format.ts        # 格式化工具函数
│   └── types/                # TypeScript 类型定义
│       └── index.ts          # 所有接口类型
```

## 快速开始

```bash
cd frontend
cp .env.example .env       # 默认连接 http://localhost:8000
npm install
npm run dev
```

访问 `http://localhost:3000`。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NEXT_PUBLIC_API_BASE` | 后端 API 地址（含端口） | `http://localhost:8000` |

前端通过 `NEXT_PUBLIC_API_BASE` 连接后端服务。如果后端运行在不同端口，修改 `.env` 中的值即可：

```bash
# 后端运行在 7000 端口时
NEXT_PUBLIC_API_BASE=http://localhost:7000

# 后端运行在远程服务器时
NEXT_PUBLIC_API_BASE=http://192.168.1.100:8000
```

> 修改 `.env` 后需要重启前端开发服务器才能生效。

## 页面说明

| 路径 | 说明 |
|------|------|
| `/` | 项目列表（按 API Key + Model 分组） |
| `/projects/{id}` | 项目详情 — 请求时间线 + 删除项目按钮 |
| `/requests/{id}` | 请求详情 — 轨迹可视化（Messages / System Prompt / Tools / Events） |

## 核心功能

### 项目管理
- 项目列表展示（按 API Key 前缀 + Model 分组）
- 项目详情页查看请求列表
- 删除项目（两步确认，级联删除所有关联数据）

### 轨迹分析
- **Messages Tab**：输入/输出消息流，支持 JSON 展开
- **System Prompt Tab**：系统提示词查看
- **Tools Tab**：工具定义与参数
- **Events Tab**：流式事件列表，分页加载，点击展开事件详情

### 分页
Event Stream 组件内置分页，每页 50 条，通过 Previous/Next 按钮翻页，仅按需加载当前页数据。

## API 客户端

`src/lib/api.ts` 封装了所有后端调用：

```ts
api.listProjects()                                    // 项目列表
api.deleteProject(projectId)                          // 删除项目
api.listProjectRequests(projectId)                    // 项目请求列表
api.getRequestDetail(requestRowId)                    // 请求详情
api.getRequestMessages(requestRowId)                  // 消息列表
api.getRequestTools(requestRowId)                     // 工具列表
api.getRequestEvents(requestRowId, page?, pageSize?)  // 分页事件
api.getRequestEventCount(requestRowId)                // 事件总数
api.getRequestSystemPrompt(requestRowId)              // 系统提示词
```

所有方法自动解析 JSON 字符串字段（如 `tool_calls`、`event_data`），返回强类型对象。

## 技术栈

| 依赖 | 版本 | 用途 |
|------|------|------|
| Next.js | 16 | App Router SSR |
| React | 19 | UI 框架 |
| TypeScript | 5 | 类型安全 |
| Tailwind CSS | 4 | 暗色主题样式 |
