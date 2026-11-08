'use strict';
(() => {
  const { esc, h, $, $$ } = TW;
  const TYPE_LABEL = { report: 'Official report', document: 'Document', object: 'Physical evidence', photo: 'Photo / footage' };

  TW.games.casefiles = {
    create(root, api) {
      let v = null;
      let tab = 'briefing';
      let openSuspect = null;
      let lastFoundSeq = null;
      let seen = new Set();
      let highlight = null;
      const sel = { culprit: null, weapon: null, motive: null };
      let noteColor = 'yellow';
      let caseKey = null;

      root.innerHTML = `<div class="cf">
        <div class="cf-header" id="cf-header"></div>
        <nav class="cf-tabs" id="cf-tabs"></nav>
        <div class="cf-banner" id="cf-banner" hidden></div>
        <div class="cf-body" id="cf-body"></div>
      </div>
      <div class="cf-setup" id="cf-setup" hidden></div>`;
      let clockTimer = null;
      let deadline = null;

      const pName = id => (api.player(id) || {}).name || (v.players.find(p => p.id === id) || {}).name || '?';
      const isPlayer = () => v.players.some(p => p.id === api.me);
      const locName = id => (v.case.locations.find(l => l.id === id) || { name: 'Case folder' }).name;

      function tabs() {
        const list = [
          ['briefing', '📁 Briefing'], ['scenes', '🔍 Scenes'], ['suspects', '🗣️ Suspects'],
          ['evidence', `🧾 Evidence <span class="cf-count">${v.file ? v.file.found.length : 0}</span>`],
          ['board', '📌 Board'], ['accuse', '⚖️ Accuse'],
        ];
        if (v.phase === 'solved') list.unshift(['verdict', '🏛️ Verdict']);
        const unseen = v.file ? v.file.found.filter(e => !seen.has(e.id)).length : 0;
        $('#cf-tabs', root).innerHTML = list.map(([id, label]) => `<button class="cf-tab ${tab === id ? 'on' : ''}" data-tab="${id}">${label}${id === 'evidence' && unseen && tab !== 'evidence' ? '<i class="dot"></i>' : ''}</button>`).join('');
      }

      function header() {
        const c = v.case;
        const raceInfo = v.mode === 'race' ? v.players.map(p => `<span class="cf-racer ${v.accused.includes(p.id) ? 'out' : ''}">${esc((api.player(p.id) || {}).avatar || '🕵️')} ${esc(pName(p.id))}: ${p.found} clues</span>`).join('') : '';
        $('#cf-header', root).innerHTML = `
          <div class="cf-title"><span class="cf-emoji">${c.emoji}</span><div><h2>${esc(c.title)}</h2><p>${esc(c.tagline)}</p></div></div>
          <div class="cf-stats">
            <span class="cf-chip">${v.mode === 'coop' ? '🤝 Co-op' : '🏁 Race'}</span>
            <span class="cf-chip">⭐ ${esc(c.difficulty)}</span>
            <span class="cf-chip" title="Moves used. Par: ${c.par}">⏱️ ${v.file ? v.file.actions : 0} moves <small>(par ${c.par})</small></span>
            <span class="cf-chip">🧾 ${v.file ? v.file.found.length : 0}/${v.totalEvidence}</span>
            ${v.timeLeft !== null ? '<span class="cf-chip cf-clock-chip" id="cf-clock"></span>' : ''}
          </div>
          ${raceInfo ? `<div class="cf-race">${raceInfo}</div>` : ''}`;
      }

      function docHTML(e) {
        return `<article class="cf-doc type-${e.type} ${highlight === e.id ? 'flash' : ''} ${seen.has(e.id) ? '' : 'new'}" id="ev-${e.id}">
          <header><span class="cf-doc-emoji">${e.emoji}</span><div><h4>${esc(e.name)}</h4><small>${TYPE_LABEL[e.type] || ''} · ${esc(locName(e.location))}</small></div></header>
          <div class="cf-doc-text">${esc(e.text)}</div>
        </article>`;
      }

      const views = {
        briefing() {
          const c = v.case;
          return `<div class="cf-brief">
            <div class="cf-paper">
              <div class="cf-stamp">CONFIDENTIAL</div>
              <h3>Case briefing</h3>
              ${c.intro.map(p => `<p>${esc(p)}</p>`).join('')}
              <div class="cf-victim"><span>☠️</span><div><b>Victim: ${esc(c.victim.name)}</b><p>${esc(c.victim.desc)}</p></div></div>
            </div>
            <div class="cf-howto card">
              <h3>How to investigate</h3>
              <ol>
                <li><b>🔍 Search scenes</b> to collect evidence.</li>
                <li><b>🗣️ Question suspects.</b> New questions unlock as you find evidence.</li>
                <li><b>📌 Pin notes</b> to the board${v.mode === 'coop' ? ' — your whole team sees them' : ''}.</li>
                <li><b>⚖️ Accuse</b> the killer, the weapon and the motive.</li>
              </ol>
              <p class="muted">${v.mode === 'coop'
                ? 'Co-op: everyone shares one case file. Each search or question is a move for the team. The case closes when every detective has voted (majority wins), or when the host closes it.'
                : 'Race: everyone has a private case file. You get ONE accusation — be right first to win. A wrong accusation knocks you out!'}</p>
              <p class="muted">Tip: only the killer has a motive, the means AND the opportunity.</p>
              <button class="btn btn-primary" data-tab="scenes">Start investigating →</button>
            </div>
            <div class="cf-suspect-strip">${c.suspects.map(s => `<div class="cf-mini-sus"><span>${s.emoji}</span><b>${esc(s.name)}</b><small>${esc(s.role)}</small></div>`).join('')}</div>
          </div>`;
        },
        scenes() {
          const f = v.file;
          return `<div class="cf-scenes">${v.case.locations.map(l => {
            const searched = f && f.searched.includes(l.id);
            const items = f ? f.found.filter(e => e.location === l.id) : [];
            const total = v.case.locationTotals[l.id];
            return `<div class="cf-scene ${searched ? 'searched' : ''}">
              <div class="cf-scene-emoji">${l.emoji}</div>
              <div class="cf-scene-main">
                <h4>${esc(l.name)} ${searched ? `<span class="cf-ok">✓ ${items.length}/${total} found</span>` : ''}</h4>
                <p>${esc(l.desc)}</p>
                ${items.length ? `<div class="cf-found">${items.map(e => `<button class="cf-pill" data-goto="${e.id}">${e.emoji} ${esc(e.name)}</button>`).join('')}</div>` : ''}
              </div>
              ${canAct() ? (searched && items.length >= total ? '<span class="muted small">Fully searched</span>' : `<button class="btn ${searched ? 'btn-ghost' : 'btn-primary'} btn-sm" data-search="${l.id}">${searched ? 'Search again' : 'Search'} <small>(1 move)</small></button>`) : ''}
            </div>`;
          }).join('')}</div>`;
        },
        suspects() {
          return `<div class="cf-suspects">${v.case.suspects.map(s => {
            const open = openSuspect === s.id;
            const answered = s.questions.filter(q => q.a);
            const pending = s.questions.filter(q => !q.a);
            return `<div class="cf-sus ${open ? 'open' : ''}">
              <button class="cf-sus-head" data-sus="${s.id}">
                <span class="cf-sus-emoji">${s.emoji}</span>
                <span><b>${esc(s.name)}</b><small>${esc(s.role)}</small></span>
                <span class="cf-sus-meta">${answered.length ? `💬 ${answered.length}` : ''}${pending.length ? ` <i class="q-new">${pending.length} ?</i>` : ''}</span>
              </button>
              ${open ? `<div class="cf-sus-body">
                <p class="cf-bio">${esc(s.bio)}</p>
                <div class="cf-transcript">${answered.map(q => `<div class="cf-q">🕵️ ${esc(q.q)}</div><div class="cf-a">${s.emoji} ${esc(q.a)}</div>`).join('') || '<p class="muted small">No interview yet.</p>'}</div>
                ${canAct() ? pending.map(q => `<button class="cf-ask" data-ask="${s.id}:${q.id}">❓ ${esc(q.q)} <small>(1 move)</small></button>`).join('') : ''}
                ${s.locked ? `<p class="cf-locked">🔒 ${s.locked} more question${s.locked > 1 ? 's' : ''} will unlock when you find the right evidence.</p>` : ''}
              </div>` : ''}
            </div>`;
          }).join('')}</div>`;
        },
        evidence() {
          if (!v.file) return '<p class="muted">Spectators cannot view private case files in race mode.</p>';
          const groups = {};
          for (const e of v.file.found) (groups[e.location] = groups[e.location] || []).push(e);
          const html = Object.entries(groups).map(([loc, list]) => `<h4 class="cf-group">${esc(locName(loc))}</h4><div class="cf-docs">${list.map(docHTML).join('')}</div>`).join('');
          return `<div class="cf-evidence">${html}</div>`;
        },
        board() {
          return `<div class="cf-board-wrap">
            ${canAct() ? `<form class="cf-note-form" id="cf-note-form">
              <textarea class="input" id="cf-note-in" maxlength="240" rows="2" placeholder="Pin a note… e.g. 'Gregory arrived AFTER the tea was poisoned'"></textarea>
              <div class="cf-note-actions">
                <div class="cf-colors">${['yellow', 'pink', 'blue', 'green'].map(c => `<button type="button" class="cf-color n-${c} ${noteColor === c ? 'on' : ''}" data-color="${c}" aria-label="${c} note"></button>`).join('')}</div>
                <button class="btn btn-primary btn-sm">📌 Pin note</button>
              </div>
            </form>` : ''}
            <div class="cf-cork" id="cf-cork"></div>
            <h4 class="cf-group">Activity</h4>
            <div class="cf-activity" id="cf-activity"></div>
          </div>`;
        },
        accuse() {
          const c = v.case;
          const done = v.myVote && (v.mode === 'race' || v.phase === 'solved');
          const group = (key, title, list) => `<div class="cf-acc-group"><h4>${title}</h4><div class="cf-choices">${list.map(x => `<button class="cf-choice ${sel[key] === x.id ? 'on' : ''}" data-pick="${key}:${x.id}" ${done ? 'disabled' : ''}>${x.emoji ? `<span>${x.emoji}</span>` : ''}${esc(x.name)}</button>`).join('')}</div></div>`;
          return `<div class="cf-accuse">
            ${group('culprit', '1. Who did it?', c.suspects)}
            ${group('weapon', '2. How?', c.weapons)}
            ${group('motive', '3. Why?', c.motives)}
            <div class="cf-acc-foot" id="cf-acc-foot"></div>
          </div>`;
        },
        verdict() {
          const c = v.case, s = v.solution, r = v.result;
          const nm = (list, id) => (list.find(x => x.id === id) || {}).name || '—';
          const sus = id => (c.suspects.find(x => x.id === id) || {});
          let headline;
          if (v.mode === 'race' && r.timeout) headline = '⏰ Time ran out before anyone cracked it!';
          else if (v.mode === 'race') headline = v.winner ? `${v.winner === api.me ? 'You' : esc(pName(v.winner))} cracked the case first!` : 'Nobody solved it — the killer walks free…';
          else headline = r.timeout && !Object.keys(v.allVotes || {}).length ? '⏰ Time ran out. The killer walks free…' : r.correct === 3 ? 'Case closed — the team got it right!' : r.correct === 2 ? 'So close! The team got two out of three.' : 'The killer got away…';
          const row = (label, key, list) => {
            const ans = v.mode === 'coop' ? r.answer[key] : null;
            return `<tr><td>${label}</td><td><b>${key === 'culprit' ? `${sus(s.culprit).emoji} ${esc(sus(s.culprit).name)}` : esc(nm(list, s[key]))}</b></td>${v.mode === 'coop' ? `<td class="${ans === s[key] ? 'ok' : 'bad'}">${ans === s[key] ? '✓' : '✗'} ${key === 'culprit' ? esc(sus(ans).name || '—') : esc(nm(list, ans))}</td>` : ''}</tr>`;
          };
          const votes = Object.entries(v.allVotes || {});
          return `<div class="cf-verdict">
            <div class="cf-paper verdict-paper">
              <div class="cf-stamp big ${(v.mode === 'race' ? v.winner : r.correct === 3) ? 'solved' : 'unsolved'}">${(v.mode === 'race' ? v.winner : r.correct === 3) ? 'SOLVED' : 'UNSOLVED'}</div>
              <h3>${headline}</h3>
              <div class="cf-rank">${'⭐'.repeat(r.rank.stars)}${'☆'.repeat(3 - r.rank.stars)} <b>${esc(r.rank.title)}</b> <span class="muted">· ${v.file ? v.file.actions : '?'} moves (par ${c.par})</span></div>
              <table class="cf-table"><tr><th></th><th>The truth</th>${v.mode === 'coop' ? '<th>Your team said</th>' : ''}</tr>
                ${row('Killer', 'culprit', c.suspects)}${row('Weapon', 'weapon', c.weapons)}${row('Motive', 'motive', c.motives)}
              </table>
              <h4>What really happened</h4>
              <p>${esc(s.explanation)}</p>
              ${votes.length ? `<h4>Accusations</h4><ul class="cf-votes">${votes.map(([id, x]) => {
                const right = x.culprit === s.culprit && x.weapon === s.weapon && x.motive === s.motive;
                return `<li>${right ? '✅' : '❌'} <b>${esc(pName(id))}</b>: ${esc(sus(x.culprit).name)} · ${esc(nm(c.weapons, x.weapon))} · ${esc(nm(c.motives, x.motive))}</li>`;
              }).join('')}</ul>` : ''}
              <p class="muted">${api.isHost ? 'Pick another case from the lobby, or “Play again” to replay this one.' : 'Waiting for the host to pick the next case…'}</p>
            </div>
          </div>`;
        },
      };

      function canAct() { return isPlayer() && v.phase !== 'solved' && !(v.mode === 'race' && v.accused.includes(api.me)); }

      function renderBody(full) {
        const body = $('#cf-body', root);
        if (full) body.innerHTML = views[tab]();
        if (tab === 'evidence' && v.file) { v.file.found.forEach(e => seen.add(e.id)); }
        if (tab === 'board') renderBoardDynamic();
        if (tab === 'accuse') renderAccuseFoot();
        if (highlight) {
          const el = $('#ev-' + highlight, root);
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
          highlight = null;
        }
      }
      function renderBoardDynamic() {
        const cork = $('#cf-cork', root);
        if (!cork) return;
        const notes = v.file ? v.file.notes : [];
        cork.innerHTML = notes.length
          ? notes.map((n, i) => `<div class="cf-note n-${n.color}" style="--r:${((n.id * 37) % 7) - 3}deg"><p>${esc(n.text)}</p><small>— ${esc(n.name)}</small>${canAct() ? `<button class="cf-unnote" data-unnote="${n.id}" title="Remove">✕</button>` : ''}</div>`).join('')
          : '<p class="cf-empty">No notes yet. Pin your theories, timelines and suspicions here.</p>';
        const act = $('#cf-activity', root);
        act.innerHTML = v.file ? v.file.log.slice().reverse().map(l => `<div>${esc(l.text)}</div>`).join('') || '<div class="muted">Nothing yet.</div>' : '';
      }
      function renderAccuseFoot() {
        const foot = $('#cf-acc-foot', root);
        if (!foot) return;
        const ready = sel.culprit && sel.weapon && sel.motive;
        let html = '';
        if (v.mode === 'coop') {
          const humans = api.room.players.filter(p => !p.isBot && p.connected && v.players.some(x => x.id === p.id));
          html += `<div class="cf-voters">${humans.map(p => `<span class="${v.votes.includes(p.id) ? 'voted' : ''}">${esc(p.avatar)} ${esc(p.name)} ${v.votes.includes(p.id) ? '✓' : '…'}</span>`).join('')}</div>`;
          if (canAct()) html += `<button class="btn btn-primary btn-big" data-accuse ${ready ? '' : 'disabled'}>${v.myVote ? 'Change my vote' : '⚖️ Lock in my accusation'}</button>`;
          html += `<p class="muted small">The case closes when every detective has voted. Majority decides each answer.</p>`;
          if (api.isHost && v.votes.length && v.phase !== 'solved') html += '<button class="btn btn-ghost btn-sm" data-reveal>Close the case now (host)</button>';
        } else {
          if (v.myVote) html += '<div class="cf-out">❌ Your accusation was wrong — you are out of this race. Watch the others try!</div>';
          else if (canAct()) html += `<button class="btn btn-danger btn-big" data-accuse ${ready ? '' : 'disabled'}>⚖️ Make my accusation (one chance!)</button>`;
        }
        foot.innerHTML = html;
      }

      root.addEventListener('click', async e => {
        const t = e.target.closest('[data-tab]');
        if (t) { tab = t.dataset.tab; tabs(); renderBody(true); window.scrollTo({ top: 0 }); return; }
        const g = e.target.closest('[data-goto]');
        if (g) { tab = 'evidence'; highlight = g.dataset.goto; tabs(); renderBody(true); return; }
        const s = e.target.closest('[data-search]');
        if (s) { s.disabled = true; s.innerHTML = 'Searching…'; await api.act({ type: 'search', location: s.dataset.search }); return; }
        const su = e.target.closest('[data-sus]');
        if (su) { openSuspect = openSuspect === su.dataset.sus ? null : su.dataset.sus; renderBody(true); return; }
        const q = e.target.closest('[data-ask]');
        if (q) { const [sid, qid] = q.dataset.ask.split(':'); q.disabled = true; await api.act({ type: 'ask', suspect: sid, question: qid }); return; }
        const c = e.target.closest('[data-color]');
        if (c) { noteColor = c.dataset.color; $$('.cf-color', root).forEach(x => x.classList.toggle('on', x === c)); return; }
        const un = e.target.closest('[data-unnote]');
        if (un) { api.act({ type: 'unnote', id: Number(un.dataset.unnote) }); return; }
        const p = e.target.closest('[data-pick]');
        if (p) {
          const [k, id] = p.dataset.pick.split(':');
          sel[k] = id;
          $$(`[data-pick^="${k}:"]`, root).forEach(x => x.classList.toggle('on', x === p));
          renderAccuseFoot();
          return;
        }
        if (e.target.closest('[data-accuse]')) {
          if (v.mode === 'race' && !confirm('You only get ONE accusation. Are you sure?')) return;
          const r = await api.act({ type: 'accuse', ...sel });
          if (r.ok && v.mode === 'coop') TW.toast('Accusation locked in ⚖️', 'ok');
          return;
        }
        if (e.target.closest('[data-reveal]')) { if (confirm('Close the case using the votes so far?')) api.act({ type: 'reveal' }); }
      });
      root.addEventListener('submit', async e => {
        if (e.target.id !== 'cf-note-form') return;
        e.preventDefault();
        const input = $('#cf-note-in', root);
        const text = input.value.trim();
        if (!text) return;
        const r = await api.act({ type: 'note', text, color: noteColor });
        if (r.ok) input.value = '';
      });

      function renderSetup() {
        const st = v.setup, host = api.isHost;
        const hostName = (api.room.players.find(p => p.isHost) || {}).name || 'The host';
        const el = $('#cf-setup', root);
        el.innerHTML = `
          <div class="cf-setup-head"><span>🕵️</span><div><h2>Choose your case</h2><p>${host ? 'You are the host: pick a case, how you want to play, and hit Begin.' : `${esc(hostName)} is choosing. Shout your pick in the chat!`}</p></div></div>
          <h3 class="cf-step">1 · The case</h3>
          <div class="cf-case-pick">${v.cases.map(c => `<button class="cf-case ${st.caseId === c.id ? 'on' : ''}" data-setup="caseId" data-val="${c.id}" ${host ? '' : 'disabled'}>
            <span class="cf-case-emoji">${c.emoji}</span>
            <b>${esc(c.title)}</b>
            <span class="cf-diff d-${esc(c.difficulty.split(' ')[0].toLowerCase())}">${esc(c.difficulty)}</span>
            <small>${esc(c.tagline)}</small>
            <small class="muted">☠️ ${esc(c.victim)} · ${c.suspects} suspects</small>
          </button>`).join('')}</div>
          <h3 class="cf-step">2 · How do you want to play?</h3>
          <div class="cf-mode-pick">
            <button class="cf-mode ${st.mode === 'coop' ? 'on' : ''}" data-setup="mode" data-val="coop" ${host ? '' : 'disabled'}><span>🤝</span><b>Tackle it together</b><small>One shared case file. Search, question and pin notes as a team, then vote on who did it.</small></button>
            <button class="cf-mode ${st.mode === 'race' ? 'on' : ''}" data-setup="mode" data-val="race" ${host ? '' : 'disabled'}><span>🏁</span><b>Race each other</b><small>Everyone investigates alone. One accusation each. The first to name the killer correctly wins.</small></button>
          </div>
          <h3 class="cf-step">3 · Race against the clock?</h3>
          <div class="cf-clock-pick">${[[0, '♾️ No clock'], [10, '⏱️ 10 min'], [20, '⏱️ 20 min'], [30, '⏱️ 30 min']].map(([m, l]) => `<button class="cf-clock ${st.clock === m ? 'on' : ''}" data-setup="clock" data-val="${m}" ${host ? '' : 'disabled'}>${l}</button>`).join('')}</div>
          <p class="muted small">${st.clock ? `When the clock hits zero the case closes${st.mode === 'coop' ? ' using the votes so far' : ''}. No accusation means the killer walks free!` : 'Take as long as you like.'}</p>
          ${host ? '<button class="btn btn-primary btn-big" data-begin>🔍 Begin the investigation</button>' : '<div class="waiting">⏳ Waiting for the host to begin…</div>'}`;
      }
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-setup]');
        if (b) { const k = b.dataset.setup; api.act({ type: 'setup', [k]: k === 'clock' ? Number(b.dataset.val) : b.dataset.val }); return; }
        if (e.target.closest('[data-begin]')) api.act({ type: 'begin' });
      });
      function tickClock() {
        const chip = $('#cf-clock', root);
        if (!chip || deadline === null) return;
        const left = Math.max(0, deadline - Date.now());
        const m = Math.floor(left / 60000), sec = Math.floor(left / 1000) % 60;
        chip.textContent = `⏳ ${m}:${String(sec).padStart(2, '0')}`;
        chip.classList.toggle('urgent', left < 60000);
      }

      function update(nv) {
        const prev = v;
        v = nv;
        const setup = v.phase === 'setup';
        $('#cf-setup', root).hidden = !setup;
        root.querySelector('.cf').hidden = setup;
        if (setup) { caseKey = null; renderSetup(); return; }
        deadline = v.timeLeft !== null ? Date.now() + v.timeLeft : null;
        clearInterval(clockTimer);
        if (deadline !== null) clockTimer = setInterval(tickClock, 500);
        const key = v.case.id + ':' + v.mode;
        if (key !== caseKey || (prev && prev.phase === 'solved' && v.phase !== 'solved')) {
          // new case started
          caseKey = key; tab = 'briefing'; openSuspect = null; lastFoundSeq = null; seen = new Set();
          Object.keys(sel).forEach(k => { sel[k] = null; });
          if (v.file) v.file.found.forEach(e => seen.add(e.id));
        }
        if (v.myVote && !sel.culprit) Object.assign(sel, v.myVote);
        // teammate discoveries
        const lf = v.file && v.file.lastFound;
        if (lf && lastFoundSeq !== null && lf.seq !== lastFoundSeq) {
          const names = lf.ids.map(id => v.file.found.find(e => e.id === id)).filter(Boolean);
          if (names.length) TW.toast(`${lf.by === api.me ? 'You' : pName(lf.by)} found: ${names.map(e => e.emoji + ' ' + e.name).join(', ')}`, 'ok', 4000);
          else if (lf.by === api.me) TW.toast('Nothing new here…');
        }
        lastFoundSeq = lf ? lf.seq : 0;
        if (v.phase === 'solved' && (!prev || prev.phase !== 'solved')) {
          tab = 'verdict';
          const good = v.mode === 'race' ? v.winner === api.me : v.result.correct === 3;
          if (good) TW.confetti();
        }
        header(); tabs(); tickClock();
        // keep typing in the board / accuse tabs intact
        const keep = (tab === 'board' || tab === 'accuse') && prev && prev.phase === v.phase && $('#cf-body', root).firstElementChild;
        renderBody(!keep);
        if (tab === 'evidence') tabs();
        const banner = $('#cf-banner', root);
        banner.hidden = !(v.mode === 'race' && v.myVote && v.phase !== 'solved');
        banner.textContent = '❌ Your accusation was wrong — you are out of the race. You can still read your file.';
      }
      return { update, unmount() { clearInterval(clockTimer); } };
    },
  };
})();
