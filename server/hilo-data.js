'use strict';
// Higher or Lower data. Social/streaming numbers move every day, so these are rounded
// approximations (around 2025). Box office is all-time worldwide gross (well documented).
// Play Store uses Google's public install badges (e.g. "1B+").
const M = 1e6, B = 1e9;

module.exports = {
  spotify: {
    label: 'Spotify', emoji: '🎧', unit: 'monthly listeners on Spotify', color: '#1db954', approx: true,
    items: [
      ['Bruno Mars', 130 * M, '🎤'], ['The Weeknd', 105 * M, '🌙'], ['Lady Gaga', 95 * M, '⚡'], ['Billie Eilish', 95 * M, '💚'],
      ['Taylor Swift', 85 * M, '🐍'], ['Coldplay', 85 * M, '🌈'], ['Rihanna', 80 * M, '☔'], ['Bad Bunny', 80 * M, '🐰'],
      ['Justin Bieber', 80 * M, '🎵'], ['Ed Sheeran', 80 * M, '🎸'], ['Kendrick Lamar', 75 * M, '👑'], ['Ariana Grande', 75 * M, '🎀'],
      ['Eminem', 75 * M, '🎙️'], ['David Guetta', 75 * M, '🎛️'], ['Drake', 70 * M, '🦉'], ['Sabrina Carpenter', 70 * M, '🍒'],
      ['Calvin Harris', 70 * M, '🎚️'], ['Dua Lipa', 65 * M, '💃'], ['Post Malone', 65 * M, '🍺'], ['SZA', 65 * M, '🦋'],
      ['Travis Scott', 60 * M, '🌵'], ['Kanye West', 60 * M, '🐻'], ['Imagine Dragons', 55 * M, '🐉'], ['Olivia Rodrigo', 55 * M, '💜'],
      ['Doja Cat', 55 * M, '🐱'], ['Shakira', 50 * M, '💃'], ['Miley Cyrus', 50 * M, '🌸'], ['Linkin Park', 50 * M, '🎸'],
      ['Queen', 50 * M, '👑'], ['Benson Boone', 50 * M, '🤸'], ['Michael Jackson', 45 * M, '🧤'], ['Arctic Monkeys', 45 * M, '🐒'],
      ['ROSÉ', 45 * M, '🌹'], ['Chappell Roan', 40 * M, '🎀'], ['Teddy Swims', 40 * M, '🏊'], ['Rema', 20 * M, '🦅'],
      ['Burna Boy', 15 * M, '🔥'], ['Tems', 15 * M, '✨'], ['Wizkid', 9 * M, '⭐'], ['Davido', 8 * M, '🦅'], ['Diamond Platnumz', 3 * M, '💎'],
    ],
  },
  instagram: {
    label: 'Instagram', emoji: '📸', unit: 'Instagram followers', color: '#e1306c', approx: true,
    items: [
      ['Cristiano Ronaldo', 650 * M, '⚽'], ['Lionel Messi', 505 * M, '🐐'], ['Selena Gomez', 420 * M, '🎤'], ['Kylie Jenner', 395 * M, '💄'],
      ['Dwayne "The Rock" Johnson', 395 * M, '💪'], ['Ariana Grande', 375 * M, '🎀'], ['Kim Kardashian', 355 * M, '💅'], ['Beyoncé', 310 * M, '🐝'],
      ['Khloé Kardashian', 300 * M, '👠'], ['Justin Bieber', 295 * M, '🎵'], ['Kendall Jenner', 290 * M, '👗'], ['Taylor Swift', 280 * M, '🐍'],
      ['Virat Kohli', 270 * M, '🏏'], ['Jennifer Lopez', 250 * M, '💃'], ['Neymar Jr', 230 * M, '⚽'], ['Nicki Minaj', 225 * M, '👑'],
      ['Kourtney Kardashian', 225 * M, '🌴'], ['Miley Cyrus', 215 * M, '🌸'], ['Zendaya', 185 * M, '🎬'], ['Cardi B', 165 * M, '💰'],
      ['LeBron James', 160 * M, '🏀'], ['Rihanna', 150 * M, '☔'], ['Drake', 145 * M, '🦉'], ['Kylian Mbappé', 120 * M, '⚡'],
      ['Billie Eilish', 120 * M, '💚'], ['Shakira', 90 * M, '💃'], ['Tom Holland', 68 * M, '🕷️'], ['MrBeast', 65 * M, '💸'],
      ['Lady Gaga', 59 * M, '⚡'], ['Ed Sheeran', 50 * M, '🎸'], ['Bad Bunny', 50 * M, '🐰'], ['Davido', 30 * M, '🦅'],
      ['Diamond Platnumz', 18 * M, '💎'], ['Wizkid', 18 * M, '⭐'], ['Burna Boy', 17 * M, '🔥'], ['Tems', 5 * M, '✨'],
    ],
  },
  tiktok: {
    label: 'TikTok', emoji: '🎵', unit: 'TikTok followers', color: '#25f4ee', approx: true,
    items: [
      ['Khaby Lame', 162 * M, '🤷'], ['Charli D\'Amelio', 155 * M, '💃'], ['MrBeast', 115 * M, '💸'], ['Bella Poarch', 94 * M, '🎶'],
      ['Addison Rae', 88 * M, '✨'], ['Kimberly Loaiza', 84 * M, '💜'], ['Zach King', 82 * M, '🪄'], ['BTS', 80 * M, '💜'],
      ['Dwayne "The Rock" Johnson', 78 * M, '💪'], ['Will Smith', 77 * M, '😎'], ['Jason Derulo', 65 * M, '🕺'], ['Kylie Jenner', 57 * M, '💄'],
      ['Spencer X', 55 * M, '🎤'], ['Real Madrid', 50 * M, '⚽'], ['FC Barcelona', 50 * M, '🔵'], ['Taylor Swift', 33 * M, '🐍'],
    ],
  },
  youtube: {
    label: 'YouTube', emoji: '▶️', unit: 'YouTube subscribers', color: '#ff0000', approx: true,
    items: [
      ['MrBeast', 400 * M, '💸'], ['T-Series', 300 * M, '🎬'], ['Cocomelon', 195 * M, '🍉'], ['SET India', 185 * M, '📺'],
      ['Vlad and Niki', 140 * M, '🧸'], ['Kids Diana Show', 135 * M, '👧'], ['Like Nastya', 130 * M, '🎀'], ['Stokes Twins', 125 * M, '👯'],
      ['PewDiePie', 110 * M, '🎮'], ['WWE', 105 * M, '🤼'], ['BLACKPINK', 97 * M, '🖤'], ['BANGTANTV (BTS)', 80 * M, '💜'],
      ['UR · Cristiano', 75 * M, '⚽'], ['Justin Bieber', 75 * M, '🎵'], ['Dude Perfect', 61 * M, '🏀'], ['Taylor Swift', 60 * M, '🐍'],
      ['Eminem', 60 * M, '🎙️'], ['Ed Sheeran', 58 * M, '🎸'], ['Marshmello', 58 * M, '🍬'], ['Ariana Grande', 55 * M, '🎀'],
      ['IShowSpeed', 40 * M, '⚡'], ['Markiplier', 37 * M, '🎮'],
    ],
  },
  x: {
    label: 'X (Twitter)', emoji: '🐦', unit: 'followers on X (Twitter)', color: '#1d9bf0', approx: true,
    items: [
      ['Elon Musk', 220 * M, '🚀'], ['Barack Obama', 130 * M, '🇺🇸'], ['Cristiano Ronaldo', 115 * M, '⚽'], ['Justin Bieber', 110 * M, '🎵'],
      ['Rihanna', 108 * M, '☔'], ['Narendra Modi', 107 * M, '🇮🇳'], ['Katy Perry', 105 * M, '🍭'], ['Donald Trump', 105 * M, '🇺🇸'],
      ['Taylor Swift', 94 * M, '🐍'], ['NASA', 89 * M, '🛰️'], ['Lady Gaga', 83 * M, '⚡'], ['Ariana Grande', 80 * M, '🎀'],
      ['YouTube', 79 * M, '▶️'], ['Kim Kardashian', 75 * M, '💅'], ['Ellen DeGeneres', 75 * M, '📺'], ['Virat Kohli', 68 * M, '🏏'],
      ['Selena Gomez', 64 * M, '🎤'], ['Neymar Jr', 64 * M, '⚽'], ['CNN Breaking News', 64 * M, '📰'], ['Bill Gates', 63 * M, '💻'],
    ],
  },
  playstore: {
    label: 'Play Store', emoji: '📲', unit: 'Google Play downloads', color: '#34a853', approx: false, plus: true,
    items: [
      ['YouTube', 10 * B, '▶️'], ['Google Maps', 10 * B, '🗺️'], ['Facebook', 5 * B, '👍'], ['Instagram', 5 * B, '📸'],
      ['WhatsApp', 5 * B, '💬'], ['TikTok', 1 * B, '🎵'], ['Snapchat', 1 * B, '👻'], ['Spotify', 1 * B, '🎧'],
      ['Netflix', 1 * B, '🍿'], ['Telegram', 1 * B, '✈️'], ['Subway Surfers', 1 * B, '🛹'], ['Candy Crush Saga', 1 * B, '🍬'],
      ['Free Fire', 1 * B, '🔥'], ['Roblox', 1 * B, '🧱'], ['CapCut', 1 * B, '✂️'], ['Duolingo', 500 * M, '🦉'],
      ['Among Us', 500 * M, '🚀'], ['Clash of Clans', 500 * M, '⚔️'], ['Uber', 500 * M, '🚕'], ['Discord', 500 * M, '🎧'],
      ['Geometry Dash Lite', 100 * M, '🔷'], ['Minecraft (paid)', 50 * M, '⛏️'],
    ],
  },
  movies: {
    label: 'Box Office', emoji: '🎬', unit: 'worldwide box office', color: '#ffc93c', approx: false, money: true,
    items: [
      ['Avatar (2009)', 2.923 * B, '🌿'], ['Avengers: Endgame', 2.799 * B, '🦸'], ['Avatar: The Way of Water', 2.320 * B, '🌊'], ['Titanic', 2.264 * B, '🚢'],
      ['Ne Zha 2', 2.2 * B, '🔥'], ['Star Wars: The Force Awakens', 2.071 * B, '⚔️'], ['Avengers: Infinity War', 2.052 * B, '💎'], ['Spider-Man: No Way Home', 1.922 * B, '🕷️'],
      ['Inside Out 2', 1.699 * B, '😊'], ['Jurassic World', 1.671 * B, '🦖'], ['The Lion King (2019)', 1.663 * B, '🦁'], ['The Avengers (2012)', 1.520 * B, '🛡️'],
      ['Furious 7', 1.515 * B, '🏎️'], ['Top Gun: Maverick', 1.496 * B, '✈️'], ['Frozen II', 1.453 * B, '❄️'], ['Barbie', 1.446 * B, '💖'],
      ['Avengers: Age of Ultron', 1.405 * B, '🤖'], ['The Super Mario Bros. Movie', 1.362 * B, '🍄'], ['Black Panther', 1.349 * B, '🐾'], ['Harry Potter and the Deathly Hallows 2', 1.342 * B, '⚡'],
      ['Deadpool & Wolverine', 1.338 * B, '🗡️'], ['Star Wars: The Last Jedi', 1.333 * B, '🌌'], ['Jurassic World: Fallen Kingdom', 1.310 * B, '🌋'], ['Frozen', 1.290 * B, '⛄'],
      ['Beauty and the Beast (2017)', 1.266 * B, '🌹'], ['Incredibles 2', 1.243 * B, '🦸'], ['Joker (2019)', 1.079 * B, '🃏'], ['Moana 2', 1.059 * B, '🌊'],
      ['Lilo & Stitch (2025)', 1.03 * B, '👽'], ['Zootopia', 1.025 * B, '🦊'], ['Oppenheimer', 0.975 * B, '💥'], ['A Minecraft Movie', 0.958 * B, '⛏️'],
    ],
  },
};
