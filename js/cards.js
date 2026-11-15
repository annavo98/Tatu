/* Tatu! Karten als flache SVGs (Designteam, siehe KONZEPT.md „Kartendesign“).
   Farbe = Wertgruppe (grün gut … dunkel schlecht), Motiv je Wert, große Zahl, Aktionsband mit Symbol und Wort. */
(function (root) {
  'use strict';

  const PAL = {
    0: { bg: '#2FA84F', ink: '#06290F', disc: '#C8F2AE' },
    1: { bg: '#9BE15D', ink: '#1F3D05', disc: '#E6F9D3' },
    3: { bg: '#19C3C9', ink: '#053A3C', disc: '#CBF3F4' },
    5: { bg: '#5BB8FF', ink: '#062B4D', disc: '#D6ECFF' },
    7: { bg: '#A77BFF', ink: '#22104F', disc: '#E9DEFF' },
    9: { bg: '#FF5FA2', ink: '#4A0A2A', disc: '#FFD9EA' },
    11: { bg: '#FFB627', ink: '#4A2E00', disc: '#FFEBC2' },
    13: { bg: '#10325A', ink: '#FFF6E9', disc: '#1F4B7C' },
  };
  function pal(v) { return PAL[v === 0 ? 0 : v === 13 ? 13 : v <= 2 ? 1 : v <= 4 ? 3 : v <= 6 ? 5 : v <= 8 ? 7 : v <= 10 ? 9 : 11]; }

  const ACTION = { 7: 'peek', 8: 'peek', 9: 'spy', 10: 'spy', 11: 'swap', 12: 'swap' };
  const ACTION_LABEL = { peek: 'SCHAUEN', spy: 'SPIONIEREN', swap: 'TAUSCHEN' };
  const MOTIF_NAME = ['Null', 'Sonne', 'Kokospalme', 'Ananas', 'Hibiskus', 'Wassermelone', 'Monstera', 'Eule', 'Eule', 'Jaguar', 'Jaguar', 'Äffchen', 'Äffchen', 'Kaiman'];

  // Symbole (ca. 20 × 20, Mitte 0,0), in Tintenfarbe
  function icon(kind, c) {
    if (kind === 'peek') return `<path d="M-9 0 Q0 -8 9 0 Q0 8 -9 0 Z" fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round"/><circle r="3" fill="${c}"/>`;
    if (kind === 'spy') return `<circle cx="-4.5" cy="1" r="4.2" fill="none" stroke="${c}" stroke-width="2.4"/><circle cx="4.5" cy="1" r="4.2" fill="none" stroke="${c}" stroke-width="2.4"/><path d="M-4.5 -3 L-3 -7 L3 -7 L4.5 -3" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>`;
    if (kind === 'swap') return `<path d="M-8 -3 H6 M2 -7 L6 -3 L2 1" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 4 H-6 M-2 0 L-6 4 L-2 8" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    return '';
  }

  // Motive (ca. 56 × 56, Mitte 0,0)
  const MOTIFS = {
    0: () => `
      <path d="M-21 9 L-31 14 L-20 12 Z" fill="#B88355"/>
      <rect x="-16" y="7" width="6" height="7" rx="2" fill="#8A5E37"/><rect x="9" y="7" width="6" height="7" rx="2" fill="#8A5E37"/>
      <path d="M-23 9 A23 20 0 0 1 23 9 Z" fill="#D9A877"/>
      <path d="M-12 -7 V9 M-4 -10.5 V9 M4 -10.5 V9 M12 -7 V9" stroke="#8A5E37" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M-23 9 A23 20 0 0 1 23 9" fill="none" stroke="#8A5E37" stroke-width="2.6"/>
      <path d="M19 1 Q24 -1 34 9 Q28 13 19 11 Z" fill="#D9A877"/>
      <ellipse cx="21" cy="-2" rx="3" ry="4.5" fill="#B88355"/>
      <circle cx="25.5" cy="5.5" r="1.8" fill="#06290F"/>`,
    1: () => {
      let rays = '';
      for (let i = 0; i < 10; i++) rays += `<rect x="-2.6" y="-27" width="5.2" height="10" rx="2.6" fill="#FF8A3D" transform="rotate(${i * 36})"/>`;
      return rays + `<circle r="15" fill="#FFB627"/>
        <circle cx="-5" cy="-2" r="1.9" fill="#4A2E00"/><circle cx="5" cy="-2" r="1.9" fill="#4A2E00"/>
        <path d="M-6 4 Q0 10 6 4" fill="none" stroke="#4A2E00" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="-9" cy="4" r="2.4" fill="#FF8A3D" opacity=".7"/><circle cx="9" cy="4" r="2.4" fill="#FF8A3D" opacity=".7"/>`;
    },
    2: () => `
      <ellipse cx="2" cy="24" rx="20" ry="4.5" fill="#F7D9A8"/>
      <path d="M4 24 Q8 6 -1 -10" fill="none" stroke="#8A5A2B" stroke-width="6" stroke-linecap="round"/>
      <path d="M4 24 Q8 6 -1 -10" fill="none" stroke="#B07A45" stroke-width="6" stroke-dasharray="2 5"/>
      <g fill="#2FA84F">
        <path d="M-1 -11 Q-14 -24 -28 -14 Q-14 -16 -1 -11 Z"/>
        <path d="M-1 -11 Q12 -25 27 -15 Q12 -17 -1 -11 Z"/>
        <path d="M-1 -11 Q-6 -28 4 -30 Q-1 -22 -1 -11 Z"/>
        <path d="M-1 -11 Q-20 -10 -25 2 Q-14 -7 -1 -11 Z"/>
        <path d="M-1 -11 Q17 -9 22 3 Q11 -6 -1 -11 Z"/>
      </g>
      <circle cx="-4" cy="-7" r="3.4" fill="#6B4423"/><circle cx="2.5" cy="-6" r="3.4" fill="#6B4423"/><circle cx="-1" cy="-2" r="3.4" fill="#6B4423"/>`,
    3: () => {
      let marks = '';
      for (let y = -4; y <= 18; y += 6) for (let x = -9; x <= 9; x += 6) {
        const dx = (Math.abs(y) % 12 === 4 ? 3 : 0);
        const xx = x + dx;
        if ((xx * xx) / 130 + ((y - 7) * (y - 7)) / 210 < 1) marks += `<path d="M${xx - 2} ${y - 2} L${xx} ${y} L${xx + 2} ${y - 2}" fill="none" stroke="#B06A00" stroke-width="1.6" stroke-linecap="round"/>`;
      }
      return `
        <g fill="#2FA84F">
          <path d="M0 -6 L-4 -28 L3 -10 Z"/><path d="M0 -6 L-14 -24 L-3 -7 Z"/><path d="M0 -6 L14 -24 L3 -7 Z"/>
          <path d="M0 -6 L6 -29 L5 -8 Z" fill="#1E7A3A"/><path d="M0 -6 L-20 -14 L-4 -5 Z" fill="#1E7A3A"/><path d="M0 -6 L20 -14 L4 -5 Z" fill="#1E7A3A"/>
        </g>
        <ellipse cx="0" cy="8" rx="13" ry="16" fill="#FFB627"/>` + marks;
    },
    4: () => {
      let petals = '';
      for (let i = 0; i < 5; i++) petals += `<ellipse cx="0" cy="-12" rx="10" ry="13" fill="#FF4F8B" transform="rotate(${i * 72})"/>`;
      let lines = '';
      for (let i = 0; i < 5; i++) lines += `<path d="M0 0 L0 -15" stroke="#C81E63" stroke-width="1.6" stroke-linecap="round" transform="rotate(${i * 72})"/>`;
      return petals + lines + `<circle r="5" fill="#C81E63"/>
        <path d="M0 0 Q6 -10 10 -20" fill="none" stroke="#FFE066" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="10" cy="-21" r="2.2" fill="#FFE066"/><circle cx="7" cy="-19" r="1.6" fill="#FFE066"/><circle cx="12" cy="-17" r="1.6" fill="#FFE066"/>`;
    },
    5: () => `
      <g transform="rotate(-12)">
        <path d="M-26 -6 A26 26 0 0 0 26 -6 Z" fill="#2FA84F"/>
        <path d="M-22.5 -6 A22.5 22.5 0 0 0 22.5 -6 Z" fill="#E6F9D3"/>
        <path d="M-20 -6 A20 20 0 0 0 20 -6 Z" fill="#FF4F5E"/>
        <g fill="#2A1A1A">
          <ellipse cx="-10" cy="1" rx="1.4" ry="2.4"/><ellipse cx="0" cy="3" rx="1.4" ry="2.4"/><ellipse cx="10" cy="1" rx="1.4" ry="2.4"/>
          <ellipse cx="-5" cy="8" rx="1.4" ry="2.4"/><ellipse cx="5" cy="8" rx="1.4" ry="2.4"/>
        </g>
      </g>`,
    6: () => `
      <path d="M2 26 Q1 18 0 12" stroke="#1E7A3A" stroke-width="3.5" stroke-linecap="round" fill="none"/>
      <path d="M0 14 C-28 6 -28 -24 0 -24 C28 -24 28 6 0 14 Z" fill="#2FA84F"/>
      <path d="M0 13 V-22" stroke="#1E7A3A" stroke-width="2.4" stroke-linecap="round"/>
      <g stroke="#D6ECFF" stroke-width="3.4" stroke-linecap="round">
        <path d="M-23 -12 L-11 -9"/><path d="M-24 -1 L-10 -2"/><path d="M-18 8 L-8 4"/>
        <path d="M23 -12 L11 -9"/><path d="M24 -1 L10 -2"/><path d="M18 8 L8 4"/>
      </g>
      <g fill="#D6ECFF"><ellipse cx="-7" cy="-15" rx="2.2" ry="3.2"/><ellipse cx="7" cy="-15" rx="2.2" ry="3.2"/><ellipse cx="-6" cy="-5" rx="2" ry="2.8"/><ellipse cx="6" cy="-5" rx="2" ry="2.8"/></g>`,
    7: () => owl(), 8: () => owl(),
    9: () => jaguar(), 10: () => jaguar(),
    11: () => monkey(), 12: () => monkey(),
    13: () => `
      <path d="M-27 -4 Q-27 -19 -12 -19 L20 -11 Q28 -9 25 -3 L-25 1 Z" fill="#5BBF5E"/>
      <rect x="-24" y="0" width="47" height="5" fill="#FF6B5B"/>
      <path d="M-25 5 L23 6 Q28 9 22 13 L-16 15 Q-27 13 -25 5 Z" fill="#3E9A45"/>
      <path d="M-18 0.5 L-15 5 L-12 0.5 L-9 5 L-6 0.5 L-3 5 L0 0.5 L3 5 L6 0.5 L9 5 L12 0.5 L15 4.5 L18 0.5 Z" fill="#FFFDF7"/>
      <path d="M-15 6 L-12 2 L-9 6 L-6 2 L-3 6 L0 2 L3 6 L6 2 L9 6 L12 2 L15 6 Z" fill="#FFFDF7"/>
      <circle cx="-13" cy="-18" r="6" fill="#5BBF5E"/><circle cx="-13" cy="-18" r="3.8" fill="#FFE066"/><ellipse cx="-13" cy="-18" rx="1.1" ry="3" fill="#06290F"/>
      <circle cx="21" cy="-10" r="1.4" fill="#1E5A22"/>
      <g fill="#3E9A45"><circle cx="-4" cy="-14" r="1.8"/><circle cx="4" cy="-12.5" r="1.8"/><circle cx="12" cy="-11" r="1.8"/></g>`,
  };

  function owl() {
    return `
      <path d="M-15 -14 L-12 -26 L-5 -17 Z" fill="#6A3FC8"/><path d="M15 -14 L12 -26 L5 -17 Z" fill="#6A3FC8"/>
      <ellipse cx="0" cy="3" rx="18" ry="22" fill="#7B4FD6"/>
      <ellipse cx="0" cy="11" rx="10.5" ry="12" fill="#D9C7FF"/>
      <path d="M-5 8 Q-3 10 -1 8 M1 13 Q3 15 5 13 M-5 16 Q-3 18 -1 16" fill="none" stroke="#7B4FD6" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="-7.5" cy="-7" r="8" fill="#FFFDF7"/><circle cx="7.5" cy="-7" r="8" fill="#FFFDF7"/>
      <circle cx="-7" cy="-6.5" r="4" fill="#22104F"/><circle cx="8" cy="-6.5" r="4" fill="#22104F"/>
      <circle cx="-5.8" cy="-8" r="1.3" fill="#FFFDF7"/><circle cx="9.2" cy="-8" r="1.3" fill="#FFFDF7"/>
      <path d="M-3 0 L3 0 L0 5 Z" fill="#FFB627"/>
      <path d="M-8 24 v3 M-5 24 v3 M5 24 v3 M8 24 v3" stroke="#FFB627" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  function jaguar() {
    return `
      <circle cx="-15" cy="-15" r="7" fill="#F2A02A"/><circle cx="15" cy="-15" r="7" fill="#F2A02A"/>
      <circle cx="-15" cy="-15" r="3.5" fill="#7A3E12"/><circle cx="15" cy="-15" r="3.5" fill="#7A3E12"/>
      <circle r="21" fill="#F7B13A"/>
      <g fill="#7A3E12">
        <circle cx="-13" cy="-9" r="2.2"/><circle cx="13" cy="-9" r="2.2"/><circle cx="0" cy="-15" r="2.4"/><circle cx="-7" cy="-16" r="1.6"/><circle cx="7" cy="-16" r="1.6"/>
        <circle cx="-17" cy="2" r="2"/><circle cx="17" cy="2" r="2"/><circle cx="-14" cy="11" r="1.6"/><circle cx="14" cy="11" r="1.6"/>
      </g>
      <ellipse cx="0" cy="9" rx="11" ry="8" fill="#FFF1D6"/>
      <path d="M-12 -3 Q-7 -7 -2 -3 Q-7 -1 -12 -3 Z" fill="#2FA84F"/><path d="M12 -3 Q7 -7 2 -3 Q7 -1 12 -3 Z" fill="#2FA84F"/>
      <circle cx="-6" cy="-3.3" r="1.5" fill="#06290F"/><circle cx="6" cy="-3.3" r="1.5" fill="#06290F"/>
      <path d="M-13 -7 L-2 -5.5 M13 -7 L2 -5.5" stroke="#7A3E12" stroke-width="2" stroke-linecap="round"/>
      <path d="M-3.5 4 L3.5 4 L0 8 Z" fill="#4A0A2A"/>
      <path d="M0 8 V11 M0 11 Q-4 14 -6 11 M0 11 Q4 14 6 11" fill="none" stroke="#4A0A2A" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  function monkey() {
    return `
      <circle cx="-19" cy="1" r="7" fill="#8A5A2B"/><circle cx="19" cy="1" r="7" fill="#8A5A2B"/>
      <circle cx="-19" cy="1" r="3.8" fill="#F6D6B0"/><circle cx="19" cy="1" r="3.8" fill="#F6D6B0"/>
      <circle r="19" fill="#8A5A2B"/>
      <path d="M-15 -8 Q0 -26 15 -8 Q8 -13 0 -13 Q-8 -13 -15 -8 Z" fill="#3A2410"/>
      <path d="M0 -6 C-6 -14 -16 -8 -12 2 C-14 12 -6 17 0 17 C6 17 14 12 12 2 C16 -8 6 -14 0 -6 Z" fill="#F6D6B0"/>
      <circle cx="-5" cy="-1" r="2.4" fill="#3A2410"/><circle cx="5" cy="-1" r="2.4" fill="#3A2410"/>
      <circle cx="-4.2" cy="-1.8" r=".8" fill="#FFFDF7"/><circle cx="5.8" cy="-1.8" r=".8" fill="#FFFDF7"/>
      <ellipse cx="-1.6" cy="5" rx="1" ry=".8" fill="#3A2410"/><ellipse cx="1.6" cy="5" rx="1" ry=".8" fill="#3A2410"/>
      <path d="M-5 9 Q0 13.5 5 9" fill="none" stroke="#3A2410" stroke-width="1.8" stroke-linecap="round"/>`;
  }

  const cache = {};

  function face(v) {
    if (cache[v]) return cache[v];
    const p = pal(v);
    const act = ACTION[v];
    const numY = act ? 107 : 113;
    const numSize = act ? 30 : 36;
    const band = act ? `
      <rect x="10" y="116" width="80" height="16" rx="8" fill="#FFFDF7"/>
      <text x="50" y="127.6" text-anchor="middle" font-size="${act === 'spy' ? 8.6 : 9.4}" font-weight="900" letter-spacing=".6" fill="${v >= 13 ? '#10325A' : p.ink}">${ACTION_LABEL[act]}</text>` : '';
    const corner = act ? `<g transform="translate(84 18)">${icon(act, p.ink)}</g>` : (v === 13 ? `<g transform="translate(84 18)"><path d="M-6 -6 L6 6 M6 -6 L-6 6" stroke="#FF6B5B" stroke-width="3" stroke-linecap="round"/></g>` : '');
    const svg = `<svg class="card-svg" viewBox="0 0 100 140" role="img" aria-label="${v}, ${MOTIF_NAME[v]}${act ? ', ' + ACTION_LABEL[act].toLowerCase() : ''}">
      <rect width="100" height="140" rx="12" fill="${p.bg}"/>
      <text x="9" y="25" font-size="21" font-weight="900" fill="${p.ink}">${v}</text>
      ${corner}
      <circle cx="50" cy="56" r="30" fill="${p.disc}"/>
      <g transform="translate(${v === 0 ? 47 : 50} ${v === 0 ? 55 : 57}) scale(${v === 0 ? 1.12 : .92})">${MOTIFS[v]()}</g>
      <text x="50" y="${numY}" text-anchor="middle" font-size="${numSize}" font-weight="900" fill="${p.ink}">${v}</text>
      ${band}
    </svg>`;
    cache[v] = svg;
    return svg;
  }

  let backCache = null;
  function back() {
    if (backCache) return backCache;
    let waves = '';
    for (let y = 6; y < 140; y += 13) waves += `<path d="M-5 ${y} q 7.5 -6 15 0 t 15 0 t 15 0 t 15 0 t 15 0 t 15 0 t 15 0 t 15 0" fill="none" stroke="#FFF6E9" stroke-opacity=".16" stroke-width="3.6"/>`;
    backCache = `<svg class="card-svg" viewBox="0 0 100 140" role="img" aria-label="verdeckte Karte">
      <defs><clipPath id="tatu-back-clip"><rect width="100" height="140" rx="12"/></clipPath></defs>
      <rect width="100" height="140" rx="12" fill="#10325A"/>
      <g clip-path="url(#tatu-back-clip)">${waves}</g>
      <rect x="6" y="6" width="88" height="128" rx="8" fill="none" stroke="#FFB627" stroke-width="2.4"/>
      <circle cx="50" cy="66" r="25" fill="#FFB627"/>
      <g transform="translate(51 67) scale(.66)">
        <path d="M-21 9 L-31 14 L-20 12 Z" fill="#4A2E00"/>
        <path d="M-23 9 A23 20 0 0 1 23 9 Z" fill="#4A2E00"/>
        <path d="M-12 -7 V9 M-4 -10.5 V9 M4 -10.5 V9 M12 -7 V9" stroke="#FFB627" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M19 1 Q24 -1 34 9 Q28 13 19 11 Z" fill="#4A2E00"/>
        <ellipse cx="21" cy="-2" rx="3" ry="4.5" fill="#4A2E00"/>
      </g>
      <text x="50" y="112" text-anchor="middle" font-size="13" font-weight="900" letter-spacing="3" fill="#FFB627">TATU</text>
    </svg>`;
    return backCache;
  }

  // Maskottchen für Logo und Startseite
  function mascot(size) {
    return `<svg width="${size}" height="${size}" viewBox="-36 -32 72 64" aria-hidden="true">${MOTIFS[0]()}</svg>`;
  }

  root.TatuCards = { face, back, mascot, pal, icon, ACTION, MOTIF_NAME };
})(window);
