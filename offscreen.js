let noiseCtx = null;
let noiseSource = null;
let noiseGain = null;

function startWhiteNoise(volume = 0.12) {
  if (noiseSource) return;
  noiseCtx = new AudioContext();
  const bufferSize = noiseCtx.sampleRate * 2;
  const buffer = noiseCtx.createBuffer(1, bufferSize, noiseCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  noiseSource = noiseCtx.createBufferSource();
  noiseSource.buffer = buffer;
  noiseSource.loop = true;
  noiseGain = noiseCtx.createGain();
  noiseGain.gain.value = volume;
  noiseSource.connect(noiseGain);
  noiseGain.connect(noiseCtx.destination);
  noiseSource.start();
}

function stopWhiteNoise() {
  if (noiseSource) { noiseSource.stop(); noiseSource = null; }
  if (noiseCtx) { noiseCtx.close(); noiseCtx = null; }
  noiseGain = null;
}

function startMusic(videoId) {
  const host = document.getElementById('ytHost');
  host.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.width = '0';
  iframe.height = '0';
  iframe.style.border = 'none';
  iframe.allow = 'autoplay';
  iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1`;
  host.appendChild(iframe);
}

function stopMusic() {
  const host = document.getElementById('ytHost');
  host.innerHTML = '';
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'PLAY_SOUND') {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    [0, 0.25].forEach(offset => {
      const osc = ctx.createOscillator();
      osc.connect(gain);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.4);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.4);
    });
  }

  if (msg.type === 'START_WHITE_NOISE') startWhiteNoise(msg.volume ?? 0.12);
  if (msg.type === 'STOP_WHITE_NOISE') stopWhiteNoise();
  if (msg.type === 'START_MUSIC') startMusic(msg.videoId);
  if (msg.type === 'STOP_MUSIC') stopMusic();
});
