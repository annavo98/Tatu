/* Regeltests für js/game.js und js/bot.js. Ergebnis in test.html. */
(function () {
  'use strict';
  const G = window.TatuGame;
  const results = [];
  function test(name, fn) {
    try { fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, msg: e.message }); }
  }
  function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' erwartet ' + JSON.stringify(b) + ', war ' + JSON.stringify(a)); }
  function ok(c, msg) { if (!c) throw new Error(msg || 'nicht erfüllt'); }
  function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function card(v) { return { id: 't' + Math.random().toString(36).slice(2), v }; }
  function setup(n) {
    const s = G.newGame(n === 3 ? ['Sam', 'Alex', 'Bot'] : ['Sam', 'Alex']);
    G.startRound(s, seeded(1));
    s.players.forEach((_, i) => { G.apply(s, i, { type: 'startPeek', slot: 2 }); G.apply(s, i, { type: 'startPeek', slot: 3 }); G.apply(s, i, { type: 'ready' }); });
    return s;
  }
  function setHand(s, p, vals) { s.players[p].hand = vals.map(card); }
  function cardsInGame(s) { return s.deck.length + s.discard.length + s.players.reduce((a, p) => a + p.hand.length, 0) + (s.drawn ? 1 : 0); }

  test('Deck hat 52 Karten mit richtiger Verteilung', () => {
    const v = G.deckValues();
    eq(v.length, 52);
    eq(v.filter(x => x === 0).length, 2); eq(v.filter(x => x === 13).length, 2); eq(v.filter(x => x === 7).length, 4);
  });

  test('Rundenstart: 4 Karten je Person, 1 offene Ablage, Phase peek', () => {
    const s = G.newGame(['A', 'B']); G.startRound(s, seeded(2));
    eq(s.players.map(p => p.hand.length), [4, 4]); eq(s.discard.length, 1); eq(s.deck.length, 43); eq(s.phase, 'peek');
  });

  test('5 Personen: je 4 Karten, Stapel 31, Reihum über alle fünf', () => {
    const s = G.newGame(['A', 'B', 'C', 'D', 'E']); G.startRound(s, seeded(5));
    eq(s.players.map(p => p.hand.length), [4, 4, 4, 4, 4]); eq(s.deck.length, 31); eq(cardsInGame(s), 52);
    s.players.forEach((_, i) => { G.apply(s, i, { type: 'startPeek', slot: 0 }); G.apply(s, i, { type: 'startPeek', slot: 1 }); G.apply(s, i, { type: 'ready' }); });
    const seen = [];
    for (let k = 0; k < 6; k++) { seen.push(s.turn); G.apply(s, s.turn, { type: 'draw', from: 'deck' }); G.apply(s, s.turn, { type: 'swap', slots: [0] }); }
    eq(seen, [0, 1, 2, 3, 4, 0]);
    for (let i = 1; i < 5; i++) ok(!G.viewFor(s, i).players.some((p, j) => j !== i && p.cards.some(c => 'v' in c)), 'niemand sieht fremde Karten');
  });

  test('5 Personen: nach dem Tatu-Ruf haben genau die vier anderen noch einen Zug', () => {
    const s = G.newGame(['A', 'B', 'C', 'D', 'E']); G.startRound(s, seeded(6));
    s.players.forEach((_, i) => { G.apply(s, i, { type: 'startPeek', slot: 0 }); G.apply(s, i, { type: 'startPeek', slot: 1 }); G.apply(s, i, { type: 'ready' }); });
    const caller = s.turn;
    eq(G.apply(s, caller, { type: 'call' }).ok, true);
    let turns = 0;
    while (s.phase === 'turn') { ok(s.turn !== caller, 'Rufende ist nicht mehr dran'); G.apply(s, s.turn, { type: 'draw', from: 'deck' }); G.apply(s, s.turn, { type: 'swap', slots: [0] }); turns++; }
    eq(turns, 4); eq(s.phase, 'roundEnd'); eq(s.result.points.length, 5);
  });

  test('Startkarten: zwei frei wählbar, nur für mich sichtbar, Gemerkt erst nach zwei', () => {
    const s = G.newGame(['A', 'B']); G.startRound(s, seeded(3));
    eq(G.viewFor(s, 0).players[0].cards.some(c => 'v' in c), false, 'vor der Wahl alles verdeckt');
    eq(G.apply(s, 0, { type: 'ready' }).ok, false, 'Gemerkt geht noch nicht');
    G.apply(s, 0, { type: 'startPeek', slot: 0 }); G.apply(s, 0, { type: 'startPeek', slot: 3 });
    eq(G.apply(s, 0, { type: 'startPeek', slot: 1 }).ok, false, 'keine dritte');
    eq(G.viewFor(s, 0).players[0].cards.map(c => 'v' in c), [true, false, false, true]);
    eq(G.viewFor(s, 1).players[0].cards.some(c => 'v' in c), false, 'B sieht nichts von A');
    G.apply(s, 0, { type: 'ready' });
    eq(G.viewFor(s, 0).players[0].cards.some(c => 'v' in c), false, 'nach Gemerkt verdeckt');
    eq(s.phase, 'peek', 'wartet auf B');
    G.apply(s, 1, { type: 'startPeek', slot: 1 }); G.apply(s, 1, { type: 'startPeek', slot: 2 }); G.apply(s, 1, { type: 'ready' });
    eq(s.phase, 'turn');
  });

  test('Nur wer dran ist, darf ziehen', () => {
    const s = setup(2);
    const other = 1 - s.turn;
    eq(G.apply(s, other, { type: 'draw', from: 'deck' }).ok, false);
    eq(G.apply(s, s.turn, { type: 'draw', from: 'deck' }).ok, true);
  });

  test('Gegner sieht die frisch gezogene Stapelkarte nicht', () => {
    const s = setup(2); const t = s.turn;
    G.apply(s, t, { type: 'draw', from: 'deck' });
    ok('v' in G.viewFor(s, t).drawn, 'eigene sichtbar');
    ok(!('v' in G.viewFor(s, 1 - t).drawn), 'fremde verdeckt');
  });

  test('Einfacher Tausch: alte Karte auf die Ablage, neue an ihren Platz', () => {
    const s = setup(2); const t = s.turn;
    setHand(s, t, [5, 6, 7, 8]);
    G.apply(s, t, { type: 'draw', from: 'deck' });
    const d = s.drawn;
    eq(G.apply(s, t, { type: 'swap', slots: [1] }).ok, true);
    eq(s.players[t].hand[1].id, d.id); eq(s.discard[s.discard.length - 1].v, 6); eq(s.turn, 1 - t); eq(s.phase, 'turn');
    eq(cardsInGame(s), 52);
  });

  test('Mehrfachtausch mit gleichen Karten: Hand wird kleiner', () => {
    const s = setup(2); const t = s.turn;
    setHand(s, t, [9, 3, 9, 9]);
    G.apply(s, t, { type: 'draw', from: 'deck' });
    const d = s.drawn;
    eq(G.apply(s, t, { type: 'swap', slots: [3, 0, 2] }).ok, true);
    eq(s.players[t].hand.length, 2); eq(s.players[t].hand[0].id, d.id); eq(s.players[t].hand[1].v, 3);
    eq(s.discard.slice(-3).map(c => c.v), [9, 9, 9]);
  });

  test('Mehrfachtausch mit ungleichen Karten: aufgedeckt, gezogene auf die Ablage, Strafkarte unbekannt vom Stapel', () => {
    const s = setup(2); const t = s.turn;
    [4, 5, 6, 7].forEach((v, i) => { s.players[t].hand[i].v = v; });
    G.apply(s, t, { type: 'draw', from: 'deck' });
    const d = s.drawn; const next = s.deck[s.deck.length - 1];
    const r = G.apply(s, t, { type: 'swap', slots: [0, 1] });
    eq(r.ok, true); eq(s.players[t].hand.length, 5);
    eq(s.discard[s.discard.length - 1].id, d.id, 'gezogene liegt offen auf der Ablage');
    eq(s.players[t].hand[4].id, next.id, 'Strafkarte ist die nächste vom Stapel');
    ok(!('v' in G.viewFor(s, t).players[t].cards[4]), 'Strafkarte bleibt unbekannt');
    eq(cardsInGame(s), 52);
    eq(s.players[t].hand.slice(0, 4).map(c => c.v), [4, 5, 6, 7]);
    const rev = r.events.find(e => e.type === 'reveal');
    ok(rev && rev.to === 'all', 'allen gezeigt'); eq(rev.cards.map(c => c.v), [4, 5]);
    eq(s.turn, 1 - t);
  });

  test('Ablagekarte muss getauscht werden, Ablegen verboten', () => {
    const s = setup(2); const t = s.turn;
    G.apply(s, t, { type: 'draw', from: 'discard' });
    eq(G.apply(s, t, { type: 'discard' }).ok, false);
    eq(G.apply(s, t, { type: 'swap', slots: [0] }).ok, true);
  });

  test('Ablagekarte ist für alle sichtbar', () => {
    const s = setup(2); const t = s.turn;
    G.apply(s, t, { type: 'draw', from: 'discard' });
    ok('v' in G.viewFor(s, 1 - t).drawn);
  });

  test('Ablegen einer 7 startet Schauen, Ergebnis nur für mich', () => {
    const s = setup(2); const t = s.turn;
    s.deck.push(card(7));
    G.apply(s, t, { type: 'draw', from: 'deck' });
    G.apply(s, t, { type: 'discard' });
    eq(s.phase, 'action'); eq(s.action, 'peek');
    const r = G.apply(s, t, { type: 'peek', slot: 2 });
    eq(r.ok, true); eq(r.events[0].to, t); eq(r.events[0].cards[0].v, s.players[t].hand[2].v);
    eq(s.turn, 1 - t);
  });

  test('Ablegen einer 10 startet Spionieren', () => {
    const s = setup(2); const t = s.turn; const o = 1 - t;
    s.deck.push(card(10));
    G.apply(s, t, { type: 'draw', from: 'deck' }); G.apply(s, t, { type: 'discard' });
    eq(s.action, 'spy');
    eq(G.apply(s, t, { type: 'spy', target: t, slot: 0 }).ok, false, 'nicht bei sich selbst');
    const r = G.apply(s, t, { type: 'spy', target: o, slot: 1 });
    eq(r.events[0].cards[0].v, s.players[o].hand[1].v);
  });

  test('Ablegen einer 12: blinder Tausch', () => {
    const s = setup(2); const t = s.turn; const o = 1 - t;
    s.deck.push(card(12));
    G.apply(s, t, { type: 'draw', from: 'deck' }); G.apply(s, t, { type: 'discard' });
    eq(s.action, 'swap');
    const mine = s.players[t].hand[0].id, theirs = s.players[o].hand[3].id;
    eq(G.apply(s, t, { type: 'bswap', slot: 0, target: o, tslot: 3 }).ok, true);
    eq(s.players[t].hand[0].id, theirs); eq(s.players[o].hand[3].id, mine);
  });

  test('Aktion auslassen geht, Zug endet', () => {
    const s = setup(2); const t = s.turn;
    s.deck.push(card(8));
    G.apply(s, t, { type: 'draw', from: 'deck' }); G.apply(s, t, { type: 'discard' });
    eq(G.apply(s, t, { type: 'skip' }).ok, true); eq(s.turn, 1 - t);
  });

  test('Zurück: Ablagekarte wieder hinlegen', () => {
    const s = setup(2); const t = s.turn;
    const top = s.discard[s.discard.length - 1].id;
    G.apply(s, t, { type: 'draw', from: 'discard' });
    eq(G.apply(s, t, { type: 'undo' }).ok, true);
    eq(s.phase, 'turn'); eq(s.turn, t); eq(s.discard[s.discard.length - 1].id, top);
  });

  test('Zurück: Ablegen mit Aktion rückgängig, dann tauschen', () => {
    const s = setup(2); const t = s.turn;
    s.deck[s.deck.length - 1].v = 11;
    G.apply(s, t, { type: 'draw', from: 'deck' }); const d = s.drawn.id; G.apply(s, t, { type: 'discard' });
    eq(G.apply(s, t, { type: 'undo' }).ok, true);
    eq(s.phase, 'drawn'); eq(s.drawn.id, d); eq(s.drawnFrom, 'deck');
    eq(G.apply(s, t, { type: 'swap', slots: [0] }).ok, true);
    eq(cardsInGame(s), 52);
  });

  test('Zurück geht nicht nach gezogener Stapelkarte ohne Ablegen', () => {
    const s = setup(2); const t = s.turn;
    G.apply(s, t, { type: 'draw', from: 'deck' });
    eq(G.apply(s, t, { type: 'undo' }).ok, false);
  });

  test('Ablegen einer 5 hat keine Aktion', () => {
    const s = setup(2); const t = s.turn;
    s.deck.push(card(5));
    G.apply(s, t, { type: 'draw', from: 'deck' }); G.apply(s, t, { type: 'discard' });
    eq(s.phase, 'turn'); eq(s.turn, 1 - t);
  });

  test('Tatu-Ruf: andere haben noch einen Zug, dann Rundenende', () => {
    const s = setup(3); const t = s.turn;
    G.apply(s, t, { type: 'call' });
    eq(s.calledBy, t); eq(s.phase, 'turn');
    eq(G.apply(s, s.turn, { type: 'call' }).ok, false, 'zweiter Ruf verboten');
    for (let k = 0; k < 2; k++) { const p = s.turn; G.apply(s, p, { type: 'draw', from: 'deck' }); G.apply(s, p, { type: 'swap', slots: [0] }); }
    eq(s.phase === 'roundEnd' || s.phase === 'gameEnd', true);
  });

  test('Nach Tatu-Ruf: Karten der rufenden Person gesperrt für blinden Tausch', () => {
    const s = setup(2); const t = s.turn; const o = 1 - t;
    G.apply(s, t, { type: 'call' });
    s.deck.push(card(11));
    G.apply(s, o, { type: 'draw', from: 'deck' }); G.apply(s, o, { type: 'discard' });
    // nur die rufende Person wäre Ziel, also keine Aktion, Runde endet
    ok(s.phase === 'roundEnd' || s.phase === 'gameEnd', 'keine Tauschaktion möglich, Runde vorbei');
  });

  test('Wertung: Tatu mit niedrigster Summe (auch Gleichstand) = 0', () => {
    const s = setup(2); const t = s.turn; const o = 1 - t;
    setHand(s, t, [1, 2, 3, 4]); setHand(s, o, [5, 5, 0, 0]);
    G.apply(s, t, { type: 'call' });
    s.deck.push(card(5)); G.apply(s, o, { type: 'draw', from: 'deck' }); G.apply(s, o, { type: 'discard' });
    eq(s.result.points[t], 0); eq(s.result.points[o], 10);
  });

  test('Wertung: Tatu nicht am niedrigsten = Summe + 10', () => {
    const s = setup(2); const t = s.turn; const o = 1 - t;
    setHand(s, t, [3, 3, 3, 3]); setHand(s, o, [1, 1, 1, 1]);
    G.apply(s, t, { type: 'call' });
    s.deck.push(card(5)); G.apply(s, o, { type: 'draw', from: 'deck' }); G.apply(s, o, { type: 'discard' });
    eq(s.result.points[t], 22); eq(s.result.points[o], 4);
  });

  test('Kamikaze: 12,12,13,13 = 0, alle anderen 50', () => {
    const s = setup(2); const t = s.turn; const o = 1 - t;
    setHand(s, t, [1, 1, 1, 1]); setHand(s, o, [13, 12, 13, 12]);
    G.apply(s, t, { type: 'call' });
    s.deck.push(card(5)); G.apply(s, o, { type: 'draw', from: 'deck' }); G.apply(s, o, { type: 'discard' });
    eq(s.result.points[o], 0); eq(s.result.points[t], 50);
  });

  test('Genau 100 fällt auf 50, über 100 beendet das Spiel', () => {
    const s = setup(2); const t = s.turn; const o = 1 - t;
    s.players[t].total = 90; s.players[o].total = 95;
    setHand(s, t, [3, 3, 3, 1]); setHand(s, o, [2, 2, 4, 4]);
    s.deck.push(card(5)); G.apply(s, t, { type: 'draw', from: 'deck' }); G.apply(s, t, { type: 'discard' });
    G.apply(s, o, { type: 'call' }); // 12 > 10 → 22 Punkte
    s.deck.push(card(5)); G.apply(s, t, { type: 'draw', from: 'deck' }); G.apply(s, t, { type: 'discard' });
    eq(s.players[t].total, 50, '90+10 = 100 → 50'); eq(s.players[o].total, 117); eq(s.phase, 'gameEnd'); eq(s.result.winners, [t]);
  });

  test('Leerer Stapel: Ablage wird gemischt, oberste bleibt, neue Kennungen', () => {
    const s = setup(2); const t = s.turn;
    const top = card(4);
    s.discard = s.deck.splice(0).concat([top]);
    const oldIds = new Set(s.discard.map(c => c.id));
    const r = G.apply(s, t, { type: 'draw', from: 'deck' });
    ok(r.events.some(e => e.type === 'reshuffle' && e.to === 'all'), 'Ansage an alle');
    eq(s.discard.length, 1); eq(s.discard[0].id, top.id);
    ok(!oldIds.has(s.drawn.id), 'neue Kennung');
    eq(cardsInGame(s), 52);
  });

  test('Nächste Runde: Startperson wechselt, Gesamtpunkte bleiben', () => {
    const s = setup(2); const t = s.turn;
    setHand(s, t, [0, 0, 1, 1]);
    G.apply(s, t, { type: 'call' });
    const o = s.turn; s.deck.push(card(5)); G.apply(s, o, { type: 'draw', from: 'deck' }); G.apply(s, o, { type: 'discard' });
    const totals = s.players.map(p => p.total);
    G.apply(s, 0, { type: 'nextRound' });
    eq(s.round, 2); eq(s.turn, (t + 1) % 2); eq(s.players.map(p => p.total), totals); eq(s.phase, 'peek');
  });

  test('Bot spielt 200 Runden gegen Bot (2 bis 5 Personen) ohne Fehler, Karten bleiben 52', () => {
    for (let g = 0; g < 200; g++) {
      const rng = seeded(100 + g);
      const s = G.newGame(['B1', 'B2', 'B3', 'B4', 'B5'].slice(0, 2 + (g % 4)));
      G.startRound(s, rng);
      const bots = s.players.map((_, i) => new window.TatuBot(i));
      bots.forEach((b, i) => { for (let k = 0; k < 4 && !s.ready[i]; k++) { const v = G.viewFor(s, i); b.observe(v); const r = G.apply(s, i, b.decide(v, rng)); if (!r.ok) throw new Error('Startwahl: ' + r.error); } b.observe(G.viewFor(s, i)); });
      let guard = 0;
      while (s.phase !== 'roundEnd' && s.phase !== 'gameEnd') {
        if (++guard > 2000) throw new Error('Runde endet nicht (Spiel ' + g + ')');
        const p = s.turn;
        const v = G.viewFor(s, p);
        bots[p].observe(v);
        const a = bots[p].decide(v, rng);
        const r = G.apply(s, p, a, rng);
        if (!r.ok) throw new Error('Bot-Zug ungültig: ' + JSON.stringify(a) + ' ' + r.error);
        r.events.forEach(e => { bots.forEach((b, i) => { if (e.to === 'all' || e.to === i) b.learn(e); }); });
        if (cardsInGame(s) !== 52) throw new Error('Kartenzahl ' + cardsInGame(s));
      }
    }
  });

  window.TEST_RESULTS = results;
  const out = document.getElementById('out');
  const bad = results.filter(r => !r.ok);
  out.innerHTML = `<h1>${bad.length ? '✗ ' + bad.length + ' Fehler' : '✓ Alle ' + results.length + ' Tests grün'}</h1>` +
    results.map(r => `<p class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : '<br><small>' + r.msg + '</small>'}</p>`).join('');
})();
