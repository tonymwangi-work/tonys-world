'use strict';
(() => {
  const { esc, h, $ } = TW;

  function fmt(v, cat) {
    const n = v >= 1e9 ? (v / 1e9).toFixed(v >= 1e10 ? 0 : 2).replace(/\.?0+$/, '') + 'B' : v >= 1e6 ? (v / 1e6).toFixed(v >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'M' : Math.round(v).toLocaleString();
    return (cat.money ? '$' : '') + n + (cat.plus ? '+' : '');
  }

  TW.games.hilo = {
    create(root, api) {
      root.innerHTML = `<div class="hl">
        <div class="hl-top" id="hl-top"></div>
        <div class="hl-timer"><i id="hl-bar"></i></div>
        <div class="hl-units" id="hl-units"></div>
        <div class="hl-cards" id="hl-cards"></div>
        <div class="hl-status" id="hl-status"></div>
        <p class="hl-note muted" id="hl-note"></p>
      </div>`;
      let v = null, lastKey = null, busy = false;

      root.addEventListener('click', async e => {
        const b = e.target.closest('[data-guess]');
        if (!b || busy) return;
        busy = true;
        root.querySelectorAll('[data-guess]').forEach(x => { x.disabled = true; });
        b.classList.add('chosen');
        await api.act({ type: 'guess', choice: b.dataset.guess });
        busy = false;
      });

      function countUp(el, target, cat) {
        const t0 = performance.now(), dur = 1300;
        const step = now => {
          const k = Math.min(1, (now - t0) / dur);
          const e = 1 - Math.pow(1 - k, 3);
          el.textContent = fmt(target * e, { ...cat, plus: k === 1 && cat.plus });
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }

      function update(nv) {
        v = nv;
        const cat = v.cat;
        const unitName = id => (v.units.find(u => u.id === id) || {}).name || '?';
        const myU = v.units.find(u => u.id === v.myUnit);
        const myTurn = v.mode === 'turns' ? v.turnUnit === v.myUnit : true;
        const canGuess = v.phase === 'guess' && myU && myTurn && !myU.locked && (v.mode !== 'turns' || myU.lives > 0);

        $('#hl-top', root).innerHTML = `
          <span class="hl-cat" style="--cc:${cat.color}">${cat.emoji} ${esc(cat.label)}</span>
          <span class="hl-round">${v.mode === 'turns' ? `Round ${v.round}` : `Round ${v.round}/${v.maxRounds}`}</span>
          ${v.teams ? `<span class="hl-team">${esc(myU ? myU.name : 'Spectating')}</span>` : ''}`;

        // timer bar restarts each phase
        const key = v.round + ':' + v.phase;
        const bar = $('#hl-bar', root);
        if (key !== lastKey) {
          bar.style.transition = 'none'; bar.style.width = '100%';
          bar.className = v.phase === 'guess' ? '' : 'reveal';
          void bar.offsetWidth;
          bar.style.transition = `width ${v.remaining}ms linear`; bar.style.width = '0%';
        }

        $('#hl-units', root).innerHTML = v.units.map(u => {
          const turn = v.mode === 'turns' && v.turnUnit === u.id && v.phase === 'guess';
          const res = v.last && v.last.results[u.id];
          const pl = !v.teams && api.player(u.id);
          return `<div class="hl-unit ${u.id === v.myUnit ? 'me' : ''} ${turn ? 'turn' : ''} ${v.mode === 'turns' && u.lives <= 0 ? 'out' : ''} ${v.teams ? 'team-' + u.id : ''}" style="--pc:${esc(pl ? pl.color : '#888')}">
            <span class="hl-u-name">${pl ? esc(pl.avatar) + ' ' : ''}${esc(u.name)}</span>
            <b>${u.score}</b>
            ${u.streak >= 2 ? `<span class="hl-streak">🔥${u.streak}</span>` : ''}
            ${v.mode === 'turns' ? `<span class="hl-lives">${'❤️'.repeat(Math.max(0, u.lives))}${'🖤'.repeat(Math.max(0, 3 - u.lives))}</span>` : ''}
            ${v.phase === 'guess' && v.mode === 'together' ? `<span class="hl-lock">${u.locked ? '✅' : '🤔'}</span>` : ''}
            ${res ? `<span class="hl-res ${res.right ? 'ok' : 'bad'}">${res.right ? '✓' : '✗'}</span>` : ''}
          </div>`;
        }).join('');

        // cards: rebuild when the round/phase changes
        if (key !== lastKey) {
          const L = v.left, R = v.right;
          const revealed = v.phase !== 'guess';
          const mine = v.last && v.last.results[v.myUnit];
          $('#hl-cards', root).innerHTML = `
            <div class="hl-card" style="--cc:${cat.color}">
              <div class="hl-emoji">${L.emoji}</div>
              <div class="hl-name">${esc(L.name)}</div>
              <div class="hl-has">has</div>
              <div class="hl-value">${fmt(L.value, cat)}</div>
              <div class="hl-unit-label">${esc(cat.unit)}</div>
            </div>
            <div class="hl-vs">VS</div>
            <div class="hl-card right ${revealed ? (mine ? (mine.right ? 'win' : 'lose') : 'shown') : ''}" style="--cc:${cat.color}">
              <div class="hl-emoji">${R.emoji}</div>
              <div class="hl-name">${esc(R.name)}</div>
              <div class="hl-has">has</div>
              ${revealed
                ? `<div class="hl-value" id="hl-rv">0</div><div class="hl-unit-label">${esc(cat.unit)}</div>
                   <div class="hl-verdict">${v.last.answer === 'higher' ? '▲ HIGHER' : '▼ LOWER'}</div>`
                : `<div class="hl-btns">
                     <button class="hl-btn up" data-guess="higher" ${canGuess ? '' : 'disabled'}>▲ Higher</button>
                     <button class="hl-btn down" data-guess="lower" ${canGuess ? '' : 'disabled'}>▼ Lower</button>
                   </div>
                   <div class="hl-unit-label">${esc(cat.unit)} than ${esc(L.name)}</div>`}
            </div>`;
          if (revealed) {
            countUp($('#hl-rv', root), R.value, cat);
            if (mine && mine.right) setTimeout(() => TW.toast(v.teams ? 'Your team got it! ✅' : 'Correct! ✅', 'ok', 1500), 1300);
          }
          lastKey = key;
        } else if (v.phase === 'guess') {
          root.querySelectorAll('[data-guess]').forEach(b => { b.disabled = !canGuess; if (myU && myU.guess === b.dataset.guess) b.classList.add('chosen'); });
        }

        // status line
        let st = '';
        if (v.phase === 'guess') {
          if (!myU) st = '👀 Watching';
          else if (v.mode === 'turns') st = myTurn ? (myU.lives > 0 ? '✨ Your turn! Higher or lower?' : '') : `⏳ ${esc(unitName(v.turnUnit))} is deciding…`;
          else if (myU.locked) st = v.teams ? `✅ ${esc(myU.lockedBy)} locked in <b>${esc(myU.guess)}</b> for your team. Waiting for the others…` : '✅ Locked in, waiting for the others…';
          else st = v.teams ? '🗣️ Talk it over with your team, then anyone can lock in the answer' : '⚡ Everyone guesses at once. Be quick!';
        } else if (v.phase === 'reveal') st = `${esc(v.right.name)} is <b>${v.last.answer}</b>!`;
        $('#hl-status', root).innerHTML = st;
        $('#hl-note', root).textContent = cat.approx ? 'Numbers are rounded approximations (around 2025) and change all the time.' : cat.plus ? 'Google Play install badges (e.g. "1B+").' : 'All-time worldwide box office gross.';

        // game over
        const over = root.querySelector('.hl-over');
        if (v.phase === 'over' && !over) {
          const ranked = [...v.units].sort((a, b) => b.score - a.score);
          const iWon = v.winner && v.winner === v.myUnit;
          if (iWon) TW.confetti();
          root.querySelector('.hl').appendChild(h(`<div class="overlay hl-over"><div class="overlay-card">
            <div class="big-emoji">${v.winner ? '🏆' : '🤝'}</div>
            <h2>${v.winner ? (iWon ? (v.teams ? 'Your team wins!' : 'You win!') : esc(unitName(v.winner)) + ' wins!') : 'It\'s a draw!'}</h2>
            <ol class="score-list">${ranked.map(u => `<li><span>${esc(u.name)}</span><span>${u.score} pts</span></li>`).join('')}</ol>
            <p class="muted">${api.isHost ? 'Hit “Play again” up top for another go.' : 'Waiting for the host…'}</p>
          </div></div>`));
        }
        if (v.phase !== 'over' && over) over.remove();
      }
      return { update, unmount() {} };
    },
  };
})();
