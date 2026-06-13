/* ui.js — 盤面の描画（状態から毎回フルリビルド）。ゲーム種別を問わず汎用。 */

window.Solitaire = window.Solitaire || {};

(function () {
  const SUIT_SYM = { spade: '♠', heart: '♥', diamond: '♦', club: '♣' };

  let CARD_W = 52, CARD_H = 75, FD_PEEK = 13, FU_PEEK = 22;

  function calcSizes(cols, game) {
    const vw = window.innerWidth;
    const gap = 4, boardPad = 12;
    const topCols = (game && game.maxTopCols) || 0;
    const effectiveCols = Math.max(cols, topCols);
    CARD_W = Math.max(30, Math.min(80,
      Math.floor((vw - boardPad - (effectiveCols - 1) * gap) / effectiveCols)));
    CARD_H = Math.round(CARD_W * 1.45);
    FD_PEEK = Math.max(8,  Math.round(CARD_H * 0.17));
    FU_PEEK = Math.max(16, Math.round(CARD_H * 0.30));
  }

  function makeCardEl(card, pileKey, cardIdx) {
    const el = document.createElement('div');
    if (card._slot) {
      el.className = 'card slot';
      el.dataset.pile = pileKey;
      el.dataset.cardIdx = -1;
      if (card._label) el.textContent = card._label;
      return el;
    }
    const faceClass = card.faceUp ? ('face-up ' + (card.red ? 'red' : 'black')) : 'back';
    el.className = 'card ' + faceClass;
    el.dataset.pile = pileKey;
    el.dataset.cardIdx = cardIdx;
    if (card.faceUp) {
      const sym = SUIT_SYM[card.suit];
      const tl = document.createElement('span');
      tl.className = 'card-label tl';
      tl.textContent = card.rank + sym;
      const br = document.createElement('span');
      br.className = 'card-label br';
      br.textContent = card.rank + sym;
      const center = document.createElement('span');
      center.className = 'card-center';
      center.textContent = sym;
      el.appendChild(tl);
      el.appendChild(center);
      el.appendChild(br);
    }
    return el;
  }

  function makePileEl(pileKey) {
    const el = document.createElement('div');
    el.className = 'pile';
    el.dataset.pile = pileKey;
    return el;
  }

  // ── 盤面フルリビルド ──────────────────────────────

  function render(boardEl, state, game) {
    calcSizes(state.tableau.length, game);
    boardEl.style.setProperty('--cw', CARD_W + 'px');
    boardEl.style.setProperty('--ch', CARD_H + 'px');
    boardEl.innerHTML = '';

    // 上段: ゲームが提供するディスクリプタから構築
    const topRow = document.createElement('div');
    topRow.className = 'top-row';
    for (const item of game.getTopRowDescriptor(state)) {
      if (item.type === 'spacer') {
        const sp = document.createElement('div');
        sp.className = 'spacer';
        topRow.appendChild(sp);
      } else if (item.type === 'pile') {
        const pileEl = makePileEl(item.key);
        if (item.card) {
          pileEl.appendChild(makeCardEl(item.card, item.key, item.cardIdx ?? 0));
        } else {
          pileEl.appendChild(makeCardEl({ _slot: true, _label: item.label ?? '' }, item.key, -1));
        }
        topRow.appendChild(pileEl);
      } else if (item.type === 'info') {
        const info = document.createElement('div');
        info.className = 'pile info-tile';
        info.dataset.pile = item.key || 'info';
        info.textContent = item.text;
        topRow.appendChild(info);
      }
    }
    boardEl.appendChild(topRow);

    // 下段: 場札（列数は state.tableau.length で自動対応）
    const tabRow = document.createElement('div');
    tabRow.className = 'tableau-row';
    for (let col = 0; col < state.tableau.length; col++) {
      const pile = state.tableau[col];
      const colEl = makePileEl('tableau-' + col);
      colEl.classList.add('tableau-col');
      if (pile.length === 0) {
        colEl.appendChild(makeCardEl({ _slot: true }, 'tableau-' + col, -1));
      } else {
        pile.forEach((card, idx) => {
          const cardEl = makeCardEl(card, 'tableau-' + col, idx);
          if (idx > 0) {
            const prevFaceUp = pile[idx - 1].faceUp;
            cardEl.style.marginTop = -(CARD_H - (prevFaceUp ? FU_PEEK : FD_PEEK)) + 'px';
          }
          colEl.appendChild(cardEl);
        });
      }
      tabRow.appendChild(colEl);
    }
    boardEl.appendChild(tabRow);
  }

  // ドラッグゴースト用
  function makeGhostEl(cards) {
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.setProperty('--cw', CARD_W + 'px');
    ghost.style.setProperty('--ch', CARD_H + 'px');
    cards.forEach((card, idx) => {
      const el = makeCardEl(card, '', idx);
      if (idx > 0) el.style.marginTop = -(CARD_H - FU_PEEK) + 'px';
      ghost.appendChild(el);
    });
    return ghost;
  }

  function getCardSize() { return { w: CARD_W, h: CARD_H }; }

  Solitaire.ui = { render, makeGhostEl, getCardSize };
})();
