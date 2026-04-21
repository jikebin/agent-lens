export interface Project {
  id: number;
  api_key_hash: string;
  api_key_prefix: string;
  model: string;
  name: string | null;
  created_at: string;
  request_count: number;
  total_tokens: number;
  error_count: number;
}

export interface RequestInfo {
  id: number;
  request_id: string;
  api_format: "openai" | "anthropic";
  is_stream: number;
  created_at: string;
  status: "success" | "error";
  error_type: string | null;
  error_message: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface RequestDetail {
  id: number;
  request_id: string;
  api_format: "openai" | "anthropic";
  is_stream: number;
  created_at: string;
  project_id: number;
  api_key_prefix: string;
  model: string;
  status: "success" | "error";
  error_type: string | null;
  error_message: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface Message {
  id: number;
  role: string;
  content: string | null;
  tool_calls: object[] | null;
  tool_call_id: string | null;
  direction: "input" | "output";
  sequence: number;
  created_at: string;
}

export interface ToolDefinition {
  id: number;
  name: string;
  description: string | null;
  parameters: object | null;
  created_at: string;
}

export interface StreamEvent {
  id: number;
  event_type: string;
  event_data: object | null;
  sequence: number;
  created_at: string;
}

export interface SystemPrompt {
  id: number;
  content: string;
  created_at: string;
}

export interface PaginatedEventsResponse {
  items: StreamEvent[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DailyTokenTrend {
  date: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  request_count: number;
}

export interface ProjectStats {
  total_requests: number;
  error_count: number;
  success_count: number;
  error_rate: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  avg_tokens_per_request: number;
  avg_tokens_success: number;
  daily_token_trend: DailyTokenTrend[];
}
