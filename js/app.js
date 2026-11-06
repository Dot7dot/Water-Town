// App controller: wires game rules, 3D city and UI together.
import {
  GRID, TIERS, TIER_ORDER, PLANTS, PLANT_MAP, BUILDINGS, BUILDING_MAP, BOTTLE_PRESETS, BOTTLE_ICONS, BOTTLE_COLORS,
  HABITAT_TEXT, SEED_PRICE, SPROUT_EVERY_ML, DRINK_FACTOR, ML_PER_COIN, PERFECT_MIN, PERFECT_MAX,
} from './data.js';
import * as G from './game.js';
import { t, L, setLang, getLang, fmtCoins, fmtTime, fmtDay } from './i18n.js';
import { CityScene, thumbnail } from './scene.js';
import { bottleSVG, ICON, coinSVG } from './icons.js';
import { $, $$, esc, openSheet, openModal, closeAll, confirmBox, toast, floatText, confetti, haptic } from './ui.js';
import { showLoader, hideLoader } from './loader.js';

/* ================================================================ store */
const KEY = 'watertown.v1';
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
let offset = 0;
try { offset = DEBUG ? Number(localStorage.getItem('watertown.offset') || 0) : 0; } catch { offset = 0; }
const now = () => Date.now() + offset;

let state;
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return G.migrate(JSON.parse(raw));
  } catch (e) { console.warn('load failed', e); }
  return null;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); }
}

/* ================================================================ globals */
let scene;
let activeTab = 'city';
let mode = 'view';
let placing = null;
let selected = null;
let lastType = 'water';
let shopCat = 'building';
let diaryPane = 'diary';
let dexKind = 'plant';
let calMonth = null;

const today = () => G.dayKey(now());
const coin = (n, size = 18) => `<span class="price">${coinSVG(size)}${fmtCoins(n)}</span>`;
const plantName = (id) => L(PLANT_MAP[id].name);
const buildingName = (id) => L(BUILDING_MAP[id].name);

/* ================================================================ start */
export async function startApp() {
  state = load();
  if (!state) state = G.createInitialState(now(), getLang());
  setLang(state.lang);
  const res = G.processDays(state, now());
  save();

  // warm up the encyclopedia/shop thumbnails while the loader is visible
  for (const p of PLANTS) thumbnail('plant', p.id);
  for (const b of BUILDINGS) thumbnail('building', b.id);
  thumbnail('seed', 'seed');

  $('#app').hidden = false;
  scene = new CityScene($('#cityCanvas'), { onTap });
  renderStatic();
  bindStatic();
  renderAll();

  window.addEventListener('wt:ready', () => {
    if (res.deaths.length) toast(t('plantsDied', { n: res.deaths.length }), { icon: '🥀', warn: true, ms: 4000 });
    if (!state.welcomed) showWelcome();
    else maybeMorningReview();
  }, { once: true });

  setInterval(checkDay, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
}

function checkDay() {
  renderThirstIcon();
  if (today() === state.lastProcessed) { scene.sync(state, now()); renderThirst(); return; }
  const r = G.processDays(state, now());
  save();
  renderAll();
  if (r.deaths.length) toast(t('plantsDied', { n: r.deaths.length }), { icon: '🥀', warn: true, ms: 4000 });
  maybeMorningReview();
}

/* ================================================================ static UI */
function renderStatic() {
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.title = `${t('appName')} · Water Town`;
  $('#langBtn').textContent = getLang() === 'zh' ? 'EN' : '中';
  $('#settingsBtn').innerHTML = ICON.gear;
  $('#settingsBtn').setAttribute('aria-label', t('settings'));
  $('#coinIcon').innerHTML = coinSVG(24);
  const tabs = { city: ICON.city, diary: ICON.book, shop: ICON.shop };
  $$('.tab').forEach((b) => {
    const k = b.dataset.tab;
    const dot = b.querySelector('.tab-dot');
    b.innerHTML = `${tabs[k]}<span>${t('tab' + k[0].toUpperCase() + k.slice(1))}</span>`;
    if (dot) b.appendChild(dot);
  });
  $('#cameraBtn').innerHTML = ICON.camera; $('#cameraBtn').setAttribute('aria-label', t('camera'));
  $('#rotLBtn').innerHTML = ICON.rotL; $('#rotLBtn').setAttribute('aria-label', t('rotate'));
  $('#rotRBtn').innerHTML = ICON.rotR; $('#rotRBtn').setAttribute('aria-label', t('rotate'));
  const badge = $('#bagBadge');
  $('#bagBtn').innerHTML = ICON.bag; $('#bagBtn').appendChild(badge); $('#bagBtn').setAttribute('aria-label', t('backpack'));
  $('#drinkBtn').innerHTML = `${ICON.drop}<span>${t('drink')}</span>`;
}

function bindStatic() {
  $('#tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('.tab'); if (b) switchTab(b.dataset.tab);
  });
  $('#langBtn').addEventListener('click', () => changeLang(getLang() === 'zh' ? 'en' : 'zh'));
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#drinkBtn').addEventListener('click', () => { haptic(); openDrink(); });
  $('#cameraBtn').addEventListener('click', takePhoto);
  $('#rotLBtn').addEventListener('click', () => scene.rotateView(-1));
  $('#rotRBtn').addEventListener('click', () => scene.rotateView(1));
  $('#bagBtn').addEventListener('click', openBackpack);
  $('#drinkNudge').addEventListener('click', () => { haptic(); openDrink(); });
  $('#view-shop').addEventListener('click', onShopClick);
  $('#view-diary').addEventListener('click', onDiaryClick);
  $('#infoCard').addEventListener('click', onInfoClick);
  $('#placeBar').addEventListener('click', onPlaceBarClick);
}

