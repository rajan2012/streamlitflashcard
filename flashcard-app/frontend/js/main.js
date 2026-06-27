// main.js — wires the UI together.
import { api } from "./api.js";
import { Deck } from "./deck.js";
import { SwipeCard } from "./swipe.js";

// ── DOM ───────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const screens = {
  setup: $("#setup"),
  practice: $("#practice"),
  summary: $("#summary"),
};
const el = {
  deckMeta: $("#deck-meta"),
  start: $("#start"),
  end: $("#end"),
  quickPicks: $("#quick-picks"),
  direction: $("#direction"),
  shuffle: $("#shuffle"),
  startBtn: $("#start-btn"),
  setupError: $("#setup-error"),

  deck: $("#deck"),
  barFill: $("#bar-fill"),
  countKnown: $("#count-known"),
  countLeft: $("#count-left"),
  undoBtn: $("#undo-btn"),
  exitBtn: $("#exit-btn"),
  btnReview: $("#btn-review"),
  btnFlip: $("#btn-flip"),
  btnKnow: $("#btn-know"),
  hint: $("#hint"),

  summarySub: $("#summary-sub"),
  sumTotal: $("#sum-total"),
  sumLoops: $("#sum-loops"),
  againBtn: $("#again-btn"),
  newBtn: $("#new-btn"),
};

// ── session state ─────────────────────────────────────────────
let totalWords = 0;
let deck = null;
let swipe = null;
let lastConfig = null;   // remember range/direction for "practice again"

// ── screen control ────────────────────────────────────────────
function show(name) {
  Object.values(screens).forEach((s) => s.classList.remove("is-active"));
  screens[name].classList.add("is-active");
}

// ════════════════════ SETUP ════════════════════
async function loadDeckInfo() {
  try {
    const info = await api.info();
    totalWords = info.total;
    el.deckMeta.textContent = `${info.total.toLocaleString()} words · ${info.key}`;
    el.end.max = totalWords;
    el.start.max = totalWords;
    if (Number(el.end.value) > totalWords) el.end.value = Math.min(20, totalWords);
  } catch (err) {
    el.deckMeta.textContent = "⚠ " + err.message;
  }
}

el.quickPicks.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.size) {
    el.start.value = 1;
    el.end.value = Math.min(Number(btn.dataset.size), totalWords || Number(btn.dataset.size));
  } else if (btn.dataset.random) {
    const size = Number(btn.dataset.random);
    const max = Math.max(1, (totalWords || size) - size + 1);
    const s = Math.floor(Math.random() * max) + 1;
    el.start.value = s;
    el.end.value = s + size - 1;
  }
});

el.direction.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  el.direction.querySelectorAll("button").forEach((b) =>
    b.setAttribute("aria-checked", String(b === btn)));
});

function readConfig() {
  const direction = el.direction.querySelector('[aria-checked="true"]').dataset.dir;
  return {
    start: Math.max(1, parseInt(el.start.value, 10) || 1),
    end: Math.max(1, parseInt(el.end.value, 10) || 1),
    direction,
    shuffle: el.shuffle.checked,
  };
}

async function startSession(cfg) {
  el.setupError.hidden = true;
  if (cfg.start > cfg.end) {
    return showSetupError("“From” row must be less than or equal to “To” row.");
  }
  el.startBtn.disabled = true;
  el.startBtn.textContent = "Loading…";
  try {
    const data = await api.cards(cfg.start, cfg.end);
    if (!data.cards.length) throw new Error("That range is empty.");
    lastConfig = cfg;
    deck = new Deck(data.cards, { direction: cfg.direction, shuffle: cfg.shuffle });
    show("practice");
    renderDeck();
  } catch (err) {
    showSetupError(err.message);
  } finally {
    el.startBtn.disabled = false;
    el.startBtn.textContent = "Start practicing";
  }
}

function showSetupError(msg) {
  el.setupError.textContent = msg;
  el.setupError.hidden = false;
}

el.startBtn.addEventListener("click", () => startSession(readConfig()));

// ════════════════════ PRACTICE ════════════════════
function cardElement(card, depth) {
  const f = deck.faces(card);
  const node = document.createElement("div");
  node.className = "card";
  node.dataset.depth = String(depth);
  node.innerHTML = `
    <span class="stamp stamp--know">KNOW</span>
    <span class="stamp stamp--review">AGAIN</span>
    <div class="card__inner">
      <div class="face face--front">
        <span class="face__tag">${f.frontTag}</span>
        <span class="face__word"></span>
        <span class="face__hint">tap to reveal</span>
      </div>
      <div class="face face--back">
        <span class="face__tag">${f.backTag}</span>
        <span class="face__word"></span>
      </div>
    </div>`;
  // textContent (not innerHTML) so any characters in the data are safe
  node.querySelector(".face--front .face__word").textContent = f.front;
  node.querySelector(".face--back .face__word").textContent = f.back;
  return node;
}

function renderDeck() {
  if (deck.isDone) return finish();

  el.deck.innerHTML = "";
  if (swipe) swipe.destroy();

  // render back-to-front so the top card is last (highest in DOM)
  const visible = deck.peek(3);
  visible.reverse().forEach((card, i) => {
    const depth = visible.length - 1 - i;
    el.deck.appendChild(cardElement(card, depth));
  });

  // wire the top card (depth 0 = last child)
  const topEl = el.deck.lastElementChild;
  swipe = new SwipeCard(topEl, {
    onDecide: (dir) => decide(dir),
    onTap: () => topEl.classList.toggle("is-flipped"),
  });

  updateHud();
}

function decide(direction) {
  if (direction === "know") deck.know();
  else deck.review();
  renderDeck();
}

function flipTop() {
  const top = el.deck.lastElementChild;
  if (top) top.classList.toggle("is-flipped");
}

function undo() {
  if (deck && deck.undo()) renderDeck();
}

function updateHud() {
  const pct = (deck.knownCount / deck.total) * 100;
  el.barFill.style.width = pct + "%";
  el.countKnown.textContent = deck.knownCount;
  el.countLeft.textContent = deck.remaining;
  el.undoBtn.disabled = !deck.canUndo;
}

// buttons
el.btnKnow.addEventListener("click", () => swipe && swipe.fling("know"));
el.btnReview.addEventListener("click", () => swipe && swipe.fling("review"));
el.btnFlip.addEventListener("click", flipTop);
el.undoBtn.addEventListener("click", undo);
el.exitBtn.addEventListener("click", () => show("setup"));

// keyboard
document.addEventListener("keydown", (e) => {
  if (!screens.practice.classList.contains("is-active")) return;
  switch (e.key) {
    case "ArrowRight": e.preventDefault(); swipe && swipe.fling("know"); break;
    case "ArrowLeft":  e.preventDefault(); swipe && swipe.fling("review"); break;
    case "ArrowUp":
    case "ArrowDown":
    case " ":          e.preventDefault(); flipTop(); break;
    case "Backspace":  e.preventDefault(); undo(); break;
  }
});

// ════════════════════ SUMMARY ════════════════════
function finish() {
  el.sumTotal.textContent = deck.total;
  el.sumLoops.textContent = deck.reviewPasses;
  el.summarySub.textContent = deck.reviewPasses === 0
    ? "Clean run — you knew every word first time."
    : `You looped back ${deck.reviewPasses} time${deck.reviewPasses === 1 ? "" : "s"} on the tricky ones.`;
  show("summary");
}

el.againBtn.addEventListener("click", () => startSession(lastConfig));
el.newBtn.addEventListener("click", () => show("setup"));

// ── go ────────────────────────────────────────────────────────
loadDeckInfo();
