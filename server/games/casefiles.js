'use strict';
// Case Files — co-op or competitive murder mysteries.
const CASES = require('../cases');
const { pushLog } = require('./util');

const byId = Object.fromEntries(CASES.map(c => [c.id, c]));

function newFile() {
  return { found: [], searched: [], asked: [], notes: [], actions: 0, log: [], logSeq: 0 };
}
function caseOf(s) { return byId[s.caseId]; }
// whose case file a player works in: the shared team file (co-op), their team's file (team race) or their own (race)
function fileKey(s, pid) { return s.mode === 'coop' ? 'team' : s.teams ? 'T' + s.team[pid] : pid; }
const TEAM_LABEL = { TA: '🔴 Red Team', TB: '🔵 Blue Team' };
function keyLabel(s, key) { return TEAM_LABEL[key] || s.names[key] || 'Team'; }
function raceKeys(s) { return [...new Set(s.players.map(id => fileKey(s, id)))]; }
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
  supportsTeams: true,
  teamNote: 'With teams on, pick "Race each other" and it becomes Red vs Blue: each team shares a case file and talks in its own private voice channel.',
  optionsSchema: [],
  defaultOptions: () => ({}),

  create(players, opts = {}) {
    return {
      caseId: CASES[0].id, mode: opts.teams ? 'race' : 'coop', clock: 0, teams: !!opts.teams,
      team: Object.fromEntries(players.map(p => [p.id, p.team])),
      players: players.map(p => p.id), names: Object.fromEntries(players.map(p => [p.id, p.name])),
      files: {}, votes: {}, accused: {}, out: {}, practice: {}, watch: {}, phase: 'setup', result: null, winner: null, noteSeq: 0, deadline: null,
    };
  },
  isOver: s => s.phase === 'solved',
  turnPlayer: () => null,

  // team race: each team talks privately until it has made its accusation
  privateTalk: (s, pid) => s.teams && s.mode === 'race' && s.phase === 'investigating' && !s.out[fileKey(s, pid)],

  tick(s, now) {
    if (s.phase !== 'investigating' || !s.deadline || now < s.deadline) return false;
    if (s.mode === 'coop' && Object.keys(s.votes).length) resolveCoop(s);
    else { s.phase = 'solved'; s.result = { correct: 0, rank: rankFor(0, 0, caseOf(s).par) }; }
    s.result.timeout = true;
    return true;
  },

  action(s, pid, a, ctx) {
    if (!s.players.includes(pid)) return 'You are watching this case';
    if (s.phase === 'solved') return 'This case is closed';
    if (s.phase === 'setup') {
      if (a.type === 'setup') {
        if (!ctx.isHost) return 'The host makes the choices — suggest one in chat!';
        if (a.caseId !== undefined) { if (!byId[a.caseId]) return 'Unknown case'; s.caseId = a.caseId; }
        if (a.mode !== undefined) { if (!['coop', 'race'].includes(a.mode)) return 'Unknown mode'; s.mode = a.mode; }
        if (a.clock !== undefined) { if (![0, 10, 20, 30].includes(a.clock)) return 'Unknown clock'; s.clock = a.clock; }
        return;
      }
      if (a.type === 'begin') {
        if (!ctx.isHost) return 'Waiting for the host to begin';
        const keys = s.mode === 'coop' ? ['team'] : raceKeys(s);
        for (const k of keys) { s.files[k] = newFile(); reveal(s, s.files[k]); }
        s.phase = 'investigating';
        s.deadline = s.clock ? Date.now() + s.clock * 60000 : null;
        return;
      }
      return 'Choose a case first';
    }
    const c = caseOf(s);
    const key = fileKey(s, pid);
    const file = s.files[key];
    const name = s.names[pid];
    const isOut = s.mode === 'race' && s.out[key];

    switch (a.type) {
      case 'watch': {
        if (!isOut) return 'You can watch others after your accusation';
        if (a.target === null || a.target === undefined) { delete s.watch[pid]; return; }
        if (!s.files[a.target] || a.target === key) return 'Nothing to watch there';
        s.watch[pid] = a.target;
        return;
      }
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
        const correct = ['culprit', 'weapon', 'motive'].every(k => vote[k] === c.solution[k]);
        if (s.mode === 'coop') {
          s.votes[pid] = vote;
          pushLog(file, `⚖️ ${name} locked in an accusation`);
          const voters = ctx.humans.filter(id => s.players.includes(id));
          if (voters.length && voters.every(id => s.votes[id])) resolveCoop(s);
          return;
        }
        if (isOut) { // practice guess after being knocked out: just tells you if you were right
          s.practice[key] = { vote, correct, by: pid };
          pushLog(file, `🎯 ${name} made a practice accusation (doesn't count)`);
          return;
        }
        s.accused[key] = { ...vote, by: pid };
        if (correct) {
          s.phase = 'solved';
          s.winner = key;
          s.result = { correct: 3, rank: rankFor(3, file.actions, c.par) };
          return;
        }
        s.out[key] = true;
        pushLog(file, `❌ ${name}'s accusation was wrong`);
        const alive = raceKeys(s).filter(k => !s.out[k] && s.players.some(id => fileKey(s, id) === k && ctx.humans.includes(id)));
        if (!alive.length) { s.phase = 'solved'; s.result = { correct: 0, rank: rankFor(0, 0, c.par) }; }
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
    if (s.phase === 'setup') {
      return {
        phase: 'setup', setup: { caseId: s.caseId, mode: s.mode, clock: s.clock }, teams: s.teams,
        cases: CASES.map(c => ({ id: c.id, title: c.title, emoji: c.emoji, difficulty: c.difficulty, tagline: c.tagline, suspects: c.suspects.length, victim: c.victim.name })),
        players: s.players.map(id => ({ id, name: s.names[id] })),
      };
    }
    const c = caseOf(s);
    const isPlayer = s.players.includes(pid);
    const myKey = isPlayer ? fileKey(s, pid) : null;
    const solved = s.phase === 'solved';
    // which file to show: your own, the one you're watching, or (spectators) the first one
    let showKey = myKey;
    if (isPlayer && s.watch[pid] && s.files[s.watch[pid]]) showKey = s.watch[pid];
    if (!isPlayer) showKey = s.mode === 'coop' ? 'team' : (solved ? raceKeys(s)[0] : null);
    const file = showKey ? s.files[showKey] : null;
    const found = new Set(file ? file.found : []);
    const v = {
      mode: s.mode, phase: s.phase, teams: s.teams, myKey, myLabel: myKey ? keyLabel(s, myKey) : null,
      watching: showKey !== myKey && isPlayer ? showKey : null, watchingLabel: showKey && showKey !== myKey ? keyLabel(s, showKey) : null,
      out: !!(myKey && s.out[myKey]), practice: myKey ? s.practice[myKey] || null : null,
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
      myVote: s.mode === 'coop' ? s.votes[pid] || null : (myKey && s.accused[myKey]) || null,
      racers: s.mode === 'race' ? raceKeys(s).map(k => ({ key: k, label: keyLabel(s, k), found: s.files[k] ? s.files[k].found.length : 0, actions: s.files[k] ? s.files[k].actions : 0, out: !!s.out[k] })) : [],
      winner: s.winner, winnerLabel: s.winner ? keyLabel(s, s.winner) : null, iWon: !!(s.winner && s.winner === myKey),
      players: s.players.map(id => ({ id, name: s.names[id] })),
      timeLeft: s.deadline && s.phase !== 'solved' ? Math.max(0, s.deadline - Date.now()) : null,
      clock: s.clock,
      totalEvidence: c.evidence.length,
    };
    if (solved) {
      v.solution = c.solution;
      v.result = s.result;
      v.allVotes = s.mode === 'coop'
        ? Object.fromEntries(Object.entries(s.votes).map(([id, x]) => [s.names[id], x]))
        : Object.fromEntries(Object.entries(s.accused).map(([k, x]) => [keyLabel(s, k), x]));
    }
    return v;
  },
};
