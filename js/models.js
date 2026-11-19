// Procedural "cute clay" 3D models for plants and buildings.
import * as THREE from '../vendor/three.module.min.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { PLANT_MAP } from './data.js';

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
const isAquatic = (id) => { const sp = PLANT_MAP[id]; return !!sp && (sp.habitat.includes('water') || sp.habitat.includes('pond')); };
const SPROUT_TINT = { cactus: '#5fbf7a', barrel: '#5fbf7a', agave: '#7fb3a8', bromeliad: '#5c9e5a', sponge: '#ffcf3f', braincoral: '#e8b86b', staghorn: '#d98c5f', anemone: '#ff9f6b', tablecoral: '#a8c97a', clam: '#7fb6d9', tubeworm: '#f2efe6', seafan: '#b05cc8', kelp: '#a39a32', seagrass: '#5fbf6a' };

// Build a ground plant model. info = {species, stage, leaves, perfectDays, seed, dead}
export function buildPlant(info) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const stage = STAGE_INDEX[info.stage] ?? 1;
  const c = { stage, leaves: info.leaves ?? 3, rnd: rng(info.seed ?? info.species) };
  if (stage === 0 && !info.dead && !isAquatic(info.species)) sprout(inner, SPROUT_TINT[info.species] || C.leaf);
  else (PB[info.species] || PB.clover)(inner, c);
  const base = (PLANT_MAP[info.species]?.size || 1) === 2 ? 1.1 : 1.3; // chunky, readable on phones
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
  const PALETTE = {
    grape: ['#6cbf5a', '#4f9e48'], morningglory: ['#79d16b', '#55b05a'],
    monstera: ['#2f8f4e', '#3fa35a', '#277a42'], orchid: ['#5aa86a', '#4c9a5c'],
    seagrape: ['#6fd18a', '#4fb070', '#8fe0a0'], coralline: ['#f29bb8', '#e982a6', '#ffb3c9'],
  };
  const green = dead ? ['#9b8358', '#7d6844'] : PALETTE[species] || ['#4fae5a', '#3d8f4a', '#6fcf6a'];
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
    if (species === 'monstera') { // big leaf with holes
      x.ellipse(lx, ly, s * 1.7, s * 1.35, r() * 3, 0, Math.PI * 2); x.fill();
      x.save(); x.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 3; k++) { x.beginPath(); x.ellipse(lx + (k - 1) * s * 0.7, ly + (r() - 0.5) * s, s * 0.22, s * 0.38, 0.4, 0, Math.PI * 2); x.fill(); }
      x.restore(); continue;
    }
    if (species === 'coralline') { x.ellipse(lx, ly, s * 1.3, s * 1.1, r() * 3, 0, Math.PI * 2); x.fill(); continue; }
    if (species === 'seagrape') { for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(lx + (k % 2) * 6 - 3, ly + k * 4, 4.5, 0, Math.PI * 2); x.fill(); } continue; }
    if (species === 'ivy') { // pointed ivy leaf
      x.moveTo(lx, ly - s); x.lineTo(lx + s, ly); x.lineTo(lx + s * 0.4, ly + s * 0.3); x.lineTo(lx, ly + s); x.lineTo(lx - s * 0.4, ly + s * 0.3); x.lineTo(lx - s, ly); x.closePath();
    } else { x.ellipse(lx, ly, s, s * 0.8, r() * 3, 0, Math.PI * 2); }
    x.fill();
  }
  if (!dead && st >= 3 && species === 'orchid') {
    for (let i = 0; i < 5 * hUnits; i++) {
      const pts = stems[i % vines]; const [px, py] = pts[Math.floor(r() * pts.length)];
      const fx = px + (r() - 0.5) * 22;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        x.fillStyle = k % 2 ? '#e58bd8' : '#c56bd1';
        x.beginPath(); x.ellipse(fx + Math.cos(a) * 6, py + Math.sin(a) * 6, 6, 3.5, a, 0, Math.PI * 2); x.fill();
      }
      x.fillStyle = '#ffe066'; x.beginPath(); x.arc(fx, py, 3, 0, Math.PI * 2); x.fill();
    }
  }
  if (!dead && st >= 4 && species === 'seagrape') {
    for (let i = 0; i < 6 * hUnits; i++) {
      const pts = stems[i % vines]; const [px, py] = pts[Math.floor(r() * pts.length)];
      for (let k = 0; k < 6; k++) { x.fillStyle = k % 2 ? '#b8f5c4' : '#d6ffde'; x.beginPath(); x.arc(px + (k % 3 - 1) * 6, py + Math.floor(k / 3) * 6, 3.6, 0, Math.PI * 2); x.fill(); }
    }
  }
  if (!dead && species === 'coralline' && st >= 2) {
    for (let i = 0; i < 10 * hUnits; i++) { x.fillStyle = 'rgba(255,255,255,0.45)'; x.beginPath(); x.arc(r() * W, H - r() * H * cover, 2.5, 0, Math.PI * 2); x.fill(); }
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
  maizehut: { half: 0.34, wallH: 0.5 },
  pyramid: { half: 0.85, wallH: 0.42 },
  shellhouse: { half: 0.33, wallH: 0.45 },
  atlantistemple: { half: 0.58, wallH: 1.0 },
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
  return grp;
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

/* ================================================================ realm plants */
const glow = (color, emissive, k = 0.6) => mat(color, { emissive, emissiveIntensity: k });
const sway = (o, amp = 0.12, speed = 1.2, phase = 0) => { o.userData.sway = { amp, speed, phase }; return o; };

Object.assign(PB, {
  // ------------------------------------------------ rainforest
  giantlily(g, c) {
    const n = Math.min(1 + Math.floor(c.leaves / 4), 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + c.rnd(); const r = i ? 0.17 : 0; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      const rad = 0.2 + c.rnd() * 0.05;
      add(g, geo('glpad' + rad.toFixed(2), () => new THREE.CylinderGeometry(rad, rad, 0.02, 24)), mat('#4f9e3f'), x, 0.01, z);
      add(g, geo('glrim' + rad.toFixed(2), () => new THREE.TorusGeometry(rad, 0.02, 6, 28)), mat('#a8463a'), x, 0.03, z).rotation.x = Math.PI / 2;
    }
    if (c.stage >= 3) flower(g, '#ffffff', C.yellow, 0.08, 0.05, 0.05, 1.2);
    else if (c.stage >= 2) ball(g, '#f6f0e6', 0.05, 0.08, 0.06, 0.05, 1, 1.4, 1);
  },
  hyacinth(g, c) {
    const n = Math.min(4 + Math.floor(c.leaves / 2), 9);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ball(g, '#9bd86b', 0.035, Math.cos(a) * 0.07, 0.03, Math.sin(a) * 0.07, 1, 1.2, 1, 8);
      const l = ball(g, i % 2 ? '#4caf50' : '#5cc160', 0.07, Math.cos(a) * 0.13, 0.08, Math.sin(a) * 0.13, 1, 0.35, 0.9, 10);
      l.rotation.y = -a; l.rotation.z = 0.6;
    }
    if (c.stage >= 3) {
      cyl(g, '#6fbf5a', 0.012, 0.014, 0.2, 0, 0.05, 0, 6);
      for (let k = 0; k < 6; k++) { const a = k * 2.3; ball(g, k % 2 ? '#b9a3ff' : '#cbb8ff', 0.035, Math.cos(a) * 0.035, 0.18 + k * 0.025, Math.sin(a) * 0.035, 1, 0.8, 1, 8); }
    }
  },
  heliconia(g, c) {
    const n = Math.min(3 + Math.floor(c.leaves / 3), 6);
    for (let i = 0; i < n; i++) leaf(g, i % 2 ? C.leaf : C.leafDark, 0.42, 0.11, 0, 0.02, 0, (i / n) * Math.PI * 2, -1.15);
    if (c.stage >= 3) {
      cyl(g, C.leafDark, 0.015, 0.018, 0.48, 0.04, 0, 0, 6);
      for (let k = 0; k < 6; k++) {
        const side = k % 2 ? 1 : -1;
        const b = cone(g, '#ff4d3d', 0.035, 0.14, 0.04 + side * 0.06, 0.2 + k * 0.045, 0, 8);
        b.rotation.z = -side * 1.2;
        ball(g, C.yellow, 0.018, 0.04 + side * 0.12, 0.25 + k * 0.045, 0, 1, 1, 1, 6);
      }
    }
  },
  treefern(g, c) {
    cyl(g, '#6b4a32', 0.045, 0.06, 0.45, 0, 0, 0, 8);
    const n = Math.min(5 + Math.floor(c.leaves / 2), 11);
    for (let i = 0; i < n; i++) leaf(g, i % 2 ? '#4caf50' : '#3f9a48', 0.38, 0.075, 0, 0.45, 0, (i / n) * Math.PI * 2 + c.rnd() * 0.3, i % 3 ? 0.2 : -0.35);
    ball(g, '#7cc56b', 0.03, 0, 0.5, 0, 1, 1, 1, 6);
  },
  banana(g, c) {
    cyl(g, '#8bbf5a', 0.05, 0.07, 0.38, 0, 0, 0, 10);
    const n = Math.min(3 + Math.floor(c.leaves / 3), 7);
    for (let i = 0; i < n; i++) leaf(g, i % 2 ? '#6fcf6a' : '#5cbf5a', 0.46, 0.16, 0, 0.36, 0, (i / n) * Math.PI * 2, -0.15 + (i % 2) * 0.25);
    if (c.stage >= 4) {
      for (let k = 0; k < 7; k++) { const a = k * 0.9; const b = add(g, geo('banana', () => new THREE.CapsuleGeometry(0.018, 0.08, 4, 8)), mat('#ffd84d'), 0.1 + Math.cos(a) * 0.03, 0.26 - (k % 3) * 0.03, Math.sin(a) * 0.03); b.rotation.z = 0.5; }
      ball(g, '#7a2a5a', 0.035, 0.12, 0.14, 0, 0.8, 1.3, 0.8, 8);
    }
  },
  maize(g, c) {
    const n = Math.min(1 + Math.floor(c.leaves / 3), 4);
    for (let i = 0; i < n; i++) {
      const a = c.rnd() * Math.PI * 2; const r = i ? 0.15 : 0; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      const h = 0.5 + c.rnd() * 0.1;
      cyl(g, '#7cbf4a', 0.014, 0.018, h, x, 0, z, 6);
      for (let k = 0; k < 3; k++) leaf(g, '#7cc95a', 0.24, 0.04, x, 0.12 + k * 0.13, z, a + k * 2.1, -0.25);
      if (c.stage >= 3) for (let k = 0; k < 3; k++) { const t = cone(g, '#e8c36a', 0.008, 0.1, x, h - 0.02, z, 4); t.rotation.z = (k - 1) * 0.4; }
      if (c.stage >= 4) {
        const cob = add(g, geo('cob', () => new THREE.CapsuleGeometry(0.03, 0.08, 4, 10)), mat('#ffcc33'), x + 0.04, 0.3, z);
        cob.rotation.z = -0.35;
        leaf(g, '#a8d06a', 0.1, 0.04, x + 0.02, 0.24, z, Math.PI / 2, -0.9);
      }
    }
  },
  cacao(g, c) {
    cyl(g, '#7a5236', 0.04, 0.06, 0.4, 0, 0, 0, 8);
    const n = Math.min(2 + Math.floor(c.leaves / 3), 6);
    ball(g, '#3f8f4a', 0.24, 0, 0.55, 0);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; ball(g, i % 2 ? '#357d40' : '#4c9f55', 0.15, Math.cos(a) * 0.18, 0.5 + c.rnd() * 0.12, Math.sin(a) * 0.18); }
    if (c.stage === 3) for (let i = 0; i < 6; i++) { const a = i * 1.1; ball(g, '#ffc2d6', 0.015, Math.cos(a) * 0.05, 0.12 + i * 0.04, Math.sin(a) * 0.05, 1, 1, 1, 6); }
    if (c.stage >= 4) for (let i = 0; i < 4; i++) { const a = i * 1.6; ball(g, i % 2 ? '#e8892b' : '#c0392b', 0.04, Math.cos(a) * 0.07, 0.14 + i * 0.06, Math.sin(a) * 0.07, 0.7, 1.4, 0.7, 10); }
  },
  ceiba(g, c) {
    cyl(g, '#a69a82', 0.14, 0.3, 1.05, 0, 0, 0, 12);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const r = add(g, geo('buttress', () => new THREE.ConeGeometry(0.12, 0.45, 4)), mat('#958a73'), Math.cos(a) * 0.28, 0.2, Math.sin(a) * 0.28); r.scale.set(0.4, 1, 1.5); r.rotation.y = -a; }
    const n = Math.min(5 + Math.floor(c.leaves / 2), 11);
    ball(g, '#4f9e45', 0.6, 0, 1.25, 0, 1.2, 0.35, 1.2);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const r = 0.45 + c.rnd() * 0.2; ball(g, i % 2 ? '#5fae4e' : '#6fbf5a', 0.28, Math.cos(a) * r, 1.25 + c.rnd() * 0.15, Math.sin(a) * r, 1.2, 0.5, 1.2); }
    for (let i = 0; i < 3; i++) { const a = i * 2.1; const b = cyl(g, '#8a7a62', 0.03, 0.05, 0.4, Math.cos(a) * 0.2, 0.95, Math.sin(a) * 0.2, 6); b.rotation.z = (i - 1) * 0.6; }
    if (c.stage === 3) for (let i = 0; i < 14; i++) { const a = c.rnd() * 6.28; ball(g, '#ffd6e6', 0.035, Math.cos(a) * 0.7, 1.3 + c.rnd() * 0.15, Math.sin(a) * 0.7, 1, 1, 1, 6); }
    if (c.stage >= 4) for (let i = 0; i < 8; i++) { const a = c.rnd() * 6.28; ball(g, '#8a9a4a', 0.05, Math.cos(a) * 0.6, 1.08, Math.sin(a) * 0.6, 0.8, 1.4, 0.8, 8); ball(g, '#ffffff', 0.04, Math.cos(a) * 0.6, 1.0, Math.sin(a) * 0.6, 1, 0.8, 1, 6); }
  },
  bromeliad(g, c) {
    const n = Math.min(6 + Math.floor(c.leaves / 2), 12);
    for (let i = 0; i < n; i++) {
      const pivot = new THREE.Group(); pivot.rotation.y = (i / n) * Math.PI * 2; pivot.rotation.z = 0.5 + c.rnd() * 0.3; g.add(pivot);
      const m = cone(pivot, i % 2 ? '#5c9e5a' : '#6fb36a', 0.045, 0.28, 0, 0, 0, 6); m.scale.z = 0.4;
    }
    ball(g, '#ff7a90', 0.05, 0, 0.06, 0, 1, 0.6, 1, 8);
    if (c.stage >= 3) { cone(g, '#ff4d6d', 0.05, 0.26, 0, 0.05, 0, 6); for (let k = 0; k < 4; k++) ball(g, C.yellow, 0.015, Math.cos(k * 1.6) * 0.03, 0.14 + k * 0.03, Math.sin(k * 1.6) * 0.03, 1, 1, 1, 6); }
  },
  agave(g, c) {
    const n = Math.min(6 + Math.floor(c.leaves / 2), 12);
    for (let i = 0; i < n; i++) {
      const pivot = new THREE.Group(); pivot.rotation.y = (i / n) * Math.PI * 2 + c.rnd() * 0.2; pivot.rotation.z = 0.45 + c.rnd() * 0.35; g.add(pivot);
      const m = cone(pivot, i % 2 ? '#7fb3a8' : '#8fc4b8', 0.06, 0.36, 0, 0, 0, 6); m.scale.z = 0.45;
      cone(pivot, '#4a5a52', 0.012, 0.04, 0, 0.36, 0, 4);
    }
    if (c.stage >= 3) {
      cyl(g, '#8a9a5a', 0.015, 0.025, 0.85, 0, 0, 0, 6);
      for (let k = 0; k < 4; k++) { const a = k * 1.6; const y = 0.62 + k * 0.06; cyl(g, '#8a9a5a', 0.006, 0.006, 0.1, Math.cos(a) * 0.03, y, Math.sin(a) * 0.03, 4).rotation.z = 0.8; ball(g, '#ffd84d', 0.04, Math.cos(a) * 0.09, y + 0.06, Math.sin(a) * 0.09, 1, 0.7, 1, 8); }
    }
  },
  // ------------------------------------------------ undersea
  crinoid(g, c) {
    const lit = c.stage >= 3 ? 1.1 : 0.5;
    cyl(g, '#c9a7ff', 0.015, 0.025, 0.36, 0, 0, 0, 6);
    for (let k = 0; k < 4; k++) ball(g, '#b894f0', 0.02, 0, 0.06 + k * 0.08, 0, 1.4, 0.6, 1.4, 6);
    const n = Math.min(5 + Math.floor(c.leaves / 2), 10);
    for (let i = 0; i < n; i++) {
      const lf = leaf(g, '#9fe8ff', 0.24, 0.05, 0, 0.36, 0, (i / n) * Math.PI * 2, -0.6 + (i % 2) * 0.35);
      lf.children[0].material = glow('#9fe8ff', '#38bdf8', lit);
    }
    if (c.stage >= 3) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const b = ball(g, '#e0fbff', 0.025, Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2, 1, 1, 1, 6); b.material = glow('#e0fbff', '#7ae7ff', 1.4); }
  },
  tubeworm(g, c) {
    const n = Math.min(3 + Math.floor(c.leaves / 2), 9);
    for (let i = 0; i < n; i++) {
      const a = c.rnd() * Math.PI * 2; const r = Math.sqrt(c.rnd()) * 0.22; const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      const h = 0.18 + c.rnd() * 0.25;
      const t = cyl(g, '#f2efe6', 0.022, 0.03, h, x, 0, z, 8); t.rotation.z = (c.rnd() - 0.5) * 0.2;
      const plume = ball(g, '#e8283c', c.stage >= 3 ? 0.05 : 0.038, x, h + 0.03, z, 1, 1.4, 1, 8);
      if (c.stage >= 3) plume.material = glow('#ff3b4f', '#ff2040', 0.35);
    }
  },
  kelp(g, c) {
    const n = Math.min(2 + Math.floor(c.leaves / 3), 5);
    for (let i = 0; i < n; i++) {
      const stalk = sway(new THREE.Group(), 0.1, 0.9 + c.rnd() * 0.4, c.rnd() * 6);
      stalk.position.set((c.rnd() - 0.5) * 0.3, 0, (c.rnd() - 0.5) * 0.3); g.add(stalk);
      const segs = 5 + Math.floor(c.rnd() * 3);
      for (let k = 0; k < segs; k++) {
        cyl(stalk, '#8a7a2a', 0.012, 0.014, 0.16, Math.sin(k) * 0.02, k * 0.15, 0, 5);
        leaf(stalk, k % 2 ? '#a39a32' : '#8f9a2a', 0.2, 0.07, Math.sin(k) * 0.02, k * 0.15 + 0.08, 0, k * 2.2, -0.5);
        ball(stalk, '#c9b84a', 0.02, Math.sin(k) * 0.02 + 0.03, k * 0.15 + 0.08, 0, 1, 1.3, 1, 6);
      }
    }
  },
  seafan(g, c) {
    const n = Math.min(1 + Math.floor(c.leaves / 4), 3);
    for (let i = 0; i < n; i++) {
      const fan = sway(new THREE.Group(), 0.08, 0.8, i);
      fan.position.set((i - (n - 1) / 2) * 0.16, 0, (c.rnd() - 0.5) * 0.15); fan.rotation.y = c.rnd() * 0.8 - 0.4; g.add(fan);
      const r = 0.24 + c.rnd() * 0.08;
      add(fan, geo('fan' + r.toFixed(2), () => new THREE.CircleGeometry(r, 18, 0, Math.PI)), mat(i % 2 ? '#c06bd6' : '#a855c8', { side: THREE.DoubleSide }), 0, 0.05, 0);
      add(fan, geo('fan2' + r.toFixed(2), () => new THREE.CircleGeometry(r * 0.6, 14, 0, Math.PI)), mat('#e0a3f0', { side: THREE.DoubleSide }), 0, 0.05, 0.005);
      cyl(fan, '#7a3f8f', 0.015, 0.02, 0.06, 0, 0, 0, 6);
    }
  },
  braincoral(g, c) {
    const n = Math.min(1 + Math.floor(c.leaves / 4), 3);
    const cols = ['#e8b86b', '#d9a3c7', '#9fd48b'];
    for (let i = 0; i < n; i++) {
      const s = i ? 0.6 : 1; const a = i * 2.3; const r = i ? 0.2 : 0;
      const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      const b = add(g, geo('brain', () => new THREE.IcosahedronGeometry(1, 2)), mat(cols[i % 3], { flatShading: true }), x, 0.1 * s, z);
      b.scale.set(0.17 * s, 0.13 * s, 0.17 * s);
      for (let k = 0; k < 3; k++) { const t = add(g, geo('groove', () => new THREE.TorusGeometry(1, 0.08, 6, 20, Math.PI)), mat('#b07a4a'), x, 0.16 * s, z + (k - 1) * 0.05 * s); t.scale.setScalar(0.11 * s); t.rotation.y = Math.PI / 2 * (k % 2); }
    }
  },
  staghorn(g, c) {
    const col = c.rnd() < 0.5 ? '#d98c5f' : '#b38bd9';
    const n = Math.min(3 + Math.floor(c.leaves / 2), 8);
    for (let i = 0; i < n; i++) {
      const br = new THREE.Group(); br.rotation.y = (i / n) * Math.PI * 2; br.rotation.z = 0.25 + c.rnd() * 0.4; g.add(br);
      const h = 0.22 + c.rnd() * 0.12;
      cyl(br, col, 0.02, 0.03, h, 0, 0, 0, 6);
      const tw = new THREE.Group(); tw.position.y = h * 0.6; tw.rotation.z = -0.7; br.add(tw);
      cyl(tw, col, 0.015, 0.02, h * 0.6, 0, 0, 0, 6);
      for (const [o, yy] of [[br, h], [tw, h * 0.6]]) {
        const tip = ball(o, '#ffd1f0', 0.022, 0, yy, 0, 1, 1, 1, 6);
        if (c.stage >= 3) tip.material = glow('#ffd1f0', '#ff8fd0', 0.9);
      }
    }
  },
  anemone(g, c) {
    cyl(g, '#ff9f6b', 0.09, 0.11, 0.1, 0, 0, 0, 12);
    const n = Math.min(10 + c.leaves * 2, 28);
    const ring = sway(new THREE.Group(), 0.06, 1.6, c.rnd() * 6); ring.position.y = 0.1; g.add(ring);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; const r = 0.04 + (i % 3) * 0.025;
      const t = add(ring, geo('tent', () => new THREE.CapsuleGeometry(0.013, 0.1, 3, 6)), mat(i % 2 ? '#ffb38a' : '#ff8fb1'), Math.cos(a) * r, 0.06, Math.sin(a) * r);
      t.rotation.z = Math.cos(a) * -0.5; t.rotation.x = Math.sin(a) * 0.5;
    }
    if (c.stage >= 3) {
      const fish = new THREE.Group(); g.add(fish);
      ball(fish, '#ff8a1f', 0.04, 0, 0, 0, 1.5, 1, 0.7, 10);
      for (const dx of [-0.02, 0.03]) add(fish, geo('stripe', () => new THREE.TorusGeometry(0.036, 0.009, 4, 12)), mat('#ffffff'), dx, 0, 0).rotation.y = Math.PI / 2;
      cone(fish, '#ff8a1f', 0.03, 0.04, -0.075, -0.02, 0, 6).rotation.z = Math.PI / 2;
      fish.userData.orbit = { r: 0.2, speed: 1.4, phase: c.rnd() * 6, y: 0.25 };
    }
  },
  sponge(g, c) {
    const n = Math.min(2 + Math.floor(c.leaves / 3), 5);
    const cols = ['#ffcf3f', '#ff8a3d', '#b36bd6'];
    const col = cols[Math.floor(c.rnd() * 3)];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; const r = i ? 0.1 : 0; const h = 0.18 + c.rnd() * 0.18;
      const t = add(g, geo('sponge' + h.toFixed(2), () => new THREE.CylinderGeometry(0.06, 0.05, h, 12, 1, true)), mat(col, { side: THREE.DoubleSide, flatShading: true }), Math.cos(a) * r, h / 2, Math.sin(a) * r);
      t.rotation.z = (c.rnd() - 0.5) * 0.3;
      const hole = add(g, geo('spongeHole', () => new THREE.CircleGeometry(0.055, 12)), mat('#5a3a1e'), Math.cos(a) * r, h - 0.03, Math.sin(a) * r);
      hole.rotation.x = -Math.PI / 2;
    }
  },
  seagrass(g, c) {
    const n = Math.min(6 + c.leaves * 2, 26);
    const field = sway(new THREE.Group(), 0.1, 1.1, c.rnd() * 6); g.add(field);
    for (let i = 0; i < n; i++) {
      const a = c.rnd() * Math.PI * 2; const r = Math.sqrt(c.rnd()) * 0.35; const h = 0.18 + c.rnd() * 0.28;
      const b = add(field, geo('blade' + h.toFixed(2), () => new THREE.BoxGeometry(0.025, h, 0.006)), mat(i % 3 ? '#5fbf6a' : '#7cd67a'), Math.cos(a) * r, h / 2, Math.sin(a) * r);
      b.rotation.y = c.rnd() * 3; b.rotation.z = (c.rnd() - 0.5) * 0.4;
    }
  },
  clam(g, c) {
    const open = c.stage >= 2 ? 0.55 : 0.25;
    const shell = (rot) => {
      const h = new THREE.Group(); h.rotation.x = rot; g.add(h);
      const s = add(h, geo('clamshell', () => new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), mat('#9fb7d9', { flatShading: true }), 0, 0, 0);
      s.scale.set(1.2, 0.6, 0.9);
      return h;
    };
    const bottom = shell(Math.PI); bottom.position.y = 0.11;
    const top = shell(-open); top.position.set(0, 0.11, -0.1);
    add(g, geo('mantle', () => new THREE.CylinderGeometry(0.2, 0.2, 0.03, 18)), mat('#3fb6c8', { emissive: '#1a8fa0', emissiveIntensity: 0.3 }), 0, 0.11, 0).scale.set(1.2, 1, 0.85);
    if (c.stage >= 4) { const pearl = ball(g, '#fff6fb', 0.06, 0, 0.17, 0.02); pearl.material = glow('#fff6fb', '#ffd6f0', 0.5); }
  },
  tablecoral(g, c) {
    cyl(g, '#c9a26b', 0.1, 0.16, 0.38, 0, 0, 0, 10);
    const plates = Math.min(1 + Math.floor(c.leaves / 4), 3);
    for (let i = 0; i < plates; i++) {
      const r = 0.75 - i * 0.18; const y = 0.38 + i * 0.12;
      add(g, geo('plate' + r.toFixed(2), () => new THREE.CylinderGeometry(r, r * 0.85, 0.06, 24)), mat(i % 2 ? '#b8d48a' : '#a8c97a'), (i - 1) * 0.12, y, (i % 2) * 0.1);
      add(g, geo('plateRim' + r.toFixed(2), () => new THREE.TorusGeometry(r, 0.025, 6, 30)), mat('#d6e8a8'), (i - 1) * 0.12, y + 0.03, (i % 2) * 0.1).rotation.x = Math.PI / 2;
    }
    if (c.stage >= 3) for (let i = 0; i < 16; i++) { const a = c.rnd() * 6.28; const r = c.rnd() * 0.6; const d = ball(g, '#c6ffb3', 0.025, Math.cos(a) * r, 0.43, Math.sin(a) * r, 1, 1, 1, 6); d.material = glow('#c6ffb3', '#7dff9a', 0.8); }
  },
});

