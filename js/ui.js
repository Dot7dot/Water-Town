// Small DOM helpers: sheets, modals, toasts, little celebrations.
import { t } from './i18n.js';

const layer = () => document.getElementById('layer');
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const stack = [];

function open(kind, html, { onClose, dismissable = true } = {}) {
  const wrap = document.createElement('div');
  const bd = document.createElement('div');
  bd.className = 'backdrop';
  wrap.appendChild(bd);
  let panel;
  if (kind === 'sheet') {
    panel = document.createElement('div');
    panel.className = 'sheet';
    panel.innerHTML = `<div class="sheet-grip"></div>${html}`;
    wrap.appendChild(panel);
  } else {
    const mw = document.createElement('div');
    mw.className = 'modal-wrap';
    panel = document.createElement('div');
    panel.className = 'modal animate__animated animate__zoomIn animate__faster';
    panel.innerHTML = html;
    mw.appendChild(panel);
    wrap.appendChild(mw);
  }
  layer().appendChild(wrap);
  let closed = false;
  const api = {
    el: panel,
    close() {
      if (closed) return;
      closed = true;
      const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
      bd.classList.add('closing');
      if (kind === 'sheet') panel.classList.add('closing');
      else { panel.classList.remove('animate__zoomIn'); panel.classList.add('animate__zoomOut'); }
      setTimeout(() => wrap.remove(), 220);
      onClose && onClose();
    },
  };
  if (dismissable) bd.addEventListener('click', () => api.close());
  panel.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
  stack.push(api);
  return api;
}
export const openSheet = (html, opts) => open('sheet', html, opts);
export const openModal = (html, opts) => open('modal', html, opts);
export const closeAll = () => [...stack].forEach((s) => s.close());
export const topLayer = () => stack[stack.length - 1];

export function confirmBox(message, { okText, danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const m = openModal(`
      <p style="font-size:16px;color:var(--ink)">${esc(message)}</p>
      <div class="row end">
        <button class="btn ghost sm" data-a="no">${t('cancel')}</button>
        <button class="btn sm ${danger ? 'red' : ''}" data-a="yes">${esc(okText || t('confirm'))}</button>
      </div>`, { onClose: () => { if (!answered) resolve(false); } });
    m.el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      answered = true; resolve(a === 'yes'); m.close();
    });
  });
}

export function toast(text, { icon = '💧', warn = false, ms = 2600 } = {}) {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast animate__animated animate__bounceInDown${warn ? ' warn' : ''}`;
  el.innerHTML = `<span class="ti">${icon}</span><span>${esc(text)}</span>`;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => {
    el.classList.remove('animate__bounceInDown'); el.classList.add('animate__fadeOutUp');
    setTimeout(() => el.remove(), 600);
  }, ms);
}

export function floatText(html, x, y) {
  const el = document.createElement('div');
  el.className = 'float-coin';
  el.innerHTML = html;
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

export function confetti(n = 60) {
  const colors = ['#3fb6ff', '#5cc96b', '#ffd84d', '#ff8fb1', '#a98bff', '#ffa94d'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background = colors[i % colors.length];
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 200}px`);
    c.style.setProperty('--rot', `${Math.random() * 900}deg`);
    c.style.animationDelay = `${Math.random() * 0.5}s`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3000);
  }
}

export function haptic(ms = 12) { try { navigator.vibrate?.(ms); } catch { /* ignore */ } }
