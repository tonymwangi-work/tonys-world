'use strict';
// Shared helpers + game catalogue
window.TW = window.TW || { games: {} };

TW.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
TW.$ = (sel, el = document) => el.querySelector(sel);
TW.$$ = (sel, el = document) => [...el.querySelectorAll(sel)];
TW.h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

TW.AVATARS = ['🦊', '🐼', '🐸', '🐯', '🦄', '🐙', '🐧', '🦁', '🐵', '🐨', '🐰', '🐲', '👽', '🦖', '🐝', '🦉'];

TW.CATALOG = [
  { id: 'colorclash', title: 'Color Clash', emoji: '🃏', tag: 'Match colors & numbers. Stack +2s, change colors, block your friends!', players: '2–10', accent: '#ff5a5f', ready: true },
  { id: 'vines', title: 'Snakes & Ladders', emoji: '🐍', tag: 'Roll the dice, climb the ladders, dodge the snakes to 100.', players: '1–6', accent: '#2ec4b6', ready: true },
  { id: 'casefiles', title: 'Case Files', emoji: '🕵️', tag: 'Search crime scenes, grill suspects and crack the murder.', players: '1–10', accent: '#c9a96e', ready: true },
  { id: 'hilo', title: 'Higher or Lower', emoji: '📈', tag: 'Spotify listeners, Instagram followers, Play Store downloads… higher or lower?', players: '1–10', accent: '#b388ff', ready: true },
  { id: 'snack', title: 'Snack Attack', emoji: '👾', tag: 'Gobble dots in a maze while ghosts give chase.', players: '1–4', accent: '#ffc93c', ready: false },
  { id: 'barrel', title: 'Barrel Climb', emoji: '🛢️', tag: 'Race up the girders, jump the barrels Big Bolt throws!', players: '1–6', accent: '#ff8c42', ready: true },
  { id: 'tycoon', title: 'Tony-opoly Tycoon', emoji: '🏙️', tag: 'Buy streets, build towers, bankrupt your friends.', players: '2–6', accent: '#3a86ff', ready: false },
];
TW.gameInfo = id => TW.CATALOG.find(g => g.id === id) || { title: id, emoji: '🎮' };

TW.toast = (msg, kind = 'info', ms = 3200) => {
  const root = document.getElementById('toasts');
  const el = TW.h(`<div class="toast toast-${kind}">${TW.esc(msg)}</div>`);
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
};

TW.modal = (html, { onClose, dismissable = true } = {}) => {
  const root = document.getElementById('modal-root');
  const wrap = TW.h(`<div class="modal-back"><div class="modal">${html}</div></div>`);
  const close = () => { wrap.remove(); onClose && onClose(); };
  if (dismissable) wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  root.appendChild(wrap);
  return { el: wrap.firstElementChild, close };
};

TW.confetti = (n = 120) => {
  const colors = ['#ff5a5f', '#ffc93c', '#2ec4b6', '#3a86ff', '#b388ff', '#f15bb5'];
  const box = TW.h('<div class="confetti"></div>');
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.8 + 's';
    p.style.animationDuration = 2.2 + Math.random() * 1.8 + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 5000);
};
