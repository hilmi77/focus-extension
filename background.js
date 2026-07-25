

import { findMatch, getDefaultStats, incrementStats } from './utils.js';
import { handlePomodoroAlarm, getState } from './pomodoro.js';
import { getSoundSettings, getSoundRuntime, resolveVideoId } from './sound.js';

const POMODORO_BLOCKED = ['x.com', 'twitter.com', 'instagram.com'];

chrome.webNavigation.onBeforeNavigate.addListener(async ({ tabId, url, frameId }) => {
  if (frameId !== 0) return;
  if (url.startsWith(chrome.runtime.getURL(''))) return;

  const { blockedSites = [] } = await chrome.storage.sync.get({ blockedSites: [] });
  const match = findMatch(url, blockedSites);
  if (match) {
    const target = encodeURIComponent(match.target);
    await chrome.tabs.update(tabId, { url: chrome.runtime.getURL(`blocked.html?target=${target}`) });
    await recordBlock();
    return;
  }

  const pomo = await getState();
  if (pomo.active && pomo.phase === 'work' && matchesPomodoroList(url)) {
    await chrome.tabs.update(tabId, { url: chrome.runtime.getURL('blocked.html?pomodoro=1') });
    await recordBlock();
  }
});

function matchesPomodoroList(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return POMODORO_BLOCKED.some(site => hostname === site || hostname.endsWith('.' + site));
  } catch {
    return false;
  }
}

async function recordBlock() {
  const { stats } = await chrome.storage.local.get({ stats: null });
  const current = stats ?? getDefaultStats();
  const today = new Date().toISOString().split('T')[0];
  const updated = incrementStats(current, today);
  await chrome.storage.local.set({ stats: updated });
}

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Pomodoro ses işlemleri',
    });
  }
}

async function playSound() {
  await ensureOffscreen();
  chrome.runtime.sendMessage({ type: 'PLAY_SOUND' });
}

async function playWhiteNoise(volume) {
  await ensureOffscreen();
  chrome.runtime.sendMessage({ type: 'START_WHITE_NOISE', volume });
}

async function stopWhiteNoise() {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) chrome.runtime.sendMessage({ type: 'STOP_WHITE_NOISE' });
}

async function playMusic(videoId) {
  await ensureOffscreen();
  chrome.runtime.sendMessage({ type: 'START_MUSIC', videoId });
}

async function stopMusic() {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) chrome.runtime.sendMessage({ type: 'STOP_MUSIC' });
}

async function syncAudio() {
  const [settings, runtime, pomo] = await Promise.all([
    getSoundSettings(), getSoundRuntime(), getState(),
  ]);
  const shouldPlay = settings.mode !== 'off' && pomo.active && pomo.phase === 'work' && !runtime.muted;

  if (!shouldPlay) {
    await stopWhiteNoise();
    await stopMusic();
    return;
  }

  if (settings.mode === 'whitenoise') {
    await stopMusic();
    await playWhiteNoise();
  } else if (settings.mode === 'classic') {
    await stopWhiteNoise();
    await playMusic(resolveVideoId(settings.musicUrl));
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (['POMO_STARTED', 'POMO_PAUSED', 'POMO_RESUMED', 'POMO_STOPPED', 'SYNC_AUDIO'].includes(msg.type)) {
    syncAudio();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('focus-alarm-')) {
    const groupId = alarm.name.replace('focus-alarm-', '');
    const { todoGroups = [] } = await chrome.storage.local.get({ todoGroups: [] });
    const group = todoGroups.find(g => g.id === groupId);
    if (group) {
      chrome.notifications.create(`notif-${Date.now()}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: '🎯 Focus Hatırlatma',
        message: group.title,
        priority: 2,
      });
    }
  }
  if (alarm.name === 'pomodoro-phase-end') {
    await playSound();
    await handlePomodoroAlarm(alarm.name);
    await syncAudio();
  } else {
    await handlePomodoroAlarm(alarm.name);
  }
});