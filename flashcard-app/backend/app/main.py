"""FastAPI application entry point.

Serves both the JSON API (under /api) and the static frontend, so the whole
thing runs from one command:

    uvicorn app.main:app --reload
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .routes import router

# .../backend/app/main.py -> repo root -> /frontend
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"

app = FastAPI(title="German–English Flashcards")
app.include_router(router)


@app.get("/")
def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


# Everything else (css/, js/) is served statically.
app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="static")
