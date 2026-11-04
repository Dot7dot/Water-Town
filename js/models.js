// Procedural "cute clay" 3D models for plants and buildings.
import * as THREE from '../vendor/three.module.min.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

/* ----------------------------------------------------------- helpers */
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...opts }));
  }
  return matCache.get(key);
}
const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

export function rng(seedStr) {
  let h = 1779033703 ^ String(seedStr).length;
  for (let i = 0; i < String(seedStr).length; i++) {
    h = Math.imul(h ^ String(seedStr).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function add(parent, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const sphereG = (seg = 14) => geo('sph' + seg, () => new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)));
function ball(p, color, r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 14) {
  const m = add(p, sphereG(seg), mat(color), x, y, z);
  m.scale.set(r * sx, r * sy, r * sz);
  return m;
}
function cyl(p, color, rt, rb, h, x, y, z, seg = 12) {
  const g = geo(`cyl${rt}_${rb}_${h}_${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
  return add(p, g, mat(color), x, y + h / 2, z);
}
function cone(p, color, r, h, x, y, z, seg = 14) {
  const g = geo(`cone${r}_${h}_${seg}`, () => new THREE.ConeGeometry(r, h, seg));
  return add(p, g, mat(color), x, y + h / 2, z);
}
function rbox(p, color, w, h, d, x, y, z, r = 0.04, opts) {
  const g = geo(`rb${w}_${h}_${d}_${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)));
  return add(p, g, opts ? mat(color, opts) : mat(color), x, y + h / 2, z);
}
// a leaf: flattened, pointed ellipsoid
function leaf(p, color, len, wid, x, y, z, yaw, pitch) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.rotation.order = 'YXZ';
  pivot.rotation.y = yaw;
  pivot.rotation.x = pitch;
  const m = add(pivot, sphereG(10), mat(color), 0, 0, len / 2);
  m.scale.set(wid, wid * 0.28, len / 2);
  p.add(pivot);
  return pivot;
}

/* ------------------------------------------------------------ palette */
const C = {
  leaf: '#6fcf6a', leafDark: '#4fae5a', leafLight: '#9be07f', trunk: '#9a6a46', trunkDark: '#7b5236',
  soil: '#8a6248', pink: '#ff9ec7', pinkLight: '#ffc7de', red: '#ff6b6b', yellow: '#ffd84d', white: '#fffaf0',
  purple: '#a98bff', blue: '#5b7cfa', orange: '#ffa94d', cactus: '#5fbf7a', sand: '#f3d9a4',
};

export const STAGE_INDEX = { sprout: 0, young: 1, mature: 2, bloom: 3, fruit: 4, dead: 2 };
const STAGE_SCALE = [0.55, 0.8, 1, 1.05, 1.08];

/* ------------------------------------------------------- plant builders */
function sprout(g, color = C.leaf) {
  ball(g, C.soil, 0.13, 0, 0.0, 0, 1, 0.35, 1);
  cyl(g, C.leafDark, 0.015, 0.02, 0.16, 0, 0, 0, 6);
  leaf(g, color, 0.14, 0.07, 0, 0.15, 0, 0, -0.5);
  leaf(g, color, 0.14, 0.07, 0, 0.15, 0, Math.PI, -0.5);
}

