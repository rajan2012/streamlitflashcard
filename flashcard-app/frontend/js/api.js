// api.js — thin wrapper around the backend JSON API.

async function getJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch (_) { /* keep generic message */ }
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  /** { total, bucket, key } */
  info() {
    return getJSON("/api/info");
  },

  /** Inclusive, 1-based row range -> { start, end, count, cards: [{german, english}] } */
  cards(start, end) {
    return getJSON(`/api/cards?start=${start}&end=${end}`);
  },
};
