'use strict';
(() => {
  const { esc, h, $ } = TW;
  const STEP_MS = 230;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function cellRC(n) { // 1..100 → {r (0 bottom), c}
    const r = Math.floor((n - 1) / 10);
    const i = (n - 1) % 10;
    return { r, c: r % 2 === 0 ? i : 9 - i };
  }
  function center(n) { const { r, c } = cellRC(n); return { x: c * 100 + 50, y: (9 - r) * 100 + 50 }; }
  function bez(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    };
  }
  function controls(a, b, bend) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    return [
      { x: a.x + dx * 0.25 + nx * bend, y: a.y + dy * 0.25 + ny * bend },
      { x: a.x + dx * 0.75 - nx * bend, y: a.y + dy * 0.75 - ny * bend },
    ];
  }
  function boardSVG(board) {
    let out = '';
    const slideColors = [['#ff5a5f', '#ff9a9e'], ['#3a86ff', '#8ec5ff'], ['#f15bb5', '#ffa6d9'], ['#ff8c42', '#ffc49b'], ['#b388ff', '#d9c6ff']];
    let k = 0;
    for (const [from, to] of Object.entries(board.slides)) {
      const a = center(+from), b = center(to);
      const [c1, c2] = controls(a, b, 60);
      const d = `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`;
      const [dark, light] = slideColors[k++ % slideColors.length];
      out += `<g class="slide"><path d="${d}" stroke="rgba(0,0,0,.25)" stroke-width="46" transform="translate(4,6)"/><path d="${d}" stroke="${dark}" stroke-width="42"/><path d="${d}" stroke="${light}" stroke-width="26"/><path d="${d}" stroke="rgba(255,255,255,.65)" stroke-width="5" stroke-dasharray="2 22"/>
        <circle cx="${a.x}" cy="${a.y}" r="22" fill="${dark}"/><circle cx="${b.x}" cy="${b.y}" r="16" fill="${light}" stroke="${dark}" stroke-width="5"/></g>`;
    }
    for (const [from, to] of Object.entries(board.vines)) {
      const a = center(+from), b = center(to);
      const [c1, c2] = controls(a, b, 45);
      const d = `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`;
      let leaves = '';
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const count = Math.max(3, Math.round(len / 70));
      for (let i = 1; i < count; i++) {
        const t = i / count;
        const p = bez(a, c1, c2, b, t), q = bez(a, c1, c2, b, t + 0.01);
        const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI + (i % 2 ? 50 : -50);
        leaves += `<ellipse cx="${p.x}" cy="${p.y}" rx="20" ry="9" fill="${i % 2 ? '#3ddc84' : '#2bb673'}" transform="rotate(${ang} ${p.x} ${p.y}) translate(16 0)"/>`;
      }
      out += `<g class="vine"><path d="${d}" stroke="rgba(0,0,0,.25)" stroke-width="20" transform="translate(4,6)"/><path d="${d}" stroke="#1e7a45" stroke-width="18"/><path d="${d}" stroke="#4caf50" stroke-width="10"/><path d="${d}" stroke="#a5e887" stroke-width="3" stroke-dasharray="14 18"/>${leaves}
        <text x="${b.x}" y="${b.y + 14}" font-size="40" text-anchor="middle">🌸</text></g>`;
    }
    return `<svg class="vs-svg" viewBox="0 0 1000 1000" fill="none" stroke-linecap="round">${out}</svg>`;
  }

  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const dieHTML = n => `<div class="die">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n] && PIPS[n].includes(i + 1) ? 'on' : ''}"></i>`).join('')}</div>`;

  TW.games.vines = {
    create(root, api) {
      root.innerHTML = `<div class="vs">
        <div class="vs-board-wrap"><div class="vs-board" id="vs-board"></div></div>
        <div class="vs-side">
          <div class="vs-turn" id="vs-turn"></div>
          <div class="vs-dice-box"><div id="vs-die">${dieHTML(1)}</div><button class="btn btn-primary btn-big" id="vs-roll">🎲 Roll</button></div>
          <div class="vs-start"><div class="muted">Start</div><div class="vs-start-tokens" id="vs-start"></div></div>
          <ol class="vs-standings" id="vs-standings"></ol>
          <div class="vs-log" id="vs-log"></div>
        </div>
      </div>`;
      let view = null, built = false, lastSeq = 0, animating = false, rolling = false;
      const queue = [];
      const shown = {}; // displayed position per player
      const tokens = {};

      $('#vs-roll', root).onclick = async () => {
        if (!view || rolling || animating || view.turnId !== api.me || view.phase !== 'play') return;
        rolling = true; syncButton();
        await api.act({ type: 'roll' });
        rolling = false; syncButton();
      };

      function buildBoard(board) {
        const el = $('#vs-board', root);
        let cells = '';
        for (let row = 9; row >= 0; row--) {
          for (let col = 0; col < 10; col++) {
            const n = row % 2 === 0 ? row * 10 + col + 1 : row * 10 + (9 - col) + 1;
            const tone = (row + col) % 2 ? 'a' : 'b';
            const mark = board.vines[n] ? 'has-vine' : board.slides[n] ? 'has-slide' : '';
            cells += `<div class="vs-cell ${tone} ${mark} ${n === 100 ? 'goal' : ''}"><span>${n === 100 ? '🏁' : n}</span></div>`;
          }
        }
        el.innerHTML = `<div class="vs-grid">${cells}</div>${boardSVG(board)}<div class="vs-tokens" id="vs-tokens"></div>`;
        built = true;
      }
      function tokenFor(id) {
        if (tokens[id]) return tokens[id];
        const p = api.player(id) || {};
        const t = h(`<div class="vs-token" style="--pc:${esc(p.color || '#888')}" title="${esc(p.name || '')}">${esc(p.avatar || '🙂')}</div>`);
        tokens[id] = t;
        return t;
      }
      function placeTokens() {
        const layer = $('#vs-tokens', root), start = $('#vs-start', root);
        const groups = {};
        for (const p of view.players) (groups[shown[p.id]] = groups[shown[p.id]] || []).push(p.id);
        for (const p of view.players) {
          const t = tokenFor(p.id);
          const pos = shown[p.id];
          t.classList.toggle('turn', p.id === view.turnId && view.phase === 'play');
          if (pos === 0) {
            if (t.parentElement !== start) { start.appendChild(t); }
            t.style.left = t.style.top = '';
            continue;
          }
          if (t.parentElement !== layer) layer.appendChild(t);
          const { r, c } = cellRC(pos);
          const g = groups[pos], i = g.indexOf(p.id), n = g.length;
          const off = n > 1 ? { x: Math.cos((i / n) * 2 * Math.PI) * 2.2, y: Math.sin((i / n) * 2 * Math.PI) * 2.2 } : { x: 0, y: 0 };
          t.style.left = c * 10 + 5 + off.x + '%';
          t.style.top = (9 - r) * 10 + 5 + off.y + '%';
        }
      }
      function syncButton() {
        const b = $('#vs-roll', root);
        const mine = view && view.turnId === api.me && view.phase === 'play';
        b.disabled = !mine || rolling || animating;
        b.classList.toggle('pulse', mine && !rolling && !animating);
      }
      async function rollDie(final) {
        const die = $('#vs-die', root);
        die.classList.add('rolling');
        for (let i = 0; i < 6; i++) { die.innerHTML = dieHTML(1 + Math.floor(Math.random() * 6)); await sleep(70); }
        die.innerHTML = dieHTML(final);
        die.classList.remove('rolling');
      }
      async function runQueue() {
        if (animating) return;
        animating = true; syncButton();
        while (queue.length) {
          const e = queue.shift();
          await rollDie(e.roll);
          const t = tokenFor(e.player);
          for (const sq of e.path) {
            shown[e.player] = sq;
            placeTokens();
            t.classList.remove('hop'); void t.offsetWidth; t.classList.add('hop');
            await sleep(STEP_MS);
          }
          if (e.jump) {
            await sleep(180);
            t.classList.add(e.jump.kind === 'vine' ? 'climbing' : 'sliding');
            shown[e.player] = e.jump.to;
            placeTokens();
            if (e.player === api.me) TW.toast(e.jump.kind === 'vine' ? `🌿 Up the vine to ${e.jump.to}!` : `🛝 Wheee! Down to ${e.jump.to}`, e.jump.kind === 'vine' ? 'ok' : 'error', 1800);
            await sleep(850);
            t.classList.remove('climbing', 'sliding');
          }
          shown[e.player] = e.to;
          placeTokens();
        }
        animating = false;
        // make sure everything matches the server
        for (const p of view.players) shown[p.id] = p.pos;
        placeTokens(); syncButton(); renderSide(); maybeWinner();
      }
      function renderSide() {
        const pName = id => (api.player(id) || {}).name || (view.players.find(p => p.id === id) || {}).name || '?';
        const pAv = id => (api.player(id) || {}).avatar || '🙂';
        const turn = $('#vs-turn', root);
        if (view.phase === 'over') turn.innerHTML = animating ? '…' : `🏆 ${view.winner === api.me ? 'You win!' : esc(pName(view.winner)) + ' wins!'}`;
        else turn.innerHTML = view.turnId === api.me ? '✨ Your turn — roll the dice!' : `${pAv(view.turnId)} ${esc(pName(view.turnId))}'s turn`;
        turn.classList.toggle('mine', view.turnId === api.me && view.phase === 'play');
        const sorted = [...view.players].sort((a, b) => shown[b.id] - shown[a.id]);
        $('#vs-standings', root).innerHTML = sorted.map(p => `<li style="--pc:${esc((api.player(p.id) || {}).color || '#888')}" class="${p.id === view.turnId ? 'turn' : ''}"><span>${pAv(p.id)} ${esc(pName(p.id))}</span><b>${shown[p.id] || 'Start'}</b></li>`).join('');
        $('#vs-log', root).innerHTML = view.log.slice(-5).reverse().map(l => `<div>${esc(l.text)}</div>`).join('');
      }
      function maybeWinner() {
        if (view.phase !== 'over' || animating) { if (view.phase !== 'over') root.querySelector('.vs-over')?.remove(); return; }
        if (root.querySelector('.vs-over')) return;
        const p = api.player(view.winner) || {};
        if (view.winner === api.me) TW.confetti();
        root.querySelector('.vs').appendChild(h(`<div class="overlay vs-over"><div class="overlay-card">
          <div class="big-emoji">${esc(p.avatar || '🏆')}</div>
          <h2>${view.winner === api.me ? 'You reached 100!' : esc(p.name || 'Someone') + ' wins!'}</h2>
          <p>${view.players.map(x => `${esc((api.player(x.id) || {}).name || x.name)}: square ${x.pos} (${x.rolls} rolls)`).join('<br>')}</p>
          <p class="muted">${api.isHost ? 'Hit “Play again” up top for a rematch.' : 'Waiting for the host…'}</p>
          <button class="btn btn-ghost btn-sm" onclick="this.closest('.overlay').remove()">Close</button>
        </div></div>`));
      }

      function update(v) {
        const fresh = !view || (v.lastEvent === null && lastSeq !== 0);
        view = v;
        if (!built) buildBoard(v.board);
        if (fresh) { // first render or a new game
          lastSeq = v.lastEvent ? v.lastEvent.seq : 0;
          queue.length = 0;
          for (const p of v.players) shown[p.id] = p.pos;
          Object.keys(tokens).forEach(id => { if (!v.players.some(p => p.id === id)) { tokens[id].remove(); delete tokens[id]; } });
        } else if (v.lastEvent && v.lastEvent.seq !== lastSeq) {
          lastSeq = v.lastEvent.seq;
          queue.push(v.lastEvent);
          runQueue();
        }
        if (!animating) { for (const p of v.players) shown[p.id] = p.pos; placeTokens(); }
        syncButton(); renderSide(); maybeWinner();
      }
      return { update, unmount() {} };
    },
  };
})();
