import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_USER_DATA,
  loadUserData,
  saveUserData,
  recordChoice,
  applyFeedback,
  updateRecentDays,
  exportUserData,
  importUserData,
  clearUserData
} from '../js/storage.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test('저장 데이터가 없으면 안전한 기본값을 돌려준다', () => {
  const data = loadUserData(memoryStorage());
  assert.deepEqual(data, DEFAULT_USER_DATA);
  assert.notEqual(data, DEFAULT_USER_DATA);
});

test('손상된 JSON과 비정상 설정을 정제한다', () => {
  const broken = memoryStorage({ 'yeobo-dinner:v1': '{broken' });
  assert.deepEqual(loadUserData(broken), DEFAULT_USER_DATA);

  const storage = memoryStorage();
  const saved = saveUserData({
    preferences: { sushi: 200, pizza: -100, bad: 'x' },
    history: [{ menuId: 'sushi', selectedAt: '2026-07-21T10:00:00Z' }, { no: true }],
    recentDays: 999
  }, storage);
  assert.deepEqual(saved.preferences, { sushi: 8, pizza: -5 });
  assert.equal(saved.history.length, 1);
  assert.equal(saved.recentDays, 7);
});

test('메뉴 확정은 최신 기록을 앞에 추가한다', () => {
  const next = recordChoice(DEFAULT_USER_DATA, 'shabu-shabu', {
    mood: 'tired', energy: 'exhausted', method: 'delivery'
  }, '2026-07-21T09:00:00Z');
  assert.equal(next.history[0].menuId, 'shabu-shabu');
  assert.equal(next.history[0].mood, 'tired');
  assert.equal(next.history[0].method, 'delivery');
});

test('좋아요·별로예요 점수와 최근 기간 설정에 상한을 둔다', () => {
  let data = DEFAULT_USER_DATA;
  for (let index = 0; index < 20; index += 1) data = applyFeedback(data, 'sushi', 'like');
  assert.equal(data.preferences.sushi, 8);
  for (let index = 0; index < 20; index += 1) data = applyFeedback(data, 'sushi', 'dislike');
  assert.equal(data.preferences.sushi, -5);
  assert.equal(updateRecentDays(data, 14).recentDays, 14);
  assert.equal(updateRecentDays(data, 9).recentDays, 7);
});

test('JSON 내보내기와 가져오기가 왕복한다', () => {
  const source = recordChoice(applyFeedback(DEFAULT_USER_DATA, 'pizza', 'like'), 'pizza', {
    mood: 'happy', energy: 'normal', method: 'delivery'
  }, '2026-07-21T09:00:00Z');
  const imported = importUserData(exportUserData(source));
  assert.equal(imported.preferences.pizza, 1);
  assert.equal(imported.history[0].menuId, 'pizza');
});

test('전체 초기화는 저장 키를 제거한다', () => {
  const storage = memoryStorage();
  saveUserData({ preferences: { sushi: 1 } }, storage);
  const cleared = clearUserData(storage);
  assert.deepEqual(cleared, DEFAULT_USER_DATA);
  assert.deepEqual(loadUserData(storage), DEFAULT_USER_DATA);
});
