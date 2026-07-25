import { parseYouTubeId } from './utils.js';

// 7/24 canlı klasik piyano yayını. Task 6'da tarayıcıda gömmeye açık olduğu doğrulanmalı.
export const PRESET_CLASSICAL_VIDEO_ID = 'OowUi602GdU';

const DEFAULT_SOUND_SETTINGS = { mode: 'off', musicUrl: null };

export async function getSoundSettings() {
  const { soundSettings } = await chrome.storage.sync.get({ soundSettings: DEFAULT_SOUND_SETTINGS });
  return { ...DEFAULT_SOUND_SETTINGS, ...soundSettings };
}

export async function setSoundSettings(partial) {
  const current = await getSoundSettings();
  const next = { ...current, ...partial };
  await chrome.storage.sync.set({ soundSettings: next });
  return next;
}

export async function getSoundRuntime() {
  const { soundRuntime } = await chrome.storage.local.get({ soundRuntime: { muted: false } });
  return soundRuntime;
}

export async function setSoundMuted(muted) {
  await chrome.storage.local.set({ soundRuntime: { muted } });
}

export function resolveVideoId(musicUrl) {
  if (!musicUrl) return PRESET_CLASSICAL_VIDEO_ID;
  return parseYouTubeId(musicUrl) ?? PRESET_CLASSICAL_VIDEO_ID;
}
