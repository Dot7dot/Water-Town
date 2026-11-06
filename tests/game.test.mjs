import assert from 'node:assert/strict';
import * as G from '../js/game.js';
import { LAND_LEVELS, LEGACY_TERRAIN, TERRAIN } from '../js/data.js';

const DAY = 86400000;
const now = new Date(2026, 10, 4, 9, 0).getTime();
const MAX = LAND_LEVELS.length - 1;
const spotOf = (p) => (p.wall ? { wall: p.wall } : { x: p.x, z: p.z });
const fullLand = (s) => { s.landLevel = MAX; return s; };

/* ---------------------------------------------------- starting plot */
{
  const s = G.createInitialState(now);
  assert.equal(s.landLevel, 0);
  const [x0, z0, x1, z1] = G.landRect(s);
  assert.equal((x1 - x0 + 1) * (z1 - z0 + 1), 6, 'starts as a 2x3 plot');
  let water = 0;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (G.terrainAt(s, x, z) === 'W') water++;
  assert.equal(water, 1, 'with exactly one small water cell');
  for (const p of s.plants) assert.ok(G.canPlacePlant(s, p.species, spotOf(p), p.id), 'starter ' + p.species);
  for (const b of s.buildings) assert.ok(G.isUnlocked(s, b.x, b.z), 'starter building inside the plot');
  // nothing can be put on locked land
  assert.equal(G.isUnlocked(s, 0, 0), false);
  assert.equal(G.canPlacePlant(s, 'clover', { x: 0, z: 0 }), false, 'no planting on locked land');
  assert.equal(G.canPlaceBuilding(s, 'lamp', 0, 0), false, 'no building on locked land');
  for (const sp of G.validBuildingSpots(s, 'lamp')) assert.ok(G.isUnlocked(s, sp.x, sp.z));
  for (const sp of G.validSeedSpots(s, now)) if (!sp.wall) assert.ok(G.isUnlocked(s, sp.x, sp.z));
  assert.ok(G.nextLandCells(s).length === 3, 'next expansion previews 3 cells');
}

/* ---------------------------------------------------- land expansion */
{
  const s = G.createInitialState(now);
  const w = G.addBottle(s, { name: 'Big', capacity: 1000, icon: 'jug' });
  const r = G.drink(s, w.id, 'water', now, () => 0.3);
  assert.deepEqual(r.land, { from: 0, to: 1, cells: 3 }, '1000 ml opens the first 3 cells');
  assert.equal(G.landProgress(s).next, LAND_LEVELS[2].need);
  // sprouts may use the freshly opened land
  for (const p of s.plants) if (!p.wall) assert.ok(G.isUnlocked(s, p.x, p.z));
  // beverages count half toward the land as well
  const r2 = G.drink(s, w.id, 'drink', now + 1000);
  assert.equal(r2.land, null);
  // keep drinking: the land keeps growing and never shrinks
  let t = now;
  for (let i = 0; i < 80; i++) { t += 3 * 3600e3; G.drink(s, w.id, 'water', t); }
  assert.equal(s.landLevel, MAX, 'whole island open after ~70 L');
  assert.equal(G.landProgress(s).done, true);
  const last = s.logs[s.logs.length - 1];
  s.logs.pop();
  G.updateLand(s);
  assert.equal(s.landLevel, MAX, 'deleting a record never re-locks land');
  void last;
}

/* ---------------------------------------------------- old saves */
{
  const old = G.createInitialState(now);
  delete old.terrain; delete old.landLevel;
  G.migrate(old);
  assert.equal(old.landLevel, MAX, 'existing towns keep their full island');
  assert.deepEqual(old.terrain, LEGACY_TERRAIN);
  assert.notDeepEqual(TERRAIN, LEGACY_TERRAIN);
}

