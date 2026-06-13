/* spider.js — スパイダーのルール。Solitaire.games に登録する。 */

window.Solitaire = window.Solitaire || {};
Solitaire.games = Solitaire.games || {};

(function () {
  const { makeCard, RANKS, shuffle } = Solitaire.cards;

  // suitCount: 1（やさしい）/ 2（ふつう）/ 4（むずかしい）
  // state = { stock, tableau(10列), completed(0-8), suitCount }
  function makeDeck(suitCount) {
    const suits = ['spade', 'heart', 'diamond', 'club'].slice(0, suitCount);
    const setsPerSuit = 8 / suitCount; // 1suit→8sets, 2suit→4sets, 4suit→2sets
    const cards = [];
    let serial = 0;
    for (const suit of suits) {
      for (let s = 0; s < setsPerSuit; s++) {
        RANKS.forEach((rank, i) => {
          const c = makeCard(suit, rank, i + 1);
          c.id = c.id + '-' + serial++;  // 重複IDを防ぐ
          cards.push(c);
        });
      }
    }
    return cards;
  }

  function deal(options = {}) {
    const suitCount = options.suitCount || 1;
    const deck = makeDeck(suitCount);
    shuffle(deck);
    const d = deck.map(c => ({ ...c, faceUp: false }));
    const tableau = [];
    let i = 0;
    // 10列: 最初の4列は6枚、残り6列は5枚（計54枚）
    for (let col = 0; col < 10; col++) {
      const count = col < 4 ? 6 : 5;
      const pile = [];
      for (let j = 0; j < count; j++) pile.push({ ...d[i++] });
      pile[pile.length - 1].faceUp = true;
      tableau.push(pile);
    }
    // 残り50枚が山札（5ラウンド分）
    const stock = d.slice(i);
    return { stock, tableau, completed: 0, suitCount };
  }

  // ── ルール ──────────────────────────────────────

  // 移動できるかどうか
  // スパイダー: 置き先は1ランク上ならスート問わず。空列は何でも置ける。
  function canMove(state, from, cards, to) {
    if (to.type !== 'tableau') return false;
    if (from.type === to.type && from.pileIdx === to.pileIdx) return false;
    const card = cards[0];
    const toPile = state.tableau[to.pileIdx];
    if (toPile.length === 0) return true;
    const top = toPile[toPile.length - 1];
    return top.faceUp && top.value === card.value + 1;
  }

  // 移動を適用し、完成セット（K→A同スート）を自動除去
  function applyMove(state, { from, cards, to }) {
    const s = {
      stock: [...state.stock],
      tableau: state.tableau.map(p => [...p]),
      completed: state.completed,
      suitCount: state.suitCount,
    };
    s.tableau[from.pileIdx].splice(from.cardIdx);
    flipTop(s.tableau[from.pileIdx]);
    s.tableau[to.pileIdx].push(...cards);
    return removeCompleted(s);
  }

  // 山札から各列に1枚ずつ配る（10枚）
  function drawStock(state) {
    if (state.stock.length === 0) return state;
    const s = {
      ...state,
      stock: [...state.stock],
      tableau: state.tableau.map(p => [...p]),
    };
    const toDeal = Math.min(10, s.stock.length);
    for (let col = 0; col < toDeal; col++) {
      s.tableau[col].push({ ...s.stock.pop(), faceUp: true });
    }
    return removeCompleted(s);
  }

  function isWon(state) { return state.completed === 8; }

  function autoTarget(state, card) {
    // 同スートかつランクが合う列を優先
    for (let i = 0; i < 10; i++) {
      const pile = state.tableau[i];
      if (pile.length === 0) continue;
      const top = pile[pile.length - 1];
      if (top.faceUp && top.suit === card.suit && top.value === card.value + 1)
        return { type: 'tableau', pileIdx: i };
    }
    // 次点: ランクが合う列（スート問わず）
    for (let i = 0; i < 10; i++) {
      if (canMove(state, {}, [card], { type: 'tableau', pileIdx: i }))
        return { type: 'tableau', pileIdx: i };
    }
    return null;
  }

  // ui.js 用: 盤面上部のディスクリプタ
  function getTopRowDescriptor(state) {
    const stockCard = state.stock.length > 0 ? { faceUp: false } : null;
    const deals = Math.floor(state.stock.length / 10);
    return [
      { type: 'pile', key: 'stock', card: stockCard, cardIdx: 0, label: deals > 0 ? `×${deals}` : '✓' },
      { type: 'spacer' },
      { type: 'info', key: 'completed', text: `${state.completed}/8` },
    ];
  }

  // dragdrop.js 用: ドラッグ可能なカード群を返す
  // スパイダーは「同スート連続」のみ複数枚移動可。混合列はトップ1枚のみ。
  function getDraggableCards(state, from, cardIdx) {
    if (from.type !== 'tableau') return [];
    const pile = state.tableau[from.pileIdx];
    if (cardIdx < 0 || cardIdx >= pile.length) return [];
    const cards = pile.slice(cardIdx);
    if (cards.some(c => !c.faceUp)) return [];
    if (cards.length === 1) return cards;
    // 同スート・連続降順か検証
    for (let i = 1; i < cards.length; i++) {
      if (cards[i].suit !== cards[0].suit || cards[i].value !== cards[i - 1].value - 1) {
        // 混合列：クリックがトップカードならそれだけ返す
        return cardIdx === pile.length - 1 ? [pile[pile.length - 1]] : [];
      }
    }
    return cards;
  }

  // ── 内部ユーティリティ ────────────────────────────

  function flipTop(pile) {
    if (pile.length > 0 && !pile[pile.length - 1].faceUp)
      pile[pile.length - 1] = { ...pile[pile.length - 1], faceUp: true };
  }

  // 各列のトップ13枚が完成セット（K→A同スート）なら除去して completed++
  function removeCompleted(state) {
    let added = 0;
    const newTab = state.tableau.map(pile => {
      if (pile.length < 13) return pile;
      const top13 = pile.slice(-13);
      if (isCompleteSet(top13)) {
        added++;
        const newPile = pile.slice(0, -13);
        flipTop(newPile);
        return newPile;
      }
      return pile;
    });
    return { ...state, tableau: newTab, completed: state.completed + added };
  }

  function isCompleteSet(cards) {
    // cards[0] = K (value=13), cards[12] = A (value=1), 全て同スート
    if (cards[0].value !== 13) return false;
    const suit = cards[0].suit;
    for (let i = 0; i < 13; i++) {
      if (cards[i].suit !== suit || cards[i].value !== 13 - i) return false;
    }
    return true;
  }

  Solitaire.games.spider = {
    id: 'spider', name: 'スパイダー', available: true,
    deal, canMove, applyMove, drawStock, isWon, autoTarget,
    getTopRowDescriptor, getDraggableCards,
  };
})();
