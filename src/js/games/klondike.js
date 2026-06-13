/* klondike.js — クロンダイクのルール。共通インターフェースを実装し Solitaire.games に登録する。 */

window.Solitaire = window.Solitaire || {};
Solitaire.games = Solitaire.games || {};

(function () {
  function deal() {
    const deck = Solitaire.cards.makeDeck();
    Solitaire.cards.shuffle(deck);
    const d = deck.map(c => ({ ...c, faceUp: false }));
    const tableau = [];
    let i = 0;
    for (let col = 0; col < 7; col++) {
      const pile = [];
      for (let row = 0; row <= col; row++) pile.push({ ...d[i++] });
      pile[pile.length - 1].faceUp = true;
      tableau.push(pile);
    }
    const stock = d.slice(i).map(c => ({ ...c, faceUp: false }));
    return { stock, waste: [], foundation: [[], [], [], []], tableau };
  }

  function canMove(state, from, cards, to) {
    const card = cards[0];
    if (to.type === 'foundation') {
      if (cards.length !== 1) return false;
      const pile = state.foundation[to.pileIdx];
      if (pile.length === 0) return card.value === 1;
      const top = pile[pile.length - 1];
      return top.suit === card.suit && top.value === card.value - 1;
    }
    if (to.type === 'tableau') {
      const pile = state.tableau[to.pileIdx];
      if (pile.length === 0) return card.value === 13;
      const top = pile[pile.length - 1];
      return top.faceUp && top.red !== card.red && top.value === card.value + 1;
    }
    return false;
  }

  function applyMove(state, { from, cards, to }) {
    const s = {
      stock: [...state.stock],
      waste: [...state.waste],
      foundation: state.foundation.map(p => [...p]),
      tableau: state.tableau.map(p => [...p]),
    };
    if (from.type === 'waste') {
      s.waste.pop();
    } else if (from.type === 'tableau') {
      s.tableau[from.pileIdx].splice(from.cardIdx);
      const pile = s.tableau[from.pileIdx];
      if (pile.length > 0 && !pile[pile.length - 1].faceUp)
        pile[pile.length - 1] = { ...pile[pile.length - 1], faceUp: true };
    } else if (from.type === 'foundation') {
      s.foundation[from.pileIdx].pop();
    }
    if (to.type === 'foundation') s.foundation[to.pileIdx].push(...cards);
    else if (to.type === 'tableau')  s.tableau[to.pileIdx].push(...cards);
    return s;
  }

  function drawStock(state) {
    if (state.stock.length === 0) {
      if (state.waste.length === 0) return state;
      return {
        ...state,
        stock: [...state.waste].reverse().map(c => ({ ...c, faceUp: false })),
        waste: [],
      };
    }
    const card = { ...state.stock[state.stock.length - 1], faceUp: true };
    return { ...state, stock: state.stock.slice(0, -1), waste: [...state.waste, card] };
  }

  function isWon(state) { return state.foundation.every(p => p.length === 13); }

  function autoTarget(state, card) {
    for (let i = 0; i < 4; i++)
      if (canMove(state, {}, [card], { type: 'foundation', pileIdx: i })) return { type: 'foundation', pileIdx: i };
    for (let i = 0; i < 7; i++)
      if (canMove(state, {}, [card], { type: 'tableau', pileIdx: i })) return { type: 'tableau', pileIdx: i };
    return null;
  }

  // ui.js が盤面上部を描画するためのディスクリプタ
  function getTopRowDescriptor(state) {
    const stockCard = state.stock.length > 0 ? { faceUp: false } : null;
    const wasteTop  = state.waste.length > 0 ? state.waste[state.waste.length - 1] : null;
    const items = [
      { type: 'pile', key: 'stock', card: stockCard, cardIdx: 0, label: '↺' },
      { type: 'pile', key: 'waste', card: wasteTop,  cardIdx: state.waste.length - 1, label: '' },
      { type: 'spacer' },
    ];
    const HINTS = ['♠', '♥', '♦', '♣'];
    for (let i = 0; i < 4; i++) {
      const pile = state.foundation[i];
      items.push({
        type: 'pile', key: 'foundation-' + i,
        card: pile.length > 0 ? pile[pile.length - 1] : null,
        cardIdx: pile.length - 1,
        label: HINTS[i],
      });
    }
    return items;
  }

  // dragdrop.js がドラッグできるカード群を取得するために使う
  function getDraggableCards(state, from, cardIdx) {
    if (from.type === 'waste') {
      const top = state.waste[state.waste.length - 1];
      return top ? [top] : [];
    }
    if (from.type === 'foundation') {
      const pile = state.foundation[from.pileIdx];
      return pile.length > 0 ? [pile[pile.length - 1]] : [];
    }
    if (from.type === 'tableau') {
      const cards = state.tableau[from.pileIdx].slice(cardIdx);
      return cards.some(c => !c.faceUp) ? [] : cards;
    }
    return [];
  }

  Solitaire.games.klondike = {
    id: 'klondike', name: 'クロンダイク', available: true,
    deal, canMove, applyMove, drawStock, isWon, autoTarget,
    getTopRowDescriptor, getDraggableCards,
  };
})();
