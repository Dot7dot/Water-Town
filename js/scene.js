// The 3D diorama city.
import * as THREE from '../vendor/three.module.min.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { GRID, PLANT_MAP, BUILDING_MAP } from './data.js';
import { buildPlant, buildBuilding, buildWallPlant, BUILD_SPEC, warnSprite, mat, WATER_PLANTS, STAGE_INDEX } from './models.js';
import { buildIndex, terrainAt, plantStage, plantStatus } from './game.js';

const WATER_Y = -0.08;
const H = GRID / 2;
export const cellCenter = (x, z, size = 1) => new THREE.Vector3(x + size / 2 - H, 0, z + size / 2 - H);

export function wallTransform(b, side, u) {
  const def = BUILDING_MAP[b.def];
  const spec = BUILD_SPEC[b.def] || { half: 0.4, wallH: 0.6 };
  const c = cellCenter(b.x, b.z, def.size);
  const segW = (spec.half * 2) / def.size;
  const along = -spec.half + (u + 0.5) * segW;
  const off = spec.half + 0.03;
  const pos = new THREE.Vector3(c.x, spec.wallH / 2 + 0.02, c.z);
  let ry = 0;
  if (side === 0) { pos.z += off; pos.x += along; ry = 0; }
  if (side === 1) { pos.x += off; pos.z += along; ry = Math.PI / 2; }
  if (side === 2) { pos.z -= off; pos.x += along; ry = Math.PI; }
  if (side === 3) { pos.x -= off; pos.z += along; ry = -Math.PI / 2; }
  return { pos, ry, w: segW * 0.96, h: spec.wallH * 0.96 };
}

function plantInfo(p) {
  return { species: p.species, stage: plantStage(p), leaves: p.leaves, perfectDays: p.perfectDays, seed: p.id, dead: p.dead };
}

export class CityScene {
  constructor(container, { onTap } = {}) {
    this.container = container;
    this.onTap = onTap;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this.scene = new THREE.Scene();
    this.scene.background = this.skyTexture();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.target = new THREE.Vector3(-0.5, 0, -0.5); // nudge the island below the HUD card
    this.theta = Math.PI / 4; this.thetaGoal = this.theta;
    this.zoom = 1; this.zoomGoal = 1;
    this.viewH = 11;

    const hemi = new THREE.HemisphereLight('#dff1ff', '#ffe6cc', 1.25);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff4e0', 1.9);
    sun.position.set(-6, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -9; sun.shadow.camera.right = 9; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.2));

    this.world = new THREE.Group(); this.scene.add(this.world);
    this.tiles = new THREE.Group(); this.world.add(this.tiles);
    this.objects = new THREE.Group(); this.world.add(this.objects);
    this.overlay = new THREE.Group(); this.world.add(this.overlay);
    this.fx = new THREE.Group(); this.world.add(this.fx);
    this.markers = new THREE.Group(); this.world.add(this.markers);
    this.clouds = new THREE.Group(); this.scene.add(this.clouds);

    this.nodes = new Map(); // id -> { obj, sig }
    this.tileMeshes = [];
    this.animated = [];
    this.particles = [];
    this.bounces = [];
    this.ghost = null;
    this.selection = null;
    this.clock = new THREE.Clock();

