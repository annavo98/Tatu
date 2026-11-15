/* Tatu-Bot: einfacher Gegner zum Üben. Merkt sich, was er gesehen hat (über die Kartenkennungen),
   und sieht nie mehr als ein Mensch am Tisch. */
(function (root) {
  'use strict';
  const UNKNOWN = 6.5; // Durchschnittswert einer unbekannten Karte

  class TatuBot {
    constructor(idx) { this.idx = idx; this.mem = new Map(); this.round = 0; }

    // Alles Sichtbare merken (eigene Startkarten, Ablage, gezogene Karte, Rundenende)
    observe(v) {
      if (v.round !== this.round) { this.mem.clear(); this.round = v.round; }
      v.players.forEach(p => p.cards.forEach(c => { if ('v' in c) this.mem.set(c.id, c.v); }));
      if (v.drawn && 'v' in v.drawn) this.mem.set(v.drawn.id, v.drawn.v);
    }

    learn(ev) {
      if (ev.type === 'reveal') ev.cards.forEach(c => this.mem.set(c.id, c.v));
    }

    known(c) { return this.mem.has(c.id) ? this.mem.get(c.id) : null; }

    estimate(cards) { return cards.reduce((a, c) => a + (this.known(c) ?? UNKNOWN), 0); }

    // Eigene Karte, die am meisten loswerden möchte: höchste bekannte, sonst unbekannte
    worstSlot(cards, threshold) {
      let best = -1, bestV = threshold;
      cards.forEach((c, i) => { const k = this.known(c); if (k !== null && k > bestV) { bestV = k; best = i; } });
      return best;
    }
    unknownSlot(cards) { return cards.findIndex(c => this.known(c) === null); }

    // Gleiche bekannte Karten (für Mehrfachtausch) mit Wert > v
    pairAbove(cards, v) {
      const groups = {};
      cards.forEach((c, i) => { const k = this.known(c); if (k !== null && k > v) (groups[k] = groups[k] || []).push(i); });
      let best = null;
      for (const k in groups) if (groups[k].length >= 2 && (!best || groups[k].length * k > best.score)) best = { slots: groups[k], score: groups[k].length * k };
      return best ? best.slots : null;
    }

    decide(v, rng) {
      rng = rng || Math.random;
      const me = v.players[this.idx];
      const hand = me.cards;
      const opps = v.players.map((p, i) => i).filter(i => i !== this.idx);

      if (v.phase === 'peek') {
        const chosen = v.startPeek || [];
        if (chosen.length < Math.min(2, hand.length)) {
          const free = hand.map((c, i) => i).filter(i => !chosen.includes(i));
          return { type: 'startPeek', slot: free[Math.floor(rng() * free.length)] };
        }
        return { type: 'ready' };
      }
      if (v.phase === 'roundEnd') return { type: 'nextRound' };

      if (v.phase === 'turn') {
        const unknown = hand.filter(c => this.known(c) === null).length;
        const est = this.estimate(hand);
        if (v.calledBy === null && ((unknown === 0 && est <= 9) || (unknown <= 1 && est <= 7))) return { type: 'call' };
        const top = v.discardTop;
        if (top && top.v <= 3) {
          const pair = this.pairAbove(hand, top.v);
          if (pair) return { type: 'draw', from: 'discard' };
          if (this.worstSlot(hand, top.v + 1) >= 0) return { type: 'draw', from: 'discard' };
          if (top.v <= 1 && this.unknownSlot(hand) >= 0) return { type: 'draw', from: 'discard' };
        }
        return { type: 'draw', from: 'deck' };
      }

      if (v.phase === 'drawn') {
        const d = v.drawn.v;
        const pair = this.pairAbove(hand, d);
        if (pair) return { type: 'swap', slots: pair };
        const worst = this.worstSlot(hand, d);
        const unk = this.unknownSlot(hand);
        const act = root.TatuGame.ACTION_OF[d];
        if (v.drawnFrom === 'discard') {
          if (worst >= 0) return { type: 'swap', slots: [worst] };
          return { type: 'swap', slots: [unk >= 0 ? unk : 0] };
        }
        if (d <= 4) {
          if (worst >= 0) return { type: 'swap', slots: [worst] };
          if (unk >= 0) return { type: 'swap', slots: [unk] };
        }
        if (act === 'peek' && unk >= 0) return { type: 'discard' };
        if (act === 'spy') return { type: 'discard' };
        if (act === 'swap' && this.worstSlot(hand, 7) >= 0) return { type: 'discard' };
        if (worst >= 0 && d < 7) return { type: 'swap', slots: [worst] };
        return { type: 'discard' };
      }

      if (v.phase === 'action') {
        if (v.action === 'peek') {
          const unk = this.unknownSlot(hand);
          return unk >= 0 ? { type: 'peek', slot: unk } : { type: 'skip' };
        }
        const targets = opps.filter(i => v.players[i].cards.length > 0 && (v.action !== 'swap' || i !== v.calledBy));
        if (!targets.length) return { type: 'skip' };
        if (v.action === 'spy') {
          for (const t of targets) {
            const s = v.players[t].cards.findIndex(c => this.known(c) === null);
            if (s >= 0) return { type: 'spy', target: t, slot: s };
          }
          return { type: 'skip' };
        }
        if (v.action === 'swap') {
          const mine = this.worstSlot(hand, 7);
          if (mine < 0) return { type: 'skip' };
          // bevorzugt eine bekannte niedrige Karte des Gegners, sonst zufällig
          let pick = null;
          for (const t of targets) v.players[t].cards.forEach((c, j) => {
            const k = this.known(c);
            if (k !== null && k < this.known(hand[mine]) && (!pick || k < pick.k)) pick = { t, j, k };
          });
          if (!pick) {
            const t = targets[Math.floor(rng() * targets.length)];
            pick = { t, j: Math.floor(rng() * v.players[t].cards.length) };
          }
          return { type: 'bswap', slot: mine, target: pick.t, tslot: pick.j };
        }
      }
      return { type: 'skip' };
    }
  }

  root.TatuBot = TatuBot;
})(typeof window !== 'undefined' ? window : globalThis);
