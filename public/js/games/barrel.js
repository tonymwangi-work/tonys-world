'use strict';
(() => {
  const { esc, h, $ } = TW;
  const W = 480, H = 560;
  const DT = 1 / 60;
  const R = 9; // barrel radius

  // ── level geometry (index 0 = bottom girder, 6 = trophy platform)
  const G = [
    { x1: 0, x2: 480, y1: 540, y2: 540, dir: -1 },
    { x1: 0, x2: 440, y1: 450, y2: 462, dir: 1 },
    { x1: 40, x2: 480, y1: 382, y2: 370, dir: -1 },
    { x1: 0, x2: 440, y1: 290, y2: 302, dir: 1 },
    { x1: 40, x2: 480, y1: 222, y2: 210, dir: -1 },
    { x1: 0, x2: 440, y1: 130, y2: 142, dir: 1 },
    { x1: 150, x2: 330, y1: 62, y2: 62, dir: 0 },
  ];
  const LADDERS = [[380, 0], [90, 0], [100, 1], [260, 1], [360, 2], [180, 2], [90, 3], [300, 3], [400, 4], [220, 4], [300, 5]]
    .map(([x, lo]) => ({ x, lo, hi: lo + 1 }));
  const surf = (g, x) => { const a = G[g]; return a.y1 + (a.y2 - a.y1) * (x - a.x1) / (a.x2 - a.x1); };
  const inG = (g, x) => x >= G[g].x1 && x <= G[g].x2;
  const BOSS = { x: 56 };
  const START_X = 30;

  function mulberry32(a) {
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ── deterministic barrel world: identical on every client for the same seed + level
  function makeWorld(seed, level) {
    const speed = 85 + 20 * (level - 1);
    const interval = Math.max(1.15, 3.0 - 0.45 * (level - 1));
    const ladderChance = Math.min(0.55, 0.25 + 0.06 * level);
    const sched = mulberry32(seed);
    let nextSpawn = 2.0, k = 0;
    const w = { t: 0, barrels: [], lastThrow: -9 };
    w.step = () => {
      w.t += DT;
      while (w.t >= nextSpawn) {
        const g = 5;
        w.barrels.push({ k, x: BOSS.x + 30, y: surf(g, BOSS.x + 30) - R, g, mode: 'roll', vy: 0, rot: 0, dir: 1, rng: mulberry32((seed ^ Math.imul(k + 1, 2654435761)) >>> 0), ladder: null, jumped: false });
        w.lastThrow = w.t;
        k++;
        nextSpawn += interval * (0.7 + 0.6 * sched());
      }
      for (const b of w.barrels) {
        if (b.mode === 'roll') {
          const dir = G[b.g].dir;
          b.dir = dir;
          const px = b.x;
          b.x += dir * speed * DT;
          b.rot += dir * speed * DT / R;
          for (const l of LADDERS) {
            if (l.hi !== b.g) continue;
            if ((px - l.x) * (b.x - l.x) <= 0 && px !== l.x && b.rng() < ladderChance) {
              b.mode = 'ladder'; b.x = l.x; b.ladder = l; break;
            }
          }
          if (b.mode !== 'roll') continue;
          if (!inG(b.g, b.x)) {
            if (b.g === 0) { if (b.x < -20 || b.x > W + 20) b.dead = true; else b.y = surf(0, Math.max(0, Math.min(W, b.x))) - R; continue; }
            b.mode = 'fall'; b.vy = 0;
          } else b.y = surf(b.g, b.x) - R;
        } else if (b.mode === 'fall') {
          b.vy += 900 * DT;
          b.y += b.vy * DT;
          b.x += b.dir * speed * 0.25 * DT;
          const tg = b.g - 1;
          const sx = Math.max(G[tg].x1, Math.min(G[tg].x2, b.x));
          if (b.y >= surf(tg, sx) - R) { b.g = tg; b.x = sx; b.y = surf(tg, sx) - R; b.mode = 'roll'; }
        } else if (b.mode === 'ladder') {
          b.y += 75 * DT;
          const bottom = surf(b.ladder.lo, b.x) - R;
          if (b.y >= bottom) { b.y = bottom; b.g = b.ladder.lo; b.mode = 'roll'; b.ladder = null; }
        }
      }
      if (w.barrels.length > 40 || w.barrels.some(b => b.dead)) w.barrels = w.barrels.filter(b => !b.dead);
    };
    return w;
  }

  TW.games.barrel = {
    create(root, api) {
      root.innerHTML = `<div class="bc">
        <div class="bc-hud" id="bc-hud"></div>
        <div class="bc-stage">
          <canvas id="bc-canvas" width="${W * 2}" height="${H * 2}"></canvas>
          <div class="bc-overlay" id="bc-overlay" hidden></div>
        </div>
        <div class="bc-touch">
          <div class="bc-dpad"><button data-k="left">◀</button><div class="bc-ud"><button data-k="up">▲</button><button data-k="down">▼</button></div><button data-k="right">▶</button></div>
          <button class="bc-jump" data-k="jump">JUMP</button>
        </div>
        <p class="bc-help muted">⬅️➡️ move · ⬆️⬇️ climb ladders · Space jump over barrels · reach the 🏆</p>
      </div>`;
      const canvas = $('#bc-canvas', root);
      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);
      let view = null, world = null, worldKey = null, localStart = null;
      const keys = { left: false, right: false, up: false, down: false, jump: false };
      let jumpQueued = false;
      const others = {};
      let me = null;
      let raf = null, lastFrame = performance.now(), lastSend = 0;
      const stars = Array.from({ length: 60 }, (_, i) => ({ x: (i * 97) % W, y: (i * 53) % 300, r: (i % 3) * 0.5 + 0.5 }));

      function resetMe() {
        me = { x: START_X, y: surf(0, START_X), vx: 0, vy: 0, ground: 0, climb: null, facing: 1, dead: false, deadT: 0, done: false, inv: 1.2, walk: 0 };
      }
      resetMe();

      // ── input
      const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ' ': 'jump' };
      const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement && document.activeElement.tagName);
      const onKey = down => e => {
        const k = KEYMAP[e.key];
        if (!k || typing()) return;
        e.preventDefault();
        if (k === 'jump' && down && !keys.jump) jumpQueued = true;
        keys[k] = down;
      };
      const kd = onKey(true), ku = onKey(false);
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      root.querySelectorAll('[data-k]').forEach(b => {
        const k = b.dataset.k;
        const on = e => { e.preventDefault(); if (k === 'jump') jumpQueued = true; keys[k] = true; b.classList.add('on'); };
        const off = e => { e.preventDefault(); keys[k] = false; b.classList.remove('on'); };
        b.addEventListener('pointerdown', on);
        b.addEventListener('pointerup', off);
        b.addEventListener('pointerleave', off);
        b.addEventListener('pointercancel', off);
      });
      const onStream = ({ id, d }) => {
        const o = others[id] || (others[id] = { x: d.x, y: d.y });
        Object.assign(o, { tx: d.x, ty: d.y, f: d.f, c: d.c, dead: d.d, m: d.m, done: d.done, seen: performance.now() });
      };
      api.socket.on('game:stream', onStream);

      const send = a => api.socket.emit('game:action', a, () => {});
      const playing = () => view && view.phase === 'playing';
      const isPlayer = () => view && view.players.some(p => p.id === api.me);

      // ── player physics
      function die() {
        if (me.dead || me.inv > 0 || me.done) return;
        me.dead = true; me.deadT = 1.6;
        send({ type: 'died' });
      }
      function stepMe(dt) {
        if (me.inv > 0) me.inv -= dt;
        if (me.dead) { me.deadT -= dt; if (me.deadT <= 0) resetMe(); return; }
        if (me.done) return;
        const SPEED = 95, GRAV = 1100, JUMP = 300, CLIMB = 60;
        if (me.climb) {
          const l = me.climb;
          me.x = l.x;
          me.y += (keys.up ? -CLIMB : keys.down ? CLIMB : 0) * dt;
          me.walk += (keys.up || keys.down) ? dt : 0;
          const top = surf(l.hi, l.x), bot = surf(l.lo, l.x);
          if (me.y <= top) { me.y = top; me.climb = null; me.ground = l.hi; }
          else if (me.y >= bot) { me.y = bot; me.climb = null; me.ground = l.lo; }
          jumpQueued = false;
          return;
        }
        if (me.ground !== null) {
          for (const l of LADDERS) {
            if (Math.abs(me.x - l.x) > 8) continue;
            if (keys.up && l.lo === me.ground) { me.climb = l; me.ground = null; return; }
            if (keys.down && l.hi === me.ground) { me.climb = l; me.ground = null; me.y += 2; return; }
          }
          me.vx = ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * SPEED;
          if (me.vx) { me.facing = Math.sign(me.vx); me.walk += dt; }
          if (jumpQueued) { me.vy = -JUMP; me.ground = null; }
        }
        jumpQueued = false;
        me.x = Math.max(6, Math.min(W - 6, me.x + me.vx * dt));
        if (me.ground !== null) {
          if (inG(me.ground, me.x)) me.y = surf(me.ground, me.x);
          else { me.ground = null; me.vy = 0; }
        } else {
          const prev = me.y;
          me.vy += GRAV * dt;
          me.y += me.vy * dt;
          if (me.vy > 0) {
            for (let g = 0; g < G.length; g++) {
              if (!inG(g, me.x)) continue;
              const sy = surf(g, me.x);
              if (prev <= sy + 1 && me.y >= sy) { me.y = sy; me.ground = g; me.vy = 0; break; }
            }
          }
          if (me.y > H + 40) die();
        }
        if (me.ground === 6 && !me.done) { me.done = true; send({ type: 'finish' }); TW.confetti(60); }
      }
      function checkBarrels() {
        if (!world || me.dead || me.done) return;
        const px1 = me.x - 6, px2 = me.x + 6, py1 = me.y - 20, py2 = me.y;
        for (const b of world.barrels) {
          const cx = Math.max(px1, Math.min(b.x, px2)), cy = Math.max(py1, Math.min(b.y, py2));
          if ((cx - b.x) ** 2 + (cy - b.y) ** 2 < (R - 2) ** 2) { die(); return; }
          if (!b.jumped && me.ground === null && !me.climb && Math.abs(b.x - me.x) < 12 && b.y > me.y && b.y - me.y < 55) {
            b.jumped = true;
            send({ type: 'jumped' });
            popups.push({ x: me.x, y: me.y - 30, t: 0.9, text: '+100' });
          }
        }
      }
      const popups = [];

      // ── drawing
      function drawGirder(g) {
        const a = G[g];
        ctx.save();
        ctx.translate(a.x1, a.y1);
        const len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
        ctx.rotate(Math.atan2(a.y2 - a.y1, a.x2 - a.x1));
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(2, 4, len, 12);
        ctx.fillStyle = '#f08c00'; ctx.fillRect(0, 0, len, 11);
        ctx.fillStyle = '#ffc078'; ctx.fillRect(0, 0, len, 2.5);
        ctx.fillStyle = '#a65e00'; ctx.fillRect(0, 9, len, 2);
        ctx.strokeStyle = '#a65e00'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let x = 0; x < len; x += 14) { ctx.moveTo(x, 2.5); ctx.lineTo(x + 7, 9); ctx.lineTo(x + 14, 2.5); }
        ctx.stroke();
        ctx.restore();
      }
      function drawLadder(l) {
        const top = surf(l.hi, l.x), bot = surf(l.lo, l.x);
        ctx.strokeStyle = '#66d9e8'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(l.x - 7, top + 10); ctx.lineTo(l.x - 7, bot);
        ctx.moveTo(l.x + 7, top + 10); ctx.lineTo(l.x + 7, bot);
        for (let y = top + 16; y < bot - 2; y += 9) { ctx.moveTo(l.x - 7, y); ctx.lineTo(l.x + 7, y); }
        ctx.stroke();
      }
      function drawBoss(t) {
        const x = BOSS.x, y = surf(5, BOSS.x);
        const throwing = world && world.t - world.lastThrow < 0.45;
        const bob = Math.sin(t * 4) * 1.5;
        ctx.save(); ctx.translate(x, y + bob);
        // legs
        ctx.fillStyle = '#495057'; ctx.fillRect(-12, -12, 8, 12); ctx.fillRect(4, -12, 8, 12);
        // body
        ctx.fillStyle = '#868e96'; roundRect(-17, -40, 34, 30, 6); ctx.fill();
        ctx.fillStyle = '#ffd43b'; ctx.fillRect(-9, -32, 18, 4); ctx.fillStyle = '#fa5252'; ctx.fillRect(-9, -25, 6, 6); ctx.fillStyle = '#51cf66'; ctx.fillRect(3, -25, 6, 6);
        // arms
        ctx.strokeStyle = '#495057'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath();
        if (throwing) { ctx.moveTo(-15, -36); ctx.lineTo(-22, -58); ctx.moveTo(15, -36); ctx.lineTo(24, -56); }
        else { ctx.moveTo(-15, -36); ctx.lineTo(-24, -18); ctx.moveTo(15, -36); ctx.lineTo(24, -18); }
        ctx.stroke();
        // head
        ctx.fillStyle = '#adb5bd'; roundRect(-14, -62, 28, 22, 5); ctx.fill();
        ctx.fillStyle = Math.sin(t * 6) > 0 ? '#ff6b6b' : '#c92a2a';
        ctx.fillRect(-9, -55, 6, 5); ctx.fillRect(3, -55, 6, 5);
        ctx.fillStyle = '#343a40'; ctx.fillRect(-7, -46, 14, 2);
        ctx.strokeStyle = '#adb5bd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -62); ctx.lineTo(0, -70); ctx.stroke();
        ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.arc(0, -72, 3, 0, 7); ctx.fill();
        ctx.restore();
        // barrel stack
        for (const [dx, dy] of [[-30, -9], [-30, -27], [-12 - 30, -9]]) drawBarrelAt(x + dx + 10, surf(5, Math.max(0, x + dx)) + dy, 0);
        ctx.font = 'bold 9px Nunito, sans-serif'; ctx.fillStyle = '#ffd43b'; ctx.textAlign = 'center'; ctx.fillText('BIG BOLT', x + 2, y - 78);
      }
      function roundRect(x, y, w, hh, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
      function drawBarrelAt(x, y, rot) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.fillStyle = '#9c5b22'; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
        ctx.strokeStyle = '#5c3510'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#d9a066'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-R + 2, -3); ctx.lineTo(R - 2, -3); ctx.moveTo(-R + 2, 3); ctx.lineTo(R - 2, 3); ctx.stroke();
        ctx.fillStyle = '#5c3510'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, 7); ctx.fill();
        ctx.restore();
      }
      function drawRunner(p, color, avatar, alpha, label) {
        const x = p.x, y = p.y;
        ctx.save(); ctx.globalAlpha = alpha;
        if (p.dead) {
          ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.fillText('💥', x, y - 8);
          ctx.restore(); return;
        }
        const stride = p.climb || p.c ? Math.sin((p.walk || performance.now() / 120) * 14) * 3 : (p.m || (me === p && me.vx && me.ground !== null)) ? Math.sin((p.walk || performance.now() / 100) * 16) * 4 : 0;
        ctx.strokeStyle = '#212529'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 2, y - 7); ctx.lineTo(x - 3 - stride, y); ctx.moveTo(x + 2, y - 7); ctx.lineTo(x + 3 + stride, y); ctx.stroke();
        ctx.fillStyle = color; roundRect(x - 6, y - 17, 12, 11, 3); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - 22, 7.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = '11px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(avatar, x, y - 21.5);
        ctx.textBaseline = 'alphabetic';
        if (label) { ctx.font = 'bold 8px Nunito, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(label, x, y - 33); }
        if (p.done) { ctx.font = '12px serif'; ctx.fillText('⭐', x + 10, y - 30); }
        ctx.restore();
      }
      function draw(t) {
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#0b0930'); sky.addColorStop(1, '#2a1b5c');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        for (const s of stars) { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + s.x); ctx.fillRect(s.x, s.y, s.r, s.r); }
        ctx.globalAlpha = 1;
        // city silhouette
        ctx.fillStyle = '#1a1446';
        for (let i = 0; i < 12; i++) { const bw = 40, bh = 60 + ((i * 37) % 90); ctx.fillRect(i * 42, H - bh, bw, bh); }
        LADDERS.forEach(drawLadder);
        for (let g = 0; g < G.length; g++) drawGirder(g);
        // trophy
        ctx.font = '30px serif'; ctx.textAlign = 'center';
        ctx.fillText('🏆', 240, 58 + Math.sin(t * 3) * 2);
        ctx.font = 'bold 9px Nunito, sans-serif'; ctx.fillStyle = '#ffd43b'; ctx.fillText('GOAL', 240, 76);
        drawBoss(t);
        if (world) for (const b of world.barrels) drawBarrelAt(b.x, b.y, b.rot);
        // other players
        for (const [id, o] of Object.entries(others)) {
          if (id === api.me || !view || !view.players.some(p => p.id === id)) continue;
          o.x += ((o.tx ?? o.x) - o.x) * 0.35; o.y += ((o.ty ?? o.y) - o.y) * 0.35;
          const pl = api.player(id) || {};
          drawRunner(o, pl.color || '#888', pl.avatar || '🙂', 0.65, pl.name);
        }
        if (isPlayer()) {
          const pl = api.player(api.me) || {};
          const blink = me.inv > 0 && Math.floor(t * 10) % 2;
          drawRunner(me, pl.color || '#ffc93c', pl.avatar || '🙂', blink ? 0.35 : 1, 'YOU');
        }
        for (const p of popups) {
          ctx.globalAlpha = Math.max(0, p.t); ctx.fillStyle = '#ffd43b'; ctx.font = 'bold 12px Nunito, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(p.text, p.x, p.y - (0.9 - p.t) * 30); ctx.globalAlpha = 1;
        }
      }

      function frame(now) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - lastFrame) / 1000);
        lastFrame = now;
        if (world && localStart !== null && playing()) {
          const target = (now - localStart) / 1000;
          let n = 0;
          while (world.t < target && n++ < 4000) world.step();
        }
        if (playing() && isPlayer()) {
          // sub-step for stable physics
          const steps = Math.ceil(dt / DT);
          for (let i = 0; i < steps; i++) { stepMe(dt / steps); checkBarrels(); }
          if (now - lastSend > 80) {
            lastSend = now;
            api.socket.emit('game:stream', { x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, f: me.facing, c: me.climb ? 1 : 0, d: me.dead ? 1 : 0, m: me.vx && me.ground !== null ? 1 : 0, done: me.done ? 1 : 0 });
          }
        }
        for (const p of popups) p.t -= dt;
        while (popups.length && popups[0].t <= 0) popups.shift();
        draw(now / 1000);
      }
      raf = requestAnimationFrame(frame);

      function renderHud() {
        const pName = id => (api.player(id) || {}).name || (view.players.find(p => p.id === id) || {}).name || '?';
        const sorted = [...view.players].sort((a, b) => b.score - a.score);
        const secs = Math.ceil(view.remaining / 1000);
        $('#bc-hud', root).innerHTML = `
          <span class="bc-chip">Level ${view.level}/${view.levels}</span>
          ${view.phase === 'playing' ? `<span class="bc-chip ${secs <= 20 ? 'urgent' : ''}" id="bc-time">⏱️ ${secs}s</span>` : ''}
          <div class="bc-scores">${sorted.map(p => `<span class="bc-score ${p.id === api.me ? 'me' : ''}" style="--pc:${esc((api.player(p.id) || {}).color || '#888')}">${esc((api.player(p.id) || {}).avatar || '🙂')} ${esc(pName(p.id))} <b>${p.score}</b>${p.done ? ' 🏆' : ''}</span>`).join('')}</div>`;
      }
      function renderOverlay() {
        const ov = $('#bc-overlay', root);
        const pName = id => (api.player(id) || {}).name || (view.players.find(p => p.id === id) || {}).name || '?';
        if (view.phase === 'countdown') {
          ov.hidden = false;
          ov.innerHTML = `<div class="bc-count"><small>Level ${view.level}</small><b id="bc-cd">${Math.ceil(view.remaining / 1000)}</b><small>${view.level === 1 ? 'Climb to the 🏆, jump the barrels!' : 'Barrels get faster!'}</small></div>`;
        } else if (view.phase === 'results' || view.phase === 'over') {
          ov.hidden = false;
          const sorted = [...view.players].sort((a, b) => b.score - a.score);
          ov.innerHTML = `<div class="overlay-card bc-results">
            <div class="big-emoji">${view.phase === 'over' ? '🏆' : '🏁'}</div>
            <h2>${view.phase === 'over' ? (view.winner === api.me ? 'You win!' : esc(pName(view.winner)) + ' wins!') : `Level ${view.level} done`}</h2>
            <ol class="score-list">${sorted.map(p => `<li><span>${esc((api.player(p.id) || {}).avatar || '🙂')} ${esc(pName(p.id))}</span><span>${p.score} pts · 🛢️${p.jumps} · 💥${p.deaths}</span></li>`).join('')}</ol>
            <p class="muted">${view.phase === 'over' ? (api.isHost ? 'Hit “Play again” up top for a rematch.' : 'Waiting for the host…') : 'Next level starting soon…'}</p>
          </div>`;
          if (view.phase === 'over' && view.winner === api.me && !ov.dataset.cheered) { ov.dataset.cheered = '1'; TW.confetti(); }
        } else { ov.hidden = true; ov.innerHTML = ''; delete ov.dataset.cheered; }
      }
      let cdTimer = setInterval(() => {
        if (!view) return;
        view.remaining = Math.max(0, view.remaining - 250);
        const cd = $('#bc-cd', root); if (cd) cd.textContent = Math.max(1, Math.ceil(view.remaining / 1000));
        const tm = $('#bc-time', root); if (tm) tm.textContent = `⏱️ ${Math.ceil(view.remaining / 1000)}s`;
      }, 250);

      function update(v) {
        const prev = view;
        view = v;
        const key = v.seed + ':' + v.level;
        if (key !== worldKey) {
          worldKey = key; world = makeWorld(v.seed, v.level); localStart = null; resetMe();
          for (const id in others) delete others[id];
        }
        if (v.phase === 'playing') {
          const est = performance.now() - v.elapsed;
          if (localStart === null || Math.abs(est - localStart) > 400) localStart = est;
        }
        if (prev && prev.phase !== 'playing' && v.phase === 'playing') resetMe();
        renderHud(); renderOverlay();
      }
      return {
        update,
        unmount() {
          cancelAnimationFrame(raf); clearInterval(cdTimer);
          window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
          api.socket.off('game:stream', onStream);
        },
      };
    },
  };
})();