function switchTab(tab) {
  if (mode === 'place' && tab !== 'city') exitPlace();
  activeTab = tab;
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${tab}`));
  if (tab === 'diary') { renderDiary(); markReviewSeen(); }
  if (tab === 'shop') renderShop();
  if (tab === 'city') { scene.resize(); }
  else deselect();
}

function changeLang(lang) {
  setLang(lang);
  state.lang = lang;
  save();
  renderStatic();
  renderAll();
  if (selected) renderInfo();
  if (placing) renderPlaceBar();
}

function renderAll() {
  renderCoins();
  renderHUD();
  renderThirst();
  renderBagBadge();
  renderThirstIcon();
  scene.sync(state, now());
  $('#diaryDot').hidden = !hasUnseenReview();
  if (activeTab === 'diary') renderDiary();
  if (activeTab === 'shop') renderShop();
}

function renderCoins(pop = false) {
  $('#coinVal').textContent = fmtCoins(state.coins);
  if (pop) { const p = $('#coinPill'); p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
}

function renderHUD() {
  const st = G.dayStats(state, today());
  const ratio = st.eff / state.goal;
  const tier = G.hydrationTier(state, now());
  const scale = 1.6;
  const fill = Math.min(1, ratio / scale) * 100;
  const sprout = Math.min(1, state.sproutProgress / SPROUT_EVERY_ML) * 100;
  $('#hudCard').innerHTML = `
    <div>
      <div class="hud-today">${t('today')} · ${t('goal')} ${state.goal} ml</div>
      <div class="hud-amount">${Math.round(st.eff)} <small>/ ${state.goal} ml</small></div>
    </div>
    <div class="tier-chip ${tier}" title="${esc(t('hydration'))}">${TIERS[tier].emoji} ${esc(L(TIERS[tier].name))}</div>
    <div class="liquid" aria-label="${Math.round(ratio * 100)}%">
      <div class="liquid-perfect" style="left:${(PERFECT_MIN / scale) * 100}%;width:${((PERFECT_MAX - PERFECT_MIN) / scale) * 100}%"></div>
      <div class="liquid-fill" style="width:${fill}%"></div>
      <div class="liquid-label">${Math.round(ratio * 100)}%</div>
    </div>
    <div class="hud-sub"><span>${esc(t('tierHint_' + tier))}</span>
      <span style="display:flex;gap:6px;align-items:center;white-space:nowrap">🌱 <span class="mini-bar"><i style="width:${sprout}%"></i></span></span></div>
    ${landHUD()}`;
}

function landHUD() {
  const lp = G.landProgress(state);
  const size = `${lp.size.w}×${lp.size.h}`;
  if (lp.done) return `<div class="hud-land"><span>🏝️ ${esc(t('landDone', { size }))}</span></div>`;
  return `<div class="hud-land"><span>🏝️ ${esc(t('landLine', { size, n: Math.ceil(lp.remaining) }))}</span>
    <span class="mini-bar land"><i style="width:${lp.frac * 100}%"></i></span></div>`;
}

/* "Too long without water": yellow icon (logo, tab icon, status bar), title, badge and a nudge. */
function fmtDuration(ms) {
  const h = Math.floor(ms / 3600e3); const m = Math.floor((ms % 3600e3) / 60e3);
  return m ? t('durHM', { h, m }) : t('durH', { h });
}
let iconWasThirsty = null;
function renderThirstIcon() {
  const info = G.thirstInfo(state, now());
  const on = info.overdue;
  document.body.classList.toggle('thirsty-mode', on);
  const nudge = $('#drinkNudge');
  nudge.hidden = !on;
  if (on) nudge.innerHTML = `<img src="icons/icon-thirsty.svg" alt="" />${esc(t('nudge', { t: fmtDuration(info.since) }))}`;
  document.title = on ? `${t('titleThirsty')} · ${t('appName')}` : `${t('appName')} · Water Town`;
  if (iconWasThirsty === on) return;
  iconWasThirsty = on;
  const fav = $('#favicon');
  if (fav) fav.href = on ? 'icons/icon-thirsty.svg' : 'icons/icon.svg';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', on ? '#ffd84d' : '#7cc8ff');
  // a badge on the installed app icon, where the system supports it
  try {
    if (on && navigator.setAppBadge) navigator.setAppBadge().catch(() => {});
    if (!on && navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  } catch { /* not supported */ }
}

function thirstyPlants() {
  return state.plants.filter((p) => !p.stored && G.plantStatus(state, p, now()).warn);
}
function renderThirst() {
  const n = thirstyPlants().length;
  const el = $('#thirstBanner');
  el.hidden = n === 0;
  if (n) el.innerHTML = `<span class="bang">!</span>${esc(t('plantsThirsty', { n }))}`;
}

function bagCount() {
  const b = Object.values(state.inventory.buildings).reduce((s, n) => s + n, 0);
  return b + (state.inventory.seeds || 0) + state.plants.filter((p) => p.stored).length;
}
function renderBagBadge() {
  const n = bagCount();
  const el = $('#bagBadge');
  el.hidden = n === 0;
  el.textContent = n;
}

/* ================================================================ drinking */
function openDrink() {
  if (mode === 'place') exitPlace();
  if (!state.bottles.length) { openNoBottle(); return; }
  let type = lastType;
  let bid = state.bottles.some((b) => b.id === state.lastBottleId) ? state.lastBottleId : state.bottles[0].id;
  const sheet = openSheet(`
    <div class="sheet-head"><h2>${t('chooseBottle')}</h2>
      <button class="btn ghost sm" data-act="manage">${ICON.edit}${t('manageBottles')}</button></div>
    <div class="seg type" id="typeSeg">
      <button data-v="water">💧 ${t('typeWater')}</button>
      <button data-v="drink">🧋 ${t('typeDrink')}</button>
    </div>
    <p class="note" id="halfNote">${t('drinkHalf')}</p>
    <div class="bottle-grid" id="bottleGrid"></div>
    <button class="btn green block" id="gulpBtn" style="min-height:56px;font-size:18px"></button>`);
  let managing = false;
  const render = () => {
    $$('#typeSeg button', sheet.el).forEach((b) => b.classList.toggle('on', b.dataset.v === type));
    $('#halfNote', sheet.el).style.visibility = type === 'drink' ? 'visible' : 'hidden';
    $('#bottleGrid', sheet.el).innerHTML = state.bottles.map((b) => `
      <button class="bottle-card ${b.id === bid ? 'on' : ''}" data-bid="${b.id}">
        ${managing ? `<span class="edit-dot" data-edit="${b.id}">${ICON.edit}</span>` : ''}
        ${bottleSVG(b.icon, b.color, 52)}
        <span class="bn">${esc(b.name)}</span><span class="bc">${b.capacity} ml</span>
      </button>`).join('') + `<button class="bottle-card add" data-act="add">${ICON.plus}<span class="bn">${t('addBottle')}</span></button>`;
    const b = state.bottles.find((x) => x.id === bid);
    const gain = b ? estimateCoins(b.capacity, type) : 0;
    $('#gulpBtn', sheet.el).innerHTML = `${t('confirmDrink')} <span style="opacity:.9">+${coin(gain, 20)}</span>`;
  };
  sheet.el.addEventListener('click', (e) => {
    const tb = e.target.closest('#typeSeg button');
    if (tb) { type = tb.dataset.v; haptic(8); render(); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) { const b = state.bottles.find((x) => x.id === ed.dataset.edit); openBottleEditor(b, () => { if (!state.bottles.some((x) => x.id === bid)) bid = state.bottles[0]?.id; if (!state.bottles.length) sheet.close(); else render(); }); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'manage') { managing = !managing; render(); return; }
    if (act === 'add') { openBottleEditor(null, (nb) => { if (nb) bid = nb.id; render(); }); return; }
    const card = e.target.closest('[data-bid]');
    if (card) { bid = card.dataset.bid; haptic(8); render(); return; }
    if (e.target.closest('#gulpBtn')) { sheet.close(); doDrink(bid, type); }
  });
  render();
}

function estimateCoins(capacity, type) {
  const bonus = state.buildings.some((b) => BUILDING_MAP[b.def].bonus) ? 1.1 : 1;
  return G.round1((capacity * (type === 'drink' ? DRINK_FACTOR : 1)) / ML_PER_COIN * bonus);
}

function doDrink(bid, type) {
  if (mode === 'place') exitPlace();
  deselect();
  switchTab('city');
  const res = G.drink(state, bid, type, now());
  if (!res) return;
  lastType = type;
  state.lastBottleId = bid;
  save();
  haptic(30);
  scene.rain(Math.min(2, res.log.amount / 500) * (type === 'drink' ? 0.6 : 1));
  const btn = $('#drinkBtn').getBoundingClientRect();
  floatText(`+${fmtCoins(res.coins)} ${coinSVG(26)}`, btn.left + btn.width / 2, btn.top - 10);
  renderCoins(true);
  renderHUD();
  renderThirst();
  renderThirstIcon();
  renderBagBadge();
  toast(`${t('earned', { n: fmtCoins(res.coins) })} · ${t('wateredAll', { n: res.watered })}${res.bonus ? ' · ' + t('bonusTower') : ''}`, { icon: type === 'drink' ? '🧋' : '💧' });
  setTimeout(() => {
    scene.sync(state, now());
    res.sprouts.forEach((p, i) => setTimeout(() => {
      scene.sparkle(p.id);
      toast(t('newSprout', { name: plantName(p.species) }), { icon: '🌱' });
    }, i * 450));
    if (res.land) {
      confetti(80);
      toast(t('landUnlocked', { n: res.land.cells, size: `${G.landProgress(state).size.w}×${G.landProgress(state).size.h}` }), { icon: '🏝️', ms: 4200 });
      haptic(60);
    } else if (res.full) toast(t('cityFull'), { icon: '🏡', warn: true, ms: 3500 });
    if (res.reachedGoal) { confetti(); toast(t('goalReached'), { icon: '🎉', ms: 3500 }); }
  }, 1000);
}

function openNoBottle() {
  const m = openModal(`
    <div class="welcome-art">${bottleSVG('flask', '#7cc8ff', 64)}${bottleSVG('sport', '#7be0b0', 64)}${bottleSVG('jug', '#ffb36b', 64)}</div>
    <h2 style="text-align:center">${t('noBottleTitle')}</h2>
    <p style="text-align:center">${t('noBottleText')}</p>
    <button class="btn block" data-a="add">${ICON.plus}${t('addBottle')}</button>`);
  m.el.addEventListener('click', (e) => {
    if (!e.target.closest('[data-a]')) return;
    m.close();
    openBottleEditor(null, (b) => { if (b) setTimeout(openDrink, 250); });
  });
}

function openBottleEditor(bottle, after) {
  const editing = !!bottle;
  let form = bottle ? { ...bottle } : { name: L(BOTTLE_PRESETS[0].name), capacity: 500, icon: 'flask', color: BOTTLE_PRESETS[0].color, preset: 'small' };
  const sheet = openSheet(`
    <div class="sheet-head"><h2>${editing ? t('editBottle') : t('addBottle')}</h2>
      <button class="icon-btn" data-close aria-label="${t('close')}">${ICON.close}</button></div>
    <div class="stack">
      ${editing ? '' : `<div class="field"><label>${t('presets')}</label><div class="preset-row" id="presetRow">
        ${BOTTLE_PRESETS.map((p) => `<button class="preset" data-preset="${p.key}">${bottleSVG(p.icon, p.color, 48)}<span>${esc(L(p.name))}</span><small>${p.capacity} ml</small></button>`).join('')}
      </div></div>`}
      <div class="field"><label for="bName">${t('bottleName')}</label><input class="input" id="bName" maxlength="20" /></div>
      <div class="field"><label for="bCap">${t('bottleCapacity')}</label><input class="input" id="bCap" type="number" inputmode="numeric" min="50" max="5000" step="10" /></div>
      <div class="field"><label>${t('bottleIcon')}</label><div class="icon-row" id="iconRow"></div></div>
      <div class="field"><label>${t('bottleColor')}</label><div class="color-row" id="colorRow"></div></div>
      <div class="row">
        ${editing ? `<button class="btn red sm" data-a="del">${ICON.trash}${t('delete')}</button>` : ''}
        <span style="flex:1"></span>
        <button class="btn ghost sm" data-close>${t('cancel')}</button>
        <button class="btn green sm" data-a="save">${t('save')}</button>
      </div>
    </div>`);
  const el = sheet.el;
  const render = () => {
    $('#bName', el).value = form.name;
    $('#bCap', el).value = form.capacity;
    $$('#presetRow .preset', el).forEach((b) => b.classList.toggle('on', b.dataset.preset === form.preset));
    $('#iconRow', el).innerHTML = BOTTLE_ICONS.map((i) => `<button class="icon-opt ${i === form.icon ? 'on' : ''}" data-icon="${i}">${bottleSVG(i, form.color, 40)}</button>`).join('');
    $('#colorRow', el).innerHTML = BOTTLE_COLORS.map((c) => `<button class="color-opt ${c === form.color ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
  };
  const readInputs = () => { form.name = $('#bName', el).value; form.capacity = Number($('#bCap', el).value) || form.capacity; };
  el.addEventListener('click', async (e) => {
    const pr = e.target.closest('[data-preset]');
    if (pr) { const p = BOTTLE_PRESETS.find((x) => x.key === pr.dataset.preset); form = { name: L(p.name), capacity: p.capacity, icon: p.icon, color: p.color, preset: p.key }; render(); return; }
    const ic = e.target.closest('[data-icon]');
    if (ic) { readInputs(); form.icon = ic.dataset.icon; form.preset = null; render(); return; }
    const co = e.target.closest('[data-color]');
    if (co) { readInputs(); form.color = co.dataset.color; render(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'save') {
      readInputs();
      if (!form.name.trim()) { $('#bName', el).focus(); return; }
      let b;
      if (editing) b = G.updateBottle(state, bottle.id, form);
      else b = G.addBottle(state, form);
      save();
      sheet.close();
      after && after(b);
    }
    if (a === 'del') {
      if (await confirmBox(t('deleteBottleQ'), { danger: true, okText: t('delete') })) {
        G.deleteBottle(state, bottle.id); save(); sheet.close(); after && after(null);
      }
    }
  });
  render();
}

