# 🌍 Tony's World

Classic games and murder mysteries to play with friends in the browser. One person creates a room, shares the **5-letter code** (or invite link), and everyone plays live together. No accounts needed.

## Games

| Game | Players | Status |
|---|---|---|
| 🃏 **Color Clash**: match colors & numbers, Block / Flip / +2 / Color Change / +4, stack +2s and +4s, shout "CLASH!" on your last card | 2–10 (bots welcome) | ✅ |
| 🐍 **Snakes & Ladders**: climb ladders, dodge snakes, first to 100 | 1–6 (bots welcome) | ✅ |
| 🛢️ **Barrel Climb**: live platformer, race up the girders and jump Big Bolt's barrels | 1–6 | ✅ |
| 🕵️ **Case Files**: search scenes, question suspects, pin notes, accuse the killer. choose a case, then solve it together or race each other, with an optional countdown clock. 3 original cases | 1–10 | ✅ |
| 📈 **Higher or Lower**: Spotify listeners, Instagram/TikTok/YouTube/X followers, Play Store downloads, box office. Take turns or everyone at once, solo or in teams | 1–10 (bots welcome) | ✅ |
| 👾 Snack Attack · 🏙️ Tony-opoly Tycoon | | 🚧 coming soon |

Features: room codes and invite links, chat, **voice & video calls** (with private team channels during team games), **teams** (Red vs Blue), host controls, bots, automatic reconnect (refreshing the page keeps your seat), a bot takes over if someone leaves mid-game, works on phones.

## Run it locally

```bash
npm install
npm start
```

Open http://localhost:3000. To try multiplayer on one computer, open a second browser tab (each tab is a separate player).

Run the multiplayer test (with the server running): `npm test`

## Put it online for free (Render)

1. Create a free GitHub account and a new **empty repository** called `tonys-world`.
2. Upload this folder to it (see the commands below).
3. Go to https://render.com, sign up with GitHub, click **New → Blueprint**, and pick your `tonys-world` repo. Render reads `render.yaml` and sets everything up.
4. After a minute or two you get a link like `https://tonys-world.onrender.com`. Share it with friends!

```bash
git remote add origin https://github.com/YOUR-NAME/tonys-world.git
git push -u origin main
```

Note: on Render's free plan the server goes to sleep after 15 minutes without visitors. The first visit after that takes about 30–60 seconds to wake it up. Rooms live in memory, so they disappear when the server restarts or sleeps.

Other hosts work too (Railway, Fly.io, Glitch): any service that runs `npm start` and supports WebSockets.

## Voice & video
Calls are peer-to-peer (WebRTC); the server only passes messages between browsers. On most home Wi-Fi this works out of the box. Some mobile networks and strict school/office networks block direct connections; for those, add a TURN server (e.g. a free Metered.ca or Cloudflare account) by setting these environment variables on Render: `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`.

## Project layout

```
server.js              rooms, codes, chat, bots, reconnects (Express + Socket.IO)
server/games/*.js      game rules (the server is the referee, so nobody can cheat)
server/cases.js        the murder mystery cases (easy to add more)
public/                the website (plain HTML/CSS/JS, no build step)
test/smoke.js          end-to-end multiplayer test
```

### Adding a new mystery
Copy one of the cases in `server/cases.js` and change the story. Each case has suspects (with questions, some unlocked by evidence via `requires`), locations, evidence, the weapon/motive choices and the solution. Only the killer should have motive, means *and* opportunity.
