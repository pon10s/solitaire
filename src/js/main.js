/* main.js — 起動・画面ルーティング・状態管理・タイマー・手数・クリア演出。 */

window.Solitaire = window.Solitaire || {};

(function () {
  const MENU_ORDER = [
    { id: 'klondike', label: 'クロンダイク' },
    { id: 'spider',   label: 'スパイダー' },
    { id: 'freecell', label: 'フリーセル' },
  ];
  const MAX_HISTORY = 30;

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

  // ────────── ゲームキー（履歴・スパイダー難易度を含む） ──────────
  function gameHistKey(id, opts) {
    if (id === 'spider') return 'history_spider_' + ((opts && opts.suitCount) || 1);
    return 'history_' + id;
  }
  function currentHistKey() { return gameHistKey(currentGame.id, currentOptions); }

  // ────────── メニュー ──────────
  function buildMenu() {
    el.menuButtons.innerHTML = '';
    for (const item of MENU_ORDER) {
      const game = Solitaire.games[item.id];
      const ready = game && game.available;

      const row = document.createElement('div');
      row.className = 'game-row';

      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.disabled = !ready;
      btn.textContent = item.label + (ready ? '' : '（準備中）');

      if (ready) {
        const best = loadBest(item.id);
        if (best) {
          const sub = document.createElement('small');
          sub.style.cssText = 'display:block;font-size:12px;font-weight:400;opacity:0.7;margin-top:4px;';
          sub.textContent = `ベスト: ${formatTime(best.time)} / ${best.moves}手`;
          btn.appendChild(sub);
        }
        btn.addEventListener('click', () => onMenuSelect(item.id));

        const histBtn = document.createElement('button');
        histBtn.className = 'btn btn-hist';
        histBtn.textContent = '📊';
        histBtn.title = '記録を見る';
        histBtn.addEventListener('click', () => showHistory(item.id));
        row.appendChild(btn);
        row.appendChild(histBtn);
      } else {
        row.appendChild(btn);
      }
      el.menuButtons.appendChild(row);
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
    showOverlay(`
      <h2>スパイダー</h2>
      <p class="clear-stats">難易度を選んでね</p>
      <div class="clear-btns" style="flex-direction:column;gap:10px;">
        <button class="btn" data-n="1">1スート（やさしい）<small style="display:block;font-weight:400;font-size:13px;opacity:0.75">すべて♠。練習に最適。</small></button>
        <button class="btn" data-n="2">2スート（ふつう）<small style="display:block;font-weight:400;font-size:13px;opacity:0.75">♠と♥の2種類。</small></button>
        <button class="btn" data-n="4">4スート（むずかしい）<small style="display:block;font-weight:400;font-size:13px;opacity:0.75">全スート。本格的。</small></button>
      </div>
      <br>
      <button class="btn" id="btn-diff-cancel" style="background:rgba(0,0,0,0.12);color:#555;">キャンセル</button>
    `);
    el.clearOverlay.querySelector('[data-n]') &&
    el.clearOverlay.querySelectorAll('[data-n]').forEach(btn => {
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

  // ────────── タイマー ──────────
  function startTimer() {
    if (timerHandle) return;
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

  // ────────── プレイ履歴 ──────────
  function loadHistory(key) {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  function appendHistory(key, entry) {
    const list = loadHistory(key);
    list.unshift(entry);
    if (list.length > MAX_HISTORY) list.length = MAX_HISTORY;
    localStorage.setItem(key, JSON.stringify(list));
  }

  function showHistory(gameId) {
    const game = Solitaire.games[gameId];
    if (!game) return;

    // スパイダーは3難易度まとめて表示
    const sections = gameId === 'spider'
      ? [
          { key: 'history_spider_1', title: '1スート（やさしい）' },
          { key: 'history_spider_2', title: '2スート（ふつう）' },
          { key: 'history_spider_4', title: '4スート（むずかしい）' },
        ]
      : [{ key: 'history_' + gameId, title: null }];

    let body = `<h2>${game.name} 記録</h2>`;
    for (const sec of sections) {
      const records = loadHistory(sec.key);
      if (sec.title) body += `<p class="hist-section-title">${sec.title}</p>`;
      if (records.length === 0) {
        body += `<p style="color:#999;font-size:14px;margin:4px 0 12px;">まだ記録がありません</p>`;
      } else {
        body += `<table class="hist-table"><thead><tr><th>日時</th><th>タイム</th><th>手数</th></tr></thead><tbody>`;
        for (const r of records) {
          body += `<tr><td>${r.date}</td><td>${formatTime(r.time)}</td><td>${r.moves}手</td></tr>`;
        }
        body += `</tbody></table>`;
      }
    }
    body += `<div class="clear-btns" style="margin-top:18px;"><button class="btn" id="btn-hist-close">閉じる</button></div>`;

    showOverlay(body);
    document.getElementById('btn-hist-close').addEventListener('click', () => {
      el.clearOverlay.hidden = true;
    });
  }

  // ────────── クリア処理 ──────────
  function handleWin() {
    gameWon = true;
    stopTimer();
    const isNew = saveBest(currentGame.id, timerSec, moveCount);
    const best  = loadBest(currentGame.id);

    // 履歴に追記
    const now = new Date();
    const dateStr = `${now.getMonth()+1}/${now.getDate()} `
      + `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    appendHistory(currentHistKey(), { date: dateStr, time: timerSec, moves: moveCount });

    celebrateClear(() => showClearDialog(timerSec, moveCount, best, isNew));
  }

  function showClearDialog(time, moves, best, isNewBest) {
    const isTrulyNew = isNewBest && best && best.time === time && best.moves === moves;
    let bestLine = '';
    if (isTrulyNew)    bestLine = '<p class="clear-best new-best">🏆 新記録！</p>';
    else if (best)     bestLine = `<p class="clear-best">ベスト: ${formatTime(best.time)} ／ ${best.moves}手</p>`;

    showOverlay(`
      <h2>🎉 クリア！</h2>
      <p class="clear-stats">${formatTime(time)} ／ ${moves}手</p>
      ${bestLine}
      <div class="clear-btns">
        <button class="btn" id="btn-again">もう一度</button>
        <button class="btn" id="btn-to-menu">メニューへ</button>
      </div>
    `);
    document.getElementById('btn-again').addEventListener('click', () => startGame(currentGame.id, currentOptions));
    document.getElementById('btn-to-menu').addEventListener('click', () => {
      el.clearOverlay.hidden = true;
      buildMenu();
      showScreen('menu');
    });
  }

  // ────────── 一時停止オーバーレイ ──────────
  function showPauseOverlay() {
    stopTimer();
    showOverlay(`
      <h2>⏸ 一時停止</h2>
      <p class="clear-stats">${el.infoGame.textContent}</p>
      <div class="clear-btns" style="flex-direction:column;gap:10px;">
        <button class="btn" id="btn-resume">▶ ゲームに戻る</button>
        <button class="btn" id="btn-go-menu" style="background:rgba(0,0,0,0.12);color:#555;">メニューへ（終了）</button>
      </div>
    `);
    document.getElementById('btn-resume').addEventListener('click', () => {
      el.clearOverlay.hidden = true;
      startTimer();
    });
    document.getElementById('btn-go-menu').addEventListener('click', () => {
      el.clearOverlay.hidden = true;
      buildMenu();
      showScreen('menu');
    });
  }

  // ────────── リセット確認 ──────────
  function confirmReset(onOk) {
    stopTimer();
    showOverlay(`
      <h2>リセット</h2>
      <p class="clear-stats">最初からやり直しますか？</p>
      <div class="clear-btns">
        <button class="btn" id="btn-reset-ok">はい</button>
        <button class="btn" id="btn-reset-cancel" style="background:rgba(0,0,0,0.12);color:#555;">いいえ・続ける</button>
      </div>
    `);
    document.getElementById('btn-reset-ok').addEventListener('click', () => {
      el.clearOverlay.hidden = true;
      onOk();
    });
    document.getElementById('btn-reset-cancel').addEventListener('click', () => {
      el.clearOverlay.hidden = true;
      if (!gameWon) startTimer();
    });
  }

  // ────────── オーバーレイ共通表示ヘルパー ──────────
  function showOverlay(html) {
    el.clearOverlay.hidden = false;
    el.clearOverlay.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'clear-box';
    box.innerHTML = html;
    el.clearOverlay.appendChild(box);
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
        if (p.y > H - CH) { p.y = H - CH; p.vy = -Math.abs(p.vy) * 0.55; p.vx *= 0.92; p.vr *= 0.88; }
        if (p.x < 0)      { p.x = 0;      p.vx =  Math.abs(p.vx) * 0.8; }
        if (p.x > W - CW) { p.x = W - CW; p.vx = -Math.abs(p.vx) * 0.8; }
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
  el.btnMenu.addEventListener('click', () => {
    if (!gameWon) showPauseOverlay();
  });

  el.btnNew.addEventListener('click', () => {
    if (!currentGame) return;
    confirmReset(() => {
      if (currentGame.id === 'spider') {
        askDifficulty(s => startGame('spider', { suitCount: s }));
      } else {
        startGame(currentGame.id, currentOptions);
      }
    });
  });

  // ────────── dragdrop 初期化・起動 ──────────
  Solitaire.dragdrop.init(el.board, () => currentState, applyStateChange, () => currentGame);
  buildMenu();
  showScreen('menu');
})();
