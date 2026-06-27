"""Load and parse the vocab CSV from S3 for the Streamlit app.

Credentials come from st.secrets (passed in by the caller), never hard-coded.
Results are cached so we don't re-download from S3 on every Streamlit rerun.
"""
import csv
import io

import boto3
import streamlit as st


class DeckError(RuntimeError):
    pass


def _match_column(fieldnames, wanted):
    wanted_norm = wanted.strip().lower()
    for name in fieldnames:
        if name.strip().lower() == wanted_norm:
            return name
    raise DeckError(
        f"Column '{wanted}' not found. CSV headers are: {fieldnames}. "
        f"Fix GERMAN_COLUMN / ENGLISH_COLUMN in your secrets."
    )


# cache the parsed deck for 10 min, keyed on the args below
@st.cache_data(ttl=600, show_spinner="Loading your deck from S3…")
def load_cards(region, access_key, secret_key, bucket, key, german_col, english_col):
    client = boto3.client(
        "s3",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )
    try:
        obj = client.get_object(Bucket=bucket, Key=key)
        raw = obj["Body"].read()
    except Exception as exc:  # noqa: BLE001 - surface a clean message to the UI
        raise DeckError(f"Could not read s3://{bucket}/{key}: {exc}") from exc

    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise DeckError("CSV appears to be empty (no header row).")

    gkey = _match_column(reader.fieldnames, german_col)
    ekey = _match_column(reader.fieldnames, english_col)

    cards = []
    for row in reader:
        g = (row.get(gkey) or "").strip()
        e = (row.get(ekey) or "").strip()
        if g or e:
            cards.append({"german": g, "english": e})

    if not cards:
        raise DeckError("CSV parsed but contained no word rows.")
    return cards
