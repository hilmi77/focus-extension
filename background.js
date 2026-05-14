import { findMatch, getDefaultStats, incrementStats } from './utils.js';

chrome.webNavigation.onBeforeNavigate.addListener(async ({ tabId, url, frameId }) => {
  if (frameId !== 0) return;
  if (url.startsWith(chrome.runtime.getURL(''))) return;

  const { blockedSites = [] } = await chrome.storage.sync.get({ blockedSites: [] });
  const match = findMatch(url, blockedSites);
  if (!match) return;

  const target = encodeURIComponent(match.target);
  await chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL(`blocked.html?target=${target}`)
  });
  await recordBlock();
});

async function recordBlock() {
  const { stats } = await chrome.storage.local.get({ stats: null });
  const current = stats ?? getDefaultStats();
  const today = new Date().toISOString().split('T')[0];
  const updated = incrementStats(current, today);
  await chrome.storage.local.set({ stats: updated });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('focus-alarm-')) return;
  const groupId = alarm.name.replace('focus-alarm-', '');
  const { todoGroups = [] } = await chrome.storage.local.get({ todoGroups: [] });
  const group = todoGroups.find(g => g.id === groupId);
  if (!group) return;

  chrome.notifications.create(`notif-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: '🎯 Focus Hatırlatma',
    message: group.title,
    priority: 2
  });
});
