chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'PLAY_SOUND') return;
  const ctx = new AudioContext();
  const gain = ctx.createGain();
  gain.connect(ctx.destination);

  // İki kısa ding sesi
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
});
