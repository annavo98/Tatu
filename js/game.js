/* Tatu! Spielregeln (siehe REGELN.md). Rein, ohne Bildschirm-Code, testbar in test.html.
   Der volle Spielstand liegt nur bei der Gastgeberin. viewFor() liefert jeder Person nur, was sie sehen darf. */
(function (root) {
  'use strict';

  const ACTION_OF = { 7: 'peek', 8: 'peek', 9: 'spy', 10: 'spy', 11: 'swap', 12: 'swap' };
  const ACTION_NAME = { peek: 'Peek', spy: 'Spy', swap: 'Swap' };

  function deckValues() {
    const v = [0, 0, 13, 13];
    for (let n = 1; n <= 12; n++) v.push(n, n, n, n);
    return v; // 52 Karten
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Kennungen erst NACH dem Mischen vergeben, damit sie nichts über den Wert verraten
  function labelCards(state, values) {
    return values.map(v => ({ id: 'k' + (state.nextId++), v }));
  }

  const an = v => (v === 8 || v === 11 ? 'an ' : 'a ') + v;
  function slotName(hand, i) {
    return 'card ' + (i + 1); // Karten liegen in einer Reihe
  }

  function newGame(names, opts) {
    opts = opts || {};
    return {
      players: names.map(n => ({ name: n, hand: [], total: 0 })),
      round: 0,
      starter: 0,
      phase: 'lobby',
      deck: [], discard: [],
      turn: 0, drawn: null, drawnFrom: null, action: null,
      calledBy: null, ready: [],
      history: [], log: [], last: null, seq: 0, nextId: 1,
      result: null,
      rngSeed: opts.seed || null,
    };
  }

  function startRound(state, rng) {
    rng = rng || Math.random;
    state.round++;
    const values = shuffle(deckValues(), rng);
    state.deck = labelCards(state, values);
    state.discard = [];
    for (const p of state.players) p.hand = state.deck.splice(-4, 4);
    state.discard.push(state.deck.pop());
    state.phase = 'peek';
    state.ready = state.players.map(() => false);
    state.startPeek = state.players.map(() => []); // frei gewählte Startkarten
    state.turn = state.starter % state.players.length;
    state.drawn = null; state.drawnFrom = null; state.action = null;
    state.calledBy = null; state.result = null;
    state.last = null; state.log = [];
    addLog(state, `Round ${state.round}: everyone picks two of their cards to look at.`);
    return state;
  }

  function addLog(state, text) {
    state.log.push(text);
    if (state.log.length > 30) state.log.shift();
  }

  function setLast(state, obj) {
    state.seq++;
    state.last = Object.assign({ seq: state.seq }, obj);
  }

  function err(msg) { return { ok: false, error: msg }; }

  function reshuffleIfNeeded(state, rng, events) {
    if (state.deck.length > 0) return true;
    if (state.discard.length <= 1) return false;
    const top = state.discard.pop();
    const values = shuffle(state.discard.map(c => c.v), rng);
    state.deck = labelCards(state, values);
    state.discard = [top];
    addLog(state, 'The deck ran out, the discard pile was reshuffled.');
    if (events) events.push({ to: 'all', type: 'reshuffle', count: state.deck.length });
    return true;
  }

  function hasTargets(state, p) {
    return state.players.some((q, i) => i !== p && i !== state.calledBy && q.hand.length > 0);
  }

  function endTurn(state, events) {
    state.drawn = null; state.drawnFrom = null; state.action = null;
    const n = state.players.length;
    const next = (state.turn + 1) % n;
    if (state.calledBy !== null && next === state.calledBy) {
      endRound(state, events);
    } else {
      state.turn = next;
      state.phase = 'turn';
    }
  }

  function isKamikaze(hand) {
    if (hand.length !== 4) return false;
    const s = hand.map(c => c.v).sort((a, b) => a - b).join(',');
    return s === '12,12,13,13';
  }

  function endRound(state, events) {
    const ps = state.players;
    const sums = ps.map(p => p.hand.reduce((a, c) => a + c.v, 0));
    const points = sums.slice();
    const notes = ps.map(() => '');
    const kamikaze = ps.findIndex(p => isKamikaze(p.hand));
    if (kamikaze >= 0) {
      ps.forEach((p, i) => { points[i] = i === kamikaze ? 0 : 50; notes[i] = i === kamikaze ? 'Kamikaze! 12, 12, 13, 13' : 'Kamikaze by ' + ps[kamikaze].name; });
    } else if (state.calledBy !== null) {
      const c = state.calledBy;
      const othersMin = Math.min(...sums.filter((_, i) => i !== c));
      if (sums[c] <= othersMin) { points[c] = 0; notes[c] = 'Called Tatu and won: 0 points'; }
      else { points[c] = sums[c] + 10; notes[c] = 'Called Tatu but not lowest: +10'; }
    }
    const totalsBefore = ps.map(p => p.total);
    ps.forEach((p, i) => {
      p.total += points[i];
      if (p.total === 100) { p.total = 50; notes[i] = (notes[i] ? notes[i] + '. ' : '') + 'Exactly 100, back to 50!'; }
    });
    state.result = { sums, points, notes, totalsBefore, totals: ps.map(p => p.total), calledBy: state.calledBy, kamikaze };
    state.history.push({ round: state.round, points: points.slice(), totals: ps.map(p => p.total) });
    const over = ps.some(p => p.total > 100);
    state.phase = over ? 'gameEnd' : 'roundEnd';
    if (over) {
      const min = Math.min(...ps.map(p => p.total));
      state.result.winners = ps.map((p, i) => i).filter(i => ps[i].total === min);
    }
    addLog(state, 'Round over, all cards are revealed.');
    events.push({ to: 'all', type: 'roundEnd' });
  }

  // Tausch der gezogenen Karte gegen eine oder mehrere eigene Karten
  function doSwap(state, p, slots, events, rng) {
    const hand = state.players[p].hand;
    const name = state.players[p].name;
    if (!Array.isArray(slots) || slots.length === 0) return err('Pick at least one of your cards.');
    const uniq = [...new Set(slots)];
    if (uniq.length !== slots.length || uniq.some(i => !Number.isInteger(i) || i < 0 || i >= hand.length)) return err('Invalid card.');
    const sorted = uniq.slice().sort((a, b) => a - b);
    const cards = sorted.map(i => hand[i]);
    const same = cards.every(c => c.v === cards[0].v);
    const drawn = state.drawn;
    if (same) {
      const keep = sorted[0];
      // von hinten entfernen, damit die Indizes stimmen
      for (let k = sorted.length - 1; k >= 1; k--) hand.splice(sorted[k], 1);
      hand[keep] = drawn;
      state.discard.push(...cards);
      const what = cards.length === 1 ? `a card (${slotName(hand, keep)}) and discards ${an(cards[0].v)}`
        : `${cards.length} matching cards (${cards[0].v}s) for one`;
      addLog(state, `${name} swaps ${what}.`);
      setLast(state, { type: 'swap', p, slots: sorted, newSlot: keep, values: cards.map(c => c.v), from: state.drawnFrom, ok: true });
    } else {
      // Regel 16.11.: gezogene Karte offen auf die Ablage, Strafkarte unbekannt vom Stapel
      state.discard.push(drawn);
      let penaltySlot = null;
      if (reshuffleIfNeeded(state, rng, events)) { hand.push(state.deck.pop()); penaltySlot = hand.length - 1; }
      addLog(state, `${name} tried to swap ${cards.length} cards, but they don't match (${cards.map(c => c.v).join(', ')}). Penalty card from the deck!`);
      setLast(state, { type: 'swap', p, slots: sorted, values: cards.map(c => c.v), ok: false, penaltySlot });
      events.push({ to: 'all', type: 'reveal', reason: 'mismatch', by: p, cards: sorted.map(i => ({ owner: p, slot: i, id: hand[i].id, v: hand[i].v })) });
    }
    endTurn(state, events);
    return { ok: true, events };
  }

  function apply(state, p, a, rng) {
    rng = rng || Math.random;
    const events = [];
    if (!a || typeof a.type !== 'string') return err('Unknown move.');
    const n = state.players.length;
    if (!Number.isInteger(p) || p < 0 || p >= n) return err('Unknown player.');
    const me = state.players[p];

    if (a.type === 'startPeek') {
      // Rundenbeginn: zwei eigene Karten frei wählen und ansehen
      if (state.phase !== 'peek' || state.ready[p]) return err('Not possible right now.');
      const sp = state.startPeek || (state.startPeek = state.players.map(() => []));
      const i = a.slot;
      if (!Number.isInteger(i) || i < 0 || i >= me.hand.length) return err('Pick one of your cards.');
      if (sp[p].includes(i)) return { ok: true, events };
      if (sp[p].length >= 2) return err('You can only look at two cards.');
      sp[p].push(i);
      return { ok: true, events };
    }

    if (a.type === 'ready') {
      if (state.phase !== 'peek') return err('Not possible right now.');
      if (((state.startPeek || [])[p] || []).length < Math.min(2, me.hand.length)) return err('Pick two cards to look at first.');
      state.ready[p] = true;
      if (state.ready.every(Boolean)) {
        state.phase = 'turn';
        addLog(state, `${state.players[state.turn].name} starts.`);
      }
      return { ok: true, events };
    }

    if (a.type === 'nextRound') {
      if (state.phase !== 'roundEnd') return err('The round is still going.');
      state.starter = (state.starter + 1) % n;
      startRound(state, rng);
      events.push({ to: 'all', type: 'newRound' });
      return { ok: true, events };
    }

    if (a.type === 'newGame') {
      if (state.phase !== 'gameEnd') return err('The game is still going.');
      state.players.forEach(pl => { pl.total = 0; });
      state.history = []; state.round = 0;
      state.starter = (state.starter + 1) % n;
      startRound(state, rng);
      events.push({ to: 'all', type: 'newRound' });
      return { ok: true, events };
    }

    if (state.turn !== p) return err('It’s not your turn.');

    switch (a.type) {
      case 'draw': {
        if (state.phase !== 'turn') return err('Not possible right now.');
        if (a.from === 'discard') {
          if (state.discard.length === 0) return err('The discard pile is empty.');
          state.drawn = state.discard.pop();
          state.drawnFrom = 'discard';
          addLog(state, `${me.name} takes the ${state.drawn.v} from the discard pile.`);
          setLast(state, { type: 'draw', p, from: 'discard', v: state.drawn.v });
        } else {
          if (!reshuffleIfNeeded(state, rng, events)) { endRound(state, events); return { ok: true, events }; }
          state.drawn = state.deck.pop();
          state.drawnFrom = 'deck';
          addLog(state, `${me.name} draws from the deck.`);
          setLast(state, { type: 'draw', p, from: 'deck' });
        }
        state.phase = 'drawn';
        return { ok: true, events };
      }
      case 'call': {
        if (state.phase !== 'turn') return err('You can only call Tatu at the start of your turn.');
        if (state.calledBy !== null) return err('Tatu has already been called this round.');
        state.calledBy = p;
        addLog(state, `${me.name} calls TATU! Everyone else gets one more turn.`);
        setLast(state, { type: 'call', p });
        events.push({ to: 'all', type: 'call', by: p });
        endTurn(state, events);
        return { ok: true, events };
      }
      case 'swap': {
        if (state.phase !== 'drawn') return err('Draw a card first.');
        return doSwap(state, p, a.slots, events, rng);
      }
      case 'discard': {
        if (state.phase !== 'drawn') return err('Draw a card first.');
        if (state.drawnFrom !== 'deck') return err('A card from the discard pile must be swapped.');
        const c = state.drawn;
        state.discard.push(c);
        state.drawn = null;
        const act = ACTION_OF[c.v];
        if (act && (act === 'peek' || hasTargets(state, p))) {
          state.phase = 'action';
          state.action = act;
          addLog(state, `${me.name} discards ${an(c.v)}: ${ACTION_NAME[act]}.`);
          setLast(state, { type: 'discard', p, v: c.v, action: act });
        } else {
          addLog(state, `${me.name} discards ${an(c.v)}.`);
          setLast(state, { type: 'discard', p, v: c.v });
          endTurn(state, events);
        }
        return { ok: true, events };
      }
      case 'peek': {
        if (state.phase !== 'action' || state.action !== 'peek') return err('Not possible right now.');
        const i = a.slot;
        if (!Number.isInteger(i) || i < 0 || i >= me.hand.length) return err('Pick one of your cards.');
        events.push({ to: p, type: 'reveal', reason: 'peek', cards: [{ owner: p, slot: i, id: me.hand[i].id, v: me.hand[i].v }] });
        addLog(state, `${me.name} peeks at one of their cards.`);
        setLast(state, { type: 'peek', p, owner: p, slot: i });
        endTurn(state, events);
        return { ok: true, events };
      }
      case 'spy': {
        if (state.phase !== 'action' || state.action !== 'spy') return err('Not possible right now.');
        const t = a.target, i = a.slot;
        if (!Number.isInteger(t) || t === p || t < 0 || t >= n) return err('Pick someone else’s card.');
        const th = state.players[t].hand;
        if (!Number.isInteger(i) || i < 0 || i >= th.length) return err('Pick someone else’s card.');
        events.push({ to: p, type: 'reveal', reason: 'spy', cards: [{ owner: t, slot: i, id: th[i].id, v: th[i].v }] });
        addLog(state, `${me.name} spies on a card of ${state.players[t].name}.`);
        setLast(state, { type: 'spy', p, owner: t, slot: i });
        endTurn(state, events);
        return { ok: true, events };
      }
      case 'bswap': {
        if (state.phase !== 'action' || state.action !== 'swap') return err('Not possible right now.');
        const i = a.slot, t = a.target, j = a.tslot;
        if (!Number.isInteger(i) || i < 0 || i >= me.hand.length) return err('Pick one of your cards.');
        if (!Number.isInteger(t) || t === p || t < 0 || t >= n) return err('Pick someone else’s card.');
        if (t === state.calledBy) return err('Cards are locked after a Tatu call.');
        const th = state.players[t].hand;
        if (!Number.isInteger(j) || j < 0 || j >= th.length) return err('Pick someone else’s card.');
        const tmp = me.hand[i]; me.hand[i] = th[j]; th[j] = tmp;
        addLog(state, `${me.name} blind-swaps a card with ${state.players[t].name}.`);
        setLast(state, { type: 'bswap', p, slot: i, target: t, tslot: j });
        endTurn(state, events);
        return { ok: true, events };
      }
      case 'undo': {
        // Verklicker-Schutz: nur solange nichts Geheimes passiert ist
        if (state.phase === 'drawn' && state.drawnFrom === 'discard') {
          state.discard.push(state.drawn);
          state.drawn = null; state.drawnFrom = null;
          state.phase = 'turn';
          addLog(state, `${me.name} puts the card back on the discard pile.`);
          setLast(state, { type: 'undo', p });
          return { ok: true, events };
        }
        if (state.phase === 'action') {
          state.drawn = state.discard.pop();
          state.drawnFrom = 'deck';
          state.action = null;
          state.phase = 'drawn';
          addLog(state, `${me.name} takes the ${state.drawn.v} back after all.`);
          setLast(state, { type: 'undo', p });
          return { ok: true, events };
        }
        return err('That can’t be undone anymore.');
      }
      case 'skip': {
        if (state.phase !== 'action') return err('Not possible right now.');
        addLog(state, `${me.name} skips the action.`);
        setLast(state, { type: 'skip', p });
        endTurn(state, events);
        return { ok: true, events };
      }
    }
    return err('Unknown move.');
  }

  // Was Person p sehen darf
  function viewFor(state, p) {
    const showAll = state.phase === 'roundEnd' || state.phase === 'gameEnd';
    const peeking = state.phase === 'peek' && !state.ready[p];
    return {
      me: p,
      phase: state.phase,
      round: state.round,
      turn: state.turn,
      calledBy: state.calledBy,
      action: state.action,
      drawnFrom: state.drawnFrom,
      drawn: state.drawn ? ((state.turn === p || state.drawnFrom === 'discard') ? { id: state.drawn.id, v: state.drawn.v } : { id: state.drawn.id }) : null,
      deckCount: state.deck.length,
      discardTop: state.discard.length ? { id: state.discard[state.discard.length - 1].id, v: state.discard[state.discard.length - 1].v } : null,
      discardCount: state.discard.length,
      ready: state.ready.slice(),
      startPeek: ((state.startPeek || [])[p] || []).slice(),
      players: state.players.map((pl, i) => ({
        name: pl.name,
        total: pl.total,
        cards: pl.hand.map((c, s) => {
          const vis = showAll || (i === p && peeking && ((state.startPeek || [])[p] || []).includes(s));
          return vis ? { id: c.id, v: c.v } : { id: c.id };
        }),
      })),
      history: state.history.slice(),
      result: state.result,
      last: state.last,
      log: state.log.slice(-6),
      seq: state.seq,
    };
  }

  const api = { newGame, startRound, apply, viewFor, deckValues, ACTION_OF, ACTION_NAME, isKamikaze, slotName };
  root.TatuGame = api;
})(typeof window !== 'undefined' ? window : globalThis);
