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
});
