"""Karten — German/English flashcards on Streamlit.

Run locally:   streamlit run streamlit_app.py
Credentials come from st.secrets (.streamlit/secrets.toml locally, or the
Secrets manager on Streamlit Community Cloud). Never committed to git.
"""
import json
from pathlib import Path

import streamlit as st

from s3_loader import DeckError, load_cards

st.set_page_config(page_title="Karten · Flashcards", page_icon="🃏", layout="centered")

# Load Google fonts used by the embedded card UI.
st.markdown(
    '<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">',
    unsafe_allow_html=True,
)

# ── read secrets ──────────────────────────────────────────────
try:
    cfg = st.secrets["aws"]
except (KeyError, FileNotFoundError):
    st.error(
        "No credentials found. Add them under **Settings → Secrets** "
        "(on Streamlit Cloud) or in `.streamlit/secrets.toml` locally. "
        "See `.streamlit/secrets.toml.example`."
    )
    st.stop()


def secret(name, default=None):
    return cfg.get(name, default)


# ── load the deck from S3 (cached) ────────────────────────────
try:
    all_cards = load_cards(
        region=secret("AWS_DEFAULT_REGION", "eu-north-1"),
        access_key=secret("AWS_ACCESS_KEY_ID"),
        secret_key=secret("AWS_SECRET_ACCESS_KEY"),
        bucket=secret("S3_BUCKET"),
        key=secret("S3_KEY"),
        german_col=secret("GERMAN_COLUMN", "german"),
        english_col=secret("ENGLISH_COLUMN", "english"),
    )
except DeckError as exc:
    st.error(str(exc))
    st.stop()

total = len(all_cards)

# ── header + controls ─────────────────────────────────────────
st.title("German → English")
st.caption(f"{total:,} words · {secret('S3_KEY')}")

c1, c2 = st.columns(2)
start = c1.number_input("From row", min_value=1, max_value=total, value=1, step=1)
end = c2.number_input("To row", min_value=1, max_value=total, value=min(20, total), step=1)

c3, c4 = st.columns([2, 1])
direction_label = c3.radio("Show first", ["Deutsch", "English"], horizontal=True)
shuffle = c4.toggle("Shuffle")

if start > end:
    st.warning("“From” row must be less than or equal to “To” row.")
    st.stop()

selected = all_cards[int(start) - 1:int(end)]
direction = "de-en" if direction_label == "Deutsch" else "en-de"

# ── render the swipe component ────────────────────────────────
payload = json.dumps({"cards": selected, "direction": direction, "shuffle": shuffle})
template = (Path(__file__).resolve().parent / "assets" / "practice.html").read_text(encoding="utf-8")
html = template.replace("/*__PAYLOAD__*/", payload)

st.components.v1.html(html, height=640, scrolling=False)

st.caption(
    f"Practicing rows {int(start)}–{int(end)} ({len(selected)} words). "
    "Right swipe = known · left swipe = comes back around."
)