/* ================================================================ city interaction */
function onTap(pick) {
  if (mode === 'place') { placeTap(pick); return; }
  if (pick.kind === 'plant' || pick.kind === 'building') { haptic(8); selectObj(pick.kind, pick.id); return; }
  deselect();
  if (pick.locked) {
    const lp = G.landProgress(state);
    if (!lp.done) toast(t('landLocked', { n: Math.ceil(lp.remaining) }), { icon: '🔒' });
  }
}

function selectObj(kind, id) {
  selected = { kind, id };
  scene.select(id);
  renderInfo();
}
function deselect() {
  selected = null;
  scene?.select(null);
  $('#infoCard').hidden = true;
  $('#drinkBtn').hidden = mode === 'place';
}

function sizeText(n, h) { return `${n}×${n}×${h}`; }

function renderInfo() {
  const card = $('#infoCard');
  if (!selected) { card.hidden = true; return; }
  let html = '';
  if (selected.kind === 'plant') {
    const p = state.plants.find((x) => x.id === selected.id);
    if (!p) { deselect(); return; }
    const sp = PLANT_MAP[p.species];
    const st = G.plantStatus(state, p, now());
    const lines = [];
    if (p.dead) lines.push(`<span class="pill red">🥀 ${t('deadInfo')}</span>`);
    else if (st.daysDry === 0) lines.push(`<span class="pill green">${t('wateredToday')}</span>`);
    else lines.push(`<span class="pill ${st.warn ? 'red' : 'yellow'}">❗ ${t('daysDry', { n: st.daysDry })}</span>`);
    if (!p.dead && st.urgent) lines.push(`<span class="pill red">⏰ ${t('dieToday')}</span>`);
    else if (!p.dead && st.warn) lines.push(`<span class="pill red">⏰ ${t('dieWarn', { n: st.daysLeft + 1 })}</span>`);
    if (!p.dead) {
      lines.push(`<span class="pill">🍃 ${t('leaves')} ${p.leaves}</span>`);
      lines.push(`<span class="pill">✨ ${t('perfectDays')} ${p.perfectDays}</span>`);
    }
    let size = sp.kind === 'wall' ? `1×${p.wall ? BUILDING_MAP[state.buildings.find((b) => b.id === p.wall.b)?.def]?.height || 1 : 1}` : `${sp.size}×${sp.size}`;
    lines.push(`<span class="pill">📐 ${size}</span>`);
    html = `
      <div class="info-head"><img src="${thumbnail('plant', p.species)}" alt="" />
        <div><div class="info-title">${esc(plantName(p.species))}</div>
        <div class="info-sub">${t('stage_' + st.stage)} · ${esc(sp.habitat.map((h) => L(HABITAT_TEXT[h])).join(' / '))}</div></div>
        <button class="icon-btn info-close" data-i="close" aria-label="${t('close')}">${ICON.close}</button></div>
      <div class="info-lines">${lines.join('')}</div>
      <div class="info-actions">
        ${p.dead ? `<button class="btn red sm" data-i="remove">${ICON.trash}${t('remove')}</button>` : `
          <button class="btn sm" data-i="move">${ICON.move}${t('move')}</button>
          <button class="btn ghost sm" data-i="store">${ICON.bag}${t('store')}</button>
          <button class="btn ghost sm" data-i="remove" aria-label="${t('remove')}">${ICON.trash}</button>`}
      </div>`;
  } else {
    const b = state.buildings.find((x) => x.id === selected.id);
    if (!b) { deselect(); return; }
    const def = BUILDING_MAP[b.def];
    const lines = [`<span class="pill">📐 ${sizeText(def.size, def.height)}</span>`];
    if (def.unlocks) lines.push(`<span class="pill green">🌱 ${t('unlocks')}：${esc(plantName(def.unlocks))}</span>`);
    if (def.walls) lines.push(`<span class="pill">🧱 ${esc(L(HABITAT_TEXT.wall))}</span>`);
    if (def.moist) lines.push(`<span class="pill">💧 ${esc(L(HABITAT_TEXT.shore))}</span>`);
    if (def.bonus) lines.push(`<span class="pill yellow">🪙 +10%</span>`);
    const canStore = b.def !== 'cottage' || state.buildings.filter((x) => x.def === 'cottage').length > 0;
    html = `
      <div class="info-head"><img src="${thumbnail('building', b.def)}" alt="" />
        <div><div class="info-title">${esc(buildingName(b.def))}</div><div class="info-sub">${esc(L(def.desc))}</div></div>
        <button class="icon-btn info-close" data-i="close" aria-label="${t('close')}">${ICON.close}</button></div>
      <div class="info-lines">${lines.join('')}</div>
      <div class="info-actions">
        <button class="btn sm" data-i="move">${ICON.move}${t('move')}</button>
        <button class="btn ghost sm" data-i="turn">${ICON.turn}${t('rotateObj')}</button>
        ${canStore ? `<button class="btn ghost sm" data-i="store">${ICON.bag}${t('store')}</button>` : ''}
      </div>`;
  }
  card.innerHTML = html;
  if (card.hidden) { card.hidden = false; card.classList.remove('animate__fadeInUp'); void card.offsetWidth; card.classList.add('animate__fadeInUp', 'animate__faster'); }
  $('#drinkBtn').hidden = true;
}

