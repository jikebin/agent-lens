import type {
  Project,
  RequestInfo,
  RequestDetail,
  Message,
  ToolDefinition,
  StreamEvent,
  SystemPrompt,
  PaginatedEventsResponse,
  ProjectStats,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, { cache: "no-store", ...options });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Safely parse a JSON string, returning null on failure. */
function safeParseJSON(value: string | null | undefined): object | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseMessages(raw: Record<string, unknown>[]): Message[] {
  return raw.map((m) => ({
    id: m.id as number,
    role: m.role as string,
    content: m.content as string | null,
    tool_calls: safeParseJSON(m.tool_calls as string | null) as object[] | null,
    tool_call_id: m.tool_call_id as string | null,
    direction: m.direction as "input" | "output",
    sequence: m.sequence as number,
    created_at: m.created_at as string,
  }));
}

function parseTools(raw: Record<string, unknown>[]): ToolDefinition[] {
  return raw.map((t) => ({
    id: t.id as number,
    name: t.name as string,
    description: t.description as string | null,
    parameters: safeParseJSON(t.parameters as string | null),
    created_at: t.created_at as string,
  }));
}

function parseEvents(raw: Record<string, unknown>[]): StreamEvent[] {
  return raw.map((e) => ({
    id: e.id as number,
    event_type: e.event_type as string,
    event_data: safeParseJSON(e.event_data as string | null),
    sequence: e.sequence as number,
    created_at: e.created_at as string,
  }));
}

export const api = {
  listProjects: (search?: string) => {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    return fetchJSON<Project[]>(`/api/projects${params}`);
  },

  deleteProject: (projectId: number) =>
    fetchJSON<{ deleted: boolean }>(`/api/projects/${projectId}`, { method: "DELETE" }),

  listProjectRequests: (projectId: number, filters?: { status?: string; api_format?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.api_format) params.set("api_format", filters.api_format);
    if (filters?.search) params.set("search", filters.search);
    const qs = params.toString();
    return fetchJSON<RequestInfo[]>(`/api/projects/${projectId}/requests${qs ? `?${qs}` : ""}`);
  },

  getRequestDetail: (requestRowId: number) =>
    fetchJSON<RequestDetail>(`/api/requests/${requestRowId}`),

  getRequestMessages: (requestRowId: number) =>
    fetchJSON<Record<string, unknown>[]>(`/api/requests/${requestRowId}/messages`).then(parseMessages),

  getRequestTools: (requestRowId: number) =>
    fetchJSON<Record<string, unknown>[]>(`/api/requests/${requestRowId}/tools`).then(parseTools),

  getRequestEvents: (requestRowId: number, page?: number, pageSize?: number) => {
    const params = new URLSearchParams();
    if (page) params.set("page", String(page));
    if (pageSize) params.set("page_size", String(pageSize));
    const qs = params.toString();
    const url = `/api/requests/${requestRowId}/events${qs ? `?${qs}` : ""}`;
    return fetchJSON<PaginatedEventsResponse>(url).then((res) => ({
      ...res,
      items: parseEvents(res.items as unknown as Record<string, unknown>[]),
    }));
  },

  getRequestEventCount: (requestRowId: number) =>
    fetchJSON<{ count: number }>(`/api/requests/${requestRowId}/events/count`),

  getRequestSystemPrompt: (requestRowId: number) =>
    fetchJSON<SystemPrompt[]>(`/api/requests/${requestRowId}/system-prompt`),

  getProjectStats: (projectId: number) =>
    fetchJSON<ProjectStats>(`/api/projects/${projectId}/stats`),
};
