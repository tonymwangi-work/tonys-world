'use strict';
// Higher or Lower — is the next one higher or lower? Spotify, Instagram, TikTok, YouTube, X, Play Store, box office.
const DATA = require('../hilo-data');
const { shuffle, pushLog } = require('./util');

const CATS = Object.keys(DATA);
const GUESS_MS = { turns: 20000, together: 15000 };
const REVEAL_MS = Number(process.env.HILO_REVEAL_MS) || 4200;
const TEAM_LABEL = { A: '🔴 Red Team', B: '🔵 Blue Team' };

function item(cat, i) { const [name, value, emoji] = DATA[cat].items[i]; return { cat, i, name, value, emoji }; }
// pick a challenging next item: same category, different value, ideally within ~1.7x of the current one
function nextItem(s, cur) {
  const items = DATA[cur.cat].items;
  const pool = items.map((_, i) => i).filter(i => i !== cur.i && items[i][1] !== cur.value && !s.recent.includes(cur.cat + i));
  const close = pool.filter(i => { const r = items[i][1] / cur.value; return r > 0.58 && r < 1.72; });
  const pickFrom = close.length && Math.random() < 0.8 ? close : pool.length ? pool : items.map((_, i) => i).filter(i => items[i][1] !== cur.value);
  const i = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  s.recent.push(cur.cat + i);
  if (s.recent.length > 14) s.recent.shift();
  return item(cur.cat, i);
}
function freshPair(s) {
  let cat = s.category;
  if (cat === 'mixed') {
    const options = CATS.filter(c => c !== s.lastCat);
    cat = options[Math.floor(Math.random() * options.length)];
  }
  s.lastCat = cat;
  s.catRounds = 0;
  const idx = shuffle(DATA[cat].items.map((_, i) => i)).find(i => !s.recent.includes(cat + i)) ?? 0;
  s.left = item(cat, idx);
  s.recent.push(cat + idx);
  s.right = nextItem(s, s.left);
}
function aliveUnits(s) { return s.units.filter(u => s.mode !== 'turns' || s.lives[u] > 0); }
function startRound(s, now, chain) {
  s.round++;
  if (chain && !(s.category === 'mixed' && s.catRounds >= 3)) { s.left = s.right; s.right = nextItem(s, s.left); s.catRounds++; }
  else freshPair(s);
  s.phase = 'guess';
  s.guesses = {};
  s.deadline = now + GUESS_MS[s.mode];
}
function reveal(s, now) {
  const answer = s.right.value > s.left.value ? 'higher' : 'lower';
  const results = {};
  const units = s.mode === 'turns' ? [s.units[s.turn]] : aliveUnits(s);
  let anyRight = false;
  for (const u of units) {
    const g = s.guesses[u] || null;
    const right = g === answer;
    results[u] = { guess: g, right };
    if (right) {
      anyRight = true;
      s.streak[u]++;
      s.score[u] += 1 + (s.streak[u] % 3 === 0 ? 1 : 0); // bonus point every 3 in a row
    } else {
      s.streak[u] = 0;
      if (s.mode === 'turns') s.lives[u]--;
    }
  }
  s.last = { left: s.left, right: s.right, answer, results, anyRight };
  if (s.mode === 'turns') {
    const u = s.units[s.turn];
    pushLog(s, `${results[u].right ? '✅' : '❌'} ${s.unitName[u]} said ${results[u].guess || 'nothing'} — ${s.right.name} is ${answer}`);
  } else pushLog(s, `${s.right.name} is ${answer}! ${Object.values(results).filter(r => r.right).length}/${units.length} got it`);
  s.phase = 'reveal';
  s.deadline = now + REVEAL_MS;
}
function finish(s) {
  s.phase = 'over';
  const ranked = [...s.units].sort((a, b) => s.score[b] - s.score[a] || (s.lives[b] || 0) - (s.lives[a] || 0));
  s.winner = s.score[ranked[0]] === (ranked[1] !== undefined ? s.score[ranked[1]] : -1) && s.mode !== 'turns' ? null : ranked[0];
  pushLog(s, s.winner ? `🏆 ${s.unitName[s.winner]} wins!` : '🤝 It\'s a draw!');
}
function nextTurn(s) {
  const n = s.units.length;
  for (let k = 1; k <= n; k++) {
    const i = (s.turn + k) % n;
    if (s.lives[s.units[i]] > 0) { s.turn = i; return; }
  }
}

