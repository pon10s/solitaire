/* cards.js — カード/デッキのデータモデル。最初に読み込まれ、共通名前空間を用意する。 */

// 共通名前空間（ES modules を使わず file:// でも動くようにグローバルに置く）
window.Solitaire = window.Solitaire || {};
Solitaire.games = Solitaire.games || {}; // 各ゲームがここに自分を登録する

(function () {
  const SUITS = ['spade', 'heart', 'diamond', 'club'];
  const SUIT_SYMBOL = { spade: '♠', heart: '♥', diamond: '♦', club: '♣' };
  const RED_SUITS = ['heart', 'diamond'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  // カード: { suit, rank, value(1-13), red(bool), faceUp(bool), id }
  function makeCard(suit, rank, value) {
    return {
      suit,
      rank,
      value,
      red: RED_SUITS.includes(suit),
      faceUp: false,
      id: suit + '-' + rank,
    };
  }

  // 標準52枚デッキ（decks枚数ぶん）を生成
  function makeDeck(decks = 1) {
    const cards = [];
    for (let d = 0; d < decks; d++) {
      for (const suit of SUITS) {
        RANKS.forEach((rank, i) => cards.push(makeCard(suit, rank, i + 1)));
      }
    }
    return cards;
  }

  // Fisher–Yates シャッフル（破壊的）
  function shuffle(cards) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  Solitaire.cards = { SUITS, SUIT_SYMBOL, RED_SUITS, RANKS, makeCard, makeDeck, shuffle };
})();
