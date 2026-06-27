# Karten — German ↔ English Flashcards

A small, self-hosted flashcard app. It reads a `german,english` CSV straight
from **your S3 bucket**, lets you pick a **row range** (e.g. rows 100–120),
and drills you with **Tinder-style swipe cards**. Swipe right when you know a
word; swipe left and it loops back around until you do.

```
┌──────────────┐   right swipe / →  ✓  "I know it"      → leaves the deck
│   das Haus   │
│   (tap=flip) │   left  swipe / ←  ✕  "show me again"  → back of the deck
└──────────────┘   space = flip   ·   Backspace = undo last swipe
```

---

## 1. What YOU need to edit (only one file)

Copy the example env file and fill it in:

```bash
cd backend
cp .env.example .env
```

Then open `backend/.env` and set:

| Variable | What to put |
|---|---|
| `AWS_ACCESS_KEY_ID` | your key |
| `AWS_SECRET_ACCESS_KEY` | your secret |
| `AWS_DEFAULT_REGION` | bucket region, e.g. `eu-central-1` |
| `S3_BUCKET` | bucket name only, e.g. `my-vocab-bucket` |
| `S3_KEY` | path inside the bucket, e.g. `decks/german.csv` |

> For `s3://my-vocab-bucket/decks/german.csv` → `S3_BUCKET=my-vocab-bucket`
> and `S3_KEY=decks/german.csv`.

If your CSV headers are **not** literally `german` / `english`, also set
`GERMAN_COLUMN` and `ENGLISH_COLUMN` in the same file. (Matching is
case-insensitive, so `German`/`English` already work.)

The IAM user for those keys needs `s3:GetObject` on that object. Nothing else.

---

## 2. Run it

Requires **Python 3.10+**. No Node build step — the frontend is plain static files.

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open **http://localhost:8000**. That's it.

---

## 3. How the range works

Rows are **1-based and inclusive**, counting data rows only (the header row
doesn't count). So `From 100 → To 120` gives you 21 cards. If you ask for more
rows than the file has, it's clamped to the last row. The setup screen shows
the total word count so you know the valid range.

---

## 4. Features

- **Swipe or click or keys** — drag the card, use the ✕ / ↺ / ✓ buttons, or
  `←` `→` for review/know, `space` to flip, `Backspace` to undo.
- **Left-swiped words come back** — they go to the back of the deck and keep
  cycling until you swipe them right, so a session only ends once you know
  every word in the range.
- **Undo** any mis-swipe.
- **Direction toggle** — show German first or English first.
- **Shuffle** the range.
- **Quick picks** — first 20 / first 50 / a random window of 20.
- **In-memory cache** — the CSV is fetched from S3 once and cached
  (`CACHE_TTL_SECONDS`, default 10 min). `POST /api/refresh` forces a re-read
  if you update the file in S3.

---

## 5. Project structure

```
flashcard-app/
├── backend/
│   ├── app/
│   │   ├── config.py       # reads .env (creds, bucket, key, column names)
│   │   ├── models.py       # API response shapes
│   │   ├── s3_service.py   # download + parse CSV, cache, slice ranges
│   │   ├── routes.py       # /api/info, /api/cards, /api/refresh
│   │   └── main.py         # FastAPI app + serves the frontend
│   ├── requirements.txt
│   └── .env.example        # ← copy to .env and fill in
└── frontend/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js          # talks to the backend
        ├── deck.js         # session state + requeue/undo logic
        ├── swipe.js        # drag/throw gesture controller
        └── main.js         # screen flow + wiring
```

## CSV format expected

```csv
german,english
Haus,house
Hund,dog
Katze,cat
```

Blank rows are skipped, surrounding whitespace is trimmed, and an Excel
UTF-8 BOM is handled automatically.
```
