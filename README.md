# 🌍 Tony's World

Classic games and murder mysteries to play with friends in the browser. One person creates a room, shares the **5-letter code** (or invite link), and everyone plays live together. No accounts needed.

## Games

| Game | Players | Status |
|---|---|---|
| 🃏 **Color Clash**: match colors & numbers, Block / Flip / +2 / Rainbow +4, shout "CLASH!" on your last card | 2–10 (bots welcome) | ✅ |
| 🌿 **Vines & Slides**: climb vines, dodge slides, first to 100 | 1–6 (bots welcome) | ✅ |
| 🕵️ **Case Files**: search scenes, question suspects, pin notes, accuse the killer. Co-op or Race mode, 3 original cases | 1–10 | ✅ |
| 👾 Snack Attack · 🛢️ Barrel Climb · 🏙️ Tony-opoly Tycoon | | 🚧 coming soon |

Features: room codes and invite links, chat, host controls, bots, automatic reconnect (refreshing the page keeps your seat), a bot takes over if someone leaves mid-game, works on phones.

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
