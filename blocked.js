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
}
