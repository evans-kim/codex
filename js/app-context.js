import { MOODS, ENERGY_LEVELS, FEELINGS, METHODS, MENUS } from './menus.js';
import { createEmptyAnswers } from './recommendation.js';
import { loadUserData } from './storage.js';

export const app = document.querySelector('#app');
export const menuById = new Map(MENUS.map((menu) => [menu.id, menu]));
export const formatter = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short'
});

export const ctx = {
  userData: loadUserData(),
  installPrompt: null,
  toastTimer: null,
  state: {
    screen: 'home',
    step: 0,
    answers: createEmptyAnswers(),
    recommendations: [],
    activeIndex: 0,
    excludedIds: [],
    modal: null
  }
};

export const steps = [
  {
    field: 'mood',
    eyebrow: '마음부터 살펴볼게요',
    title: '오늘 기분은 어디에 가까워요?',
    subtitle: '정답은 없어요. 지금 가장 가까운 하나만 골라주세요.',
    type: 'single',
    items: MOODS
  },
  {
    field: 'energy',
    eyebrow: '오늘의 체력',
    title: '몸은 어느 정도로 지쳤어요?',
    subtitle: '조리나 외출 부담까지 추천에 함께 반영할게요.',
    type: 'single',
    items: ENERGY_LEVELS
  },
  {
    field: 'feelings',
    eyebrow: '입맛 힌트',
    title: '오늘은 어떤 음식이 당겨요?',
    subtitle: '최대 두 가지를 고르거나, 잘 모르겠어요를 선택하세요.',
    type: 'multiple',
    items: FEELINGS,
    max: 2
  },
  {
    field: 'method',
    eyebrow: '마지막 한 단계',
    title: '오늘은 어떻게 먹고 싶어요?',
    subtitle: '선택한 방식으로 가능한 메뉴를 우선 추천해요.',
    type: 'method',
    items: METHODS
  }
];
