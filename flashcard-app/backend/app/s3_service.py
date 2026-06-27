"""S3 service: download the CSV once, cache it, and serve row ranges.

The CSV is fetched from S3 and kept in memory for `cache_ttl_seconds` so we
don't hit S3 on every request. Parsing is done with the standard library only
(no pandas needed) to keep the install small and fast.
"""
import csv
import io
import time
from threading import Lock

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from .config import Settings, get_settings
from .models import Card


class DeckError(RuntimeError):
    """Raised when the deck can't be loaded or is misconfigured."""


class S3DeckService:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._lock = Lock()
        self._cards: list[Card] | None = None
        self._fetched_at: float = 0.0

    # -- public API -------------------------------------------------------

    def total(self) -> int:
        return len(self._get_cards())

    def get_range(self, start: int, end: int) -> list[Card]:
        """Return cards for the inclusive, 1-based row range [start, end]."""
        cards = self._get_cards()
        if start < 1:
            start = 1
        if end > len(cards):
            end = len(cards)
        if start > end:
            raise DeckError(f"Invalid range: start ({start}) is after end ({end}).")
        # Convert 1-based inclusive -> 0-based slice
        return cards[start - 1:end]

    def refresh(self) -> None:
        """Force a re-download on the next access."""
        with self._lock:
            self._cards = None
            self._fetched_at = 0.0

    # -- internals --------------------------------------------------------

    def _is_fresh(self) -> bool:
        if self._cards is None:
            return False
        age = time.time() - self._fetched_at
        return age < self._settings.cache_ttl_seconds

    def _get_cards(self) -> list[Card]:
        with self._lock:
            if not self._is_fresh():
                self._cards = self._download_and_parse()
                self._fetched_at = time.time()
            return self._cards

    def _download_and_parse(self) -> list[Card]:
        raw = self._download_csv_bytes()
        return self._parse_csv(raw)

    def _download_csv_bytes(self) -> bytes:
        s = self._settings
        client = boto3.client(
            "s3",
            region_name=s.aws_default_region,
            aws_access_key_id=s.aws_access_key_id,
            aws_secret_access_key=s.aws_secret_access_key,
        )
        try:
            obj = client.get_object(Bucket=s.s3_bucket, Key=s.s3_key)
            return obj["Body"].read()
        except (BotoCoreError, ClientError) as exc:
            raise DeckError(
                f"Could not read s3://{s.s3_bucket}/{s.s3_key}: {exc}"
            ) from exc

    def _parse_csv(self, raw: bytes) -> list[Card]:
        # utf-8-sig transparently strips a BOM if Excel added one.
        text = raw.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))

        if reader.fieldnames is None:
            raise DeckError("CSV appears to be empty (no header row).")

        german_key = self._match_column(reader.fieldnames, self._settings.german_column)
        english_key = self._match_column(reader.fieldnames, self._settings.english_column)

        cards: list[Card] = []
        for row in reader:
            german = (row.get(german_key) or "").strip()
            english = (row.get(english_key) or "").strip()
            if german or english:  # skip fully blank rows
                cards.append(Card(german=german, english=english))

        if not cards:
            raise DeckError("CSV parsed but contained no word rows.")
        return cards

    @staticmethod
    def _match_column(fieldnames: list[str], wanted: str) -> str:
        """Case-/whitespace-insensitive column lookup with a clear error."""
        wanted_norm = wanted.strip().lower()
        for name in fieldnames:
            if name.strip().lower() == wanted_norm:
                return name
        raise DeckError(
            f"Column '{wanted}' not found. CSV headers are: {fieldnames}. "
            f"Fix GERMAN_COLUMN / ENGLISH_COLUMN in your .env."
        )


# Single shared instance for the app.
deck_service = S3DeckService(get_settings())
