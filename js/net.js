/* Gastgeberin und Gast. Die Gastgeberin hält den vollen Spielstand (js/game.js) und schickt jeder Person
   nur ihre Ansicht. Verbindung über PeerJS (WebRTC): der öffentliche PeerJS-Dienst vermittelt nur den
   Verbindungsaufbau, danach gehen die Daten direkt von Gerät zu Gerät. */
(function (root) {
  'use strict';
  const G = root.TatuGame;
  const PREFIX = 'tatu-spiel-';
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const HOST_KEY = 'tatu-host';
  const MAX_SEATS = 5; // 2 bis 5 Personen (Anna 18.11.)
  const BOT_NAMES = ['Tatu Bot', 'Jaguar Bot', 'Toucan Bot', 'Capybara Bot', 'Macaw Bot'];

  function makeCode() {
    let c = '';
    for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return c;
  }
  function store(key, val) { try { if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* privat */ } }
  function load(key) { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

  function peerAvailable() { return typeof root.Peer === 'function'; }

  function errText(e) {
    const t = e && e.type;
    if (t === 'peer-unavailable') return 'The room can’t be reached right now. Is the host still online?';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'No connection to the matchmaking service. Check your internet.';
    if (t === 'browser-incompatible') return 'This browser can’t make direct connections (WebRTC).';
    if (t === 'unavailable-id') return 'Room is still being released …';
    return 'Connection problem' + (t ? ' (' + t + ')' : '') + '.';
  }

  /* ---------------- Gastgeberin ---------------- */
  class HostSession {
    // opts: { name, cid, online, resume }
    constructor(opts, ui) {
      this.ui = ui; // { view(v), event(ev), lobby(l), status(s, kind) }
      this.isHost = true;
      this.online = opts.online;
      this.bots = {};
      this.conns = {}; // seat -> conn
      this.botTimer = null;
      if (opts.resume) {
        this.code = opts.resume.code;
        this.seats = opts.resume.seats.map(s => Object.assign({}, s, { online: s.kind !== 'remote' }));
        this.state = opts.resume.state;
        if (this.state && this.state.calledBy === undefined) this.state.calledBy = this.state['cab' + 'oBy'] ?? null; // ältere Spielstände
        this.online = opts.resume.online;
      } else {
        this.code = makeCode();
        this.seats = [{ name: opts.name, kind: 'local', cid: opts.cid, online: true }];
        this.state = null;
        if (!this.online) { const n = Math.max(1, Math.min(MAX_SEATS - 1, opts.bots || 1)); for (let i = 0; i < n; i++) this.addBot(); }
      }
      this.seats.forEach((s, i) => { if (s.kind === 'bot') this.bots[i] = new root.TatuBot(i); });
      if (this.state) this.seats.forEach((s, i) => { if (s.kind === 'bot') this.bots[i].observe(G.viewFor(this.state, i)); });
      if (this.online) this.openPeer(); else this.ui.status('', 'ok');
      this.push();
      this.scheduleBots();
    }

    get started() { return !!this.state; }
    get me() { return 0; }
    link() { return location.origin + location.pathname + '?raum=' + this.code; }

    openPeer() {
      if (!peerAvailable()) { this.ui.status('PeerJS could not be loaded. Check your internet and reload.', 'bad'); return; }
      this.ui.status('Opening room …', 'wait');
      const peer = new root.Peer(PREFIX + this.code.toLowerCase(), { debug: 1 });
      this.peer = peer;
      peer.on('open', () => { this.ui.status('', 'ok'); this.pushLobby(); });
      peer.on('connection', conn => this.onConn(conn));
      peer.on('disconnected', () => { if (!peer.destroyed) { this.ui.status('Lost the matchmaking service, reconnecting …', 'wait'); setTimeout(() => { try { peer.reconnect(); } catch (e) { /* */ } }, 1500); } });
      peer.on('error', e => {
        if (e.type === 'unavailable-id') {
          // nach dem Neuladen ist die alte Anmeldung manchmal noch kurz aktiv
          this.ui.status(errText(e), 'wait');
          peer.destroy();
          setTimeout(() => this.openPeer(), 4000);
          return;
        }
        if (e.type === 'peer-unavailable') return;
        this.ui.status(errText(e), 'bad');
        if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') {
          setTimeout(() => { if (!peer.destroyed && peer.disconnected) { try { peer.reconnect(); } catch (x) { /* */ } } }, 4000);
        }
      });
    }

    onConn(conn) {
      conn.on('data', msg => this.onMsg(conn, msg));
      conn.on('close', () => this.onClose(conn));
      conn.on('error', () => this.onClose(conn));
    }

    onClose(conn) {
      const seat = Object.keys(this.conns).find(k => this.conns[k] === conn);
      if (seat === undefined) return;
      delete this.conns[seat];
      this.seats[seat].online = false;
      this.pushLobby();
      this.push();
    }

    onMsg(conn, msg) {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'hello') {
        const name = String(msg.name || 'Guest').slice(0, 16);
        let seat = this.seats.findIndex(s => s.kind === 'remote' && s.cid === msg.cid);
        if (seat < 0) {
          if (this.started) { conn.send({ t: 'reject', msg: 'The game has already started without you.' }); setTimeout(() => conn.close(), 500); return; }
          if (this.seats.length >= MAX_SEATS) { conn.send({ t: 'reject', msg: 'The room is full.' }); setTimeout(() => conn.close(), 500); return; }
          this.seats.push({ name, kind: 'remote', cid: msg.cid, online: true });
          seat = this.seats.length - 1;
        } else if (!this.started) {
          this.seats[seat].name = name;
        }
        if (this.conns[seat] && this.conns[seat] !== conn) { try { this.conns[seat].close(); } catch (e) { /* */ } }
        this.conns[seat] = conn;
        this.seats[seat].online = true;
        conn.send({ t: 'welcome', seat });
        this.save();
        this.pushLobby();
        this.push();
        return;
      }
      if (msg.t === 'bye') {
        // Gast verlässt das Spiel bewusst: vor dem Start Platz frei machen, danach spielt ein Bot weiter
        const seat = Number(Object.keys(this.conns).find(k => this.conns[k] === conn));
        if (Number.isNaN(seat)) return;
        if (!this.started) { delete this.conns[seat]; this.removeSeat(seat); this.save(); }
        else this.botTakeover(seat, 'left the game');
        return;
      }
      if (msg.t === 'act') {
        const seat = Number(Object.keys(this.conns).find(k => this.conns[k] === conn));
        if (Number.isNaN(seat)) return;
        this.handle(seat, msg.a);
      }
    }

    lobbyInfo() {
      return { code: this.code, link: this.link(), isHost: true, online: this.online, started: this.started,
        seats: this.seats.map(s => ({ name: s.name, kind: s.kind, online: s.online })) };
    }
    pushLobby() {
      const l = this.lobbyInfo();
      this.ui.lobby(l);
      for (const k in this.conns) this.conns[k].send({ t: 'lobby', lobby: Object.assign({}, l, { isHost: false }) });
    }

    addBot() {
      if (this.started || this.seats.length >= MAX_SEATS) return;
      const used = this.seats.filter(s => s.kind === 'bot').length;
      this.seats.push({ name: BOT_NAMES[used] || 'Bot', kind: 'bot', online: true });
      this.bots[this.seats.length - 1] = new root.TatuBot(this.seats.length - 1);
      this.pushLobby();
    }
    removeSeat(i) {
      if (this.started || i === 0 || !this.seats[i]) return;
      if (this.conns[i]) { this.conns[i].send({ t: 'reject', msg: 'The host removed you from the room.' }); this.conns[i].close(); }
      this.seats.splice(i, 1);
      // Verbindungen und Bots neu zuordnen
      const conns = {}; const bots = {};
      Object.keys(this.conns).forEach(k => { k = Number(k); if (k !== i) conns[k > i ? k - 1 : k] = this.conns[k]; });
      Object.keys(this.bots).forEach(k => { k = Number(k); if (k !== i) { bots[k > i ? k - 1 : k] = new root.TatuBot(k > i ? k - 1 : k); } });
      this.conns = conns; this.bots = bots;
      for (const k in this.conns) this.conns[k].send({ t: 'welcome', seat: Number(k) });
      this.pushLobby();
    }

    // Ein Bot übernimmt einen Platz, damit die anderen weiterspielen können. Er weiß nichts über die Karten.
    botTakeover(i, why) {
      const s = this.seats[i];
      if (!this.started || !s || s.kind !== 'remote') return;
      if (this.conns[i]) { try { this.conns[i].close(); } catch (e) { /* */ } delete this.conns[i]; }
      s.kind = 'bot'; s.online = true; s.cid = null;
      this.bots[i] = new root.TatuBot(i);
      const text = `${s.name} ${why}. A bot plays their cards from now on.`;
      this.state.log.push(text);
      this.afterChange([{ to: 'all', type: 'left', name: s.name, text }]);
    }

    startGame() {
      if (this.started || this.seats.length < 2) return;
      this.state = G.newGame(this.seats.map(s => s.name));
      G.startRound(this.state);
      this.afterChange([{ to: 'all', type: 'newRound' }]);
      this.pushLobby();
    }

    act(a) { this.handle(0, a); }

    handle(seat, a) {
      if (!this.state) return;
      const r = G.apply(this.state, seat, a);
      if (!r.ok) { this.sendTo(seat, { t: 'err', msg: r.error }); return; }
      this.afterChange(r.events);
    }

    sendTo(seat, msg) {
      const s = this.seats[seat];
      if (!s) return;
      if (s.kind === 'local') {
        if (msg.t === 'err') this.ui.status(msg.msg, 'bad');
        else if (msg.t === 'ev') this.ui.event(msg.ev);
        else if (msg.t === 'view') this.ui.view(msg.view);
      } else if (s.kind === 'remote') {
        const c = this.conns[seat];
        if (c && c.open) c.send(msg);
      } else if (s.kind === 'bot' && msg.t === 'ev') {
        this.bots[seat].learn(msg.ev);
      }
    }

    afterChange(events) {
      for (const ev of events) {
        this.seats.forEach((_, i) => { if (ev.to === 'all' || ev.to === i) this.sendTo(i, { t: 'ev', ev }); });
      }
      this.push();
      this.save();
      this.scheduleBots();
    }

    push() {
      if (!this.state) { this.pushLobby(); return; }
      this.seats.forEach((s, i) => {
        const v = G.viewFor(this.state, i);
        v.seats = this.seats.map(x => ({ name: x.name, kind: x.kind, online: x.online }));
        v.code = this.code; v.online = this.online;
        if (s.kind === 'bot') this.bots[i].observe(v);
        else this.sendTo(i, { t: 'view', view: v });
      });
    }

    scheduleBots() {
      clearTimeout(this.botTimer);
      const st = this.state;
      if (!st) return;
      let who = -1;
      if (st.phase === 'peek') who = this.seats.findIndex((s, i) => s.kind === 'bot' && !st.ready[i]);
      else if (st.phase === 'turn' || st.phase === 'drawn' || st.phase === 'action') who = this.seats[st.turn] && this.seats[st.turn].kind === 'bot' ? st.turn : -1;
      if (who < 0) return;
      const delay = st.phase === 'peek' ? 500 : st.phase === 'turn' ? 1800 : 2400; // langsam genug, um jeden Schritt zu sehen
      this.botTimer = setTimeout(() => {
        const v = G.viewFor(this.state, who);
        this.bots[who].observe(v);
        const a = this.bots[who].decide(v);
        const r = G.apply(this.state, who, a);
        if (!r.ok) { console.warn('Bot-Zug abgelehnt', a, r.error); G.apply(this.state, who, { type: 'skip' }); this.afterChange([]); return; }
        this.afterChange(r.events);
      }, delay);
    }

    save() {
      if (!this.state) return;
      store(HOST_KEY, { code: this.code, online: this.online, state: this.state, seats: this.seats.map(s => ({ name: s.name, kind: s.kind, cid: s.cid })), at: Date.now() });
    }

    // iOS trennt im Hintergrund: beim Zurückkommen Vermittlung wieder aufnehmen
    wake() {
      if (!this.online) return;
      if (!this.peer || this.peer.destroyed) this.openPeer();
      else if (this.peer.disconnected) { try { this.peer.reconnect(); } catch (e) { this.openPeer(); } }
    }

    leave() {
      clearTimeout(this.botTimer);
      store(HOST_KEY, null);
      for (const k in this.conns) { try { this.conns[k].send({ t: 'reject', msg: 'The host ended the game.' }); } catch (e) { /* */ } }
      setTimeout(() => { if (this.peer) this.peer.destroy(); }, 300);
    }
  }

  /* ---------------- Gast ---------------- */
  class GuestSession {
    constructor(opts, ui) {
      this.ui = ui;
      this.isHost = false;
      this.code = opts.code.toUpperCase();
      this.name = opts.name;
      this.cid = opts.cid;
      this.seat = null;
      this.closed = false;
      this.retry = 0;
      if (!peerAvailable()) { ui.status('PeerJS could not be loaded. Check your internet and reload.', 'bad'); return; }
      this.openPeer();
    }
    get me() { return this.seat; }

    openPeer() {
      this.ui.status('Connecting to room ' + this.code + ' …', 'wait');
      const peer = new root.Peer({ debug: 1 });
      this.peer = peer;
      peer.on('open', () => this.connect());
      peer.on('disconnected', () => { if (!peer.destroyed && !this.closed) setTimeout(() => { try { peer.reconnect(); } catch (e) { /* */ } }, 1500); });
      peer.on('error', e => {
        if (this.closed) return;
        this.ui.status(errText(e), e.type === 'peer-unavailable' ? 'wait' : 'bad');
        if (e.type === 'peer-unavailable') this.scheduleRetry();
        else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' || e.type === 'socket-closed') {
          setTimeout(() => { if (!this.closed) { try { peer.destroy(); } catch (x) { /* */ } this.openPeer(); } }, 4000);
        }
      });
    }

    connect() {
      if (this.closed) return;
      const conn = this.peer.connect(PREFIX + this.code.toLowerCase(), { reliable: true });
      this.conn = conn;
      const timeout = setTimeout(() => { if (!conn.open && !this.closed) { try { conn.close(); } catch (e) { /* */ } this.scheduleRetry(); } }, 12000);
      conn.on('open', () => {
        clearTimeout(timeout);
        this.retry = 0;
        this.ui.status('', 'ok');
        conn.send({ t: 'hello', name: this.name, cid: this.cid });
      });
      conn.on('data', msg => this.onMsg(msg));
      conn.on('close', () => { clearTimeout(timeout); if (this.conn === conn && !this.closed) { this.ui.status('Connection lost, reconnecting …', 'wait'); this.scheduleRetry(); } });
      conn.on('error', () => { /* close folgt */ });
    }

    scheduleRetry() {
      if (this.closed) return;
      clearTimeout(this.retryTimer);
      const wait = Math.min(2000 + this.retry * 1500, 8000);
      this.retry++;
      this.retryTimer = setTimeout(() => {
        if (this.closed) return;
        if (!this.peer || this.peer.destroyed) this.openPeer();
        else if (this.peer.disconnected) { try { this.peer.reconnect(); } catch (e) { this.openPeer(); } }
        else this.connect();
      }, wait);
    }

    onMsg(msg) {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'welcome') { this.seat = msg.seat; }
      else if (msg.t === 'lobby') this.ui.lobby(msg.lobby);
      else if (msg.t === 'view') { this.seat = msg.view.me; this.ui.view(msg.view); }
      else if (msg.t === 'ev') this.ui.event(msg.ev);
      else if (msg.t === 'err') this.ui.status(msg.msg, 'bad');
      else if (msg.t === 'reject') { this.closed = true; this.ui.status(msg.msg, 'bad'); this.ui.rejected && this.ui.rejected(msg.msg); }
    }

    act(a) {
      if (this.conn && this.conn.open) this.conn.send({ t: 'act', a });
      else this.ui.status('No connection, move not sent. Reconnecting …', 'bad');
    }

    // iOS trennt im Hintergrund: beim Zurückkommen sofort neu verbinden
    wake() {
      if (this.closed) return;
      if (!this.conn || !this.conn.open) { this.retry = 0; this.scheduleRetry(); }
    }

    leave() { this.closed = true; try { if (this.conn && this.conn.open) this.conn.send({ t: 'bye' }); } catch (e) { /* */ } setTimeout(() => this.close(), 250); }
    close() { try { if (this.conn) this.conn.close(); if (this.peer) this.peer.destroy(); } catch (e) { /* */ } }
  }

  root.TatuNet = { HostSession, GuestSession, makeCode, loadHost: () => load(HOST_KEY), clearHost: () => store(HOST_KEY, null), store, load };
})(window);
