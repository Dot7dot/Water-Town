import assert from 'node:assert/strict';
import * as G from '../js/game.js';

const DAY = 86400000;
let now = new Date(2026, 10, 4, 9, 0).getTime();
const s = G.createInitialState(now);
assert.equal(s.plants.length, 7);
// every starter plant sits in a valid habitat
for (const p of s.plants) {
  const spot = p.wall ? { wall: p.wall } : { x: p.x, z: p.z };
  assert.ok(G.canPlacePlant(s, p.species, spot, p.id), 'starter ' + p.species);
}
// cactus never in river / near water; lotus only in pond; ivy only on walls
assert.equal(G.canPlacePlant(s, 'cactus', { x: 6, z: 0 }), false, 'cactus in river');
assert.equal(G.canPlacePlant(s, 'cactus', { x: 4, z: 3 }), false, 'cactus by river (rot)');
assert.equal(G.canPlacePlant(s, 'cactus', { x: 0, z: 0 }), true, 'cactus on dry grass');
assert.equal(G.canPlacePlant(s, 'waterlily', { x: 0, z: 0 }), false, 'lily on land');
assert.equal(G.canPlacePlant(s, 'waterlily', { x: 6, z: 0 }), true, 'lily in river');
assert.equal(G.canPlacePlant(s, 'lotus', { x: 6, z: 0 }), false, 'lotus needs a pond');
assert.equal(G.canPlacePlant(s, 'ivy', { x: 0, z: 0 }), false, 'ivy on ground');
assert.equal(G.canPlacePlant(s, 'palm', { x: 9, z: 9 }), false, 'palm on dry sand');
assert.equal(G.canPlacePlant(s, 'palm', { x: 7, z: 8 }), false, 'palm off sand');

// bottles + drinking
const w = G.addBottle(s, { name: 'Big', capacity: 1000, icon: 'jug' });
const c0 = s.coins;
let r = G.drink(s, w.id, 'water', now, () => 0.3);
assert.equal(r.coins, 10);
assert.equal(s.coins, c0 + 10);
assert.equal(r.sprouts.length, 2, 'two sprouts for 1000ml');
r = G.drink(s, w.id, 'drink', now + 1000, () => 0.3);
assert.equal(r.coins, 5, 'beverage gives half coins');
// sprouted plants are valid
for (const p of s.plants) {
  if (p.stored) continue;
  const spot = p.wall ? { wall: p.wall } : { x: p.x, z: p.z };
  assert.ok(G.canPlacePlant(s, p.species, spot, p.id), 'sprout valid ' + p.species);
}

// low hydration -> dry species only
const s2 = G.createInitialState(now);
const small = G.addBottle(s2, { name: 's', capacity: 500, icon: 'flask' });
s2.goal = 4000;
for (let i = 0; i < 20; i++) { s2.sproutProgress = 500; G.drink(s2, small.id, 'drink', now + i * 25 * 3600e3, () => Math.random()); }
const lowSpecies = [...new Set(s2.plants.slice(7).map((p) => p.species))];
console.log('species grown with low intake:', lowSpecies.join(','));
for (const sp of lowSpecies) assert.ok(G.PLANT_MAP[sp].tiers.some((t) => t === 'dry' || t === 'low'), 'dry-tier species ' + sp);
assert.ok(!lowSpecies.includes('lotus') && !lowSpecies.includes('waterlily'));

// death after three dry days, survival when drinking daily
const n = s.plants.length;
G.processDays(s, now + 2 * DAY);
let st = G.plantStatus(s, s.plants[0], now + 2 * DAY);
assert.equal(st.warn, true); assert.equal(st.dead, false);
G.processDays(s, now + 3 * DAY);
assert.equal(G.plantStatus(s, s.plants[0], now + 3 * DAY).urgent, true);
assert.equal(s.plants.some((p) => p.dead), false);
G.processDays(s, now + 4 * DAY);
assert.equal(s.plants.every((p) => p.dead), true, 'all die after 3 full dry days');
assert.ok(s.diary[G.dayKey(now)].score > 0);
console.log('day1 diary', s.diary[G.dayKey(now)]);

// survive with a tiny drink every day; perfect days -> bloom
const s3 = G.createInitialState(now);
const b3 = G.addBottle(s3, { name: 'x', capacity: 100, icon: 'cup' });
for (let d = 0; d < 6; d++) { G.processDays(s3, now + d * DAY); G.drink(s3, b3.id, 'water', now + d * DAY); }
G.processDays(s3, now + 6 * DAY);
assert.equal(s3.plants.some((p) => p.dead), false, 'tiny daily drink keeps plants alive');
const s4 = G.createInitialState(now);
const b4 = G.addBottle(s4, { name: 'x', capacity: 500, icon: 'cup' });
for (let d = 0; d < 5; d++) { G.processDays(s4, now + d * DAY); for (let k = 0; k < 4; k++) G.drink(s4, b4.id, 'water', now + d * DAY + k * 3 * 3600e3); }
G.processDays(s4, now + 5 * DAY);
console.log('stages after 5 perfect days:', s4.plants.slice(0, 7).map((p) => p.species + ':' + G.plantStage(p)).join(' '));
assert.equal(G.plantStage(s4.plants.find((p) => p.species === 'dandelion')), 'fruit');

// buildings
const s5 = G.createInitialState(now);
s5.coins = 500;
assert.ok(G.buy(s5, 'pond', now));
const pond = G.placeBuilding(s5, 'pond', 0, 8);
assert.ok(pond);
assert.equal(G.canPlacePlant(s5, 'lotus', { x: 0, z: 8 }), true, 'lotus in pond');
assert.equal(G.canPlacePlant(s5, 'clover', { x: 0, z: 8 }), false, 'no clover in pond');
assert.equal(G.canPlacePlant(s5, 'fern', { x: 2, z: 8 }), true, 'pond makes shore');
s5.inventory.seeds = 1;
const lot = G.plantSeed(s5, { x: 1, z: 9 }, now);
assert.ok(lot && G.PLANT_MAP[lot.species].habitat.some((h) => h === 'water' || h === 'pond'));
assert.ok(G.moveBuilding(s5, pond.id, 0, 6));
assert.equal(lot.x, 1); assert.equal(lot.z, 7, 'aquatic plant moves with the pond');
assert.ok(G.buy(s5, 'bridge', now));
assert.equal(G.canPlaceBuilding(s5, 'bridge', 0, 0), false);
assert.equal(G.canPlaceBuilding(s5, 'bridge', 6, 0), true);
assert.ok(G.buy(s5, 'well', now));
assert.ok(G.placeBuilding(s5, 'well', 1, 2));
assert.equal(G.canPlacePlant(s5, 'fern', { x: 0, z: 2 }), true, 'well moistens land');
G.storeBuilding(s5, s5.buildings[0].id);
assert.ok(s5.plants.find((p) => p.species === 'ivy').stored, 'vines are stored with their building');
assert.equal(G.validPlantSpots(s5, 'ivy').length, 0, 'no walls left for ivy');
console.log('all tests passed');
