"""
Agent Lens - Anthropic SDK 集成测试

使用方法:
1. 先启动后端: cd backend && PYTHONPATH=. uv run uvicorn app.main:app --port 7000
2. 再运行本测试: uv run python test/test_anthropic.py

注意: 实际请求的模型由后端 UPSTREAM_MODEL 配置决定，
      此处的 model 参数仅作为请求标识，不影响上游实际调用的模型。
"""

import anthropic

# 连接到 Agent Lens 代理中间件
PROXY_BASE_URL = "http://localhost:7000/anthropic"
# 代理会把这个 key 传给上游，这里填上游 API 需要的 key
API_KEY = "test"
# 模型名称仅作标识，实际模型由后端 UPSTREAM_MODEL 环境变量控制
MODEL = "claude-sonnet-4-20250514"

client = anthropic.Anthropic(base_url=PROXY_BASE_URL, api_key=API_KEY)


def test_non_stream():
    """非流式请求测试"""
    print("=" * 60)
    print("测试 1: 非流式请求")
    print("=" * 60)

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system="你是一个有帮助的AI助手，请用中文回答。",
        messages=[
            {"role": "user", "content": "用一句话介绍什么是智能体(Agent)?"},
        ],
    )

    print(f"Model: {response.model}")
    print(f"Response: {response.content[0].text}")
    print(f"Stop reason: {response.stop_reason}")
    print(f"Input tokens: {response.usage.input_tokens}")
    print(f"Output tokens: {response.usage.output_tokens}")
    print()


def test_stream():
    """流式请求测试"""
    print("=" * 60)
    print("测试 2: 流式请求")
    print("=" * 60)

    with client.messages.stream(
        model=MODEL,
        max_tokens=1024,
        system="你是一个有帮助的AI助手，请用中文回答。",
        messages=[
            {"role": "user", "content": "列举3个AI Agent的常见应用场景，每个用一句话说明。"},
        ],
    ) as stream:
        print("Streaming response: ", end="")
        for text in stream.text_stream:
            print(text, end="", flush=True)
    print("\n")


def test_with_tools():
    """带工具调用的请求测试"""
    print("=" * 60)
    print("测试 3: 带工具定义的请求")
    print("=" * 60)

    tools = [
        {
            "name": "get_weather",
            "description": "获取指定城市的天气信息",
            "input_schema": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称",
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "温度单位",
                    },
                },
                "required": ["city"],
            },
        }
    ]

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system="你是一个天气助手，可以查询城市天气。",
        messages=[
            {"role": "user", "content": "北京今天天气怎么样？"},
        ],
        tools=tools,
    )

    for block in response.content:
        if block.type == "text":
            print(f"Content: {block.text}")
        elif block.type == "tool_use":
            print(f"Tool call: {block.name}({block.input})")
    print()


if __name__ == "__main__":
    print("Agent Lens - Anthropic SDK 集成测试")
    print(f"代理地址: {PROXY_BASE_URL}")
    print()

    test_non_stream()
    test_stream()
    test_with_tools()

    print("所有测试完成！请访问前端仪表板查看轨迹记录。")
    print("前端地址: http://localhost:3000")
