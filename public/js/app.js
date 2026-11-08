'use strict';
(() => {
  const { esc, $, $$, h, toast } = TW;
  const app = document.getElementById('app');
  const socket = io({ transports: ['websocket', 'polling'] });

  // per-tab identity so a refresh rejoins the same seat
  const store = {
    get(k, d) { try { return JSON.parse(sessionStorage.getItem(k)) ?? JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v, local) { try { (local ? localStorage : sessionStorage).setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
  };
  let token = null;
  try { token = sessionStorage.getItem('tw_token'); } catch { /* ignore */ }
  if (!token) {
    token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { sessionStorage.setItem('tw_token', token); } catch { /* ignore */ }
  }

  const S = {
    name: store.get('tw_name', ''),
    avatar: store.get('tw_avatar', TW.AVATARS[Math.floor(Math.random() * TW.AVATARS.length)]),
    room: null, chat: [], unread: 0, screenKey: null, game: null, chatOpen: false,
    joinCode: (new URLSearchParams(location.search).get('room') || '').toUpperCase(),
    lastRoom: store.get('tw_room', null),
  };

  const api = {
    socket,
    act(action) {
      return new Promise(res => socket.emit('game:action', action, r => {
        if (r && r.error) toast(r.error, 'error');
        res(r || {});
      }));
    },
    emit(ev, data) {
      return new Promise(res => socket.emit(ev, data, r => {
        if (r && r.error) toast(r.error, 'error');
        res(r || {});
      }));
    },
    get room() { return S.room; },
    get me() { return S.room && S.room.you; },
    get isHost() { return S.room && S.room.hostId === S.room.you; },
    player(id) { return S.room && S.room.players.find(p => p.id === id); },
  };
  TW.api = api;

  const inviteLink = code => `${location.origin}${location.pathname}?room=${code}`;
  async function copy(text, label) {
    try { await navigator.clipboard.writeText(text); toast(`${label} copied!`, 'ok'); }
    catch { prompt('Copy this:', text); }
  }

  // ───────────────────────── rendering
  function render() {
    const r = S.room;
    const key = !r ? 'home' : r.status === 'lobby' ? 'lobby' : 'game:' + r.game;
    if (key !== S.screenKey) {
      if (S.game && S.game.unmount) S.game.unmount();
      S.game = null;
      S.screenKey = key;
      app.innerHTML = '';
      if (key === 'home') buildHome();
      else if (key === 'lobby') buildLobby();
      else buildGame();
    }
    if (key === 'lobby') updateLobby();
    if (key.startsWith('game:')) updateGame();
  }

  function logo(size = '') {
    return `<div class="logo ${size}"><span class="logo-globe">🌍</span><span class="logo-text"><span>Tony's</span> <span>World</span></span></div>`;
  }

  // ───────── home
  function buildHome() {
    const el = h(`<div class="screen home">
      <div class="home-hero">
        ${logo('big')}
        <p class="tagline">Classic games. Murder mysteries. <b>One code</b> to play with your friends.</p>
      </div>
      <div class="home-panel card">
        <label class="field-label" for="name">Your name</label>
        <input id="name" class="input" maxlength="16" placeholder="e.g. Tony" autocomplete="nickname" value="${esc(S.name)}">
        <div class="field-label">Pick your avatar</div>
        <div class="avatar-grid">${TW.AVATARS.map(a => `<button class="avatar-btn ${a === S.avatar ? 'on' : ''}" data-a="${a}" aria-label="Avatar ${a}">${a}</button>`).join('')}</div>
        <div class="home-actions">
          <button class="btn btn-primary btn-big" id="create">✨ Create a room</button>
          <div class="or"><span>or join friends</span></div>
          <div class="join-row">
            <input id="code" class="input code-input" maxlength="5" placeholder="CODE" autocomplete="off" autocapitalize="characters" value="${esc(S.joinCode)}">
            <button class="btn btn-secondary" id="join">Join</button>
          </div>
        </div>
      </div>
      <div class="home-games">
        ${TW.CATALOG.map(g => `<div class="mini-game ${g.ready ? '' : 'soon'}" style="--accent:${g.accent}"><span class="mg-emoji">${g.emoji}</span><span class="mg-title">${esc(g.title)}</span>${g.ready ? '' : '<span class="soon-tag">Coming soon</span>'}</div>`).join('')}
      </div>
      <footer class="home-foot">Made for friends · No sign-up needed</footer>
    </div>`);
    app.appendChild(el);
    const nameIn = $('#name', el), codeIn = $('#code', el);
    $$('.avatar-btn', el).forEach(b => b.onclick = () => {
      S.avatar = b.dataset.a; store.set('tw_avatar', S.avatar, true);
      $$('.avatar-btn', el).forEach(x => x.classList.toggle('on', x === b));
    });
    const saveName = () => { S.name = nameIn.value.trim(); store.set('tw_name', S.name, true); return S.name; };
    const need = () => { if (!saveName()) { toast('Type your name first 🙂', 'error'); nameIn.focus(); return false; } return true; };
    $('#create', el).onclick = () => { if (need()) create(); };
    const doJoin = () => {
      if (!need()) return;
      const c = codeIn.value.trim().toUpperCase();
      if (c.length < 4) { toast('Enter the room code your friend shared', 'error'); codeIn.focus(); return; }
      join(c);
    };
    $('#join', el).onclick = doJoin;
    codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    codeIn.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });
    nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') (S.joinCode ? doJoin : () => need() && create())(); });
    if (S.joinCode) {
      el.querySelector('.home-actions').classList.add('invited');
      toast(`You're invited to room ${S.joinCode}! Enter your name and hit Join.`, 'ok', 5000);
    }
    (S.name ? (S.joinCode ? $('#join', el) : $('#create', el)) : nameIn).focus();
  }

  function onJoined(r) {
    if (r && r.ok) {
      document.getElementById('toasts').innerHTML = '';
      store.set('tw_room', r.code);
      S.lastRoom = r.code;
      history.replaceState(null, '', `?room=${r.code}`);
    }
  }
  function create() {
    socket.emit('room:create', { name: S.name, avatar: S.avatar, token }, r => {
      if (r.error) return toast(r.error, 'error');
      S.chat = []; onJoined(r);
    });
  }
  function join(code) {
    socket.emit('room:join', { code, name: S.name, avatar: S.avatar, token }, r => {
      if (r.error) return toast(r.error, 'error');
      onJoined(r);
    });
  }
  function leaveRoom() {
    socket.emit('room:leave', {}, () => {});
    S.room = null; S.chat = []; S.lastRoom = null; S.joinCode = '';
    store.del('tw_room');
    history.replaceState(null, '', location.pathname);
    render();
  }

  // ───────── topbar + chat (shared)
  function topbar(extra = '') {
    return `<header class="topbar">
      <button class="logo-btn" data-act="home" title="Leave room">${logo()}</button>
      <div class="topbar-mid">${extra}</div>
      <div class="topbar-right">
        <button class="code-chip" data-act="copylink" title="Copy invite link">Room <b>${esc(S.room.code)}</b> 🔗</button>
        <button class="btn btn-ghost btn-sm chat-toggle" data-act="chat">💬<span class="badge" hidden></span></button>
        <button class="btn btn-ghost btn-sm" data-act="leave">Leave</button>
      </div>
    </header>`;
  }
  function wireTopbar(el) {
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'copylink') copy(inviteLink(S.room.code), 'Invite link');
      if (act === 'leave' || act === 'home') { if (confirm('Leave this room?')) leaveRoom(); }
      if (act === 'chat') { S.chatOpen = !S.chatOpen; document.body.classList.toggle('chat-open', S.chatOpen); if (S.chatOpen) { S.unread = 0; updateBadge(); scrollChat(); } }
    });
  }
  function chatPanel() {
    return `<section class="chat card">
      <div class="chat-head"><span>💬 Chat</span><button class="btn btn-ghost btn-sm chat-close" data-act="chat">✕</button></div>
      <div class="chat-log" id="chat-log"></div>
      <form class="chat-form" id="chat-form">
        <input class="input" id="chat-in" maxlength="300" placeholder="Say something…" autocomplete="off">
        <button class="btn btn-primary btn-sm">Send</button>
      </form>
      <div class="quick-emotes">${['👋', '😂', '🔥', '😱', '👏', 'GG'].map(x => `<button data-emote="${x}">${x}</button>`).join('')}</div>
    </section>`;
  }
  function wireChat(el) {
    const form = $('#chat-form', el), input = $('#chat-in', el);
    form.onsubmit = e => { e.preventDefault(); const t = input.value.trim(); if (t) socket.emit('chat', t); input.value = ''; };
    $$('[data-emote]', el).forEach(b => b.onclick = () => socket.emit('chat', b.dataset.emote));
    const log = $('#chat-log', el);
    log.innerHTML = S.chat.map(chatMsgHTML).join('');
    scrollChat();
  }
  function chatMsgHTML(m) {
    if (m.system) return `<div class="msg sys">${esc(m.text)}</div>`;
    const mine = S.room && m.from === S.room.you;
    return `<div class="msg ${mine ? 'mine' : ''}"><span class="msg-av" style="background:${esc(m.color)}">${esc(m.avatar)}</span><div><b style="color:${esc(m.color)}">${esc(m.name)}</b><p>${esc(m.text)}</p></div></div>`;
  }
  function scrollChat() { const log = $('#chat-log'); if (log) log.scrollTop = log.scrollHeight; }
  function updateBadge() {
    const b = $('.chat-toggle .badge');
    if (b) { b.hidden = !S.unread; b.textContent = S.unread > 9 ? '9+' : S.unread; }
  }

  function playersHTML(compact) {
    const r = S.room;
    return r.players.map(p => `<li class="player ${p.connected ? '' : 'offline'}" style="--pc:${esc(p.color)}">
      <span class="p-av">${esc(p.avatar)}</span>
      <span class="p-name">${esc(p.name)}${p.id === r.you ? ' <em>(you)</em>' : ''}</span>
      ${p.isHost ? '<span class="tag tag-host" title="Host">👑</span>' : ''}
      ${p.isBot && !p.ghost ? '<span class="tag">BOT</span>' : ''}
      ${!p.connected ? '<span class="tag tag-off">offline</span>' : ''}
      ${!compact && api.isHost && p.id !== r.you ? `<button class="p-kick" data-kick="${p.id}" title="Remove">✕</button>` : ''}
    </li>`).join('');
  }

  // ───────── lobby
  function buildLobby() {
    const el = h(`<div class="screen lobby">
      ${topbar('<span class="topbar-title">Lobby</span>')}
      <div class="lobby-grid">
        <section class="card code-card">
          <div class="code-label">Room code — share it with friends!</div>
          <div class="big-code" id="big-code"></div>
          <div class="code-actions">
            <button class="btn btn-secondary btn-sm" id="copy-code">📋 Copy code</button>
            <button class="btn btn-secondary btn-sm" id="copy-link">🔗 Copy invite link</button>
            ${navigator.share ? '<button class="btn btn-secondary btn-sm" id="share">📤 Share</button>' : ''}
          </div>
        </section>
        <section class="card players-card">
          <div class="card-head"><h3>Players <span id="pcount"></span></h3><button class="btn btn-ghost btn-sm" id="add-bot">🤖 Add bot</button></div>
          <ul class="players" id="players"></ul>
        </section>
        <section class="card games-card">
          <div class="card-head"><h3>Choose a game</h3><span class="muted" id="host-note"></span></div>
          <div class="game-grid" id="game-grid"></div>
          <div class="game-setup" id="game-setup"></div>
        </section>
        ${chatPanel()}
      </div>
    </div>`);
    app.appendChild(el);
    wireTopbar(el); wireChat(el);
    $('#copy-code', el).onclick = () => copy(S.room.code, 'Room code');
    $('#copy-link', el).onclick = () => copy(inviteLink(S.room.code), 'Invite link');
    const sh = $('#share', el);
    if (sh) sh.onclick = () => navigator.share({ title: "Tony's World", text: `Come play with me on Tony's World! Room code: ${S.room.code}`, url: inviteLink(S.room.code) }).catch(() => {});
    $('#add-bot', el).onclick = () => api.emit('room:addBot');
    $('#players', el).addEventListener('click', e => {
      const b = e.target.closest('[data-kick]');
      if (b) api.emit('room:remove', { id: b.dataset.kick });
    });
    $('#game-grid', el).addEventListener('click', e => {
      const b = e.target.closest('[data-game]');
      if (!b) return;
      const info = TW.gameInfo(b.dataset.game);
      if (!info.ready) return toast(`${info.title} is coming soon! 🚧`);
      if (!api.isHost) return toast('Only the host picks the game 👑');
      api.emit('room:select', { game: b.dataset.game });
    });
    $('#game-setup', el).addEventListener('change', e => {
      const s = e.target.closest('[data-opt]');
      if (!s) return;
      const raw = s.value;
      api.emit('room:option', { key: s.dataset.opt, value: /^\d+$/.test(raw) ? Number(raw) : raw });
    });
    $('#game-setup', el).addEventListener('click', e => { if (e.target.closest('#start')) api.emit('room:start'); });
  }
  function updateLobby() {
    const r = S.room, el = app;
    $('#big-code', el).innerHTML = r.code.split('').map(c => `<span>${esc(c)}</span>`).join('');
    $('#players', el).innerHTML = playersHTML(false);
    $('#pcount', el).textContent = `(${r.players.length})`;
    $('#add-bot', el).hidden = !(api.isHost && r.meta.supportsBots);
    $('#host-note', el).textContent = api.isHost ? 'You are the host' : `${(r.players.find(p => p.isHost) || {}).name || 'Host'} picks the game`;
    $('#game-grid', el).innerHTML = TW.CATALOG.map(g => `<button class="game-tile ${g.id === r.selectedGame ? 'selected' : ''} ${g.ready ? '' : 'soon'}" data-game="${g.id}" style="--accent:${g.accent}">
      <span class="gt-emoji">${g.emoji}</span>
      <span class="gt-title">${esc(g.title)}</span>
      <span class="gt-tag">${esc(g.tag)}</span>
      <span class="gt-players">${g.ready ? '👥 ' + g.players : '🚧 Coming soon'}</span>
    </button>`).join('');
    const m = r.meta, info = TW.gameInfo(r.selectedGame);
    const count = r.players.length;
    const enough = count >= m.minPlayers && count <= m.maxPlayers;
    $('#game-setup', el).innerHTML = `
      <div class="setup-title">${info.emoji} ${esc(m.name)} <span class="muted">· ${m.minPlayers}–${m.maxPlayers} players</span></div>
      ${r.selectedGame === 'casefiles' ? '<p class="muted">You\'ll pick the case together after starting: solve it as a team or race each other, with or without a clock.</p>' : ''}
      ${r.selectedGame === 'barrel' ? '<p class="muted">Everyone plays at the same time. Works with keyboard or on-screen buttons on phones.</p>' : ''}
      <div class="options">${m.optionsSchema.map(o => `<label class="opt"><span>${esc(o.label)}</span>
        <select class="input" data-opt="${o.key}" ${api.isHost ? '' : 'disabled'}>${o.choices.map(c => `<option value="${esc(c.value)}" ${String(r.options[o.key]) === String(c.value) ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>`).join('')}</div>
      ${api.isHost
        ? `<button class="btn btn-primary btn-big" id="start" ${enough ? '' : 'disabled'}>▶ Start ${esc(m.name)}</button>
           ${!enough ? `<div class="muted center">${count < m.minPlayers ? `Need ${m.minPlayers - count} more player${m.minPlayers - count > 1 ? 's' : ''}${m.supportsBots ? ' — invite friends or add a bot' : ''}` : `Too many players (max ${m.maxPlayers})`}</div>` : ''}`
        : `<div class="waiting">⏳ Waiting for the host to start…</div>`}`;
  }

  // ───────── game
  function buildGame() {
    const r = S.room, info = TW.gameInfo(r.game);
    const el = h(`<div class="screen game-screen" data-game="${r.game}">
      ${topbar(`<span class="topbar-title">${info.emoji} ${esc(info.title)}</span><span id="host-controls"></span>`)}
      <div class="game-layout">
        <main class="game-area" id="game-area"></main>
        <aside class="sidebar">
          <section class="card side-players"><h3>Players</h3><ul class="players" id="players"></ul></section>
          ${chatPanel()}
        </aside>
      </div>
    </div>`);
    app.appendChild(el);
    wireTopbar(el); wireChat(el);
    $('#host-controls', el).addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.h === 'lobby' && confirm('End the game and return everyone to the lobby?')) api.emit('room:lobby');
      if (b.dataset.h === 'again') api.emit('room:start');
    });
    const mod = TW.games[r.game];
    S.game = mod.create($('#game-area', el), api);
  }
  function updateGame() {
    const r = S.room;
    $('#players').innerHTML = playersHTML(true);
    const over = r.view && (r.view.phase === 'over' || r.view.phase === 'solved');
    $('#host-controls').innerHTML = api.isHost
      ? `${over ? '<button class="btn btn-primary btn-sm" data-h="again">↻ Play again</button>' : ''}<button class="btn btn-ghost btn-sm" data-h="lobby">⌂ Lobby</button>`
      : '';
    if (S.game && r.view) S.game.update(r.view, r);
  }

  // ───────────────────────── socket events
  socket.on('connect', () => {
    $('.conn-banner')?.remove();
    const code = (S.room && S.room.code) || S.lastRoom;
    if (code) {
      socket.emit('room:join', { code, name: S.name, avatar: S.avatar, token }, r => {
        if (r.error) {
          toast('That room has closed. Start a new one!', 'error');
          S.room = null; S.lastRoom = null; store.del('tw_room');
          history.replaceState(null, '', location.pathname);
          render();
        } else onJoined(r);
      });
    }
  });
  socket.on('disconnect', () => {
    if (!$('.conn-banner')) document.body.appendChild(h('<div class="conn-banner">Reconnecting… 🔌</div>'));
  });
  socket.on('room:state', room => { S.room = room; render(); });
  socket.on('chat:history', msgs => {
    S.chat = msgs;
    const log = $('#chat-log');
    if (log) { log.innerHTML = msgs.map(chatMsgHTML).join(''); scrollChat(); }
  });
  socket.on('chat', m => {
    S.chat.push(m);
    if (S.chat.length > 150) S.chat.shift();
    const log = $('#chat-log');
    if (log) {
      const near = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
      log.insertAdjacentHTML('beforeend', chatMsgHTML(m));
      if (near || (S.room && m.from === S.room.you)) scrollChat();
    }
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    if (mobile && !S.chatOpen && !m.system && S.room && m.from !== S.room.you) {
      S.unread++; updateBadge();
      if (S.screenKey && S.screenKey.startsWith('game:')) toast(`${m.name}: ${m.text}`, 'chat', 2500);
    }
  });
  socket.on('kicked', () => {
    toast('You were removed from the room by the host', 'error', 5000);
    S.room = null; S.lastRoom = null; store.del('tw_room');
    history.replaceState(null, '', location.pathname);
    render();
  });

  render();
})();
