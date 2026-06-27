// deck.js — owns all session state and the "left-swipe comes back" logic.
//
// A card leaves the deck only when you swipe RIGHT (you know it).
// Swiping LEFT sends it to the back of the queue, so it loops around
// until it's known. Undo reverses your last swipe.

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class Deck {
  /**
   * @param {{german:string, english:string}[]} cards
   * @param {{direction:'de-en'|'en-de', shuffle:boolean}} opts
   */
  constructor(cards, opts) {
    this.direction = opts.direction;
    this.total = cards.length;

    // give every card a stable id, and pick its front/back per direction
    const prepared = cards.map((c, i) => ({
      id: i,
      german: c.german,
      english: c.english,
    }));
    if (opts.shuffle) shuffleInPlace(prepared);

    this.queue = prepared;          // cards still to be learned (front of array = top)
    this.known = new Set();         // ids the user got right
    this.history = [];              // [{ action:'know'|'review', card }]
    this.reviewPasses = 0;          // how many times any card looped back
  }

  get top() {
    return this.queue[0] || null;
  }

  /** up to `n` cards from the top, for rendering the stack */
  peek(n = 3) {
    return this.queue.slice(0, n);
  }

  get remaining() {
    return this.queue.length;
  }

  get knownCount() {
    return this.known.size;
  }

  get isDone() {
    return this.queue.length === 0;
  }

  /** front / back text for a card, respecting the chosen direction */
  faces(card) {
    return this.direction === "de-en"
      ? { front: card.german, back: card.english, frontTag: "Deutsch", backTag: "English" }
      : { front: card.english, back: card.german, frontTag: "English", backTag: "Deutsch" };
  }

  /** Swipe right: learned it. */
  know() {
    const card = this.queue.shift();
    if (!card) return;
    this.known.add(card.id);
    this.history.push({ action: "know", card });
  }

  /** Swipe left: send to the back so it returns later. */
  review() {
    const card = this.queue.shift();
    if (!card) return;
    this.queue.push(card);
    this.reviewPasses++;
    this.history.push({ action: "review", card });
  }

  /** Undo the most recent swipe. Returns true if something was undone. */
  undo() {
    const last = this.history.pop();
    if (!last) return false;
    if (last.action === "know") {
      this.known.delete(last.card.id);
      this.queue.unshift(last.card);
    } else {
      // it was moved to the back — pull it off the back, put it on top
      const idx = this.queue.lastIndexOf(last.card);
      if (idx !== -1) this.queue.splice(idx, 1);
      this.queue.unshift(last.card);
      this.reviewPasses = Math.max(0, this.reviewPasses - 1);
    }
    return true;
  }

  get canUndo() {
    return this.history.length > 0;
  }
}
