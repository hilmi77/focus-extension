

import { findMatch, getDefaultStats, incrementStats, decideIdleReturnAction } from './utils.js';
import { handlePomodoroAlarm, getState, getPomodoroStats, pausePomodoro, resumePomodoro, stopPomodoro } from './pomodoro.js';
import { getSoundSettings, getSoundRuntime, RADIO_STREAM_URL } from './sound.js';

const POMODORO_BLOCKED = ['x.com', 'twitter.com', 'instagram.com'];

chrome.webNavigation.onBeforeNavigate.addListener(async ({ tabId, url, frameId }) => {
  if (frameId !== 0) return;
  if (url.startsWith(chrome.runtime.getURL(''))) return;

  const pomo = await getState();

  if (!(await isSiteListUnlocked(pomo))) {
    const { blockedSites = [] } = await chrome.storage.sync.get({ blockedSites: [] });
    const match = findMatch(url, blockedSites);
    if (match) {
      const target = encodeURIComponent(match.target);
      await chrome.tabs.update(tabId, { url: chrome.runtime.getURL(`blocked.html?target=${target}`) });
      await recordBlock();
      return;
    }
  }

  if (pomo.active && pomo.phase === 'work' && matchesPomodoroList(url)) {
    await chrome.tabs.update(tabId, { url: chrome.runtime.getURL('blocked.html?pomodoro=1') });
    await recordBlock();
  }
});

// Kullanıcının site listesi, Pomodoro'ya göre zamanlanır (Premack ilkesi):
// work fazında her zaman engelli; molada serbest; Pomodoro durmuşken günlük
// hedefe ulaşılmadıysa engelli kalır (erken "dur" ile kaçış işe yaramaz),
// hedef tamamlandıysa serbest (meşru şekilde günü bitirip rahatlama izni).
async function isSiteListUnlocked(pomo) {
  const onBreak = pomo.active && (pomo.phase === 'break' || pomo.phase === 'longBreak');
  if (onBreak) return true;
  if (pomo.active) return false;

  const [{ todayRounds }, { dailyGoal = 8 }] = await Promise.all([
    getPomodoroStats(),
    chrome.storage.local.get({ dailyGoal: 8 }),
  ]);
  return todayRounds >= dailyGoal;
}

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

async function playMusic() {
  await ensureOffscreen();
  chrome.runtime.sendMessage({ type: 'START_MUSIC', streamUrl: RADIO_STREAM_URL });
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
    await playMusic();
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (['POMO_STARTED', 'POMO_PAUSED', 'POMO_RESUMED', 'POMO_STOPPED', 'SYNC_AUDIO'].includes(msg.type)) {
    syncAudio();
  }
  if (['POMO_PAUSED', 'POMO_RESUMED', 'POMO_STOPPED', 'POMO_STARTED'].includes(msg.type)) {
    chrome.storage.local.remove('idleSince');
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

const IDLE_DETECTION_SECONDS = 300; // 5 dakika
chrome.idle.setDetectionInterval(IDLE_DETECTION_SECONDS);

chrome.idle.onStateChanged.addListener(async (state) => {
  const pomo = await getState();

  if (state !== 'active') {
    // 'idle' veya 'locked'
    if (pomo.active) {
      await pausePomodoro();
      await chrome.storage.local.set({ idleSince: Date.now() });
      await syncAudio();
    }
    return;
  }

  // state === 'active': kullanıcı geri döndü
  const { idleSince } = await chrome.storage.local.get({ idleSince: null });
  if (idleSince == null) return; // bu duraklatma idle tespitinden kaynaklanmadı

  await chrome.storage.local.remove('idleSince');
  const current = await getState();
  if (!current.paused) return; // kullanıcı zaten manuel müdahale etmiş

  const action = decideIdleReturnAction(Date.now() - idleSince);
  if (action === 'resume') {
    await resumePomodoro();
    chrome.notifications.create(`pomo-idle-resume-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: '👋 Tekrar hoş geldin',
      message: 'Bir süre uzaktaydın, Pomodoro kaldığı yerden devam ediyor.',
      priority: 2,
    });
  } else {
    await stopPomodoro();
    chrome.notifications.create(`pomo-idle-reset-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: '🍅 Pomodoro sıfırlandı',
      message: 'Uzun süre uzaktaydın, yarım kalan tur sıfırlandı. Bugünkü ilerlemen korundu — yeni bir tur başlatabilirsin.',
      priority: 2,
    });
  }
  await syncAudio();
});