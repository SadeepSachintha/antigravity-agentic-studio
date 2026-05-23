import os
import json
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Antigravity Agentic Studio")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to check if Antigravity SDK is installed and verify API key
def check_environment():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "YOUR_GEMINI_API_KEY_HERE":
        return False, "GEMINI_API_KEY is not configured. Please add your key to the .env file."
    return True, ""

@app.get("/api/status")
async def get_status():
    """Returns the initialization and configuration status of the backend."""
    is_ok, error_msg = check_environment()
    return {
        "status": "healthy" if is_ok else "configured_needed",
        "error": error_msg,
        "model_default": "gemini-3.5-flash"
    }

@app.post("/api/chat")
async def chat_endpoint(request: Request):
    """
    Main endpoint for communicating with the agent.
    Streams thoughts first, then token chunks via Server-Sent Events (SSE).
    """
    body = await request.json()
    message = body.get("message", "")
    model = body.get("model", "gemini-3.5-flash")
    system_instructions = body.get("system_instructions", "")
    
    is_ok, error_msg = check_environment()
    if not is_ok:
        async def error_generator():
            yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(error_generator(), media_type="text/event-stream")

    async def event_generator():
        try:
            # We import here so the server launches even if dependencies aren't fully installed yet
            from google.antigravity import Agent, LocalAgentConfig
            
            # Configure agent behavior
            config = LocalAgentConfig(
                model=model,
                system_instructions=system_instructions if system_instructions.strip() else None
            )
            
            async with Agent(config=config) as agent:
                response = await agent.chat(message)
                
                # 1. Stream Thoughts (agent's internal reasoning)
                # Google Antigravity SDK supports streaming thoughts before tokens
                async for thought in response.thoughts:
                    yield f"data: {json.dumps({'type': 'thought', 'content': thought})}\n\n"
                    # Small sleep for smooth flow in UI
                    await asyncio.sleep(0.01)
                
                # 2. Stream Tokens (actual chat response)
                async for token in response:
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                    await asyncio.sleep(0.01)
                    
                # Signal successful end of stream
                yield "data: [DONE]\n\n"
                
        except ImportError:
            yield f"data: {json.dumps({'type': 'error', 'content': 'Google Antigravity SDK is not installed. Please run setup first.'})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': f'Execution Error: {str(e)}'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# Fallback route to redirect root requests to static/index.html
@app.get("/")
async def root():
    return HTMLResponse(content="""
        <html>
            <head><meta http-equiv="refresh" content="0; url=/static/index.html" /></head>
            <body>Redirecting to <a href="/static/index.html">Antigravity Studio</a>...</body>
        </html>
    """)

# Serve static directory. We mount this last so it doesn't mask API routes
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")