    this.buildIsland();
    this.buildClouds();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(container);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  skyTexture() {
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
    const x = cv.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#9fd8ff'); gr.addColorStop(0.55, '#d9f1ff'); gr.addColorStop(1, '#fff3e6');
    x.fillStyle = gr; x.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ------------------------------------------------------- island */
  buildIsland() {
    const tileGeo = new RoundedBoxGeometry(0.97, 0.3, 0.97, 2, 0.07);
    const bedGeo = new RoundedBoxGeometry(1, 0.2, 1, 1, 0.02);
    const waterGeo = new THREE.BoxGeometry(1.0, 0.1, 1.0);
    this.waterMat = new THREE.MeshStandardMaterial({ color: '#3fb0f0', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.93, emissive: '#1e7fc0', emissiveIntensity: 0.18 });
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        const t = terrainAt(x, z);
        const c = cellCenter(x, z);
        if (t === 'W') {
          const bed = new THREE.Mesh(bedGeo, mat('#4f9fd0'));
          bed.position.set(c.x, -0.42, c.z); bed.receiveShadow = true; this.tiles.add(bed);
          const w = new THREE.Mesh(waterGeo, this.waterMat);
          w.position.set(c.x, WATER_Y - 0.05, c.z); w.receiveShadow = true;
          w.userData = { kind: 'tile', x, z };
          this.tiles.add(w); this.tileMeshes.push(w);
        } else {
          const m = new THREE.Mesh(tileGeo, mat('#8fd16a'));
          m.position.set(c.x, -0.15, c.z);
          m.receiveShadow = true;
          m.userData = { kind: 'tile', x, z, terrain: t };
          this.tiles.add(m); this.tileMeshes.push(m);
        }
      }
    }
    // soil base of the floating island
    const base = new THREE.Mesh(new RoundedBoxGeometry(GRID + 0.2, 0.7, GRID + 0.2, 3, 0.25), mat('#c99566'));
    base.position.y = -0.62; base.receiveShadow = true; this.tiles.add(base);
    const base2 = new THREE.Mesh(new RoundedBoxGeometry(GRID - 0.6, 0.6, GRID - 0.6, 3, 0.25), mat('#a9764d'));
    base2.position.y = -1.15; this.tiles.add(base2);
    const base3 = new THREE.Mesh(new RoundedBoxGeometry(GRID - 2.4, 0.5, GRID - 2.4, 3, 0.22), mat('#8c6142'));
    base3.position.y = -1.55; this.tiles.add(base3);
    // little hanging rocks
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + i * 0.05, 0), mat('#9b6e4a', { flatShading: true }));
      r.position.set(-3 + i * 1.5, -1.9 - (i % 2) * 0.3, (i % 3) - 1); this.tiles.add(r);
    }
  }

  refreshTiles(state) {
    const idx = buildIndex(state);
    for (const m of this.tileMeshes) {
      const { x, z, terrain } = m.userData;
      if (!terrain) continue;
      const moist = idx.moist.has(`${x},${z}`);
      const alt = (x + z) % 2 === 0;
      let col;
      if (terrain === 'S') col = moist ? (alt ? '#e3c98e' : '#ddc285') : (alt ? '#f6dfaa' : '#f0d79c');
      else col = moist ? (alt ? '#6fc25f' : '#68ba58') : (alt ? '#93d56c' : '#88cc63');
      m.material = mat(col);
    }
  }

  buildClouds() {
    const cm = mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.45 });
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const n = 3 + (i % 3);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.5 + (k % 2) * 0.25, 14, 10), cm);
        s.position.set(k * 0.6 - n * 0.3, (k % 2) * 0.2, (k % 3) * 0.2);
        g.add(s);
      }
      g.userData = { a: (i / 5) * Math.PI * 2, r: 9 + (i % 2) * 2.5, y: -2.4 - (i % 3) * 0.7, speed: 0.02 + i * 0.004 };
      this.clouds.add(g);
    }
  }

  /* --------------------------------------------------------- sync */
  sync(state, now) {
    this.state = state;
    this.refreshTiles(state);
    const seen = new Set();
    const bById = new Map(state.buildings.map((b) => [b.id, b]));
    for (const b of state.buildings) {
      seen.add(b.id);
      const sig = `${b.def}|${b.x}|${b.z}|${b.rot || 0}`;
      const node = this.nodes.get(b.id);
      if (node && node.sig === sig) continue;
      if (node) this.objects.remove(node.obj);
      const obj = buildBuilding(b.def);
      const def = BUILDING_MAP[b.def];
      obj.position.copy(cellCenter(b.x, b.z, def.size));
      obj.rotation.y = (b.rot || 0) * Math.PI / 2;
      obj.userData = { kind: 'building', id: b.id };
      this.objects.add(obj);
      this.nodes.set(b.id, { obj, sig });
    }
    this.markers.clear();
    for (const p of state.plants) {
      if (p.stored) continue;
      seen.add(p.id);
      const sp = PLANT_MAP[p.species];
      const stage = plantStage(p);
      let sig = `${p.species}|${stage}|${Math.min(p.leaves, 14)}|${Math.min(p.perfectDays, 8)}|${p.dead}`;
      let pos; let ry = 0;
      if (p.wall) {
        const b = bById.get(p.wall.b);
        if (!b) continue;
        const tr = wallTransform(b, p.wall.side, p.wall.u);
        sig += `|w${b.x},${b.z},${p.wall.side},${p.wall.u}`;
        pos = tr.pos; ry = tr.ry;
        const node = this.nodes.get(p.id);
        if (!node || node.sig !== sig) {
          if (node) this.objects.remove(node.obj);
          const mesh = buildWallPlant(plantInfo(p), tr.w, tr.h);
          const obj = new THREE.Group(); obj.add(mesh);
          obj.position.copy(pos); obj.rotation.y = ry;
          obj.userData = { kind: 'plant', id: p.id };
          this.objects.add(obj);
          this.nodes.set(p.id, { obj, sig });
        }
      } else {
        pos = cellCenter(p.x, p.z, sp.size);
        if (WATER_PLANTS.has(p.species)) pos.y = WATER_Y;
        sig += `|${p.x},${p.z}`;
        const node = this.nodes.get(p.id);
        if (!node || node.sig !== sig) {
          if (node) this.objects.remove(node.obj);
          const obj = buildPlant(plantInfo(p));
          obj.position.copy(pos);
          obj.rotation.y = (parseInt(p.id.slice(1), 10) * 1.7) % (Math.PI * 2);
          obj.userData = { kind: 'plant', id: p.id };
          this.objects.add(obj);
          this.nodes.set(p.id, { obj, sig });
        }
      }
      const st = plantStatus(state, p, now);
      if (st.warn) {
        const s = warnSprite(st.urgent);
        const top = p.wall ? pos.clone().add(new THREE.Vector3(0, 0.45, 0)) : pos.clone().add(new THREE.Vector3(0, sp.size === 2 ? 1.8 : 0.95, 0));
        s.position.copy(top);
        s.userData = { base: top.y, urgent: st.urgent };
        this.markers.add(s);
      }
    }
    for (const [id, node] of this.nodes) {
      if (!seen.has(id)) { this.objects.remove(node.obj); this.nodes.delete(id); }
    }
    this.collectAnimated();
    if (this.selection) this.select(this.selection.id);
  }

  collectAnimated() {
    this.animated = [];
    this.objects.traverse((o) => {
      if (o.userData.spin || o.userData.orbit || o.userData.bob || o.userData.drip || o.userData.fall) this.animated.push(o);
    });
  }

  /* ------------------------------------------------------- camera */
  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.aspect = w / h;
    // fit the island on narrow phone screens
    this.viewH = this.aspect < 0.8 ? 15.5 / Math.max(this.aspect, 0.45) * 0.6 : 12;
    this.updateCamera();
  }

  updateCamera() {
    const halfH = this.viewH / 2 / this.zoom;
    const halfW = halfH * this.aspect;
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    this.camera.updateProjectionMatrix();
    const elev = 0.62; const dist = 40;
    this.camera.position.set(
      this.target.x + Math.sin(this.theta) * Math.cos(elev) * dist,
      this.target.y + Math.sin(elev) * dist,
      this.target.z + Math.cos(this.theta) * Math.cos(elev) * dist,
    );
    this.camera.lookAt(this.target);
  }

  rotateView(dir) { this.thetaGoal += dir * Math.PI / 2; }
  setZoom(z) { this.zoomGoal = Math.max(0.7, Math.min(3.2, z)); }

  bindInput() {
    const el = this.canvas;
    el.style.touchAction = 'none';
    const pts = new Map();
    let start = null; let pinch = null; let moved = false;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = false; }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoomGoal, ang: Math.atan2(b.y - a.y, b.x - a.x), theta: this.thetaGoal };
        moved = true;
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.setZoom(pinch.zoom * (d / pinch.d));
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        this.thetaGoal = pinch.theta - (ang - pinch.ang);
        return;
      }
      if (pts.size === 1 && start) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) moved = true;
        if (moved) this.pan(e.clientX - prev.x, e.clientY - prev.y);
      }
    });
    const end = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2 && pinch) {
        pinch = null;
        // snap rotation to the nearest quarter for a tidy isometric view
        this.thetaGoal = Math.round((this.thetaGoal - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
      }
      if (pts.size === 0 && start && !moved && performance.now() - start.t < 600 && e.type === 'pointerup') {
        const pick = this.pick(e.clientX, e.clientY);
        if (pick && this.onTap) this.onTap(pick);
      }
      if (pts.size === 0) start = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.setZoom(this.zoomGoal * (e.deltaY < 0 ? 1.1 : 0.9)); }, { passive: false });
  }

  pan(dx, dy) {
    const worldPerPx = (this.viewH / this.zoom) / this.canvas.clientHeight;
    const right = new THREE.Vector3(Math.cos(this.theta), 0, -Math.sin(this.theta));
    const fwd = new THREE.Vector3(-Math.sin(this.theta), 0, -Math.cos(this.theta));
    this.target.addScaledVector(right, -dx * worldPerPx);
    this.target.addScaledVector(fwd, dy * worldPerPx / Math.sin(0.62) * 0.9);
    this.target.x = Math.max(-H, Math.min(H, this.target.x));
    this.target.z = Math.max(-H, Math.min(H, this.target.z));
    this.updateCamera();
  }

  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects([...this.objects.children, ...this.tiles.children, ...this.overlay.children], true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.kind && o.parent) o = o.parent;
      if (!o || !o.userData.kind) continue;
      const cell = { x: Math.floor(h.point.x + H), z: Math.floor(h.point.z + H) };
      const res = { kind: o.userData.kind, id: o.userData.id, cell, point: h.point };
      if (o.userData.kind === 'tile') res.cell = { x: o.userData.x, z: o.userData.z };
      if (o.userData.kind === 'wallslot') { res.kind = 'wall'; res.wall = o.userData.wall; return res; }
      if (o.userData.kind === 'cellmark') { res.kind = 'tile'; res.mark = true; res.cell = { x: o.userData.x, z: o.userData.z }; return res; }
      if (o.userData.kind === 'ghost') continue;
      if (o.userData.kind === 'building' && h.face) {
        const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
        if (Math.abs(n.y) < 0.5) {
          const b = this.state.buildings.find((v) => v.id === o.userData.id);
          if (b) {
            const def = BUILDING_MAP[b.def];
            const side = Math.abs(n.x) > Math.abs(n.z) ? (n.x > 0 ? 1 : 3) : (n.z > 0 ? 0 : 2);
            const along = side === 0 || side === 2 ? h.point.x + H - b.x : h.point.z + H - b.z;
            res.wall = { b: b.id, side, u: Math.max(0, Math.min(def.size - 1, Math.floor(along))) };
          }
        }
      }
      return res;
    }
    return null;
  }

  /* --------------------------------------------- overlays & ghost */
  clearOverlay() {
    this.overlay.clear();
    if (this.ghost) { this.world.remove(this.ghost); this.ghost = null; }
  }

  spotTexture() {
    if (this._spotTex) return this._spotTex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d');
    const rr = (p, r) => { x.beginPath(); if (x.roundRect) x.roundRect(p, p, 128 - p * 2, 128 - p * 2, r); else x.rect(p, p, 128 - p * 2, 128 - p * 2); };
    rr(10, 22); x.fillStyle = 'rgba(255,255,255,0.55)'; x.fill();
    x.lineWidth = 12; x.strokeStyle = '#1ee07a'; x.stroke();
    rr(26, 12); x.fillStyle = 'rgba(30,224,122,0.25)'; x.fill();
    this._spotTex = new THREE.CanvasTexture(cv);
    this._spotTex.colorSpace = THREE.SRGBColorSpace;
    return this._spotTex;
  }

  showSpots(spots, size = 1) {
    this.overlay.clear();
    const g = new THREE.PlaneGeometry(0.94 * size + (size - 1) * 0.04, 0.94 * size + (size - 1) * 0.04);
    const m = new THREE.MeshBasicMaterial({ map: this.spotTexture(), transparent: true, depthWrite: false });
    this.spotMat = m;
    const wm = new THREE.MeshBasicMaterial({ map: this.spotTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    for (const s of spots) {
      if (s.wall) {
        const b = this.state.buildings.find((v) => v.id === s.wall.b);
        if (!b) continue;
        const tr = wallTransform(b, s.wall.side, s.wall.u);
        const p = new THREE.Mesh(new THREE.PlaneGeometry(tr.w * 0.9, tr.h * 0.9), wm);
        p.position.copy(tr.pos); p.rotation.y = tr.ry;
        p.position.add(new THREE.Vector3(Math.sin(tr.ry) * 0.02, 0, Math.cos(tr.ry) * 0.02));
        p.userData = { kind: 'wallslot', wall: s.wall };
        this.overlay.add(p);
      } else {
        const p = new THREE.Mesh(g, m);
        p.rotation.x = -Math.PI / 2;
        const c = cellCenter(s.x, s.z, size);
        const water = terrainAt(s.x, s.z) === 'W';
        p.position.set(c.x, (water ? WATER_Y : 0) + 0.03, c.z);
        p.userData = { kind: 'cellmark', x: s.x, z: s.z };
        p.renderOrder = 2;
        this.overlay.add(p);
      }
    }
  }

  // spec: {type:'building', def} | {type:'plant', plant} | {type:'seed'}
  setGhost(spec, spot, valid) {
    if (this.ghost) { this.world.remove(this.ghost); this.ghost = null; }
    if (!spec || !spot) return;
    let obj; let size = 1;
    if (spec.type === 'building') { obj = buildBuilding(spec.def); size = BUILDING_MAP[spec.def].size; obj.rotation.y = (spec.rot || 0) * Math.PI / 2; }
    else if (spec.type === 'plant') {
      const sp = PLANT_MAP[spec.plant.species]; size = sp.size;
      if (sp.kind === 'wall') obj = new THREE.Group();
      else obj = buildPlant(plantInfo(spec.plant));
    } else {
      obj = new THREE.Group();
      const bag = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat('#d9a066'));
      bag.position.y = 0.3; obj.add(bag);
    }
    obj.traverse((o) => {
      if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.6; o.castShadow = false; }
    });
    const g = new THREE.Group(); g.add(obj);
    if (spot.wall) {
      const b = this.state.buildings.find((v) => v.id === spot.wall.b);
      if (b) {
        const tr = wallTransform(b, spot.wall.side, spot.wall.u);
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(tr.w, tr.h), new THREE.MeshBasicMaterial({ color: valid ? '#3cf08a' : '#ff5a5a', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
        plane.position.copy(tr.pos).add(new THREE.Vector3(Math.sin(tr.ry) * 0.04, 0, Math.cos(tr.ry) * 0.04)); plane.rotation.y = tr.ry;
        g.add(plane);
      }
    } else {
      const c = cellCenter(spot.x, spot.z, size);
      obj.position.copy(c);
      if (spec.type === 'plant' && WATER_PLANTS.has(spec.plant.species)) obj.position.y = WATER_Y;
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(size - 0.06, size - 0.06), new THREE.MeshBasicMaterial({ color: valid ? '#3cf08a' : '#ff5a5a', transparent: true, opacity: 0.55, depthWrite: false }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(c.x, 0.04, c.z);
      g.add(pad);
    }
    g.userData = { kind: 'ghost' };
    this.ghost = g;
    this.world.add(g);
  }

  select(id) {
    if (this.selection) { this.world.remove(this.selection.ring); this.selection = null; }
    if (!id) return;
    const node = this.nodes.get(id);
    if (!node) return;
    const box = new THREE.Box3().setFromObject(node.obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.z) * 0.6 + 0.1;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffd84d' }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(center.x, Math.max(0.03, box.min.y + 0.03), center.z);
    this.world.add(ring);
    this.selection = { id, ring };
  }

  /* --------------------------------------------------------- FX */
  rain(intensity = 1) {
    const n = Math.round(50 * intensity);
    const g = new THREE.SphereGeometry(0.05, 8, 6);
    const m = new THREE.MeshStandardMaterial({ color: '#6cc6ff', transparent: true, opacity: 0.85, roughness: 0.1 });
    for (let i = 0; i < n; i++) {
      const d = new THREE.Mesh(g, m);
      d.scale.set(1, 2.2, 1);
      d.position.set((Math.random() - 0.5) * GRID, 4 + Math.random() * 5, (Math.random() - 0.5) * GRID);
      this.fx.add(d);
      this.particles.push({ obj: d, vy: -6 - Math.random() * 3, type: 'drop' });
    }
    // every plant does a happy bounce
    for (const [id, node] of this.nodes) {
      if (id.startsWith('p')) this.bounces.push({ obj: node.obj, t: -Math.random() * 0.6 });
    }
  }

  sparkle(id) {
    const node = this.nodes.get(id);
    if (!node) return;
    const c = new THREE.Box3().setFromObject(node.obj).getCenter(new THREE.Vector3());
    const g = new THREE.OctahedronGeometry(0.07);
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffe066' : '#ffffff', transparent: true }));
      s.position.copy(c);
      const a = Math.random() * Math.PI * 2;
      this.fx.add(s);
      this.particles.push({ obj: s, vx: Math.cos(a) * 1.2, vz: Math.sin(a) * 1.2, vy: 1.5 + Math.random() * 1.5, life: 1, type: 'spark' });
    }
    node.obj.scale.setScalar(0.01);
    this.bounces.push({ obj: node.obj, t: 0, grow: true });
  }

  splash(x, z) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.09, 16), new THREE.MeshBasicMaterial({ color: '#bfe9ff', transparent: true, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.03, z);
    this.fx.add(ring);
    this.particles.push({ obj: ring, life: 0.5, type: 'ring' });
  }

  /* --------------------------------------------------------- loop */
  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    // smooth camera
    let changed = false;
    if (Math.abs(this.thetaGoal - this.theta) > 0.0005) { this.theta += (this.thetaGoal - this.theta) * Math.min(1, dt * 8); changed = true; }
    if (Math.abs(this.zoomGoal - this.zoom) > 0.0005) { this.zoom += (this.zoomGoal - this.zoom) * Math.min(1, dt * 10); changed = true; }
    if (changed) this.updateCamera();

    this.waterMat.emissiveIntensity = 0.16 + Math.sin(t * 1.5) * 0.05;
    for (const o of this.animated) {
      const u = o.userData;
      if (u.spin) o.rotation.z += dt * u.spin;
      if (u.orbit) { const a = t * u.orbit.speed + u.orbit.phase; o.position.set(Math.cos(a) * u.orbit.r, u.orbit.y + Math.sin(t * 6 + u.orbit.phase) * 0.04, Math.sin(a) * u.orbit.r); o.rotation.y = -a; }
      if (u.bob) o.scale.y = 1.8 * 0.08 * (1 + Math.sin(t * 6) * 0.15);
      if (u.drip) { const k = (t * 0.8 + u.drip.phase) % 1; o.position.set(Math.cos(u.drip.a) * (0.32 + k * 0.25), 0.62 - k * k * 0.45, Math.sin(u.drip.a) * (0.32 + k * 0.25)); }
      if (u.fall) { o.position.y -= dt * u.fall; if (o.position.y < 0.02) o.position.y = 0.5; }
    }
    for (const s of this.markers.children) {
      s.position.y = s.userData.base + Math.abs(Math.sin(t * (s.userData.urgent ? 6 : 3.5))) * 0.12;
    }
    for (const c of this.clouds.children) {
      const u = c.userData; u.a += dt * u.speed;
      c.position.set(Math.cos(u.a) * u.r, u.y, Math.sin(u.a) * u.r);
    }
    if (this.selection) this.selection.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.05);
    if (this.spotMat) this.spotMat.opacity = 0.7 + Math.sin(t * 4) * 0.3;
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.type === 'drop') {
        p.obj.position.y += p.vy * dt;
        if (p.obj.position.y < 0.05) { this.splash(p.obj.position.x, p.obj.position.z); this.fx.remove(p.obj); this.particles.splice(i, 1); }
      } else if (p.type === 'spark') {
        p.life -= dt * 1.2; p.vy -= dt * 4;
        p.obj.position.x += p.vx * dt; p.obj.position.y += p.vy * dt; p.obj.position.z += p.vz * dt;
        p.obj.rotation.y += dt * 6; p.obj.material.opacity = Math.max(0, p.life);
        if (p.life <= 0) { this.fx.remove(p.obj); this.particles.splice(i, 1); }
      } else if (p.type === 'ring') {
        p.life -= dt; p.obj.scale.setScalar(1 + (0.5 - p.life) * 6); p.obj.material.opacity = Math.max(0, p.life * 2);
        if (p.life <= 0) { this.fx.remove(p.obj); this.particles.splice(i, 1); }
      }
    }
    for (let i = this.bounces.length - 1; i >= 0; i--) {
      const b = this.bounces[i];
      b.t += dt;
      if (b.t < 0) continue;
      if (b.grow) {
        const k = Math.min(1, b.t / 0.6);
        const s = k < 1 ? 1.15 * (1 - Math.pow(1 - k, 3)) - 0.15 * Math.sin(k * Math.PI) : 1;
        b.obj.scale.setScalar(Math.max(0.01, s));
        if (k >= 1) { b.obj.scale.setScalar(1); this.bounces.splice(i, 1); }
      } else {
        const k = b.t / 0.5;
        b.obj.scale.set(1 + Math.sin(k * Math.PI) * 0.08, 1 - Math.sin(k * Math.PI) * 0.1 + Math.sin(k * Math.PI * 2) * 0.06, 1 + Math.sin(k * Math.PI) * 0.08);
        if (k >= 1) { b.obj.scale.setScalar(1); this.bounces.splice(i, 1); }
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  // Returns a PNG data URL of the current city (without editing overlays).
  capture() {
    const hidden = [this.overlay, this.markers, this.ghost, this.selection?.ring].filter(Boolean);
    hidden.forEach((o) => { o.visible = false; });
    this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/png');
    hidden.forEach((o) => { o.visible = true; });
    return url;
  }
}

/* ------------------------------------------------------- thumbnails */
let thumbR = null; let thumbScene = null; let thumbCam = null;
const thumbCache = new Map();
export function thumbnail(kind, id) {
  const key = kind + ':' + id;
  if (thumbCache.has(key)) return thumbCache.get(key);
  if (!thumbR) {
    thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbR.setSize(180, 180, false);
    thumbR.outputColorSpace = THREE.SRGBColorSpace;
    thumbR.toneMapping = THREE.ACESFilmicToneMapping;
    thumbScene = new THREE.Scene();
    thumbScene.add(new THREE.HemisphereLight('#ffffff', '#ffe6cc', 1.6));
    const d = new THREE.DirectionalLight('#fff4e0', 1.6); d.position.set(-3, 6, 5); thumbScene.add(d);
    thumbCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  }
  const g = new THREE.Group();
  if (kind === 'building') {
    const def = BUILDING_MAP[id];
    const base = new THREE.Mesh(new RoundedBoxGeometry(def.size + 0.1, 0.12, def.size + 0.1, 2, 0.05), mat(def.placeOn === 'river' ? '#56bdf5' : '#9bd77a'));
    base.position.y = -0.06; g.add(base);
    g.add(buildBuilding(id));
  } else if (kind === 'seed') {
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), mat('#e0b07a')); bag.scale.set(1, 1.15, 0.8); bag.position.y = 0.4; g.add(bag);
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.18, 12), mat('#c08850')); tie.position.y = 0.88; g.add(tie);
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat('#6fcf6a')); lf.scale.set(1.6, 0.4, 0.8); lf.position.set(0.12, 1.02, 0); lf.rotation.z = 0.5; g.add(lf);
    const tag = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), mat('#ffffff')); tag.position.set(0, 0.45, 0.33); g.add(tag);
  } else {
    const sp = PLANT_MAP[id];
    const stage = sp.bloom ? 'bloom' : sp.fruit ? 'fruit' : 'mature';
    const info = { species: id, stage, leaves: 10, perfectDays: 0, seed: 'thumb' + id };
    if (sp.kind === 'wall') {
      const wall = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.9, 0.3, 2, 0.04), mat('#fff1d6'));
      wall.position.y = 0.45; g.add(wall);
      const p = buildWallPlant(info, 0.86, 0.86); p.position.set(0, 0.45, 0.17); g.add(p);
    } else {
      const water = sp.habitat.includes('water') || sp.habitat.includes('pond');
      const base = new THREE.Mesh(new RoundedBoxGeometry(sp.size + 0.1, 0.12, sp.size + 0.1, 2, 0.05), mat(water ? '#56bdf5' : sp.habitat.includes('sand') || sp.habitat.includes('oasis') ? '#f3d9a4' : sp.habitat.includes('dry') ? '#c9d98a' : '#9bd77a'));
      base.position.y = -0.06; g.add(base);
      g.add(buildPlant(info));
    }
  }
  thumbScene.add(g);
  const box = new THREE.Box3().setFromObject(g);
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const r = Math.max(s.x, s.y, s.z) * 0.62;
  Object.assign(thumbCam, { left: -r, right: r, top: r, bottom: -r });
  thumbCam.updateProjectionMatrix();
  thumbCam.position.set(c.x + 10, c.y + 7, c.z + 10);
  thumbCam.lookAt(c);
  thumbR.render(thumbScene, thumbCam);
  const url = thumbR.domElement.toDataURL('image/png');
  thumbScene.remove(g);
  thumbCache.set(key, url);
  return url;
}

export { STAGE_INDEX };
