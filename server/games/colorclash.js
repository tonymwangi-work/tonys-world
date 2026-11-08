'use strict';
// Color Clash — a color & number matching card game.
const { shuffle, pushLog } = require('./util');

const COLORS = ['red', 'yellow', 'green', 'blue'];
const COLOR_NAMES = { red: 'Cherry', yellow: 'Sunny', green: 'Mint', blue: 'Ocean' };
const LABEL = { skip: 'Block', flip: 'Flip', draw2: '+2', wild: 'Color Change', wild4: 'Color Change +4' };

function makeDeck() {
  let id = 0;
  const d = [];
  for (const c of COLORS) {
    d.push({ id: id++, color: c, value: '0' });
    for (let n = 1; n <= 9; n++) for (let k = 0; k < 2; k++) d.push({ id: id++, color: c, value: String(n) });
    for (const v of ['skip', 'flip', 'draw2']) for (let k = 0; k < 2; k++) d.push({ id: id++, color: c, value: v });
  }
  for (let i = 0; i < 4; i++) {
    d.push({ id: id++, color: 'wild', value: 'wild' });
    d.push({ id: id++, color: 'wild', value: 'wild4' });
  }
  return shuffle(d);
}
function cardName(c, chosen) {
  if (c.color === 'wild') return `${LABEL[c.value]}${chosen ? ' (' + COLOR_NAMES[chosen] + ')' : ''}`;
  return `${COLOR_NAMES[c.color]} ${LABEL[c.value] || c.value}`;
}
function points(c) {
  if (c.color === 'wild') return 50;
  if (/^\d$/.test(c.value)) return Number(c.value);
  return 20;
}
function top(s) { return s.discard[s.discard.length - 1]; }
function playable(s, c) {
  if (s.pending > 0) return c.value === 'wild4' || (c.value === 'draw2' && top(s).value === 'draw2');
  return c.color === 'wild' || c.color === s.color || c.value === top(s).value;
}
function idxStep(s, steps) {
  const n = s.players.length;
  return (((s.turn + s.dir * steps) % n) + n) % n;
}
function drawCards(s, pid, n) {
  const got = [];
  for (let i = 0; i < n; i++) {
    if (!s.deck.length) {
      const t = s.discard.pop();
      s.deck = shuffle(s.discard);
      s.discard = [t];
    }
    if (!s.deck.length) break;
    const c = s.deck.pop();
    s.hands[pid].push(c);
    got.push(c);
  }
  if (s.hands[pid].length > 1) delete s.vulnerable[pid];
  if (s.hands[pid].length > 2) s.declared[pid] = false;
  return got;
}
function endTurn(s, steps) {
  s.turn = idxStep(s, steps);
  s.drawnCardId = null;
}
function ev(s, e) { s.lastEvent = { seq: ++s.seq, ...e }; }

