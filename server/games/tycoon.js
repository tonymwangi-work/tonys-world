'use strict';
// Tony-opoly Tycoon — property trading on Tony's Nairobi board.
const BOARD = require('../tycoon-board');
const { shuffle, pushLog } = require('./util');

const SP = BOARD.spaces.map((s, i) => ({ ...s, i, name: s.name.trim() }));
const BUYABLE = new Set(['property', 'station', 'utility']);
const HOUSE_COST = { brown: 50, lblue: 50, pink: 100, orange: 100, red: 150, yellow: 150, green: 200, dblue: 200 };
const GROUP = Object.fromEntries(BOARD.groups.map(g => [g.id, { ...g, members: SP.filter(s => s.type === 'property' && s.group === g.id).map(s => s.i) }]));
const STATIONS = SP.filter(s => s.type === 'station').map(s => s.i);
const UTILS = SP.filter(s => s.type === 'utility').map(s => s.i);
const corner = name => SP.find(s => s.type === 'corner' && s.name.toLowerCase() === name).i;
const START = 0, JAIL = corner('jail'), GOTO_JAIL = corner('go to jail'), VACATION = corner('vacation');
const GO_MONEY = 200, JAIL_FINE = 50;

// rent tables: interpolated from the classic price→rent curve
const CURVE = [
  [60, [2, 10, 30, 90, 160, 250]], [100, [6, 30, 90, 270, 400, 550]], [120, [8, 40, 100, 300, 450, 600]],
  [140, [10, 50, 150, 450, 625, 750]], [160, [12, 60, 180, 500, 700, 900]], [180, [14, 70, 200, 550, 750, 950]],
  [200, [16, 80, 220, 600, 800, 1000]], [220, [18, 90, 250, 700, 875, 1050]], [240, [20, 100, 300, 750, 925, 1100]],
  [280, [24, 120, 360, 850, 1025, 1200]], [320, [28, 150, 450, 1000, 1200, 1400]], [400, [50, 200, 600, 1400, 1700, 2000]],
];
function rentTable(price) {
  if (price <= CURVE[0][0]) return CURVE[0][1].map(r => Math.max(1, Math.round(r * price / CURVE[0][0])));
  for (let k = 1; k < CURVE.length; k++) {
    const [p1, r1] = CURVE[k - 1], [p2, r2] = CURVE[k];
    if (price <= p2) { const t = (price - p1) / (p2 - p1); return r1.map((r, j) => Math.round((r + (r2[j] - r) * t) / (j ? 5 : 1)) * (j ? 5 : 1)); }
  }
  return CURVE[CURVE.length - 1][1];
}
SP.forEach(s => { if (s.type === 'property') { s.rents = rentTable(s.price); s.houseCost = HOUSE_COST[s.group] || 100; } });

// ── cards
const nearest = (pos, list) => list.find(i => i > pos) ?? list[0];
const CHANCE = [
  { text: `Advance to ${SP[START].name}. Collect M$${GO_MONEY}.`, move: START },
  { text: `Advance to ${SP[39].name}.`, move: 39 },
  { text: `Advance to ${SP[24].name}. If you pass Start, collect M$${GO_MONEY}.`, move: 24 },
  { text: `Advance to ${SP[11].name}. If you pass Start, collect M$${GO_MONEY}.`, move: 11 },
  { text: 'Advance to the nearest station. If it is owned, pay the owner double rent.', nearest: 'station' },
  { text: 'Advance to the nearest station. If it is owned, pay the owner double rent.', nearest: 'station' },
  { text: 'Advance to the nearest utility. If it is owned, roll the dice and pay 10× the roll.', nearest: 'utility' },
  { text: 'The bank pays you a dividend of M$50.', money: 50 },
  { text: 'Get Out of Jail Free. Keep this card until you need it.', jailCard: true },
  { text: 'Go back 3 spaces.', back: 3 },
  { text: 'Go to Jail. Do not pass Start, do not collect M$200.', jail: true },
  { text: 'General repairs on all your property: pay M$25 per house and M$100 per hotel.', repairs: [25, 100] },
  { text: 'Matatu speeding fine: pay M$15.', money: -15 },
  { text: `Take a trip to ${SP[5].name}. If you pass Start, collect M$${GO_MONEY}.`, move: 5 },
  { text: 'You have been elected chairman of the chama. Pay each player M$50.', payEach: 50 },
  { text: 'Your building loan matures. Collect M$150.', money: 150 },
];
const CHEST = [
  { text: `Advance to ${SP[START].name}. Collect M$${GO_MONEY}.`, move: START },
  { text: 'Bank error in your favour. Collect M$200.', money: 200 },
  { text: "Doctor's fees: pay M$50.", money: -50 },
  { text: 'From sale of stock you get M$50.', money: 50 },
  { text: 'Get Out of Jail Free. Keep this card until you need it.', jailCard: true },
  { text: 'Go to Jail. Do not pass Start, do not collect M$200.', jail: true },
  { text: 'Holiday fund matures. Receive M$100.', money: 100 },
  { text: 'Tax refund. Collect M$20.', money: 20 },
  { text: "It's your birthday! Collect M$10 from every player.", collectEach: 10 },
  { text: 'Life insurance matures. Collect M$100.', money: 100 },
  { text: 'Hospital fees: pay M$100.', money: -100 },
  { text: 'School fees: pay M$50.', money: -50 },
  { text: 'Receive M$25 consultancy fee.', money: 25 },
  { text: 'You are assessed for street repairs: M$40 per house, M$115 per hotel.', repairs: [40, 115] },
  { text: 'You won second prize in a beauty contest. Collect M$10.', money: 10 },
  { text: 'You inherit M$100.', money: 100 },
  // Tony's specials
  { text: '"Pea Dofido mkate!!" Pay M$20.', money: -20 },
  { text: '"Birthday ya Mbavu, Manyoya!" Collect M$20.', money: 20 },
  { text: '"Ni Uchungu Sana." Pay every other player M$10.', payEach: 10 },
  { text: '"Like Rada sielewi afande!!" Go to Jail.', jail: true },
];
const GAMBLE_CARD = { text: '🎰 GAMBLING TIME!!!! Pick a player and bet on your roll: higher or lower than theirs. Win and you take 70% of their cash plus their 2 cheapest properties. Lose and you give them EVERYTHING.', gamble: true };