/* ---------------------------------------------------- habitats (natural logic) */
{
  const s = fullLand(G.createInitialState(now));
  assert.equal(G.canPlacePlant(s, 'cactus', { x: 6, z: 4 }), false, 'cactus in river');
  assert.equal(G.canPlacePlant(s, 'cactus', { x: 6, z: 3 }), false, 'cactus by river (rot)');
  assert.equal(G.canPlacePlant(s, 'cactus', { x: 0, z: 3 }), true, 'cactus on dry grass');
  assert.equal(G.canPlacePlant(s, 'waterlily', { x: 0, z: 3 }), false, 'lily on land');
  assert.equal(G.canPlacePlant(s, 'waterlily', { x: 6, z: 4 }), true, 'lily in river');
  assert.equal(G.canPlacePlant(s, 'lotus', { x: 6, z: 4 }), false, 'lotus needs a pond');
  assert.equal(G.canPlacePlant(s, 'ivy', { x: 0, z: 3 }), false, 'ivy on ground');
  assert.equal(G.canPlacePlant(s, 'palm', { x: 3, z: 9 }), false, 'palm on dry sand');
  assert.equal(G.canPlacePlant(s, 'palm', { x: 1, z: 7 }), true, 'palm in the oasis');
  assert.equal(G.canPlacePlant(s, 'palm', { x: 4, z: 8 }), false, 'palm off sand');
}

/* ---------------------------------------------------- drinking */
{
  const s = G.createInitialState(now);
  const w = G.addBottle(s, { name: 'Big', capacity: 1000, icon: 'jug' });
  const c0 = s.coins;
  let r = G.drink(s, w.id, 'water', now, () => 0.3);
  assert.equal(r.coins, 10);
  assert.equal(s.coins, c0 + 10);
  assert.equal(r.sprouts.length, 2, 'two sprouts for 1000ml');
  r = G.drink(s, w.id, 'drink', now + 1000, () => 0.3);
  assert.equal(r.coins, 5, 'beverage gives half coins');
  for (const p of s.plants) if (!p.stored) assert.ok(G.canPlacePlant(s, p.species, spotOf(p), p.id), 'sprout valid ' + p.species);
}

/* ---------------------------------------------------- low intake -> dry plants */
{
  const s = G.createInitialState(now);
  const small = G.addBottle(s, { name: 's', capacity: 500, icon: 'flask' });
  s.goal = 4000;
  for (let i = 0; i < 20; i++) { s.sproutProgress = 500; G.drink(s, small.id, 'drink', now + i * 25 * 3600e3); }
  const low = [...new Set(s.plants.slice(3).map((p) => p.species))];
  console.log('species grown with low intake:', low.join(','));
  for (const sp of low) assert.ok(G.PLANT_MAP[sp].tiers.some((t) => t === 'dry' || t === 'low'), 'dry-tier species ' + sp);
  assert.ok(!low.includes('lotus') && !low.includes('waterlily'));
}

/* ---------------------------------------------------- life and death */
{
  const s = G.createInitialState(now);
  const w = G.addBottle(s, { name: 'Big', capacity: 1000, icon: 'jug' });
  G.drink(s, w.id, 'water', now);
  G.processDays(s, now + 2 * DAY);
  const st = G.plantStatus(s, s.plants[0], now + 2 * DAY);
  assert.equal(st.warn, true); assert.equal(st.dead, false);
  G.processDays(s, now + 3 * DAY);
  assert.equal(G.plantStatus(s, s.plants[0], now + 3 * DAY).urgent, true);
  assert.equal(s.plants.some((p) => p.dead), false);
  G.processDays(s, now + 4 * DAY);
  assert.equal(s.plants.every((p) => p.dead), true, 'all die after 3 full dry days');
  assert.ok(s.diary[G.dayKey(now)].score > 0);

  const s3 = G.createInitialState(now);
  const b3 = G.addBottle(s3, { name: 'x', capacity: 100, icon: 'cup' });
  for (let d = 0; d < 6; d++) { G.processDays(s3, now + d * DAY); G.drink(s3, b3.id, 'water', now + d * DAY); }
  G.processDays(s3, now + 6 * DAY);
  assert.equal(s3.plants.some((p) => p.dead), false, 'tiny daily drink keeps plants alive');

  const s4 = G.createInitialState(now);
  const b4 = G.addBottle(s4, { name: 'x', capacity: 500, icon: 'cup' });
  for (let d = 0; d < 5; d++) { G.processDays(s4, now + d * DAY); for (let k = 0; k < 4; k++) G.drink(s4, b4.id, 'water', now + d * DAY + k * 3 * 3600e3); }
  G.processDays(s4, now + 5 * DAY);
  const fern = s4.plants.find((p) => p.species === 'fern');
  assert.equal(fern.perfectDays, 5, 'perfect days counted');
  assert.equal(G.plantStage(fern), 'mature');
  assert.equal(G.plantStage({ species: 'dandelion', perfectDays: 4, wateredDays: 4, leaves: 5 }), 'fruit');
  assert.equal(G.plantStage({ species: 'tulip', perfectDays: 2, wateredDays: 2, leaves: 5 }), 'bloom');
}