const PB = {
  clover(g, c) {
    const n = Math.min(3 + c.leaves, 12);
    for (let i = 0; i < n; i++) {
      const a = c.rnd() * Math.PI * 2; const r = Math.sqrt(c.rnd()) * 0.3;
      const x = Math.cos(a) * r; const z = Math.sin(a) * r; const h = 0.05 + c.rnd() * 0.07;
      cyl(g, C.leafDark, 0.008, 0.008, h, x, 0, z, 4);
      const lucky = c.rnd() < 0.08 ? 4 : 3;
      for (let k = 0; k < lucky; k++) {
        const b = (k / lucky) * Math.PI * 2 + a;
        ball(g, k % 2 ? C.leaf : C.leafLight, 0.04, x + Math.cos(b) * 0.035, h + 0.01, z + Math.sin(b) * 0.035, 1, 0.35, 1, 8);
      }
    }
  },
  dandelion(g, c) {
    const n = Math.min(5 + Math.floor(c.leaves / 2), 10);
    for (let i = 0; i < n; i++) leaf(g, C.leaf, 0.22, 0.06, 0, 0.02, 0, (i / n) * Math.PI * 2, -0.15);
    cyl(g, C.leafDark, 0.012, 0.014, 0.32, 0, 0, 0, 6);
    if (c.stage === 4) {
      const puff = ball(g, '#ffffff', 0.12, 0, 0.42, 0);
      puff.material = mat('#ffffff', { transparent: true, opacity: 0.85 });
    } else if (c.stage === 3) ball(g, C.yellow, 0.085, 0, 0.36, 0, 1, 0.7, 1);
    else ball(g, C.leafDark, 0.04, 0, 0.34, 0, 1, 1.3, 1);
  },
  pine(g, c) {
    cyl(g, C.trunk, 0.05, 0.07, 0.25, 0, 0, 0, 8);
    const tiers = Math.min(2 + Math.floor(c.leaves / 3), 4);
    for (let i = 0; i < tiers; i++) {
      cone(g, i % 2 ? C.leafDark : '#3f9a5c', 0.34 - i * 0.06, 0.32, 0, 0.18 + i * 0.17, 0, 10);
    }
    if (c.stage >= 4) for (let i = 0; i < 4; i++) { const a = i * 1.6; ball(g, '#8b5a2b', 0.04, Math.cos(a) * 0.28, 0.2 + i * 0.05, Math.sin(a) * 0.28, 0.8, 1.2, 0.8, 8); }
  },
  berry(g, c) {
    const n = Math.min(3 + Math.floor(c.leaves / 2), 8);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; const r = i === 0 ? 0 : 0.14;
      ball(g, i % 2 ? C.leaf : C.leafDark, 0.17 + c.rnd() * 0.04, Math.cos(a) * r, 0.17 + (i === 0 ? 0.08 : 0), Math.sin(a) * r);
    }
    const dots = c.stage === 4 ? '#4a5fd8' : c.stage === 3 ? C.white : null;
    if (dots) for (let i = 0; i < 12; i++) {
      const a = c.rnd() * Math.PI * 2; const y = 0.12 + c.rnd() * 0.22;
      ball(g, dots, 0.03, Math.cos(a) * 0.25, y, Math.sin(a) * 0.25, 1, 1, 1, 8);
    }
  },
  tulip(g, c) {
    const colors = [C.red, C.pink, C.yellow, C.purple];
    const n = Math.min(1 + Math.floor(c.leaves / 3), 4);
    for (let i = 0; i < n; i++) {
      const a = c.rnd() * Math.PI * 2; const r = i ? 0.15 : 0; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      const h = 0.28 + c.rnd() * 0.08;
      cyl(g, C.leafDark, 0.012, 0.014, h, x, 0, z, 6);
      leaf(g, C.leaf, 0.18, 0.06, x, 0.02, z, a, -1.1);
      if (c.stage >= 3) {
        const col = colors[Math.floor(c.rnd() * colors.length)];
        ball(g, col, 0.07, x, h + 0.05, z, 1, 1.3, 1);
        for (let k = 0; k < 3; k++) { const b = k * 2.1; ball(g, col, 0.045, x + Math.cos(b) * 0.04, h + 0.08, z + Math.sin(b) * 0.04, 0.8, 1.5, 0.8, 8); }
      } else ball(g, '#8fd17c', 0.045, x, h + 0.03, z, 1, 1.5, 1);
    }
  },
  sunflower(g, c) {
    cyl(g, C.leafDark, 0.025, 0.03, 0.75, 0, 0, 0, 8);
    const n = Math.min(2 + Math.floor(c.leaves / 2), 6);
    for (let i = 0; i < n; i++) leaf(g, C.leaf, 0.2, 0.11, 0, 0.15 + i * 0.1, 0, i * 2.4, -0.4);
    const head = new THREE.Group(); head.position.set(0, 0.78, 0.04); head.rotation.x = c.stage === 4 ? 0.9 : 0.35; g.add(head);
    if (c.stage >= 3) {
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const p = ball(head, C.yellow, 0.06, Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0, 1.4, 0.7, 0.3, 8); p.rotation.z = a; }
      const disc = add(head, geo('sfdisc', () => new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16)), mat(c.stage === 4 ? '#5a3a1e' : '#8b5a2b'), 0, 0, 0.01);
      disc.rotation.x = Math.PI / 2;
    } else ball(head, C.leafDark, 0.07, 0, 0, 0);
  },
  apple(g, c) { tree(g, c, { crown: C.leaf, crown2: C.leafDark, flower: C.pinkLight, fruit: C.red }); },
  sakura(g, c) {
    const pinkCrown = c.stage >= 3;
    tree(g, c, { crown: pinkCrown ? C.pink : C.leaf, crown2: pinkCrown ? C.pinkLight : C.leafLight, flower: '#ffffff', fruit: null });
    if (pinkCrown) for (let i = 0; i < 6; i++) { const p = ball(g, C.pinkLight, 0.03, (c.rnd() - 0.5) * 0.8, c.rnd() * 0.4, (c.rnd() - 0.5) * 0.8, 1, 0.3, 1, 6); p.userData.fall = 0.1 + c.rnd() * 0.15; }
  },
  oak(g, c) {
    cyl(g, C.trunkDark, 0.16, 0.24, 0.7, 0, 0, 0, 10);
    const n = Math.min(4 + Math.floor(c.leaves / 2), 10);
    ball(g, C.leafDark, 0.55, 0, 1.0, 0, 1, 0.8, 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; const r = 0.42 + c.rnd() * 0.12;
      ball(g, i % 2 ? C.leaf : '#5fbf62', 0.3 + c.rnd() * 0.08, Math.cos(a) * r, 0.9 + c.rnd() * 0.35, Math.sin(a) * r);
    }
    if (c.stage >= 4) for (let i = 0; i < 8; i++) {
      const a = c.rnd() * Math.PI * 2; const x = Math.cos(a) * 0.62; const z = Math.sin(a) * 0.62; const y = 0.75 + c.rnd() * 0.3;
      ball(g, '#a0662f', 0.05, x, y, z, 0.9, 1.2, 0.9, 8); ball(g, '#6b4423', 0.05, x, y + 0.04, z, 1, 0.5, 1, 8);
    }
  },
  fern(g, c) {
    const n = Math.min(5 + Math.floor(c.leaves / 2), 11);
    for (let i = 0; i < n; i++) leaf(g, i % 2 ? C.leaf : '#3fae6a', 0.34 + c.rnd() * 0.08, 0.07, 0, 0.03, 0, (i / n) * Math.PI * 2 + c.rnd() * 0.3, -0.7 - c.rnd() * 0.3);
  },
  reed(g, c) {
    const n = Math.min(3 + Math.floor(c.leaves / 2), 9);
    for (let i = 0; i < n; i++) {
      const x = (c.rnd() - 0.5) * 0.35; const z = (c.rnd() - 0.5) * 0.35; const h = 0.35 + c.rnd() * 0.3;
      const b = cyl(g, i % 2 ? C.leaf : C.leafDark, 0.008, 0.018, h, x, 0, z, 5);
      b.rotation.z = (c.rnd() - 0.5) * 0.2;
      if (c.stage >= 3 && i % 2 === 0) { cyl(g, '#7a4a2a', 0.03, 0.03, 0.12, x, h - 0.02, z, 8); cyl(g, C.leafDark, 0.005, 0.005, 0.06, x, h + 0.1, z, 4); }
    }
  },
  iris(g, c) {
    const n = Math.min(4 + Math.floor(c.leaves / 2), 9);
    for (let i = 0; i < n; i++) { const m = cone(g, i % 2 ? C.leaf : C.leafDark, 0.035, 0.4 + c.rnd() * 0.12, (c.rnd() - 0.5) * 0.2, 0, (c.rnd() - 0.5) * 0.2, 5); m.scale.z = 0.35; m.rotation.z = (c.rnd() - 0.5) * 0.35; }
    if (c.stage >= 3) for (let k = 0; k < 3; k++) {
      const x = (k - 1) * 0.12; const y = 0.42 + k * 0.03;
      for (let p = 0; p < 3; p++) { const a = p * 2.1; const m = ball(g, p ? C.purple : '#7b5cff', 0.05, x + Math.cos(a) * 0.04, y, Math.sin(a) * 0.04, 0.6, 1.3, 0.4, 8); m.rotation.y = a; }
      ball(g, C.yellow, 0.02, x, y + 0.03, 0, 1, 1, 1, 6);
    }
  },
  mushroom(g, c) {
    const n = Math.min(1 + Math.floor(c.leaves / 3), 4);
    for (let i = 0; i < n; i++) {
      const s = i === 0 ? 1 : 0.6; const a = i * 2.2; const r = i ? 0.2 : 0; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      cyl(g, '#fff4e0', 0.05 * s, 0.06 * s, 0.14 * s, x, 0, z, 10);
      const cap = add(g, geo('mcap', () => new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mat(C.red), x, 0.13 * s, z);
      cap.scale.set(0.13 * s, 0.1 * s, 0.13 * s);
      for (let k = 0; k < 4; k++) { const b = k * 1.6 + 0.4; ball(g, '#ffffff', 0.022 * s, x + Math.cos(b) * 0.08 * s, 0.2 * s, z + Math.sin(b) * 0.08 * s, 1, 0.5, 1, 6); }
    }
  },
  willow(g, c) {
    cyl(g, C.trunk, 0.12, 0.2, 0.8, 0, 0, 0, 10);
    ball(g, '#7ccf73', 0.6, 0, 1.1, 0, 1, 0.55, 1);
    const n = Math.min(10 + c.leaves * 2, 30);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; const r = 0.45 + c.rnd() * 0.15; const len = 0.45 + c.rnd() * 0.35;
      cyl(g, i % 3 ? '#8fdc7c' : '#6fcf6a', 0.025, 0.04, len, Math.cos(a) * r, 1.1 - len, Math.sin(a) * r, 5);
    }
  },
  duckweed(g, c) {
    const n = Math.min(5 + c.leaves * 2, 26);
    for (let i = 0; i < n; i++) {
      const a = c.rnd() * Math.PI * 2; const r = Math.sqrt(c.rnd()) * 0.4;
      const d = add(g, geo('dw', () => new THREE.CylinderGeometry(1, 1, 0.01, 10)), mat(i % 3 ? '#8fdc5a' : '#6cc04a'), Math.cos(a) * r, 0.01, Math.sin(a) * r);
      const s = 0.035 + c.rnd() * 0.025; d.scale.set(s, 1, s);
    }
  },
  waterlily(g, c) {
    const n = Math.min(2 + Math.floor(c.leaves / 3), 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + c.rnd(); const r = i ? 0.22 : 0;
      const pad = add(g, geo('lpad', () => { const gg = new THREE.CircleGeometry(1, 20, 0.35, Math.PI * 2 - 0.7); gg.rotateX(-Math.PI / 2); return gg; }), mat('#5cb85c', { side: THREE.DoubleSide }), Math.cos(a) * r, 0.015, Math.sin(a) * r);
      const s = 0.13 + c.rnd() * 0.04; pad.scale.set(s, 1, s); pad.rotation.y = c.rnd() * 6;
    }
    if (c.stage >= 3) flower(g, C.pink, C.yellow, 0, 0.05, 0, 0.6);
    else if (c.stage >= 2) ball(g, C.pinkLight, 0.04, 0, 0.05, 0, 1, 1.4, 1);
  },
  lotus(g, c) {
    const n = Math.min(2 + Math.floor(c.leaves / 3), 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; const r = 0.18; const h = 0.2 + c.rnd() * 0.25; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      cyl(g, C.leafDark, 0.01, 0.01, h, x, 0, z, 5);
      const lf = add(g, geo('lotusLeaf', () => new THREE.ConeGeometry(1, 0.35, 18, 1, true)), mat('#4fae5a', { side: THREE.DoubleSide }), x, h + 0.02, z);
      lf.scale.set(0.14, 0.14, 0.14); lf.rotation.x = Math.PI;
    }
    cyl(g, C.leafDark, 0.012, 0.012, 0.42, 0, 0, 0, 6);
    if (c.stage === 4) {
      cyl(g, '#9ccf6a', 0.09, 0.05, 0.08, 0, 0.42, 0, 14);
      for (let k = 0; k < 6; k++) { const a = k; ball(g, '#5e7d32', 0.015, Math.cos(a) * 0.05, 0.5, Math.sin(a) * 0.05, 1, 0.5, 1, 6); }
    } else if (c.stage === 3) flower(g, C.pink, C.yellow, 0, 0.44, 0, 1);
    else ball(g, C.pink, 0.06, 0, 0.46, 0, 1, 1.5, 1);
  },
  cactus(g, c) {
    const body = add(g, geo('capsule', () => new THREE.CapsuleGeometry(0.12, 0.34, 6, 14)), mat(C.cactus), 0, 0.3, 0);
    body.scale.set(1, 1, 1);
    const arms = Math.min(Math.floor(c.leaves / 3), 3);
    for (let i = 0; i < arms; i++) {
      const side = i % 2 ? -1 : 1; const y = 0.25 + i * 0.1;
      const a1 = add(g, geo('capArm', () => new THREE.CapsuleGeometry(0.055, 0.1, 4, 10)), mat(C.cactus), side * 0.16, y, i === 2 ? 0.08 : 0);
      a1.rotation.z = side * Math.PI / 2;
      add(g, geo('capArm2', () => new THREE.CapsuleGeometry(0.055, 0.12, 4, 10)), mat(C.cactus), side * 0.23, y + 0.09, i === 2 ? 0.08 : 0);
    }
    for (let i = 0; i < 10; i++) { const a = c.rnd() * 6.28; ball(g, '#fffbe6', 0.012, Math.cos(a) * 0.12, 0.15 + c.rnd() * 0.35, Math.sin(a) * 0.12, 1, 1, 1, 4); }
    if (c.stage >= 3) flower(g, C.pink, C.yellow, 0, 0.6, 0, 0.55);
    if (c.stage >= 4) for (let i = 0; i < 3; i++) { const a = i * 2.1; ball(g, '#e8456b', 0.035, Math.cos(a) * 0.1, 0.55, Math.sin(a) * 0.1, 1, 1.3, 1, 8); }
  },
  barrel(g, c) {
    const n = Math.min(1 + Math.floor(c.leaves / 4), 3);
    for (let i = 0; i < n; i++) {
      const s = i ? 0.65 : 1; const a = i * 2.4; const r = i ? 0.2 : 0; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      const b = add(g, geo('barrel', () => new THREE.SphereGeometry(1, 12, 10)), mat('#4fb06e', { flatShading: true }), x, 0.13 * s, z);
      b.scale.set(0.16 * s, 0.15 * s, 0.16 * s);
      if (c.stage >= 3) for (let k = 0; k < 6; k++) { const q = k * 1.05; ball(g, C.yellow, 0.03 * s, x + Math.cos(q) * 0.05 * s, 0.28 * s, z + Math.sin(q) * 0.05 * s, 1, 0.7, 1, 6); }
    }
  },
  aloe(g, c) {
    const n = Math.min(5 + Math.floor(c.leaves / 2), 11);
    for (let i = 0; i < n; i++) {
      const pivot = new THREE.Group(); pivot.rotation.y = (i / n) * Math.PI * 2; pivot.rotation.z = 0.35 + c.rnd() * 0.3; g.add(pivot);
      const m = cone(pivot, i % 2 ? '#7bbf9a' : '#6aae8a', 0.05, 0.38, 0, 0, 0, 6); m.scale.z = 0.5;
    }
    if (c.stage >= 3) { cyl(g, C.leafDark, 0.01, 0.012, 0.5, 0.05, 0, 0, 5); for (let k = 0; k < 5; k++) ball(g, C.orange, 0.025, 0.05, 0.38 + k * 0.035, 0, 0.8, 1.4, 0.8, 6); }
  },
  succulent(g, c) {
    const n = Math.min(6 + c.leaves, 18);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4; const r = 0.03 + i * 0.008; const y = 0.05 + (n - i) * 0.006;
      const m = ball(g, i < 4 ? '#b6e3c8' : i % 3 ? '#8fcfb0' : '#c3a6e8', 0.05, Math.cos(a) * r, y, Math.sin(a) * r, 0.8, 0.5, 1.4, 8);
      m.rotation.y = -a; m.rotation.x = -0.4;
    }
    if (c.stage >= 3) { cyl(g, '#8fcfb0', 0.008, 0.01, 0.3, 0.02, 0, 0, 5); for (let k = 0; k < 4; k++) ball(g, C.pink, 0.022, 0.02 + (k % 2 ? 0.02 : -0.02), 0.25 + k * 0.025, 0, 1, 1, 1, 6); }
  },
  palm(g, c) {
    let x = 0; let y = 0;
    for (let i = 0; i < 6; i++) { const s = cyl(g, i % 2 ? C.trunk : '#b07d52', 0.045, 0.055, 0.14, x, y, 0, 8); x += 0.015; y += 0.13; s.rotation.z = -0.1; }
    const n = Math.min(4 + Math.floor(c.leaves / 2), 9);
    for (let i = 0; i < n; i++) leaf(g, i % 2 ? C.leaf : C.leafDark, 0.42, 0.09, x, y + 0.02, 0, (i / n) * Math.PI * 2, 0.35);
    if (c.stage >= 4) for (let i = 0; i < 5; i++) { const a = i * 1.25; ball(g, '#c46a2b', 0.035, x + Math.cos(a) * 0.06, y - 0.04, Math.sin(a) * 0.06, 1, 1.3, 1, 8); }
  },
};

