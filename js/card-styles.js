/* Kartendesign „Botanik“ (Wahl 16.11.): feine Linien tropischer Blätter, Früchte und Sonne,
   Farbwelt Sonnenuntergang, Zahl je Wert an anderer Stelle und in anderer Größe. Überschreibt face/back aus cards.js. */
(function (root) {
  'use strict';
  const T = root.TatuCards;
  const ACTION = T.ACTION;
  const LABEL = { peek: 'PEEK', spy: 'SPY', swap: 'SWAP' };
  const SERIF = 'font-family="ui-serif, Georgia, \'Times New Roman\', serif"';
  const grp = v => v === 0 ? 0 : v === 13 ? 13 : v <= 2 ? 1 : v <= 4 ? 3 : v <= 6 ? 5 : v <= 8 ? 7 : v <= 10 ? 9 : 11;

  const PAPER = '#F4ECDD';
  // Wunsch: Zahl je Wert an anderer Stelle und in anderer Größe (unruhiger, schwerer zu merken)
  // [x, Grundlinie y, Schriftgröße, Ausrichtung]
  const LAY = [
    [12, 66, 74, 'start'], [52, 102, 60, 'middle'], [88, 60, 66, 'end'], [12, 118, 56, 'start'],
    [52, 76, 82, 'middle'], [88, 120, 62, 'end'], [12, 94, 72, 'start'], [88, 68, 64, 'end'],
    [50, 108, 66, 'middle'], [12, 80, 76, 'start'], [88, 104, 46, 'end'], [10, 62, 52, 'start'],
    [50, 96, 56, 'middle'], [88, 74, 50, 'end'],
  ];
  function num(v, fill, extra) {
    const [x, y, size, a] = LAY[v];
    return `<text x="${x}" y="${y}" text-anchor="${a}" ${SERIF} font-size="${size}" font-weight="700" letter-spacing="-2" fill="${fill}" ${extra || ''}>${v}</text>`;
  }
  function numShift(v, dx, dy, fill, extra) {
    const [x, y, size, a] = LAY[v];
    return `<text x="${x + dx}" y="${y + dy}" text-anchor="${a}" ${SERIF} font-size="${size}" font-weight="700" letter-spacing="-2" fill="${fill}" ${extra || ''}>${v}</text>`;
  }
  // Farbwelten (Hauptfarbe zeigt die Wertgruppe 0 | 1-2 | 3-4 | 5-6 | 7-8 | 9-10 | 11-12 | 13)
  const PALETTES = {
    tropen: { name: 'Tropen gedeckt', g: {
      0: { main: '#6E8B3D', sub: '#E3B23C', acc: '#D96C4F', ink: '#1E2A14' },
      1: { main: '#8DB580', sub: '#E89A86', acc: '#1F6F78', ink: '#1B2E1A' },
      3: { main: '#1F6F78', sub: '#E3B23C', acc: '#E89A86', ink: '#0B2A2E' },
      5: { main: '#3E7CB1', sub: '#E89A86', acc: '#E3B23C', ink: '#0F2238' },
      7: { main: '#7B5EA7', sub: '#E3B23C', acc: '#8DB580', ink: '#221536' },
      9: { main: '#D96C4F', sub: '#1F6F78', acc: '#E3B23C', ink: '#3A140B' },
      11: { main: '#E3B23C', sub: '#C2416B', acc: '#1F6F78', ink: '#3A2A06' },
      13: { main: '#8C2F39', sub: '#E3B23C', acc: '#1F6F78', ink: '#2A0A0F' } } },
    sonnenuntergang: { name: 'Sonnenuntergang', g: {
      0: { main: '#3D8B7D', sub: '#F2CC8F', acc: '#E07A5F', ink: '#10302B' },
      1: { main: '#81B29A', sub: '#F2CC8F', acc: '#E07A5F', ink: '#1A3328' },
      3: { main: '#F2CC8F', sub: '#E07A5F', acc: '#3D405B', ink: '#3B2A10' },
      5: { main: '#F4A261', sub: '#3D405B', acc: '#81B29A', ink: '#3A1F08' },
      7: { main: '#E07A5F', sub: '#F2CC8F', acc: '#3D405B', ink: '#3A140B' },
      9: { main: '#B5465B', sub: '#F2CC8F', acc: '#81B29A', ink: '#2E0E14' },
      11: { main: '#9C6A9E', sub: '#F4A261', acc: '#3D8B7D', ink: '#26101F' },
      13: { main: '#3D405B', sub: '#E07A5F', acc: '#F2CC8F', ink: '#14152A' } } },
    meer: { name: 'Meer und Zitrus', g: {
      0: { main: '#2A9D8F', sub: '#FFCA3A', acc: '#F28482', ink: '#0B2E2A' },
      1: { main: '#8AC926', sub: '#1982C4', acc: '#FFCA3A', ink: '#1C2E06' },
      3: { main: '#1982C4', sub: '#FFCA3A', acc: '#F28482', ink: '#06213A' },
      5: { main: '#4CC9F0', sub: '#F28482', acc: '#3A0CA3', ink: '#06303D' },
      7: { main: '#7B2CBF', sub: '#FFCA3A', acc: '#4CC9F0', ink: '#1C0330' },
      9: { main: '#F72585', sub: '#FFCA3A', acc: '#4CC9F0', ink: '#3D0420' },
      11: { main: '#FF9F1C', sub: '#7B2CBF', acc: '#2A9D8F', ink: '#3A2300' },
      13: { main: '#14213D', sub: '#F72585', acc: '#FFCA3A', ink: '#05091A' } } },
  };
  let PK = 'tropen';
  let P = PALETTES[PK].g;
  function usePalette(k) { PK = k; P = PALETTES[k].g; }
  // hell oder dunkel? (für lesbare Zahlen und Linien)
  function light(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) > 150; }
  const pal = v => P[grp(v)];
  const clip = id => `<clipPath id="${id}"><rect width="100" height="140" rx="10"/></clipPath>`;
  function rnd(seed) { let x = (seed * 2654435761) % 4294967296; return () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; }
  function grain(seed, col, n, op) { const R = rnd(seed + 5); let s = ''; for (let i = 0; i < n; i++) s += `<circle cx="${(R() * 100).toFixed(1)}" cy="${(R() * 140).toFixed(1)}" r="${(.25 + R() * .55).toFixed(2)}" fill="${col}" opacity="${op}"/>`; return s; }
  function label(v, x, y, col, anchor) {
    const act = ACTION[v]; if (!act) return '';
    return `<text x="${x}" y="${y}" text-anchor="${anchor || 'middle'}" ${SERIF} font-size="6.4" font-weight="700" letter-spacing="1.6" fill="${col}">${LABEL[act]}</text>`;
  }
  function corner(v, col) {
    return `<text x="8" y="17" ${SERIF} font-size="12" font-weight="700" fill="${col}">${v}</text>
      <text x="92" y="131" text-anchor="end" ${SERIF} font-size="12" font-weight="700" fill="${col}" transform="rotate(180 88 127)">${v}</text>`;
  }

  /* ============ G: BOTANIK – feine Linienzeichnung tropischer Blätter auf Farbe ============ */
  function monsteraLine(c) {
    return `<path d="M0 30 C-34 14 -36 -28 0 -32 C36 -28 34 14 0 30 Z" fill="none" stroke="${c}" stroke-width="1.1"/>
      <path d="M0 30 V-30" stroke="${c}" stroke-width="1"/>
      <g stroke="${c}" stroke-width="1" stroke-linecap="round">
        <path d="M0 -22 L-24 -16 M0 -12 L-30 -6 M0 -2 L-30 4 M0 8 L-26 13 M0 18 L-16 22"/>
        <path d="M0 -22 L24 -16 M0 -12 L30 -6 M0 -2 L30 4 M0 8 L26 13 M0 18 L16 22"/>
      </g>
      <g fill="none" stroke="${c}" stroke-width=".9"><ellipse cx="-10" cy="-8" rx="2.6" ry="4"/><ellipse cx="10" cy="-8" rx="2.6" ry="4"/><ellipse cx="-12" cy="6" rx="2.4" ry="3.6"/><ellipse cx="12" cy="6" rx="2.4" ry="3.6"/></g>`;
  }
  function palmLine(c) {
    let s = `<path d="M0 40 Q4 0 0 -40" fill="none" stroke="${c}" stroke-width="1.1"/>`;
    for (let i = 0; i < 13; i++) {
      const y = 34 - i * 6, len = 22 - Math.abs(i - 5) * 1.6;
      s += `<path d="M${(Math.sin(i * .3) * 1.5).toFixed(1)} ${y} q${-len * .5} -4 ${-len} ${2 + i * .3}" fill="none" stroke="${c}" stroke-width=".9" stroke-linecap="round"/>`;
      s += `<path d="M${(Math.sin(i * .3) * 1.5).toFixed(1)} ${y} q${len * .5} -4 ${len} ${2 + i * .3}" fill="none" stroke="${c}" stroke-width=".9" stroke-linecap="round"/>`;
    }
    return s;
  }
  function bananaLine(c) {
    let s = `<path d="M0 44 C-16 20 -16 -26 0 -44 C16 -26 16 20 0 44 Z" fill="none" stroke="${c}" stroke-width="1.1"/><path d="M0 44 V-44" stroke="${c}" stroke-width="1"/>`;
    for (let y = -34; y <= 34; y += 5) s += `<path d="M0 ${y} L-11 ${y - 4} M0 ${y} L11 ${y - 4}" stroke="${c}" stroke-width=".6"/>`;
    return s;
  }
  /* --- Früchte und Sonne in derselben feinen Linie (Wunsch 16.11.: Mischmasch aus Tropen) --- */
  const L = (c, w) => `fill="none" stroke="${c}" stroke-width="${w || 1}" stroke-linecap="round" stroke-linejoin="round"`;
  function sunLine(c) {
    let r = '';
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; r += `<path d="M${(Math.cos(a) * 13).toFixed(1)} ${(Math.sin(a) * 13).toFixed(1)} L${(Math.cos(a) * (i % 2 ? 17 : 19)).toFixed(1)} ${(Math.sin(a) * (i % 2 ? 17 : 19)).toFixed(1)}" ${L(c)}/>`; }
    return `<circle r="10" ${L(c, 1.1)}/><circle r="6.5" ${L(c, .8)}/>` + r;
  }
  function pineappleLine(c) {
    let m = '';
    for (let y = -4; y <= 16; y += 4) for (let x = -8; x <= 8; x += 4) {
      const xx = x + (((y + 4) / 4) % 2 ? 2 : 0);
      if ((xx * xx) / 90 + ((y - 6) * (y - 6)) / 180 < .85) m += `<path d="M${xx - 1.6} ${y - 1.4} L${xx} ${y} L${xx + 1.6} ${y - 1.4}" ${L(c, .7)}/>`;
    }
    return `<ellipse cx="0" cy="6" rx="10" ry="14" ${L(c, 1.1)}/>` + m +
      `<path d="M0 -8 Q-2 -18 -1 -26 M0 -8 Q-7 -15 -13 -20 M0 -8 Q7 -15 13 -20 M0 -8 Q-10 -9 -16 -11 M0 -8 Q10 -9 16 -11 M0 -8 Q4 -18 6 -25" ${L(c)}/>`;
  }
  function maracujaLine(c) {
    let seeds = '';
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; seeds += `<ellipse cx="${(Math.cos(a) * 6.5).toFixed(1)}" cy="${(Math.sin(a) * 6.5).toFixed(1)}" rx="1.6" ry="2.3" transform="rotate(${i * 45 + 90} ${(Math.cos(a) * 6.5).toFixed(1)} ${(Math.sin(a) * 6.5).toFixed(1)})" ${L(c, .7)}/><circle cx="${(Math.cos(a) * 6.5).toFixed(1)}" cy="${(Math.sin(a) * 6.5).toFixed(1)}" r=".7" fill="${c}"/>`; }
    return `<circle r="15" ${L(c, 1.1)}/><circle r="11.5" ${L(c, .8)}/>` + seeds + `<circle r="1.6" ${L(c, .7)}/>`;
  }
  function mangoLine(c) {
    return `<path d="M-12 4 C-14 -10 0 -16 10 -10 C18 -4 14 14 2 16 C-6 17 -11 12 -12 4 Z" ${L(c, 1.1)}/>
      <path d="M-7 4 C-7 -4 0 -8 6 -6" ${L(c, .7)}/>
      <path d="M7 -11 Q8 -15 7 -19" ${L(c)}/><path d="M7 -18 Q15 -24 22 -18 Q14 -13 7 -18 Z" ${L(c, .9)}/><path d="M8 -18 L20 -18" ${L(c, .6)}/>`;
  }
  function coconutLine(c) {
    let h = '';
    for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; h += `<path d="M${(Math.cos(a) * 12).toFixed(1)} ${(Math.sin(a) * 12).toFixed(1)} L${(Math.cos(a + .08) * 14.5).toFixed(1)} ${(Math.sin(a + .08) * 14.5).toFixed(1)}" ${L(c, .6)}/>`; }
    return `<circle r="15.5" ${L(c, 1.1)}/><circle r="11" ${L(c, .9)}/>` + h + `<path d="M-4 -2 Q0 -6 4 -2" ${L(c, .7)}/>`;
  }
  function hibiscusLine(c) {
    let p = '';
    for (let i = 0; i < 5; i++) p += `<g transform="rotate(${i * 72})"><path d="M0 0 C-8 -6 -7 -17 0 -18 C7 -17 8 -6 0 0" ${L(c, 1)}/><path d="M0 -2 L0 -13" ${L(c, .6)}/></g>`;
    return p + `<path d="M0 0 Q5 -9 11 -16" ${L(c)}/><circle cx="11.5" cy="-17" r="1.3" fill="${c}"/><circle cx="9" cy="-15.5" r="1" fill="${c}"/><circle cx="13" cy="-14.5" r="1" fill="${c}"/>`;
  }
  function bananasLine(c) {
    const b = (dx, dy, r) => `<g transform="translate(${dx} ${dy}) rotate(${r})"><path d="M-15 -3 Q0 14 17 -6 Q2 5 -15 -3 Z" ${L(c, 1)}/><path d="M-11 0 Q0 7 12 -3" ${L(c, .5)}/></g>`;
    return b(0, -6, -8) + b(1, 2, 0) + b(2, 10, 8) + `<path d="M-15 -8 L-19 -12 M-15 0 L-19 -2" ${L(c, 1.2)}/>`;
  }
  const MOTIF = { monstera: monsteraLine, palm: palmLine, leaf: bananaLine, sun: sunLine, pine: pineappleLine, mara: maracujaLine, mango: mangoLine, coco: coconutLine, hibi: hibiscusLine, banana: bananasLine };
  // Komposition je Wert: [Motiv, x, y, Drehung, Größe, Farbscheibe dahinter (Radius) ]
  // Komposition je Wert (Runde 6): EIN großes Hauptmotiv, angeschnitten, plus höchstens ein kleines
  // [Motiv, x, y, Drehung, Größe, Farbscheibe dahinter (Radius), Scheibe-x, Scheibe-y]
  const COMP = [
    [['monstera', 72, 104, -25, 1.5], ['sun', 82, 26, 0, .55, 13]],
    [['pine', 66, 34, 15, 1.7, 24, 70, 44], ['hibi', 18, 124, 0, .5]],
    [['palm', 28, 96, 170, 1.4], ['mara', 24, 24, 0, .6, 12]],
    [['sun', 66, 46, 0, 1.9, 30], ['leaf', 90, 124, 20, .55]],
    [['monstera', 86, 120, -40, 1.4], ['mango', 18, 24, 0, .6], ['disc', 50, 58, 0, 1, 24]],
    [['mara', 34, 40, 0, 2.0, 30], ['palm', 90, 22, -150, .6]],
    [['mango', 70, 36, 20, 1.9, 28], ['hibi', 84, 122, 0, .45]],
    [['leaf', 24, 98, -25, 1.4], ['coco', 24, 24, 0, .55, 12]],
    [['hibi', 58, 40, 0, 1.9, 26]],
    [['coco', 74, 104, 0, 2.0, 30], ['sun', 86, 22, 0, .5]],
    [['palm', 30, 40, 150, 1.5], ['pine', 18, 106, 0, .5, 12]],
    [['banana', 66, 96, -10, 2.0, 26, 64, 100], ['monstera', 86, 24, -30, .45]],
    [['monstera', 20, 26, 40, 1.3], ['sun', 84, 28, 0, .55, 13]],
    [['pine', 26, 98, -15, 1.8, 26, 28, 106], ['leaf', 22, 22, 30, .5]],
  ];
  // Linien bleiben fein, egal wie groß das Motiv ist
  function fine(svg, sc) { return svg.replace(/stroke-width="([\d.]+)"/g, (m, w) => `stroke-width="${(w * Math.min(1.25, .55 + .45 / Math.max(sc, .5) + .35)).toFixed(2)}" vector-effect="non-scaling-stroke"`); }
  function botanik(v) {
    const p = pal(v), act = ACTION[v];
    const line = light(p.main) ? p.ink : PAPER;
    let discs = '', art = '';
    for (const [m, x, y, rot, sc, disc, dx, dy] of COMP[v]) {
      if (disc) discs += `<circle cx="${dx ?? x}" cy="${dy ?? y}" r="${disc}" fill="${light(p.main) && !light(p.sub) ? p.acc : p.sub}"/>`;
      if (m !== 'disc') art += `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${sc})">${fine(MOTIF[m](line), sc)}</g>`;
    }
    return `<svg class="card-svg" viewBox="0 0 100 140" role="img" aria-label="${v}">
      <defs>${clip('bo' + PK + v)}</defs>
      <g clip-path="url(#bo${PK}${v})">
        <rect width="100" height="140" fill="${p.main}"/>
        ${discs}${art}
        ${grain(v + 9, '#000', 50, .08)}
      </g>
      <rect x="5" y="5" width="90" height="130" rx="7" fill="none" stroke="${line}" stroke-width=".8"/>
      ${num(v, line, `stroke="${p.main}" stroke-width="5" paint-order="stroke"`)}
      ${corner(v, line)}
      ${act ? `<rect x="24" y="122" width="52" height="11" rx="5.5" fill="${p.main}"/>${label(v, 50, 130, line)}` : ''}
    </svg>`;
  }
  function botanikBack() {
    // Rückseite koralle, damit sie sich vom grünen Tisch abhebt
    const bg = PK === 'sonnenuntergang' ? '#E07A5F' : '#1F6F78', disc = PK === 'sonnenuntergang' ? '#3D405B' : '#D96C4F';
    return `<svg class="card-svg" viewBox="0 0 100 140" role="img" aria-label="face-down card">
      <defs>${clip('bob' + PK)}</defs>
      <g clip-path="url(#bob${PK})"><rect width="100" height="140" fill="${bg}"/>
        <circle cx="50" cy="70" r="30" fill="${disc}"/>
        <g transform="translate(50 70) rotate(15)">${monsteraLine(PAPER)}</g>
        <g transform="translate(16 20) scale(.8)">${sunLine(PAPER)}</g>
        <g transform="translate(84 120) rotate(-10) scale(.8)">${pineappleLine(PAPER)}</g>
        <g transform="translate(86 24) rotate(-140) scale(.6)">${palmLine(PAPER)}</g>
        <g transform="translate(16 118) scale(.7)">${maracujaLine(PAPER)}</g>
        ${grain(3, '#000', 50, .08)}</g>
      <rect x="5" y="5" width="90" height="130" rx="7" fill="none" stroke="${PAPER}" stroke-width=".8"/>
      <rect x="32" y="105" width="36" height="12" rx="6" fill="${bg}"/>
      <text x="50" y="114" text-anchor="middle" ${SERIF} font-size="8" font-weight="700" letter-spacing="3" fill="${PAPER}">TATU</text>
    </svg>`;
  }

  root.TatuPalettes = { list: PALETTES, use: usePalette };
  root.TatuStyles = {
    botanik: { name: 'Botanik', face: botanik, back: botanikBack },
  };

  // Gewählt: Botanik in der Farbwelt Sonnenuntergang. Ersetzt die Karten im Spiel.
  usePalette('sonnenuntergang');
  const cache = {};
  T.face = v => cache[v] || (cache[v] = botanik(v));
  T.back = () => cache.back || (cache.back = botanikBack());
  // Logo (ersetzt das Gürteltier): Monstera in feiner Linie im Korallekreis
  T.mascot = size => `<svg width="${size}" height="${size}" viewBox="-40 -40 80 80" aria-hidden="true">
    <circle r="38" fill="#E07A5F"/><g transform="rotate(15) scale(.95)">${fine(monsteraLine(PAPER), 1.4)}</g></svg>`;
})(window);
