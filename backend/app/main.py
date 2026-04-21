from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import close_db, get_db
from app.db.migrations import run_migrations
from app.proxy.forwarder import close_http_client, init_http_client
from app.proxy.openai_adapter import router as openai_router
from app.proxy.anthropic_adapter import router as anthropic_router
from app.dashboard.routes import router as dashboard_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize on startup
    await get_db()
    await run_migrations()
    init_http_client()
    yield
    # Close on shutdown
    await close_http_client()
    await close_db()


app = FastAPI(title="Agent Lens", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Proxy routes
app.include_router(openai_router)
app.include_router(anthropic_router)

# Dashboard API routes
app.include_router(dashboard_router)


@app.get("/")
async def root():
    return {"name": "Agent Lens", "version": "0.1.0"}
