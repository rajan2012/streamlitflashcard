"""API data models."""
from pydantic import BaseModel


class Card(BaseModel):
    german: str
    english: str


class DeckInfo(BaseModel):
    total: int          # total number of word rows available in the CSV
    bucket: str
    key: str


class CardsResponse(BaseModel):
    start: int          # 1-based, inclusive
    end: int            # 1-based, inclusive
    count: int
    cards: list[Card]
