'use strict';
(() => {
  const { esc, h, $, $$ } = TW;
  const COLOR_NAMES = { red: 'Cherry', yellow: 'Sunny', green: 'Mint', blue: 'Ocean' };
  const SYMBOL = { skip: '⊘', flip: '⇄', draw2: '+2', wild: '✦', wild4: '+4' };
  const WORD = { skip: 'BLOCK', flip: 'FLIP', draw2: 'DRAW', wild: 'COLOR', wild4: 'COLOR' };

  function cardHTML(c, { cls = '', chosen = null } = {}) {
    if (!c) return '<div class="cc-card cc-empty"></div>';
    const sym = SYMBOL[c.value] || c.value;
    const word = WORD[c.value] || '';
    const color = c.color === 'wild' && chosen ? `wild chosen-${chosen}` : c.color;
    return `<button class="cc-card cc-${color} ${cls}" data-id="${c.id}" aria-label="${esc(c.color + ' ' + c.value)}">
      <span class="cc-corner tl">${sym}</span>
      <span class="cc-face"><span class="cc-sym ${sym.length > 1 ? 'small' : ''}">${sym}</span>${word ? `<span class="cc-word">${word}</span>` : ''}</span>
      <span class="cc-corner br">${sym}</span>
    </button>`;
  }
  const backHTML = (cls = '') => `<div class="cc-card cc-back ${cls}"><span class="cc-back-logo">TW</span></div>`;

  TW.games.colorclash = {
    create(root, api) {
      root.innerHTML = `<div class="cc">
        <div class="cc-opponents" id="cc-opps"></div>
        <div class="cc-table">
          <div class="cc-dir" id="cc-dir">↻</div>
          <div class="cc-pile-wrap"><div class="cc-pile" id="cc-deck" title="Draw a card"></div><div class="cc-pile-label" id="cc-deck-label"></div></div>
          <div class="cc-pile-wrap"><div class="cc-discard" id="cc-discard"></div><div class="cc-pile-label" id="cc-color-label"></div></div>
        </div>
        <div class="cc-status" id="cc-status"></div>
        <div class="cc-controls" id="cc-controls"></div>
        <div class="cc-hand" id="cc-hand"></div>
        <div class="cc-log" id="cc-log"></div>
      </div>`;
      let view = null;
      let lastSeq = 0;
      let busy = false;

      const pickColor = () => new Promise(resolve => {
        const m = TW.modal(`<h2>Change the color to…</h2><div class="color-pick">${Object.entries(COLOR_NAMES).map(([k, n]) => `<button class="cp cp-${k}" data-c="${k}">${n}</button>`).join('')}</div>`, { onClose: () => resolve(null) });
        $$('.cp', m.el).forEach(b => b.onclick = () => { resolve(b.dataset.c); m.close(); });
      });

      async function act(a) {
        if (busy) return;
        busy = true;
        await api.act(a);
        busy = false;
      }

      root.addEventListener('click', async e => {
        if (!view) return;
        const card = e.target.closest('#cc-hand .cc-card');
        if (card) {
          const id = Number(card.dataset.id);
          if (!view.playable.includes(id)) {
            if (view.turnId === api.me && view.pending > 0) TW.toast(`Stack a ${view.top.value === 'draw2' ? '+2 or ' : ''}+4 card, or tap the deck to take ${view.pending}`, 'error');
            else if (view.turnId === api.me) TW.toast(`That doesn't match. Play ${COLOR_NAMES[view.color]} or a ${SYMBOL[view.top.value] || view.top.value}.`, 'error');
            else TW.toast('Wait for your turn ⏳');
            return;
          }
          const c = view.hand.find(x => x.id === id);
          let color;
          if (c.color === 'wild') { color = await pickColor(); if (!color) return; }
          card.classList.add('flying');
          return act({ type: 'play', cardId: id, color });
        }
        if (e.target.closest('#cc-deck')) {
          if (view.turnId !== api.me) return TW.toast('Wait for your turn ⏳');
          if (view.drawnCardId !== null) return TW.toast('Play the card you drew, or pass');
          if (view.pending > 0 && view.playable.length && !confirm(`Take ${view.pending} cards instead of stacking?`)) return;
          return act({ type: 'draw' });
        }
        const b = e.target.closest('[data-cc]');
        if (b) {
          if (b.dataset.cc === 'pass') act({ type: 'pass' });
          if (b.dataset.cc === 'clash') act({ type: 'clash' });
          if (b.dataset.cc === 'catch') act({ type: 'catch', target: b.dataset.target });
        }
      });

      function update(v, room) {
        view = v;
        const me = api.me;
        const pName = id => (api.player(id) || {}).name || (v.players.find(p => p.id === id) || {}).name || '?';
        const pAv = id => (api.player(id) || {}).avatar || '🙂';
        const pColor = id => (api.player(id) || {}).color || '#888';

        // opponents
        const order = v.players.filter(p => p.id !== me);
        $('#cc-opps', root).innerHTML = order.map(p => `<div class="cc-opp ${p.id === v.turnId && v.phase === 'play' ? 'turn' : ''}" style="--pc:${pColor(p.id)}">
          <div class="cc-opp-top"><span class="p-av">${pAv(p.id)}</span><span class="cc-opp-name">${esc(pName(p.id))}</span></div>
          <div class="cc-mini-fan">${Array.from({ length: Math.min(p.count, 12) }, () => '<i></i>').join('')}</div>
          <div class="cc-opp-count">${p.count} card${p.count === 1 ? '' : 's'}</div>
          ${p.count === 1 && p.declared ? '<div class="cc-badge safe">CLASH!</div>' : ''}
          ${p.vulnerable && me && v.players.some(x => x.id === me) ? `<button class="btn btn-danger btn-sm cc-catch" data-cc="catch" data-target="${p.id}">🚨 Catch!</button>` : ''}
        </div>`).join('');

        // table
        const myTurn = v.turnId === me && v.phase === 'play';
        $('#cc-deck', root).innerHTML = backHTML(myTurn && v.drawnCardId === null && (v.pending > 0 || !v.playable.length) ? 'pulse' : '') + (v.pending > 0 ? `<span class="cc-pending">+${v.pending}</span>` : '');
        $('#cc-deck-label', root).textContent = myTurn && v.pending > 0 ? `Tap to take ${v.pending}` : `${v.deckCount} left`;
        const disc = $('#cc-discard', root);
        if (v.lastEvent && v.lastEvent.seq !== lastSeq) {
          const e = v.lastEvent;
          lastSeq = e.seq;
          disc.innerHTML = cardHTML(v.top, { cls: e.type === 'play' ? 'land' : '', chosen: v.top.color === 'wild' ? v.color : null });
          if (e.type === 'caught' && e.player === me) TW.toast('🚨 Caught! You forgot to call Clash! +2 cards', 'error');
          if (e.type === 'clash') flash(`${pName(e.player)}: CLASH!`);
          if (e.type === 'take') flash(`${pName(e.player)} takes ${e.count}! 😵`);
          if (e.type === 'play' && v.pending > 0) flash(`+${v.pending} stacked! 🔥`);
        } else if (!disc.firstElementChild || disc.firstElementChild.dataset.id !== String(v.top.id)) {
          disc.innerHTML = cardHTML(v.top, { chosen: v.top.color === 'wild' ? v.color : null });
        }
        $('#cc-color-label', root).innerHTML = `<span class="cc-dot cc-${v.color}"></span>${COLOR_NAMES[v.color]}`;
        const dir = $('#cc-dir', root);
        dir.textContent = v.dir === 1 ? '↻' : '↺';
        dir.className = `cc-dir cc-dir-${v.color}`;

        // status
        let status;
        if (v.phase === 'over') status = v.winner === me ? '🏆 You win!' : `🏆 ${esc(pName(v.winner))} wins!`;
        else if (!v.hand) status = `👀 Watching — ${esc(pName(v.turnId))}'s turn`;
        else if (myTurn && v.pending > 0) status = v.playable.length ? `🔥 Stack a ${v.top.value === 'draw2' ? '+2 or ' : ''}+4 to pass it on, or take ${v.pending}!` : `😬 No stack card. Tap the deck to take ${v.pending}`;
        else if (myTurn) status = v.drawnCardId !== null ? 'You drew a playable card — play it or pass' : v.playable.length ? '✨ Your turn! Play a matching card' : 'No match — draw a card from the deck';
        else status = `${pAv(v.turnId)} ${esc(pName(v.turnId))} is thinking…`;
        const st = $('#cc-status', root);
        st.innerHTML = status;
        st.classList.toggle('mine', myTurn);

        // controls
        const ctrls = [];
        if (v.hand && v.phase === 'play') {
          if (myTurn && v.drawnCardId !== null) ctrls.push('<button class="btn btn-secondary" data-cc="pass">Keep it & pass ➜</button>');
          const meP = v.players.find(p => p.id === me);
          if (v.clashRule === 'on' && v.hand.length <= 2 && !(meP.declared && !meP.vulnerable)) ctrls.push(`<button class="btn btn-clash ${meP.vulnerable ? 'urgent' : ''}" data-cc="clash">📣 CLASH!</button>`);
          if (v.clashRule === 'on' && meP.declared && v.hand.length <= 2) ctrls.push('<span class="cc-safe">📣 Clash called — you are safe</span>');
        }
        $('#cc-controls', root).innerHTML = ctrls.join('');

        // hand
        const hand = $('#cc-hand', root);
        if (v.hand) {
          const sorted = [...v.hand].sort((a, b) => (a.color > b.color ? 1 : a.color < b.color ? -1 : String(a.value).localeCompare(String(b.value), undefined, { numeric: true })));
          const n = sorted.length;
          hand.style.setProperty('--n', n);
          hand.innerHTML = sorted.map((c, i) => cardHTML(c, {
            cls: `${myTurn && v.playable.includes(c.id) ? 'playable' : myTurn ? 'dim' : ''} ${c.id === v.drawnCardId ? 'drawn' : ''}`,
          }).replace('<button', `<button style="--i:${i}"`)).join('');
          fitHand(hand);
        } else hand.innerHTML = '';

        $('#cc-log', root).innerHTML = v.log.slice(-4).map(l => `<div>${esc(l.text)}</div>`).join('');

        // game over
        if (v.phase === 'over' && !root.querySelector('.cc-over')) {
          if (v.winner === me) TW.confetti();
          const scores = [...v.scores].sort((a, b) => a.cards - b.cards);
          root.querySelector('.cc').appendChild(h(`<div class="overlay cc-over"><div class="overlay-card">
            <div class="big-emoji">🏆</div>
            <h2>${v.winner === me ? 'You win!' : esc(pName(v.winner)) + ' wins!'}</h2>
            <ol class="score-list">${scores.map(s => `<li><span>${pAv(s.id)} ${esc(pName(s.id))}</span><span>${s.id === v.winner ? `🏆 +${s.points} pts` : `${s.cards} card${s.cards === 1 ? '' : 's'} left`}</span></li>`).join('')}</ol>
            <p class="muted">${api.isHost ? 'Use “Play again” at the top to deal a new round.' : 'Waiting for the host to start another round…'}</p>
            <button class="btn btn-ghost btn-sm" onclick="this.closest('.overlay').remove()">Look at the table</button>
          </div></div>`));
        }
        if (v.phase !== 'over') root.querySelector('.cc-over')?.remove();
      }
      // overlap cards so the whole hand fits the screen width
      function fitHand(hand) {
        const cards = hand.children;
        if (!cards.length) return;
        const w = cards[0].offsetWidth;
        const avail = hand.clientWidth - 24;
        const n = cards.length;
        let overlap = n > 1 ? Math.max(0, (n * w - avail) / (n - 1)) : 0;
        overlap = Math.max(overlap, Math.min(10, w * 0.1));
        const tooMany = overlap > w * 0.72;
        if (tooMany) overlap = w * 0.72;
        hand.classList.toggle('scroll', tooMany);
        [...cards].forEach((c, i) => { c.style.marginLeft = i ? `-${overlap}px` : '0'; });
      }
      const onResize = () => { const hand = $('#cc-hand', root); if (hand) fitHand(hand); };
      window.addEventListener('resize', onResize);
      function flash(text) {
        const f = h(`<div class="cc-flash">${esc(text)}</div>`);
        root.querySelector('.cc').appendChild(f);
        setTimeout(() => f.remove(), 1400);
      }
      return { update, unmount() { window.removeEventListener('resize', onResize); } };
    },
  };
})();