async function onInfoClick(e) {
  const a = e.target.closest('[data-i]')?.dataset.i;
  if (!a || !selected) return;
  const { kind, id } = selected;
  if (a === 'close') { deselect(); return; }
  if (kind === 'plant') {
    const p = state.plants.find((x) => x.id === id);
    if (a === 'move') startPlacing({ type: 'plant', id });
    if (a === 'store') { G.storePlant(state, id); save(); deselect(); renderAll(); toast(`${plantName(p.species)} → ${t('backpack')}`, { icon: '🎒' }); }
    if (a === 'remove') {
      if (await confirmBox(p.dead ? t('removeDeadQ') : t('removePlantQ'), { danger: true, okText: t('remove') })) {
        G.removePlant(state, id); save(); deselect(); renderAll();
      }
    }
  } else {
    const b = state.buildings.find((x) => x.id === id);
    if (a === 'move') startPlacing({ type: 'moveBuilding', id, rot: b.rot || 0 });
    if (a === 'turn') { G.rotateBuilding(state, id); save(); scene.sync(state, now()); scene.select(id); }
    if (a === 'store') {
      const vines = state.plants.some((p) => p.wall && p.wall.b === id) || G.carriedPlants(state, b).length;
      if (vines && !(await confirmBox(t('storeWithVines'), { okText: t('store') }))) return;
      G.storeBuilding(state, id); save(); deselect(); renderAll();
      toast(`${buildingName(b.def)} → ${t('backpack')}`, { icon: '🎒' });
    }
  }
}

/* ---------------------------------------------------------------- placement */
function placingSize() {
  if (!placing) return 1;
  if (placing.type === 'newBuilding') return BUILDING_MAP[placing.def].size;
  if (placing.type === 'moveBuilding') return BUILDING_MAP[state.buildings.find((b) => b.id === placing.id).def].size;
  if (placing.type === 'plant') return PLANT_MAP[state.plants.find((p) => p.id === placing.id).species].size;
  return 1;
}
function placingIsWall() {
  return placing?.type === 'plant' && PLANT_MAP[state.plants.find((p) => p.id === placing.id).species].kind === 'wall';
}

function startPlacing(spec) {
  closeAll();
  deselect();
  if (activeTab !== 'city') switchTab('city');
  mode = 'place';
  placing = { rot: 0, ...spec, spot: null, valid: false };
  let spots = [];
  if (spec.type === 'newBuilding') spots = G.validBuildingSpots(state, spec.def);
  if (spec.type === 'moveBuilding') spots = G.validBuildingSpots(state, state.buildings.find((b) => b.id === spec.id).def, spec.id);
  if (spec.type === 'plant') spots = G.validPlantSpots(state, state.plants.find((p) => p.id === spec.id).species, spec.id);
  if (spec.type === 'seed') spots = G.validSeedSpots(state, now());
  placing.count = spots.length;
  scene.showSpots(spots, placingSize());
  $('#drinkBtn').hidden = true;
  renderPlaceBar();
  if (!spots.length) toast(t('notPlaceable'), { icon: '🤔', warn: true });
}

function ghostSpec() {
  if (placing.type === 'newBuilding') return { type: 'building', def: placing.def, rot: placing.rot };
  if (placing.type === 'moveBuilding') return { type: 'building', def: state.buildings.find((b) => b.id === placing.id).def, rot: placing.rot };
  if (placing.type === 'plant') return { type: 'plant', plant: state.plants.find((p) => p.id === placing.id) };
  return { type: 'seed' };
}

function checkSpot(spot) {
  if (!spot) return false;
  switch (placing.type) {
    case 'newBuilding': return !spot.wall && G.canPlaceBuilding(state, placing.def, spot.x, spot.z);
    case 'moveBuilding': return !spot.wall && G.canPlaceBuilding(state, state.buildings.find((b) => b.id === placing.id).def, spot.x, spot.z, placing.id);
    case 'plant': return G.canPlacePlant(state, state.plants.find((p) => p.id === placing.id).species, spot, placing.id);
    case 'seed': return G.seedSpecies(state, spot, now(), () => 0) !== null;
    default: return false;
  }
}

function placeTap(pick) {
  const size = placingSize();
  let spot = null;
  if (placingIsWall()) spot = pick.wall ? { wall: pick.wall } : null;
  else if (placing.type === 'seed' && pick.wall) spot = { wall: pick.wall };
  else if (pick.cell) {
    let { x, z } = pick.cell;
    if (size === 2 && !pick.mark && pick.point) { x = Math.round(pick.point.x + GRID / 2 - 1); z = Math.round(pick.point.z + GRID / 2 - 1); }
    x = Math.max(0, Math.min(GRID - size, x)); z = Math.max(0, Math.min(GRID - size, z));
    spot = { x, z };
  }
  if (!spot) { toast(t('placingWall'), { icon: '🧱' }); return; }
  const same = placing.spot && JSON.stringify(placing.spot) === JSON.stringify(spot);
  if (same && placing.valid) { confirmPlace(); return; }
  placing.spot = spot;
  placing.valid = checkSpot(spot);
  haptic(placing.valid ? 8 : 25);
  scene.setGhost(ghostSpec(), spot, placing.valid);
  renderPlaceBar();
}

function invalidReason(spot) {
  if (!spot || spot.wall) return t('reasonHabitat');
  const info = G.cellInfo(state, spot.x, spot.z);
  if (!info.unlocked) return t('reasonLocked');
  const selfId = placing.id;
  if ((info.building && info.building.id !== selfId && !(BUILDING_MAP[info.building.def].pond && placing.type !== 'newBuilding' && placing.type !== 'moveBuilding')) || (info.plant && info.plant.id !== selfId)) return t('reasonOccupied');
  return t('reasonHabitat');
}

