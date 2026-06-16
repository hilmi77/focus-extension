const ALARM_NAME = 'pomodoro-phase-end';

const DEFAULT_STATE = {
  active: false,
  paused: false,
  phase: 'work',
  round: 1,
  endTime: null,
  remainingMs: null,
  settings: { workMins: 25, breakMins: 5, longBreakMins: 15, roundsBeforeLongBreak: 4 },
};

export async function getState() {
  const { pomodoro } = await chrome.storage.local.get({ pomodoro: DEFAULT_STATE });
  return pomodoro;
}

async function setState(partial) {
  const current = await getState();
  await chrome.storage.local.set({ pomodoro: { ...current, ...partial } });
}

function phaseDuration(phase, settings) {
  if (phase === 'work') return settings.workMins;
  if (phase === 'break') return settings.breakMins;
  return settings.longBreakMins;
}

export async function startPomodoro() {
  const state = await getState();
  const mins = phaseDuration(state.phase, state.settings);
  const endTime = Date.now() + mins * 60 * 1000;
  await setState({ active: true, endTime });
  await chrome.alarms.create(ALARM_NAME, { when: endTime });
}

export async function stopPomodoro() {
  await chrome.alarms.clear(ALARM_NAME);
  const state = await getState();
  await setState({
    active: false,
    paused: false,
    endTime: null,
    remainingMs: null,
    phase: 'work',
    round: 1,
    settings: state.settings,
  });
}

export async function pausePomodoro() {
  const state = await getState();
  const remainingMs = Math.max(0, state.endTime - Date.now());
  await chrome.alarms.clear(ALARM_NAME);
  await setState({ active: false, paused: true, endTime: null, remainingMs });
}

export async function resumePomodoro() {
  const state = await getState();
  const endTime = Date.now() + state.remainingMs;
  await chrome.alarms.create(ALARM_NAME, { when: endTime });
  await setState({ active: true, paused: false, endTime, remainingMs: null });
}

export async function handlePomodoroAlarm(alarmName) {
  if (alarmName !== ALARM_NAME) return;
  const { phase, round, settings } = await getState();

  let nextPhase, nextRound, message;
  if (phase === 'work') {
    await recordCompletedSession(settings.workMins);
    if (round >= settings.roundsBeforeLongBreak) {
      nextPhase = 'longBreak'; nextRound = round;
      message = `${settings.roundsBeforeLongBreak} tur tamam! Uzun mola hak ettin.`;
    } else {
      nextPhase = 'break'; nextRound = round;
      message = 'Mola zamanı! Biraz dinlen.';
    }
  } else if (phase === 'break') {
    nextPhase = 'work'; nextRound = round + 1;
    message = 'Tekrar odaklanma zamanı!';
  } else {
    nextPhase = 'work'; nextRound = 1;
    message = 'Uzun mola bitti. Yeni tur başlıyor!';
  }

  const mins = phaseDuration(nextPhase, settings);
  const endTime = Date.now() + mins * 60 * 1000;
  await setState({ phase: nextPhase, round: nextRound, endTime, active: true });
  await chrome.alarms.create(ALARM_NAME, { when: endTime });

  chrome.notifications.create(`pomo-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: '🍅 Pomodoro',
    message,
    priority: 2,
  });
}

async function recordCompletedSession(workMins) {
  const today = new Date().toISOString().split('T')[0];
  const { pomoStats = { todayDate: null, todayRounds: 0, todayFocusMins: 0 } } =
    await chrome.storage.local.get({ pomoStats: null });
  const base = pomoStats && pomoStats.todayDate === today
    ? pomoStats
    : { todayDate: today, todayRounds: 0, todayFocusMins: 0 };
  await chrome.storage.local.set({
    pomoStats: {
      todayDate: today,
      todayRounds: base.todayRounds + 1,
      todayFocusMins: base.todayFocusMins + workMins,
    },
  });
}

export async function getPomodoroStats() {
  const today = new Date().toISOString().split('T')[0];
  const { pomoStats = null } = await chrome.storage.local.get({ pomoStats: null });
  if (!pomoStats || pomoStats.todayDate !== today) {
    return { todayRounds: 0, todayFocusMins: 0 };
  }
  return { todayRounds: pomoStats.todayRounds, todayFocusMins: pomoStats.todayFocusMins };
}

export async function updateSettings(newSettings) {
  const state = await getState();
  await setState({ settings: { ...state.settings, ...newSettings } });
}
