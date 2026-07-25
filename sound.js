// Radio Swiss Classic — 7/24 klasik müzik yayını (HTTPS stream + now-playing API).
export const RADIO_STREAM_URL = 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128';
const RADIO_API = 'https://ssatr.playlist-api.deliver.media/graphql';
const RADIO_CHANNEL_ID = '0191e9e4-ffc8-782b-8ace-6604e0d6f2dc';

const DEFAULT_SOUND_SETTINGS = { mode: 'off' };

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

// Radyoda o an çalan eseri döner: { artist, title } veya hata olursa null.
export async function fetchNowPlaying() {
  const query = 'query ($chan: String){ channel(id:$chan){ playingnow{ current{ metadata{ artist title } } } } }';
  try {
    const res = await fetch(RADIO_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { chan: RADIO_CHANNEL_ID } }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const m = json?.data?.channel?.playingnow?.current?.metadata;
    if (!m) return null;
    return { artist: m.artist ?? '', title: m.title ?? '' };
  } catch {
    return null;
  }
}