function tree(g, c, col) {
  cyl(g, C.trunk, 0.05, 0.08, 0.42, 0, 0, 0, 8);
  const n = Math.min(2 + Math.floor(c.leaves / 2), 7);
  ball(g, col.crown, 0.28, 0, 0.6, 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3; const r = 0.18 + c.rnd() * 0.06;
    ball(g, i % 2 ? col.crown : col.crown2, 0.16 + c.rnd() * 0.05, Math.cos(a) * r, 0.55 + c.rnd() * 0.2, Math.sin(a) * r);
  }
  if (c.stage === 3 && col.flower) for (let i = 0; i < 12; i++) { const a = c.rnd() * 6.28; const yy = 0.45 + c.rnd() * 0.35; ball(g, col.flower, 0.03, Math.cos(a) * 0.32, yy, Math.sin(a) * 0.32, 1, 1, 1, 6); }
  if (c.stage === 4 && col.fruit) for (let i = 0; i < 8; i++) { const a = c.rnd() * 6.28; const yy = 0.42 + c.rnd() * 0.32; ball(g, col.fruit, 0.05, Math.cos(a) * 0.33, yy, Math.sin(a) * 0.33, 1, 1, 1, 10); }
}

function flower(g, petal, center, x, y, z, s) {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const p = ball(g, k % 2 ? petal : C.pinkLight, 0.06 * s, x + Math.cos(a) * 0.06 * s, y + 0.03 * s, z + Math.sin(a) * 0.06 * s, 0.6, 0.35, 1.3, 8);
    p.rotation.y = -a + Math.PI / 2; p.rotation.x = 0.0;
    p.rotation.z = 0.5;
  }
  ball(g, center, 0.035 * s, x, y + 0.05 * s, z, 1, 0.7, 1, 8);
}

