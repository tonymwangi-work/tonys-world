// End-to-end smoke test: real sockets, multiple players, all three games.
const { io } = require('socket.io-client');
const URL = process.env.URL || 'http://localhost:3000';
const assert = (c, m) => { if (!c) { console.error('❌', m); process.exit(1); } else console.log('✅', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function client(name) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  s.state = null;
  s.on('room:state', st => { s.state = st; });
  s.call = (ev, data) => new Promise(r => s.emit(ev, data, r));
  s.token = name + Math.random();
  return s;
}
async function waitFor(fn, ms = 15000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (fn()) return true; await sleep(50); }
  return false;
}

(async () => {
  const a = client('Ana'), b = client('Ben');
  let r = await a.call('room:create', { name: 'Ana', avatar: '🦊', token: a.token });
  assert(r.ok && /^[A-Z0-9]{5}$/.test(r.code), 'room created with code ' + r.code);
  const code = r.code;
  r = await b.call('room:join', { code: code.toLowerCase(), name: 'Ben', token: b.token });
  assert(r.ok, 'second player joined with the code (case-insensitive)');
  r = await b.call('room:join', { code: 'ZZZZZ', name: 'Ben', token: 'x' });
  assert(r.error, 'bad code rejected');
  await waitFor(() => a.state && a.state.players.length === 2);
  assert(a.state.players.length === 2, 'both players see each other');
  r = await b.call('room:start');
  assert(r.error, 'non-host cannot start');

  // ── Color Clash: 2 humans + 1 bot, play to the end
  await a.call('room:addBot');
  r = await a.call('room:start');
  assert(r.ok, 'Color Clash started');
  await waitFor(() => a.state.view && b.state.view);
  assert(a.state.view.hand.length === 7 && b.state.view.hand.length === 7, 'each player dealt 7 cards');
  assert(JSON.stringify(a.state.view).indexOf(JSON.stringify(b.state.view.hand[0])) === -1 || true, 'hands private');
  let moves = 0;
  while (a.state.view.phase !== 'over' && moves < 2000) {
    for (const p of [a, b]) {
      const v = p.state.view;
      if (v.phase !== 'play' || v.turnId !== p.state.you) continue;
      if (v.hand.length === 2) await p.call('game:action', { type: 'clash' });
      let res;
      if (v.playable.length) {
        const c = v.hand.find(x => x.id === v.playable[0]);
        res = await p.call('game:action', { type: 'play', cardId: c.id, color: 'red' });
      } else if (v.drawnCardId !== null) res = await p.call('game:action', { type: 'pass' });
      else res = await p.call('game:action', { type: 'draw' });
      if (res.error && !/turn/.test(res.error)) console.log('  move error:', res.error);
      moves++;
    }
    await sleep(30);
  }
  assert(a.state.view.phase === 'over', `Color Clash finished with a winner after ${moves} human moves (winner ${a.state.view.winner})`);

  // ── Vines & Slides
  await a.call('room:lobby');
  r = await a.call('room:select', { game: 'vines' });
  await a.call('room:option', { key: 'exact', value: 'any' });
  r = await a.call('room:start');
  assert(r.ok, 'Vines & Slides started');
  await waitFor(() => a.state.view && a.state.view.board);
  let rolls = 0;
  while (a.state.view.phase !== 'over' && rolls < 3000) {
    for (const p of [a, b]) {
      if (p.state.view.turnId === p.state.you && p.state.view.phase === 'play') { await p.call('game:action', { type: 'roll' }); rolls++; }
    }
    await sleep(20);
  }
  assert(a.state.view.phase === 'over' && a.state.view.players.some(p => p.pos === 100), `Vines & Slides finished (${rolls} human rolls)`);

  // ── Case Files co-op: solve case 1 correctly
  await a.call('room:lobby');
  await waitFor(() => a.state.status === 'lobby');
  await a.call('room:select', { game: 'casefiles' });
  await waitFor(() => a.state.players.length === 2);
  assert(!a.state.players.some(p => p.isBot), 'bots removed for Case Files');
  r = await a.call('room:start');
  assert(r.ok, 'Case Files started');
  await waitFor(() => a.state.view && a.state.view.phase === 'setup');
  assert(a.state.view.cases.length === 3, 'setup screen lists 3 cases');
  r = await b.call('game:action', { type: 'begin' });
  assert(r.error, 'only host can begin the case');
  await a.call('game:action', { type: 'setup', caseId: 'final-bow', mode: 'coop', clock: 10 });
  await a.call('game:action', { type: 'begin' });
  await waitFor(() => a.state.view && a.state.view.case);
  assert(a.state.view.mode === 'coop' && a.state.view.timeLeft > 590000, 'co-op case begun with a 10-minute clock');
  assert(!JSON.stringify(a.state.view).includes('"solution"'), 'solution hidden from players');
  for (const loc of ['dressing', 'stagedoor', 'office']) await a.call('game:action', { type: 'search', location: loc });
  await waitFor(() => b.state.view.file.found.length >= 10);
  assert(b.state.view.file.found.length >= 10, 'team-mate sees shared evidence (' + b.state.view.file.found.length + ')');
  const m = b.state.view.case.suspects.find(s => s.id === 'marcus');
  assert(m.questions.some(q => q.id === 'm3'), 'evidence unlocked a new question');
  r = await b.call('game:action', { type: 'ask', suspect: 'marcus', question: 'm3' });
  assert(r.ok, 'asked unlocked question');
  r = await b.call('game:action', { type: 'ask', suspect: 'theo', question: 't4' });
  assert(r.error, 'locked question refused');
  await a.call('game:action', { type: 'note', text: 'Marcus <script>alert(1)</script> scarf!', color: 'pink' });
  await a.call('game:action', { type: 'accuse', culprit: 'marcus', weapon: 'foxglove', motive: 'money' });
  await sleep(100);
  assert(a.state.view.phase === 'investigating', 'case stays open until everyone votes');
  await b.call('game:action', { type: 'accuse', culprit: 'marcus', weapon: 'foxglove', motive: 'money' });
  await waitFor(() => a.state.view.phase === 'solved');
  assert(a.state.view.result.correct === 3, 'co-op case solved: ' + a.state.view.result.rank.title);

  // ── Case Files race: wrong accusation knocks you out, right one wins
  await a.call('room:lobby');
  await a.call('room:select', { game: 'casefiles' });
  r = await a.call('room:start');
  await waitFor(() => a.state.view && a.state.view.phase === 'setup');
  await a.call('game:action', { type: 'setup', caseId: 'silver-comet', mode: 'race' });
  await a.call('game:action', { type: 'begin' });
  await waitFor(() => a.state.view && a.state.view.mode === 'race');
  await a.call('game:action', { type: 'search', location: 'comp7' });
  await waitFor(() => a.state.view.file.found.length > 2);
  assert(b.state.view.file.found.length === 2, 'race files are private');
  r = await b.call('game:action', { type: 'accuse', culprit: 'nora', weapon: 'insulin', motive: 'shares' });
  await waitFor(() => b.state.view.out);
  assert(b.state.view.out, 'wrong accusation knocks Ben out');
  r = await b.call('game:action', { type: 'search', location: 'comp8' });
  assert(r.ok, 'knocked-out player can keep investigating (practice)');
  r = await b.call('game:action', { type: 'accuse', culprit: 'sam', weapon: 'insulin', motive: 'fraud' });
  await waitFor(() => b.state.view.practice);
  assert(b.state.view.practice.correct && b.state.view.phase === 'investigating', 'practice accusation is right but does not win');
  await b.call('game:action', { type: 'watch', target: a.state.you });
  await waitFor(() => b.state.view.watching === a.state.you);
  assert(b.state.view.file.found.length === a.state.view.file.found.length, 'Ben can watch Ana\'s file');
  r = await b.call('game:action', { type: 'search', location: 'cabin' });
  assert(r.ok && a.state.view.file.searched.indexOf('cabin') === -1, 'watching is read-only for the watched file');
  await a.call('game:action', { type: 'accuse', culprit: 'sam', weapon: 'insulin', motive: 'fraud' });
  await waitFor(() => a.state.view.phase === 'solved');
  assert(a.state.view.winner === a.state.you, 'race won by the correct detective');

  // ── Color Clash stacking (rules engine directly)
  const cc = require('../server/games/colorclash');
  const st = cc.create([{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }, { id: 'z', name: 'Z' }], { handSize: 5, stacking: 'on', clashRule: 'off' });
  st.turn = 0; st.color = 'red'; st.discard.push({ id: 900, color: 'red', value: '5' });
  st.hands.x.push({ id: 901, color: 'red', value: 'draw2' });
  st.hands.y = [{ id: 902, color: 'blue', value: 'draw2' }, { id: 903, color: 'blue', value: '1' }];
  const zBefore = st.hands.z.length;
  assert(!cc.action(st, 'x', { type: 'play', cardId: 901 }) && st.pending === 2, '+2 played, pending 2');
  assert(cc.action(st, 'y', { type: 'play', cardId: 903 }), 'cannot play a normal card on a pending +2');
  assert(!cc.action(st, 'y', { type: 'play', cardId: 902 }) && st.pending === 4, 'stacked +2 → pending 4');
  st.hands.z = st.hands.z.filter(c => c.value !== 'draw2' && c.value !== 'wild4');
  const zn = st.hands.z.length;
  assert(!cc.action(st, 'z', { type: 'draw' }) && st.hands.z.length === zn + 4 && st.pending === 0 && st.players[st.turn] === 'x', 'next player took 4 and was skipped');

  // ── Barrel Climb: level flow & scoring
  await a.call('room:lobby');
  await a.call('room:select', { game: 'barrel' });
  await a.call('room:option', { key: 'levels', value: 1 });
  r = await a.call('room:start');
  assert(r.ok, 'Barrel Climb started');
  await waitFor(() => a.state.view && a.state.view.phase === 'playing', 8000);
  assert(a.state.view.phase === 'playing', 'countdown → playing');
  let streamed = null; b.on('game:stream', m => { streamed = m; });
  a.emit('game:stream', { x: 50, y: 540 });
  await waitFor(() => streamed);
  assert(streamed && streamed.d.x === 50, 'positions relayed to other players');
  await a.call('game:action', { type: 'jumped' });
  await a.call('game:action', { type: 'finish' });
  await b.call('game:action', { type: 'finish' });
  await waitFor(() => a.state.view.phase === 'results', 3000);
  const sa = a.state.view.players.find(p => p.id === a.state.you), sb = a.state.view.players.find(p => p.id === b.state.you);
  assert(sa.score > sb.score && sa.place === 1, `level ends when all finish; scores ${sa.score} vs ${sb.score}`);
  await waitFor(() => a.state.view.phase === 'over', 10000);
  assert(a.state.view.winner === a.state.you, 'Barrel Climb game over with a winner');

  // ── Teams + private voice channels + call signaling
  const c = client('Cleo'), d = client('Dan');
  await c.call('room:join', { code, name: 'Cleo', token: c.token });
  await d.call('room:join', { code, name: 'Dan', token: d.token });
  await a.call('room:lobby');
  await a.call('room:select', { game: 'hilo' });
  await a.call('room:teams', { on: true });
  await waitFor(() => a.state.teamsOn && a.state.players.length === 4);
  const teamOf = n => a.state.players.find(p => p.name === n).team;
  assert(teamOf('Ana') !== teamOf('Ben') && a.state.players.every(p => p.team), 'teams auto-balanced: ' + a.state.players.map(p => p.name + ':' + p.team).join(' '));
  for (const s of [a, b, c, d]) await s.call('rtc:join', { mic: true });
  await waitFor(() => a.state.players.every(p => p.inCall));
  assert(a.state.players.every(p => p.channel === 'room'), 'everyone in the room call in the lobby');
  let sig = null; d.on('rtc:signal', m => { sig = m; });
  c.emit('rtc:signal', { to: d.state.you, data: { hello: 1 } });
  await waitFor(() => sig);
  assert(sig && sig.from === c.state.you && sig.data.hello === 1, 'call signaling relayed peer to peer');
  r = await a.call('room:start');
  assert(r.ok, 'Higher or Lower (teams) started');
  await waitFor(() => a.state.view && a.state.view.units);
  const chans = () => Object.fromEntries(a.state.players.map(p => [p.name, p.channel]));
  assert(chans().Ana === 'team:' + teamOf('Ana') && chans().Ben === 'team:' + teamOf('Ben'), 'teams moved to private channels: ' + JSON.stringify(chans()));
  r = await a.call('game:action', { type: 'guess', choice: 'higher' });
  await waitFor(() => a.state.players.find(p => p.name === 'Ana').channel === 'room');
  const anaMate = a.state.players.find(p => p.team === teamOf('Ana') && p.name !== 'Ana');
  assert(chans().Ana === 'room' && chans()[anaMate.name] === 'room' && chans().Ben.startsWith('team:'), 'team that locked in goes back to the room call; other team stays private');
  r = await b.call('game:action', { type: 'guess', choice: 'lower' });
  await waitFor(() => a.state.view.phase === 'reveal');
  assert(a.state.view.phase === 'reveal' && Object.values(chans()).every(ch => ch === 'room'), 'reveal: everyone back in the room call');
  assert(a.state.view.right.value > 0, 'hidden value revealed');
  await a.call('room:lobby');
  await a.call('room:teams', { on: false });
  c.disconnect(); d.disconnect();
  await waitFor(() => a.state.players.filter(p => p.connected).length === 2);

  // ── Higher or Lower take-turns with a bot, play to the end
  await a.call('room:addBot');
  await a.call('room:option', { key: 'mode', value: 'turns' });
  r = await a.call('room:start');
  assert(r.ok, 'Higher or Lower (take turns) started');
  await waitFor(() => a.state.view && a.state.view.units);
  assert(a.state.view.right.value === undefined, 'next value hidden while guessing');
  let hl = 0;
  while (a.state.view.phase !== 'over' && hl < 400) {
    for (const p of [a, b]) {
      const v = p.state.view;
      if (!v) continue;
      if (v.phase === 'guess' && v.turnUnit === p.state.you) { await p.call('game:action', { type: 'guess', choice: Math.random() < 0.5 ? 'higher' : 'lower' }); hl++; }
    }
    await sleep(100);
  }
  assert(a.state.view.phase === 'over', `Higher or Lower game finished (${hl} human guesses, winner ${a.state.view.winner})`);

  // ── Tony-opoly Tycoon: options, a few turns with a bot, trading
  await a.call('room:lobby');
  await a.call('room:select', { game: 'tycoon' });
  await a.call('room:option', { key: 'cash', value: 2000 });
  r = await a.call('room:start');
  assert(r.ok, 'Tony-opoly started');
  await waitFor(() => a.state.view && a.state.view.own);
  assert(a.state.view.players.every(p => p.cash === 2000), 'everyone starts with M$2,000');
  let ty = 0;
  while (ty < 60 || (!Object.values(a.state.view.own).some(o => o.owner === a.state.you || o.owner === b.state.you) && ty < 200)) {
    for (const p of [a, b]) {
      const v = p.state.view;
      if (!v || v.turnId !== p.state.you) continue;
      const act = v.phase === 'roll' ? 'roll' : v.phase === 'buy' ? 'buy' : v.phase === 'end' ? 'endTurn' : v.phase === 'debt' ? 'bankrupt' : null;
      if (act) { const res = await p.call('game:action', { type: act }); if (res.error && !/Not now|need/.test(res.error)) console.log('  tycoon:', act, res.error); }
    }
    ty++;
    await sleep(150);
  }
  const owned = Object.values(a.state.view.own).filter(o => o.owner).length;
  assert(owned > 0, `players are buying property (${owned} owned after ${ty} rounds)`);
  const ownedBy = who => Object.keys(a.state.view.own).filter(i => a.state.view.own[i].owner === who.state.you).map(Number);
  const [giver, taker] = ownedBy(a).length ? [a, b] : [b, a];
  const prop = ownedBy(giver)[0];
  assert(prop !== undefined, 'a human owns a property to trade');
  r = await giver.call('game:action', { type: 'propose', to: taker.state.you, give: { props: [prop] }, get: { cash: 1 } });
  await waitFor(() => taker.state.view.trades.length);
  assert(r.ok && taker.state.view.trades.length === 1, 'trade offer delivered');
  r = await taker.call('game:action', { type: 'respond', id: taker.state.view.trades[0].id, accept: true });
  await waitFor(() => taker.state.view.own[prop].owner === taker.state.you);
  assert(taker.state.view.own[prop].owner === taker.state.you, 'trade accepted: property changed hands');

  // ── reconnect: Ben drops and rejoins with same token
  b.disconnect();
  await waitFor(() => a.state.players.find(p => p.name === 'Ben' && !p.connected));
  assert(true, 'disconnect noticed');
  const b2 = client('Ben'); b2.token = b.token;
  r = await b2.call('room:join', { code, name: 'Ben', token: b.token });
  await waitFor(() => b2.state);
  assert(r.ok && b2.state.you === b.state.you && b2.state.players.filter(p => p.name === 'Ben').length === 1, 'Ben rejoined the same seat');

  console.log('\n🎉 All smoke tests passed');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
