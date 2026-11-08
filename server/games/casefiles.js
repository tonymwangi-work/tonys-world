'use strict';
// Case Files — co-op or competitive murder mysteries.
const CASES = require('../cases');
const { pushLog } = require('./util');

const byId = Object.fromEntries(CASES.map(c => [c.id, c]));

function newFile() {
  return { found: [], searched: [], asked: [], notes: [], actions: 0, log: [], logSeq: 0 };
}
function caseOf(s) { return byId[s.caseId]; }
function fileKey(s, pid) { return s.mode === 'coop' ? 'team' : pid; }
function reveal(s, file, pid) {
  // reveal every evidence item at searched locations whose requirements are now met
  const c = caseOf(s);
  const fresh = [];
  for (const e of c.evidence) {
    if (file.found.includes(e.id)) continue;
    if (e.location !== 'file' && !file.searched.includes(e.location)) continue;
    if (e.requires && !e.requires.every(r => file.found.includes(r))) continue;
    file.found.push(e.id);
    fresh.push(e);
  }
  return fresh;
}
function rankFor(correct, actions, par) {
  if (correct === 3 && actions <= par) return { title: 'Chief Inspector', stars: 3 };
  if (correct === 3 && actions <= Math.round(par * 1.6)) return { title: 'Detective Inspector', stars: 2 };
  if (correct === 3) return { title: 'Detective Sergeant', stars: 1 };
  if (correct === 2) return { title: 'Constable — so close!', stars: 0 };
  return { title: 'Case Unsolved', stars: 0 };
}
function majority(votes, key) {
  const count = {};
  for (const v of votes) count[v[key]] = (count[v[key]] || 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
}
function resolveCoop(s) {
  const c = caseOf(s);
  const votes = Object.values(s.votes);
  const answer = { culprit: majority(votes, 'culprit'), weapon: majority(votes, 'weapon'), motive: majority(votes, 'motive') };
  const correct = ['culprit', 'weapon', 'motive'].filter(k => answer[k] === c.solution[k]).length;
  s.phase = 'solved';
  s.result = { answer, correct, rank: rankFor(correct, s.files.team.actions, c.par) };
}

module.exports = {
  name: 'Case Files',
  minPlayers: 1,
  maxPlayers: 10,
  supportsBots: false,
  optionsSchema: [
    { key: 'caseId', label: 'Case', choices: CASES.map(c => ({ value: c.id, label: `${c.emoji} ${c.title} (${c.difficulty})` })) },
    { key: 'mode', label: 'Mode', choices: [{ value: 'coop', label: '🤝 Co-op team investigation' }, { value: 'race', label: '🏁 Race to solve' }] },
  ],
  defaultOptions: () => ({ caseId: CASES[0].id, mode: 'coop' }),

  create(players, opts) {
    const s = {
      caseId: byId[opts.caseId] ? opts.caseId : CASES[0].id, mode: opts.mode === 'race' ? 'race' : 'coop',
      players: players.map(p => p.id), names: Object.fromEntries(players.map(p => [p.id, p.name])),
      files: {}, votes: {}, accused: {}, phase: 'investigating', result: null, winner: null, noteSeq: 0,
    };
    const keys = s.mode === 'coop' ? ['team'] : s.players;
    for (const k of keys) { s.files[k] = newFile(); reveal(s, s.files[k]); }
    return s;
  },
  isOver: s => s.phase === 'solved',
  turnPlayer: () => null,

  action(s, pid, a, ctx) {
    const c = caseOf(s);
    if (!s.players.includes(pid)) return 'You are watching this case';
    if (s.phase === 'solved') return 'This case is closed';
    if (s.mode === 'race' && s.accused[pid]) return 'You already made your accusation';
    const file = s.files[fileKey(s, pid)];
    const name = s.names[pid];

    switch (a.type) {
      case 'search': {
        const loc = c.locations.find(l => l.id === a.location);
        if (!loc) return 'Unknown location';
        if (!file.searched.includes(loc.id)) file.searched.push(loc.id);
        const fresh = reveal(s, file, pid);
        file.actions++;
        const what = fresh.length ? fresh.map(e => e.name).join(', ') : 'nothing new';
        pushLog(file, `🔍 ${name} searched ${loc.name}: ${what}`);
        file.lastFound = { by: pid, ids: fresh.map(e => e.id), seq: (file.lastFound?.seq || 0) + 1 };
        return;
      }
      case 'ask': {
        const sus = c.suspects.find(x => x.id === a.suspect);
        const q = sus && sus.questions.find(x => x.id === a.question);
        if (!q) return 'Unknown question';
        if (file.asked.includes(q.id)) return 'You already asked that';
        if (q.requires && !q.requires.every(r => file.found.includes(r))) return 'You need more evidence before asking that';
        file.asked.push(q.id);
        file.actions++;
        pushLog(file, `🗣️ ${name} questioned ${sus.name}: "${q.q}"`);
        return;
      }
      case 'note': {
        const text = String(a.text || '').replace(/[\u0000-\u0009\u000b-\u001f]/g, '').trim().slice(0, 240);
        if (!text) return 'Write something first';
        if (file.notes.length >= 60) return 'The board is full — remove some notes';
        const colors = ['yellow', 'pink', 'blue', 'green'];
        file.notes.push({ id: ++s.noteSeq, by: pid, name, text, color: colors.includes(a.color) ? a.color : 'yellow' });
        return;
      }
      case 'unnote': {
        const i = file.notes.findIndex(n => n.id === a.id);
        if (i < 0) return 'Note not found';
        file.notes.splice(i, 1);
        return;
      }
      case 'accuse': {
        const ok = c.suspects.some(x => x.id === a.culprit) && c.weapons.some(x => x.id === a.weapon) && c.motives.some(x => x.id === a.motive);
        if (!ok) return 'Choose a suspect, a weapon and a motive';
        const vote = { culprit: a.culprit, weapon: a.weapon, motive: a.motive };
        if (s.mode === 'coop') {
          s.votes[pid] = vote;
          pushLog(file, `⚖️ ${name} locked in an accusation`);
          const voters = ctx.humans.filter(id => s.players.includes(id));
          if (voters.length && voters.every(id => s.votes[id])) resolveCoop(s);
          return;
        }
        // race
        s.accused[pid] = vote;
        const correct = ['culprit', 'weapon', 'motive'].every(k => vote[k] === c.solution[k]);
        if (correct) {
          s.phase = 'solved';
          s.winner = pid;
          s.result = { correct: 3, rank: rankFor(3, file.actions, c.par) };
        } else {
          const remaining = s.players.filter(id => !s.accused[id] && ctx.humans.includes(id));
          if (!remaining.length) { s.phase = 'solved'; s.result = { correct: 0, rank: rankFor(0, 0, c.par) }; }
        }
        return;
      }
      case 'reveal': {
        if (s.mode !== 'coop') return 'Not available in race mode';
        if (!ctx.isHost) return 'Only the host can close the case';
        if (!Object.keys(s.votes).length) return 'At least one detective must make an accusation first';
        resolveCoop(s);
        return;
      }
    }
    return 'Unknown action';
  },

  view(s, pid) {
    const c = caseOf(s);
    const key = s.players.includes(pid) ? fileKey(s, pid) : (s.mode === 'coop' ? 'team' : null);
    const file = key ? s.files[key] : null;
    const found = new Set(file ? file.found : []);
    const solved = s.phase === 'solved';
    const v = {
      mode: s.mode, phase: s.phase,
      case: {
        id: c.id, title: c.title, tagline: c.tagline, emoji: c.emoji, difficulty: c.difficulty, intro: c.intro, victim: c.victim, par: c.par,
        locations: c.locations,
        suspects: c.suspects.map(x => ({
          id: x.id, name: x.name, role: x.role, emoji: x.emoji, bio: x.bio,
          questions: x.questions.filter(q => !q.requires || q.requires.every(r => found.has(r))).map(q => ({
            id: q.id, q: q.q, a: file && file.asked.includes(q.id) ? q.a : null,
          })),
          locked: x.questions.filter(q => q.requires && !q.requires.every(r => found.has(r))).length,
        })),
        weapons: c.weapons, motives: c.motives,
        locationTotals: Object.fromEntries(c.locations.map(l => [l.id, c.evidence.filter(e => e.location === l.id).length])),
      },
      file: file && {
        found: file.found.map(id => c.evidence.find(e => e.id === id)),
        searched: file.searched, actions: file.actions, notes: file.notes, log: file.log.slice(-25), lastFound: file.lastFound || null,
      },
      votes: s.mode === 'coop' ? Object.keys(s.votes) : [],
      myVote: s.votes[pid] || s.accused[pid] || null,
      accused: Object.keys(s.accused),
      players: s.players.map(id => ({ id, name: s.names[id], actions: s.mode === 'race' ? s.files[id].actions : undefined, found: s.mode === 'race' ? s.files[id].found.length : undefined })),
      winner: s.winner,
      totalEvidence: c.evidence.length,
    };
    if (solved) {
      v.solution = c.solution;
      v.result = s.result;
      v.allVotes = s.mode === 'coop' ? s.votes : s.accused;
    }
    return v;
  },
};
