/* dragdrop.js — Pointer Eventベースのドラッグ＆ドロップ（マウス・タッチ統一）。
   当たり判定: ゴーストと対象パイルのオーバーラップ面積で判断（緩め）。 */

window.Solitaire = window.Solitaire || {};

(function () {
  let boardEl = null, getState = null, applyStateChange = null, getGame = null;
  let drag = null;

  function parsePile(pileKey) {
    if (!pileKey) return null;
    if (pileKey === 'stock')  return { type: 'stock' };
    if (pileKey === 'waste')  return { type: 'waste' };
    if (pileKey.startsWith('freecell-'))   return { type: 'freecell',   pileIdx: +pileKey.split('-')[1] };
    if (pileKey.startsWith('foundation-')) return { type: 'foundation', pileIdx: +pileKey.split('-')[1] };
    if (pileKey.startsWith('tableau-'))    return { type: 'tableau',    pileIdx: +pileKey.split('-')[1] };
    return null;
  }

  function resolveCards(game, state, from, cardIdx) {
    if (game.getDraggableCards) return game.getDraggableCards(state, from, cardIdx);
    if (from.type === 'tableau') {
      const cards = state.tableau[from.pileIdx].slice(cardIdx);
      return cards.some(c => !c.faceUp) ? [] : cards;
    }
    if (from.type === 'waste') {
      const top = state.waste[state.waste.length - 1];
      return top ? [top] : [];
    }
    if (from.type === 'foundation') {
      const pile = state.foundation[from.pileIdx];
      return pile.length > 0 ? [pile[pile.length - 1]] : [];
    }
    return [];
  }

  // ────────── オーバーラップ面積 ──────────
  function overlapArea(ax, ay, aw, ah, b) {
    const ox = Math.max(0, Math.min(ax + aw, b.right)  - Math.max(ax, b.left));
    const oy = Math.max(0, Math.min(ay + ah, b.bottom) - Math.max(ay, b.top));
    return ox * oy;
  }

  // ────────── ドロップターゲット（ゴーストとのオーバーラップ最大パイルを返す） ──────────
  function findDropTarget() {
    if (!drag) return null;
    const { w, h } = Solitaire.ui.getCardSize();
    const gx = parseFloat(drag.ghost.style.left);
    const gy = parseFloat(drag.ghost.style.top);
    const minArea = w * h * 0.08; // 8% 以上オーバーラップで有効

    // ゴーストを一時非表示してヒットテスト
    drag.ghost.style.visibility = 'hidden';
    const piles = boardEl.querySelectorAll('.pile[data-pile]:not(.info-tile)');
    let bestPile = null, bestArea = 0;

    for (const pile of piles) {
      // 場札列はトップカードの位置を基準にする
      const isTablCol = pile.classList.contains('tableau-col');
      const refEl = isTablCol
        ? (pile.querySelector('.card:last-child') || pile)
        : pile;
      const r = refEl.getBoundingClientRect();
      const area = overlapArea(gx, gy, w, h, r);
      if (area > bestArea) { bestArea = area; bestPile = pile; }
    }
    drag.ghost.style.visibility = '';
    return bestArea >= minArea ? bestPile : null;
  }

  // ────────── pointerdown ──────────
  function onPointerDown(e) {
    const cardEl = e.target.closest('.card');
    if (!cardEl) return;
    const pileKey = cardEl.dataset.pile;
    const cardIdx = parseInt(cardEl.dataset.cardIdx);
    const from    = parsePile(pileKey);
    if (!from) return;

    // 山札クリック → めくり
    if (from.type === 'stock') {
      applyStateChange(getGame().drawStock(getState()), 0);
      return;
    }

    if (cardEl.classList.contains('slot') || cardEl.classList.contains('back')) return;

    const cards = resolveCards(getGame(), getState(), from, cardIdx);
    if (!cards || cards.length === 0) return;

    const rect  = cardEl.getBoundingClientRect();
    const ghost = Solitaire.ui.makeGhostEl(cards);
    ghost.style.left = rect.left + 'px';
    ghost.style.top  = rect.top  + 'px';
    document.body.appendChild(ghost);

    drag = {
      from: { ...from, cardIdx },
      cards, ghost,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
      lastHighlight: null,
      draggingEls: [],
    };

    // 元カードを半透明化
    const srcKey = from.type === 'freecell'   ? `freecell-${from.pileIdx}`
                 : from.type === 'waste'       ? 'waste'
                 : from.type === 'foundation'  ? `foundation-${from.pileIdx}`
                 : `tableau-${from.pileIdx}`;
    for (let i = 0; i < cards.length; i++) {
      const el = document.querySelector(`[data-pile="${srcKey}"][data-card-idx="${cardIdx + i}"]`);
      if (el) { el.classList.add('dragging'); drag.draggingEls.push(el); }
    }

    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup',   onPointerUp);
    e.preventDefault();
  }

  // ────────── pointermove ──────────
  function onPointerMove(e) {
    if (!drag) return;
    e.preventDefault();
    drag.ghost.style.left = (e.clientX - drag.offsetX) + 'px';
    drag.ghost.style.top  = (e.clientY - drag.offsetY) + 'px';
    drag.moved = true;

    const target = findDropTarget();
    if (drag.lastHighlight && drag.lastHighlight !== target)
      drag.lastHighlight.classList.remove('drop-highlight');
    if (target) {
      const to = parsePile(target.dataset.pile);
      if (to && getGame().canMove(getState(), drag.from, drag.cards, to)) {
        target.classList.add('drop-highlight');
        drag.lastHighlight = target;
      } else {
        if (drag.lastHighlight === target) {
          target.classList.remove('drop-highlight');
          drag.lastHighlight = null;
        }
      }
    } else {
      drag.lastHighlight = null;
    }
  }

  // ────────── pointerup ──────────
  function onPointerUp(e) {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup',   onPointerUp);
    if (!drag) return;
    if (drag.lastHighlight) drag.lastHighlight.classList.remove('drop-highlight');

    if (drag.moved) {
      const target = findDropTarget();
      if (target) {
        const to = parsePile(target.dataset.pile);
        if (to && getGame().canMove(getState(), drag.from, drag.cards, to)) {
          const newState = getGame().applyMove(getState(), { from: drag.from, cards: drag.cards, to });
          applyStateChange(newState, 1);
        }
      }
    }
    cleanupDrag();
  }

  function cleanupDrag() {
    if (drag) {
      drag.ghost.remove();
      drag.draggingEls.forEach(el => el.classList.remove('dragging'));
    }
    drag = null;
  }

  // ────────── ダブルタップ → 自動移動 ──────────
  let lastTapTime = 0, lastTapEl = null;

  function onPointerDownForDoubleTap(e) {
    const cardEl = e.target.closest('.card');
    if (!cardEl || cardEl.classList.contains('slot') || cardEl.classList.contains('back')) return;
    const now = Date.now();
    if (lastTapEl === cardEl && now - lastTapTime < 400) {
      lastTapEl = null;
      const from    = parsePile(cardEl.dataset.pile);
      const cardIdx = parseInt(cardEl.dataset.cardIdx);
      if (!from || from.type === 'stock') return;
      const cards = resolveCards(getGame(), getState(), from, cardIdx);
      if (!cards || cards.length !== 1) return;
      const to = getGame().autoTarget(getState(), cards[0]);
      if (to) {
        const newState = getGame().applyMove(getState(), { from: { ...from, cardIdx }, cards, to });
        applyStateChange(newState, 1);
      }
    } else {
      lastTapTime = now;
      lastTapEl   = cardEl;
    }
  }

  function init(board, getStateFn, applyFn, getGameFn) {
    boardEl = board;
    getState = getStateFn;
    applyStateChange = applyFn;
    getGame = getGameFn;
    boardEl.addEventListener('pointerdown', onPointerDown);
    boardEl.addEventListener('pointerdown', onPointerDownForDoubleTap);
  }

  Solitaire.dragdrop = { init };
})();
