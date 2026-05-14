const params = new URLSearchParams(window.location.search);
const target = params.get('target');

document.getElementById('goBtn').addEventListener('click', () => {
  if (target) window.location.href = decodeURIComponent(target);
});
