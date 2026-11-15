/* Tatu! Bildschirme und Bedienung. Spielregeln in game.js, Verbindung in net.js, Karten in cards.js. */
(function () {
  'use strict';
  const C = window.TatuCards;
  const Net = window.TatuNet;
  const $app = document.getElementById('app');
  const $layer = document.getElementById('layer');
  const $status = document.getElementById('status');

  const S = {
    screen: 'home',
    session: null,
    view: null,
    lobby: null,
    sel: [],               // gewählte eigene Karten (Tauschen)
    bsel: { mine: null, opp: null }, // blinder Tausch
    reveals: [],           // Warteschlange: aufgedeckte Karten
    sheet: null,           // 'rules' | 'scores' | 'menu'
    hl: { seq: 0, until: 0 },
    seenSeq: 0,
    joinCode: null,
    toastTimer: null,
    lastPhase: null,
    flipIds: new Set(),
    marks: {},             // letzte sichtbare Aktion je Spieler, bleibt bis zu dessen nächstem Zug
  };

  /* ---------- Hilfen ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function pref(k, v) { if (v === undefined) return Net.load('tatu-' + k); Net.store('tatu-' + k, v); }
  function cid() {
    let c = pref('cid');
    if (!c) { c = 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); pref('cid', c); }
    return c;
  }
  function names(list) { return list.length <= 1 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
  const ICON = {
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    scores: '<svg viewBox="0 0 24 24"><path d="M5 20V11M12 20V5M19 20v-6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  function wavesSvg() {
    let w = '';
    for (let y = 10; y < 400; y += 22) w += `<path d="M-10 ${y} q 12 -10 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0" fill="none" stroke="#FFF6E9" stroke-width="5"/>`;
    return `<svg class="waves" viewBox="0 0 560 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${w}</svg>`;
  }

  /* ---------- Status ---------- */
  function setStatus(text, kind) {
    if (!text || kind === 'ok') { $status.hidden = true; return; }
    $status.className = 'status ' + (kind || 'wait');
    $status.innerHTML = (kind === 'wait' ? '<span class="spin"></span>' : '<span aria-hidden="true">⚠︎</span>') + '<span>' + esc(text) + '</span>';
    $status.hidden = false;
    if (kind === 'bad') { clearTimeout(setStatus.t); setStatus.t = setTimeout(() => { if ($status.classList.contains('bad')) $status.hidden = true; }, 4500); }
  }

  function toast(big, small) {
    clearTimeout(S.toastTimer);
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = esc(big) + (small ? `<small>${esc(small)}</small>` : '');
    document.body.appendChild(t);
    S.toastTimer = setTimeout(() => t.remove(), 2200);
  }

  /* ---------- Sitzung ---------- */
  const ui = {
    view(v) {
      const first = !S.view;
      const prev = S.view;
      const fresh = v.seq !== S.seenSeq && !first;
      // Startpunkte der Animation VOR dem Neuzeichnen merken
      const src = fresh ? { drawn: rectOf('.drawn .card-svg'), deck: rectOf('[aria-label^="Deck"] .card-svg') } : null;
      S.view = v;
      if (v.last && v.seq !== S.seenSeq) {
        const L = v.last;
        if (L.type === 'draw' || L.type === 'call') delete S.marks[L.p];
        if (['swap', 'bswap', 'peek', 'spy'].includes(L.type)) S.marks[L.p] = L;
      }
      if (v.phase === 'peek' || v.phase === 'roundEnd' || v.phase === 'gameEnd') S.marks = {};
      if (fresh && v.last && v.last.p !== v.me) requestAnimationFrame(() => animateMove(v.last, src));
      if (v.seq !== S.seenSeq) {
        S.seenSeq = v.seq; S.hl = { seq: v.seq, until: Date.now() + 1900 };
        clearTimeout(S.hlTimer);
        S.hlTimer = setTimeout(() => { S.flipIds = new Set(); render(); }, 2000);
      }
      // Auswahl zurücksetzen, wenn die Phase wechselt
      if (!prev || prev.phase !== v.phase || prev.turn !== v.turn) { S.sel = []; S.bsel = { mine: null, opp: null }; }
      // Karten, die gerade erst sichtbar werden, umdrehen
      S.flipIds = new Set();
      if (prev) {
        const known = new Set();
        prev.players.forEach(p => p.cards.forEach(c => { if ('v' in c) known.add(c.id); }));
        v.players.forEach(p => p.cards.forEach(c => { if ('v' in c && !known.has(c.id)) S.flipIds.add(c.id); }));
      }
      if (S.screen !== 'table') S.screen = 'table';
      if ((v.phase === 'roundEnd' || v.phase === 'gameEnd') && (!prev || prev.phase !== v.phase)) S.sheet = null;
      if (first) S.sheet = null;
      render();
    },
    event(ev) {
      const v = S.view;
      if (ev.type === 'reveal') { S.reveals.push(ev); render(); }
      else if (ev.type === 'call') {
        const name = v && v.players[ev.by] ? v.players[ev.by].name : '';
        const me = v && ev.by === v.me;
        toast('TATU!', me ? 'You called it. Everyone else gets one more turn.' : name + ' called it. You get one more turn.');
      } else if (ev.type === 'newRound') { S.reveals = []; }
      else if (ev.type === 'reshuffle') toast('Reshuffled!', 'The deck ran out. The discard pile is the new deck (' + ev.count + ' cards).');
    },
    lobby(l) { S.lobby = l; if (!l.started && S.screen !== 'table') { S.screen = 'lobby'; render(); } else if (S.screen === 'lobby') render(); },
    status: setStatus,
    rejected() { S.screen = 'home'; S.session = null; S.view = null; render(); },
  };

  function startHost(online) {
    const name = readName();
    if (!name) return;
    const s = new Net.HostSession({ name, cid: cid(), online }, ui);
    S.session = s; S.view = null;
    try { sessionStorage.setItem('tatu-host-tab', s.code); } catch (e) { /* */ }
    if (online) history.replaceState(null, '', '?room=' + s.code);
    S.screen = 'lobby';
    if (!online) s.startGame();
    render();
  }
  function resumeHost(saved) {
    S.session = new Net.HostSession({ resume: saved }, ui);
    try { sessionStorage.setItem('tatu-host-tab', saved.code); } catch (e) { /* */ }
    if (saved.online) history.replaceState(null, '', '?room=' + saved.code);
    render();
  }
  function startGuest(code) {
    const name = readName();
    if (!name) return;
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) { setStatus('The room code has 5 characters.', 'bad'); return; }
    history.replaceState(null, '', '?room=' + code);
    try { sessionStorage.setItem('tatu-guest-tab', code); } catch (e) { /* */ }
    S.session = new Net.GuestSession({ code, name, cid: cid() }, ui);
    S.screen = 'lobby';
    S.lobby = { code, seats: [], isHost: false, started: false, waiting: true };
    render();
  }
  function readName() {
    const inp = document.getElementById('name');
    const name = (inp ? inp.value : pref('name') || '').trim().slice(0, 16);
    if (!name) { setStatus('Please enter your name first.', 'bad'); if (inp) inp.focus(); return null; }
    pref('name', name);
    return name;
  }
  function leave() {
    if (S.session) S.session.leave();
    S.session = null; S.view = null; S.lobby = null; S.sheet = null; S.reveals = [];
    try { sessionStorage.removeItem('tatu-host-tab'); sessionStorage.removeItem('tatu-guest-tab'); } catch (e) { /* */ }
    history.replaceState(null, '', location.pathname);
    S.screen = 'home';
    setStatus('', 'ok');
    render();
  }
  function act(a) { if (S.session) S.session.act(a); }
  // Eigene Rückfrage statt confirm(): das Browserfenster wird in manchen Umgebungen still unterdrückt
  function ask(title, text, yes, onYes, cls) { S.ask = { title, text, yes, onYes, cls }; renderLayer(); }

  /* ---------- Darstellung ---------- */
  function render() {
    document.body.classList.toggle('on-table', S.screen === 'table');
    if (S.screen === 'home') $app.innerHTML = homeHtml();
    else if (S.screen === 'join') $app.innerHTML = joinHtml();
    else if (S.screen === 'lobby') $app.innerHTML = lobbyHtml();
    else if (S.screen === 'table' && S.view) $app.innerHTML = tableHtml(S.view);
    renderLayer();
    wakeLock(S.screen === 'table');
  }

  function homeHtml() {
    const name = esc(pref('name') || '');
    const saved = Net.loadHost();
    const fan = [7, 11, 0, 9, 13];
    const fanHtml = fan.map((v, i) => `<div class="fc" style="z-index:${10 - Math.abs(i - 2)};transform:translateX(${(i - 2) * 30}px) rotate(${(i - 2) * 12}deg)">${C.face(v)}</div>`).join('');
    return `<div class="view">
      <section class="hero">
        <div class="logo"><div class="mascot">${C.mascot(76)}</div><div><h1>Tatu!</h1></div></div>
        <div class="fan">${fanHtml}</div>
        <p>Remember your cards, swap smart and call <b>“Tatu!”</b> when you think you have the fewest points.</p>
      </section>
      ${saved ? `<section class="panel"><h2>Game in progress</h2><p class="muted small-text">Room ${esc(saved.code)} · Round ${saved.state.round} · ${esc(names(saved.seats.map(s => s.name)))}</p>
        <button class="btn primary" data-do="resume">Continue</button>
        <button class="btn ghost" data-do="discard-saved">End game</button></section>` : ''}
      <section class="panel">
        <label class="field"><span>Your name</span><input id="name" maxlength="16" autocomplete="nickname" value="${name}" placeholder="e.g. Sam"></label>
        <button class="btn primary" data-do="host">Start an online game</button>
        <button class="btn ghost" data-do="bot">Practice against the bot</button>
      </section>
      <section class="panel">
        <h2>Join a room</h2>
        <div class="joinrow"><input id="code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE" aria-label="Room code"><button class="btn leaf" data-do="join">Join</button></div>
        <p class="muted small-text" style="margin:10px 0 0">Or just open the link you were sent.</p>
      </section>
      <div class="links"><button data-do="rules">How to play</button><a href="karten.html">See all cards</a></div>
    </div>`;
  }

  function joinHtml() {
    const name = esc(pref('name') || '');
    const saved = Net.loadHost();
    const mine = saved && saved.code === S.joinCode;
    return `<div class="view">
      <section class="hero">
        <div class="logo"><div class="mascot">${C.mascot(76)}</div><div><h1>Tatu!</h1></div></div>
        <p>You've been invited to a game. Room <b>${esc(S.joinCode)}</b></p>
      </section>
      <section class="panel">
        <label class="field"><span>Your name</span><input id="name" maxlength="16" autocomplete="nickname" value="${name}" placeholder="e.g. Alex"></label>
        <button class="btn primary" data-do="join-link">Join the game</button>
        ${mine ? '<button class="btn ghost" data-do="resume">I opened this room: continue</button>' : ''}
      </section>
      <div class="links"><button data-do="rules">How to play</button><button data-do="home">Home</button></div>
    </div>`;
  }

  function lobbyHtml() {
    const l = S.lobby || { seats: [] };
    const host = S.session && S.session.isHost;
    const seats = l.seats.map((s, i) => `<li><span class="dot ${s.online ? '' : 'off'}" aria-hidden="true"></span>${esc(s.name)}
        <span class="tag">${i === 0 ? 'host' : s.kind === 'bot' ? 'bot' : s.online ? 'online' : 'offline'}</span>
        ${host && i > 0 ? `<button class="x" data-do="kick" data-i="${i}" aria-label="Remove ${esc(s.name)}">×</button>` : ''}</li>`).join('');
    if (!host) {
      return `<div class="view">
        <section class="hero"><div class="logo"><div class="mascot">${C.mascot(76)}</div><div><h1>Tatu!</h1></div></div>
        <p>Room <b>${esc(l.code)}</b></p></section>
        <section class="panel">
          ${l.seats.length ? `<h2>In the room</h2><ul class="seats">${seats}</ul><p class="muted">Almost there: ${esc(l.seats[0].name)} will start the game.</p>` : '<p>Connecting …</p>'}
          <button class="btn ghost" data-do="leave">Leave room</button>
        </section></div>`;
    }
    const ready = l.seats.length >= 2 && l.seats.every(s => s.online);
    return `<div class="view">
      <section class="panel">
        <h2>Your room</h2>
        <p class="muted small-text" style="margin:0">Send the link or the code to the other players:</p>
        <div class="code" aria-label="Room code">${esc(l.code || '')}</div>
        <div class="linkbox">${esc(l.link || '')}</div>
        <div class="row"><button class="btn primary" data-do="share">${ICON.share} Share link</button><button class="btn ghost" data-do="copy">Copy</button></div>
      </section>
      <section class="panel">
        <h2>In the room</h2>
        <ul class="seats">${seats}</ul>
        ${l.seats.length < 2 ? '<p class="muted small-text">Waiting for players … As soon as someone opens the link, their name shows up here.</p>' : ''}
        <button class="btn leaf" data-do="start" ${ready ? '' : 'disabled'}>Let's go!</button>
        ${l.seats.length < 4 ? '<button class="btn ghost" data-do="addbot">Add a bot</button>' : ''}
        <button class="btn ghost" data-do="leave">Close room</button>
      </section></div>`;
  }

  // Ein Kartenknopf
  function cardHtml(c, opts) {
    const face = 'v' in c;
    const cls = ['c'];
    if (opts.pick) cls.push('pick');
    if (opts.sel) cls.push('sel');
    if (opts.hl) cls.push('hl');
    if (opts.tag) cls.push('tagged'); // nur Rahmen, kein Text (Wunsch 16.11.)
    if (face && S.flipIds.has(c.id)) cls.push('flip');
    const label = face ? '' : ` aria-label="${esc(opts.label || 'face-down card')}"`;
    return `<button class="${cls.join(' ')}" ${opts.pick ? '' : 'tabindex="-1"'} data-card="${opts.owner}:${opts.slot}"${label}>${face ? C.face(c.v) : C.back()}${opts.sel && opts.selNo ? `<span class="check">${opts.selNo}</span>` : ''}${opts.locked ? `<span class="lock" aria-label="locked">${ICON.lock}</span>` : ''}</button>`;
  }

  // Welche Karten tragen ein Schild? Bleibt stehen, bis die Person wieder dran ist (Wunsch 16.11.)
  function marksMap(v) {
    const m = new Map();
    const fresh = v.last && S.hl.seq === v.last.seq && Date.now() < S.hl.until;
    for (const k in S.marks) {
      const L = S.marks[k];
      const pulse = !!(fresh && L.seq === v.last.seq);
      const put = (key, tag) => m.set(key, { tag, pulse });
      if (L.type === 'swap' && L.ok) put(L.p + ':' + L.newSlot, L.slots.length > 1 ? 'new · ' + L.slots.length + '→1' : 'new');
      if (L.type === 'swap' && !L.ok) { L.slots.forEach(s => put(L.p + ':' + s, 'shown')); if (L.penaltySlot !== null && L.penaltySlot !== undefined) put(L.p + ':' + L.penaltySlot, 'penalty'); }
      if (L.type === 'peek') put(L.owner + ':' + L.slot, 'peeked');
      if (L.type === 'spy') put(L.owner + ':' + L.slot, 'spied');
      if (L.type === 'bswap') { put(L.p + ':' + L.slot, 'swapped'); put(L.target + ':' + L.tslot, 'swapped'); }
    }
    return m;
  }

  /* ---------- Bewegung: Gegnerzüge sichtbar machen ---------- */
  function rectOf(sel) { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? r : null; }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fly(svg, from, to, delay, hide) {
    return new Promise(res => {
      if (!from || !to) return res();
      const el = document.createElement('div');
      el.className = 'fly';
      el.style.cssText = `left:${from.left}px;top:${from.top}px;width:${from.width}px;`;
      el.innerHTML = svg;
      document.body.appendChild(el);
      if (hide) hide.style.visibility = 'hidden';
      const dx = to.left - from.left, dy = to.top - from.top, sc = to.width / from.width;
      const a = el.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px,${dy}px) scale(${sc})` }],
        { duration: 650, delay, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'both' });
      a.onfinish = () => { el.remove(); if (hide) hide.style.visibility = ''; res(); };
    });
  }
  async function animateMove(L, src) {
    if (reduced() || !src) return;
    const slotEl = (p, s) => document.querySelector(`[data-card="${p}:${s}"]`);
    const discardEl = document.querySelector('[aria-label^="Discard"] .card-svg');
    const deckR = rectOf('[aria-label^="Deck"] .card-svg') || src.deck;
    if (L.type === 'swap') {
      const start = src.drawn || deckR;
      if (L.ok) {
        const t = slotEl(L.p, L.newSlot);
        if (!t) return;
        await fly(C.back(), start, t.getBoundingClientRect(), 0, t);
        await fly(C.face(L.values[0]), t.getBoundingClientRect(), discardEl && discardEl.getBoundingClientRect(), 80, discardEl);
      } else {
        await fly(C.back(), start, discardEl && discardEl.getBoundingClientRect(), 0, discardEl);
        const t = L.penaltySlot !== null && L.penaltySlot !== undefined && slotEl(L.p, L.penaltySlot);
        if (t) await fly(C.back(), deckR, t.getBoundingClientRect(), 80, t);
      }
    }
    if (L.type === 'bswap') {
      const a = slotEl(L.p, L.slot), b = slotEl(L.target, L.tslot);
      if (!a || !b) return;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      fly(C.back(), ra, rb, 0, b); await fly(C.back(), rb, ra, 0, a);
    }
  }

  function slotLabel(n, i) {
    return 'card ' + (i + 1) + ' from the left';
  }

  function tableHtml(v) {
    const me = S.view.me;
    const myTurn = v.turn === me;
    const ph = v.phase;
    const marks = marksMap(v);
    const mk = key => marks.get(key) || {};
    const cur = v.players[v.turn];
    const opps = v.players.map((p, i) => i).filter(i => i !== me);
    const seats = v.seats || [];

    // Was ist antippbar?
    const chosen = v.startPeek || [];
    const startPick = ph === 'peek' && !v.ready[me] && chosen.length < 2;
    const pickMine = startPick || (myTurn && (ph === 'drawn' || (ph === 'action' && (v.action === 'peek' || v.action === 'swap'))));
    const pickOpp = i => myTurn && ph === 'action' && (v.action === 'spy' || (v.action === 'swap' && i !== v.calledBy));

    const oppHtml = opps.map(i => {
      const p = v.players[i];
      const n = p.cards.length;
      const cols = n <= 6 ? n : Math.ceil(n / 2); // eine Reihe
      const off = seats[i] && seats[i].kind === 'remote' && !seats[i].online;
      const cards = p.cards.map((c, s) => cardHtml(c, {
        owner: i, slot: s, pick: pickOpp(i), hl: mk(i + ':' + s).pulse, tag: mk(i + ':' + s).tag,
        sel: S.bsel.opp && S.bsel.opp.t === i && S.bsel.opp.s === s,
        locked: v.calledBy === i, label: p.name + ', ' + slotLabel(n, s),
      })).join('');
      return `<div class="opp ${v.turn === i && (ph === 'turn' || ph === 'drawn' || ph === 'action') ? 'turn' : ''}">
        <div class="opp-head">${esc(p.name)}${v.calledBy === i ? '<span class="badge pink">TATU!</span>' : ''}${off ? '<span class="badge off">offline</span>' : ''}${v.turn === i && (ph === 'turn' || ph === 'drawn' || ph === 'action') ? '<span class="badge turnb">turn</span>' : ''}<span class="pts">${p.total} pts</span></div>
        <div class="hand small ${cols > 4 ? 'many' : ''}" style="--cols:${cols}">${cards}</div></div>`;
    }).join('');

    // Mitte: Stapel, gezogene Karte, Ablage
    const canDeck = myTurn && ph === 'turn';
    const canDiscardDraw = myTurn && ph === 'turn' && v.discardTop;
    const canDiscardDrop = myTurn && ph === 'drawn' && v.drawnFrom === 'deck';
    const deck = `<button class="pile ${canDeck ? 'can' : ''}" data-do="${canDeck ? 'draw-deck' : ''}" ${canDeck ? '' : 'tabindex="-1"'} aria-label="Deck, ${v.deckCount} cards">
        <span class="slot"><span class="stack ${v.deckCount > 1 ? 'deep' : ''}">${v.deckCount ? C.back() : '<span class="empty" style="display:block"></span>'}</span></span><span class="cnt">Deck · ${v.deckCount}</span></button>`;
    const discard = `<button class="pile ${canDiscardDraw || canDiscardDrop ? 'can' : ''}" data-do="${canDiscardDraw ? 'draw-discard' : canDiscardDrop ? 'discard' : ''}" ${canDiscardDraw || canDiscardDrop ? '' : 'tabindex="-1"'} aria-label="Discard pile${v.discardTop ? ', top ' + v.discardTop.v : ''}">
        <span class="slot"><span class="stack ${v.discardCount > 1 ? 'deep' : ''}">${v.discardTop ? C.face(v.discardTop.v) : '<span class="empty" style="display:block"></span>'}</span></span><span class="cnt">Discard</span></button>`;
    let drawn;
    if (v.drawn) {
      const face = 'v' in v.drawn;
      drawn = `<div class="drawn-zone full ${myTurn ? 'mine' : ''}"><div class="drawn ${S.hl.seq === (v.last && v.last.seq) && Date.now() < S.hl.until ? 'in' : ''}">${face ? C.face(v.drawn.v) : C.back()}</div>
        <span class="lbl">${myTurn ? (v.drawnFrom === 'discard' ? 'You took' : 'You drew') : esc(cur.name) + (v.drawnFrom === 'discard' ? ' took' : ' drew')}</span></div>`;
    } else {
      drawn = `<div class="drawn-zone"><span class="ph">drawn<br>card</span></div>`;
    }

    // Eigene Hand
    const mineP = v.players[me];
    const n = mineP.cards.length;
    const cols = n <= 6 ? n : Math.ceil(n / 2); // eine Reihe
    const myCards = mineP.cards.map((c, s) => {
      const selIdx = S.sel.indexOf(s);
      const sel = selIdx >= 0 || S.bsel.mine === s;
      return cardHtml(c, { owner: me, slot: s, pick: pickMine, sel, selNo: ph === 'drawn' && S.sel.length > 1 ? selIdx + 1 : 0, hl: mk(me + ':' + s).pulse, tag: mk(me + ':' + s).tag, locked: v.calledBy === me, label: 'Your card, ' + slotLabel(n, s) });
    }).join('');

    const P = promptFor(v, me);
    const lastNews = v.log.length ? v.log[v.log.length - 1] : '';

    return `<div class="table">
      <header class="tbar">
        <button class="iconbtn" data-do="menu" aria-label="Menu">${ICON.menu}</button>
        <div class="title"><b>Tatu!</b> · Round ${v.round}${v.online ? ' · ' + esc(v.code) : ''}</div>
        <button class="iconbtn" data-do="scores" aria-label="Scores">${ICON.scores}</button>
      </header>
      <section class="opps">${oppHtml}</section>
      <p class="news" aria-live="polite">${esc(lastNews)}</p>
      <section class="center"><div class="piles">${deck}${discard}</div>${drawn}</section>
      <div class="mine-area">
        <div class="prompt ${P.cls}" aria-live="polite">${P.html}</div>
        <div class="mine-head">${esc(mineP.name)} (you) · ${mineP.total} pts${v.calledBy === me ? ' <span class="badge pink">TATU!</span>' : ''}</div>
        <div class="hand big" style="--cols:${cols}">${myCards}</div>
        <div class="actions">${actionsHtml(v, me)}</div>
      </div>
    </div>`;
  }

  function promptFor(v, me) {
    const ph = v.phase;
    const myTurn = v.turn === me;
    const cur = v.players[v.turn];
    const others = v.players.map((p, i) => i).filter(i => i !== me);
    const lastTurn = v.calledBy !== null && v.calledBy !== me ? '<small>Last turn! ' + esc(v.players[v.calledBy].name) + ' called Tatu.</small>' : '';
    if (ph === 'peek') {
      if (!v.ready[me]) {
        const k = (v.startPeek || []).length;
        if (k < 2) return { cls: 'mine', html: `Tap ${k ? 'one more card' : 'two of your cards'} to look at ${k ? 'it' : 'them'} (${k}/2)<small>Pick any two. Only you can see them.</small>` };
        return { cls: 'mine', html: 'Memorise these two cards!<small>They turn face down again when you tap “Got it!”.</small>' };
      }
      const wait = others.filter(i => !v.ready[i]).map(i => esc(v.players[i].name));
      return { cls: '', html: 'Waiting for ' + names(wait) + ' …' };
    }
    if (ph === 'roundEnd' || ph === 'gameEnd') return { cls: '', html: 'Round over.' };
    if (!myTurn) {
      const verb = ph === 'action' ? { peek: 'is peeking at a card', spy: 'is spying', swap: 'is blind-swapping' }[v.action] : ph === 'drawn' ? 'is thinking' : 'is up';
      return { cls: '', html: esc(cur.name) + ' ' + verb + ' …' + (v.calledBy === me ? '<small>You called Tatu, your cards are locked.</small>' : lastTurn) };
    }
    if (ph === 'turn') {
      return { cls: 'mine', html: 'Your turn! Draw a card.' + (lastTurn || (v.calledBy === null ? '<small>From the deck, from the discard pile, or call “Tatu!”.</small>' : '')) };
    }
    if (ph === 'drawn') {
      const d = v.drawn.v;
      const act = C.ACTION[d];
      const clear = S.sel.length ? ' <button class="linkbtn" data-do="clear-sel">Clear selection</button>' : '';
      const multi = S.sel.length > 1 ? `<small>${S.sel.length} cards selected. Are you sure they match? If not: penalty card!${clear}</small>`
        : S.sel.length ? `<small>1 card selected. You can tap more.${clear}</small>` : '';
      if (v.drawnFrom === 'discard') return { cls: 'mine', html: `Tap the card you want to swap for the <b>${d}</b>.` + (multi || '<small>You can also swap several cards at once.</small>') };
      return { cls: 'mine', html: `You drew ${d === 8 || d === 11 ? 'an' : 'a'} <b>${d}</b>. Swap or discard?` + (multi || `<small>Tap your card(s) to swap.${act ? ' Discard = ' + { peek: 'peek at one of your cards', spy: 'look at another player’s card', swap: 'blind swap' }[act] + '.' : ''}</small>`) };
    }
    if (ph === 'action') {
      const opp = names(others.map(i => esc(v.players[i].name)));
      if (v.action === 'peek') return { cls: 'mine', html: 'Peek: tap one of your cards.' };
      if (v.action === 'spy') return { cls: 'mine', html: `Spy: tap one of ${opp}’s cards.` };
      if (v.action === 'swap') {
        const m = S.bsel.mine !== null, o = !!S.bsel.opp;
        return { cls: 'mine', html: `Swap: pick ${m ? '✓ your card' : 'one of your cards'} and ${o ? '✓ theirs' : 'one of ' + opp + '’s'}.<small>Neither of you sees what is swapped.${m || o ? ' <button class="linkbtn" data-do="clear-sel">Clear selection</button>' : ''}</small>` };
      }
    }
    return { cls: '', html: '' };
  }

  function actionsHtml(v, me) {
    const ph = v.phase;
    const myTurn = v.turn === me;
    if (ph === 'peek') return v.ready[me] ? '' : `<button class="btn primary" data-do="ready" ${(v.startPeek || []).length >= Math.min(2, v.players[me].cards.length) ? '' : 'disabled'}>Got it!</button>`;
    if (!myTurn) return '';
    if (ph === 'turn') {
      return `<div class="row"><button class="btn primary" data-do="draw-deck" ${v.deckCount || v.discardCount > 1 ? '' : 'disabled'}>Deck</button>
        <button class="btn ghost" data-do="draw-discard" ${v.discardTop ? '' : 'disabled'}>Discard${v.discardTop ? ' ' + v.discardTop.v : ''}</button>
        ${v.calledBy === null ? '<button class="btn pink" data-do="call">Tatu!</button>' : ''}</div>`;
    }
    if (ph === 'drawn') {
      const n = S.sel.length;
      const act = C.ACTION[v.drawn.v];
      const swapLbl = n > 1 ? `Swap ${n} cards` : 'Swap';
      const discard = v.drawnFrom === 'deck' ? `<button class="btn ghost" data-do="discard"><span class="two">Discard${act ? '<small>+ ' + { peek: 'Peek', spy: 'Spy', swap: 'Swap' }[act] + '</small>' : ''}</span></button>`
        : '<button class="btn ghost" data-do="undo"><span class="two">Put back<small>don’t take it</small></span></button>';
      return `<div class="row"><button class="btn primary" data-do="swap" ${n ? '' : 'disabled'}>${swapLbl}</button>${discard}</div>`;
    }
    if (ph === 'action') {
      const back = '<button class="btn ghost" data-do="undo"><span class="two">Undo<small>swap instead</small></span></button>';
      if (v.action === 'swap') return `<div class="row"><button class="btn primary" data-do="bswap" ${S.bsel.mine !== null && S.bsel.opp ? '' : 'disabled'}>Swap</button>${back}<button class="btn ghost" data-do="skip">Skip</button></div>`;
      return `<div class="row">${back}<button class="btn ghost" data-do="skip">Skip</button></div>`;
    }
    return '';
  }

  /* ---------- Overlays ---------- */
  function renderLayer() {
    let html = '';
    const v = S.view;
    if (S.ask) html = `<h2>${esc(S.ask.title)}</h2><p>${esc(S.ask.text)}</p>
      <button class="btn ${S.ask.cls || 'primary'}" data-do="ask-yes">${esc(S.ask.yes)}</button>
      <button class="btn ghost" data-do="ask-no">Cancel</button>`;
    else if (S.reveals.length && S.screen === 'table') html = revealHtml(S.reveals[0], v);
    else if (S.sheet === 'rules') html = rulesHtml();
    else if (S.sheet === 'scores' && v) html = scoresHtml(v);
    else if (S.sheet === 'menu') html = menuHtml();
    else if (S.screen === 'table' && v && (v.phase === 'roundEnd' || v.phase === 'gameEnd')) html = resultHtml(v);
    const full = html ? `<div class="layer" data-do="${S.ask ? 'ask-no' : S.reveals.length || (v && (v.phase === 'roundEnd' || v.phase === 'gameEnd') && !S.sheet) ? '' : 'close-sheet'}"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>` : '';
    if (full === S.layerHtml) return; // nicht neu aufbauen, sonst startet die Animation neu
    S.layerHtml = full;
    $layer.innerHTML = full;
  }

  function revealHtml(ev, v) {
    const me = S.view.me;
    if (ev.reason === 'mismatch') {
      const who = ev.by === me ? 'You' : esc(v.players[ev.by].name);
      return `<h2>No match!</h2>
        <p>${who} revealed ${ev.cards.length} different cards. They stay in place, the drawn card goes face up onto the discard pile, and ${ev.by === me ? 'you get' : 'they get'} an unknown <b>penalty card</b> from the deck.</p>
        <div class="bigcards two">${ev.cards.map(c => `<figure>${C.face(c.v)}${esc(slotLabel(v.players[c.owner].cards.length - 1, c.slot))}</figure>`).join('')}</div>
        <button class="btn primary" data-do="reveal-ok">OK</button>`;
    }
    const c = ev.cards[0];
    const own = c.owner === me;
    const pl = v.players[c.owner];
    const where = slotLabel(pl.cards.length, c.slot);
    return `<h2>${own ? 'Your card' : esc(pl.name) + '’s card'}</h2>
      <p class="muted">${esc(where)}${own ? '' : ' (only you can see it)'}</p>
      <div class="bigcards">${C.face(c.v)}</div>
      <button class="btn primary" data-do="reveal-ok">Got it!</button>`;
  }

  function resultHtml(v) {
    const r = v.result;
    if (!r) return '';
    const over = v.phase === 'gameEnd';
    const order = v.players.map((p, i) => i).sort((a, b) => r.points[a] - r.points[b]);
    const minPts = Math.min(...r.points);
    let title = `Round ${v.round} over`;
    if (over) {
      const w = r.winners.map(i => v.players[i].name);
      title = r.winners.length > 1 ? names(w.map(esc)) + ' win!' : esc(w[0]) + ' wins!';
      if (r.winners.includes(S.view.me) && r.winners.length === 1) title = 'Arrasou! You win!';
    }
    const rows = order.map(i => {
      const p = v.players[i];
      const cards = p.cards.map(c => C.face(c.v)).join('');
      const note = r.notes[i] ? `<div class="res-note ${/0 points|Kamikaze!/.test(r.notes[i]) ? 'good' : /\+10|50|Kamikaze by/.test(r.notes[i]) ? 'bad' : ''}">${esc(r.notes[i])}</div>` : '';
      return `<div class="res ${r.points[i] === minPts ? 'win' : ''}">
        <div class="res-head">${esc(p.name)}${i === S.view.me ? ' (you)' : ''}${r.calledBy === i ? ' <span class="badge pink">TATU!</span>' : ''}<span class="sum">Sum ${r.sums[i]}</span></div>
        <div class="res-cards">${cards}</div>
        ${note}
        <div class="res-pts"><span class="plus">+${r.points[i]}</span><span>total ${r.totals[i]}</span></div></div>`;
    }).join('');
    return `<h2>${title}</h2>
      ${over ? '<p class="muted">Someone went over 100 points. Fewest points wins.</p>' : ''}
      ${rows}
      <button class="btn primary" data-do="${over ? 'newgame' : 'nextround'}">${over ? 'New game' : 'Next round'}</button>
      <button class="btn ghost" data-do="scores">Scoreboard</button>`;
  }

  function scoresHtml(v) {
    const head = v.players.map(p => `<th>${esc(p.name)}</th>`).join('');
    const rows = v.history.map(h => `<tr><td>Round ${h.round}</td>${h.points.map(x => `<td>+${x}</td>`).join('')}</tr>`).join('');
    return `<h2>Scores</h2>
      <table class="scores"><thead><tr><th></th>${head}</tr></thead><tbody>${rows || `<tr><td colspan="${v.players.length + 1}">No rounds scored yet.</td></tr>`}</tbody>
      <tfoot><tr><td>Total</td>${v.players.map(p => `<td>${p.total}</td>`).join('')}</tr></tfoot></table>
      <p class="muted small-text">Going over 100 ends the game. Exactly 100 drops back to 50.</p>
      <button class="btn primary" data-do="close-sheet">Close</button>`;
  }

  function menuHtml() {
    const v = S.view;
    const host = S.session && S.session.isHost;
    return `<h2>Menu</h2>
      ${v && v.online && host ? `<p class="muted small-text">Room ${esc(v.code)}. If someone lost the connection: just send the link again.</p><button class="btn ghost" data-do="share">Share room link</button>` : ''}
      <button class="btn ghost" data-do="rules">How to play</button>
      <button class="btn ghost" data-do="theme">Light / dark mode</button>
      <button class="btn ghost" data-do="leave-confirm">${host ? 'End game' : 'Leave game'}</button>
      <button class="btn primary" data-do="close-sheet">Keep playing</button>`;
  }

  function rulesHtml() {
    const mini = vs => `<div class="mini">${vs.map(x => C.face(x)).join('')}</div>`;
    return `<div class="rules"><h2>How to play Tatu!</h2>
      <p><b>Goal:</b> have as few points as possible in front of you at the end of each round. Once someone goes over 100 points, the game ends and the player with the fewest points wins.</p>
      <h3>Start</h3>
      <ul><li>Everyone gets 4 face-down cards and looks at <b>two of their cards</b> once (free choice). Remember them!</li></ul>
      <h3>Your turn: do one of these</h3>
      <ul>
        <li><b>Draw from the deck.</b> Then swap it with one of your cards (the old one goes face up onto the discard pile) or discard it.</li>
        <li><b>Swap several matching cards:</b> pick 2 or more of your cards with the <i>same</i> value. They all go to the discard pile and the new card takes their place. If they don’t match, everyone sees them, they stay where they are, the drawn card goes onto the discard pile and you get an unknown <b>penalty card</b> from the deck.</li>
        <li><b>Take the top card of the discard pile</b> and swap it in (you can’t discard it, and it has no action).</li>
        <li><b>Call “Tatu!”</b> instead of drawing: everyone else gets one more turn, then the round is scored. Your cards are locked from then on.</li>
      </ul>
      <h3>Actions when you discard a freshly drawn card</h3>
      ${mini([7, 8])}<ul><li><b>7, 8 Peek:</b> look at one of your own cards</li></ul>
      ${mini([9, 10])}<ul><li><b>9, 10 Spy:</b> look at another player’s card</li></ul>
      ${mini([11, 12])}<ul><li><b>11, 12 Swap:</b> blindly swap one of your cards with another player’s card</li></ul>
      <h3>The deck</h3>
      <ul><li>The game uses a fixed set of 52 cards (two each of 0 and 13, four each of 1 to 12). Counting cards pays off!</li>
        <li>When the deck runs out, the discard pile (except its top card) is reshuffled. The game announces it.</li></ul>
      <h3>Scoring</h3>
      <ul>
        <li>Everyone adds up their cards.</li>
        <li>If you called “Tatu!” and have the lowest total (a tie is enough): <b>0 points</b>. Otherwise your total <b>+10</b>.</li>
        <li><b>Kamikaze:</b> 12, 12, 13, 13 in your hand = 0 points for you, 50 for everyone else.</li>
        <li>Hitting exactly 100 points drops you back to 50.</li>
      </ul>
      ${mini([0, 13])}<p class="muted small-text">0 is the best card, 13 the worst. There are only two of each.</p>
      <p class="muted small-text">Made a mistake? You can put a card you took from the discard pile back, and undo discarding an action card before using the action.</p>
      <button class="btn primary" data-do="close-sheet">Got it</button></div>`;
  }

  /* ---------- Bedienung ---------- */
  function onCard(owner, slot) {
    const v = S.view;
    if (!v) return;
    const me = S.view.me;
    if (v.phase === 'peek' && owner === me) { act({ type: 'startPeek', slot }); return; }
    if (v.turn !== me) return;
    if (v.phase === 'drawn' && owner === me) {
      const i = S.sel.indexOf(slot);
      if (i >= 0) S.sel.splice(i, 1); else S.sel.push(slot);
      render();
      return;
    }
    if (v.phase === 'action') {
      if (v.action === 'peek' && owner === me) { act({ type: 'peek', slot }); return; }
      if (v.action === 'spy' && owner !== me) { act({ type: 'spy', target: owner, slot }); return; }
      if (v.action === 'swap') {
        if (owner === me) S.bsel.mine = S.bsel.mine === slot ? null : slot;
        else if (owner !== v.calledBy) S.bsel.opp = S.bsel.opp && S.bsel.opp.t === owner && S.bsel.opp.s === slot ? null : { t: owner, s: slot };
        render();
      }
    }
  }

  async function share() {
    const l = S.lobby || {};
    const link = l.link || (S.session && S.session.link && S.session.link());
    if (!link) return;
    const text = 'Let’s play Tatu! Room ' + (l.code || S.session.code);
    if (navigator.share) { try { await navigator.share({ title: 'Tatu!', text, url: link }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    copy(link);
  }
  async function copy(text) {
    text = text || (S.lobby && S.lobby.link);
    try { await navigator.clipboard.writeText(text); setStatus('Link copied.', 'wait'); setTimeout(() => setStatus('', 'ok'), 1500); }
    catch (e) { prompt('Copy the link:', text); }
  }

  document.addEventListener('click', e => {
    const card = e.target.closest('[data-card]');
    if (card && card.classList.contains('pick')) { const [o, s] = card.dataset.card.split(':').map(Number); onCard(o, s); return; }
    const el = e.target.closest('[data-do]');
    if (!el) return;
    const d = el.dataset.do;
    if (!d) return;
    if (d === 'close-sheet' && el.classList.contains('layer') && e.target !== el) return; // Klick im Blatt
    const v = S.view;
    switch (d) {
      case 'host': startHost(true); break;
      case 'bot': startHost(false); break;
      case 'join': startGuest(document.getElementById('code').value); break;
      case 'join-link': startGuest(S.joinCode); break;
      case 'resume': { const saved = Net.loadHost(); if (saved) resumeHost(saved); break; }
      case 'discard-saved': ask('End game?', 'The game in progress will be deleted.', 'Yes, end it', () => { Net.clearHost(); render(); }, 'pink'); break;
      case 'ask-yes': { const f = S.ask && S.ask.onYes; S.ask = null; renderLayer(); if (f) f(); break; }
      case 'ask-no': if (el.classList.contains('layer') && e.target !== el) return; S.ask = null; renderLayer(); break;
      case 'home': history.replaceState(null, '', location.pathname); S.screen = 'home'; render(); break;
      case 'rules': S.sheet = 'rules'; renderLayer(); break;
      case 'scores': S.sheet = 'scores'; renderLayer(); break;
      case 'menu': S.sheet = 'menu'; renderLayer(); break;
      case 'close-sheet': S.sheet = null; renderLayer(); break;
      case 'share': share(); break;
      case 'copy': copy(); break;
      case 'addbot': S.session.addBot(); break;
      case 'kick': S.session.removeSeat(Number(el.dataset.i)); break;
      case 'start': S.session.startGame(); break;
      case 'leave': leave(); break;
      case 'leave-confirm': S.sheet = null; ask(S.session && S.session.isHost ? 'End the game for everyone?' : 'Leave the game?', S.session && S.session.isHost ? 'The other players will be removed too.' : 'You can rejoin with the link.', S.session && S.session.isHost ? 'Yes, end it' : 'Yes, leave', leave, 'pink'); break;
      case 'theme': {
        const r = document.documentElement;
        const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
        r.dataset.theme = dark ? 'light' : 'dark'; pref('theme', r.dataset.theme); S.sheet = null; render(); break;
      }
      case 'ready': act({ type: 'ready' }); break;
      case 'draw-deck': act({ type: 'draw', from: 'deck' }); break;
      case 'draw-discard': act({ type: 'draw', from: 'discard' }); break;
      case 'call': ask('Call “Tatu!”?', 'Everyone else gets exactly one more turn, then the round is scored. Your cards are locked from now on.', 'Tatu!', () => act({ type: 'call' }), 'pink'); break;
      case 'swap': if (S.sel.length) act({ type: 'swap', slots: S.sel.slice() }); break;
      case 'discard': act({ type: 'discard' }); break;
      case 'skip': act({ type: 'skip' }); break;
      case 'undo': act({ type: 'undo' }); break;
      case 'clear-sel': S.sel = []; S.bsel = { mine: null, opp: null }; render(); break;
      case 'bswap': if (S.bsel.mine !== null && S.bsel.opp) act({ type: 'bswap', slot: S.bsel.mine, target: S.bsel.opp.t, tslot: S.bsel.opp.s }); break;
      case 'reveal-ok': S.reveals.shift(); renderLayer(); break;
      case 'nextround': act({ type: 'nextRound' }); break;
      case 'newgame': act({ type: 'newGame' }); break;
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'code') startGuest(e.target.value);
    if (e.key === 'Enter' && e.target.id === 'name' && S.screen === 'join') startGuest(S.joinCode);
  });

  /* ---------- Bildschirm wach halten, Neuverbindung ---------- */
  let lock = null;
  async function wakeLock(on) {
    try {
      if (on && !lock && 'wakeLock' in navigator && document.visibilityState === 'visible') { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); }
      if (!on && lock) { lock.release(); lock = null; }
    } catch (e) { /* nicht unterstützt */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (S.session && S.session.wake) S.session.wake();
    wakeLock(S.screen === 'table');
  });

  /* ---------- Start ---------- */
  (function boot() {
    const theme = pref('theme');
    if (theme) document.documentElement.dataset.theme = theme;
    const params = new URLSearchParams(location.search);
    const code = (params.get('room') || params.get('raum') || '').toUpperCase();
    const saved = Net.loadHost();
    let tabHost = null, tabGuest = null;
    try { tabHost = sessionStorage.getItem('tatu-host-tab'); tabGuest = sessionStorage.getItem('tatu-guest-tab'); } catch (e) { /* */ }
    if (code && saved && saved.code === code && tabHost === code) { resumeHost(saved); return; }
    if (!code && saved && tabHost === saved.code && !saved.online) { resumeHost(saved); return; }
    if (code) { S.joinCode = code; S.screen = 'join'; }
    if (code && tabGuest === code && pref('name')) { startGuest(code); return; } // nach Neuladen von selbst wieder rein
    render();
  })();
})();
