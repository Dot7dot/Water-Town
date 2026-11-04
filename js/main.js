// Boot: show the loading screen with a tip immediately, then load the 3D app.
import { setLang } from './i18n.js';
import { showLoader, hideLoader } from './loader.js';

function peekLang() {
  try {
    const raw = localStorage.getItem('watertown.v1');
    if (raw) return JSON.parse(raw).lang || 'zh';
  } catch { /* ignore */ }
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'zh';
}

setLang(peekLang());
showLoader('loading');
const started = performance.now();

try {
  const { startApp } = await import('./app.js');
  await startApp();
} catch (err) {
  console.error(err);
  document.getElementById('loaderMsg').textContent = '⚠️ ' + (err?.message || err);
  throw err;
}

const MIN_MS = 1800; // let people read at least one tip
setTimeout(() => {
  hideLoader();
  window.dispatchEvent(new Event('wt:ready'));
}, Math.max(0, MIN_MS - (performance.now() - started)));

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.search.includes('nosw')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
