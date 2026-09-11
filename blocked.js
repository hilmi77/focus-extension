import { pickBlockedMessage } from './utils.js';

const params = new URLSearchParams(window.location.search);
const target = params.get('target');
const isPomodoro = params.get('pomodoro') === '1';

const btn = document.getElementById('goBtn');
const sub = document.querySelector('.sub');

if (isPomodoro) {
  if (sub) sub.textContent = 'Pomodoro devam ediyor. Bu site çalışma süresinde kilitli. 🍅';
  btn.textContent = 'Tamam, geri dön';
  btn.addEventListener('click', () => history.back());
} else {
  btn.addEventListener('click', () => {
    if (target) window.location.href = decodeURIComponent(target);
  });
  applyMotivationalMessage();
}

async function applyMotivationalMessage() {
  const [{ stats }, { pomoStats }] = await Promise.all([
    chrome.storage.local.get({ stats: null }),
    chrome.storage.local.get({ pomoStats: null }),
  ]);
  const msg = pickBlockedMessage(stats, pomoStats, Math.floor(Math.random() * 1000));
  document.querySelector('.eyebrow').textContent = msg.eyebrow;
  document.querySelector('.line1').textContent = msg.line1;
  document.querySelector('.line2').textContent = msg.line2;
  document.querySelector('.sub').textContent = msg.sub;
}