const WATER_PLANTS = new Set(['duckweed', 'waterlily', 'lotus']);
const PLANT_SIZE = { oak: 2, willow: 2 };

// Build a ground plant model. info = {species, stage, leaves, perfectDays, seed, dead}
export function buildPlant(info) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const stage = STAGE_INDEX[info.stage] ?? 1;
  const c = { stage, leaves: info.leaves ?? 3, rnd: rng(info.seed ?? info.species) };
  if (stage === 0 && !info.dead && !WATER_PLANTS.has(info.species)) sprout(inner, info.species === 'cactus' || info.species === 'barrel' ? C.cactus : C.leaf);
  else (PB[info.species] || PB.clover)(inner, c);
  const base = (PLANT_SIZE[info.species] || 1) === 2 ? 1.1 : 1.3; // chunky, readable on phones
  const s = base * (info.dead ? 0.9 : STAGE_SCALE[stage]) * (1 + Math.min(info.perfectDays || 0, 8) * 0.04);
  inner.scale.setScalar(s);
  if (info.dead) {
    inner.traverse((o) => { if (o.isMesh) o.material = mat(o.material.color.getHSL({}).l < 0.35 ? '#6e5236' : '#b39a6e'); });
    inner.rotation.z = 0.18; inner.scale.y *= 0.8;
  }
  return g;
}

