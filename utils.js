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
  return { streak: 0, lastBlockedDate: null, todayCount: 0, todayDate: null, history: {} };
}

export function incrementStats(stats, today) {
  const yesterday = getPreviousDay(today);

  if (stats.todayDate === today) {
    return { ...stats, todayCount: stats.todayCount + 1 };
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

export function parseYouTubeId(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  if (!str) return null;
  const ID = /^[A-Za-z0-9_-]{11}$/;
  if (ID.test(str)) return str;
  try {
    const url = new URL(str);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1);
      return ID.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = url.searchParams.get('v');
      if (v && ID.test(v)) return v;
      const m = url.pathname.match(/^\/(?:embed|live|shorts)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}
