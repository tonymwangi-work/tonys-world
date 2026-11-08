'use strict';
// Snakes & Ladders — the traditional race up the board.
const { pushLog } = require('./util');

const VINES = { 3: 22, 8: 26, 19: 38, 28: 55, 36: 44, 50: 69, 57: 76, 72: 92, 80: 98 };
const SLIDES = { 16: 6, 33: 12, 47: 25, 62: 41, 66: 52, 74: 53, 88: 67, 95: 73, 97: 79 };

module.exports = {
  name: 'Snakes & Ladders',
  minPlayers: 1,
  maxPlayers: 6,
  supportsBots: true,
  optionsSchema: [
    { key: 'exact', label: 'Finishing', choices: [{ value: 'bounce', label: 'Exact roll (bounce back)' }, { value: 'any', label: 'Any roll reaches 100' }] },
    { key: 'six', label: 'Rolling a 6', choices: [{ value: 'again', label: 'Roll again' }, { value: 'normal', label: 'No bonus' }] },
  ],
  defaultOptions: () => ({ exact: 'bounce', six: 'again' }),
  board: { vines: VINES, slides: SLIDES },

  create(players, opts) {
    return {
      players: players.map(p => p.id), names: Object.fromEntries(players.map(p => [p.id, p.name])),
      pos: Object.fromEntries(players.map(p => [p.id, 0])), turn: 0, phase: 'play', winner: null,
      lastEvent: null, seq: 0, log: [], logSeq: 0, rolls: Object.fromEntries(players.map(p => [p.id, 0])),
      opts: { exact: opts.exact || 'bounce', six: opts.six || 'again' },
    };
  },
  isOver: s => s.phase === 'over',
  turnPlayer: s => (s.phase === 'play' ? s.players[s.turn] : null),
  botDelay(s) {
    const e = s.lastEvent;
    if (!e) return 1200;
    return 1000 + e.path.length * 230 + (e.jump ? 900 : 0);
  },

  action(s, pid, a) {
    if (s.phase !== 'play') return 'The game is over';
    if (a.type !== 'roll') return 'Unknown move';
    if (s.players[s.turn] !== pid) return 'Wait for your turn';
    const roll = 1 + Math.floor(Math.random() * 6);
    const from = s.pos[pid];
    const path = [];
    let p = from;
    let bounced = false;
    for (let i = 0; i < roll; i++) {
      if (p === 100) { bounced = true; }
      if (bounced) p--; else p++;
      if (s.opts.exact === 'any' && p > 100) p = 100;
      path.push(p);
      if (s.opts.exact === 'any' && p === 100) break;
    }
    let to = p;
    let jump = null;
    if (VINES[to]) jump = { kind: 'vine', from: to, to: VINES[to] };
    else if (SLIDES[to]) jump = { kind: 'slide', from: to, to: SLIDES[to] };
    if (jump) to = jump.to;
    s.pos[pid] = to;
    s.rolls[pid]++;
    const name = s.names[pid];
    let msg = `${name} rolled ${roll} → ${to}`;
    if (jump && jump.kind === 'vine') msg = `🪜 ${name} rolled ${roll} and climbed a ladder from ${jump.from} to ${jump.to}!`;
    if (jump && jump.kind === 'slide') msg = `🐍 ${name} rolled ${roll} and got bitten by a snake — down from ${jump.from} to ${jump.to}!`;
    if (bounced) msg += ' (bounced back)';
    pushLog(s, msg);
    s.lastEvent = { seq: ++s.seq, player: pid, roll, from, path, jump, to };
    if (to === 100) {
      s.phase = 'over';
      s.winner = pid;
      pushLog(s, `🏆 ${name} reached square 100 and wins!`);
      return;
    }
    if (!(roll === 6 && s.opts.six === 'again')) s.turn = (s.turn + 1) % s.players.length;
    else pushLog(s, `🎲 Six! ${name} rolls again`);
  },
  botAction: () => ({ type: 'roll' }),
  view(s) {
    return {
      players: s.players.map(id => ({ id, name: s.names[id], pos: s.pos[id], rolls: s.rolls[id] })),
      turnId: s.players[s.turn], phase: s.phase, winner: s.winner, lastEvent: s.lastEvent,
      log: s.log.slice(-8), board: { vines: VINES, slides: SLIDES }, opts: s.opts,
    };
  },
};
