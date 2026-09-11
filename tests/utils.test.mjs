import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findMatch, incrementStats, getDefaultStats, trimHistory, isLocked, migrateBlockedSites, LOCK_DURATION_MS, pickBlockedMessage } from '../utils.js';

describe('findMatch', () => {
  const sites = [
    { source: 'instagram.com', target: 'https://react.dev' },
    { source: 'x.com', target: 'https://nodejs.org' },
  ];

  it('engellenen URL için eşleşme döner', () => {
    const result = findMatch('https://www.instagram.com/feed', sites);
    assert.deepEqual(result, { source: 'instagram.com', target: 'https://react.dev' });
  });

  it('www olmadan da eşleşir', () => {
    const result = findMatch('https://instagram.com/stories', sites);
    assert.deepEqual(result, { source: 'instagram.com', target: 'https://react.dev' });
  });

  it('engellenmemiş URL için null döner', () => {
    const result = findMatch('https://react.dev', sites);
    assert.equal(result, null);
  });

  it('boş liste için null döner', () => {
    const result = findMatch('https://instagram.com', []);
    assert.equal(result, null);
  });
});

describe('getDefaultStats', () => {
  it('varsayılan istatistik yapısını döner', () => {
    const stats = getDefaultStats();
    assert.equal(stats.streak, 0);
    assert.equal(stats.todayCount, 0);
    assert.equal(stats.todayDate, null);
    assert.equal(stats.lastBlockedDate, null);
    assert.deepEqual(stats.history, {});
  });
});

describe('incrementStats', () => {
  it('aynı günde sadece sayacı artırır', () => {
    const stats = { ...getDefaultStats(), todayDate: '2026-05-14', todayCount: 2, streak: 3 };
    const result = incrementStats(stats, '2026-05-14');
    assert.equal(result.todayCount, 3);
    assert.equal(result.streak, 3);
  });

  it('yeni günde streak devam eder (önceki gün vardı)', () => {
    const stats = { ...getDefaultStats(), todayDate: '2026-05-13', todayCount: 5, streak: 3 };
    const result = incrementStats(stats, '2026-05-14');
    assert.equal(result.streak, 4);
    assert.equal(result.todayCount, 1);
    assert.equal(result.todayDate, '2026-05-14');
    assert.equal(result.history['2026-05-13'], 5);
  });

  it('gün atlandıysa streak sıfırlanır', () => {
    const stats = { ...getDefaultStats(), todayDate: '2026-05-10', todayCount: 3, streak: 5 };
    const result = incrementStats(stats, '2026-05-14');
    assert.equal(result.streak, 1);
    assert.equal(result.todayCount, 1);
  });

  it('ilk kullanımda streak 1 olur', () => {
    const result = incrementStats(getDefaultStats(), '2026-05-14');
    assert.equal(result.streak, 1);
    assert.equal(result.todayCount, 1);
  });
});

describe('trimHistory', () => {
  it('7 günden eskiyi siler', () => {
    const history = { '2026-05-01': 3, '2026-05-07': 2, '2026-05-08': 5 };
    const result = trimHistory(history, '2026-05-14');
    assert.equal(result['2026-05-01'], undefined);
    assert.equal(result['2026-05-07'], undefined);
    assert.equal(result['2026-05-08'], 5);
  });
});

describe('isLocked', () => {
  const now = 1_700_000_000_000;

  it('addedAt yoksa kilitsizdir', () => {
    assert.equal(isLocked({ source: 'x.com' }, now), false);
  });

  it('24 saatten az geçmişse kilitlidir', () => {
    const site = { source: 'x.com', addedAt: now - (23 * 60 * 60 * 1000) };
    assert.equal(isLocked(site, now), true);
  });

  it('tam 24 saat geçmişse kilitsizdir', () => {
    const site = { source: 'x.com', addedAt: now - LOCK_DURATION_MS };
    assert.equal(isLocked(site, now), false);
  });

  it('24 saatten fazla geçmişse kilitsizdir', () => {
    const site = { source: 'x.com', addedAt: now - (25 * 60 * 60 * 1000) };
    assert.equal(isLocked(site, now), false);
  });
});

describe('migrateBlockedSites', () => {
  const now = 1_700_000_000_000;

  it('addedAt olmayan kayıtlara now atar', () => {
    const sites = [{ source: 'x.com', target: 'https://nodejs.org' }];
    const result = migrateBlockedSites(sites, now);
    assert.equal(result[0].addedAt, now);
  });

  it('addedAt olan kayıtlara dokunmaz', () => {
    const sites = [{ source: 'x.com', target: 'https://nodejs.org', addedAt: 123 }];
    const result = migrateBlockedSites(sites, now);
    assert.equal(result[0].addedAt, 123);
  });

  it('orijinal diziyi mutasyona uğratmaz', () => {
    const sites = [{ source: 'x.com', target: 'https://nodejs.org' }];
    migrateBlockedSites(sites, now);
    assert.equal(sites[0].addedAt, undefined);
  });
});

describe('pickBlockedMessage', () => {
  it('sadece düşündürücü sorular uygulanabilirken havuz boş dönmez', () => {
    const msg = pickBlockedMessage({ streak: 1, todayCount: 0 }, { todayFocusMins: 0 }, 0);
    assert.ok(msg && msg.line1 && msg.line2 && msg.sub);
  });

  it('streak >= 2 ise streak mesajı adaylar arasına girer (index 0)', () => {
    const stats = { streak: 3, todayCount: 0 };
    const pomoStats = { todayFocusMins: 0 };
    const msg = pickBlockedMessage(stats, pomoStats, 0);
    assert.match(msg.line1, /3 günlük/);
  });

  it('streak 1 iken streak mesajı hiç aday olmaz', () => {
    const stats = { streak: 1, todayCount: 0 };
    const pomoStats = { todayFocusMins: 0 };
    for (let i = 0; i < 5; i++) {
      const msg = pickBlockedMessage(stats, pomoStats, i);
      assert.doesNotMatch(msg.line2, /zincirini kırma/);
    }
  });

  it('todayCount >= 1 ise sayı mesajı adaylar arasına girer (index 0)', () => {
    const stats = { streak: 0, todayCount: 4 };
    const pomoStats = { todayFocusMins: 0 };
    const msg = pickBlockedMessage(stats, pomoStats, 0);
    assert.match(msg.line2, /4\. kez/);
  });

  it('todayFocusMins >= 15 ise odak mesajı adaylar arasına girer', () => {
    const stats = { streak: 0, todayCount: 0 };
    const msg = pickBlockedMessage(stats, { todayFocusMins: 15 }, 0);
    assert.match(msg.line2, /odaklandın/);
  });

  it('todayFocusMins 14 iken odak mesajı hiç aday olmaz', () => {
    const stats = { streak: 0, todayCount: 0 };
    for (let i = 0; i < 5; i++) {
      const msg = pickBlockedMessage(stats, { todayFocusMins: 14 }, i);
      assert.doesNotMatch(msg.line2, /odaklandın/);
    }
  });

  it('null stats/pomoStats ile çökmeden düşündürücü sorulardan biri döner', () => {
    const msg = pickBlockedMessage(null, null, 2);
    assert.ok(msg.line1 && msg.line2 && msg.sub);
  });

  it('aynı girdi ve randomIndex ile her zaman aynı mesajı döner (deterministik)', () => {
    const stats = { streak: 3, todayCount: 2 };
    const pomoStats = { todayFocusMins: 20 };
    const a = pickBlockedMessage(stats, pomoStats, 7);
    const b = pickBlockedMessage(stats, pomoStats, 7);
    assert.deepEqual(a, b);
  });
});