module.exports = {
  name: 'Color Clash',
  minPlayers: 2,
  maxPlayers: 10,
  supportsBots: true,
  optionsSchema: [
    { key: 'handSize', label: 'Starting cards', choices: [{ value: 5, label: '5 (quick)' }, { value: 7, label: '7 (classic)' }, { value: 10, label: '10 (long)' }] },
    { key: 'stacking', label: 'Stack +2 / +4', choices: [{ value: 'on', label: 'On — pass the pain along!' }, { value: 'off', label: 'Off' }] },
    { key: 'clashRule', label: 'Call "Clash!" rule', choices: [{ value: 'on', label: 'On — get caught, draw 2' }, { value: 'off', label: 'Off' }] },
  ],
  defaultOptions: () => ({ handSize: 7, stacking: 'on', clashRule: 'on' }),

  create(players, opts) {
    const s = {
      players: players.map(p => p.id), names: Object.fromEntries(players.map(p => [p.id, p.name])),
      hands: {}, deck: makeDeck(), discard: [], color: null, dir: 1, turn: 0, drawnCardId: null,
      declared: {}, vulnerable: {}, pending: 0, phase: 'play', winner: null, scores: null, log: [], logSeq: 0, seq: 0, lastEvent: null,
      opts: { handSize: opts.handSize || 7, clashRule: opts.clashRule || 'on', stacking: opts.stacking || 'on' },
    };
    for (const id of s.players) { s.hands[id] = []; drawCards(s, id, s.opts.handSize); }
    // first card: a number card
    let i = s.deck.findIndex(c => /^\d$/.test(c.value));
    const first = s.deck.splice(i, 1)[0];
    s.discard.push(first);
    s.color = first.color;
    s.turn = Math.floor(Math.random() * s.players.length);
    pushLog(s, `First card: ${cardName(first)}. ${s.names[s.players[s.turn]]} goes first.`);
    return s;
  },

  isOver: s => s.phase === 'over',
  turnPlayer: s => (s.phase === 'play' ? s.players[s.turn] : null),
  botDelay: () => 900 + Math.random() * 700,

  action(s, pid, a) {
    if (s.phase !== 'play') return 'The game is over';
    if (!s.players.includes(pid)) return 'You are watching this game';
    const hand = s.hands[pid];
    const name = s.names[pid];

    if (a.type === 'clash') {
      if (hand.length > 2) return 'You can only call Clash! when you have 2 cards or fewer';
      if (s.declared[pid] && !s.vulnerable[pid]) return;
      s.declared[pid] = true;
      delete s.vulnerable[pid];
      pushLog(s, `📣 ${name} shouts "CLASH!"`);
      ev(s, { type: 'clash', player: pid });
      return;
    }
    if (a.type === 'catch') {
      const t = a.target;
      if (!s.vulnerable[t]) return 'Too late — they are safe!';
      if (t === pid) return 'You cannot catch yourself';
      drawCards(s, t, 2);
      delete s.vulnerable[t];
      pushLog(s, `🚨 ${name} caught ${s.names[t]} not calling Clash! +2 cards`);
      ev(s, { type: 'caught', player: t, by: pid });
      return;
    }

    if (s.players[s.turn] !== pid) return 'Wait for your turn';

    if (a.type === 'draw') {
      if (s.drawnCardId !== null) return 'You already drew — play it or pass';
      if (s.pending > 0) {
        const k = s.pending;
        s.pending = 0;
        drawCards(s, pid, k);
        pushLog(s, `😵 ${name} takes ${k} cards!`);
        ev(s, { type: 'take', player: pid, count: k });
        endTurn(s, 1);
        return;
      }
      const [c] = drawCards(s, pid, 1);
      ev(s, { type: 'draw', player: pid });
      if (c && playable(s, c)) {
        s.drawnCardId = c.id;
        if (s.opts.clashRule === 'off' || hand.length > 2) s.declared[pid] = false;
      } else {
        pushLog(s, `${name} drew a card and passed`);
        endTurn(s, 1);
      }
      return;
    }
    if (a.type === 'pass') {
      if (s.drawnCardId === null) return 'Draw a card first';
      pushLog(s, `${name} drew a card and passed`);
      endTurn(s, 1);
      return;
    }
    if (a.type === 'play') {
      const i = hand.findIndex(c => c.id === a.cardId);
      if (i < 0) return 'That card is not in your hand';
      const c = hand[i];
      if (s.drawnCardId !== null && c.id !== s.drawnCardId) return 'You can only play the card you just drew (or pass)';
      if (!playable(s, c)) return s.pending > 0
        ? `Stack a ${top(s).value === 'draw2' ? '+2 or ' : ''}+4 card, or take ${s.pending} cards from the deck`
        : `That doesn't match — play a ${COLOR_NAMES[s.color]} card or a ${top(s).value} card`;
      if (c.color === 'wild' && !COLORS.includes(a.color)) return 'Pick a color for your Color Change card';
      hand.splice(i, 1);
      s.discard.push(c);
      s.color = c.color === 'wild' ? a.color : c.color;
      pushLog(s, `${name} played ${cardName(c, c.color === 'wild' ? a.color : null)}`);
      ev(s, { type: 'play', player: pid, card: c });

      if (hand.length === 0) {
        s.phase = 'over';
        s.winner = pid;
        s.scores = s.players.map(id => ({ id, cards: s.hands[id].length, points: s.hands[id].reduce((t, x) => t + points(x), 0) }));
        s.scores.find(x => x.id === pid).points = s.scores.reduce((t, x) => t + x.points, 0);
        pushLog(s, `🏆 ${name} wins the round!`);
        return;
      }
      if (hand.length === 1 && s.opts.clashRule === 'on' && !s.declared[pid]) s.vulnerable[pid] = true;

      const n = s.players.length;
      let steps = 1;
      if (c.value === 'skip') {
        steps = 2;
        pushLog(s, `⛔ ${s.names[s.players[idxStep(s, 1)]]} is blocked`);
      } else if (c.value === 'flip') {
        if (n === 2) steps = 2;
        else s.dir *= -1;
      } else if ((c.value === 'draw2' || c.value === 'wild4') && s.opts.stacking === 'on') {
        s.pending += c.value === 'draw2' ? 2 : 4;
        pushLog(s, `🔥 ${s.names[s.players[idxStep(s, 1)]]} must stack or take ${s.pending}!`);
      } else if (c.value === 'draw2' || c.value === 'wild4') {
        const k = c.value === 'draw2' ? 2 : 4;
        const victim = s.players[idxStep(s, 1)];
        drawCards(s, victim, k);
        pushLog(s, `${s.names[victim]} draws ${k} and is skipped`);
        steps = 2;
      }
      endTurn(s, steps);
      return;
    }
    return 'Unknown move';
  },

  botAction(s, pid) {
    const hand = s.hands[pid];
    const pickColor = () => {
      const count = { red: 0, yellow: 0, green: 0, blue: 0 };
      for (const c of hand) if (c.color !== 'wild') count[c.color]++;
      return Object.entries(count).sort((a, b) => b[1] - a[1])[0][1] > 0
        ? Object.entries(count).sort((a, b) => b[1] - a[1])[0][0]
        : COLORS[Math.floor(Math.random() * 4)];
    };
    if (s.opts.clashRule === 'on' && hand.length <= 2 && !s.declared[pid] && Math.random() < 0.85) {
      const willPlay = s.drawnCardId !== null || hand.some(c => playable(s, c));
      if (willPlay && hand.length === 2) return { type: 'clash' };
    }
    if (s.drawnCardId !== null) {
      const c = hand.find(x => x.id === s.drawnCardId);
      return { type: 'play', cardId: c.id, color: pickColor() };
    }
    const options = hand.filter(c => playable(s, c));
    if (!options.length) return { type: 'draw' };
    options.sort((a, b) => {
      const rank = c => (c.color === 'wild' ? (c.value === 'wild4' ? 4 : 3) : /^\d$/.test(c.value) ? 0 : 1);
      return rank(a) - rank(b) || (b.color === s.color) - (a.color === s.color);
    });
    const c = options[0];
    return { type: 'play', cardId: c.id, color: pickColor() };
  },

  // bots sometimes catch a player who forgot to call Clash!
  botReaction(s, isBot) {
    if (s.phase !== 'play') return null;
    const target = Object.keys(s.vulnerable).find(id => s.vulnerable[id]);
    if (!target) return null;
    const bots = s.players.filter(id => id !== target && isBot(id));
    if (!bots.length) return null;
    return { id: bots[Math.floor(Math.random() * bots.length)], action: { type: 'catch', target }, delay: 2500 + Math.random() * 2500 };
  },

  view(s, pid) {
    const me = s.players.includes(pid) ? pid : null;
    const myTurn = me && s.players[s.turn] === me && s.phase === 'play';
    return {
      players: s.players.map(id => ({ id, name: s.names[id], count: s.hands[id].length, vulnerable: !!s.vulnerable[id], declared: !!s.declared[id] })),
      hand: me ? s.hands[me] : null,
      pending: s.pending,
      playable: myTurn ? s.hands[me].filter(c => (s.drawnCardId === null || c.id === s.drawnCardId) && playable(s, c)).map(c => c.id) : [],
      top: top(s), color: s.color, dir: s.dir, turnId: s.players[s.turn], drawnCardId: myTurn ? s.drawnCardId : null,
      deckCount: s.deck.length, phase: s.phase, winner: s.winner, scores: s.scores,
      log: s.log.slice(-8), lastEvent: s.lastEvent, clashRule: s.opts.clashRule,
    };
  },
};