module.exports = {
  name: 'Higher or Lower',
  minPlayers: 1,
  maxPlayers: 10,
  supportsBots: true,
  supportsTeams: true,
  teamNote: 'Teams play in "Everyone at once" mode: each team agrees on one answer per round, talking in a private voice channel.',
  optionsSchema: [
    { key: 'category', label: 'Category', choices: [{ value: 'mixed', label: '🎲 Mixed (everything)' }, ...CATS.map(c => ({ value: c, label: `${DATA[c].emoji} ${DATA[c].label}` }))] },
    { key: 'mode', label: 'How to play', choices: [{ value: 'together', label: '⚡ Everyone at once' }, { value: 'turns', label: '🔁 Take turns (3 lives)' }] },
    { key: 'rounds', label: 'Rounds (everyone at once)', choices: [{ value: 10, label: '10' }, { value: 15, label: '15' }, { value: 20, label: '20' }] },
  ],
  defaultOptions: () => ({ category: 'mixed', mode: 'together', rounds: 10 }),

  create(players, opts) {
    const mode = opts.mode === 'turns' && !opts.teams ? 'turns' : 'together';
    const teams = !!opts.teams;
    const units = teams ? ['A', 'B'] : players.map(p => p.id);
    const s = {
      mode, teams, category: DATA[opts.category] ? opts.category : 'mixed', maxRounds: [10, 15, 20].includes(opts.rounds) ? opts.rounds : 10,
      players: players.map(p => p.id), names: Object.fromEntries(players.map(p => [p.id, p.name])),
      bots: players.filter(p => p.isBot).map(p => p.id),
      units, unitOf: Object.fromEntries(players.map(p => [p.id, teams ? p.team : p.id])),
      unitName: Object.fromEntries(units.map(u => [u, teams ? TEAM_LABEL[u] : players.find(p => p.id === u).name])),
      members: Object.fromEntries(units.map(u => [u, players.filter(p => (teams ? p.team : p.id) === u).map(p => p.id)])),
      score: Object.fromEntries(units.map(u => [u, 0])), streak: Object.fromEntries(units.map(u => [u, 0])),
      lives: Object.fromEntries(units.map(u => [u, 3])), lockedBy: {},
      turn: Math.floor(Math.random() * units.length), round: 0, phase: 'guess', deadline: 0, guesses: {},
      left: null, right: null, last: null, recent: [], lastCat: null, catRounds: 0, winner: null, log: [], logSeq: 0,
    };
    startRound(s, Date.now(), false);
    return s;
  },
  isOver: s => s.phase === 'over',
  turnPlayer: s => (s.mode === 'turns' && s.phase === 'guess' ? s.units[s.turn] : null),
  botDelay: () => 1800 + Math.random() * 1800,
  privateTalk: (s, pid) => s.teams && s.phase === 'guess' && !s.guesses[s.unitOf[pid]],

  tick(s, now, ctx) {
    if (s.phase === 'over' || now < s.deadline) return false;
    if (s.phase === 'guess') { reveal(s, now); return true; }
    // reveal finished → next round
    if (s.mode === 'turns') {
      const alive = aliveUnits(s);
      if (alive.length === 0 || (s.units.length > 1 && alive.length === 1) || s.round >= 80) { finish(s); return true; }
      const wasRight = s.last.anyRight;
      nextTurn(s);
      startRound(s, now, wasRight);
    } else {
      if (s.round >= s.maxRounds) { finish(s); return true; }
      startRound(s, now, true);
    }
    return true;
  },

  action(s, pid, a, ctx) {
    if (!s.players.includes(pid)) return 'You are watching this game';
    if (a.type !== 'guess') return 'Unknown move';
    if (s.phase !== 'guess') return 'Wait for the next round';
    if (!['higher', 'lower'].includes(a.choice)) return 'Higher or lower?';
    const u = s.unitOf[pid];
    if (s.mode === 'turns' && s.units[s.turn] !== u) return 'Wait for your turn';
    if (s.guesses[u]) return s.teams ? 'Your team already locked in an answer' : 'You already guessed';
    s.guesses[u] = a.choice;
    s.lockedBy[u] = pid;
    const humans = ctx ? ctx.humans : s.players;
    const waiting = s.mode === 'turns' ? [] : aliveUnits(s).filter(x => !s.guesses[x] && s.members[x].some(id => humans.includes(id) || s.bots.includes(id)));
    if (!waiting.length) reveal(s, Date.now());
  },

  // a bot's guess: better at spotting big differences, like a real person
  botAction(s, pid) {
    const ratio = Math.abs(Math.log(s.right.value / s.left.value));
    const pRight = 0.55 + 0.35 * Math.min(1, ratio / Math.log(3));
    const answer = s.right.value > s.left.value ? 'higher' : 'lower';
    return { type: 'guess', choice: Math.random() < pRight ? answer : answer === 'higher' ? 'lower' : 'higher' };
  },
  botReaction(s, isBot) {
    if (s.mode !== 'together' || s.phase !== 'guess') return null;
    for (const u of s.units) {
      if (s.guesses[u]) continue;
      const members = s.members[u];
      if (!members.every(isBot)) continue; // humans on a team make the call
      return { id: members[0], action: this.botAction(s, members[0]), delay: 2500 + Math.random() * 4000 };
    }
    return null;
  },

  view(s, pid) {
    const cat = DATA[s.left.cat];
    const hide = s.phase === 'guess';
    const myUnit = s.unitOf[pid] || null;
    return {
      mode: s.mode, teams: s.teams, phase: s.phase, round: s.round, maxRounds: s.maxRounds, remaining: Math.max(0, s.deadline - Date.now()),
      cat: { key: s.left.cat, label: cat.label, emoji: cat.emoji, unit: cat.unit, color: cat.color, approx: cat.approx, money: !!cat.money, plus: !!cat.plus },
      left: s.left, right: hide ? { cat: s.right.cat, name: s.right.name, emoji: s.right.emoji } : s.right,
      myUnit, turnUnit: s.mode === 'turns' ? s.units[s.turn] : null,
      units: s.units.map(u => ({
        id: u, name: s.unitName[u], members: s.members[u], score: s.score[u], streak: s.streak[u], lives: s.mode === 'turns' ? s.lives[u] : null,
        locked: !!s.guesses[u], lockedBy: s.guesses[u] ? s.names[s.lockedBy[u]] : null,
        guess: (!hide || u === myUnit) ? s.guesses[u] || null : null,
      })),
      last: s.phase !== 'guess' ? s.last : null, winner: s.winner, log: s.log.slice(-6),
    };
  },
};