/* ================================================================ realm buildings */
Object.assign(BB, {
  // ------------------------------------------------ rainforest (Maya)
  maizehut(g) {
    const s = BUILD_SPEC.maizehut;
    rbox(g, '#f5ead2', s.half * 2, s.wallH, s.half * 2, 0, 0, 0, 0.08);
    rbox(g, '#d9c8a2', s.half * 2 + 0.04, 0.06, s.half * 2 + 0.04, 0, 0, 0, 0.02);
    const roof = add(g, geo('thatch', () => new THREE.ConeGeometry(0.56, 0.62, 4)), mat('#d4a64a', { flatShading: true }), 0, s.wallH + 0.27, 0);
    roof.rotation.y = Math.PI / 4;
    add(g, geo('thatch2', () => new THREE.ConeGeometry(0.2, 0.22, 4)), mat('#b88a35'), 0, s.wallH + 0.5, 0).rotation.y = Math.PI / 4;
    door(g, 0, s.half + 0.005, 0, '#5a3a22', 0.3);
  },
  pyramid(g) {
    const tiers = [[1.7, 0.42, '#d8cfb2'], [1.36, 0.36, '#cfc5a6'], [1.02, 0.34, '#c7bd9d'], [0.7, 0.3, '#bfb493']];
    let y = 0;
    for (const [w, h, col] of tiers) {
      rbox(g, col, w, h, w, 0, y, 0, 0.04);
      rbox(g, '#b3a885', 0.3, h, 0.08, 0, y, w / 2 + 0.02, 0.02); // front stairs
      y += h;
    }
    rbox(g, '#e0d7bb', 0.5, 0.32, 0.42, 0, y, 0, 0.03);
    rbox(g, '#3a2f25', 0.14, 0.2, 0.02, 0, y, 0.215, 0.01);
    rbox(g, '#cdbf98', 0.44, 0.2, 0.06, 0, y + 0.32, -0.05, 0.02);
    for (const [x, z] of [[-0.8, 0.8], [0.8, -0.8], [-0.6, -0.6]]) ball(g, '#6fa35a', 0.09, x, 0.42, z, 1.2, 0.5, 1.2, 8);
  },
  observatory(g) {
    rbox(g, '#d8cfb2', 0.9, 0.25, 0.9, 0, 0, 0, 0.04);
    rbox(g, '#b3a885', 0.26, 0.25, 0.1, 0, 0, 0.47, 0.02);
    cyl(g, '#e6dcc0', 0.3, 0.32, 0.62, 0, 0.25, 0, 20);
    add(g, geo('obsDome', () => new THREE.SphereGeometry(0.31, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mat('#d1c6a6'), 0, 0.87, 0);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; rbox(g, '#3a2f25', 0.06, 0.14, 0.02, Math.sin(a) * 0.3, 0.98, Math.cos(a) * 0.3, 0.01).rotation.y = a; }
    door(g, 0, 0.315, 0, '#3a2f25', 0.22).position.y = 0.25;
  },
  chacaltar(g) {
    rbox(g, '#bdb39a', 0.7, 0.15, 0.7, 0, 0, 0, 0.03);
    rbox(g, '#cfc5a6', 0.46, 0.34, 0.36, 0, 0.15, 0, 0.03);
    rbox(g, '#5fa8a0', 0.36, 0.24, 0.04, 0, 0.2, 0.19, 0.03); // jade rain-god mask
    for (const x of [-0.08, 0.08]) { ball(g, '#ffffff', 0.035, x, 0.36, 0.215, 1, 1, 0.5, 8); ball(g, '#1f3a36', 0.016, x, 0.36, 0.23, 1, 1, 0.5, 6); }
    add(g, geo('chacNose', () => new THREE.TorusGeometry(0.04, 0.014, 6, 12, Math.PI * 1.4)), mat('#4a8f88'), 0, 0.28, 0.22).rotation.z = Math.PI;
    cyl(g, '#8f8670', 0.12, 0.08, 0.06, 0, 0.49, 0, 14);
    add(g, geo('chacWater', () => new THREE.CircleGeometry(0.1, 14)), mat('#4fc3ff', { roughness: 0.1 }), 0, 0.556, 0).rotation.x = -Math.PI / 2;
    for (let i = 0; i < 3; i++) { const d = ball(g, '#7cc8ff', 0.025, (i - 1) * 0.1, 0.8, 0, 0.8, 1.3, 0.8, 8); d.userData.rise = { from: 0.95, to: 0.56, speed: 0.5, phase: i / 3, down: true }; }
  },
  cenote(g) {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2; const rx = Math.cos(a) * 0.86; const rz = Math.sin(a) * 0.86;
      ball(g, i % 3 ? '#d9d2bf' : '#c9c1a9', 0.12, Math.max(-0.86, Math.min(0.86, rx * 1.08)), 0.03, Math.max(-0.86, Math.min(0.86, rz * 1.08)), 1.2, 0.7, 1, 6).material = mat(i % 3 ? '#d9d2bf' : '#c9c1a9', { flatShading: true });
    }
    const w = add(g, geo('cenoteWater', () => new RoundedBoxGeometry(1.8, 0.1, 1.8, 3, 0.05)), mat('#27c0b8', { roughness: 0.1, transparent: true, opacity: 0.9, emissive: '#0f8f88', emissiveIntensity: 0.2 }), 0, -0.13, 0);
    w.castShadow = false;
    for (const [x, z] of [[-0.7, -0.3], [0.5, -0.75], [0.75, 0.4]]) for (let k = 0; k < 3; k++) cyl(g, '#4caf50', 0.008, 0.008, 0.18, x + k * 0.03, -0.12, z, 4);
  },
  stele(g) {
    rbox(g, '#b8ad8c', 0.42, 0.08, 0.26, 0, 0, 0, 0.02);
    rbox(g, '#c9bfa3', 0.32, 0.7, 0.14, 0, 0.08, 0, 0.04);
    for (let k = 0; k < 3; k++) rbox(g, '#9e937a', 0.2, 0.12, 0.02, 0, 0.18 + k * 0.18, 0.07, 0.02);
    ball(g, '#6fa35a', 0.05, 0.12, 0.72, 0.05, 1.3, 0.5, 1, 6);
  },
  ropebridge(g) {
    for (let i = 0; i < 7; i++) { const x = -0.42 + i * 0.14; rbox(g, i % 2 ? '#a87b4f' : '#94683f', 0.11, 0.03, 0.5, x, 0.12 - Math.cos((x / 0.5) * Math.PI / 2) * 0.08, 0, 0.01); }
    for (const z of [-0.26, 0.26]) {
      for (const x of [-0.46, 0.46]) cyl(g, '#7a5236', 0.025, 0.03, 0.4, x, 0, z, 6);
      for (let k = 0; k < 6; k++) { const x = -0.4 + k * 0.16; cyl(g, '#c9a26b', 0.008, 0.008, 0.17, x, 0.23 - Math.cos((x / 0.5) * Math.PI / 2) * 0.07, z, 4).rotation.z = Math.PI / 2; }
    }
  },
  torch(g) {
    cyl(g, '#7a5236', 0.03, 0.04, 0.48, 0, 0, 0, 8);
    cone(g, '#5a3a22', 0.08, 0.1, 0, 0.44, 0, 8).rotation.x = Math.PI;
    const f = ball(g, '#ffb020', 0.07, 0, 0.58, 0, 1, 1.5, 1); f.material = glow('#ffb020', '#ff7a00', 1.2); f.userData.flicker = { base: f.scale.clone() };
    ball(g, '#fff3b0', 0.035, 0, 0.56, 0, 1, 1.4, 1).material = glow('#fff3b0', '#ffd34d', 1.2);
  },
  // ------------------------------------------------ undersea (Atlantis)
  shellhouse(g) {
    const s = BUILD_SPEC.shellhouse;
    rbox(g, '#ffe4ec', s.half * 2, s.wallH, s.half * 2, 0, 0, 0, 0.1);
    for (let i = 0; i < 5; i++) {
      const r = 0.38 - i * 0.07;
      add(g, geo('shellRing' + i, () => new THREE.TorusGeometry(r, 0.06 - i * 0.008, 8, 20)), mat(i % 2 ? '#f7c6d9' : '#f3b3c9'), 0.02 * i, s.wallH + 0.04 + i * 0.09, 0).rotation.x = Math.PI / 2;
    }
    cone(g, '#f7c6d9', 0.06, 0.14, 0.1, s.wallH + 0.45, 0, 10);
    const d = add(g, geo('shellDoor', () => new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16)), mat('#c97a9a'), 0, 0.14, s.half + 0.01);
    d.rotation.x = Math.PI / 2;
    for (const side of [1, -1]) {
      add(g, geo('porthole', () => new THREE.TorusGeometry(0.06, 0.015, 6, 16)), mat('#f2c94c'), side * (s.half + 0.01), 0.3, 0).rotation.y = Math.PI / 2;
      add(g, geo('portGlass', () => new THREE.CircleGeometry(0.055, 14)), mat('#9fe8ff', { emissive: '#3aa9d9', emissiveIntensity: 0.4 }), side * (s.half + 0.012), 0.3, 0).rotation.y = side * Math.PI / 2;
    }
  },
  atlantistemple(g) {
    const s = BUILD_SPEC.atlantistemple;
    rbox(g, '#e8f1f7', 1.84, 0.14, 1.84, 0, 0, 0, 0.03);
    rbox(g, '#dce8f0', 0.6, 0.07, 0.15, 0, 0, 0.95, 0.02);
    rbox(g, '#f5fbff', s.half * 2, s.wallH, s.half * 2, 0, 0.14, 0, 0.04);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8; const x = Math.cos(a) * 0.82; const z = Math.sin(a) * 0.82;
      cyl(g, '#ffffff', 0.065, 0.075, s.wallH, x, 0.14, z, 12);
      rbox(g, '#f2c94c', 0.18, 0.05, 0.18, x, 0.14 + s.wallH - 0.02, z, 0.01);
    }
    rbox(g, '#e8f1f7', 1.84, 0.12, 1.84, 0, 0.14 + s.wallH, 0, 0.03);
    rbox(g, '#f2c94c', 1.86, 0.03, 1.86, 0, 0.14 + s.wallH + 0.12, 0, 0.01);
    const ped = add(g, geo('pediment', () => new THREE.CylinderGeometry(0.62, 0.62, 1.8, 3)), mat('#f5fbff'), 0, 0.14 + s.wallH + 0.34, 0);
    ped.rotation.z = Math.PI / 2; ped.rotation.y = Math.PI / 2; ped.scale.set(0.5, 1, 1);
    rbox(g, '#2a5f8f', 0.26, 0.42, 0.02, 0, 0.14, s.half + 0.01, 0.02);
    const orb = ball(g, '#bff6ff', 0.09, 0, 0.14 + s.wallH + 0.72, 0); orb.material = glow('#bff6ff', '#38d9ff', 1.2);
  },
  columns(g) {
    for (const [x, z, h] of [[-0.22, -0.18, 1.35], [0.22, -0.2, 0.95]]) {
      rbox(g, '#e8f1f7', 0.24, 0.07, 0.24, x, 0, z, 0.02);
      cyl(g, '#eef3f7', 0.075, 0.085, h, x, 0.07, z, 12);
      rbox(g, '#f2c94c', 0.22, 0.06, 0.22, x, 0.07 + h, z, 0.02);
    }
    const fallen = cyl(g, '#e3eaf0', 0.075, 0.075, 0.7, 0.05, 0.075, 0.22, 12);
    fallen.rotation.z = Math.PI / 2; fallen.position.y = 0.075;
    for (let i = 0; i < 4; i++) ball(g, '#cfd8df', 0.05, -0.3 + i * 0.18, 0.03, 0.4 - (i % 2) * 0.1, 1.2, 0.6, 1, 6);
    ball(g, '#6fd18a', 0.05, 0.22, 0.5, -0.12, 1.3, 0.5, 1, 6);
  },
  dome(g) {
    rbox(g, '#e8f1f7', 1.8, 0.1, 1.8, 0, 0, 0, 0.04);
    const glass = add(g, geo('domeGlass', () => new THREE.SphereGeometry(0.85, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), mat('#bfefff', { transparent: true, opacity: 0.35, roughness: 0.05 }), 0, 0.1, 0);
    glass.castShadow = false;
    for (let i = 0; i < 4; i++) add(g, geo('domeArc', () => new THREE.TorusGeometry(0.85, 0.018, 6, 24, Math.PI)), mat('#f2c94c'), 0, 0.1, 0).rotation.y = i * Math.PI / 4;
    for (let i = 0; i < 6; i++) { const a = i * 1.05; ball(g, ['#ff8fb1', '#ffd84d', '#9fd48b'][i % 3], 0.1, Math.cos(a) * 0.4, 0.16, Math.sin(a) * 0.4, 1, 0.8, 1, 10); }
    for (let k = 0; k < 5; k++) cyl(g, '#5fbf6a', 0.012, 0.012, 0.3, (k - 2) * 0.08, 0.1, 0, 4);
  },
  vent(g) {
    for (let i = 0; i < 4; i++) cyl(g, i % 2 ? '#4a4a52' : '#5a5a63', 0.22 - i * 0.04, 0.26 - i * 0.04, 0.14, 0, i * 0.14, 0, 10).material = mat(i % 2 ? '#4a4a52' : '#5a5a63', { flatShading: true });
    const hot = add(g, geo('ventGlow', () => new THREE.CircleGeometry(0.1, 12)), glow('#ff9a3d', '#ff6a00', 1.2), 0, 0.565, 0);
    hot.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 5; i++) { const b = ball(g, '#e6fbff', 0.035, 0, 0.6, 0, 1, 1, 1, 8); b.material = mat('#e6fbff', { transparent: true, opacity: 0.75 }); b.userData.rise = { from: 0.6, to: 1.6, speed: 0.45, phase: i / 5, wobble: 0.06 }; }
  },
  poseidon(g) {
    rbox(g, '#e8f1f7', 0.5, 0.4, 0.5, 0, 0, 0, 0.04);
    rbox(g, '#f2c94c', 0.52, 0.04, 0.52, 0, 0.36, 0, 0.01);
    add(g, geo('poseidonBody', () => new THREE.CapsuleGeometry(0.13, 0.36, 6, 12)), mat('#dfe9ef'), 0, 0.72, 0);
    ball(g, '#e8f0f5', 0.1, 0, 1.06, 0);
    cone(g, '#dfe9ef', 0.07, 0.14, 0, 0.88, 0.06, 8).rotation.x = Math.PI;
    for (let i = 0; i < 5; i++) cone(g, '#f2c94c', 0.02, 0.07, Math.cos(i * 0.6 + 1.6) * 0.08, 1.13, Math.sin(i * 0.6 + 1.6) * 0.06 - 0.02, 4);
    cyl(g, '#f2c94c', 0.014, 0.014, 1.0, 0.2, 0.42, 0, 6);
    for (const dx of [-0.05, 0, 0.05]) cone(g, '#f2c94c', 0.016, 0.1, 0.2 + dx, 1.42, 0, 4);
    rbox(g, '#f2c94c', 0.12, 0.02, 0.02, 0.2, 1.42, 0, 0.005);
  },
  treasure(g) {
    rbox(g, '#8b5a2b', 0.44, 0.24, 0.3, 0, 0, 0, 0.03);
    const lid = add(g, geo('chestLid', () => new THREE.CylinderGeometry(0.15, 0.15, 0.44, 12, 1, false, 0, Math.PI)), mat('#a0662f'), 0, 0.24, -0.05);
    lid.rotation.z = Math.PI / 2; lid.rotation.x = -0.5;
    for (const x of [-0.14, 0.14]) rbox(g, '#f2c94c', 0.04, 0.25, 0.31, x, 0, 0, 0.01);
    for (let i = 0; i < 6; i++) { const c = ball(g, '#ffd84d', 0.035, (i - 2.5) * 0.06, 0.26, 0.04 + (i % 2) * 0.04, 1, 0.35, 1, 8); c.material = glow('#ffd84d', '#ffb000', 0.3); }
  },
  pearllamp(g) {
    cyl(g, '#d9c9a8', 0.06, 0.08, 0.4, 0, 0, 0, 10);
    const sh = add(g, geo('lampShell', () => new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), mat('#f7c6d9', { side: THREE.DoubleSide }), 0, 0.42, 0);
    sh.rotation.x = Math.PI; sh.position.y = 0.48;
    const p = ball(g, '#fff6fb', 0.1, 0, 0.5, 0); p.material = glow('#fff6fb', '#ffd6f0', 1.0);
  },
  anchor(g) {
    cyl(g, '#5a6470', 0.03, 0.03, 0.62, 0, 0.05, 0, 8);
    add(g, geo('anchorRing', () => new THREE.TorusGeometry(0.07, 0.02, 6, 14)), mat('#5a6470'), 0, 0.72, 0);
    rbox(g, '#5a6470', 0.3, 0.04, 0.04, 0, 0.55, 0, 0.01);
    const arm = add(g, geo('anchorArm', () => new THREE.TorusGeometry(0.2, 0.025, 6, 16, Math.PI)), mat('#5a6470'), 0, 0.25, 0);
    arm.rotation.z = Math.PI;
    for (const x of [-0.2, 0.2]) cone(g, '#5a6470', 0.04, 0.08, x, 0.22, 0, 4);
    ball(g, '#6fd18a', 0.04, 0.05, 0.4, 0.03, 1.2, 0.5, 1, 6);
  },
});

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
