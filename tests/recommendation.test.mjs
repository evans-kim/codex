import test from 'node:test';
import assert from 'node:assert/strict';
import { MENUS } from '../js/menus.js';
import { createEmptyAnswers, isWithinDays, scoreMenu, recommendMenus, createRecommendationReason } from '../js/recommendation.js';

const fixedNow = new Date('2026-07-21T18:00:00+09:00');
const noRandom = () => 0;

function menu(id) {
  return MENUS.find((item) => item.id === id);
}

test('빈 답변 객체는 서로 독립적이다', () => {
  const first = createEmptyAnswers();
  const second = createEmptyAnswers();
  first.feelings.push('warm');
  assert.deepEqual(second.feelings, []);
});

test('날짜가 지정 기간 안인지 정확히 판정한다', () => {
  assert.equal(isWithinDays('2026-07-20T18:00:00+09:00', 3, fixedNow), true);
  assert.equal(isWithinDays('2026-07-17T18:00:00+09:00', 3, fixedNow), false);
  assert.equal(isWithinDays('not-a-date', 3, fixedNow), false);
});

test('예민하고 많이 지친 날에는 순한 따뜻한 메뉴가 우선된다', () => {
  const answers = {
    mood: 'sensitive',
    energy: 'exhausted',
    feelings: ['warm', 'light'],
    method: 'delivery',
    extras: ['gentle']
  };
  const picks = recommendMenus(MENUS, answers, { preferences: {}, history: [], recentDays: 7 }, {
    count: 3,
    random: noRandom,
    now: fixedNow
  });

  assert.equal(picks.length, 3);
  assert.equal(picks[0].menu.features.includes('gentle'), true);
  assert.equal(picks[0].menu.methods.includes('delivery'), true);
  assert.equal(picks[0].menu.feelings.includes('spicy'), false);
});

test('스트레스와 매운맛·배달 조합은 매운 배달 메뉴를 우선한다', () => {
  const answers = {
    mood: 'stressed',
    energy: 'normal',
    feelings: ['spicy', 'hearty'],
    method: 'delivery',
    extras: []
  };
  const picks = recommendMenus(MENUS, answers, { preferences: {}, history: [], recentDays: 7 }, {
    count: 3,
    random: noRandom,
    now: fixedNow
  });

  assert.equal(picks[0].menu.feelings.includes('spicy'), true);
  assert.equal(picks[0].menu.methods.includes('delivery'), true);
});

test('최근 선택 메뉴에는 강한 감점이 적용된다', () => {
  const answers = {
    mood: 'calm',
    energy: 'normal',
    feelings: ['warm'],
    method: 'delivery',
    extras: []
  };
  const target = menu('shabu-shabu');
  const fresh = scoreMenu(target, answers, { preferences: {}, history: [], recentDays: 7 }, { now: fixedNow }).score;
  const repeated = scoreMenu(target, answers, {
    preferences: {},
    recentDays: 7,
    history: [{ menuId: target.id, selectedAt: '2026-07-20T18:00:00+09:00' }]
  }, { now: fixedNow }).score;

  assert.ok(repeated <= fresh - 20, `expected recent penalty, got ${fresh} -> ${repeated}`);
});

test('좋아요 선호 점수는 추천 점수에 반영되고 상한이 적용된다', () => {
  const answers = {
    mood: 'unsure',
    energy: 'normal',
    feelings: ['any'],
    method: 'any',
    extras: []
  };
  const target = menu('sushi');
  const base = scoreMenu(target, answers, { preferences: {}, history: [], recentDays: 7 }, { now: fixedNow }).score;
  const liked = scoreMenu(target, answers, { preferences: { sushi: 99 }, history: [], recentDays: 7 }, { now: fixedNow }).score;
  assert.equal(liked - base, 20);
});

test('추천 결과는 가능한 한 서로 다른 카테고리로 구성된다', () => {
  const picks = recommendMenus(MENUS, {
    mood: 'unsure', energy: 'normal', feelings: ['any'], method: 'any', extras: []
  }, { preferences: {}, history: [], recentDays: 7 }, {
    count: 3,
    random: noRandom,
    now: fixedNow
  });
  assert.equal(new Set(picks.map((item) => item.menu.category)).size, 3);
});

test('추천 이유에는 선택 조건과 메뉴명이 포함된다', () => {
  const reason = createRecommendationReason(menu('sundubu-jjigae'), {
    mood: 'comfort',
    energy: 'exhausted',
    feelings: ['warm', 'light'],
    method: 'delivery',
    extras: []
  });
  assert.match(reason, /많이 지친/);
  assert.match(reason, /순두부찌개/);
});
