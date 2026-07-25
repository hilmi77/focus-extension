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
