'use strict';
// Tony's World — multiplayer game server
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const GAMES = require('./server/games');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000, maxHttpBufferSize: 1e5 });

const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/tycoon-board', (_req, res) => res.json(GAMES.tycoon.board));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
// ICE servers for voice/video calls.
// STUN alone only works when both players' networks allow direct connections. A TURN relay makes
// calls work everywhere. Supported (set on Render → Environment):
//   CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN   (Cloudflare Realtime TURN, generous free tier)
//   METERED_TURN_URL  (the "credentials" URL from metered.ca, includes your apiKey)
//   TURN_URL + TURN_USERNAME + TURN_CREDENTIAL            (any other TURN server)
const STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
let turnCache = { at: 0, servers: null };
let turnStatus = 'not configured: add CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN on Render';
const env = k => (process.env[k] || '').trim().replace(/^["']|["']$/g, '');
async function turnServers() {
  if (turnCache.servers && Date.now() - turnCache.at < 6 * 3600 * 1000) return turnCache.servers;
  let servers = [];
  try {
    if (env('CLOUDFLARE_TURN_KEY_ID') || env('CLOUDFLARE_TURN_API_TOKEN')) {
      if (!env('CLOUDFLARE_TURN_KEY_ID')) throw new Error('CLOUDFLARE_TURN_KEY_ID is missing on Render');
      if (!env('CLOUDFLARE_TURN_API_TOKEN')) throw new Error('CLOUDFLARE_TURN_API_TOKEN is missing on Render');
      // Cloudflare has two endpoints for this; try the newer one first, then the older one
      const base = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env('CLOUDFLARE_TURN_KEY_ID'))}/credentials/`;
      let r = null;
      for (const path of ['generate-ice-servers', 'generate']) {
        r = await fetch(base + path, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env('CLOUDFLARE_TURN_API_TOKEN')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ttl: 86400 }),
        });
        if (r.status !== 404) break;
      }
      if (r.status === 401 || r.status === 403) throw new Error(`Cloudflare rejected the API token (${r.status}). Copy the TURN app's API token again`);
      if (r.status === 404) throw new Error('Cloudflare says that Turn Token ID does not exist (404). Check CLOUDFLARE_TURN_KEY_ID: use the TURN app\'s "Turn Token ID", not your Account ID');
      if (!r.ok) throw new Error('Cloudflare TURN error ' + r.status);
      const j = await r.json();
      // keep only entries with usable URLs (the newer endpoint also lists port-53 URLs that browsers block)
      servers = [].concat(j.iceServers || []).map(x => ({ ...x, urls: [].concat(x.urls).filter(u => !/:53(\?|$)/.test(u)) })).filter(x => x.urls.length);
      if (!servers.length) throw new Error('Cloudflare returned no servers');
    } else if (env('METERED_TURN_URL')) {
      const r = await fetch(env('METERED_TURN_URL'));
      if (!r.ok) throw new Error('Metered TURN error ' + r.status);
      servers = [].concat(await r.json());
    }
    if (servers.length) turnStatus = 'ok';
  } catch (e) { turnStatus = e.message; console.warn('TURN credentials failed:', e.message); }
  if (env('TURN_URL')) { servers.push({ urls: env('TURN_URL').split(','), username: env('TURN_USERNAME'), credential: env('TURN_CREDENTIAL') }); turnStatus = 'ok'; }
  if (servers.length) turnCache = { at: Date.now(), servers };
  return servers;
}
app.get('/api/ice', async (_req, res) => {
  const turn = await turnServers();
  res.set('Cache-Control', 'no-store');
  res.json({ relay: turn.length > 0, relayStatus: turn.length ? 'ok' : turnStatus, iceServers: [...STUN, ...turn] });
});

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COLORS = ['#ff5a5f', '#3a86ff', '#2ec4b6', '#ffc93c', '#b388ff', '#ff8c42', '#06d6a0', '#f15bb5', '#9bdeac', '#4cc9f0'];
const AVATARS = ['🦊', '🐼', '🐸', '🐯', '🦄', '🐙', '🐧', '🦁', '🐵', '🐨', '🐰', '🐲', '👽', '🦖', '🐝', '🦉'];
const BOT_NAMES = ['Robo Rita', 'Beep Boop', 'Sir Clanks', 'Gizmo', 'Sprocket', 'Bolt', 'Widget', 'Pixel', 'Cogsworth'];
const MAX_PLAYERS = 10;
let nextId = 1;