function renderPlaceBar() {
  const bar = $('#placeBar');
  if (!placing) { bar.hidden = true; return; }
  const isB = placing.type === 'newBuilding' || placing.type === 'moveBuilding';
  let hint = placingIsWall() ? t('placingWall') : t('placing');
  if (placing.spot && !placing.valid) hint = `<span style="color:var(--red-dk)">${esc(t('invalidSpot', { reason: invalidReason(placing.spot) }))}</span>`;
  else if (placing.type === 'seed' && !placing.spot) hint = `${esc(t('placing'))}<br><small style="color:var(--ink-soft)">${esc(t('seedHint'))}</small>`;
  bar.innerHTML = `
    <div class="hint">${hint}</div>
    ${isB ? `<button class="btn ghost round" data-p="rot" aria-label="${t('rotateObj')}">${ICON.turn}</button>` : ''}
    <button class="btn ghost round" data-p="cancel" aria-label="${t('cancel')}">${ICON.close}</button>
    <button class="btn green round" data-p="ok" aria-label="${t('place')}" ${placing.valid ? '' : 'disabled'}>${ICON.check}</button>`;
  if (bar.hidden) { bar.hidden = false; bar.classList.add('animate__fadeInUp', 'animate__faster'); }
}

function onPlaceBarClick(e) {
  const a = e.target.closest('[data-p]')?.dataset.p;
  if (!a) return;
  if (a === 'cancel') exitPlace();
  if (a === 'rot') { placing.rot = (placing.rot + 1) % 4; if (placing.spot) scene.setGhost(ghostSpec(), placing.spot, placing.valid); }
  if (a === 'ok' && placing.valid) confirmPlace();
}

function confirmPlace() {
  const p = placing;
  let focusId = null;
  if (p.type === 'newBuilding') {
    const b = G.placeBuilding(state, p.def, p.spot.x, p.spot.z);
    if (b) { b.rot = p.rot; focusId = b.id; }
  } else if (p.type === 'moveBuilding') {
    if (G.moveBuilding(state, p.id, p.spot.x, p.spot.z)) { state.buildings.find((b) => b.id === p.id).rot = p.rot; focusId = p.id; }
  } else if (p.type === 'plant') {
    if (G.movePlant(state, p.id, p.spot)) focusId = p.id;
  } else if (p.type === 'seed') {
    const plant = G.plantSeed(state, p.spot, now());
    if (plant) { focusId = plant.id; toast(t('sproutedFromSeed', { name: plantName(plant.species) }), { icon: '🌱', ms: 3200 }); }
  }
  save();
  exitPlace();
  renderAll();
  if (focusId) { scene.sparkle(focusId); haptic(20); }
}

function exitPlace() {
  mode = 'view';
  placing = null;
  scene.clearOverlay();
  $('#placeBar').hidden = true;
  $('#drinkBtn').hidden = false;
}

/* ================================================================ backpack */
function openBackpack() {
  if (mode === 'place') exitPlace();
  const inv = state.inventory;
  const bItems = Object.entries(inv.buildings).filter(([, n]) => n > 0);
  const stored = state.plants.filter((p) => p.stored);
  const empty = !bItems.length && !stored.length && !(inv.seeds > 0);
  const sheet = openSheet(`
    <div class="sheet-head"><h2>🎒 ${t('backpackTitle')}</h2><button class="icon-btn" data-close aria-label="${t('close')}">${ICON.close}</button></div>
    ${empty ? `<div class="empty">${t('backpackEmpty')}</div><button class="btn block" data-b="shop">${ICON.shop}${t('tabShop')}</button>` : ''}
    <div class="bag-list">
      ${inv.seeds > 0 ? `<div class="section-label">${t('seeds')}</div>
        <div class="bag-item"><img src="${thumbnail('seed', 'seed')}" alt="" /><div class="bm"><b>${t('seeds')} ×${inv.seeds}</b><small>${t('seedHint')}</small></div>
        <button class="btn green sm" data-b="seed">${t('place')}</button></div>` : ''}
      ${bItems.length ? `<div class="section-label">${t('buildingsDecor')}</div>` : ''}
      ${bItems.map(([id, n]) => `<div class="bag-item"><img src="${thumbnail('building', id)}" alt="" /><div class="bm"><b>${esc(buildingName(id))} ×${n}</b><small>${sizeText(BUILDING_MAP[id].size, BUILDING_MAP[id].height)}</small></div>
        <button class="btn green sm" data-b="building" data-id="${id}">${t('place')}</button></div>`).join('')}
      ${stored.length ? `<div class="section-label">${t('storedPlants')}</div>` : ''}
      ${stored.map((p) => `<div class="bag-item"><img src="${thumbnail('plant', p.species)}" alt="" /><div class="bm"><b>${esc(plantName(p.species))}</b><small>${t('stage_' + G.plantStage(p))}</small></div>
        ${p.dead ? `<button class="btn red sm" data-b="del" data-id="${p.id}">${ICON.trash}</button>` : `<button class="btn green sm" data-b="plant" data-id="${p.id}">${t('place')}</button>`}</div>`).join('')}
    </div>`);
  sheet.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-b]');
    if (!b) return;
    const a = b.dataset.b;
    if (a === 'shop') { sheet.close(); switchTab('shop'); }
    if (a === 'seed') startPlacing({ type: 'seed' });
    if (a === 'building') startPlacing({ type: 'newBuilding', def: b.dataset.id });
    if (a === 'plant') startPlacing({ type: 'plant', id: b.dataset.id });
    if (a === 'del') { G.removePlant(state, b.dataset.id); save(); sheet.close(); renderAll(); openBackpack(); }
  });
}

/* ================================================================ shop */
function renderShop() {
  const items = shopCat === 'seed' ? [] : BUILDINGS.filter((b) => b.cat === shopCat);
  const meta = (d) => {
    const m = [`<span class="pill">📐 ${sizeText(d.size, d.height)}</span>`];
    if (d.unlocks) m.push(`<span class="pill green">🌱 ${esc(plantName(d.unlocks))}</span>`);
    if (d.moist) m.push('<span class="pill">💧</span>');
    if (d.walls) m.push('<span class="pill">🧱</span>');
    if (d.bonus) m.push('<span class="pill yellow">+10%</span>');
    const owned = (state.inventory.buildings[d.id] || 0) + state.buildings.filter((b) => b.def === d.id).length;
    if (owned) m.push(`<span class="pill">${t('owned', { n: owned })}</span>`);
    return m.join('');
  };
  $('#view-shop').innerHTML = `
    <div class="page">
      <div class="card shop-bal">
        <div><div class="section-label" style="margin:0">${t('coins')}</div><div class="big">${coinSVG(30)}${fmtCoins(state.coins)}</div></div>
        <button class="btn ghost sm" data-s="bag">${ICON.bag}${t('backpack')}${bagCount() ? ` (${bagCount()})` : ''}</button>
      </div>
      <div class="seg" id="shopSeg">
        ${['building', 'deco', 'seed'].map((c) => `<button data-cat="${c}" class="${shopCat === c ? 'on' : ''}">${t(c === 'building' ? 'shopBuildings' : c === 'deco' ? 'shopDeco' : 'shopSeeds')}</button>`).join('')}
      </div>
      <div class="shop-grid">
        ${shopCat === 'seed' ? `
          <div class="shop-item animate__animated animate__fadeInUp animate__faster">
            <img src="${thumbnail('seed', 'seed')}" alt="" />
            <div class="sn">${t('seeds')}</div><div class="sd">${t('seedDesc')}</div>
            <div class="meta"><span class="pill">${t('owned', { n: state.inventory.seeds || 0 })}</span></div>
            <button class="btn sm" data-buy="seed" ${state.coins < SEED_PRICE ? 'disabled' : ''}>${coin(SEED_PRICE)}</button>
          </div>` : items.map((d, i) => `
          <div class="shop-item animate__animated animate__fadeInUp animate__faster" style="animation-delay:${i * 40}ms">
            <img src="${thumbnail('building', d.id)}" alt="" loading="lazy" />
            <div class="sn">${esc(L(d.name))}</div><div class="sd">${esc(L(d.desc))}</div>
            <div class="meta">${meta(d)}</div>
            <button class="btn sm" data-buy="${d.id}" ${state.coins < d.price ? 'disabled' : ''}>${coin(d.price)}</button>
          </div>`).join('')}
      </div>
    </div>`;
}

