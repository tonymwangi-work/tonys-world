'use strict';
(() => {
  const { esc, h, $, $$ } = TW;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const M = n => 'M$' + Number(n).toLocaleString();
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const die = n => `<div class="ty-die">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n] && PIPS[n].includes(i + 1) ? 'on' : ''}"></i>`).join('')}</div>`;
  let BOARD = null;
  const boardReady = fetch('/api/tycoon-board').then(r => r.json()).then(b => { BOARD = b; });

  // grid position of each space on an 11×11 board (Start bottom-right, going clockwise via Jail bottom-left)
  function cell(i) {
    if (i <= 10) return { r: 11, c: 11 - i, side: i % 10 ? 'bottom' : 'corner' };
    if (i <= 20) return { r: 11 - (i - 10), c: 1, side: i === 20 ? 'corner' : 'left' };
    if (i <= 30) return { r: 1, c: 1 + (i - 20), side: i === 30 ? 'corner' : 'top' };
    return { r: 1 + (i - 30), c: 11, side: 'right' };
  }

  TW.games.tycoon = {
    create(root, api) {
      root.innerHTML = `<div class="ty">
        <div class="ty-board-wrap"><div class="ty-board" id="ty-board"><div class="ty-loading">Loading board…</div></div></div>
        <div class="ty-side">
          <div class="ty-turn" id="ty-turn"></div>
          <div class="ty-actions" id="ty-actions"></div>
          <div class="ty-offers" id="ty-offers"></div>
          <div class="ty-tools"><button class="btn btn-secondary btn-sm" data-ty="manage">🏘️ My properties</button><button class="btn btn-secondary btn-sm" data-ty="trade">🤝 Trade</button></div>
          <div class="ty-players" id="ty-players"></div>
          <div class="ty-log" id="ty-log"></div>
        </div>
        <div class="ty-layer" id="ty-layer"></div>
      </div>`;
      let v = null, built = false, lastSeq = null, lastCard = null, animating = false;
      const queue = [];
      const shown = {};
      let manageModal = null, rolling = false;

      const me = () => api.me;
      const pl = id => (v && v.players.find(p => p.id === id)) || {};
      const rp = id => api.player(id) || {};
      const pName = id => rp(id).name || pl(id).name || '?';
      const pColor = id => rp(id).color || '#888';
      const pAv = id => rp(id).avatar || '🙂';
      const SPC = i => BOARD.spaces[i];
      const grp = g => BOARD.groups[g];
      const isMe = id => id === me();
      const act = a => api.act(a);

      // ── board
      function buildBoard() {
        const st = BOARD.settings;
        const el = $('#ty-board', root);
        el.style.setProperty('--line', st.lineColor);
        el.style.setProperty('--ink', st.textColor);
        el.style.fontFamily = st.spaceFont;
        el.innerHTML = BOARD.spaces.map(sp => {
          const c = cell(sp.i);
          const g = sp.group && grp(sp.group);
          const bg = sp.bg || st.typeBg[sp.type] || '#fff';
          const isCorner = c.side === 'corner';
          return `<div class="tys tys-${sp.type} side-${c.side} ${isCorner && st.tiltCorners ? 'tilt' : ''}" id="tys-${sp.i}" data-space="${sp.i}" style="grid-row:${c.r};grid-column:${c.c};--bg:${bg};${g ? `--gc:${g.color};` : ''}">
            ${g ? '<div class="tys-strip"></div>' : ''}
            <div class="tys-body">
              ${sp.icon ? `<span class="tys-icon">${sp.icon}</span>` : ''}
              <span class="tys-name">${esc(sp.name)}</span>
              ${sp.price && sp.type !== 'tax' ? `<span class="tys-price">${st.currency}${sp.price}</span>` : sp.note ? `<span class="tys-note">${esc(sp.note)}${sp.type === 'tax' && sp.price ? ' ' + st.currency + sp.price : ''}</span>` : ''}
            </div>
            <div class="tys-houses"></div>
            <div class="tys-tokens"></div>
          </div>`;
        }).join('') + `<div class="ty-center" style="--ct:${st.centerTop};--cb:${st.centerBottom}">
            ${st.showBanner ? `<div class="ty-banner" style="--bc:${st.bannerColor};--tilt:${st.bannerTilt}deg"><b style="color:${st.titleColor}">${esc(st.title)}</b><span style="color:${st.subtitleColor}">${esc(st.subtitle)}</span></div>` : ''}
            <div class="ty-tagline">${esc(st.tagline)}</div>
            <div class="ty-center-row">
              ${st.showDecks ? '<div class="ty-deck chance" title="Chance">❓<small>Chance</small></div>' : ''}
              ${st.showDice ? '<div class="ty-dice" id="ty-dice"></div>' : ''}
              ${st.showDecks ? '<div class="ty-deck chest" title="Community Chest">🧰<small>Community<br>Chest</small></div>' : ''}
            </div>
            <div class="ty-pot" id="ty-pot"></div>
          </div>`;
        built = true;
      }

      function renderOwnership() {
        for (const [i, o] of Object.entries(v.own)) {
          const el = $('#tys-' + i, root);
          if (!el) continue;
          el.classList.toggle('owned', !!o.owner);
          el.classList.toggle('mortgaged', o.mortgaged);
          el.style.setProperty('--oc', o.owner ? pColor(o.owner) : 'transparent');
          el.title = o.owner ? `${SPC(i).name}: owned by ${pName(o.owner)}${o.mortgaged ? ' (mortgaged)' : ''}` : SPC(i).name;
          $('.tys-houses', el).innerHTML = o.houses === 5 ? '<i class="hotel"></i>' : '<i class="house"></i>'.repeat(o.houses);
        }
      }
      function renderTokens() {
        $$('.tys-tokens', root).forEach(t => { t.innerHTML = ''; });
        for (const p of v.players) {
          if (p.out) continue;
          const pos = shown[p.id] ?? p.pos;
          const box = $(`#tys-${pos} .tys-tokens`, root);
          if (!box) continue;
          box.insertAdjacentHTML('beforeend', `<span class="ty-token ${p.id === v.turnId ? 'turn' : ''} ${p.jail && pos === 10 ? 'jailed' : ''}" style="--pc:${pColor(p.id)}" title="${esc(pName(p.id))}">${esc(pAv(p.id))}</span>`);
        }
      }
      function renderDice(d, spin) {
        const el = $('#ty-dice', root);
        if (el) { el.innerHTML = die(d[0]) + die(d[1]); el.classList.toggle('rolling', !!spin); }
      }

      // events: dice, movement, sets, rent… played in order
      async function runQueue() {
        if (animating) return;
        animating = true;
        while (queue.length) {
          const e = queue.shift();
          if (e.type === 'dice') {
            for (let k = 0; k < 5; k++) { renderDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)], true); await sleep(70); }
            renderDice(e.dice, false);
          } else if (e.type === 'move') {
            for (const sq of e.path) { shown[e.player] = sq; renderTokens(); await sleep(150); }
          } else if (e.type === 'jump') {
            await sleep(250); shown[e.player] = e.to; renderTokens(); await sleep(300);
          } else if (e.type === 'set') {
            celebrate(e);
            await sleep(600);
          } else if (e.type === 'rent') {
            if (isMe(e.player)) TW.toast(`💸 You paid ${pName(e.to)} ${M(e.amount)} rent`, 'error', 2500);
            else if (isMe(e.to)) TW.toast(`💰 ${pName(e.player)} paid you ${M(e.amount)} rent`, 'ok', 2500);
          } else if (e.type === 'pot') {
            TW.toast(`🏖️ ${isMe(e.player) ? 'You' : pName(e.player)} collected the Vacation pot: ${M(e.amount)}!`, 'ok', 3500);
          } else if (e.type === 'trade' && (isMe(e.from) || isMe(e.to))) TW.toast('🤝 Trade complete!', 'ok');
        }
        animating = false;
        for (const p of v.players) shown[p.id] = p.pos;
        renderTokens();
        renderSide(); // re-enable buttons that were waiting for the animation
      }

      function celebrate(e) {
        const g = grp(e.group);
        g.members.forEach(i => { const el = $('#tys-' + i, root); if (el) { el.classList.remove('celebrate'); void el.offsetWidth; el.classList.add('celebrate'); } });
        const banner = h(`<div class="ty-celebrate" style="--gc:${g.color}"><span class="ty-cel-emoji">🎉</span><div><b>${isMe(e.player) ? 'You' : esc(pName(e.player))} completed the</b><span>${esc(g.name)} set!</span></div><span class="ty-cel-emoji">🏆</span></div>`);
        $('#ty-layer', root).appendChild(banner);
        if (isMe(e.player)) TW.confetti(90);
        setTimeout(() => banner.remove(), 3600);
      }

      // ── side panel
      function renderSide() {
        const cp = v.turnId, mine = isMe(cp);
        const turn = $('#ty-turn', root);
        turn.className = 'ty-turn' + (mine && v.phase !== 'over' ? ' mine' : '');
        turn.innerHTML = v.phase === 'over' ? `🏆 ${v.winner ? (isMe(v.winner) ? 'You win!' : esc(pName(v.winner)) + ' wins!') : 'Game over'}`
          : mine ? `✨ Your turn${v.again && v.phase === 'roll' ? ': doubles, roll again!' : ''}` : `${esc(pAv(cp))} ${esc(pName(cp))}'s turn`;

        const meP = pl(me());
        const A = [];
        if (v.phase === 'debt' && v.debt) {
          if (isMe(v.debt.who)) {
            A.push(`<div class="ty-alert">⚠️ You owe <b>${M(v.debt.amount)}</b> (${esc(v.debt.reason)}). You have ${M(meP.cash)}.<br>Sell buildings${v.opts.mortgage ? ' or mortgage properties' : ''} to raise money.</div>`);
            A.push(`<button class="btn btn-primary" data-ty="payDebt" ${meP.cash >= v.debt.amount ? '' : 'disabled'}>Pay ${M(v.debt.amount)}</button>`);
            A.push('<button class="btn btn-secondary" data-ty="manage">🏘️ Sell / mortgage</button>');
            A.push('<button class="btn btn-danger btn-sm" data-ty="bankrupt">💀 Declare bankruptcy</button>');
          } else A.push(`<div class="ty-wait">⏳ ${esc(pName(v.debt.who))} owes ${M(v.debt.amount)} and is raising money…</div>`);
        } else if (mine && v.phase === 'roll') {
          if (meP.jail) {
            A.push(`<div class="ty-alert">⛓️ You're in jail (attempt ${meP.jailTurns + 1}/3)</div>`);
            A.push(`<button class="btn btn-secondary" data-ty="payJail" ${meP.cash >= 50 ? '' : 'disabled'}>Pay M$50 & go</button>`);
            if (meP.jailCards) A.push(`<button class="btn btn-secondary" data-ty="useCard">🎫 Use Get Out of Jail Free (${meP.jailCards})</button>`);
            A.push('<button class="btn btn-primary pulse" data-ty="roll">🎲 Roll for doubles</button>');
          } else A.push(`<button class="btn btn-primary btn-big pulse" data-ty="roll" ${rolling || animating ? 'disabled' : ''}>🎲 ${v.again ? 'Roll again' : 'Roll dice'}</button>`);
        } else if (mine && v.phase === 'buy' && v.pendingBuy !== null) {
          const sp = SPC(v.pendingBuy);
          A.push(propCard(sp));
          A.push(`<button class="btn btn-primary" data-ty="buy" ${meP.cash >= sp.price ? '' : 'disabled'}>Buy for ${M(sp.price)}</button>`);
          A.push(`<button class="btn btn-ghost" data-ty="decline">${v.opts.auctions ? '🔨 Auction it' : "Don't buy"}</button>`);
        } else if (mine && v.phase === 'end') {
          if (v.buildable.length) A.push(`<div class="ty-hint">🏗️ You can build on ${v.buildable.length} propert${v.buildable.length > 1 ? 'ies' : 'y'}. Open My properties.</div>`);
          A.push('<button class="btn btn-primary btn-big" data-ty="endTurn">End turn ➜</button>');
        } else if (v.phase === 'auction') A.push('<div class="ty-wait">🔨 Auction in progress</div>');
        else if (v.phase === 'gamble') A.push('<div class="ty-wait">🎰 GAMBLING TIME!!!!</div>');
        else if (v.phase !== 'over') A.push(`<div class="ty-wait">⏳ Waiting for ${esc(pName(cp))}…</div>`);
        $('#ty-actions', root).innerHTML = A.join('');

        // trade offers involving me
        const offers = v.trades.map(t => {
          const incoming = isMe(t.to);
          return `<div class="ty-offer ${incoming ? 'in' : 'out'}">
            <div class="ty-offer-head">${incoming ? `📨 <b>${esc(pName(t.from))}</b> offers you a trade` : `📤 Your offer to <b>${esc(pName(t.to))}</b>`}</div>
            <div class="ty-offer-body"><div><small>${incoming ? 'You get' : 'You give'}</small>${sideHTML(t.give)}</div><div class="ty-offer-x">⇄</div><div><small>${incoming ? 'You give' : 'You get'}</small>${sideHTML(t.get)}</div></div>
            ${incoming ? `<div class="ty-offer-btns"><button class="btn btn-primary btn-sm" data-accept="${t.id}">✅ Accept</button><button class="btn btn-ghost btn-sm" data-decline="${t.id}">Decline</button></div>`
              : `<div class="ty-offer-btns"><span class="muted small">Waiting for an answer…</span><button class="btn btn-ghost btn-sm" data-cancel="${t.id}">Cancel</button></div>`}
          </div>`;
        }).join('');
        $('#ty-offers', root).innerHTML = offers;

        $('#ty-players', root).innerHTML = v.players.map(p => {
          const sets = Object.values(BOARD.groups).filter(g => g.members.every(i => v.own[i].owner === p.id));
          return `<div class="ty-pl ${p.id === cp ? 'turn' : ''} ${p.out ? 'out' : ''}" style="--pc:${pColor(p.id)}" data-player="${p.id}">
            <span class="p-av">${esc(pAv(p.id))}</span>
            <div class="ty-pl-main"><b>${esc(pName(p.id))}${isMe(p.id) ? ' (you)' : ''}</b>
              <small>${p.out ? '💀 Bankrupt' : `${p.props} propert${p.props === 1 ? 'y' : 'ies'}${p.jail ? ' · ⛓️ in jail' : ''}${p.skip ? ' · 🏖️ on vacation' : ''}${p.jailCards ? ` · 🎫${p.jailCards}` : ''}`}</small>
              ${sets.length ? `<span class="ty-sets">${sets.map(g => `<i style="background:${g.color}" title="${esc(g.name)} set"></i>`).join('')}</span>` : ''}
            </div>
            <span class="ty-cash">${p.out ? '' : M(p.cash)}</span>
          </div>`;
        }).join('');
        $('#ty-log', root).innerHTML = v.log.slice().reverse().map(l => `<div>${esc(l.text)}</div>`).join('');
        const pot = $('#ty-pot', root);
        if (pot) pot.innerHTML = `${v.opts.vacationCash ? `🏖️ Vacation pot: <b>${M(v.pot)}</b> · ` : ''}🏠 ${v.bankHouses} · 🏨 ${v.bankHotels} left`;
      }
      const sideHTML = side => {
        const parts = [];
        if (side.cash) parts.push(`<span class="ty-chip">💵 ${M(side.cash)}</span>`);
        side.props.forEach(i => parts.push(`<span class="ty-chip" style="--gc:${SPC(i).group ? grp(SPC(i).group).color : '#888'}"><i></i>${esc(SPC(i).name)}${v.own[i] && v.own[i].mortgaged ? ' (M)' : ''}</span>`));
        if (side.cards) parts.push(`<span class="ty-chip">🎫 ×${side.cards}</span>`);
        return parts.join('') || '<span class="muted small">nothing</span>';
      };
      function propCard(sp) {
        const g = sp.group && grp(sp.group);
        let rows = '';
        if (sp.type === 'property') rows = `<tr><td>Rent</td><td>${M(sp.rents[0])}</td></tr><tr><td>Full set</td><td>${M(sp.rents[0] * 2)}</td></tr>${[1, 2, 3, 4].map(k => `<tr><td>${k} house${k > 1 ? 's' : ''}</td><td>${M(sp.rents[k])}</td></tr>`).join('')}<tr><td>Hotel</td><td>${M(sp.rents[5])}</td></tr><tr class="muted"><td>Each house</td><td>${M(sp.houseCost)}</td></tr>`;
        else if (sp.type === 'station') rows = [1, 2, 3, 4].map(k => `<tr><td>${k} station${k > 1 ? 's' : ''}</td><td>${M(25 * 2 ** (k - 1))}</td></tr>`).join('');
        else rows = '<tr><td colspan="2">Rent is 4× the dice roll if you own one utility, 10× if you own both.</td></tr>';
        return `<div class="ty-card-prop"><div class="ty-cp-head" style="background:${g ? g.color : sp.type === 'station' ? '#3b3b6d' : '#c98a00'}">${sp.icon || ''} ${esc(sp.name)}</div>
          <table>${rows}<tr class="muted"><td>Mortgage value</td><td>${M(sp.price / 2)}</td></tr></table></div>`;
      }

      // ── overlays: auction, gamble, game over
      function renderOverlays() {
        const layer = $('#ty-layer', root);
        // auction
        let au = $('.ty-auction', layer);
        if (v.phase === 'auction' && v.auction) {
          const a = v.auction, sp = SPC(a.space), out = pl(me()).out || !v.players.some(p => p.id === me());
          const passed = a.passed.includes(me());
          if (!au) { au = h('<div class="ty-auction"></div>'); layer.appendChild(au); }
          const key = a.bid + ':' + a.bidder + ':' + passed + ':' + a.endsAt;
          if (au.dataset.key !== key) {
            au.dataset.key = key;
            au.innerHTML = `<div class="ty-au-title">🔨 Auction: <b>${esc(sp.name)}</b> <span class="muted">(worth ${M(sp.price)})</span></div>
              <div class="ty-au-bid">${a.bidder ? `${esc(pAv(a.bidder))} ${esc(pName(a.bidder))}: <b>${M(a.bid)}</b>` : 'No bids yet'}</div>
              <div class="ty-au-timer"><i style="animation-duration:${a.remaining}ms"></i></div>
              ${out ? '' : passed ? '<div class="muted">You passed</div>' : `<div class="ty-au-btns">${[10, 50, 100].map(k => (Math.floor(a.bid / 10) * 10) + k).map(n => `<button class="btn btn-secondary btn-sm" data-bid="${n}" ${n > pl(me()).cash ? 'disabled' : ''}>${M(n)}</button>`).join('')}
                ${a.bidder === me() ? '' : '<button class="btn btn-ghost btn-sm" data-ty="pass">Pass</button>'}</div>`}`;
          }
        } else if (au) au.remove();

        // gamble
        let gb = $('.ty-gamble', layer);
        if (v.phase === 'gamble' && v.gamble) {
          const g = v.gamble;
          if (!gb) { gb = h('<div class="ty-gamble"><div class="ty-gb-card"></div></div>'); layer.appendChild(gb); }
          const key = JSON.stringify([g.stage, g.target, g.choice, g.g, g.t, g.result]);
          if (gb.dataset.key !== key) {
            gb.dataset.key = key;
            const iG = isMe(g.gambler), iT = isMe(g.target);
            let body = '';
            if (g.stage === 'target') {
              body = iG ? `<p>Pick a player to gamble against:</p><div class="ty-gb-targets">${v.players.filter(p => !p.out && p.id !== me()).map(p => `<button class="btn btn-secondary" data-gtarget="${p.id}">${esc(pAv(p.id))} ${esc(pName(p.id))}<small>${M(p.cash)} · ${p.props} props</small></button>`).join('')}</div>`
                : `<p>${esc(pName(g.gambler))} is choosing who to gamble against… 😬</p>`;
            } else if (g.stage === 'choice') {
              body = `<p><b>${esc(pName(g.gambler))}</b> vs <b>${esc(pName(g.target))}</b></p>` + (iG ? `<p>Will your roll be HIGHER or LOWER than ${esc(pName(g.target))}'s?</p><div class="ty-gb-choice"><button class="hl-btn up" data-gchoice="higher">▲ HIGHER</button><button class="hl-btn down" data-gchoice="lower">▼ LOWER</button></div>` : `<p>${esc(pName(g.gambler))} is deciding: higher or lower…</p>`);
            } else {
              const rollBtn = (who, mineTurn) => mineTurn ? `<button class="btn btn-primary pulse" data-ty="gambleRoll">🎲 Roll!</button>` : `<span class="muted">${esc(pName(who))} rolls…</span>`;
              body = `<p><b>${esc(pName(g.gambler))}</b> bets <b class="ty-gb-bet">${g.choice.toUpperCase()}</b> than <b>${esc(pName(g.target))}</b></p>
                <div class="ty-gb-duel">
                  <div><small>${esc(pName(g.gambler))}</small>${g.g ? `<div class="ty-gb-dice">${die(g.g[0])}${die(g.g[1])}</div><b>${g.g[0] + g.g[1]}</b>` : rollBtn(g.gambler, iG && g.stage === 'groll')}</div>
                  <div class="ty-gb-vs">VS</div>
                  <div><small>${esc(pName(g.target))}</small>${g.t ? `<div class="ty-gb-dice">${die(g.t[0])}${die(g.t[1])}</div><b>${g.t[0] + g.t[1]}</b>` : g.stage === 'troll' ? rollBtn(g.target, iT) : '<span class="muted">waits…</span>'}</div>
                </div>
                ${g.lastTie && g.stage === 'groll' ? '<p class="ty-gb-tie">It was a tie! Roll again.</p>' : ''}`;
              if (g.stage === 'done') {
                const win = g.result === 'win';
                body += `<div class="ty-gb-result ${win ? 'win' : 'lose'}">${win
                  ? `💰 ${esc(pName(g.gambler))} WINS! Takes ${M(g.won.cash)}${g.won.props.length ? ' + ' + g.won.props.map(i => esc(SPC(i).name)).join(' & ') : ''}`
                  : `💀 ${esc(pName(g.gambler))} LOSES EVERYTHING to ${esc(pName(g.target))}: ${M(g.won.cash)} + ${g.won.props.length} properties`}</div>
                  ${iG ? '<button class="btn btn-primary" data-ty="gambleContinue">Continue</button>' : ''}`;
                if ((win && iG) || (!win && iT)) TW.confetti(120);
              }
            }
            $('.ty-gb-card', gb).innerHTML = `<div class="ty-gb-title">🎰 GAMBLING TIME!!!! 🎰</div>${body}`;
          }
        } else if (gb) gb.remove();

        // game over
        let ov = $('.ty-over', layer);
        if (v.phase === 'over' && !ov) {
          const ranked = [...v.players].sort((a, b) => (a.out - b.out) || b.worth - a.worth);
          if (isMe(v.winner)) TW.confetti();
          layer.appendChild(h(`<div class="overlay ty-over"><div class="overlay-card"><div class="big-emoji">🏆</div>
            <h2>${v.winner ? (isMe(v.winner) ? 'You own Nairobi!' : esc(pName(v.winner)) + ' wins!') : 'Game over'}</h2>
            <ol class="score-list">${ranked.map(p => `<li><span>${esc(pAv(p.id))} ${esc(pName(p.id))}</span><span>${p.out ? '💀' : M(p.worth)}</span></li>`).join('')}</ol>
            <p class="muted">${api.isHost ? 'Hit “Play again” up top for a rematch.' : 'Waiting for the host…'}</p></div></div>`));
        } else if (v.phase !== 'over' && ov) ov.remove();
      }

      function showCard(c) {
        const el = h(`<div class="ty-cardpop ${c.deck} ${c.special ? 'special' : ''}"><div class="ty-cardpop-inner"><small>${c.deck === 'chance' ? '❓ Chance' : '🧰 Community Chest'} · ${esc(pName(c.by))}</small><p>${esc(c.text)}</p></div></div>`);
        $('#ty-layer', root).appendChild(el);
        el.addEventListener('click', () => el.remove());
        setTimeout(() => el.remove(), c.special ? 6000 : 4200);
      }

      // ── property manager
      function manageHTML() {
        const mine = Object.keys(v.own).map(Number).filter(i => v.own[i].owner === me());
        if (!mine.length) return '<h2>🏘️ My properties</h2><p class="muted">You don\'t own anything yet.</p>';
        const byGroup = {};
        mine.forEach(i => { const sp = SPC(i); const k = sp.group || sp.type; (byGroup[k] = byGroup[k] || []).push(i); });
        const myTurn = v.turnId === me() && ['roll', 'end'].includes(v.phase);
        return `<h2>🏘️ My properties</h2><p class="muted small">You have ${M(pl(me()).cash)}. ${myTurn ? 'Build on complete sets during your turn.' : 'You can build during your turn.'}</p>
          <div class="ty-manage">${Object.entries(byGroup).map(([k, list]) => {
            const g = grp(k);
            const full = g && g.members.every(i => v.own[i].owner === me());
            return `<div class="ty-mg-group"><div class="ty-mg-head" style="--gc:${g ? g.color : '#666'}">${g ? esc(g.name) + (full ? ' ✅ full set' : ` (${list.length}/${g.members.length})`) : k === 'station' ? '🚂 Stations' : '⚡ Utilities'}</div>
              ${list.map(i => {
                const sp = SPC(i), o = v.own[i];
                const canBuild = v.buildable.includes(i) && myTurn;
                return `<div class="ty-mg-row ${o.mortgaged ? 'mortgaged' : ''}">
                  <span class="ty-mg-name">${esc(sp.name)} ${o.houses === 5 ? '🏨' : '🏠'.repeat(o.houses)}${o.mortgaged ? ' <em>mortgaged</em>' : ''}</span>
                  <span class="ty-mg-btns">
                    ${sp.type === 'property' ? `<button data-mg="build" data-i="${i}" ${canBuild ? '' : 'disabled'} title="Build (${M(sp.houseCost)})">+🏠 ${M(sp.houseCost)}</button><button data-mg="sell" data-i="${i}" ${o.houses ? '' : 'disabled'} title="Sell for ${M(sp.houseCost / 2)}">−🏠</button>` : ''}
                    ${v.opts.mortgage ? (o.mortgaged ? `<button data-mg="unmortgage" data-i="${i}">Unmortgage ${M(Math.ceil(sp.price / 2 * 1.1))}</button>` : `<button data-mg="mortgage" data-i="${i}" ${o.houses ? 'disabled' : ''}>Mortgage +${M(sp.price / 2)}</button>`) : ''}
                  </span></div>`;
              }).join('')}</div>`;
          }).join('')}</div>`;
      }
      function openManage() {
        if (manageModal) return;
        manageModal = TW.modal(`<div class="ty-modal">${manageHTML()}</div>`, { onClose: () => { manageModal = null; } });
        manageModal.el.classList.add('ty-modal-wide');
        manageModal.el.addEventListener('click', e => {
          const b = e.target.closest('[data-mg]');
          if (b) act({ type: b.dataset.mg, space: Number(b.dataset.i) });
        });
      }

      // ── trade composer
      function openTrade(target) {
        const others = v.players.filter(p => !p.out && p.id !== me());
        if (!others.length) return TW.toast('Nobody to trade with');
        let to = target || others[0].id;
        const sel = { give: new Set(), get: new Set() };
        const m = TW.modal('<div class="ty-modal ty-trade"></div>', {});
        m.el.classList.add('ty-modal-wide');
        const tradeable = who => Object.keys(v.own).map(Number).filter(i => v.own[i].owner === who);
        const blocked = i => { const sp = SPC(i); return sp.type === 'property' && grp(sp.group).members.some(k => v.own[k].houses > 0); };
        const list = (who, key) => tradeable(who).map(i => {
          const sp = SPC(i);
          return `<label class="ty-tr-prop ${blocked(i) ? 'blocked' : ''}" style="--gc:${sp.group ? grp(sp.group).color : '#777'}"><input type="checkbox" data-side="${key}" value="${i}" ${sel[key].has(i) ? 'checked' : ''} ${blocked(i) ? 'disabled' : ''}><i></i>${esc(sp.name)}${v.own[i].mortgaged ? ' (M)' : ''}${blocked(i) ? ' 🏠' : ''}</label>`;
        }).join('') || '<p class="muted small">No properties</p>';
        const draw = () => {
          const mineP = pl(me()), them = pl(to);
          $('.ty-trade', m.el).innerHTML = `<h2>🤝 Make a trade</h2>
            <div class="ty-tr-who">${others.map(p => `<button class="btn btn-sm ${p.id === to ? 'btn-primary' : 'btn-ghost'}" data-to="${p.id}">${esc(pAv(p.id))} ${esc(pName(p.id))}</button>`).join('')}</div>
            <div class="ty-tr-cols">
              <div><h4>You give</h4>${list(me(), 'give')}
                <label class="ty-tr-cash">💵 Cash <input class="input" type="number" min="0" max="${mineP.cash}" step="10" id="tr-give-cash" placeholder="0"></label>
                ${mineP.jailCards ? `<label class="ty-tr-cash">🎫 Jail cards <input class="input" type="number" min="0" max="${mineP.jailCards}" id="tr-give-cards" placeholder="0"></label>` : ''}</div>
              <div><h4>${esc(pName(to))} gives</h4>${list(to, 'get')}
                <label class="ty-tr-cash">💵 Cash <input class="input" type="number" min="0" max="${them.cash}" step="10" id="tr-get-cash" placeholder="0"></label>
                ${them.jailCards ? `<label class="ty-tr-cash">🎫 Jail cards <input class="input" type="number" min="0" max="${them.jailCards}" id="tr-get-cards" placeholder="0"></label>` : ''}</div>
            </div>
            <p class="muted small">Properties with buildings in their set (🏠) can't be traded until the buildings are sold. Mortgaged properties (M) stay mortgaged.</p>
            <button class="btn btn-primary btn-big" id="tr-send">📨 Send offer to ${esc(pName(to))}</button>`;
        };
        draw();
        m.el.addEventListener('click', async e => {
          const t = e.target.closest('[data-to]');
          if (t) { to = t.dataset.to; sel.get.clear(); draw(); return; }
          if (e.target.closest('#tr-send')) {
            const num = id => { const el = $('#' + id, m.el); return el ? Number(el.value) || 0 : 0; };
            const r = await act({ type: 'propose', to, give: { props: [...sel.give], cash: num('tr-give-cash'), cards: num('tr-give-cards') }, get: { props: [...sel.get], cash: num('tr-get-cash'), cards: num('tr-get-cards') } });
            if (r.ok) { TW.toast('Offer sent 📨', 'ok'); m.close(); }
          }
        });
        m.el.addEventListener('change', e => {
          const c = e.target.closest('[data-side]');
          if (c) { const s2 = sel[c.dataset.side]; const i = Number(c.value); if (c.checked) s2.add(i); else s2.delete(i); }
        });
      }

      function spaceInfo(i) {
        const sp = SPC(i), o = v.own[i];
        const extra = o ? `<p>${o.owner ? `Owner: <b>${esc(pName(o.owner))}</b>${o.houses ? ` · ${o.houses === 5 ? 'hotel' : o.houses + ' house(s)'}` : ''}${o.mortgaged ? ' · <em>mortgaged</em>' : ''}` : `For sale: <b>${M(sp.price)}</b>`}</p>` : '';
        const here = v.players.filter(p => !p.out && p.pos === i).map(p => esc(pName(p.id))).join(', ');
        const body = o ? propCard(sp) : `<div class="ty-card-prop"><div class="ty-cp-head" style="background:#555">${sp.icon || ''} ${esc(sp.name)}</div><p style="padding:10px">${esc(sp.note || ({ chance: 'Draw a Chance card.', chest: 'Draw a Community Chest card.' })[sp.type] || '')}${i === 20 && v.opts.vacationCash ? `<br>Pot: <b>${M(v.pot)}</b>. Land here to collect it, then skip your next turn.` : i === 20 ? '<br>Land here and skip your next turn.' : ''}</p></div>`;
        TW.modal(`<div class="ty-modal">${body}${extra}${here ? `<p class="muted small">Here: ${here}</p>` : ''}${o && o.owner && o.owner !== me() && !pl(me()).out ? `<button class="btn btn-secondary" data-trade-for="${o.owner}">🤝 Trade with ${esc(pName(o.owner))}</button>` : ''}</div>`).el.addEventListener('click', e => {
          const b = e.target.closest('[data-trade-for]');
          if (b) { b.closest('.modal-back').remove(); openTrade(b.dataset.tradeFor); }
        });
      }

      // ── clicks
      root.addEventListener('click', async e => {
        const t = e.target.closest('[data-ty]');
        if (t) {
          const a = t.dataset.ty;
          if (a === 'manage') return openManage();
          if (a === 'trade') return openTrade();
          if (a === 'bankrupt' && !confirm('Declare bankruptcy? You will be out of the game.')) return;
          if (a === 'roll') { rolling = true; t.disabled = true; await act({ type: 'roll' }); rolling = false; if (!animating) renderSide(); return; }
          return act({ type: a });
        }
        const b = e.target.closest('[data-bid]');
        if (b) return act({ type: 'bid', amount: Number(b.dataset.bid) });
        const ac = e.target.closest('[data-accept]');
        if (ac) return act({ type: 'respond', id: Number(ac.dataset.accept), accept: true });
        const dc = e.target.closest('[data-decline]');
        if (dc) return act({ type: 'respond', id: Number(dc.dataset.decline), accept: false });
        const cc = e.target.closest('[data-cancel]');
        if (cc) return act({ type: 'cancelTrade', id: Number(cc.dataset.cancel) });
        const gt = e.target.closest('[data-gtarget]');
        if (gt) return act({ type: 'gambleTarget', target: gt.dataset.gtarget });
        const gc = e.target.closest('[data-gchoice]');
        if (gc) return act({ type: 'gambleChoice', choice: gc.dataset.gchoice });
        const sp = e.target.closest('[data-space]');
        if (sp && BOARD) return spaceInfo(Number(sp.dataset.space));
        const pr = e.target.closest('[data-player]');
        if (pr && pr.dataset.player !== me() && !pl(me()).out && v.phase !== 'over' && !pl(pr.dataset.player).out) openTrade(pr.dataset.player);
      });

      let pending = null;
      function update(nv) {
        if (!BOARD) { pending = nv; boardReady.then(() => { if (pending) { const x = pending; pending = null; update(x); } }); return; }
        const prevTrades = v ? v.trades.map(t => t.id) : null;
        v = nv;
        if (!built) buildBoard();
        if (lastSeq === null || (v.seq < lastSeq)) { // first view or a new game
          lastSeq = v.seq; queue.length = 0;
          for (const p of v.players) shown[p.id] = p.pos;
          lastCard = v.card ? v.card.seq : null;
          renderDice(v.dice);
          $$('.ty-over, .ty-gamble, .ty-auction', root).forEach(x => x.remove());
        } else {
          const fresh = v.events.filter(e => e.seq > lastSeq);
          lastSeq = v.seq;
          if (fresh.length) { queue.push(...fresh); runQueue(); }
          if (v.card && v.card.seq !== lastCard) { lastCard = v.card.seq; setTimeout(() => showCard(v.card), 500); }
        }
        if (prevTrades) v.trades.filter(t => isMe(t.to) && !prevTrades.includes(t.id)).forEach(t => TW.toast(`📨 ${pName(t.from)} sent you a trade offer`, 'ok', 4000));
        if (!animating) for (const p of v.players) shown[p.id] = p.pos;
        renderOwnership(); renderTokens(); renderSide(); renderOverlays();
        if (manageModal) $('.ty-modal', manageModal.el).innerHTML = manageHTML();
      }
      return { update, unmount() { if (manageModal) manageModal.close(); } };
    },
  };
})();
