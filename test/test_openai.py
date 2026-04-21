"""
Agent Lens - OpenAI SDK 集成测试

使用方法:
1. 先启动后端: cd backend && PYTHONPATH=. uv run uvicorn app.main:app --port 7000
2. 再运行本测试: uv run python test/test_openai.py
"""

from openai import OpenAI

# 连接到 Agent Lens 代理中间件
PROXY_BASE_URL = "http://localhost:7000/v1"
# 代理会把这个 key 传给上游，这里填上游 API 需要的 key
API_KEY = "test"

client = OpenAI(base_url=PROXY_BASE_URL, api_key=API_KEY)


def test_non_stream():
    """非流式请求测试"""
    print("=" * 60)
    print("测试 1: 非流式请求")
    print("=" * 60)

    response = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": "你是一个有帮助的AI助手，请用中文回答。"},
            {"role": "user", "content": "用一句话介绍什么是智能体(Agent)?"},
        ],
        stream=False,
    )

    print(f"Model: {response.model}")
    print(f"Response: {response.choices[0].message.content}")
    print(f"Finish reason: {response.choices[0].finish_reason}")
    print()


def test_stream():
    """流式请求测试"""
    print("=" * 60)
    print("测试 2: 流式请求")
    print("=" * 60)

    stream = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": "你是一个有帮助的AI助手，请用中文回答。"},
            {"role": "user", "content": "列举3个AI Agent的常见应用场景，每个用一句话说明。"},
        ],
        stream=True,
    )

    print("Streaming response: ", end="")
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)
    print("\n")


def test_with_tools():
    """带工具调用的请求测试"""
    print("=" * 60)
    print("测试 3: 带工具定义的请求")
    print("=" * 60)

    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "获取指定城市的天气信息",
                "parameters": {
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
            },
        }
    ]

    response = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": "你是一个天气助手，可以查询城市天气。"},
            {"role": "user", "content": "北京今天天气怎么样？"},
        ],
        tools=tools,
        stream=False,
    )

    message = response.choices[0].message
    print(f"Content: {message.content}")
    if message.tool_calls:
        for tc in message.tool_calls:
            print(f"Tool call: {tc.function.name}({tc.function.arguments})")
    print()


if __name__ == "__main__":
    print("Agent Lens - OpenAI SDK 集成测试")
    print(f"代理地址: {PROXY_BASE_URL}")
    print()

    test_non_stream()
    test_stream()
    test_with_tools()

    print("所有测试完成！请访问前端仪表板查看轨迹记录。")
    print("前端地址: http://localhost:3000")