function onShopClick(e) {
  const cat = e.target.closest('[data-cat]');
  if (cat) { shopCat = cat.dataset.cat; renderShop(); return; }
  if (e.target.closest('[data-s="bag"]')) { openBackpack(); return; }
  const b = e.target.closest('[data-buy]');
  if (!b) return;
  const id = b.dataset.buy;
  const ok = id === 'seed' ? G.buySeed(state) : G.buy(state, id, now());
  if (!ok) { toast(t('notEnough'), { icon: '💸', warn: true }); return; }
  save();
  haptic(20);
  renderCoins(true);
  renderBagBadge();
  renderShop();
  const name = id === 'seed' ? t('seeds') : buildingName(id);
  const m = openModal(`
    <div style="text-align:center"><img src="${thumbnail(id === 'seed' ? 'seed' : 'building', id)}" alt="" style="width:140px;height:140px" class="animate__animated animate__tada" /></div>
    <h2 style="text-align:center">${esc(t('bought', { name }))}</h2>
    <div class="row"><button class="btn ghost block" data-close>${t('later')}</button>
    <button class="btn green block" data-a="place">${t('placeNow')}</button></div>`);
  m.el.addEventListener('click', (ev) => {
    if (!ev.target.closest('[data-a="place"]')) return;
    m.close();
    startPlacing(id === 'seed' ? { type: 'seed' } : { type: 'newBuilding', def: id });
  });
}

/* ================================================================ diary */
function yesterdayEntry() { return state.diary[G.addDays(today(), -1)] || null; }
function hasUnseenReview() { return !!yesterdayEntry() && state.seenReview !== today(); }
function markReviewSeen() {
  if (state.seenReview !== today()) { state.seenReview = today(); save(); }
  $('#diaryDot').hidden = true;
}

function starsHTML(n) { return `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`; }
function entryTexts(e) {
  return {
    msgs: e.msgs.map((k) => t(k)),
    tips: e.tips.map((k) => t(k, { n: e.streak || 0 })),
  };
}

function coverHTML() {
  const y = yesterdayEntry();
  const tk = today();
  if (!y) {
    return `<div class="card cover">
      <div class="cover-top"><span class="cover-label">📔 ${t('diaryTitle')}</span><span class="cover-date">${fmtDay(tk)}</span></div>
      <div class="cover-text" style="position:relative;z-index:1;margin-top:12px;font-size:15px">${t('noYesterday')}</div>
      <div class="cover-tips"><div class="cover-tip">🎯 ${t('todayGoalLine', { g: state.goal })}</div></div>
    </div>`;
  }
  const tx = entryTexts(y);
  return `<div class="card cover">
    <div class="cover-top"><span class="cover-label">📔 ${t('yesterdayReview')}</span><span class="cover-date">${fmtDay(y.day)}</span></div>
    <div class="cover-body">
      <div class="score-ring" style="--p:${y.score}"><div><b>${y.score}</b><small>${t('scoreLabel')}</small></div></div>
      <div class="cover-text">${starsHTML(y.stars)}<div class="cover-msg">${esc(tx.msgs.join(' '))}</div></div>
    </div>
    <div class="cover-stats">
      <span>💧 ${Math.round(y.eff)} / ${y.goal} ml</span>
      <span>🥤 ${t('times', { n: y.count })}</span>
      ${y.drink ? `<span>🧋 ${y.drink} ml</span>` : ''}
      ${y.died ? `<span>🥀 ${y.died}</span>` : ''}
    </div>
    <div class="cover-tips">
      ${tx.tips.map((s) => `<div class="cover-tip">💡 ${esc(s)}</div>`).join('')}
      <div class="cover-tip">🎯 ${t('todayGoalLine', { g: state.goal })}</div>
    </div>
  </div>`;
}

function logItemHTML(l, deletable) {
  return `<div class="log-item">
    <span class="lt">${fmtTime(l.ts)}</span>
    ${bottleSVG(l.icon || 'flask', l.color || '#7cc8ff', 36)}
    <span class="lm"><b>${l.amount} ml</b><small>${esc(l.bottleName || '')} <span class="tag ${l.type}">${l.type === 'drink' ? t('beverage') : t('water')}</span></small></span>
    <span class="lc">+${fmtCoins(l.coins)}${coinSVG(16)}</span>
    ${deletable ? `<button class="del" data-del="${l.id}" aria-label="${t('delete')}">${ICON.trash}</button>` : ''}
  </div>`;
}

function calendarHTML() {
  const tk = today();
  if (!calMonth) { const [y, m] = tk.split('-').map(Number); calMonth = { y, m }; }
  const { y, m } = calMonth;
  const first = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const wd = t('weekdays');
  let cells = wd.map((d) => `<div class="cal-wd">${d}</div>`).join('');
  for (let i = 0; i < first; i++) cells += '<div></div>';
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const e = state.diary[key];
    let cls = 'cal-day'; let inner = `${d}`;
    if (e) { cls += ` has s${e.stars}`; inner = `${d}<span class="drop">${e.perfect ? '💧' : e.stars >= 3 ? '💦' : e.count ? '·' : '🥀'}</span>`; }
    if (key === tk) {
      const st = G.dayStats(state, tk);
      cls += ' today has';
      inner = `${d}<span class="drop">${st.count ? Math.round(st.ratio * 100) + '%' : '·'}</span>`;
    }
    cells += `<button class="${cls}" ${e || key === tk ? `data-day="${key}"` : 'disabled'}>${inner}</button>`;
  }
  return `<div class="card">
    <div class="cal-head"><button class="icon-btn" data-cal="-1" aria-label="prev">${ICON.chevL}</button>
      <b>📅 ${t('monthFmt', { y, m })}</b>
      <button class="icon-btn" data-cal="1" aria-label="next">${ICON.chevR}</button></div>
    <div class="cal-grid">${cells}</div>
    <div class="cal-legend"><i style="background:#ffc9cf"></i><i style="background:#ffd9b3"></i><i style="background:#fff1b3"></i><i style="background:#c5f0c6"></i><i style="background:#9fe3b0"></i> ★1 → ★5</div>
  </div>`;
}

function dexHTML() {
  const list = dexKind === 'plant' ? PLANTS : BUILDINGS;
  const disc = dexKind === 'plant' ? state.discovered.plants : state.discovered.buildings;
  const got = list.filter((x) => disc[x.id]).length;
  return `
    <div class="seg" id="dexSeg">
      <button data-dex="plant" class="${dexKind === 'plant' ? 'on' : ''}">🌿 ${t('plantDex')}</button>
      <button data-dex="building" class="${dexKind === 'building' ? 'on' : ''}">🏠 ${t('buildingDex')}</button>
    </div>
    <div class="card">
      <h3>${dexKind === 'plant' ? '🌿' : '🏠'} ${t('collected', { a: got, b: list.length })}</h3>
      <div class="dex-progress"><i style="width:${(got / list.length) * 100}%"></i></div>
      <div class="dex-grid">
        ${list.map((x) => {
          const known = !!disc[x.id];
          const name = known || dexKind === 'building' ? L(x.name) : t('unknown');
          return `<button class="dex-item ${known ? '' : 'locked'}" data-dexid="${x.id}"><img src="${thumbnail(dexKind, x.id)}" alt="" loading="lazy" /><span class="dn">${esc(name)}</span></button>`;
        }).join('')}
      </div>
    </div>`;
}

