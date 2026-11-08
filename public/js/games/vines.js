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
    const SNAKES = [
      ['#2f9e44', '#a9e34b', '#ffe066'], ['#7048e8', '#da77f2', '#fcc2d7'], ['#e03131', '#ff922b', '#ffd43b'],
      ['#1971c2', '#4dabf7', '#99e9f2'], ['#5c3d2e', '#c08552', '#f3d9a4'], ['#c2255c', '#f06595', '#ffdeeb'],
    ];
    let defs = '', ladders = '', snakes = '';
    // ── ladders: two wooden rails with rungs
    for (const [from, to] of Object.entries(board.vines)) {
      const a = center(+from), b = center(to);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      const nx = -dy / len * 17, ny = dx / len * 17;
      const ux = dx / len, uy = dy / len;
      const a2 = { x: a.x - ux * 18, y: a.y - uy * 18 }, b2 = { x: b.x + ux * 18, y: b.y + uy * 18 };
      let rungs = '';
      const n = Math.max(2, Math.floor(len / 34));
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const px = a2.x + (b2.x - a2.x) * t, py = a2.y + (b2.y - a2.y) * t;
        rungs += `<line x1="${px - nx}" y1="${py - ny}" x2="${px + nx}" y2="${py + ny}" stroke="#7a4a1f" stroke-width="10"/><line x1="${px - nx}" y1="${py - ny}" x2="${px + nx}" y2="${py + ny}" stroke="#e0a96d" stroke-width="5"/>`;
      }
      const rail = sgn => `<line x1="${a2.x + nx * sgn}" y1="${a2.y + ny * sgn}" x2="${b2.x + nx * sgn}" y2="${b2.y + ny * sgn}"`;
      ladders += `<g class="ladder">
        <g transform="translate(6,8)" opacity=".28">${rail(-1)} stroke="#000" stroke-width="12"/>${rail(1)} stroke="#000" stroke-width="12"/></g>
        ${rungs}
        ${rail(-1)} stroke="#6b3f17" stroke-width="12"/>${rail(1)} stroke="#6b3f17" stroke-width="12"/>
        ${rail(-1)} stroke="#c98b4a" stroke-width="6"/>${rail(1)} stroke="#c98b4a" stroke-width="6"/>
        ${rail(-1)} stroke="#f2c78f" stroke-width="2" transform="translate(-1.5,-1.5)"/>${rail(1)} stroke="#f2c78f" stroke-width="2" transform="translate(-1.5,-1.5)"/>
      </g>`;
    }
    // ── snakes: tapered wiggly bodies with patterns, head at the top square
    let k = 0;
    for (const [from, to] of Object.entries(board.slides)) {
      const head = center(+from), tail = center(to);
      const [dark, mid, light] = SNAKES[k % SNAKES.length];
      const id = 'sn' + k++;
      const dx = tail.x - head.x, dy = tail.y - head.y, len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
      const waves = Math.max(1.5, len / 190), amp = Math.min(40, 18 + len / 20);
      const N = 70, pts = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const env = Math.sin(Math.PI * Math.min(1, t * 1.15)) ;
        const off = Math.sin(t * Math.PI * 2 * waves) * amp * env;
        pts.push({ x: head.x + dx * t + nx * off, y: head.y + dy * t + ny * off, w: 30 * (1 - t) + 4 });
      }
      const L = [], R = [];
      for (let i = 0; i <= N; i++) {
        const p = pts[i], q = pts[Math.min(N, i + 1)], o = pts[Math.max(0, i - 1)];
        let tx = q.x - o.x, ty = q.y - o.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        L.push(`${(p.x - ty * p.w / 2).toFixed(1)},${(p.y + tx * p.w / 2).toFixed(1)}`);
        R.push(`${(p.x + ty * p.w / 2).toFixed(1)},${(p.y - tx * p.w / 2).toFixed(1)}`);
      }
      const body = `M${L.join(' L')} L${R.reverse().join(' L')} Z`;
      defs += `<linearGradient id="${id}" x1="${head.x}" y1="${head.y}" x2="${tail.x}" y2="${tail.y}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`;
      let spots = '';
      for (let i = 6; i < N - 3; i += 5) {
        const p = pts[i];
        spots += `<ellipse cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" rx="${(p.w * 0.28).toFixed(1)}" ry="${(p.w * 0.2).toFixed(1)}" fill="${i % 10 ? light : dark}" opacity=".9"/>`;
      }
      // head, facing away from the body
      const h1 = pts[3];
      const ang = Math.atan2(head.y - h1.y, head.x - h1.x) * 180 / Math.PI;
      snakes += `<g class="snake">
        <path d="${body}" fill="#000" opacity=".25" transform="translate(6,8)"/>
        <path d="${body}" fill="url(#${id})" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/>
        ${spots}
        <g transform="translate(${head.x} ${head.y}) rotate(${ang})">
          <path d="M22,0 L42,0 M42,0 L50,-6 M42,0 L50,6" stroke="#e03131" stroke-width="3.5" fill="none" class="tongue"/>
          <ellipse cx="0" cy="0" rx="27" ry="21" fill="${mid}" stroke="${dark}" stroke-width="3"/>
          <ellipse cx="6" cy="0" rx="14" ry="10" fill="${light}" opacity=".55"/>
          <circle cx="8" cy="-10" r="7" fill="#fff" stroke="${dark}" stroke-width="2"/><circle cx="8" cy="10" r="7" fill="#fff" stroke="${dark}" stroke-width="2"/>
          <circle cx="10" cy="-10" r="3.5" fill="#111"/><circle cx="10" cy="10" r="3.5" fill="#111"/>
          <circle cx="11" cy="-11.5" r="1.2" fill="#fff"/><circle cx="11" cy="8.5" r="1.2" fill="#fff"/>
          <circle cx="23" cy="-4" r="1.6" fill="${dark}"/><circle cx="23" cy="4" r="1.6" fill="${dark}"/>
        </g>
      </g>`;
    }
    return `<svg class="vs-svg" viewBox="0 0 1000 1000" fill="none" stroke-linecap="round"><defs>${defs}</defs>${ladders}${snakes}</svg>`;
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
            const tone = 't' + ((row * 3 + col) % 5);
            const shade = (row + col) % 2 ? 'odd' : '';
            const label = n === 100 ? '<b>🏆</b><em>100</em>' : n === 1 ? '<span>1</span><em>START</em>' : `<span>${n}</span>`;
            cells += `<div class="vs-cell ${tone} ${shade} ${n === 100 ? 'goal' : ''} ${n === 1 ? 'first' : ''}">${label}</div>`;
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
            if (e.player === api.me) TW.toast(e.jump.kind === 'vine' ? `🪜 Up the ladder to ${e.jump.to}!` : `🐍 Ouch! Snake bite, down to ${e.jump.to}`, e.jump.kind === 'vine' ? 'ok' : 'error', 1800);
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
