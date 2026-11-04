// Loading screen: a watered sprout + rotating water / environment tips.
import { TIPS } from './data.js';
import { t, getLang } from './i18n.js';

let timer = null;
let idx = Math.floor(Math.random() * TIPS.length);
const el = (id) => document.getElementById(id);

export function nextTip() {
  idx = (idx + 1 + Math.floor(Math.random() * 3)) % TIPS.length;
  const tip = TIPS[idx];
  const text = el('tipText');
  el('tipIcon').textContent = tip.icon;
  text.textContent = tip[getLang()] || tip.zh;
  text.classList.remove('animate__animated', 'animate__fadeIn');
  void text.offsetWidth; // restart animation
  text.classList.add('animate__animated', 'animate__fadeIn');
}

export function showLoader(msgKey = 'loading') {
  const box = el('loader');
  el('loaderTitle').textContent = t('appName');
  el('loaderMsg').textContent = t(msgKey);
  el('tipHead').textContent = t('didYouKnow');
  el('tipNext').textContent = t('tapNextTip');
  box.hidden = false;
  box.classList.remove('done');
  nextTip();
  clearInterval(timer);
  timer = setInterval(nextTip, 5000);
}

export function hideLoader() {
  clearInterval(timer);
  el('loader').classList.add('done');
}

document.getElementById('tipCard')?.addEventListener('click', nextTip);
