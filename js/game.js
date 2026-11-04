// Pure game rules. No DOM, no three.js — can be tested in Node.
import {
  GRID, TERRAIN, ML_PER_COIN, DRINK_FACTOR, DEFAULT_GOAL, SPROUT_EVERY_ML, LEAF_EVERY_ML,
  PERFECT_MIN, PERFECT_MAX, DIE_AFTER_DRY_DAYS, SEED_PRICE, TIERS, TIER_ORDER,
  PLANTS, PLANT_MAP, BUILDINGS, BUILDING_MAP, BOTTLE_PRESETS,
} from './data.js';

/* ------------------------------------------------------------------ dates */
const pad = (n) => String(n).padStart(2, '0');
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function keyToUTC(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
export function dayDiff(a, b) { // b - a, in whole days
  return Math.round((keyToUTC(b) - keyToUTC(a)) / 86400000);
}
export function addDays(key, n) {
  const d = new Date(keyToUTC(key) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export const round1 = (n) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------------ state */
function nid(state, prefix) { return `${prefix}${state.nextId++}`; }

export function createInitialState(now, lang = 'zh') {
  const today = dayKey(now);
  const state = {
    version: 1,
    createdAt: now,
    startDay: today,
    lang,
    goal: DEFAULT_GOAL,
    coins: 20,
    bottles: [],
    logs: [],
    buildings: [],
    plants: [],
    inventory: { buildings: {}, seeds: 1 },
    sproutProgress: 0,
    leafCarry: 0,
    diary: {},
    lastProcessed: today,
    discovered: { plants: {}, buildings: {} },
    seenReview: null,
    perfectStreak: 0,
    welcomed: false,
    nextId: 1,
  };
  const home = { id: nid(state, 'b'), def: 'cottage', x: 2, z: 3, rot: 0 };
  state.buildings.push(home);
  state.discovered.buildings.cottage = today;
  const starters = [
    ['pine', 1, 1], ['clover', 3, 6], ['fern', 4, 4], ['duckweed', 6, 1],
    ['dandelion', 8, 2], ['barrel', 8, 8],
  ];
  for (const [sp, x, z] of starters) addPlant(state, sp, { x, z }, today);
  addPlant(state, 'ivy', { wall: { b: home.id, side: 0, u: 0 } }, today);
  return state;
}

export function migrate(state) {
  // keep forward-compatible defaults
  state.inventory ||= { buildings: {}, seeds: 0 };
  state.inventory.buildings ||= {};
  state.discovered ||= { plants: {}, buildings: {} };
  state.diary ||= {};
  state.leafCarry ||= 0;
  state.goal ||= DEFAULT_GOAL;
  return state;
}

function addPlant(state, speciesId, spot, today) {
  const p = {
    id: nid(state, 'p'), species: speciesId,
    x: spot.wall ? null : spot.x, z: spot.wall ? null : spot.z,
    wall: spot.wall ? { ...spot.wall } : null,
    stored: false,
    born: today, lastWatered: today,
    wateredDays: 0, perfectDays: 0, leaves: 1,
    dead: false, diedOn: null,
  };
  state.plants.push(p);
  if (!state.discovered.plants[speciesId]) state.discovered.plants[speciesId] = today;
  return p;
}

/* ------------------------------------------------------------- bottles */
export function addBottle(state, { name, capacity, icon, color }) {
  const b = { id: nid(state, 'w'), name: String(name || '').slice(0, 20), capacity: Math.max(50, Math.min(5000, Math.round(capacity))), icon, color };
  state.bottles.push(b);
  return b;
}
export function updateBottle(state, id, patch) {
  const b = state.bottles.find((x) => x.id === id);
  if (!b) return null;
  if (patch.name != null) b.name = String(patch.name).slice(0, 20);
  if (patch.capacity != null) b.capacity = Math.max(50, Math.min(5000, Math.round(patch.capacity)));
  if (patch.icon) b.icon = patch.icon;
  if (patch.color) b.color = patch.color;
  return b;
}
export function deleteBottle(state, id) {
  state.bottles = state.bottles.filter((b) => b.id !== id);
}
export { BOTTLE_PRESETS };

/* ------------------------------------------------------- spatial index */
const ck = (x, z) => `${x},${z}`;
export const inBounds = (x, z) => x >= 0 && z >= 0 && x < GRID && z < GRID;
export const terrainAt = (x, z) => TERRAIN[z][x];

export function footprint(x, z, size) {
  const cells = [];
  for (let dx = 0; dx < size; dx++) for (let dz = 0; dz < size; dz++) cells.push([x + dx, z + dz]);
  return cells;
}

export function buildIndex(state) {
  const bAt = new Map();
  const pAt = new Map();
  const pond = new Set();
  const moist = new Set();
  const wallAt = new Map(); // `${b}:${side}:${u}` -> plant
  const placedB = state.buildings;
  for (const b of placedB) {
    const def = BUILDING_MAP[b.def];
    for (const [x, z] of footprint(b.x, b.z, def.size)) {
      bAt.set(ck(x, z), b);
      if (def.pond) pond.add(ck(x, z));
    }
  }
  for (const p of state.plants) {
    if (p.stored) continue;
    if (p.wall) { wallAt.set(`${p.wall.b}:${p.wall.side}:${p.wall.u}`, p); continue; }
    const size = PLANT_MAP[p.species].size;
    for (const [x, z] of footprint(p.x, p.z, size)) pAt.set(ck(x, z), p);
  }
  const isWater = (x, z) => inBounds(x, z) && (terrainAt(x, z) === 'W' || pond.has(ck(x, z)));
  for (let x = 0; x < GRID; x++) {
    for (let z = 0; z < GRID; z++) {
      if (isWater(x, z)) continue;
      if (isWater(x + 1, z) || isWater(x - 1, z) || isWater(x, z + 1) || isWater(x, z - 1)) moist.add(ck(x, z));
    }
  }
  for (const b of placedB) {
    const def = BUILDING_MAP[b.def];
    if (!def.moist) continue;
    for (let x = b.x - 1; x <= b.x + def.size; x++) {
      for (let z = b.z - 1; z <= b.z + def.size; z++) {
        if (inBounds(x, z) && !isWater(x, z)) moist.add(ck(x, z));
      }
    }
  }
  return { bAt, pAt, pond, moist, wallAt };
}

export function cellInfo(state, x, z, idx = buildIndex(state)) {
  return {
    terrain: terrainAt(x, z),
    building: idx.bAt.get(ck(x, z)) || null,
    plant: idx.pAt.get(ck(x, z)) || null,
    pond: idx.pond.has(ck(x, z)),
    moist: idx.moist.has(ck(x, z)),
  };
}

// Habitat tokens for a (1x1 or 2x2) ground spot.
export function groundTokens(idx, x, z, size = 1) {
  const cells = footprint(x, z, size);
  let water = true; let pond = true; let grass = true; let sand = true; let anyMoist = false; let allDryLand = true;
  for (const [cx, cz] of cells) {
    if (!inBounds(cx, cz)) return new Set();
    const t = terrainAt(cx, cz);
    const isPond = idx.pond.has(ck(cx, cz));
    const isWater = t === 'W' || isPond;
    const m = idx.moist.has(ck(cx, cz));
    if (!isWater) { water = false; pond = false; }
    if (!isPond) pond = false;
    if (isWater || t !== 'G') grass = false;
    if (isWater || t !== 'S') sand = false;
    if (m) anyMoist = true;
    if (isWater || m) allDryLand = false;
  }
  const tokens = new Set();
  if (water) tokens.add('water');
  if (pond) tokens.add('pond');
  if (grass) tokens.add('grass');
  if (grass && anyMoist) tokens.add('shore');
  if (sand) tokens.add('sand');
  if (sand && anyMoist) tokens.add('oasis');
  if (allDryLand) tokens.add('dry');
  return tokens;
}

export function wallSlotOutside(b, side, u) {
  const s = BUILDING_MAP[b.def].size;
  if (side === 0) return [b.x + u, b.z + s];
  if (side === 1) return [b.x + s, b.z + u];
  if (side === 2) return [b.x + u, b.z - 1];
  return [b.x - 1, b.z + u];
}

export function wallSlotFree(state, idx, b, side, u, ignorePlantId) {
  const def = BUILDING_MAP[b.def];
  if (!def || !def.walls) return false;
  if (u < 0 || u >= def.size) return false;
  const [ox, oz] = wallSlotOutside(b, side, u);
  if (inBounds(ox, oz) && idx.bAt.get(ck(ox, oz))) return false; // no light between buildings
  const occ = idx.wallAt.get(`${b.id}:${side}:${u}`);
  return !occ || occ.id === ignorePlantId;
}

export function allWallSlots(state, idx = buildIndex(state), ignorePlantId) {
  const out = [];
  for (const b of state.buildings) {
    const def = BUILDING_MAP[b.def];
    if (!def.walls) continue;
    for (let side = 0; side < 4; side++) {
      for (let u = 0; u < def.size; u++) {
        if (wallSlotFree(state, idx, b, side, u, ignorePlantId)) out.push({ wall: { b: b.id, side, u } });
      }
    }
  }
  return out;
}

/* ---------------------------------------------------------- placement */
export function hasBuilding(state, defId) {
  return state.buildings.some((b) => b.def === defId);
}

function speciesMatches(sp, tokens) { return sp.habitat.some((h) => tokens.has(h)); }

// Can a plant species be put on this spot?  spot = {x,z} or {wall:{b,side,u}}
export function canPlacePlant(state, speciesId, spot, ignorePlantId = null, idx = buildIndex(state)) {
  const sp = PLANT_MAP[speciesId];
  if (!sp) return false;
  if (sp.kind === 'wall') {
    if (!spot.wall) return false;
    const b = state.buildings.find((x) => x.id === spot.wall.b);
    if (!b) return false;
    return wallSlotFree(state, idx, b, spot.wall.side, spot.wall.u, ignorePlantId);
  }
  if (spot.wall) return false;
  for (const [x, z] of footprint(spot.x, spot.z, sp.size)) {
    if (!inBounds(x, z)) return false;
    const b = idx.bAt.get(ck(x, z));
    if (b && !BUILDING_MAP[b.def].pond) return false;
    const p = idx.pAt.get(ck(x, z));
    if (p && p.id !== ignorePlantId) return false;
  }
  return speciesMatches(sp, groundTokens(idx, spot.x, spot.z, sp.size));
}

export function canPlaceBuilding(state, defId, x, z, ignoreBuildingId = null) {
  const def = BUILDING_MAP[defId];
  if (!def) return false;
  const moving = ignoreBuildingId ? state.buildings.find((b) => b.id === ignoreBuildingId) : null;
  const carried = moving ? new Set(carriedPlants(state, moving).map((p) => p.id)) : new Set();
  const idx = buildIndex(state);
  for (const [cx, cz] of footprint(x, z, def.size)) {
    if (!inBounds(cx, cz)) return false;
    const t = terrainAt(cx, cz);
    if (def.placeOn === 'river' && t !== 'W') return false;
    if (def.placeOn === 'land' && t === 'W') return false;
    if (def.placeOn === 'grass' && t !== 'G') return false;
    const b = idx.bAt.get(ck(cx, cz));
    if (b && b.id !== ignoreBuildingId) return false;
    const p = idx.pAt.get(ck(cx, cz));
    if (p && !carried.has(p.id)) return false;
  }
  return true;
}

// Aquatic plants sitting inside a pond travel with it.
export function carriedPlants(state, b) {
  const def = BUILDING_MAP[b.def];
  if (!def.pond) return [];
  return state.plants.filter((p) => !p.stored && !p.wall && p.x >= b.x && p.x < b.x + def.size && p.z >= b.z && p.z < b.z + def.size);
}

export function validBuildingSpots(state, defId, ignoreBuildingId = null) {
  const out = [];
  for (let x = 0; x < GRID; x++) for (let z = 0; z < GRID; z++) {
    if (canPlaceBuilding(state, defId, x, z, ignoreBuildingId)) out.push({ x, z });
  }
  return out;
}

export function validPlantSpots(state, speciesId, ignorePlantId = null) {
  const idx = buildIndex(state);
  const sp = PLANT_MAP[speciesId];
  if (sp.kind === 'wall') return allWallSlots(state, idx, ignorePlantId);
  const out = [];
  for (let x = 0; x < GRID; x++) for (let z = 0; z < GRID; z++) {
    if (canPlacePlant(state, speciesId, { x, z }, ignorePlantId, idx)) out.push({ x, z });
  }
  return out;
}

/* --------------------------------------------------------- hydration */
export function logEff(log) { return log.eff ?? log.amount * (log.type === 'drink' ? DRINK_FACTOR : 1); }

export function dayStats(state, day) {
  const logs = state.logs.filter((l) => l.day === day);
  let water = 0; let drink = 0; let eff = 0; let coins = 0;
  for (const l of logs) {
    if (l.type === 'drink') drink += l.amount; else water += l.amount;
    eff += logEff(l);
    coins += l.coins;
  }
  return { logs, water, drink, eff, coins: round1(coins), count: logs.length, ratio: eff / state.goal };
}

export function hydrationRatio(state, now) {
  const since = now - 24 * 3600 * 1000;
  let eff = 0;
  for (const l of state.logs) if (l.ts > since && l.ts <= now) eff += logEff(l);
  return eff / state.goal;
}

export function tierFromRatio(ratio) {
  let tier = 'dry';
  for (const t of TIER_ORDER) if (ratio >= TIERS[t].min) tier = t;
  return tier;
}

export function hydrationTier(state, now) { return tierFromRatio(hydrationRatio(state, now)); }

/* ----------------------------------------------------- plant status */
export function plantStage(p) {
  if (p.dead) return 'dead';
  const sp = PLANT_MAP[p.species];
  if (sp.fruit && p.perfectDays >= (sp.bloom ? 4 : 3)) return 'fruit';
  if (sp.bloom && p.perfectDays >= 2) return 'bloom';
  if (p.wateredDays >= 3 || p.leaves >= 8) return 'mature';
  if (p.wateredDays >= 1 || p.leaves >= 2) return 'young';
  return 'sprout';
}
export const STAGES = ['sprout', 'young', 'mature', 'bloom', 'fruit'];

export function plantGrowthScale(p) {
  return 1 + Math.min(p.perfectDays, 8) * 0.04;
}

export function maxLeaves(p) {
  const s = plantStage(p);
  return { sprout: 3, young: 6, mature: 10, bloom: 12, fruit: 12, dead: 0 }[s];
}

export function plantStatus(state, p, now) {
  const today = dayKey(now);
  const daysDry = dayDiff(p.lastWatered, today);
  return {
    daysDry,
    dead: p.dead,
    warn: !p.dead && daysDry >= 2,
    urgent: !p.dead && daysDry >= DIE_AFTER_DRY_DAYS,
    daysLeft: Math.max(0, DIE_AFTER_DRY_DAYS - daysDry),
    stage: plantStage(p),
  };
}

/* ------------------------------------------------------ sprouting */
function freeGroundSpots(state, idx, size) {
  const out = [];
  for (let x = 0; x <= GRID - size; x++) {
    for (let z = 0; z <= GRID - size; z++) {
      let ok = true;
      for (const [cx, cz] of footprint(x, z, size)) {
        const b = idx.bAt.get(ck(cx, cz));
        if ((b && !BUILDING_MAP[b.def].pond) || idx.pAt.get(ck(cx, cz))) { ok = false; break; }
      }
      if (ok) out.push({ x, z, size, tokens: groundTokens(idx, x, z, size) });
    }
  }
  return out;
}

function requiresOk(state, sp) { return !sp.requires || hasBuilding(state, sp.requires); }

function pickWeighted(items, weightFn, rnd) {
  const total = items.reduce((s, it) => s + weightFn(it), 0);
  if (total <= 0) return null;
  let r = rnd() * total;
  for (const it of items) { r -= weightFn(it); if (r <= 0) return it; }
  return items[items.length - 1];
}

function tiersByDistance(tier) {
  const i = TIER_ORDER.indexOf(tier);
  return [...TIER_ORDER].sort((a, b) => Math.abs(TIER_ORDER.indexOf(a) - i) - Math.abs(TIER_ORDER.indexOf(b) - i));
}

// Natural sprout: choose a species that fits the current hydration tier and an empty spot whose
// natural environment fits that species.
export function spawnNatural(state, now, rnd = Math.random) {
  const idx = buildIndex(state);
  const spots1 = freeGroundSpots(state, idx, 1);
  const spots2 = freeGroundSpots(state, idx, 2);
  const walls = allWallSlots(state, idx).map((s) => ({ ...s, tokens: new Set(['wall']) }));
  const tier = hydrationTier(state, now);
  for (const t of [tier, ...tiersByDistance(tier).slice(1, 2)]) {
    const options = [];
    for (const sp of PLANTS) {
      if (!sp.tiers.includes(t) || !requiresOk(state, sp)) continue;
      const pool = sp.kind === 'wall' ? walls : sp.size === 2 ? spots2 : spots1;
      const spots = pool.filter((s) => speciesMatches(sp, s.tokens));
      if (spots.length) options.push({ sp, spots });
    }
    if (!options.length) continue;
    const pick = pickWeighted(options, (o) => {
      let w = 1;
      if (o.sp.requires) w *= 2;              // reward the player's purchases
      if (o.sp.tiers.length === 1) w *= 1.4;  // tier specialists feel special
      if (o.sp.size === 2) w *= 0.6;
      if (o.sp.kind === 'wall') w *= 0.8;
      return w;
    }, rnd);
    const spot = pick.spots[Math.floor(rnd() * pick.spots.length)];
    const p = addPlant(state, pick.sp.id, spot.wall ? { wall: spot.wall } : { x: spot.x, z: spot.z }, dayKey(now));
    return p;
  }
  return null;
}

// What would a seed grow into on this spot?
export function seedSpecies(state, spot, now, rnd = Math.random) {
  const idx = buildIndex(state);
  let tokens;
  if (spot.wall) {
    const b = state.buildings.find((x) => x.id === spot.wall.b);
    if (!b || !wallSlotFree(state, idx, b, spot.wall.side, spot.wall.u)) return null;
    tokens = new Set(['wall']);
  } else {
    if (!inBounds(spot.x, spot.z)) return null;
    const b = idx.bAt.get(ck(spot.x, spot.z));
    if ((b && !BUILDING_MAP[b.def].pond) || idx.pAt.get(ck(spot.x, spot.z))) return null;
    tokens = groundTokens(idx, spot.x, spot.z, 1);
  }
  const tier = hydrationTier(state, now);
  for (const t of tiersByDistance(tier)) {
    const options = PLANTS.filter((sp) => sp.size === 1 && (sp.kind === 'wall') === !!spot.wall && sp.tiers.includes(t) && requiresOk(state, sp) && speciesMatches(sp, tokens));
    if (options.length) return options[Math.floor(rnd() * options.length)].id;
  }
  return null;
}

export function validSeedSpots(state, now) {
  const idx = buildIndex(state);
  const out = [];
  for (const s of freeGroundSpots(state, idx, 1)) {
    if (PLANTS.some((sp) => sp.size === 1 && sp.kind !== 'wall' && requiresOk(state, sp) && speciesMatches(sp, s.tokens))) out.push({ x: s.x, z: s.z });
  }
  return out.concat(allWallSlots(state, idx));
}

export function plantSeed(state, spot, now, rnd = Math.random) {
  if ((state.inventory.seeds || 0) <= 0) return null;
  const species = seedSpecies(state, spot, now, rnd);
  if (!species) return null;
  state.inventory.seeds -= 1;
  return addPlant(state, species, spot, dayKey(now));
}

/* ----------------------------------------------------------- drinking */
export function drink(state, bottleId, type, now, rnd = Math.random) {
  const bottle = state.bottles.find((b) => b.id === bottleId);
  if (!bottle) return null;
  const today = dayKey(now);
  const amount = bottle.capacity;
  const factor = type === 'drink' ? DRINK_FACTOR : 1;
  const eff = amount * factor;
  let coins = eff / ML_PER_COIN;
  const bonus = state.buildings.some((b) => BUILDING_MAP[b.def].bonus) ? 0.1 : 0;
  coins = round1(coins * (1 + bonus));
  const before = dayStats(state, today).eff;
  const log = {
    id: nid(state, 'l'), ts: now, day: today, bottleId, bottleName: bottle.name, icon: bottle.icon, color: bottle.color,
    amount, type, eff, coins,
  };
  state.logs.push(log);
  state.coins = round1(state.coins + coins);

  // 1) irrigation: every drink waters every living plant in town
  const alive = state.plants.filter((p) => !p.dead);
  for (const p of alive) p.lastWatered = today;

  // 2) leaves: every 100 ml (effective) grows one more leaf on the plant with the fewest leaves
  state.leafCarry += eff;
  const grown = new Set();
  while (state.leafCarry >= LEAF_EVERY_ML) {
    state.leafCarry -= LEAF_EVERY_ML;
    const cands = alive.filter((p) => !p.stored && p.leaves < maxLeaves(p));
    if (!cands.length) break;
    const min = Math.min(...cands.map((p) => p.leaves));
    const lows = cands.filter((p) => p.leaves === min);
    const p = lows[Math.floor(rnd() * lows.length)];
    p.leaves += 1;
    grown.add(p.id);
  }

  // 3) new sprouts every 500 ml (effective)
  state.sproutProgress += eff;
  const sprouts = [];
  let full = false;
  while (state.sproutProgress >= SPROUT_EVERY_ML && sprouts.length < 3) {
    const p = spawnNatural(state, now, rnd);
    if (!p) { full = true; state.sproutProgress = Math.min(state.sproutProgress, SPROUT_EVERY_ML); break; }
    state.sproutProgress -= SPROUT_EVERY_ML;
    sprouts.push(p);
  }
  if (!full) state.sproutProgress = Math.min(state.sproutProgress, SPROUT_EVERY_ML * 2);
  const after = before + eff;
  return {
    log, coins, bonus, sprouts, grown: [...grown], full,
    watered: alive.length,
    reachedGoal: before < state.goal && after >= state.goal,
    tier: hydrationTier(state, now),
  };
}

export function deleteLog(state, logId, now) {
  const today = dayKey(now);
  const i = state.logs.findIndex((l) => l.id === logId);
  if (i < 0 || state.logs[i].day !== today) return false;
  state.coins = Math.max(0, round1(state.coins - state.logs[i].coins));
  state.logs.splice(i, 1);
  return true;
}

/* ----------------------------------------------------- daily closing */
export function scoreDay(state, day) {
  const st = dayStats(state, day);
  const ratio = st.eff / state.goal;
  const blocks = new Set(st.logs.map((l) => Math.floor(new Date(l.ts).getHours() / 2))).size;
  const total = st.water + st.drink;
  const drinkShare = total ? st.drink / total : 0;
  let amountScore;
  if (ratio < PERFECT_MIN) amountScore = 80 * (ratio / PERFECT_MIN);
  else if (ratio <= PERFECT_MAX) amountScore = 80;
  else if (ratio <= 2) amountScore = 70;
  else amountScore = 55;
  const spreadScore = Math.min(blocks, 5) * 3;
  const pureScore = total === 0 ? 0 : drinkShare <= 0.2 ? 5 : drinkShare <= 0.5 ? 3 : 0;
  const score = Math.round(Math.min(100, amountScore + spreadScore + pureScore));
  const stars = score >= 90 ? 5 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : score > 0 ? 1 : 0;
  const perfect = ratio >= PERFECT_MIN && ratio <= PERFECT_MAX;
  // feedback keys (texts live in i18n)
  const msgs = [];
  if (st.count === 0) msgs.push('fb_none');
  else if (ratio < 0.4) msgs.push('fb_verylow');
  else if (ratio < PERFECT_MIN) msgs.push('fb_low');
  else if (ratio <= PERFECT_MAX) msgs.push('fb_perfect');
  else if (ratio <= 2) msgs.push('fb_high');
  else msgs.push('fb_toohigh');
  const tips = [];
  if (st.count > 0) {
    const first = Math.min(...st.logs.map((l) => new Date(l.ts).getHours()));
    const nightEff = st.logs.filter((l) => new Date(l.ts).getHours() >= 21).reduce((s, l) => s + logEff(l), 0);
    if (drinkShare > 0.5) tips.push('tip_sugar');
    if (blocks <= 2 && st.count >= 1) tips.push('tip_spread');
    if (first >= 10) tips.push('tip_morning');
    if (st.eff > 0 && nightEff / st.eff > 0.4) tips.push('tip_night');
  }
  if (!tips.length) tips.push(perfect ? 'tip_keep' : 'tip_bottle');
  return {
    day, score, stars, perfect, ratio: Math.round(ratio * 100) / 100,
    eff: st.eff, water: st.water, drink: st.drink, count: st.count, coins: st.coins, blocks,
    goal: state.goal, msgs, tips: tips.slice(0, 2),
  };
}

export function processDays(state, now) {
  const today = dayKey(now);
  const closed = [];
  const deaths = [];
  if (!state.lastProcessed) state.lastProcessed = today;
  let d = state.lastProcessed;
  let guard = 0;
  while (d < today && guard++ < 400) {
    const entry = scoreDay(state, d);
    for (const p of state.plants) {
      if (p.dead || p.lastWatered !== d) continue;
      p.wateredDays += 1;
      if (entry.perfect) p.perfectDays += 1;
    }
    state.perfectStreak = entry.perfect ? (state.perfectStreak || 0) + 1 : 0;
    entry.streak = state.perfectStreak;
    if (entry.streak >= 3) entry.tips = ['tip_streak', ...entry.tips].slice(0, 2);
    // deaths happen at the start of the next day
    const next = addDays(d, 1);
    const died = [];
    for (const p of state.plants) {
      if (p.dead) continue;
      if (dayDiff(p.lastWatered, next) > DIE_AFTER_DRY_DAYS) {
        p.dead = true; p.diedOn = next; died.push(p.species); deaths.push(p);
      }
    }
    entry.died = died.length;
    if (died.length) entry.msgs.push('fb_died');
    entry.thirsty = state.plants.filter((p) => !p.dead && dayDiff(p.lastWatered, next) >= 2).length;
    if (d >= state.startDay) { state.diary[d] = entry; closed.push(entry); }
    d = next;
  }
  state.lastProcessed = today;
  return { closed, deaths };
}

/* ------------------------------------------------------------- shop */
export function buy(state, defId, now) {
  const def = BUILDING_MAP[defId];
  if (!def || state.coins < def.price) return false;
  state.coins = round1(state.coins - def.price);
  state.inventory.buildings[defId] = (state.inventory.buildings[defId] || 0) + 1;
  if (!state.discovered.buildings[defId]) state.discovered.buildings[defId] = dayKey(now);
  return true;
}
export function buySeed(state) {
  if (state.coins < SEED_PRICE) return false;
  state.coins = round1(state.coins - SEED_PRICE);
  state.inventory.seeds = (state.inventory.seeds || 0) + 1;
  return true;
}

export function placeBuilding(state, defId, x, z) {
  if ((state.inventory.buildings[defId] || 0) <= 0) return null;
  if (!canPlaceBuilding(state, defId, x, z)) return null;
  state.inventory.buildings[defId] -= 1;
  const b = { id: nid(state, 'b'), def: defId, x, z, rot: 0 };
  state.buildings.push(b);
  return b;
}

export function moveBuilding(state, id, x, z) {
  const b = state.buildings.find((v) => v.id === id);
  if (!b || !canPlaceBuilding(state, b.def, x, z, id)) return false;
  const dx = x - b.x; const dz = z - b.z;
  for (const p of carriedPlants(state, b)) { p.x += dx; p.z += dz; }
  b.x = x; b.z = z;
  // wall plants whose wall is now blocked go to the backpack
  const idx = buildIndex(state);
  for (const p of state.plants) {
    if (!p.wall || p.stored) continue;
    const ob = state.buildings.find((v) => v.id === p.wall.b);
    if (ob && !wallSlotFree(state, idx, ob, p.wall.side, p.wall.u, p.id)) { p.stored = true; p.wall = null; }
  }
  return true;
}

export function rotateBuilding(state, id) {
  const b = state.buildings.find((v) => v.id === id);
  if (b) b.rot = ((b.rot || 0) + 1) % 4;
}

export function storeBuilding(state, id) {
  const b = state.buildings.find((v) => v.id === id);
  if (!b) return false;
  for (const p of carriedPlants(state, b)) { p.stored = true; p.x = null; p.z = null; }
  for (const p of state.plants) if (p.wall && p.wall.b === id) { p.stored = true; p.wall = null; }
  state.buildings = state.buildings.filter((v) => v !== b);
  state.inventory.buildings[b.def] = (state.inventory.buildings[b.def] || 0) + 1;
  return true;
}

export function movePlant(state, id, spot) {
  const p = state.plants.find((v) => v.id === id);
  if (!p || p.dead) return false;
  if (!canPlacePlant(state, p.species, spot, id)) return false;
  if (spot.wall) { p.wall = { ...spot.wall }; p.x = null; p.z = null; } else { p.wall = null; p.x = spot.x; p.z = spot.z; }
  p.stored = false;
  return true;
}

export function storePlant(state, id) {
  const p = state.plants.find((v) => v.id === id);
  if (!p || p.dead) return false;
  p.stored = true; p.x = null; p.z = null; p.wall = null;
  return true;
}

export function removePlant(state, id) {
  state.plants = state.plants.filter((p) => p.id !== id);
}

export function cityStats(state) {
  const placed = state.plants.filter((p) => !p.stored);
  return {
    plants: placed.filter((p) => !p.dead).length,
    dead: placed.filter((p) => p.dead).length,
    buildings: state.buildings.length,
    leaves: placed.reduce((s, p) => s + (p.dead ? 0 : p.leaves), 0),
    days: Object.keys(state.diary).length + 1,
  };
}

export { PLANTS, BUILDINGS, PLANT_MAP, BUILDING_MAP, SEED_PRICE };
