'use strict';
// Barrel Climb — race your friends up the girders while Big Bolt throws barrels.
// Barrels are simulated identically on every client from a shared seed + level clock,
// so the server only runs the level timeline and keeps score.
const { pushLog } = require('./util');

const LEVELS = 3;
const COUNTDOWN_MS = 4000;
const LEVEL_MS = 120000;
const RESULTS_MS = 7000;
const FINISH_POINTS = [1000, 700, 500, 400, 300, 200];

function newLevel(s, now) {
  s.level++;
  s.seed = Math.floor(Math.random() * 1e9);
  s.phase = 'countdown';
  s.phaseEnd = now + COUNTDOWN_MS;
  s.startAt = null;
  s.finished = [];
  for (const id of s.players) { s.p[id].done = false; s.p[id].levelPts = 0; }
}

module.exports = {
  name: 'Barrel Climb',
  minPlayers: 1,
  maxPlayers: 6,
  supportsBots: false,
  streams: true,
  optionsSchema: [
    { key: 'levels', label: 'Levels', choices: [{ value: 1, label: '1 (quick)' }, { value: 3, label: '3 (classic)' }, { value: 5, label: '5 (marathon)' }] },
  ],
  defaultOptions: () => ({ levels: LEVELS }),

  create(players, opts) {
    const s = {
      players: players.map(p => p.id), names: Object.fromEntries(players.map(p => [p.id, p.name])),
      p: Object.fromEntries(players.map(p => [p.id, { score: 0, jumps: 0, deaths: 0, done: false, levelPts: 0, lastJump: 0 }])),
      level: 0, levels: [1, 3, 5].includes(opts.levels) ? opts.levels : LEVELS,
      phase: 'countdown', phaseEnd: 0, startAt: null, seed: 1, finished: [], winner: null, log: [], logSeq: 0,
    };
    newLevel(s, Date.now());
    return s;
  },
  isOver: s => s.phase === 'over',

  tick(s, now, ctx) {
    if (s.phase === 'countdown' && now >= s.phaseEnd) {
      s.phase = 'playing'; s.startAt = now; s.phaseEnd = now + LEVEL_MS;
      return true;
    }
    if (s.phase === 'playing') {
      const active = s.players.filter(id => ctx.humans.includes(id));
      const allDone = active.length > 0 && active.every(id => s.p[id].done);
      if (allDone || now >= s.phaseEnd) {
        s.phase = 'results'; s.phaseEnd = now + RESULTS_MS;
        pushLog(s, allDone ? `Level ${s.level} complete!` : `Time's up on level ${s.level}!`);
        return true;
      }
    }
    if (s.phase === 'results' && now >= s.phaseEnd) {
      if (s.level >= s.levels) {
        s.phase = 'over';
        s.winner = [...s.players].sort((a, b) => s.p[b].score - s.p[a].score)[0];
        pushLog(s, `🏆 ${s.names[s.winner]} wins Barrel Climb!`);
      } else newLevel(s, now);
      return true;
    }
    return false;
  },

  action(s, pid, a) {
    if (!s.players.includes(pid)) return 'You are watching this game';
    const me = s.p[pid];
    if (s.phase !== 'playing') return 'Not now';
    const now = Date.now();
    switch (a.type) {
      case 'jumped': // jumped over a barrel
        if (me.done || now - me.lastJump < 250) return;
        me.lastJump = now; me.jumps++; me.score += 100; me.levelPts += 100;
        return;
      case 'died':
        if (me.done) return;
        me.deaths++;
        return;
      case 'finish': {
        if (me.done) return;
        me.done = true;
        s.finished.push(pid);
        const place = s.finished.length;
        const timeBonus = Math.max(0, Math.floor((s.phaseEnd - now) / 1000)) * 5;
        const pts = (FINISH_POINTS[place - 1] || 100) + timeBonus;
        me.score += pts; me.levelPts += pts;
        pushLog(s, `${['🥇', '🥈', '🥉'][place - 1] || '🏁'} ${s.names[pid]} reached the trophy! +${pts}`);
        return;
      }
    }
    return 'Unknown action';
  },

  view(s) {
    const now = Date.now();
    return {
      phase: s.phase, level: s.level, levels: s.levels, seed: s.seed,
      elapsed: s.startAt ? now - s.startAt : 0,
      remaining: Math.max(0, s.phaseEnd - now),
      players: s.players.map(id => ({ id, name: s.names[id], ...s.p[id], lastJump: undefined, place: s.finished.indexOf(id) + 1 })),
      winner: s.winner, log: s.log.slice(-6),
    };
  },
};
