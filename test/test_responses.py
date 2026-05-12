"""
Agent Lens - OpenAI Responses API 集成测试

使用方法:
1. 先启动后端: cd backend && PYTHONPATH=. uv run uvicorn app.main:app --port 7000
2. 再运行本测试: uv run python test/test_responses.py
"""

from openai import OpenAI

PROXY_BASE_URL = "http://localhost:7000/v1"
API_KEY = "test"

client = OpenAI(base_url=PROXY_BASE_URL, api_key=API_KEY)


def test_non_stream():
    """非流式 Responses 请求测试"""
    print("=" * 60)
    print("测试 1: Responses 非流式请求")
    print("=" * 60)

    response = client.responses.create(
        model="qwen-plus",
        instructions="你是一个有帮助的AI助手，请用中文回答。",
        input="用一句话介绍什么是智能体(Agent)?",
        stream=False,
    )

    print(f"Model: {response.model}")
    print(f"Response: {response.output_text}")
    print()


def test_stream():
    """流式 Responses 请求测试"""
    print("=" * 60)
    print("测试 2: Responses 流式请求")
    print("=" * 60)

    stream = client.responses.create(
        model="qwen-plus",
        instructions="你是一个有帮助的AI助手，请用中文回答。",
        input="列举3个AI Agent的常见应用场景，每个用一句话说明。",
        stream=True,
    )

    print("Streaming response: ", end="")
    for event in stream:
        if event.type == "response.output_text.delta":
            print(event.delta, end="", flush=True)
    print("\n")


def test_with_tools():
    """带工具定义的 Responses 请求测试"""
    print("=" * 60)
    print("测试 3: Responses 带工具定义的请求")
    print("=" * 60)

    response = client.responses.create(
        model="qwen-plus",
        instructions="你是一个天气助手，可以查询城市天气。",
        input="北京今天天气怎么样？",
        tools=[
            {
                "type": "function",
                "name": "get_weather",
                "description": "获取指定城市的天气信息",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city": {"type": "string", "description": "城市名称"},
                        "unit": {
                            "type": "string",
                            "enum": ["celsius", "fahrenheit"],
                            "description": "温度单位",
                        },
                    },
                    "required": ["city"],
                },
            }
        ],
    )

    for item in response.output:
        if item.type == "message":
            print(f"Content: {response.output_text}")
        elif item.type == "function_call":
            print(f"Tool call: {item.name}({item.arguments})")
    print()


if __name__ == "__main__":
    print("Agent Lens - OpenAI Responses API 集成测试")
    print(f"代理地址: {PROXY_BASE_URL}")
    print()

    test_non_stream()
    test_stream()
    test_with_tools()

    print("所有测试完成！请访问前端仪表板查看轨迹记录。")
    print("前端地址: http://localhost:3000")
