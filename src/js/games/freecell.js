/* freecell.js — フリーセルのルールとゲームロジック。 */

window.Solitaire = window.Solitaire || {};
window.Solitaire.games = window.Solitaire.games || {};

(function () {
  const { makeDeck, shuffle } = Solitaire.cards;

  // フリーセル表示時にカード幅の計算で使う最大列数（フリーセル4＋組札4＝8列）
  const MAX_TOP_COLS = 8;

  // ────────── 配り ──────────
  function deal() {
    const deck = makeDeck();
    shuffle(deck);
    // すべて表向き
    deck.forEach(c => { c.faceUp = true; });

    // 8列: 先頭4列に7枚、後半4列に6枚
    const tableau = [];
    let i = 0;
    for (let col = 0; col < 8; col++) {
      const count = col < 4 ? 7 : 6;
      tableau.push(deck.slice(i, i + count));
      i += count;
    }

    return {
      freecells: [null, null, null, null],
      foundation: [[], [], [], []],
      tableau,
    };
  }

  // ────────── 深コピー ──────────
  function clone(state) {
    return {
      freecells: [...state.freecells],
      foundation: state.foundation.map(p => [...p]),
      tableau: state.tableau.map(p => [...p]),
    };
  }

  // ────────── 移動可能枚数（スーパームーブ公式） ──────────
  // (空フリーセル数+1) × 2^(空場札列数) ※移動先は除外
  function getMaxMovable(state, destPileIdx) {
    const emptyFC  = state.freecells.filter(c => c === null).length;
    const emptyCol = state.tableau.filter((p, i) => i !== destPileIdx && p.length === 0).length;
    return (emptyFC + 1) * Math.pow(2, emptyCol);
  }

  // ────────── ルール判定 ──────────
  function canMove(state, _from, cards, to) {
    const card = cards[0];

    if (to.type === 'freecell') {
      return cards.length === 1 && state.freecells[to.pileIdx] === null;
    }

    if (to.type === 'foundation') {
      if (cards.length !== 1) return false;
      const pile = state.foundation[to.pileIdx];
      if (pile.length === 0) return card.value === 1; // Aから
      const top = pile[pile.length - 1];
      return top.suit === card.suit && top.value === card.value - 1;
    }

    if (to.type === 'tableau') {
      const pile = state.tableau[to.pileIdx];
      if (pile.length > 0) {
        const top = pile[pile.length - 1];
        // 赤黒交互・1ランク下
        if (top.red === card.red || top.value !== card.value + 1) return false;
      }
      if (cards.length > 1) {
        if (cards.length > getMaxMovable(state, to.pileIdx)) return false;
      }
      return true;
    }

    return false;
  }

  // ────────── 移動適用 ──────────
  function applyMove(state, { from, cards, to }) {
    const s = clone(state);

    // 移動元から除去
    if (from.type === 'freecell') {
      s.freecells[from.pileIdx] = null;
    } else if (from.type === 'tableau') {
      s.tableau[from.pileIdx].splice(from.cardIdx);
    } else if (from.type === 'foundation') {
      s.foundation[from.pileIdx].pop();
    }

    // 移動先へ追加
    if (to.type === 'freecell') {
      s.freecells[to.pileIdx] = cards[0];
    } else if (to.type === 'foundation') {
      s.foundation[to.pileIdx].push(cards[0]);
    } else if (to.type === 'tableau') {
      s.tableau[to.pileIdx].push(...cards);
    }

    return s;
  }

  // ────────── クリア判定 ──────────
  function isWon(state) {
    return state.foundation.every(p => p.length === 13);
  }

  // ────────── ダブルタップ自動移動先 ──────────
  function autoTarget(state, card) {
    // 組札へ（優先）
    for (let i = 0; i < 4; i++) {
      if (canMove(state, null, [card], { type: 'foundation', pileIdx: i })) {
        return { type: 'foundation', pileIdx: i };
      }
    }
    // 場札へ（空でない列）
    for (let i = 0; i < 8; i++) {
      if (state.tableau[i].length > 0 &&
          canMove(state, null, [card], { type: 'tableau', pileIdx: i })) {
        return { type: 'tableau', pileIdx: i };
      }
    }
    // フリーセルへ
    for (let i = 0; i < 4; i++) {
      if (canMove(state, null, [card], { type: 'freecell', pileIdx: i })) {
        return { type: 'freecell', pileIdx: i };
      }
    }
    return null;
  }

  // ────────── ドラッグ可能カード ──────────
  function getDraggableCards(state, from, cardIdx) {
    if (from.type === 'freecell') {
      const c = state.freecells[from.pileIdx];
      return c ? [c] : [];
    }
    if (from.type === 'foundation') return [];
    if (from.type === 'tableau') {
      const pile = state.tableau[from.pileIdx];
      if (cardIdx < 0 || cardIdx >= pile.length) return [];
      const cards = pile.slice(cardIdx);
      // 赤黒交互・降順の連続確認
      for (let i = 1; i < cards.length; i++) {
        if (cards[i].red === cards[i - 1].red ||
            cards[i].value !== cards[i - 1].value - 1) {
          // 連続でない → トップ1枚のみ許可
          return cardIdx === pile.length - 1 ? [pile[pile.length - 1]] : [];
        }
      }
      return cards;
    }
    return [];
  }

  // ────────── 上段レイアウト記述子 ──────────
  function getTopRowDescriptor(state) {
    const rows = [];
    // フリーセル×4
    for (let i = 0; i < 4; i++) {
      const card = state.freecells[i];
      rows.push({ type: 'pile', key: 'freecell-' + i, card: card || null, cardIdx: 0, label: '' });
    }
    rows.push({ type: 'spacer' });
    // 組札×4
    const HINTS = ['♠', '♥', '♦', '♣'];
    for (let i = 0; i < 4; i++) {
      const pile = state.foundation[i];
      rows.push({
        type: 'pile',
        key: 'foundation-' + i,
        card: pile.length > 0 ? pile[pile.length - 1] : null,
        cardIdx: pile.length - 1,
        label: HINTS[i],
      });
    }
    return rows;
  }

  // ────────── 登録 ──────────
  Solitaire.games.freecell = {
    id: 'freecell', name: 'フリーセル', available: true,
    maxTopCols: MAX_TOP_COLS,
    deal, canMove, applyMove, isWon, autoTarget,
    getDraggableCards, getTopRowDescriptor,
  };
})();