function renderDiary() {
  const tk = today();
  const st = G.dayStats(state, tk);
  const logs = [...st.logs].reverse();
  $('#view-diary').innerHTML = `
    <div class="page">
      <div class="seg" id="diarySeg">
        <button data-pane="diary" class="${diaryPane === 'diary' ? 'on' : ''}">📔 ${t('diaryTab')}</button>
        <button data-pane="dex" class="${diaryPane === 'dex' ? 'on' : ''}">📚 ${t('dexTab')}</button>
      </div>
      ${diaryPane === 'diary' ? `
        ${coverHTML()}
        <div class="card">
          <h3>🥤 ${t('todayRecord')}</h3>
          <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:10px">
            <span class="pill">${t('total')} ${st.water + st.drink} ml</span>
            <span class="pill">💧 ${t('water')} ${st.water} ml</span>
            <span class="pill">🧋 ${t('beverage')} ${st.drink} ml</span>
            <span class="pill">${coinSVG(14)} +${fmtCoins(st.coins)}</span>
          </div>
          <div class="log-list">${logs.length ? logs.map((l) => logItemHTML(l, true)).join('') : `<div class="empty">${t('noRecordToday')}</div>`}</div>
        </div>
        ${calendarHTML()}` : dexHTML()}
    </div>`;
}

async function onDiaryClick(e) {
  const pane = e.target.closest('[data-pane]');
  if (pane) { diaryPane = pane.dataset.pane; renderDiary(); return; }
  const dx = e.target.closest('[data-dex]');
  if (dx) { dexKind = dx.dataset.dex; renderDiary(); return; }
  const cal = e.target.closest('[data-cal]');
  if (cal) {
    let { y, m } = calMonth; m += Number(cal.dataset.cal);
    if (m < 1) { m = 12; y -= 1; } if (m > 12) { m = 1; y += 1; }
    calMonth = { y, m }; renderDiary(); return;
  }
  const del = e.target.closest('[data-del]');
  if (del) {
    if (await confirmBox(t('deleteLogQ'), { danger: true, okText: t('delete') })) {
      G.deleteLog(state, del.dataset.del, now()); save(); renderAll();
    }
    return;
  }
  const day = e.target.closest('[data-day]');
  if (day) { openDayDetail(day.dataset.day); return; }
  const di = e.target.closest('[data-dexid]');
  if (di) openDexDetail(dexKind, di.dataset.dexid);
}

function openDayDetail(day) {
  const e = state.diary[day];
  const st = G.dayStats(state, day);
  const tx = e ? entryTexts(e) : null;
  openModal(`
    <h2>📔 ${t('dayDetail', { d: fmtDay(day) })}</h2>
    ${e ? `<div class="row" style="margin-bottom:10px"><div class="score-ring" style="--p:${e.score};width:80px;height:80px;background:conic-gradient(var(--blue) calc(var(--p)*1%),#e5f2fc 0)"><div style="width:62px;height:62px;background:#fff;color:var(--ink)"><b style="font-size:24px">${e.score}</b><small>${t('scoreLabel')}</small></div></div>
      <div><div style="color:#f5b400">${starsHTML(e.stars)}</div><div style="font-size:14px;line-height:1.5">${esc(tx.msgs.join(' '))}</div></div></div>
      ${tx.tips.map((s) => `<p style="font-size:14px;background:#f6faff;padding:8px 12px;border-radius:12px">💡 ${esc(s)}</p>`).join('')}` : ''}
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:10px">
      <span class="pill">💧 ${Math.round(st.eff)} / ${state.goal} ml</span><span class="pill">🥤 ${t('times', { n: st.count })}</span>
    </div>
    <div class="log-list">${st.logs.length ? st.logs.map((l) => logItemHTML(l, false)).join('') : `<div class="empty">${t('noRecordToday')}</div>`}</div>
    <div class="row end" style="margin-top:14px"><button class="btn sm" data-close>${t('close')}</button></div>`);
}

function openDexDetail(kind, id) {
  const x = kind === 'plant' ? PLANT_MAP[id] : BUILDING_MAP[id];
  const disc = (kind === 'plant' ? state.discovered.plants : state.discovered.buildings)[id];
  const rows = [];
  if (kind === 'plant') {
    rows.push([t('habitat'), x.habitat.map((h) => L(HABITAT_TEXT[h])).join('、')]);
    rows.push([t('tiersLabel'), x.tiers.map((k) => `${TIERS[k].emoji} ${L(TIERS[k].name)}`).join('　')]);
    if (x.requires) rows.push([t('requiresLabel'), `🏠 ${buildingName(x.requires)}`]);
    rows.push([t('size'), x.kind === 'wall' ? '1×1 / 1×2 🧱' : `${x.size}×${x.size}`]);
    const feats = [x.bloom ? `🌸 ${t('canBloom')}` : '', x.fruit ? `🍎 ${t('canFruit')}` : ''].filter(Boolean).join('　');
    if (feats) rows.push(['✨', feats]);
    if (disc) rows.push(['🏙️', t('inCity', { n: state.plants.filter((p) => p.species === id && !p.dead).length })]);
  } else {
    rows.push([t('size'), sizeText(x.size, x.height)]);
    rows.push(['🪙', fmtCoins(x.price)]);
    if (x.unlocks) rows.push([t('unlocks'), `🌱 ${plantName(x.unlocks)}`]);
  }
  rows.push(['📅', disc ? t('discoveredOn', { d: fmtDay(disc) }) : t('notDiscovered')]);
  const showName = disc || kind === 'building';
  openModal(`
    <div class="dex-detail ${disc ? '' : 'locked'}">
      <img src="${thumbnail(kind, id)}" alt="" class="animate__animated animate__bounceIn" />
      <h2>${esc(showName ? L(x.name) : t('unknown'))}</h2>
      <p>${esc(disc ? L(x.desc) : `${t('hint')}：${kind === 'plant' ? x.habitat.map((h) => L(HABITAT_TEXT[h])).join('、') : L(x.desc)}`)}</p>
      <div class="kv">${rows.map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>
      <div class="row end" style="margin-top:14px"><button class="btn sm" data-close>${t('close')}</button></div>
    </div>`);
}

function maybeMorningReview() {
  if (!hasUnseenReview()) { $('#diaryDot').hidden = true; return; }
  $('#diaryDot').hidden = false;
  const m = openModal(`
    <h2 style="text-align:center">☀️ ${t('morningTitle')}</h2>
    ${coverHTML()}
    <div class="row" style="margin-top:14px"><button class="btn ghost block" data-a="diary">📔 ${t('diaryTab')}</button><button class="btn block" data-close>${t('ok')}</button></div>`,
  { onClose: () => markReviewSeen() });
  m.el.addEventListener('click', (e) => { if (e.target.closest('[data-a="diary"]')) { m.close(); switchTab('diary'); } });
}

