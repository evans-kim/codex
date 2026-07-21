import { MENUS } from './menus.js';
import { createEmptyAnswers, recommendMenus, buildShareText } from './recommendation.js';
import {
  saveUserData,
  recordChoice,
  applyFeedback,
  updateRecentDays,
  exportUserData,
  importUserData,
  clearUserData
} from './storage.js';
import { app, ctx, menuById, steps } from './app-context.js';
import { render } from './app-view.js';

function showToast(message) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  clearTimeout(ctx.toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  ctx.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function startQuestions() {
  ctx.state = {
    ...ctx.state,
    screen: 'question',
    step: 0,
    answers: createEmptyAnswers(),
    recommendations: [],
    activeIndex: 0,
    excludedIds: [],
    modal: null
  };
  render();
}

function makeRecommendations({ quick = false } = {}) {
  if (quick) {
    ctx.state.answers = {
      mood: 'unsure',
      energy: 'normal',
      feelings: ['any'],
      method: 'any',
      extras: []
    };
  }

  let recommendations = recommendMenus(MENUS, ctx.state.answers, ctx.userData, {
    count: 3,
    excludedIds: ctx.state.excludedIds
  });

  if (recommendations.length < 3) {
    ctx.state.excludedIds = [];
    recommendations = recommendMenus(MENUS, ctx.state.answers, ctx.userData, { count: 3 });
  }

  ctx.state.recommendations = recommendations;
  ctx.state.activeIndex = 0;
  ctx.state.screen = 'result';
  ctx.state.modal = null;
  render();
}

function chooseSingle(field, value) {
  ctx.state.answers[field] = value;
  render();
}

function toggleMultiple(field, value, max) {
  const current = [...ctx.state.answers[field]];

  if (value === 'any') {
    ctx.state.answers[field] = current.includes('any') ? [] : ['any'];
    render();
    return;
  }

  const withoutAny = current.filter((item) => item !== 'any');
  if (withoutAny.includes(value)) {
    ctx.state.answers[field] = withoutAny.filter((item) => item !== value);
  } else if (withoutAny.length < max) {
    ctx.state.answers[field] = [...withoutAny, value];
  } else {
    showToast(`최대 ${max}개까지 고를 수 있어요.`);
    return;
  }
  render();
}

function toggleExtra(value) {
  const current = [...ctx.state.answers.extras];
  if (current.includes(value)) ctx.state.answers.extras = current.filter((item) => item !== value);
  else if (current.length < 2) ctx.state.answers.extras = [...current, value];
  else {
    showToast('추가 조건은 두 개까지 고를 수 있어요.');
    return;
  }
  render();
}

function goNext() {
  const step = steps[ctx.state.step];
  const value = ctx.state.answers[step.field];
  const valid = Array.isArray(value) ? value.length > 0 : Boolean(value);
  if (!valid) {
    showToast('한 가지를 골라주세요.');
    return;
  }

  if (ctx.state.step < steps.length - 1) {
    ctx.state.step += 1;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    makeRecommendations();
  }
}

function goBack() {
  if (ctx.state.screen === 'question' && ctx.state.step > 0) {
    ctx.state.step -= 1;
    render();
    return;
  }
  if (ctx.state.screen === 'result') {
    ctx.state.screen = 'question';
    ctx.state.step = steps.length - 1;
    ctx.state.modal = null;
    render();
    return;
  }
  ctx.state.screen = 'home';
  ctx.state.modal = null;
  render();
}

function setActiveMenu(id) {
  const index = ctx.state.recommendations.findIndex((item) => item.menu.id === id);
  if (index >= 0) {
    ctx.state.activeIndex = index;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function reroll() {
  const currentIds = ctx.state.recommendations.map((item) => item.menu.id);
  ctx.state.excludedIds = [...new Set([...ctx.state.excludedIds, ...currentIds])];
  makeRecommendations();
  showToast('새로운 메뉴 세 가지를 골랐어요.');
}

function confirmMenu(id) {
  const menu = menuById.get(id);
  if (!menu) return;
  ctx.userData = saveUserData(recordChoice(ctx.userData, id, ctx.state.answers));
  ctx.state.modal = { name: 'decision', menu };
  render();
}

function feedbackMenu(id, type) {
  const menu = menuById.get(id);
  if (!menu) return;
  ctx.userData = saveUserData(applyFeedback(ctx.userData, id, type));
  render();
  showToast(type === 'like' ? `${menu.name}, 다음 추천에 더 반영할게요.` : `${menu.name}, 다음에는 덜 추천할게요.`);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

async function shareMenu(id) {
  const menu = menuById.get(id);
  if (!menu) return;
  const text = buildShareText(menu, ctx.state.answers);
  try {
    if (navigator.share) {
      await navigator.share({ title: '오늘의 저녁 메뉴', text });
      return;
    }
    await copyText(text);
    showToast('공유 문구를 복사했어요.');
  } catch (error) {
    if (error?.name === 'AbortError') return;
    try {
      await copyText(text);
      showToast('공유 문구를 복사했어요.');
    } catch {
      showToast('공유하지 못했어요. 문구를 직접 복사해 주세요.');
    }
  }
}

function exportData() {
  const blob = new Blob([exportUserData(ctx.userData)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `yeobo-dinner-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('취향 데이터를 파일로 저장했어요.');
}

async function importData(file) {
  if (!file) return;
  try {
    const text = await file.text();
    ctx.userData = saveUserData(importUserData(text));
    ctx.state.modal = null;
    render();
    showToast('취향 데이터를 가져왔어요.');
  } catch {
    showToast('올바른 백업 파일인지 확인해 주세요.');
  }
}

function resetData() {
  const confirmed = window.confirm('좋아요와 최근 식사 기록을 모두 지울까요?');
  if (!confirmed) return;
  ctx.userData = clearUserData();
  ctx.state.modal = null;
  ctx.state.screen = 'home';
  render();
  showToast('브라우저 기록을 모두 초기화했어요.');
}

function updateNetworkStatus() {
  const pill = document.querySelector('[data-network]');
  if (!pill) return;
  pill.classList.toggle('is-online', navigator.onLine);
  pill.classList.toggle('is-offline', !navigator.onLine);
  pill.innerHTML = `<span aria-hidden="true"></span>${navigator.onLine ? '온라인' : '오프라인'}`;
}

app.addEventListener('click', async (event) => {
  const panel = event.target.closest('[data-modal-panel]');
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'close-modal' && panel && target === panel) return;
  if (action === 'close-modal' && target.classList.contains('modal-backdrop') && event.target.closest('[data-modal-panel]')) return;

  switch (action) {
    case 'home':
      event.preventDefault();
      ctx.state.screen = 'home';
      ctx.state.modal = null;
      render();
      break;
    case 'start':
      startQuestions();
      break;
    case 'quick-pick':
      ctx.state.excludedIds = [];
      makeRecommendations({ quick: true });
      break;
    case 'quick-from-recent':
      ctx.state.excludedIds = [target.dataset.id];
      makeRecommendations({ quick: true });
      break;
    case 'choose-single':
      chooseSingle(target.dataset.field, target.dataset.value);
      break;
    case 'choose-multiple':
      toggleMultiple(target.dataset.field, target.dataset.value, 2);
      break;
    case 'choose-extra':
      toggleExtra(target.dataset.value);
      break;
    case 'next':
      goNext();
      break;
    case 'back':
    case 'back-to-last-question':
      goBack();
      break;
    case 'restart':
      startQuestions();
      break;
    case 'set-active':
      setActiveMenu(target.dataset.id);
      break;
    case 'reroll':
      reroll();
      break;
    case 'confirm-menu':
      confirmMenu(target.dataset.id);
      break;
    case 'feedback':
      feedbackMenu(target.dataset.id, target.dataset.type);
      break;
    case 'share':
      await shareMenu(target.dataset.id);
      break;
    case 'history':
      ctx.state.modal = 'history';
      render();
      break;
    case 'settings':
      ctx.state.modal = 'settings';
      render();
      break;
    case 'close-modal':
      ctx.state.modal = null;
      render();
      break;
    case 'recent-days':
      ctx.userData = saveUserData(updateRecentDays(ctx.userData, Number(target.dataset.value)));
      render();
      showToast('중복 추천 기간을 바꿨어요.');
      break;
    case 'export-data':
      exportData();
      break;
    case 'reset-data':
      resetData();
      break;
    case 'install':
      if (ctx.installPrompt) {
        ctx.installPrompt.prompt();
        await ctx.installPrompt.userChoice;
        ctx.installPrompt = null;
        ctx.state.modal = null;
        render();
      }
      break;
    default:
      break;
  }
});

app.addEventListener('change', (event) => {
  if (event.target.matches('[data-action="import-data"]')) {
    importData(event.target.files?.[0]);
  }
});

app.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && ctx.state.modal) {
    ctx.state.modal = null;
    render();
  }
});

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  ctx.installPrompt = event;
});

window.addEventListener('appinstalled', () => {
  ctx.installPrompt = null;
  showToast('홈 화면에 앱을 설치했어요.');
});

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 추천 기능은 서비스 워커 없이도 정상 작동한다.
    });
  });
}

const quickStart = new URLSearchParams(window.location.search).get('quick') === '1';
if (quickStart) {
  window.history.replaceState({}, '', window.location.pathname);
  makeRecommendations({ quick: true });
} else {
  render();
}