function makeCode() {
  let c;
  do {
    c = '';
    for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  } while (rooms.has(c));
  return c;
}
function clean(str, max) {
  return String(str ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}
function pickColor(room) {
  const used = new Set(room.players.map(p => p.color));
  return COLORS.find(c => !used.has(c)) || COLORS[room.players.length % COLORS.length];
}
function gameMeta(id) {
  const m = GAMES[id];
  return { id, name: m.name, minPlayers: m.minPlayers, maxPlayers: m.maxPlayers, supportsBots: m.supportsBots, supportsTeams: !!m.supportsTeams, teamNote: m.teamNote || '', optionsSchema: m.optionsSchema };
}

function addHuman(room, name, avatar, token) {
  const p = {
    id: 'p' + (nextId++), token: token || null, name, avatar: AVATARS.includes(avatar) ? avatar : AVATARS[room.players.length % AVATARS.length],
    color: pickColor(room), isBot: false, connected: true, socketId: null, disconnectedAt: null, ghost: false,
    team: room.teamsOn ? smallerTeam(room) : null, inCall: false, mic: true, cam: false,
  };
  room.players.push(p);
  return p;
}
function addBot(room) {
  const used = new Set(room.players.map(p => p.name));
  const name = BOT_NAMES.find(n => !used.has(n)) || 'Bot ' + nextId;
  const p = { id: 'b' + (nextId++), name, avatar: '🤖', color: pickColor(room), isBot: true, connected: true, ghost: false, team: room.teamsOn ? smallerTeam(room) : null };
  room.players.push(p);
  return p;
}

function smallerTeam(room) {
  const a = room.players.filter(p => p.team === 'A').length, b = room.players.filter(p => p.team === 'B').length;
  return a <= b ? 'A' : 'B';
}
// which voice channel a player hears/speaks in: the room call, or their team's private channel during team play
function voiceChannel(room, p) {
  if (!p.inCall) return null;
  if (room.state && room.gameTeams && p.team && room.participants.includes(p.id)) {
    const mod = GAMES[room.game];
    if (mod.privateTalk && mod.privateTalk(room.state, p.id)) return 'team:' + p.team;
  }
  return 'room';
}
function publicPlayer(p, room) {
  return {
    id: p.id, name: p.name, avatar: p.avatar, color: p.color, isBot: p.isBot, ghost: p.ghost, connected: p.isBot || p.connected, isHost: room.hostId === p.id,
    team: room.teamsOn || room.gameTeams ? p.team : null, inCall: !!p.inCall, mic: p.mic !== false, cam: !!p.cam, channel: voiceChannel(room, p),
  };
}
function roomView(room, pid) {
  const mod = room.game ? GAMES[room.game] : null;
  let view = null;
  if (room.state) {
    try { view = mod.view(room.state, pid); } catch (e) { console.error('view error', e); }
  }
  return {
    code: room.code, you: pid, hostId: room.hostId,
    players: room.players.map(p => publicPlayer(p, room)),
    selectedGame: room.selectedGame, meta: gameMeta(room.selectedGame), options: room.options,
    status: room.state ? 'playing' : 'lobby', game: room.game, view, teamsOn: !!room.teamsOn, gameTeams: !!room.gameTeams,
  };
}
function broadcast(room) {
  for (const p of room.players) {
    if (!p.isBot && p.connected && p.socketId) io.to(p.socketId).emit('room:state', roomView(room, p.id));
  }
}
function pushChat(room, msg) {
  msg.ts = Date.now();
  msg.mid = nextId++;
  room.chat.push(msg);
  if (room.chat.length > 120) room.chat.splice(0, room.chat.length - 120);
  io.to(room.code).emit('chat', msg);
}
function sysMsg(room, text) { pushChat(room, { system: true, text }); }

function humansConnected(room) { return room.players.filter(p => !p.isBot && p.connected); }
function pickHost(room) {
  const next = humansConnected(room)[0] || room.players.find(p => !p.isBot);
  if (next && next.id !== room.hostId) {
    room.hostId = next.id;
    sysMsg(room, `${next.name} is now the host 👑`);
  }
}
function destroyRoom(room) {
  clearTimeout(room.botTimer); clearTimeout(room.reactTimer);
  rooms.delete(room.code);
}

// ---------- game flow ----------
function ctxFor(room, pid) {
  return { humans: humansConnected(room).map(p => p.id), isHost: pid === room.hostId };
}
function afterChange(room) {
  broadcast(room);
  scheduleBot(room);
}
function scheduleBot(room) {
  clearTimeout(room.botTimer); room.botTimer = null;
  if (!room.state) return;
  const mod = GAMES[room.game];
  if (mod.turnPlayer) {
    const tp = mod.turnPlayer(room.state);
    const p = tp && room.players.find(x => x.id === tp);
    if (tp && (!p || p.isBot)) {
      const delay = typeof mod.botDelay === 'function' ? mod.botDelay(room.state) : 1100;
      room.botTimer = setTimeout(() => { room.botTimer = null; autoMove(room, tp); }, delay);
    }
  }
  if (mod.botReaction && !room.reactTimer) {
    const r = mod.botReaction(room.state, id => { const p = room.players.find(x => x.id === id); return !p || p.isBot; });
    if (r) {
      room.reactTimer = setTimeout(() => {
        room.reactTimer = null;
        if (!room.state) return;
        if (!mod.action(room.state, r.id, r.action, ctxFor(room, r.id))) afterChange(room);
      }, r.delay);
    }
  }
}
function autoMove(room, pid) {
  if (!room.state) return;
  const mod = GAMES[room.game];
  if (mod.turnPlayer(room.state) !== pid) return;
  const a = mod.botAction(room.state, pid);
  if (a) {
    const err = mod.action(room.state, pid, a, ctxFor(room, pid));
    if (err) console.warn('bot action rejected:', err, a);
  }
  afterChange(room);
}

// ---------- sockets ----------
io.on('connection', socket => {
  let room = null;
  let player = null;
  let lastChat = 0;

  const reply = cb => (typeof cb === 'function' ? cb : () => {});

  function bind(r, p) {
    room = r; player = p;
    p.socketId = socket.id; p.connected = true; p.disconnectedAt = null;
    socket.join(r.code);
  }
  function leave() {
    if (!room) return;
    const r = room, p = player;
    room = null; player = null;
    socket.leave(r.code);
    if (p.inCall) { p.inCall = false; p.cam = false; io.to(r.code).emit('rtc:left', { id: p.id }); }
    const mod = r.game && GAMES[r.game];
    const inGame = r.state && (r.participants || []).includes(p.id) && !mod.isOver(r.state);
    if (inGame) {
      // keep the seat so the game can continue: a bot takes over
      p.isBot = true; p.ghost = true; p.connected = false; p.socketId = null;
      p.origName = p.name; p.name = p.name + ' (bot)';
      sysMsg(r, `${p.origName} left — a bot is playing for them`);
    } else {
      r.players = r.players.filter(x => x !== p);
      sysMsg(r, `${p.name} left the room`);
    }
    if (!r.players.some(x => !x.isBot)) return destroyRoom(r);
    if (r.hostId === p.id) pickHost(r);
    afterChange(r);
  }
  function hostOnly(cb) {
    if (!room) { reply(cb)({ error: 'You are not in a room' }); return false; }
    if (room.hostId !== player.id) { reply(cb)({ error: 'Only the host can do that' }); return false; }
    return true;
  }

  socket.on('room:create', (data = {}, cb) => {
    const name = clean(data.name, 16);
    if (!name) return reply(cb)({ error: 'Please enter your name first' });
    if (room) leave();
    const r = {
      code: makeCode(), hostId: null, players: [], selectedGame: 'colorclash', options: GAMES.colorclash.defaultOptions(),
      game: null, state: null, participants: [], chat: [], botTimer: null, reactTimer: null, emptySince: null, teamsOn: false, gameTeams: false,
    };
    rooms.set(r.code, r);
    const p = addHuman(r, name, data.avatar, clean(data.token, 64));
    r.hostId = p.id;
    bind(r, p);
    sysMsg(r, `${p.name} created the room. Share the code ${r.code} with friends!`);
    reply(cb)({ ok: true, code: r.code, you: p.id });
    socket.emit('chat:history', r.chat);
    broadcast(r);
  });

  socket.on('room:join', (data = {}, cb) => {
    const code = clean(data.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const r = rooms.get(code);
    if (!r) return reply(cb)({ error: `No room found with code "${code}". Check the code and try again.` });
    const token = clean(data.token, 64);
    let p = token ? r.players.find(x => x.token === token) : null;
    if (p) {
      if (room && room !== r) leave();
      if (p.ghost) { // came back after leaving mid-game
        p.ghost = false; p.isBot = false; p.name = p.origName || p.name;
        sysMsg(r, `${p.name} is back!`);
      }
      bind(r, p);
    } else {
      const name = clean(data.name, 16);
      if (!name) return reply(cb)({ error: 'Please enter your name first' });
      if (r.players.length >= MAX_PLAYERS) return reply(cb)({ error: 'Sorry, that room is full (10 players max).' });
      if (room) leave();
      p = addHuman(r, name, data.avatar, token);
      bind(r, p);
      sysMsg(r, `${p.name} joined the room`);
    }
    reply(cb)({ ok: true, code: r.code, you: p.id });
    socket.emit('chat:history', r.chat);
    broadcast(r);
  });

  socket.on('room:leave', (_d, cb) => { leave(); reply(cb)({ ok: true }); });

  socket.on('room:select', (data = {}, cb) => {
    if (!hostOnly(cb)) return;
    if (room.state) return reply(cb)({ error: 'Finish or end the current game first' });
    if (!GAMES[data.game]) return reply(cb)({ error: 'That game is not available yet' });
    room.selectedGame = data.game;
    room.options = GAMES[data.game].defaultOptions();
    if (!GAMES[data.game].supportsBots) room.players = room.players.filter(p => !p.isBot);
    if (!GAMES[data.game].supportsTeams) { room.teamsOn = false; room.players.forEach(p => { p.team = null; }); }
    reply(cb)({ ok: true });
    broadcast(room);
  });

  socket.on('room:option', (data = {}, cb) => {
    if (!hostOnly(cb)) return;
    if (room.state) return reply(cb)({ error: 'Cannot change options during a game' });
    const opt = GAMES[room.selectedGame].optionsSchema.find(o => o.key === data.key);
    if (!opt || !opt.choices.some(c => c.value === data.value)) return reply(cb)({ error: 'Invalid option' });
    room.options[data.key] = data.value;
    reply(cb)({ ok: true });
    broadcast(room);
  });

  socket.on('room:teams', (data = {}, cb) => {
    if (!hostOnly(cb)) return;
    if (room.state) return reply(cb)({ error: 'Set up teams between games' });
    if (!GAMES[room.selectedGame].supportsTeams) return reply(cb)({ error: `${GAMES[room.selectedGame].name} doesn't have teams` });
    room.teamsOn = !!data.on;
    room.players.forEach((p, i) => { p.team = room.teamsOn ? (i % 2 ? 'B' : 'A') : null; });
    if (room.teamsOn) sysMsg(room, '👥 Teams are on: 🔴 Red vs 🔵 Blue');
    reply(cb)({ ok: true });
    broadcast(room);
  });

  socket.on('room:setTeam', (data = {}, cb) => {
    if (!room) return reply(cb)({ error: 'You are not in a room' });
    if (room.state) return reply(cb)({ error: 'Switch teams between games' });
    if (!room.teamsOn) return reply(cb)({ error: 'Teams are off' });
    const target = room.players.find(p => p.id === (data.id || player.id));
    if (!target) return reply(cb)({ error: 'Player not found' });
    if (target.id !== player.id && room.hostId !== player.id) return reply(cb)({ error: 'Only the host can move other players' });
    if (!['A', 'B'].includes(data.team)) return reply(cb)({ error: 'Pick a team' });
    target.team = data.team;
    reply(cb)({ ok: true });
    broadcast(room);
  });

  // ── voice / video call signaling (peer-to-peer WebRTC; the server only relays messages)
  socket.on('rtc:join', (data = {}, cb) => {
    if (!room) return reply(cb)({ error: 'Join a room first' });
    player.inCall = true; player.mic = data.mic !== false; player.cam = !!data.cam;
    reply(cb)({ ok: true });
    broadcast(room);
  });
  socket.on('rtc:leave', () => {
    if (!room || !player.inCall) return;
    player.inCall = false; player.cam = false;
    io.to(room.code).emit('rtc:left', { id: player.id });
    broadcast(room);
  });
  socket.on('rtc:media', (data = {}) => {
    if (!room || !player.inCall) return;
    player.mic = data.mic !== false; player.cam = !!data.cam;
    broadcast(room);
  });
  socket.on('rtc:signal', (data = {}) => {
    if (!room || !player.inCall || !data || typeof data !== 'object') return;
    const target = room.players.find(p => p.id === data.to);
    if (!target || !target.inCall || !target.socketId) return;
    io.to(target.socketId).emit('rtc:signal', { from: player.id, data: data.data });
  });

  socket.on('room:addBot', (_d, cb) => {
    if (!hostOnly(cb)) return;
    const mod = GAMES[room.selectedGame];
    if (room.state) return reply(cb)({ error: 'Add bots between games' });
    if (!mod.supportsBots) return reply(cb)({ error: `${mod.name} doesn't use bots` });
    if (room.players.length >= Math.min(MAX_PLAYERS, mod.maxPlayers)) return reply(cb)({ error: 'No more seats available' });
    addBot(room);
    reply(cb)({ ok: true });
    broadcast(room);
  });

  socket.on('room:remove', (data = {}, cb) => {
    if (!hostOnly(cb)) return;
    if (room.state) return reply(cb)({ error: 'You can remove players between games' });
    const target = room.players.find(p => p.id === data.id);
    if (!target || target.id === player.id) return reply(cb)({ error: 'Cannot remove that player' });
    room.players = room.players.filter(p => p !== target);
    if (!target.isBot) {
      if (target.socketId) {
        const s = io.sockets.sockets.get(target.socketId);
        if (s) { s.emit('kicked'); s.leave(room.code); }
      }
      sysMsg(room, `${target.name} was removed by the host`);
    }
    reply(cb)({ ok: true });
    broadcast(room);
  });

  socket.on('room:start', (_d, cb) => {
    if (!hostOnly(cb)) return;
    const mod = GAMES[room.selectedGame];
    if (room.state && !GAMES[room.game].isOver(room.state)) return reply(cb)({ error: 'A game is already running' });
    room.players = room.players.filter(p => !p.ghost);
    const seats = room.players;
    if (seats.length < mod.minPlayers) return reply(cb)({ error: `${mod.name} needs at least ${mod.minPlayers} players${mod.supportsBots ? ' — add a bot!' : ''}` });
    if (seats.length > mod.maxPlayers) return reply(cb)({ error: `${mod.name} allows at most ${mod.maxPlayers} players` });
    const teams = !!(room.teamsOn && mod.supportsTeams);
    if (teams && (!seats.some(p => p.team === 'A') || !seats.some(p => p.team === 'B'))) return reply(cb)({ error: 'Each team needs at least one player' });
    room.game = room.selectedGame;
    room.participants = seats.map(p => p.id);
    room.gameTeams = teams;
    room.state = mod.create(seats.map(p => ({ id: p.id, name: p.name, isBot: p.isBot, team: teams ? p.team : null })), { ...room.options, teams });
    sysMsg(room, `🎮 ${mod.name} has started!`);
    reply(cb)({ ok: true });
    afterChange(room);
  });

  socket.on('room:lobby', (_d, cb) => {
    if (!hostOnly(cb)) return;
    clearTimeout(room.botTimer); clearTimeout(room.reactTimer);
    room.botTimer = room.reactTimer = null;
    room.state = null; room.game = null; room.participants = []; room.gameTeams = false;
    room.players = room.players.filter(p => !p.ghost);
    reply(cb)({ ok: true });
    broadcast(room);
  });

  socket.on('game:action', (action, cb) => {
    if (!room || !room.state) return reply(cb)({ error: 'No game is running' });
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') return reply(cb)({ error: 'Bad action' });
    const mod = GAMES[room.game];
    let err;
    try { err = mod.action(room.state, player.id, action, ctxFor(room, player.id)); } catch (e) { console.error(e); err = 'Something went wrong'; }
    if (err) return reply(cb)({ error: err });
    reply(cb)({ ok: true });
    afterChange(room);
  });

  // high-frequency, non-authoritative updates (e.g. player positions in arcade games)
  socket.on('game:stream', data => {
    if (!room || !room.state || !data || typeof data !== 'object') return;
    const mod = GAMES[room.game];
    if (!mod.streams || !(room.participants || []).includes(player.id)) return;
    socket.to(room.code).volatile.emit('game:stream', { id: player.id, d: data });
  });

  socket.on('chat', text => {
    if (!room) return;
    const now = Date.now();
    if (now - lastChat < 350) return;
    lastChat = now;
    const t = clean(text, 300);
    if (!t) return;
    pushChat(room, { from: player.id, name: player.name, avatar: player.avatar, color: player.color, text: t });
  });

  socket.on('disconnect', () => {
    if (!room || !player || player.socketId !== socket.id) return;
    player.connected = false;
    if (player.inCall) { player.inCall = false; player.cam = false; io.to(room.code).emit('rtc:left', { id: player.id }); }
    player.disconnectedAt = Date.now();
    broadcast(room);
  });
});

// game clocks (timers, countdowns, level changes)
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (!room.state) continue;
    const mod = GAMES[room.game];
    if (!mod.tick) continue;
    try { if (mod.tick(room.state, now, ctxFor(room, null))) afterChange(room); } catch (e) { console.error('tick error', e); }
  }
}, 250);

// housekeeping: host hand-off, auto-play for disconnected players, cleanup
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const online = humansConnected(room);
    if (!online.length) {
      room.emptySince = room.emptySince || now;
      if (now - room.emptySince > 30 * 60 * 1000) destroyRoom(room);
      continue;
    }
    room.emptySince = null;
    const host = room.players.find(p => p.id === room.hostId);
    if (!host || (!host.connected && now - host.disconnectedAt > 30000)) { pickHost(room); broadcast(room); }
    if (room.state && !room.botTimer) {
      const mod = GAMES[room.game];
      const tp = mod.turnPlayer && mod.turnPlayer(room.state);
      const p = tp && room.players.find(x => x.id === tp);
      if (p && !p.isBot && !p.connected && now - p.disconnectedAt > 20000) autoMove(room, tp);
    }
  }
}, 2000);

server.listen(PORT, () => console.log(`🌍 Tony's World running on http://localhost:${PORT}`));
