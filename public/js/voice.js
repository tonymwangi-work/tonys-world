'use strict';
// Voice & video chat: a peer-to-peer WebRTC mesh. The server only relays signaling messages.
// Everyone in the call keeps a connection to everyone else; who can HEAR whom is decided by
// voice channels ("room" or "team:A"/"team:B"): your mic is only sent to people in your channel.
(() => {
  const { esc, h, $ } = TW;
  const V = {
    on: false, mic: null, cam: null, micOn: true, camOn: false, peers: {}, ice: null, room: null, channel: null, collapsed: false,
  };
  TW.voice = V;
  let socket = null;
  let dock = null;
  const videoEls = {};

  const me = () => V.room && V.room.you;
  const playerOf = id => V.room && V.room.players.find(p => p.id === id);
  const channelLabel = ch => !ch ? '' : ch === 'room' ? '🔊 Room call' : ch === 'team:A' ? '🔒 Red Team (private)' : '🔒 Blue Team (private)';

  async function iceServers() {
    if (V.ice) return V.ice;
    try { V.ice = (await (await fetch('/api/ice')).json()).iceServers; } catch { V.ice = [{ urls: 'stun:stun.l.google.com:19302' }]; }
    return V.ice;
  }

  V.init = s => {
    socket = s;
    socket.on('rtc:signal', ({ from, data }) => onSignal(from, data));
    socket.on('rtc:left', ({ id }) => closePeer(id));
    socket.on('connect', () => { if (V.on) { V.on = false; cleanup(); renderDock(); TW.toast('Call dropped. Tap "Join call" to reconnect.', 'error'); } });
  };

  V.join = async () => {
    if (V.on) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return TW.toast('Your browser does not support voice chat here', 'error');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      V.mic = stream.getAudioTracks()[0];
    } catch (e) {
      return TW.toast('Microphone blocked. Allow mic access in your browser to join the call 🎙️', 'error', 5000);
    }
    await iceServers();
    V.on = true; V.micOn = true; V.camOn = false;
    V.mic.enabled = true;
    socket.emit('rtc:join', { mic: true, cam: false });
    renderDock();
    TW.toast('🎧 You joined the call', 'ok');
  };
  V.leave = () => {
    if (!V.on) return;
    socket.emit('rtc:leave');
    V.on = false;
    cleanup();
    renderDock();
  };
  function cleanup() {
    Object.keys(V.peers).forEach(closePeer);
    if (V.mic) { V.mic.stop(); V.mic = null; }
    if (V.cam) { V.cam.stop(); V.cam = null; }
    V.camOn = false;
    V.channel = null;
  }
  V.toggleMic = () => {
    if (!V.on) return;
    V.micOn = !V.micOn;
    V.mic.enabled = V.micOn;
    socket.emit('rtc:media', { mic: V.micOn, cam: V.camOn });
    renderDock();
  };
  V.toggleCam = async () => {
    if (!V.on) return;
    if (V.camOn) {
      V.camOn = false;
      if (V.cam) { V.cam.stop(); V.cam = null; }
    } else {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 }, facingMode: 'user' } });
        V.cam = s.getVideoTracks()[0];
        V.camOn = true;
      } catch { return TW.toast('Camera blocked. Allow camera access to turn on video 📷', 'error', 5000); }
    }
    socket.emit('rtc:media', { mic: V.micOn, cam: V.camOn });
    applyGates();
    renderDock();
  };

  // ── peer connections
  function makePeer(id, initiator) {
    const pc = new RTCPeerConnection({ iceServers: V.ice });
    const peer = { id, pc, initiator, pending: [], audio: new Audio(), video: null, aT: null, vT: null, stream: new MediaStream() };
    peer.audio.autoplay = true;
    peer.audio.setAttribute('playsinline', '');
    V.peers[id] = peer;
    pc.onicecandidate = e => { if (e.candidate) socket.emit('rtc:signal', { to: id, data: { ice: e.candidate } }); };
    pc.ontrack = e => {
      if (e.track.kind === 'audio') { peer.audio.srcObject = new MediaStream([e.track]); peer.audio.play().catch(() => {}); }
      else { peer.videoStream = new MediaStream([e.track]); renderDock(); }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && V.on) {
        closePeer(id);
        if (initiator) setTimeout(() => connectTo(id), 1000);
      }
      renderDock();
    };
    return peer;
  }
  async function connectTo(id) {
    if (!V.on || V.peers[id]) return;
    const peer = makePeer(id, true);
    peer.aT = peer.pc.addTransceiver('audio', { direction: 'sendrecv' });
    peer.vT = peer.pc.addTransceiver('video', { direction: 'sendrecv' });
    applyGates();
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    socket.emit('rtc:signal', { to: id, data: { sdp: peer.pc.localDescription } });
  }
  async function onSignal(from, data) {
    if (!V.on || !data) return;
    let peer = V.peers[from];
    try {
      if (data.sdp) {
        if (data.sdp.type === 'offer') {
          if (peer) closePeer(from);
          peer = makePeer(from, false);
          await peer.pc.setRemoteDescription(data.sdp);
          for (const t of peer.pc.getTransceivers()) {
            t.direction = 'sendrecv';
            if (t.receiver.track.kind === 'audio') peer.aT = t; else peer.vT = t;
          }
          applyGates();
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          socket.emit('rtc:signal', { to: from, data: { sdp: peer.pc.localDescription } });
        } else if (peer) await peer.pc.setRemoteDescription(data.sdp);
        if (peer) { for (const c of peer.pending) await peer.pc.addIceCandidate(c).catch(() => {}); peer.pending = []; }
      } else if (data.ice) {
        if (!peer) return;
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.ice).catch(() => {});
        else peer.pending.push(data.ice);
      }
    } catch (e) { console.warn('rtc signal error', e); }
  }
  function closePeer(id) {
    const p = V.peers[id];
    if (!p) return;
    try { p.pc.close(); } catch { /* ignore */ }
    p.audio.srcObject = null;
    delete V.peers[id];
    renderDock();
  }

  // only send your voice to people in your channel; only play voices from your channel
  function applyGates() {
    for (const peer of Object.values(V.peers)) {
      const pl = playerOf(peer.id);
      const same = !!(pl && V.channel && pl.channel === V.channel);
      if (peer.aT) peer.aT.sender.replaceTrack(same && V.mic ? V.mic : null).catch(() => {});
      if (peer.vT) peer.vT.sender.replaceTrack(V.camOn && V.cam ? V.cam : null).catch(() => {});
      peer.audio.muted = !same;
    }
  }

  // called on every room update
  V.onRoom = room => {
    V.room = room;
    if (!room) { if (V.on) V.leave(); renderDock(); return; }
    if (V.on) {
      const self = playerOf(me());
      const newCh = self ? self.channel : null;
      if (newCh && V.channel && newCh !== V.channel) TW.toast(newCh === 'room' ? '🔊 Back to the room call' : `🔒 Switched to your team's private channel`, 'ok', 2600);
      V.channel = newCh;
      const inCall = room.players.filter(p => p.inCall && p.id !== me()).map(p => p.id);
      for (const id of Object.keys(V.peers)) if (!inCall.includes(id)) closePeer(id);
      // the player with the "smaller" id starts each connection, so offers never collide
      for (const id of inCall) if (!V.peers[id] && me() < id) connectTo(id);
      applyGates();
    }
    renderDock();
  };

  // ── UI: floating call dock
  function placeDock(x, y) {
    const w = dock.offsetWidth || 200, hgt = dock.offsetHeight || 60;
    x = Math.max(4, Math.min(window.innerWidth - w - 4, x));
    y = Math.max(4, Math.min(window.innerHeight - hgt - 4, y));
    Object.assign(dock.style, { left: x + 'px', top: y + 'px', bottom: 'auto' });
  }
  function renderDock() {
    if (!dock) {
      dock = h('<div class="call-dock" id="call-dock"></div>');
      document.body.appendChild(dock);
      // drag the dock around by its header; position remembered per device
      try { const pos = JSON.parse(localStorage.getItem('tw_dock')); if (pos) placeDock(pos.x, pos.y); } catch { /* ignore */ }
      let drag = null;
      dock.addEventListener('pointerdown', e => {
        if (!e.target.closest('.call-head') || e.target.closest('button')) return;
        const r = dock.getBoundingClientRect();
        drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        dock.setPointerCapture(e.pointerId);
        dock.classList.add('dragging');
      });
      dock.addEventListener('pointermove', e => { if (drag) placeDock(e.clientX - drag.dx, e.clientY - drag.dy); });
      const end = () => {
        if (!drag) return;
        drag = null; dock.classList.remove('dragging');
        const r = dock.getBoundingClientRect();
        try { localStorage.setItem('tw_dock', JSON.stringify({ x: r.left, y: r.top })); } catch { /* ignore */ }
      };
      dock.addEventListener('pointerup', end);
      dock.addEventListener('pointercancel', end);
      dock.addEventListener('click', e => {
        const b = e.target.closest('[data-call]');
        if (!b) return;
        const a = b.dataset.call;
        if (a === 'join') V.join();
        if (a === 'leave') V.leave();
        if (a === 'mic') V.toggleMic();
        if (a === 'cam') V.toggleCam();
        if (a === 'min') { V.collapsed = !V.collapsed; renderDock(); }
      });
    }
    const room = V.room;
    if (!room) { dock.hidden = true; return; }
    dock.hidden = false;
    const inCall = room.players.filter(p => p.inCall);
    document.querySelectorAll('.call-count').forEach(el => { el.textContent = inCall.length ? inCall.length : ''; });
    if (!V.on) {
      dock.className = 'call-dock idle';
      dock.innerHTML = `<button class="call-join" data-call="join">🎙️ Join call${inCall.length ? ` <span class="call-pill">${inCall.length} talking</span>` : ''}</button>`;
      return;
    }
    dock.className = `call-dock live ${V.collapsed ? 'collapsed' : ''} ${V.channel && V.channel !== 'room' ? 'private' : ''}`;
    const tiles = inCall.map(p => {
      const mine = p.id === me();
      const peer = V.peers[p.id];
      const same = p.channel === V.channel;
      const state = mine ? 'connected' : peer ? peer.pc.connectionState : 'connecting';
      const showVid = mine ? V.camOn : p.cam && peer && peer.videoStream;
      return `<div class="call-tile ${same ? '' : 'other'} ${state !== 'connected' ? 'wait' : ''}" data-tile="${p.id}" style="--pc:${esc(p.color)}">
        ${showVid ? `<div class="ct-vid" data-v="${p.id}"></div>` : `<span class="ct-av">${esc(p.avatar)}</span>`}
        <span class="ct-name">${mine ? 'You' : esc(p.name)} ${p.mic ? '' : '🔇'}${!same ? ' 🔒' : ''}</span>
        ${state !== 'connected' && !mine ? '<span class="ct-wait">connecting…</span>' : ''}
      </div>`;
    }).join('');
    dock.innerHTML = `<div class="call-head" title="Drag to move"><span>⠿ ${channelLabel(V.channel)}</span><button class="call-min" data-call="min" title="${V.collapsed ? 'Expand' : 'Minimise'}">${V.collapsed ? '▴' : '▾'}</button></div>
      <div class="call-tiles">${tiles}</div>
      <div class="call-ctrls">
        <button data-call="mic" class="${V.micOn ? '' : 'off'}" title="Mute / unmute">${V.micOn ? '🎙️' : '🔇'}</button>
        <button data-call="cam" class="${V.camOn ? 'on' : ''}" title="Camera">${V.camOn ? '📷' : '📷'}<small>${V.camOn ? 'on' : 'off'}</small></button>
        <button data-call="leave" class="hang" title="Leave call">📞 Leave</button>
      </div>`;
    // attach (cached) video elements so they don't flicker on every update
    dock.querySelectorAll('[data-v]').forEach(slot => {
      const id = slot.dataset.v;
      const src = id === me() ? V.cam : V.peers[id] && V.peers[id].videoStream;
      if (!src) return;
      let v = videoEls[id];
      const key = src.id;
      if (!v || v.dataset.key !== key) {
        v = document.createElement('video');
        v.autoplay = true; v.muted = true; v.setAttribute('playsinline', '');
        v.srcObject = id === me() ? new MediaStream([V.cam]) : src;
        v.dataset.key = key;
        videoEls[id] = v;
      }
      slot.appendChild(v);
      v.play().catch(() => {});
    });
  }
})();
