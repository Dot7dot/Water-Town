// Inline SVG icons. Bottle icons take a color so every bottle can look different.
const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  return `#${((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0')}`;
};

export function bottleSVG(icon, color = '#7cc8ff', size = 48) {
  const dk = shade(color, -45);
  const lt = shade(color, 60);
  const shapes = {
    // small round flask
    flask: `<rect x="25" y="6" width="14" height="8" rx="3" fill="${dk}"/>
      <rect x="27" y="13" width="10" height="9" fill="${lt}"/>
      <path d="M27 21 Q14 28 14 42 Q14 58 32 58 Q50 58 50 42 Q50 28 37 21Z" fill="${color}"/>
      <path d="M17 42 Q17 55 32 55 Q47 55 47 42Z" fill="${dk}" opacity=".35"/>
      <ellipse cx="23" cy="36" rx="4" ry="7" fill="#fff" opacity=".55"/>`,
    // sport bottle with flip cap
    sport: `<rect x="26" y="3" width="12" height="7" rx="3" fill="${dk}"/>
      <rect x="22" y="9" width="20" height="8" rx="3" fill="${dk}"/>
      <rect x="19" y="16" width="26" height="44" rx="9" fill="${color}"/>
      <rect x="19" y="30" width="26" height="6" fill="${dk}" opacity=".35"/>
      <rect x="19" y="44" width="26" height="16" rx="9" fill="${dk}" opacity=".3"/>
      <rect x="23" y="20" width="4" height="22" rx="2" fill="#fff" opacity=".55"/>`,
    // big jug with handle
    jug: `<rect x="20" y="4" width="16" height="8" rx="3" fill="${dk}"/>
      <path d="M44 22 h6 a6 6 0 0 1 6 6 v14 a6 6 0 0 1 -6 6 h-6" fill="none" stroke="${dk}" stroke-width="5"/>
      <path d="M18 11 h20 l8 12 v30 a8 8 0 0 1 -8 8 h-20 a8 8 0 0 1 -8 -8 v-30z" fill="${color}"/>
      <path d="M10 40 h36 v13 a8 8 0 0 1 -8 8 h-20 a8 8 0 0 1 -8 -8z" fill="${dk}" opacity=".3"/>
      <rect x="15" y="24" width="5" height="22" rx="2.5" fill="#fff" opacity=".55"/>`,
    // cup with straw
    cup: `<rect x="34" y="2" width="5" height="22" rx="2" fill="${dk}" transform="rotate(15 36 13)"/>
      <rect x="13" y="16" width="38" height="7" rx="3" fill="${dk}"/>
      <path d="M16 22 h32 l-4 34 a5 5 0 0 1 -5 4 h-14 a5 5 0 0 1 -5 -4z" fill="${color}"/>
      <circle cx="26" cy="44" r="3" fill="${dk}" opacity=".5"/><circle cx="36" cy="49" r="3" fill="${dk}" opacity=".5"/><circle cx="32" cy="38" r="3" fill="${dk}" opacity=".5"/>
      <rect x="20" y="26" width="4" height="16" rx="2" fill="#fff" opacity=".55"/>`,
    // tall thermos
    thermos: `<rect x="22" y="3" width="20" height="10" rx="4" fill="${dk}"/>
      <rect x="20" y="12" width="24" height="4" fill="${lt}"/>
      <rect x="20" y="15" width="24" height="46" rx="7" fill="${color}"/>
      <rect x="20" y="26" width="24" height="5" fill="#fff" opacity=".7"/>
      <rect x="20" y="50" width="24" height="5" fill="${dk}" opacity=".35"/>
      <rect x="24" y="33" width="4" height="14" rx="2" fill="#fff" opacity=".55"/>`,
  };
  return `<svg class="bottle-svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${shapes[icon] || shapes.flask}</svg>`;
}

const ic = (body, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
  camera: ic('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>'),
  rotL: ic('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  rotR: ic('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>'),
  bag: ic('<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  gear: ic('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  city: ic('<path d="M3 21h18"/><path d="M5 21V10l5-4 5 4v11"/><path d="M15 21v-7h4v7"/><path d="M9 21v-4h2v4"/>'),
  book: ic('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 7h6"/>'),
  shop: ic('<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v2a3 3 0 0 1-5.3 2 3 3 0 0 1-5.4 0A3 3 0 0 1 4 11z"/><path d="M5 13v8h14v-8"/>'),
  close: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: ic('<path d="M5 12l5 5 9-10"/>'),
  move: ic('<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>'),
  trash: ic('<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  edit: ic('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  chevL: ic('<path d="M15 6l-6 6 6 6"/>'),
  chevR: ic('<path d="M9 6l6 6-6 6"/>'),
  turn: ic('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  download: ic('<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>'),
  share: ic('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>'),
  drop: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 2C9 7 5 10.5 5 15a7 7 0 0 0 14 0c0-4.5-4-8-7-13z" fill="currentColor"/><ellipse cx="9.5" cy="15" rx="1.6" ry="2.6" fill="#fff" opacity=".6"/></svg>',
};

export function coinSVG(size = 20) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="#3fb6ff" stroke="#1e8fd6" stroke-width="1.5"/><path d="M12 5.5C10.3 8.3 8 10.2 8 13a4 4 0 0 0 8 0c0-2.8-2.3-4.7-4-7.5z" fill="#fff"/></svg>`;
}