/* ---------------------------------------------------- buildings */
{
  const s = fullLand(G.createInitialState(now));
  s.coins = 500;
  assert.equal(G.canPlacePlant(s, 'fern', { x: 4, z: 2 }), false, 'dry before the pond');
  assert.ok(G.buy(s, 'pond', now));
  const pond = G.placeBuilding(s, 'pond', 2, 2);
  assert.ok(pond);
  assert.equal(G.canPlacePlant(s, 'lotus', { x: 2, z: 2 }), true, 'lotus in pond');
  assert.equal(G.canPlacePlant(s, 'clover', { x: 2, z: 2 }), false, 'no clover in pond');
  assert.equal(G.canPlacePlant(s, 'fern', { x: 4, z: 2 }), true, 'pond makes shore');
  s.inventory.seeds = 1;
  const lot = G.plantSeed(s, { x: 3, z: 3 }, now);
  assert.ok(lot && G.PLANT_MAP[lot.species].habitat.some((h) => h === 'water' || h === 'pond'));
  assert.ok(G.moveBuilding(s, pond.id, 1, 5));
  assert.equal(lot.x, 2); assert.equal(lot.z, 6, 'aquatic plant moves with the pond');
  assert.ok(G.buy(s, 'bridge', now));
  assert.equal(G.canPlaceBuilding(s, 'bridge', 0, 0), false);
  assert.equal(G.canPlaceBuilding(s, 'bridge', 6, 4), true);
  assert.equal(G.canPlacePlant(s, 'fern', { x: 9, z: 2 }), false);
  assert.ok(G.buy(s, 'well', now));
  assert.ok(G.placeBuilding(s, 'well', 8, 2));
  assert.equal(G.canPlacePlant(s, 'fern', { x: 9, z: 2 }), true, 'well moistens land');
  G.storeBuilding(s, s.buildings[0].id);
  assert.ok(s.plants.find((p) => p.species === 'ivy').stored, 'vines are stored with their building');
  assert.equal(G.validPlantSpots(s, 'ivy').length, 0, 'no walls left for ivy');
}

/* ---------------------------------------------------- yellow icon reminder */
{
  const H = 3600e3;
  const s = G.createInitialState(now);
  assert.equal(s.remindHours, 3);
  assert.equal(G.thirstInfo(s, now + 2 * H).overdue, false, 'fresh town is not overdue yet');
  assert.equal(G.thirstInfo(s, now + 3 * H).overdue, true, 'no drink for 3 h since starting');
  const w = G.addBottle(s, { name: 'x', capacity: 500, icon: 'cup' });
  G.drink(s, w.id, 'drink', now + 4 * H);
  assert.equal(G.thirstInfo(s, now + 5 * H).overdue, false, 'a beverage also resets the timer');
  assert.equal(G.thirstInfo(s, now + 7 * H - 1).overdue, false);
  assert.equal(G.thirstInfo(s, now + 7 * H).overdue, true, '3 h after the last drink');
  assert.equal(G.thirstInfo(s, now + 7 * H).since, 3 * H);
  s.remindHours = 4;
  assert.equal(G.thirstInfo(s, now + 7 * H).overdue, false, 'custom interval');
  s.remindHours = 0;
  assert.equal(G.thirstInfo(s, now + 30 * H).overdue, false, 'reminder can be turned off');
  const old = G.createInitialState(now); delete old.remindHours; G.migrate(old);
  assert.equal(old.remindHours, 3, 'old saves get the default interval');
}

console.log('all tests passed');
