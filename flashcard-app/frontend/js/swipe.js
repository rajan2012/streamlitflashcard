// swipe.js — turns the top card into a draggable, throwable Tinder-style card.
//
// Reports decisions via callbacks; also exposes fling() so the on-screen
// buttons and keyboard shortcuts can trigger the same animation.

const THRESHOLD = 95;        // px of horizontal travel to count as a decision
const TAP_SLOP = 8;          // px of movement still considered a tap (flip)
const ROTATE = 0.06;         // deg per px dragged

export class SwipeCard {
  /**
   * @param {HTMLElement} el  the top .card element
   * @param {{onDecide:(dir:'know'|'review')=>void, onTap:()=>void}} cb
   */
  constructor(el, cb) {
    this.el = el;
    this.cb = cb;
    this.stampKnow = el.querySelector(".stamp--know");
    this.stampReview = el.querySelector(".stamp--review");

    this.startX = 0;
    this.startY = 0;
    this.dx = 0;
    this.dy = 0;
    this.dragging = false;
    this.locked = false;     // true while a fling animation is running

    this._down = this._down.bind(this);
    this._move = this._move.bind(this);
    this._up = this._up.bind(this);

    el.addEventListener("pointerdown", this._down);
  }

  _down(e) {
    if (this.locked) return;
    this.dragging = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.el.classList.add("is-dragging");
    this.el.setPointerCapture(e.pointerId);
    window.addEventListener("pointermove", this._move);
    window.addEventListener("pointerup", this._up);
  }

  _move(e) {
    if (!this.dragging) return;
    this.dx = e.clientX - this.startX;
    this.dy = e.clientY - this.startY;
    this._render(this.dx, this.dy, this.dx * ROTATE);

    const progress = Math.min(1, Math.abs(this.dx) / THRESHOLD);
    this.stampKnow.style.opacity = this.dx > 0 ? progress : 0;
    this.stampReview.style.opacity = this.dx < 0 ? progress : 0;
  }

  _up() {
    if (!this.dragging) return;
    this.dragging = false;
    this.el.classList.remove("is-dragging");
    window.removeEventListener("pointermove", this._move);
    window.removeEventListener("pointerup", this._up);

    const movedFar = Math.abs(this.dx) > THRESHOLD;
    const wasTap = Math.abs(this.dx) < TAP_SLOP && Math.abs(this.dy) < TAP_SLOP;

    if (movedFar) {
      this.fling(this.dx > 0 ? "know" : "review");
    } else if (wasTap) {
      this._reset();
      this.cb.onTap();
    } else {
      this._reset();
    }
  }

  /** Animate the card off-screen, then report the decision. */
  fling(direction) {
    if (this.locked) return;
    this.locked = true;
    const offX = direction === "know" ? window.innerWidth : -window.innerWidth;
    this.el.style.transition = "transform 0.42s cubic-bezier(.4,.1,.4,1), opacity 0.42s";
    this.el.style.transform = `translate(${offX * 1.2}px, ${this.dy}px) rotate(${offX * ROTATE}deg)`;
    this.el.style.opacity = "0";
    (direction === "know" ? this.stampKnow : this.stampReview).style.opacity = "1";

    const done = () => {
      this.el.removeEventListener("transitionend", done);
      this.cb.onDecide(direction);
    };
    this.el.addEventListener("transitionend", done);
  }

  _render(x, y, rot) {
    this.el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
  }

  _reset() {
    this.el.style.transition = "transform 0.32s cubic-bezier(.3,1.3,.5,1)";
    this.el.style.transform = "";
    this.stampKnow.style.opacity = 0;
    this.stampReview.style.opacity = 0;
    this.dx = this.dy = 0;
  }

  destroy() {
    this.el.removeEventListener("pointerdown", this._down);
    window.removeEventListener("pointermove", this._move);
    window.removeEventListener("pointerup", this._up);
  }
}
