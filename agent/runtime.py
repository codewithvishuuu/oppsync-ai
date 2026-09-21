from swytchcode_runtime import Swytchcode


def get_runtime() -> Swytchcode:
    return Swytchcode()


def test_runtime_tools() -> dict:
    try:
        swx = get_runtime()
        tools = swx.tools.get(toolkits=["gmail", "calendar", "notion"])
        return {
            "status": "ok",
            "tool_count": len(tools),
            "toolkits": ["gmail", "calendar", "notion"],
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }
