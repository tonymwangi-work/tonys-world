'use strict';
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pushLog(s, text, max = 30) {
  s.log.push({ n: ++s.logSeq, text });
  if (s.log.length > max) s.log.shift();
}
module.exports = { shuffle, pushLog };
