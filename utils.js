export function findMatch(url, blockedSites) {
  if (!blockedSites || blockedSites.length === 0) return null;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return blockedSites.find(site => {
      const source = site.source.replace(/^www\./, '');
      return hostname === source || hostname.endsWith('.' + source);
    }) ?? null;
  } catch {
    return null;
  }
}

export function getDefaultStats() {
  return { streak: 0, lastBlockedDate: null, todayCount: 0, todayDate: null, history: {}, siteCounts: {} };
}

export function incrementStats(stats, today, source) {
  const yesterday = getPreviousDay(today);

  if (stats.todayDate === today) {
    const siteCounts = source
      ? { ...stats.siteCounts, [source]: (stats.siteCounts?.[source] ?? 0) + 1 }
      : stats.siteCounts ?? {};
    return { ...stats, todayCount: stats.todayCount + 1, siteCounts };
  }

  const newHistory = stats.todayDate
    ? trimHistory({ ...stats.history, [stats.todayDate]: stats.todayCount }, today)
    : { ...stats.history };

  return {
    streak: stats.todayDate === yesterday ? stats.streak + 1 : 1,
    lastBlockedDate: today,
    todayCount: 1,
    todayDate: today,
    history: newHistory,
    siteCounts: source ? { [source]: 1 } : {},
  };
}

export function trimHistory(history, today) {
  const cutoff = new Date(today + 'T12:00:00');
  cutoff.setDate(cutoff.getDate() - 7);
  return Object.fromEntries(
    Object.entries(history).filter(([date]) => new Date(date + 'T12:00:00') > cutoff)
  );
}

function getPreviousDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export const LOCK_DURATION_MS = 24 * 60 * 60 * 1000;

export function isLocked(site, now, lockDurationMs = LOCK_DURATION_MS) {
  if (!site.addedAt) return false;
  return now - site.addedAt < lockDurationMs;
}

export function migrateBlockedSites(sites, now) {
  return sites.map(site => site.addedAt ? site : { ...site, addedAt: now });
}

const REFLECTIVE_QUESTIONS = [
  { eyebrow: 'dur bir saniye', line1: '10 dakika sonra', line2: 'kendine ne diyeceksin?', sub: 'Bir düşün.' },
  { eyebrow: 'dur bir saniye', line1: 'Bunu gerçekten', line2: 'şimdi mi yapman lazım?', sub: 'Sonra da yapabilirsin.' },
  { eyebrow: 'dur bir saniye', line1: 'Az önce ne', line2: 'yapıyordun, hatırlıyor musun?', sub: 'Kaldığın yere dön.' },
  { eyebrow: 'dur bir saniye', line1: 'Buraya gelmek,', line2: 'asıl istediğin şey miydi?', sub: 'Emin misin?' },
  { eyebrow: 'dur bir saniye', line1: '5 dakika sonra', line2: 'pişman olacak mısın?', sub: 'Şimdi karar ver.' },
];

function streakMessage(streak) {
  return {
    eyebrow: 'dur bir saniye',
    line1: `${streak} günlük`,
    line2: 'zincirini kırma.',
    sub: 'Bugün de devam et, yarın daha kolay olacak.',
  };
}

function todayCountMessage(todayCount) {
  return {
    eyebrow: 'yine mi buradasın',
    line1: 'Bu siteyi bugün',
    line2: `${todayCount}. kez engelledin.`,
    sub: 'Bir kez daha dene, gerçekten istersen çık.',
  };
}

function formatFocusMins(m) {
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}dk`;
  if (rem === 0) return `${h}sa`;
  return `${h}sa ${rem}dk`;
}

function focusMessage(todayFocusMins) {
  return {
    eyebrow: 'dur bir saniye',
    line1: `Bugün ${formatFocusMins(todayFocusMins)}`,
    line2: 'odaklandın.',
    sub: 'Bunu şimdi boşa harcama.',
  };
}

export function pickBlockedMessage(stats, pomoStats, randomIndex, siteCount = 0) {
  const candidates = [];
  if (stats?.streak >= 2) candidates.push(streakMessage(stats.streak));
  if (siteCount >= 1) candidates.push(todayCountMessage(siteCount));
  if (pomoStats?.todayFocusMins >= 15) candidates.push(focusMessage(pomoStats.todayFocusMins));
  candidates.push(...REFLECTIVE_QUESTIONS);
  return candidates[randomIndex % candidates.length];
}

export const IDLE_RESET_THRESHOLD_MS = 30 * 60 * 1000;

export function decideIdleReturnAction(awayMs, resetThresholdMs = IDLE_RESET_THRESHOLD_MS) {
  return awayMs >= resetThresholdMs ? 'reset' : 'resume';
}

export function buildStreakChain(pomoHistory, todayDate, todayRounds, dailyGoal) {
  const days = [];
  const base = new Date(todayDate + 'T12:00:00');
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    const isToday = date === todayDate;
    const rounds = isToday ? todayRounds : (pomoHistory[date] ?? 0);
    days.push({ date, rounds, goalMet: rounds >= dailyGoal, isToday });
  }
  return days;
}
