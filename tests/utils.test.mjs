import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findMatch, incrementStats, getDefaultStats, trimHistory } from '../utils.js';

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
