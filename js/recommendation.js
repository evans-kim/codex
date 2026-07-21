import { LABELS } from './menus.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function createEmptyAnswers() {
  return {
    mood: null,
    energy: null,
    feelings: [],
    method: null,
    extras: []
  };
}

export function isWithinDays(isoDate, days, now = new Date()) {
  if (!isoDate || !Number.isFinite(days) || days <= 0) return false;
  const time = new Date(isoDate).getTime();
  if (!Number.isFinite(time)) return false;
  const difference = now.getTime() - time;
  return difference >= 0 && difference < days * DAY_MS;
}

export function scoreMenu(menu, answers, userData = {}, options = {}) {
  const now = options.now ?? new Date();
  const recentDays = Number(userData.recentDays ?? 7);
  const preferences = userData.preferences ?? {};
  const history = Array.isArray(userData.history) ? userData.history : [];
  let score = 20;
  const matched = [];

  if (answers.mood) {
    const moodScore = Number(menu.moods?.[answers.mood] ?? 0);
    score += moodScore * 3;
    if (moodScore >= 4) matched.push('mood');
  }

  if (answers.energy) {
    const energyScore = Number(menu.energies?.[answers.energy] ?? 0);
    score += energyScore * 2.5;
    if (energyScore >= 4) matched.push('energy');
  }

  const selectedFeelings = (answers.feelings ?? []).filter((id) => id !== 'any');
  if (selectedFeelings.length) {
    for (const feeling of selectedFeelings) {
      if (menu.feelings.includes(feeling)) {
        score += 8;
        matched.push(`feeling:${feeling}`);
      } else {
        score -= 1.5;
      }
    }
  }

  if (answers.method && answers.method !== 'any') {
    if (menu.methods.includes(answers.method)) {
      score += 8;
      matched.push('method');
    } else {
      score -= 18;
    }
  }

  for (const extra of answers.extras ?? []) {
    if (menu.features.includes(extra)) {
      score += 5;
      matched.push(`extra:${extra}`);
    } else {
      score -= 1;
    }
  }

  if (answers.energy === 'noMotivation') {
    if (menu.methods.includes('delivery') || menu.methods.includes('takeout')) score += 8;
    if (menu.methods.length === 1 && menu.methods[0] === 'restaurant') score -= 8;
  }

  if (answers.mood === 'sensitive') {
    if (menu.features.includes('gentle')) score += 7;
    if (menu.feelings.includes('spicy')) score -= 8;
  }

  if (answers.mood === 'stressed' || answers.mood === 'frustrated') {
    if (menu.feelings.includes('spicy') || menu.feelings.includes('crispy') || menu.feelings.includes('special')) score += 3;
  }

  if (answers.mood === 'unsure' && menu.safe) score += 8;

  const preference = Math.max(-5, Math.min(8, Number(preferences[menu.id] ?? 0)));
  score += preference * 2.5;

  const latestChoice = history.find((item) => item.menuId === menu.id);
  if (latestChoice && isWithinDays(latestChoice.selectedAt, recentDays, now)) {
    const age = now.getTime() - new Date(latestChoice.selectedAt).getTime();
    const strongWindow = Math.min(3, recentDays);
    score -= age < strongWindow * DAY_MS ? 24 : 12;
  }

  const selectionCount = history.filter((item) => item.menuId === menu.id).length;
  score += Math.min(selectionCount, 4) * 0.5;

  return { score, matched };
}

export function recommendMenus(menus, answers, userData = {}, options = {}) {
  const count = options.count ?? 3;
  const excludedIds = new Set(options.excludedIds ?? []);
  const random = options.random ?? Math.random;
  const now = options.now ?? new Date();

  const ranked = menus
    .filter((menu) => !excludedIds.has(menu.id))
    .map((menu) => {
      const result = scoreMenu(menu, answers, userData, { now });
      return {
        menu,
        score: result.score + random() * 3.5,
        matched: result.matched
      };
    })
    .sort((a, b) => b.score - a.score);

  const pool = ranked.slice(0, Math.max(9, count * 3));
  const picks = [];
  const usedCategories = new Set();

  while (picks.length < count && pool.length) {
    let index = pool.findIndex((candidate) => !usedCategories.has(candidate.menu.category));
    if (index < 0) index = 0;
    const [picked] = pool.splice(index, 1);
    picks.push(picked);
    usedCategories.add(picked.menu.category);
  }

  return picks;
}

export function createRecommendationReason(menu, answers) {
  const parts = [];

  if (answers.energy === 'exhausted' || answers.energy === 'noMotivation') {
    parts.push('오늘 많이 지친 상태를 고려했고');
  } else if (answers.energy === 'tired') {
    parts.push('조금 피곤한 몸을 편하게 채울 수 있고');
  } else if (answers.energy === 'high') {
    parts.push('오늘의 좋은 에너지를 이어갈 수 있고');
  }

  const feelings = (answers.feelings ?? []).filter((id) => id !== 'any');
  const matchedFeelings = feelings.filter((id) => menu.feelings.includes(id));
  if (matchedFeelings.length) {
    const labels = matchedFeelings.map((id) => LABELS.feelings[id]).join(' · ');
    parts.push(`${labels} 음식이 당긴다는 점을 반영했어요`);
  }

  if (answers.mood === 'comfort') {
    parts.push('포근하게 위로받고 싶은 마음에도 잘 맞아요');
  } else if (answers.mood === 'sensitive' && menu.features.includes('gentle')) {
    parts.push('자극이 적고 속이 편한 편이에요');
  } else if ((answers.mood === 'stressed' || answers.mood === 'frustrated') && (menu.feelings.includes('spicy') || menu.feelings.includes('crispy'))) {
    parts.push('확실한 맛과 식감으로 기분 전환하기 좋아요');
  } else if (answers.mood === 'unsure' && menu.safe) {
    parts.push('평소에도 실패 가능성이 낮은 안전 메뉴예요');
  }

  if (answers.method && answers.method !== 'any' && menu.methods.includes(answers.method)) {
    parts.push(`${LABELS.methods[answers.method]}에 잘 맞아요`);
  }

  if (!parts.length) return `${menu.description}. 오늘의 답변과 잘 어울리는 메뉴로 골라봤어요.`;
  return `${parts.join(', ')}. 그래서 ${menu.name}을 골라봤어요.`;
}

export function buildShareText(menu, answers) {
  const feelingLabels = (answers.feelings ?? [])
    .filter((id) => id !== 'any')
    .map((id) => LABELS.feelings[id])
    .slice(0, 2);
  const detail = feelingLabels.length ? ` (${feelingLabels.join(' · ')})` : '';
  return `오늘 저녁은 ${menu.name}${detail}이 먹고 싶어요 😊`;
}