// ── helpers
const P = (s, id) => s.p[id];
const active = s => s.players.filter(id => !s.p[id].out);
const cur = s => s.players[s.turn];
const name = (s, id) => s.names[id];
const fmt = n => `M$${n}`;
const roll2 = () => [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
function ownsGroup(s, pid, g) { return GROUP[g].members.every(i => s.own[i].owner === pid); }
function groupHasBuildings(s, g) { return GROUP[g].members.some(i => s.own[i].houses > 0); }
function propsOf(s, pid) { return Object.keys(s.own).map(Number).filter(i => s.own[i].owner === pid); }
function netWorth(s, pid) {
  return P(s, pid).cash + propsOf(s, pid).reduce((t, i) => {
    const o = s.own[i], sp = SP[i];
    return t + (o.mortgaged ? sp.price / 2 : sp.price) + (o.houses ? o.houses * sp.houseCost / 2 : 0);
  }, 0);
}
function rentFor(s, i, diceTotal, mult = 1) {
  const o = s.own[i], sp = SP[i];
  if (!o.owner || o.mortgaged) return 0;
  if (sp.type === 'property') {
    if (o.houses) return sp.rents[o.houses];
    return sp.rents[0] * (ownsGroup(s, o.owner, sp.group) ? 2 : 1);
  }
  if (sp.type === 'station') {
    const n = STATIONS.filter(k => s.own[k].owner === o.owner).length;
    return 25 * 2 ** (n - 1) * mult;
  }
  const n = UTILS.filter(k => s.own[k].owner === o.owner).length;
  return diceTotal * (mult > 1 ? 10 : n >= 2 ? 10 : 4);
}
function ev(s, e) { s.events.push({ seq: ++s.seq, ...e }); if (s.events.length > 30) s.events.shift(); }

// give a property to a player (with its buildings); celebrate completed colour sets
function giveProp(s, i, to) {
  const sp = SP[i];
  const had = sp.type === 'property' && ownsGroup(s, to, sp.group);
  s.own[i].owner = to;
  if (sp.type === 'property' && !had && ownsGroup(s, to, sp.group)) {
    ev(s, { type: 'set', player: to, group: sp.group });
    pushLog(s, `🎉 ${name(s, to)} now owns the whole ${GROUP[sp.group].name} set!`);
  }
}

// money
function credit(s, to, amount) {
  if (to === 'pot') { if (s.opts.vacationCash) s.pot += amount; }
  else if (to && to !== 'bank' && s.p[to]) s.p[to].cash += amount;
}
// try to pay; if short, the player enters debt and must raise money or go bankrupt
function pay(s, from, amount, to, reason, after = 'finish') {
  if (amount <= 0) return true;
  const p = P(s, from);
  const total = to && to.each ? amount * to.each.length : amount;
  if (p.cash >= total) {
    p.cash -= total;
    if (to && to.each) to.each.forEach(id => { s.p[id].cash += amount; }); else credit(s, to, amount);
    return true;
  }
  s.debt = { who: from, amount: total, to, each: to && to.each ? amount : null, reason, after };
  s.phase = 'debt';
  pushLog(s, `⚠️ ${name(s, from)} owes ${fmt(total)} (${reason}) but only has ${fmt(p.cash)}. They must sell or mortgage, or go bankrupt.`);
  return false;
}

// ── turn flow
function startTurn(s, first = false) {
  if (s.phase === 'over') return;
  for (let k = 0; k < s.players.length; k++) {
    if (!first || k > 0) s.turn = (s.turn + 1) % s.players.length;
    first = false;
    const p = P(s, cur(s));
    if (p.out) continue;
    if (p.skip) { p.skip = false; pushLog(s, `🏖️ ${name(s, cur(s))} is still on vacation: turn skipped.`); continue; }
    break;
  }
  s.phase = 'roll';
  s.doubles = 0;
  s.again = false;
  s.pendingBuy = null;
}
function finishLanding(s) {
  if (s.phase === 'over' || s.phase === 'debt' || s.phase === 'gamble' || s.phase === 'auction' || s.phase === 'buy') return;
  const p = P(s, cur(s));
  s.phase = s.again && !p.jail && !p.out ? 'roll' : 'end';
}
function sendToJail(s, pid) {
  const p = P(s, pid);
  ev(s, { type: 'jump', player: pid, from: p.pos, to: JAIL });
  p.pos = JAIL; p.jail = true; p.jailTurns = 0;
  s.again = false;
  pushLog(s, `🚓 ${name(s, pid)} goes to jail!`);
}
// move forward n steps (or to a target going forward), collecting Start money when passing
function moveSteps(s, pid, n) {
  const p = P(s, pid);
  const path = [];
  for (let k = 0; k < n; k++) { p.pos = (p.pos + 1) % 40; path.push(p.pos); if (p.pos === START) { p.cash += GO_MONEY; pushLog(s, `🏁 ${name(s, pid)} passes Start: +${fmt(GO_MONEY)}`); } }
  ev(s, { type: 'move', player: pid, path });
}
function moveTo(s, pid, target) { const p = P(s, pid); moveSteps(s, pid, (target - p.pos + 40) % 40 || 40); }

function land(s, pid, dice, opts = {}) {
  const p = P(s, pid), sp = SP[p.pos], i = p.pos;
  if (BUYABLE.has(sp.type)) {
    const o = s.own[i];
    if (!o.owner) { s.pendingBuy = i; s.phase = 'buy'; return; }
    if (o.owner === pid) return;
    if (o.mortgaged) { pushLog(s, `${sp.name} is mortgaged: no rent.`); return; }
    let diceTotal = dice[0] + dice[1];
    if (opts.utilityRoll) { const d = roll2(); diceTotal = d[0] + d[1]; s.dice = d; pushLog(s, `🎲 ${name(s, pid)} rolls ${diceTotal} for the utility`); }
    const rent = rentFor(s, i, diceTotal, opts.mult || 1);
    pushLog(s, `💸 ${name(s, pid)} pays ${name(s, o.owner)} ${fmt(rent)} rent for ${sp.name}`);
    ev(s, { type: 'rent', player: pid, to: o.owner, amount: rent });
    pay(s, pid, rent, o.owner, `rent on ${sp.name}`);
    return;
  }
  if (sp.type === 'tax') {
    const amt = sp.price > 0 ? sp.price : Math.max(10, Math.round(p.cash * 0.1));
    pushLog(s, `💰 ${name(s, pid)} pays ${fmt(amt)} ${sp.name}${s.opts.vacationCash ? ' (into the Vacation pot)' : ''}`);
    pay(s, pid, amt, 'pot', sp.name);
    return;
  }
  if (sp.type === 'chance' || sp.type === 'chest') return drawCard(s, pid, sp.type, dice);
  if (i === GOTO_JAIL) return sendToJail(s, pid);
  if (i === VACATION) {
    if (s.opts.vacationCash && s.pot > 0) { pushLog(s, `🏖️ ${name(s, pid)} hits Vacation and collects the pot: +${fmt(s.pot)}!`); ev(s, { type: 'pot', player: pid, amount: s.pot }); p.cash += s.pot; s.pot = 0; }
    else pushLog(s, `🏖️ ${name(s, pid)} goes on vacation.`);
    p.skip = true;
    s.again = false;
  }
}

function drawCard(s, pid, deck, dice) {
  if (!s.decks[deck].length) s.decks[deck] = shuffle([...s.fullDecks[deck]]);
  const id = s.decks[deck].shift();
  const card = id === 'gamble' ? GAMBLE_CARD : (deck === 'chance' ? CHANCE : CHEST)[id];
  if (id === 'gamble') s.fullDecks[deck] = s.fullDecks[deck].filter(x => x !== 'gamble'); // once per game at most
  else if (!card.jailCard) s.decks[deck].push(id); // jail cards come back when used
  s.card = { seq: ++s.seq, deck, text: card.text, by: pid, special: !!card.gamble };
  pushLog(s, `${deck === 'chance' ? '❓' : '🧰'} ${name(s, pid)}: ${card.text}`);
  const p = P(s, pid);
  const others = active(s).filter(x => x !== pid);
  if (card.money > 0) p.cash += card.money;
  else if (card.money < 0) pay(s, pid, -card.money, 'pot', 'card');
  else if (card.jailCard) { p.jailCards++; p.jailCardDecks.push(deck); }
  else if (card.jail) sendToJail(s, pid);
  else if (card.move !== undefined) { moveTo(s, pid, card.move); land(s, pid, dice); }
  else if (card.back) { p.pos = (p.pos - card.back + 40) % 40; ev(s, { type: 'jump', player: pid, to: p.pos }); land(s, pid, dice); }
  else if (card.nearest) { moveTo(s, pid, nearest(p.pos, card.nearest === 'station' ? STATIONS : UTILS)); land(s, pid, dice, card.nearest === 'station' ? { mult: 2 } : { mult: 10, utilityRoll: true }); }
  else if (card.repairs) {
    let total = 0;
    propsOf(s, pid).forEach(i => { const h = s.own[i].houses; total += h === 5 ? card.repairs[1] : h * card.repairs[0]; });
    if (total) pay(s, pid, total, 'pot', 'repairs'); else pushLog(s, 'No buildings: nothing to pay.');
  } else if (card.payEach) { if (others.length) pay(s, pid, card.payEach, { each: others }, 'card'); }
  else if (card.collectEach) others.forEach(o => { const amt = Math.min(card.collectEach, s.p[o].cash); s.p[o].cash -= amt; p.cash += amt; });
  else if (card.gamble) {
    if (!others.length) { pushLog(s, 'Nobody to gamble with!'); return; }
    s.gamble = { gambler: pid, target: null, choice: null, g: null, t: null, stage: 'target', result: null, deadline: Date.now() + 60000 };
    s.phase = 'gamble';
  }
}

function startAuction(s, i) {
  s.auction = { space: i, bid: 0, bidder: null, passed: [], endsAt: Date.now() + 15000 };
  s.phase = 'auction';
  pushLog(s, `🔨 ${SP[i].name} goes to auction!`);
}
function endAuction(s) {
  const a = s.auction;
  s.auction = null;
  s.pendingBuy = null;
  s.phase = 'resolving';
  if (a.bidder && P(s, a.bidder).cash >= a.bid) {
    P(s, a.bidder).cash -= a.bid;
    giveProp(s, a.space, a.bidder);
    pushLog(s, `🔨 ${name(s, a.bidder)} wins ${SP[a.space].name} for ${fmt(a.bid)}`);
  } else pushLog(s, `🔨 No bids: ${SP[a.space].name} stays with the bank.`);
  finishLanding(s);
}

function bankrupt(s, pid) {
  const p = P(s, pid);
  const d = s.debt && s.debt.who === pid ? s.debt : null;
  const creditor = d && typeof d.to === 'string' && s.p[d.to] ? d.to : null;
  // buildings go back to the bank for half price
  propsOf(s, pid).forEach(i => {
    const o = s.own[i];
    if (o.houses) { p.cash += o.houses * SP[i].houseCost / 2; if (o.houses === 5) s.bankHotels++; else s.bankHouses += o.houses; o.houses = 0; }
  });
  if (creditor) {
    s.p[creditor].cash += p.cash;
    propsOf(s, pid).forEach(i => giveProp(s, i, creditor));
    s.p[creditor].jailCards += p.jailCards; s.p[creditor].jailCardDecks.push(...p.jailCardDecks);
    pushLog(s, `💀 ${name(s, pid)} is bankrupt! Everything goes to ${name(s, creditor)}.`);
  } else {
    propsOf(s, pid).forEach(i => { s.own[i] = { owner: null, houses: 0, mortgaged: false }; });
    p.jailCardDecks.forEach(dk => s.decks[dk].push((dk === 'chance' ? CHANCE : CHEST).findIndex(c => c.jailCard)));
    pushLog(s, `💀 ${name(s, pid)} is bankrupt! Their properties go back to the bank.`);
  }
  p.cash = 0; p.jailCards = 0; p.jailCardDecks = []; p.out = true; p.jail = false;
  s.trades = s.trades.filter(t => t.from !== pid && t.to !== pid);
  if (s.debt && s.debt.who === pid) s.debt = null;
  ev(s, { type: 'bankrupt', player: pid });
  const alive = active(s);
  if (alive.length <= 1) {
    s.phase = 'over'; s.winner = alive[0] || null;
    if (s.winner) pushLog(s, `🏆 ${name(s, s.winner)} wins Tony-opoly!`);
    return;
  }
  if (cur(s) === pid) startTurn(s);
}

function doGamble(s) {
  const g = s.gamble;
  const gp = P(s, g.gambler), tp = P(s, g.target);
  const win = g.choice === 'higher' ? g.g > g.t : g.g < g.t;
  g.result = win ? 'win' : 'lose';
  if (win) {
    const take = tp.cash - Math.round(tp.cash * 0.3);
    tp.cash -= take; gp.cash += take;
    const cheapest = propsOf(s, g.target).sort((a, b) => SP[a].price - SP[b].price || a - b).slice(0, 2);
    s.trades = s.trades.filter(t => t.from !== g.target && t.to !== g.target);
    cheapest.forEach(i => giveProp(s, i, g.gambler));
    g.won = { cash: take, props: cheapest };
    pushLog(s, `🎰 ${name(s, g.gambler)} WINS the gamble! Takes ${fmt(take)}${cheapest.length ? ' and ' + cheapest.map(i => SP[i].name).join(' & ') : ''} from ${name(s, g.target)}.`);
  } else {
    const cash = gp.cash, props = propsOf(s, g.gambler);
    tp.cash += cash; gp.cash = 0;
    s.trades = s.trades.filter(t => t.from !== g.gambler && t.to !== g.gambler);
    props.forEach(i => giveProp(s, i, g.target));
    g.won = { cash, props };
    pushLog(s, `🎰 ${name(s, g.gambler)} LOSES the gamble and hands EVERYTHING (${fmt(cash)} + ${props.length} properties) to ${name(s, g.target)}!`);
  }
  g.stage = 'done';
  g.deadline = Date.now() + 9000;
}

// building rules
function buildError(s, pid, i) {
  const sp = SP[i], o = s.own[i];
  if (!sp || sp.type !== 'property') return 'You can only build on coloured streets';
  if (o.owner !== pid) return "That isn't yours";
  if (!ownsGroup(s, pid, sp.group)) return `You need the whole ${GROUP[sp.group].name} set first`;
  if (GROUP[sp.group].members.some(k => s.own[k].mortgaged)) return 'Pay off the mortgages in this set first';
  if (o.houses >= 5) return 'It already has a hotel';
  if (s.opts.evenBuild && o.houses > Math.min(...GROUP[sp.group].members.map(k => s.own[k].houses))) return 'Even building rule: build on the other streets in this set first';
  if (o.houses === 4 ? s.bankHotels < 1 : s.bankHouses < 1) return `The bank has run out of ${o.houses === 4 ? 'hotels' : 'houses'}`;
  if (P(s, pid).cash < sp.houseCost) return `You need ${fmt(sp.houseCost)}`;
  return null;
}
function sellError(s, pid, i) {
  const sp = SP[i], o = s.own[i];
  if (!sp || sp.type !== 'property' || o.owner !== pid) return "That isn't yours";
  if (!o.houses) return 'No buildings to sell';
  if (s.opts.evenBuild && o.houses < Math.max(...GROUP[sp.group].members.map(k => s.own[k].houses))) return 'Even building rule: sell from the other streets first';
  if (o.houses === 5 && s.bankHouses < 4) return 'The bank needs 4 houses to break up a hotel. Try again later';
  return null;
}
function tradeError(s, t) {
  for (const [who, side] of [[t.from, t.give], [t.to, t.get]]) {
    const p = P(s, who);
    if (!p || p.out) return 'That player is out of the game';
    if (side.cash < 0 || side.cash > p.cash) return `${name(s, who)} doesn't have ${fmt(side.cash)}`;
    if (side.cards > p.jailCards) return `${name(s, who)} doesn't have that many jail cards`;
    for (const i of side.props) {
      if (!s.own[i] || s.own[i].owner !== who) return `${SP[i] ? SP[i].name : 'A property'} doesn't belong to ${name(s, who)}`;
      if (SP[i].type === 'property' && groupHasBuildings(s, SP[i].group)) return `Sell the buildings on the ${GROUP[SP[i].group].name} set before trading ${SP[i].name}`;
    }
  }
  if (!t.give.cash && !t.get.cash && !t.give.props.length && !t.get.props.length && !t.give.cards && !t.get.cards) return 'The trade is empty';
  return null;
}
function cleanSide(x = {}) {
  return { cash: Math.max(0, Math.floor(Number(x.cash) || 0)), props: [...new Set((x.props || []).map(Number).filter(i => s_isBuyable(i)))], cards: Math.max(0, Math.floor(Number(x.cards) || 0)) };
}
const s_isBuyable = i => Number.isInteger(i) && SP[i] && BUYABLE.has(SP[i].type);

module.exports = {
  name: 'Tony-opoly Tycoon',
  minPlayers: 2,
  maxPlayers: 6,
  supportsBots: true,
  optionsSchema: [
    { key: 'cash', label: 'Starting cash', choices: [{ value: 1500, label: 'M$1,500' }, { value: 2000, label: 'M$2,000' }, { value: 3000, label: 'M$3,000' }] },
    { key: 'mortgage', label: 'Mortgages', choices: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }] },
    { key: 'evenBuild', label: 'Even building rule', choices: [{ value: 'on', label: 'On (build evenly across a set)' }, { value: 'off', label: 'Off (build anywhere in a set)' }] },
    { key: 'vacationCash', label: 'Vacation cash', choices: [{ value: 'on', label: 'On (taxes & fines go to the Vacation pot)' }, { value: 'off', label: 'Off' }] },
    { key: 'auctions', label: 'Auctions', choices: [{ value: 'on', label: 'On (unbought property is auctioned)' }, { value: 'off', label: 'Off' }] },
  ],
  defaultOptions: () => ({ cash: 1500, mortgage: 'on', evenBuild: 'on', vacationCash: 'on', auctions: 'on' }),
  board: { spaces: SP, groups: GROUP, settings: BOARD.settings },

  create(players, o) {
    const cash = [1500, 2000, 3000].includes(o.cash) ? o.cash : 1500;
    const chance = CHANCE.map((_, i) => i), chest = CHEST.map((_, i) => i);
    // GAMBLING TIME: in about 40% of games, hidden in the lower half of one deck
    const fullDecks = { chance: [...chance], chest: [...chest] };
    const decks = { chance: shuffle([...chance]), chest: shuffle([...chest]) };
    if (Math.random() < 0.4) {
      const dk = Math.random() < 0.5 ? 'chance' : 'chest';
      const at = Math.floor(decks[dk].length / 2 + Math.random() * decks[dk].length / 2);
      decks[dk].splice(at, 0, 'gamble');
      fullDecks[dk].push('gamble');
    }
    const s = {
      players: players.map(p => p.id), names: Object.fromEntries(players.map(p => [p.id, p.name])), bots: players.filter(p => p.isBot).map(p => p.id),
      p: Object.fromEntries(players.map(p => [p.id, { cash, pos: 0, jail: false, jailTurns: 0, jailCards: 0, jailCardDecks: [], out: false, skip: false }])),
      own: Object.fromEntries(SP.filter(sp => BUYABLE.has(sp.type)).map(sp => [sp.i, { owner: null, houses: 0, mortgaged: false }])),
      bankHouses: 32, bankHotels: 12, pot: 0,
      opts: { cash, mortgage: o.mortgage !== 'off', evenBuild: o.evenBuild !== 'off', vacationCash: o.vacationCash !== 'off', auctions: o.auctions !== 'off' },
      turn: Math.floor(Math.random() * players.length), phase: 'roll', dice: [1, 1], doubles: 0, again: false,
      pendingBuy: null, auction: null, debt: null, gamble: null, trades: [], tradeSeq: 0,
      decks, fullDecks, card: null, events: [], seq: 0, log: [], logSeq: 0, winner: null,
    };
    if (process.env.TYCOON_TEST) { // testing only: gamble card on top of both decks
      for (const dk of ['chance', 'chest']) { decks[dk] = decks[dk].filter(x => x !== 'gamble'); decks[dk].unshift('gamble'); if (!fullDecks[dk].includes('gamble')) fullDecks[dk].push('gamble'); }
    }
    if (process.env.TYCOON_TEST) { s.own[1].owner = s.players[0]; s.own[3].owner = s.players[1]; }
    pushLog(s, `🎲 ${name(s, cur(s))} goes first. Everyone starts with ${fmt(cash)}.`);
    return s;
  },
  isOver: s => s.phase === 'over',

  turnPlayer(s) {
    if (s.phase === 'over' || s.phase === 'auction') return null;
    if (s.phase === 'debt') return s.debt.who;
    if (s.phase === 'gamble') return s.gamble.stage === 'troll' ? s.gamble.target : s.gamble.gambler;
    return cur(s);
  },
  botDelay: s => (s.phase === 'end' ? 900 : 1300),

  tick(s, now) {
    if (s.phase === 'auction' && s.auction) {
      const a = s.auction;
      const bidders = active(s).filter(id => !a.passed.includes(id));
      if (now >= a.endsAt || bidders.length === 0 || (a.bidder && bidders.length === 1 && bidders[0] === a.bidder)) { endAuction(s); return true; }
    }
    if (s.phase === 'gamble' && s.gamble && now >= s.gamble.deadline) {
      const g = s.gamble;
      // nobody acted in time: decide for them so the game never stalls
      if (['target', 'choice', 'groll'].includes(g.stage)) { this.action(s, g.gambler, this.botAction(s, g.gambler), { humans: [] }); return true; }
      if (g.stage === 'done') { s.gamble = null; s.phase = 'resolving'; finishLanding(s); return true; }
      if (g.stage === 'troll') { g.t = roll2(); if (g.t[0] + g.t[1] === g.g[0] + g.g[1]) { pushLog(s, '🎰 A tie! Both roll again.'); g.stage = 'groll'; g.g = null; g.t = null; g.deadline = now + 30000; } else { doGamble(s); } return true; }
    }
    return false;
  },

  action(s, pid, a, ctx) {
    if (!s.players.includes(pid)) return 'You are watching this game';
    if (s.phase === 'over') return 'The game is over';
    const p = P(s, pid);
    if (p.out) return 'You are bankrupt';
    const isTurn = cur(s) === pid;
    const busy = ['auction', 'gamble'].includes(s.phase);

    switch (a.type) {
      // ── rolling & moving
      case 'roll': {
        if (!isTurn || s.phase !== 'roll') return 'Not now';
        const d = roll2(); s.dice = d;
        const dbl = d[0] === d[1], total = d[0] + d[1];
        ev(s, { type: 'dice', player: pid, dice: d });
        if (p.jail) {
          if (dbl) { p.jail = false; p.jailTurns = 0; pushLog(s, `🎲 ${name(s, pid)} rolls doubles (${d[0]}+${d[1]}) and walks out of jail!`); s.again = false; moveSteps(s, pid, total); land(s, pid, d); finishLanding(s); return; }
          p.jailTurns++;
          if (p.jailTurns < 3) { pushLog(s, `🎲 ${name(s, pid)} rolls ${d[0]}+${d[1]}: no doubles, stays in jail.`); s.phase = 'end'; return; }
          pushLog(s, `🎲 ${name(s, pid)} fails a third time and must pay ${fmt(JAIL_FINE)}.`);
          p.jail = false; p.jailTurns = 0;
          s.again = false;
          if (!pay(s, pid, JAIL_FINE, 'pot', 'jail fine', 'jailmove')) { s.debt.dice = d; return; }
          moveSteps(s, pid, total); land(s, pid, d); finishLanding(s);
          return;
        }
        s.doubles = dbl ? s.doubles + 1 : 0;
        if (s.doubles === 3) { pushLog(s, `🎲 ${name(s, pid)} rolls doubles three times in a row!`); sendToJail(s, pid); s.phase = 'end'; return; }
        s.again = dbl;
        pushLog(s, `🎲 ${name(s, pid)} rolls ${d[0]}+${d[1]} = ${total}${dbl ? ' (doubles!)' : ''}`);
        s.phase = 'resolving';
        moveSteps(s, pid, total);
        land(s, pid, d);
        finishLanding(s);
        return;
      }
      case 'payJail': {
        if (!isTurn || s.phase !== 'roll' || !p.jail) return 'Not now';
        if (p.cash < JAIL_FINE) return `You need ${fmt(JAIL_FINE)}`;
        p.cash -= JAIL_FINE; credit(s, 'pot', JAIL_FINE);
        p.jail = false; p.jailTurns = 0;
        pushLog(s, `🔓 ${name(s, pid)} pays ${fmt(JAIL_FINE)} to leave jail.`);
        return;
      }
      case 'useCard': {
        if (!isTurn || s.phase !== 'roll' || !p.jail) return 'Not now';
        if (!p.jailCards) return "You don't have a Get Out of Jail Free card";
        p.jailCards--;
        const dk = p.jailCardDecks.pop() || 'chance';
        s.decks[dk].push((dk === 'chance' ? CHANCE : CHEST).findIndex(c => c.jailCard));
        p.jail = false; p.jailTurns = 0;
        pushLog(s, `🔓 ${name(s, pid)} uses a Get Out of Jail Free card.`);
        return;
      }
      case 'buy': {
        if (!isTurn || s.phase !== 'buy') return 'Not now';
        const i = s.pendingBuy, sp = SP[i];
        if (p.cash < sp.price) return `You need ${fmt(sp.price)}`;
        p.cash -= sp.price;
        giveProp(s, i, pid);
        pushLog(s, `🏠 ${name(s, pid)} buys ${sp.name} for ${fmt(sp.price)}`);
        s.pendingBuy = null; s.phase = 'resolving';
        finishLanding(s);
        return;
      }
      case 'decline': {
        if (!isTurn || s.phase !== 'buy') return 'Not now';
        const i = s.pendingBuy;
        if (s.opts.auctions) { startAuction(s, i); return; }
        pushLog(s, `${name(s, pid)} doesn't buy ${SP[i].name}.`);
        s.pendingBuy = null; s.phase = 'resolving';
        finishLanding(s);
        return;
      }
      case 'endTurn': {
        if (!isTurn || s.phase !== 'end') return 'Not now';
        startTurn(s);
        return;
      }

      // ── auctions
      case 'bid': {
        if (s.phase !== 'auction') return 'There is no auction';
        const au = s.auction, amt = Math.floor(Number(a.amount));
        if (au.passed.includes(pid)) return 'You passed on this auction';
        if (!(amt > au.bid)) return `Bid more than ${fmt(au.bid)}`;
        if (amt > p.cash) return "You can't afford that bid";
        au.bid = amt; au.bidder = pid;
        au.endsAt = Math.max(au.endsAt, Date.now() + 7000);
        return;
      }
      case 'pass': {
        if (s.phase !== 'auction') return 'There is no auction';
        if (s.auction.bidder === pid) return "You're the highest bidder";
        if (!s.auction.passed.includes(pid)) s.auction.passed.push(pid);
        return;
      }

      // ── property management
      case 'build': {
        if (!isTurn || !['roll', 'end'].includes(s.phase)) return 'You can build on your turn';
        const i = Number(a.space), err = buildError(s, pid, i);
        if (err) return err;
        const o = s.own[i];
        p.cash -= SP[i].houseCost;
        if (o.houses === 4) { s.bankHotels--; s.bankHouses += 4; } else s.bankHouses--;
        o.houses++;
        pushLog(s, `🏗️ ${name(s, pid)} builds ${o.houses === 5 ? 'a hotel' : 'a house'} on ${SP[i].name}`);
        ev(s, { type: 'build', player: pid, space: i });
        return;
      }
      case 'sell': {
        if (busy) return 'Wait until this finishes';
        const i = Number(a.space), err = sellError(s, pid, i);
        if (err) return err;
        const o = s.own[i];
        if (o.houses === 5) { s.bankHotels++; s.bankHouses -= 4; } else s.bankHouses++;
        o.houses--;
        p.cash += SP[i].houseCost / 2;
        pushLog(s, `🏚️ ${name(s, pid)} sells a building on ${SP[i].name} (+${fmt(SP[i].houseCost / 2)})`);
        return;
      }
      case 'mortgage': {
        if (!s.opts.mortgage) return 'Mortgages are turned off';
        if (busy) return 'Wait until this finishes';
        const i = Number(a.space), o = s.own[i];
        if (!o || o.owner !== pid) return "That isn't yours";
        if (o.mortgaged) return 'Already mortgaged';
        if (SP[i].type === 'property' && groupHasBuildings(s, SP[i].group)) return 'Sell the buildings on this set first';
        o.mortgaged = true; p.cash += SP[i].price / 2;
        pushLog(s, `🏦 ${name(s, pid)} mortgages ${SP[i].name} (+${fmt(SP[i].price / 2)})`);
        return;
      }
      case 'unmortgage': {
        if (busy) return 'Wait until this finishes';
        const i = Number(a.space), o = s.own[i];
        if (!o || o.owner !== pid || !o.mortgaged) return 'Nothing to pay off';
        const cost = Math.ceil(SP[i].price / 2 * 1.1);
        if (p.cash < cost) return `You need ${fmt(cost)} (mortgage + 10% interest)`;
        p.cash -= cost; o.mortgaged = false;
        pushLog(s, `🏦 ${name(s, pid)} pays off the mortgage on ${SP[i].name} (−${fmt(cost)})`);
        return;
      }

      // ── debt
      case 'payDebt': {
        if (s.phase !== 'debt' || s.debt.who !== pid) return 'You have no debt';
        const d = s.debt;
        if (p.cash < d.amount) return `You need ${fmt(d.amount)}. Sell or mortgage something`;
        p.cash -= d.amount;
        if (d.each) d.to.each.forEach(id => { if (!s.p[id].out) s.p[id].cash += d.each; }); else credit(s, d.to, d.amount);
        pushLog(s, `✅ ${name(s, pid)} pays the ${fmt(d.amount)} they owed.`);
        s.debt = null; s.phase = 'resolving';
        if (d.after === 'jailmove') { moveSteps(s, pid, d.dice[0] + d.dice[1]); land(s, pid, d.dice); }
        finishLanding(s);
        return;
      }
      case 'bankrupt': {
        if (s.phase !== 'debt' || s.debt.who !== pid) return 'You can only go bankrupt when you owe money you cannot pay';
        bankrupt(s, pid);
        return;
      }

      // ── trading
      case 'propose': {
        if (busy) return 'Wait until this finishes';
        const to = a.to;
        if (to === pid || !s.p[to] || s.p[to].out) return 'Pick another player';
        if (s.trades.filter(t => t.from === pid).length >= 3) return 'You already have 3 open offers';
        const t = { id: ++s.tradeSeq, from: pid, to, give: cleanSide(a.give), get: cleanSide(a.get) };
        const err = tradeError(s, t);
        if (err) return err;
        s.trades.push(t);
        pushLog(s, `🤝 ${name(s, pid)} offers ${name(s, to)} a trade`);
        return;
      }
      case 'respond': {
        const i = s.trades.findIndex(t => t.id === a.id);
        if (i < 0) return 'That offer is gone';
        const t = s.trades[i];
        if (t.to !== pid) return 'That offer is not for you';
        if (!a.accept) { s.trades.splice(i, 1); pushLog(s, `🙅 ${name(s, pid)} declines ${name(s, t.from)}'s trade`); return; }
        if (busy) return 'Wait until this finishes';
        const err = tradeError(s, t);
        if (err) { s.trades.splice(i, 1); return 'The trade is no longer valid: ' + err; }
        const A = P(s, t.from), B = P(s, t.to);
        A.cash += t.get.cash - t.give.cash; B.cash += t.give.cash - t.get.cash;
        A.jailCards += t.get.cards - t.give.cards; B.jailCards += t.give.cards - t.get.cards;
        for (let k = 0; k < t.give.cards; k++) B.jailCardDecks.push(A.jailCardDecks.pop() || 'chance');
        for (let k = 0; k < t.get.cards; k++) A.jailCardDecks.push(B.jailCardDecks.pop() || 'chance');
        t.give.props.forEach(x => giveProp(s, x, t.to));
        t.get.props.forEach(x => giveProp(s, x, t.from));
        s.trades.splice(i, 1);
        s.trades = s.trades.filter(o => !tradeError(s, o));
        pushLog(s, `🤝 ${name(s, t.from)} and ${name(s, t.to)} complete a trade!`);
        ev(s, { type: 'trade', from: t.from, to: t.to });
        return;
      }
      case 'cancelTrade': {
        const i = s.trades.findIndex(t => t.id === a.id && t.from === pid);
        if (i < 0) return 'That offer is gone';
        s.trades.splice(i, 1);
        return;
      }

      // ── GAMBLING TIME
      case 'gambleTarget': {
        const g = s.gamble;
        if (s.phase !== 'gamble' || g.gambler !== pid || g.stage !== 'target') return 'Not now';
        if (a.target === pid || !s.p[a.target] || s.p[a.target].out) return 'Pick another player';
        g.target = a.target; g.stage = 'choice'; g.deadline = Date.now() + 60000;
        pushLog(s, `🎰 ${name(s, pid)} challenges ${name(s, a.target)}!`);
        return;
      }
      case 'gambleChoice': {
        const g = s.gamble;
        if (s.phase !== 'gamble' || g.gambler !== pid || g.stage !== 'choice') return 'Not now';
        if (!['higher', 'lower'].includes(a.choice)) return 'Higher or lower?';
        g.choice = a.choice; g.stage = 'groll'; g.deadline = Date.now() + 60000;
        pushLog(s, `🎰 ${name(s, pid)} bets they'll roll ${a.choice.toUpperCase()} than ${name(s, g.target)}`);
        return;
      }
      case 'gambleRoll': {
        const g = s.gamble;
        if (s.phase !== 'gamble') return 'Not now';
        if (g.stage === 'groll' && pid === g.gambler) { g.g = roll2(); g.stage = 'troll'; g.deadline = Date.now() + 25000; return; }
        if (g.stage === 'troll' && pid === g.target) {
          g.t = roll2();
          if (g.t[0] + g.t[1] === g.g[0] + g.g[1]) { pushLog(s, '🎰 A tie! Both roll again.'); g.lastTie = { g: g.g, t: g.t }; g.stage = 'groll'; g.g = null; g.t = null; g.deadline = Date.now() + 60000; return; }
          doGamble(s);
          return;
        }
        return 'Not your roll';
      }
      case 'gambleContinue': {
        const g = s.gamble;
        if (s.phase !== 'gamble' || g.stage !== 'done' || pid !== g.gambler) return 'Not now';
        s.gamble = null; s.phase = 'resolving';
        finishLanding(s);
        return;
      }
    }
    return 'Unknown action';
  },

  // ── bots
  botAction(s, pid) {
    const p = P(s, pid);
    const others = active(s).filter(x => x !== pid);
    if (s.phase === 'gamble') {
      const g = s.gamble;
      if (g.stage === 'target') return { type: 'gambleTarget', target: others.sort((a, b) => netWorth(s, b) - netWorth(s, a))[0] };
      if (g.stage === 'choice') return { type: 'gambleChoice', choice: Math.random() < 0.5 ? 'higher' : 'lower' };
      if (g.stage === 'groll' || g.stage === 'troll') return { type: 'gambleRoll' };
      return { type: 'gambleContinue' };
    }
    if (s.phase === 'debt') {
      if (p.cash >= s.debt.amount) return { type: 'payDebt' };
      const props = propsOf(s, pid);
      const sell = props.find(i => !sellError(s, pid, i));
      if (sell !== undefined) return { type: 'sell', space: sell };
      if (s.opts.mortgage) {
        const m = props.filter(i => !s.own[i].mortgaged && !(SP[i].type === 'property' && groupHasBuildings(s, SP[i].group))).sort((a, b) => SP[a].price - SP[b].price)[0];
        if (m !== undefined) return { type: 'mortgage', space: m };
      }
      return { type: 'bankrupt' };
    }
    if (s.phase === 'roll') {
      if (p.jail) { if (p.jailCards) return { type: 'useCard' }; if (p.cash >= 300) return { type: 'payJail' }; }
      return { type: 'roll' };
    }
    if (s.phase === 'buy') {
      const sp = SP[s.pendingBuy];
      const completes = sp.type === 'property' && GROUP[sp.group].members.every(i => i === sp.i || s.own[i].owner === pid);
      return p.cash - sp.price >= (completes ? 0 : 120) ? { type: 'buy' } : { type: 'decline' };
    }
    if (s.phase === 'end') {
      const canBuild = propsOf(s, pid).filter(i => !buildError(s, pid, i) && p.cash - SP[i].houseCost >= 250).sort((a, b) => s.own[a].houses - s.own[b].houses);
      if (canBuild.length) return { type: 'build', space: canBuild[0] };
      const unm = propsOf(s, pid).find(i => s.own[i].mortgaged && p.cash - SP[i].price * 0.55 > 500);
      if (unm !== undefined) return { type: 'unmortgage', space: unm };
      return { type: 'endTurn' };
    }
    return null;
  },
  botReaction(s, isBot) {
    if (s.phase === 'auction' && s.auction) {
      const a = s.auction, sp = SP[a.space];
      for (const id of active(s)) {
        if (!isBot(id) || a.passed.includes(id) || a.bidder === id) continue;
        const completes = sp.type === 'property' && GROUP[sp.group].members.every(i => i === sp.i || s.own[i].owner === id);
        const max = Math.min(s.p[id].cash - 60, Math.round(sp.price * (completes ? 1.4 : 0.9)));
        const next = a.bid + (a.bid < 50 ? 10 : 20);
        return next <= max ? { id, action: { type: 'bid', amount: next }, delay: 900 + Math.random() * 1200 } : { id, action: { type: 'pass' }, delay: 700 };
      }
      return null;
    }
    const t = s.trades.find(x => isBot(x.to) && !s.p[x.to].out);
    if (t) {
      const val = (side, receiver) => side.cash + side.cards * 50 + side.props.reduce((sum, i) => {
        const sp = SP[i];
        const completes = sp.type === 'property' && GROUP[sp.group].members.every(k => side.props.includes(k) || s.own[k].owner === receiver);
        return sum + (s.own[i].mortgaged ? sp.price / 2 : sp.price) * (completes ? 1.8 : 1);
      }, 0);
      const gets = val(t.give, t.to), gives = val(t.get, t.from);
      return { id: t.to, action: { type: 'respond', id: t.id, accept: gets >= gives * 1.2 }, delay: 2000 };
    }
    return null;
  },

  view(s, pid) {
    const me = s.players.includes(pid) ? pid : null;
    return {
      phase: s.phase, turnId: cur(s), me, dice: s.dice, again: s.again, opts: s.opts, pot: s.pot,
      bankHouses: s.bankHouses, bankHotels: s.bankHotels, pendingBuy: s.pendingBuy,
      players: s.players.map(id => ({ id, name: s.names[id], ...s.p[id], jailCardDecks: undefined, worth: netWorth(s, id), props: propsOf(s, id).length })),
      own: s.own,
      auction: s.auction && { ...s.auction, remaining: Math.max(0, s.auction.endsAt - Date.now()) },
      debt: s.debt && { who: s.debt.who, amount: s.debt.amount, reason: s.debt.reason, to: typeof s.debt.to === 'string' ? s.debt.to : s.debt.to && s.debt.to.each ? 'players' : 'bank' },
      gamble: s.gamble && { ...s.gamble, remaining: Math.max(0, s.gamble.deadline - Date.now()) },
      trades: s.trades.filter(t => t.from === me || t.to === me),
      otherTrades: s.trades.filter(t => t.from !== me && t.to !== me).map(t => ({ id: t.id, from: t.from, to: t.to })),
      card: s.card, events: s.events, seq: s.seq, log: s.log.slice(-14), winner: s.winner,
      buildable: me ? propsOf(s, me).filter(i => !buildError(s, me, i)) : [],
    };
  },
};
