"""API routes."""
from fastapi import APIRouter, HTTPException, Query

from .models import CardsResponse, DeckInfo
from .config import get_settings
from .s3_service import DeckError, deck_service

router = APIRouter(prefix="/api")


@router.get("/info", response_model=DeckInfo)
def deck_info() -> DeckInfo:
    """Total number of words available, so the UI can show the valid range."""
    settings = get_settings()
    try:
        return DeckInfo(
            total=deck_service.total(),
            bucket=settings.s3_bucket,
            key=settings.s3_key,
        )
    except DeckError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/cards", response_model=CardsResponse)
def get_cards(
    start: int = Query(1, ge=1, description="First row (1-based, inclusive)"),
    end: int = Query(20, ge=1, description="Last row (1-based, inclusive)"),
) -> CardsResponse:
    """Return the slice of cards for the requested row range."""
    try:
        cards = deck_service.get_range(start, end)
    except DeckError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CardsResponse(start=start, end=end, count=len(cards), cards=cards)


@router.post("/refresh")
def refresh_deck() -> dict[str, str]:
    """Drop the in-memory cache and re-read the CSV from S3 on next request."""
    deck_service.refresh()
    return {"status": "ok"}