/* ================================================================ settings */
function openSettings() {
  const m = openSheet(`
    <div class="sheet-head"><h2>⚙️ ${t('settings')}</h2><button class="icon-btn" data-close aria-label="${t('close')}">${ICON.close}</button></div>
    <div class="stack">
      <div class="field"><label>${t('language')}</label>
        <div class="seg" id="langSeg"><button data-lang="zh" class="${getLang() === 'zh' ? 'on' : ''}">繁體中文</button><button data-lang="en" class="${getLang() === 'en' ? 'on' : ''}">English</button></div></div>
      <div class="field"><label>${t('dailyGoal')}：<b id="goalVal">${state.goal}</b> ml</label>
        <input type="range" id="goalRange" min="1000" max="4000" step="100" value="${state.goal}" /></div>
      <div class="field"><label>💛 ${t('remindLabel')}</label>
        <div class="seg" id="remindSeg">${G.REMIND_OPTIONS.map((h) => `<button data-remind="${h}" class="${(state.remindHours ?? 3) === h ? 'on' : ''}">${h ? t('remindHours', { n: h }) : t('remindOff')}</button>`).join('')}</div>
        <p class="note" style="text-align:left;margin:2px 2px 0">${t('remindNote')}</p></div>
      <div class="field"><label>${t('weightCalc')}</label>
        <div class="row"><input class="input" id="weightIn" type="number" inputmode="decimal" placeholder="${t('weight')}" style="flex:1" />
        <button class="btn sm" data-a="weight">${t('apply')}</button></div></div>
      <div class="card" style="background:#f6faff;box-shadow:none"><h3>📜 ${t('rules')}</h3><p style="margin:0;font-size:14px">${t('about')}</p></div>
      <button class="btn ghost" data-a="bottles">${ICON.edit}${t('manageBottles')}</button>
      ${DEBUG ? `<button class="btn yellow" data-a="skip">⏩ ${t('debugSkip')}</button>` : ''}
      <button class="btn red" data-a="reset">${ICON.trash}${t('resetData')}</button>
    </div>`);
  const el = m.el;
  $('#goalRange', el).addEventListener('input', (e) => { $('#goalVal', el).textContent = e.target.value; });
  $('#goalRange', el).addEventListener('change', (e) => { state.goal = Number(e.target.value); save(); renderAll(); });
  el.addEventListener('click', async (e) => {
    const lb = e.target.closest('[data-lang]');
    if (lb) { changeLang(lb.dataset.lang); m.close(); setTimeout(openSettings, 230); return; }
    const rb = e.target.closest('[data-remind]');
    if (rb) {
      state.remindHours = Number(rb.dataset.remind); save();
      $$('#remindSeg button', el).forEach((b) => b.classList.toggle('on', b === rb));
      renderThirstIcon();
      return;
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'weight') {
      const w = Number($('#weightIn', el).value);
      if (w > 20 && w < 250) {
        state.goal = Math.max(1000, Math.min(4000, Math.round((w * 30) / 100) * 100));
        save(); renderAll();
        $('#goalRange', el).value = state.goal; $('#goalVal', el).textContent = state.goal;
      }
    }
    if (a === 'bottles') { m.close(); setTimeout(openDrink, 230); }
    if (a === 'skip') {
      offset += 86400000;
      try { localStorage.setItem('watertown.offset', String(offset)); } catch { /* ignore */ }
      m.close(); checkDay();
    }
    if (a === 'reset') {
      if (await confirmBox(t('resetQ'), { danger: true, okText: t('resetData') })) {
        m.close();
        showLoader('loading');
        try { localStorage.removeItem(KEY); localStorage.removeItem('watertown.offset'); } catch { /* ignore */ }
        offset = 0;
        state = G.createInitialState(now(), getLang());
        save();
        renderAll();
        setTimeout(() => { hideLoader(); showWelcome(); }, 1800);
      }
    }
  });
}

/* ================================================================ camera */
async function takePhoto() {
  if (mode === 'place') exitPlace();
  deselect();
  haptic(40);
  const flash = $('#flash');
  flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
  const shot = scene.capture();
  const img = new Image();
  img.src = shot;
  await img.decode();
  const pad = Math.round(img.width * 0.04);
  const footer = Math.round(img.width * 0.2);
  const cv = document.createElement('canvas');
  cv.width = img.width + pad * 2; cv.height = img.height + pad + footer;
  const x = cv.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, cv.width, cv.height);
  x.drawImage(img, pad, pad);
  const s = cv.width / 400;
  const stats = G.cityStats(state);
  const dayN = G.dayDiff(state.startDay, today()) + 1;
  x.fillStyle = '#2c4058';
  x.font = `900 ${Math.round(22 * s)}px Nunito, "PingFang TC", "Noto Sans TC", sans-serif`;
  x.fillText(`💧 ${t('photoTitle')}`, pad, img.height + pad + footer * 0.42);
  x.font = `700 ${Math.round(13 * s)}px Nunito, "PingFang TC", "Noto Sans TC", sans-serif`;
  x.fillStyle = '#6b7f99';
  const d = new Date(now());
  x.fillText(`${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${fmtTime(d)}  ·  ${t('photoDay', { n: dayN, p: stats.plants, b: stats.buildings })}`, pad, img.height + pad + footer * 0.72);
  const url = cv.toDataURL('image/jpeg', 0.92);
  const fname = `water-town-${today()}-${fmtTime(d).replace(':', '')}.jpg`;
  const m = openModal(`
    <h2>📸 ${t('photoTitle')}</h2>
    <div class="photo-frame animate__animated animate__zoomIn"><img src="${url}" alt="${esc(t('photoTitle'))}" /></div>
    <p class="note" style="margin-top:14px">${t('longPress')}</p>
    <div class="row" style="margin-top:10px">
      <button class="btn ghost block" data-a="save">${ICON.download}${t('savePhoto')}</button>
      ${navigator.share ? `<button class="btn block" data-a="share">${ICON.share}${t('sharePhoto')}</button>` : ''}
    </div>
    <div class="row end" style="margin-top:10px"><button class="btn ghost sm" data-close>${t('close')}</button></div>`);
  m.el.classList.add('photo-modal');
  m.el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'save') {
      const link = document.createElement('a'); link.href = url; link.download = fname; document.body.appendChild(link); link.click(); link.remove();
      toast(t('photoSaved'), { icon: '📸' });
    }
    if (a === 'share') {
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], fname, { type: 'image/jpeg' });
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: t('photoTitle') });
        else await navigator.share({ title: t('photoTitle'), text: t('tagline') });
      } catch { /* user cancelled */ }
    }
  });
}

/* ================================================================ welcome */
function showWelcome() {
  const m = openModal(`
    <div class="welcome-art">🏝️💧🌱</div>
    <h2 style="text-align:center">${t('welcomeTitle')}</h2>
    <div class="welcome-list">
      <div><span>💧</span>${t('welcome1')}</div>
      <div>${coinSVG(26)}${t('welcome2')}</div>
      <div><span>🌵</span>${t('welcome3')}</div>
      <div><span>🏝️</span>${t('welcome4')}</div>
    </div>
    <div class="seg" id="wLang" style="margin-bottom:12px"><button data-lang="zh" class="${getLang() === 'zh' ? 'on' : ''}">繁體中文</button><button data-lang="en" class="${getLang() === 'en' ? 'on' : ''}">English</button></div>
    <button class="btn green block" data-a="start">${t('start')}</button>`, { dismissable: false });
  m.el.addEventListener('click', (e) => {
    const lb = e.target.closest('[data-lang]');
    if (lb) { changeLang(lb.dataset.lang); m.close(); setTimeout(showWelcome, 230); return; }
    if (!e.target.closest('[data-a="start"]')) return;
    state.welcomed = true; save(); m.close();
    if (!state.bottles.length) setTimeout(openNoBottle, 300);
  });
}

// handy for debugging in the console
window.WT = { get state() { return state; }, G, save, renderAll, get scene() { return scene; } };
void TIER_ORDER;