/* ------------------------------------------------------- wall plants */
const texCache = new Map();
export function wallPlantTexture(species, stage, leaves, hUnits, seed, dead) {
  const key = [species, stage, Math.min(leaves, 12), hUnits, seed, dead].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const W = 128; const H = 128 * hUnits;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const r = rng(seed);
  const st = STAGE_INDEX[stage] ?? 1;
  const green = dead ? ['#9b8358', '#7d6844'] : species === 'grape' ? ['#6cbf5a', '#4f9e48'] : species === 'morningglory' ? ['#79d16b', '#55b05a'] : ['#4fae5a', '#3d8f4a', '#6fcf6a'];
  // coverage grows with stage and leaves
  const cover = Math.min(1, 0.35 + st * 0.15 + leaves * 0.03);
  const top = H * (1 - cover);
  x.lineCap = 'round';
  const vines = 3;
  const stems = [];
  for (let v = 0; v < vines; v++) {
    let px = 18 + v * 46 + r() * 10; let py = H;
    const pts = [[px, py]];
    while (py > top) { py -= 14; px += (r() - 0.5) * 22; px = Math.max(8, Math.min(W - 8, px)); pts.push([px, py]); }
    stems.push(pts);
    x.strokeStyle = dead ? '#6e5236' : '#3b7a3a'; x.lineWidth = 3;
    x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke();
  }
  const leafCount = Math.round((8 + leaves * 3) * hUnits * (0.5 + st * 0.2));
  for (let i = 0; i < leafCount; i++) {
    const pts = stems[i % vines]; const [px, py] = pts[Math.floor(r() * pts.length)];
    const lx = px + (r() - 0.5) * 26; const ly = py + (r() - 0.5) * 18; const s = 7 + r() * 6;
    x.fillStyle = green[i % green.length];
    x.beginPath();
    if (species === 'ivy') { // pointed ivy leaf
      x.moveTo(lx, ly - s); x.lineTo(lx + s, ly); x.lineTo(lx + s * 0.4, ly + s * 0.3); x.lineTo(lx, ly + s); x.lineTo(lx - s * 0.4, ly + s * 0.3); x.lineTo(lx - s, ly); x.closePath();
    } else { x.ellipse(lx, ly, s, s * 0.8, r() * 3, 0, Math.PI * 2); }
    x.fill();
  }
  if (!dead && st >= 3 && species === 'morningglory') {
    for (let i = 0; i < 6 * hUnits; i++) {
      const pts = stems[i % vines]; const [px, py] = pts[Math.floor(r() * pts.length)];
      const fx = px + (r() - 0.5) * 20; const fy = py;
      x.fillStyle = i % 2 ? '#7a8cff' : '#c38bff'; x.beginPath(); x.arc(fx, fy, 9, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(fx, fy, 3.5, 0, Math.PI * 2); x.fill();
    }
  }
  if (!dead && st >= 3 && species === 'grape') {
    for (let i = 0; i < 3 * hUnits; i++) {
      const pts = stems[i % vines]; const [px, py] = pts[Math.floor(r() * (pts.length - 1))];
      for (let k = 0; k < 9; k++) {
        const row = Math.floor(Math.sqrt(k * 2)); x.fillStyle = k % 2 ? '#7a3fa0' : '#9459c2';
        x.beginPath(); x.arc(px + (k % 3 - 1) * 6 + row, py + row * 6 + 6, 4.5, 0, Math.PI * 2); x.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

export function buildWallPlant(info, width, height) {
  const tex = wallPlantTexture(info.species, info.stage, info.leaves ?? 3, Math.round(height / 0.6) >= 2 ? 2 : 1, info.seed, info.dead);
  const m = new THREE.Mesh(
    geo(`wp${width}_${height}`, () => new THREE.PlaneGeometry(width, height)),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, roughness: 0.85, side: THREE.DoubleSide }),
  );
  m.castShadow = false; m.receiveShadow = true;
  return m;
}

/* ---------------------------------------------------------- buildings */
// half = half width of the wall body; wallH = wall height (for climbing plants)
export const BUILD_SPEC = {
  cottage: { half: 0.36, wallH: 0.55 },
  house2: { half: 0.82, wallH: 1.3 },
  clocktower: { half: 0.3, wallH: 1.4 },
  windmill: { half: 0.3, wallH: 1.15 },
  teahouse: { half: 0.78, wallH: 0.5 },
};

function windowAt(g, x, y, z, ry, w = 0.14, h = 0.16) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; g.add(grp);
  rbox(grp, '#ffffff', w + 0.04, h + 0.04, 0.02, 0, -h / 2 - 0.02, 0, 0.01);
  rbox(grp, '#9fdcff', w, h, 0.03, 0, -h / 2, 0.005, 0.01, { emissive: '#3a6f9a', emissiveIntensity: 0.25 });
}
function door(g, x, z, ry, color = '#a8693f', h = 0.28) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; g.add(grp);
  rbox(grp, color, 0.16, h, 0.03, 0, 0, 0, 0.03);
  ball(grp, C.yellow, 0.014, 0.05, h * 0.5, 0.02, 1, 1, 1, 6);
}
function hipRoof(g, color, half, y, h) {
  const r = add(g, geo(`roof${half}_${h}`, () => new THREE.ConeGeometry(half * 1.55, h, 4)), mat(color), 0, y + h / 2, 0);
  r.rotation.y = Math.PI / 4;
  return r;
}

const BB = {
  cottage(g) {
    const s = BUILD_SPEC.cottage;
    rbox(g, '#fff1d6', s.half * 2, s.wallH, s.half * 2, 0, 0, 0, 0.05);
    hipRoof(g, '#ff8a7a', s.half, s.wallH - 0.02, 0.42);
    rbox(g, '#c9a27e', 0.09, 0.2, 0.09, 0.15, s.wallH + 0.12, -0.08, 0.02);
    door(g, 0, s.half + 0.005, 0);
    windowAt(g, s.half + 0.005, 0.42, 0, Math.PI / 2);
    windowAt(g, -s.half - 0.005, 0.42, 0, -Math.PI / 2);
  },
  house2(g) {
    const s = BUILD_SPEC.house2;
    rbox(g, '#e6f2ff', s.half * 2, s.wallH, s.half * 2, 0, 0, 0, 0.08);
    rbox(g, '#cfe3fa', s.half * 2 + 0.04, 0.06, s.half * 2 + 0.04, 0, 0.62, 0, 0.02);
    hipRoof(g, '#6f9bff', s.half, s.wallH - 0.02, 0.6);
    door(g, 0, s.half + 0.005, 0, '#8a5a3c', 0.34);
    for (const [x, y] of [[-0.45, 0.48], [0.45, 0.48], [-0.45, 1.12], [0, 1.12], [0.45, 1.12]]) windowAt(g, x, y, s.half + 0.005, 0, 0.18, 0.2);
    for (const side of [1, -1]) for (const [z, y] of [[-0.35, 0.5], [0.35, 0.5], [-0.35, 1.12], [0.35, 1.12]]) windowAt(g, side * (s.half + 0.005), y, z, side * Math.PI / 2, 0.18, 0.2);
    // awning
    const aw = rbox(g, '#ff9ec7', 0.5, 0.04, 0.2, 0, 0.5, s.half + 0.08, 0.02); aw.rotation.x = 0.3;
  },
  clocktower(g) {
    const s = BUILD_SPEC.clocktower;
    rbox(g, '#f5e3c4', s.half * 2, s.wallH, s.half * 2, 0, 0, 0, 0.04);
    rbox(g, '#e2c79c', s.half * 2 + 0.06, 0.08, s.half * 2 + 0.06, 0, 0, 0, 0.02);
    hipRoof(g, '#7fb069', s.half, s.wallH - 0.02, 0.5);
    for (let side = 0; side < 4; side++) {
      const grp = new THREE.Group(); grp.rotation.y = side * Math.PI / 2; g.add(grp);
      const face = add(grp, geo('clockface', () => new THREE.CylinderGeometry(0.17, 0.17, 0.03, 24)), mat('#ffffff'), 0, 1.15, s.half + 0.01);
      face.rotation.x = Math.PI / 2;
      const h1 = rbox(grp, '#333333', 0.02, 0.12, 0.01, 0, 1.15, s.half + 0.03, 0.005); h1.rotation.z = 0.6;
      rbox(grp, '#333333', 0.02, 0.09, 0.01, 0, 1.15, s.half + 0.035, 0.005);
    }
    door(g, 0, s.half + 0.005, 0, '#8a5a3c', 0.3);
  },
  windmill(g) {
    const s = BUILD_SPEC.windmill;
    rbox(g, '#fff6e6', s.half * 2, s.wallH, s.half * 2, 0, 0, 0, 0.05);
    hipRoof(g, '#b5651d', s.half, s.wallH - 0.02, 0.4);
    door(g, 0, s.half + 0.005, 0);
    windowAt(g, 0, 0.85, s.half + 0.005, 0, 0.12, 0.12);
    const hub = new THREE.Group(); hub.position.set(0, 1.12, s.half + 0.1); g.add(hub);
    ball(hub, '#8b5a2b', 0.06, 0, 0, 0);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; hub.add(arm);
      rbox(arm, '#c8a27a', 0.04, 0.5, 0.02, 0, 0.02, 0, 0.01);
      rbox(arm, '#ffffff', 0.14, 0.36, 0.015, 0.08, 0.15, 0.01, 0.01);
    }
    hub.userData.spin = 1.2;
  },
  teahouse(g) {
    const s = BUILD_SPEC.teahouse;
    rbox(g, '#d9b382', s.half * 2 + 0.1, 0.08, s.half * 2 + 0.1, 0, 0, 0, 0.02);
    rbox(g, '#fff9ee', s.half * 2, s.wallH, s.half * 2, 0, 0.06, 0, 0.03);
    for (const x of [-s.half, s.half]) for (const z of [-s.half, s.half]) rbox(g, '#8b4a2b', 0.07, s.wallH + 0.06, 0.07, x, 0, z, 0.02);
    const roof = add(g, geo('tearoof', () => new THREE.ConeGeometry(1.35, 0.45, 4)), mat('#4a5a6a'), 0, s.wallH + 0.25, 0);
    roof.rotation.y = Math.PI / 4;
    rbox(g, '#4a5a6a', 1.75, 0.06, 1.75, 0, s.wallH + 0.04, 0, 0.03);
    door(g, 0, s.half + 0.005, 0, '#e8d2a8', 0.36);
    windowAt(g, -0.45, 0.4, s.half + 0.005, 0, 0.22, 0.18);
    windowAt(g, 0.45, 0.4, s.half + 0.005, 0, 0.22, 0.18);
    const lantern = ball(g, '#ff6b6b', 0.07, 0.72, 0.42, 0.85, 1, 1.3, 1);
    lantern.material = mat('#ff6b6b', { emissive: '#ff4040', emissiveIntensity: 0.4 });
  },
  greenhouse(g) {
    rbox(g, '#e8e0d0', 1.7, 0.1, 1.7, 0, 0, 0, 0.03);
    const glass = mat('#bfe9ff', { transparent: true, opacity: 0.45, roughness: 0.1 });
    const body = add(g, geo('ghbody', () => new RoundedBoxGeometry(1.6, 0.5, 1.6, 2, 0.04)), glass, 0, 0.35, 0);
    body.castShadow = false;
    const roof = add(g, geo('ghroof', () => { const gg = new THREE.CylinderGeometry(0.8, 0.8, 1.6, 16, 1, false, 0, Math.PI); gg.rotateZ(Math.PI / 2); gg.rotateY(Math.PI / 2); return gg; }), glass, 0, 0.6, 0);
    roof.rotation.y = Math.PI / 2; roof.scale.set(1, 0.6, 1); roof.castShadow = false;
    for (const x of [-0.8, 0, 0.8]) for (const z of [-0.8, 0.8]) rbox(g, '#ffffff', 0.04, 0.6, 0.04, x, 0.05, z, 0.01);
    for (let i = 0; i < 6; i++) { ball(g, i % 2 ? C.red : C.yellow, 0.06, -0.5 + i * 0.2, 0.2, 0, 1, 1.2, 1); cyl(g, C.leafDark, 0.01, 0.01, 0.12, -0.5 + i * 0.2, 0.08, 0, 4); }
    rbox(g, '#a0522d', 1.2, 0.1, 0.3, 0, 0.1, 0, 0.03);
  },
  beehive(g) {
    for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) cyl(g, '#8b5a2b', 0.025, 0.025, 0.18, x, 0, z, 6);
    rbox(g, '#c58b4a', 0.5, 0.06, 0.5, 0, 0.18, 0, 0.02);
    for (let i = 0; i < 3; i++) rbox(g, i % 2 ? '#ffd45e' : '#ffc23a', 0.42 - i * 0.04, 0.14, 0.38 - i * 0.04, 0, 0.24 + i * 0.14, 0, 0.03);
    rbox(g, '#e0a030', 0.48, 0.05, 0.44, 0, 0.66, 0, 0.02);
    rbox(g, '#5a3a1e', 0.1, 0.03, 0.02, 0, 0.28, 0.19, 0.01);
    for (let i = 0; i < 3; i++) {
      const bee = new THREE.Group(); g.add(bee);
      ball(bee, '#ffd000', 0.035, 0, 0, 0, 1.3, 1, 1, 8); ball(bee, '#333333', 0.02, 0.03, 0, 0, 1, 1, 1, 6);
      const w = ball(bee, '#ffffff', 0.025, 0, 0.03, 0, 1, 0.3, 1.5, 6); w.material = mat('#ffffff', { transparent: true, opacity: 0.8 });
      bee.userData.orbit = { r: 0.35 + i * 0.07, speed: 1.5 + i * 0.4, phase: i * 2, y: 0.55 + i * 0.08 };
    }
  },
  well(g) {
    const ring = add(g, geo('wellring', () => new THREE.CylinderGeometry(0.3, 0.32, 0.3, 16, 1, true)), mat('#b9b4ae', { side: THREE.DoubleSide, flatShading: true }), 0, 0.15, 0);
    ring.castShadow = true;
    add(g, geo('wellrim', () => new THREE.TorusGeometry(0.3, 0.045, 8, 20)), mat('#d6d1ca'), 0, 0.3, 0).rotation.x = Math.PI / 2;
    const w = add(g, geo('wellwater', () => new THREE.CircleGeometry(0.28, 20)), mat('#58b8ff', { roughness: 0.2 }), 0, 0.2, 0);
    w.rotation.x = -Math.PI / 2;
    for (const x of [-0.28, 0.28]) rbox(g, '#9a6a46', 0.05, 0.62, 0.05, x, 0.25, 0, 0.01);
    const roof = add(g, geo('wellroof', () => new THREE.ConeGeometry(0.46, 0.25, 4)), mat('#ff8a7a'), 0, 0.98, 0);
    roof.rotation.y = Math.PI / 4;
    cyl(g, '#8b5a2b', 0.02, 0.02, 0.56, 0, 0.75, 0).rotation.z = Math.PI / 2;
    rbox(g, '#b5651d', 0.1, 0.1, 0.1, 0.08, 0.55, 0, 0.02);
  },
  fountain(g) {
    const basin = add(g, geo('fbasin', () => new THREE.CylinderGeometry(0.8, 0.85, 0.22, 24)), mat('#dcd6f0'), 0, 0.11, 0);
    const w = add(g, geo('fwater', () => new THREE.CylinderGeometry(0.7, 0.7, 0.02, 24)), mat('#6cc6ff', { roughness: 0.15, transparent: true, opacity: 0.9 }), 0, 0.22, 0);
    w.receiveShadow = true;
    cyl(g, '#e9e4f7', 0.1, 0.14, 0.45, 0, 0.2, 0, 12);
    cyl(g, '#dcd6f0', 0.35, 0.28, 0.07, 0, 0.6, 0, 18);
    add(g, geo('fw2', () => new THREE.CylinderGeometry(0.3, 0.3, 0.02, 18)), mat('#6cc6ff', { roughness: 0.15 }), 0, 0.67, 0);
    const jet = ball(g, '#bfe9ff', 0.08, 0, 0.82, 0, 0.6, 1.8, 0.6);
    jet.material = mat('#bfe9ff', { transparent: true, opacity: 0.8, roughness: 0.1 });
    jet.userData.bob = 1;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const d = ball(g, '#bfe9ff', 0.03, Math.cos(a) * 0.32, 0.6, Math.sin(a) * 0.32); d.material = jet.material; d.userData.drip = { a, phase: i / 6 }; }
  },
  pond(g) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2; const rx = Math.cos(a) * 0.86; const rz = Math.sin(a) * 0.86;
      const s = ball(g, i % 3 ? '#b8b2a8' : '#cfc9bf', 0.11, Math.max(-0.88, Math.min(0.88, rx * 1.08)), 0.02, Math.max(-0.88, Math.min(0.88, rz * 1.08)), 1.2, 0.6, 1, 8);
      s.material = mat(i % 3 ? '#b8b2a8' : '#cfc9bf', { flatShading: true });
    }
    const w = add(g, geo('pondwater', () => new RoundedBoxGeometry(1.8, 0.1, 1.8, 3, 0.05)), mat('#4fb3ff', { roughness: 0.12, transparent: true, opacity: 0.88 }), 0, -0.13, 0);
    w.castShadow = false;
  },
  watertower(g) {
    for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) { const l = cyl(g, '#a3a9b5', 0.03, 0.04, 1.1, x, 0, z, 6); l.rotation.x = 0; }
    rbox(g, '#c0c6d1', 0.56, 0.04, 0.04, 0, 0.5, 0.25, 0.01);
    rbox(g, '#c0c6d1', 0.56, 0.04, 0.04, 0, 0.5, -0.25, 0.01);
    cyl(g, '#7cc8ff', 0.36, 0.36, 0.5, 0, 1.05, 0, 18);
    add(g, geo('wtcap', () => new THREE.ConeGeometry(0.4, 0.3, 18)), mat('#5aa9e6'), 0, 1.7, 0);
    for (let i = 0; i < 3; i++) add(g, geo('wtband', () => new THREE.TorusGeometry(0.365, 0.015, 6, 24)), mat('#5aa9e6'), 0, 1.12 + i * 0.16, 0).rotation.x = Math.PI / 2;
    const d = ball(g, '#ffffff', 0.09, 0, 1.3, 0.37, 0.8, 1.1, 0.25);
    d.material = mat('#ffffff');
  },
  bridge(g) {
    const arch = add(g, geo('bridgeArch', () => { const gg = new THREE.CylinderGeometry(1.1, 1.1, 0.7, 24, 1, false, -0.42, 0.84); gg.rotateZ(Math.PI / 2); gg.rotateY(Math.PI / 2); return gg; }), mat('#c8915b'), 0, -0.98, 0);
    arch.rotation.y = Math.PI / 2;
    for (const z of [-0.33, 0.33]) {
      for (const x of [-0.42, 0, 0.42]) rbox(g, '#9a6a46', 0.05, 0.2, 0.05, x, 0.1 - Math.abs(x) * 0.1, z, 0.01);
      const rail = rbox(g, '#9a6a46', 0.95, 0.04, 0.04, 0, 0.28, z, 0.01); rail.rotation.z = 0;
    }
  },
  lamp(g) {
    cyl(g, '#4a4a5a', 0.07, 0.09, 0.05, 0, 0, 0, 10);
    cyl(g, '#5a5a6a', 0.025, 0.03, 0.6, 0, 0, 0, 8);
    const bulb = ball(g, '#fff3b0', 0.08, 0, 0.68, 0);
    bulb.material = mat('#fff3b0', { emissive: '#ffd34d', emissiveIntensity: 0.9 });
    cone(g, '#4a4a5a', 0.11, 0.08, 0, 0.74, 0, 8);
  },
  bench(g) {
    rbox(g, '#c8915b', 0.6, 0.05, 0.22, 0, 0.18, 0, 0.02);
    rbox(g, '#c8915b', 0.6, 0.16, 0.04, 0, 0.26, -0.1, 0.02);
    for (const x of [-0.25, 0.25]) for (const z of [-0.08, 0.08]) rbox(g, '#4a4a5a', 0.04, 0.18, 0.04, x, 0, z, 0.01);
  },
  mailbox(g) {
    cyl(g, '#8b5a2b', 0.03, 0.03, 0.3, 0, 0, 0, 6);
    rbox(g, '#ff6b6b', 0.18, 0.18, 0.26, 0, 0.3, 0, 0.07);
    rbox(g, '#ffd84d', 0.02, 0.12, 0.04, 0.1, 0.42, -0.05, 0.01);
  },
};

export function buildBuilding(defId) {
  const g = new THREE.Group();
  (BB[defId] || BB.cottage)(g);
  return g;
}

/* ---------------------------------------------------------- markers */
export function warnSprite(urgent) {
  const key = 'warn' + urgent;
  if (!texCache.has(key)) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const x = cv.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.15)'; x.beginPath(); x.ellipse(64, 70, 46, 46, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = urgent ? '#ff2d4b' : '#ff5a5a'; x.beginPath(); x.arc(64, 62, 46, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#ffffff'; x.lineWidth = 8; x.stroke();
    x.fillStyle = '#ffffff'; x.font = 'bold 72px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(urgent ? '!!' : '!', 64, 66);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texCache.get(key), depthTest: false, transparent: true }));
  s.renderOrder = 10;
  s.scale.set(0.38, 0.38, 1);
  return s;
}

export { WATER_PLANTS };
