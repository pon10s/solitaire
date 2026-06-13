/* main.js — 起動・画面ルーティング・状態管理・タイマー・手数・クリア演出。 */

window.Solitaire = window.Solitaire || {};

(function () {
  const MENU_ORDER = [
    { id: 'klondike', label: 'クロンダイク' },
    { id: 'spider',   label: 'スパイダー' },
    { id: 'freecell', label: 'フリーセル' },
  ];

  const el = {
    menu:         document.getElementById('menu'),
    menuButtons:  document.getElementById('menu-buttons'),
    header:       document.getElementById('header'),
    board:        document.getElementById('board'),
    btnMenu:      document.getElementById('btn-menu'),
    btnNew:       document.getElementById('btn-new'),
    infoGame:     document.getElementById('info-game'),
    infoTime:     document.getElementById('info-time'),
    infoMoves:    document.getElementById('info-moves'),
    clearOverlay: document.getElementById('clear-overlay'),
  };

  let currentState = null, currentGame = null, currentOptions = {};
  let moveCount = 0, timerSec = 0, timerHandle = null, gameWon = false;

  // ────────── 画面切替 ──────────
  function showScreen(name) {
    const inGame = name === 'game';
    el.menu.hidden   = inGame;
    el.header.hidden = !inGame;
    el.board.hidden  = !inGame;
  }

  // ────────── メニュー ──────────
  function buildMenu() {
    el.menuButtons.innerHTML = '';
    for (const item of MENU_ORDER) {
      const game = Solitaire.games[item.id];
      const ready = game && game.available;
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.disabled = !ready;
      btn.textContent = item.label + (ready ? '' : '（準備中）');
      if (ready) {
        const best = loadBest(item.id);
        if (best) {
          const sub = document.createElement('small');
          sub.style.cssText = 'display:block;font-size:11px;font-weight:400;opacity:0.7;margin-top:3px;';
          sub.textContent = `ベスト: ${formatTime(best.time)} / ${best.moves}手`;
          btn.appendChild(sub);
        }
        btn.addEventListener('click', () => onMenuSelect(item.id));
      }
      el.menuButtons.appendChild(btn);
    }
  }

  function onMenuSelect(id) {
    if (id === 'spider') {
      askDifficulty(suits => startGame('spider', { suitCount: suits }));
    } else {
      startGame(id, {});
    }
  }

  // ────────── 難易度選択（スパイダー用） ──────────
  function askDifficulty(onSelect) {
    el.clearOverlay.hidden = false;
    el.clearOverlay.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'clear-box';
    const SUITS = [
      { n: 1, label: '1スート（やさしい）',   desc: 'すべて♠。練習に最適。' },
      { n: 2, label: '2スート（ふつう）',      desc: '♠と♥の2種類。' },
      { n: 4, label: '4スート（むずかしい）',  desc: '全スート。本格的。' },
    ];
    box.innerHTML = `
      <h2>スパイダー</h2>
      <p class="clear-stats">難易度を選んでね</p>
      <div class="clear-btns" style="flex-direction:column;gap:10px;">
        ${SUITS.map(s => `<button class="btn" data-n="${s.n}">${s.label}<small style="display:block;font-weight:400;font-size:12px;opacity:0.75">${s.desc}</small></button>`).join('')}
      </div>
      <br>
      <button class="btn" id="btn-diff-cancel" style="background:rgba(255,255,255,0.15);color:var(--text);">キャンセル</button>`;
    el.clearOverlay.appendChild(box);
    box.querySelectorAll('[data-n]').forEach(btn => {
      btn.addEventListener('click', () => {
        el.clearOverlay.hidden = true;
        onSelect(+btn.dataset.n);
      });
    });
    document.getElementById('btn-diff-cancel').addEventListener('click', () => {
      el.clearOverlay.hidden = true;
    });
  }

  // ────────── ゲーム開始 ──────────
  function startGame(id, options) {
    const game = Solitaire.games[id];
    if (!game || !game.available) return;
    stopTimer();
    currentGame = game;
    currentOptions = options;
    moveCount = 0; timerSec = 0; gameWon = false;
    currentState = game.deal(options);

    const label = id === 'spider' && options.suitCount
      ? `スパイダー（${options.suitCount}スート）` : game.name;
    el.infoGame.textContent = label;
    el.clearOverlay.hidden = true;
    showScreen('game');
    renderBoard();
    startTimer();
  }

  // ────────── 描画 ──────────
  function renderBoard() {
    Solitaire.ui.render(el.board, currentState, currentGame);
    updateStats();
  }

  function applyStateChange(newState, moveDelta) {
    currentState = newState;
    moveCount += moveDelta;
    renderBoard();
    if (!gameWon && currentGame.isWon(currentState)) handleWin();
  }

  // ────────── タイマー・統計 ──────────
  function startTimer() {
    timerHandle = setInterval(() => { timerSec++; updateStats(); }, 1000);
  }
  function stopTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }
  function formatTime(sec) {
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }
  function updateStats() {
    el.infoTime.textContent  = formatTime(timerSec);
    el.infoMoves.textContent = moveCount;
  }

  // ────────── ベスト記録 ──────────
  function loadBest(id) { return JSON.parse(localStorage.getItem('best_' + id) || 'null'); }
  function saveBest(id, time, moves) {
    const prev = loadBest(id);
    const isNew = !prev || time < prev.time || (time === prev.time && moves < prev.moves);
    if (isNew) localStorage.setItem('best_' + id, JSON.stringify({ time, moves }));
    return isNew;
  }

  // ────────── クリア処理 ──────────
  function handleWin() {
    gameWon = true;
    stopTimer();
    const isNew = saveBest(currentGame.id, timerSec, moveCount);
    const best  = loadBest(currentGame.id);
    celebrateClear(() => showClearDialog(timerSec, moveCount, best, isNew));
  }

  function showClearDialog(time, moves, best, isNewBest) {
    el.clearOverlay.hidden = false;
    el.clearOverlay.innerHTML = '';
    const isTrulyNew = isNewBest && best && best.time === time && best.moves === moves;
    let bestLine = '';
    if (isTrulyNew)      bestLine = '<p class="clear-best new-best">🏆 新記録！</p>';
    else if (best)       bestLine = `<p class="clear-best">ベスト: ${formatTime(best.time)} ／ ${best.moves}手</p>`;
    const box = document.createElement('div');
    box.className = 'clear-box';
    box.innerHTML = `
      <h2>🎉 クリア！</h2>
      <p class="clear-stats">${formatTime(time)} ／ ${moves}手</p>
      ${bestLine}
      <div class="clear-btns">
        <button class="btn" id="btn-again">もう一度</button>
        <button class="btn" id="btn-to-menu">メニューへ</button>
      </div>`;
    el.clearOverlay.appendChild(box);
    document.getElementById('btn-again').addEventListener('click', () => startGame(currentGame.id, currentOptions));
    document.getElementById('btn-to-menu').addEventListener('click', () => {
      el.clearOverlay.hidden = true;
      buildMenu();
      showScreen('menu');
    });
  }

  // ────────── クリア演出 ──────────
  function celebrateClear(callback) {
    const SYMS = ['♠', '♥', '♦', '♣'];
    const N = 22, W = window.innerWidth, H = window.innerHeight;
    const CW = 42, CH = 60;
    const particles = [];
    for (let i = 0; i < N; i++) {
      const sym = SYMS[i % 4], isRed = sym === '♥' || sym === '♦';
      const div = document.createElement('div');
      div.style.cssText = `position:fixed;width:${CW}px;height:${CH}px;border-radius:6px;
        background:var(--card-bg);color:${isRed ? 'var(--suit-red)' : 'var(--suit-black)'};
        display:flex;align-items:center;justify-content:center;
        font-size:24px;font-weight:800;z-index:200;pointer-events:none;
        box-shadow:0 4px 16px rgba(0,0,0,0.35);left:-100px;top:-100px;transform-origin:center;`;
      div.textContent = sym;
      document.body.appendChild(div);
      particles.push({
        el: div,
        x: W * (0.05 + 0.9 * (i / (N - 1))),
        y: H + CH,
        vx: (Math.random() - 0.5) * 10,
        vy: -(15 + Math.random() * 10),
        rot: 0, vr: (Math.random() - 0.5) * 16,
        delay: i * 90,
      });
    }
    let startTs = null;
    function tick(ts) {
      if (!startTs) startTs = ts;
      const elapsed = ts - startTs;
      let active = false;
      for (const p of particles) {
        if (elapsed < p.delay) { active = true; continue; }
        p.vy += 0.5; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (p.y > H - CH)  { p.y = H - CH;   p.vy = -Math.abs(p.vy) * 0.55; p.vx *= 0.92; p.vr *= 0.88; }
        if (p.x < 0)       { p.x = 0;         p.vx =  Math.abs(p.vx) * 0.8; }
        if (p.x > W - CW)  { p.x = W - CW;    p.vx = -Math.abs(p.vx) * 0.8; }
        p.el.style.left = p.x + 'px'; p.el.style.top = p.y + 'px';
        p.el.style.transform = `rotate(${p.rot}deg)`;
        if (p.y < H - CH + 2 || Math.abs(p.vy) > 0.8) active = true;
      }
      if (active && elapsed < 3800) requestAnimationFrame(tick);
      else { particles.forEach(p => p.el.remove()); callback && callback(); }
    }
    requestAnimationFrame(tick);
  }

  // ────────── ボタン ──────────
  el.btnMenu.addEventListener('click', () => { stopTimer(); showScreen('menu'); });
  el.btnNew.addEventListener('click',  () => {
    if (currentGame) {
      if (currentGame.id === 'spider') askDifficulty(s => startGame('spider', { suitCount: s }));
      else startGame(currentGame.id, currentOptions);
    }
  });

  // ────────── dragdrop 初期化・起動 ──────────
  Solitaire.dragdrop.init(el.board, () => currentState, applyStateChange, () => currentGame);
  buildMenu();
  showScreen('menu');
})();
