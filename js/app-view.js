import { EXTRA_FILTERS, LABELS } from './menus.js';
import { createRecommendationReason } from './recommendation.js';
import { app, ctx, formatter, menuById, steps } from './app-context.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function iconButton(action, label, icon) {
  return `<button class="icon-button" type="button" data-action="${action}" aria-label="${label}" title="${label}">${icon}</button>`;
}

function renderTopbar({ backAction = null, title = '여보, 오늘 뭐 먹지?' } = {}) {
  const left = backAction
    ? `<button class="icon-button" type="button" data-action="${backAction}" aria-label="뒤로 가기">←</button>`
    : `<span class="brand-mark" aria-hidden="true">♡</span>`;

  return `
    <header class="topbar">
      <div class="topbar-side">${left}</div>
      <a class="topbar-title" href="#" data-action="home" aria-label="첫 화면으로 이동">${title}</a>
      <div class="topbar-side topbar-actions">
        ${iconButton('history', '최근 저녁 기록', '◷')}
        ${iconButton('settings', '설정', '⚙')}
      </div>
    </header>
  `;
}

function renderAppFrame(content, options = {}) {
  const networkLabel = navigator.onLine ? '온라인' : '오프라인';
  const networkClass = navigator.onLine ? 'is-online' : 'is-offline';
  const modal = ctx.state.modal ? renderModal(ctx.state.modal) : '';

  return `
    <div class="app-shell">
      ${renderTopbar(options)}
      <main class="main-content" id="main-content">${content}</main>
      <div class="network-pill ${networkClass}" data-network role="status" aria-live="polite">
        <span aria-hidden="true"></span>${networkLabel}
      </div>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>
      ${modal}
    </div>
  `;
}

function renderHome() {
  const recent = ctx.userData.history[0];
  const recentMenu = recent ? menuById.get(recent.menuId) : null;
  const recentMarkup = recentMenu
    ? `
      <button class="recent-card" type="button" data-action="quick-from-recent" data-id="${recentMenu.id}">
        <img src="${recentMenu.image}" alt="" loading="lazy">
        <span>
          <small>최근에 골랐던 메뉴</small>
          <strong>${recentMenu.name}</strong>
          <em>${formatter.format(new Date(recent.selectedAt))}</em>
        </span>
        <span aria-hidden="true">→</span>
      </button>
    `
    : '';

  return renderAppFrame(`
    <section class="hero-section">
      <div class="hero-copy">
        <p class="eyebrow">오늘의 마음을 고르면</p>
        <h1>오늘의 저녁이<br><span>조금 더 쉽게</span> 정해져요.</h1>
        <p class="hero-description">기분, 피로도, 당기는 맛을 가볍게 고르면 이미지와 함께 저녁 메뉴 세 가지를 추천해요.</p>
      </div>

      <div class="hero-collage" aria-label="여러 저녁 메뉴 일러스트">
        <figure class="hero-image hero-image-main"><img src="./assets/menus/shabu-shabu.svg" alt="샤브샤브 일러스트"></figure>
        <figure class="hero-image hero-image-small hero-image-one"><img src="./assets/menus/sushi.svg" alt="초밥 일러스트"></figure>
        <figure class="hero-image hero-image-small hero-image-two"><img src="./assets/menus/tomato-pasta.svg" alt="토마토 파스타 일러스트"></figure>
        <div class="hero-note"><span>오늘은</span><strong>맛있는 걸로</strong></div>
      </div>

      <div class="home-actions">
        <button class="primary-button primary-button-large" type="button" data-action="start" data-autofocus>
          <span>오늘의 저녁 고르기</span><span aria-hidden="true">→</span>
        </button>
        <button class="secondary-button" type="button" data-action="quick-pick">
          <span aria-hidden="true">🎲</span> 오늘은 그냥 골라줘
        </button>
      </div>

      ${recentMarkup}

      <div class="privacy-card">
        <span class="privacy-icon" aria-hidden="true">⌁</span>
        <div>
          <strong>기록은 이 브라우저에만 저장돼요</strong>
          <p>기분과 메뉴 선택은 서버나 외부 분석 서비스로 전송하지 않습니다.</p>
        </div>
      </div>
    </section>
  `);
}

function optionSelected(field, value) {
  const current = ctx.state.answers[field];
  return Array.isArray(current) ? current.includes(value) : current === value;
}

function renderOption(item, step) {
  const selected = optionSelected(step.field, item.id);
  const action = step.type === 'multiple' ? 'choose-multiple' : 'choose-single';
  return `
    <button
      class="choice-card ${selected ? 'is-selected' : ''}"
      type="button"
      data-action="${action}"
      data-field="${step.field}"
      data-value="${item.id}"
      aria-pressed="${selected}"
    >
      <span class="choice-emoji" aria-hidden="true">${item.emoji}</span>
      <span class="choice-copy">
        <strong>${item.label}</strong>
        ${item.hint ? `<small>${item.hint}</small>` : ''}
      </span>
      <span class="choice-check" aria-hidden="true">✓</span>
    </button>
  `;
}

function renderExtraFilters() {
  return `
    <details class="extra-filters" ${ctx.state.answers.extras.length ? 'open' : ''}>
      <summary>조금 더 정확하게 고르기 <span>선택 사항</span></summary>
      <p>당기는 재료나 형태를 최대 두 가지까지 골라주세요.</p>
      <div class="filter-chips">
        ${EXTRA_FILTERS.map((item) => {
          const selected = ctx.state.answers.extras.includes(item.id);
          return `
            <button class="filter-chip ${selected ? 'is-selected' : ''}" type="button"
              data-action="choose-extra" data-value="${item.id}" aria-pressed="${selected}">
              <span aria-hidden="true">${item.emoji}</span>${item.label}
            </button>
          `;
        }).join('')}
      </div>
    </details>
  `;
}

function renderQuestion() {
  const step = steps[ctx.state.step];
  const progress = ((ctx.state.step + 1) / steps.length) * 100;
  const optionsClass = step.type === 'multiple' ? 'choice-grid choice-grid-compact' : 'choice-grid';
  const canContinue = step.type === 'multiple'
    ? ctx.state.answers[step.field].length > 0
    : Boolean(ctx.state.answers[step.field]);

  return renderAppFrame(`
    <section class="question-section">
      <div class="progress-wrap" aria-label="질문 진행률 ${ctx.state.step + 1}/${steps.length}">
        <div class="progress-meta"><span>${ctx.state.step + 1} / ${steps.length}</span><span>${step.eyebrow}</span></div>
        <div class="progress-track"><span style="width:${progress}%"></span></div>
      </div>

      <header class="question-heading">
        <p class="eyebrow">${step.eyebrow}</p>
        <h1>${step.title}</h1>
        <p>${step.subtitle}</p>
      </header>

      <div class="${optionsClass}">
        ${step.items.map((item) => renderOption(item, step)).join('')}
      </div>

      ${step.type === 'method' ? renderExtraFilters() : ''}

      <div class="question-actions">
        ${ctx.state.step > 0 ? '<button class="text-button" type="button" data-action="back">이전</button>' : '<span></span>'}
        <button class="primary-button" type="button" data-action="next" ${canContinue ? '' : 'disabled'}>
          ${ctx.state.step === steps.length - 1 ? '메뉴 추천받기' : '다음'} <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  `, { backAction: ctx.state.step > 0 ? 'back' : 'home', title: '오늘의 저녁 찾기' });
}

function menuTagMarkup(menu) {
  const tags = [];
  if (menu.feelings.includes('warm')) tags.push('따뜻함');
  if (menu.feelings.includes('spicy')) tags.push('매콤함');
  if (menu.feelings.includes('light')) tags.push('담백함');
  if (menu.feelings.includes('crispy')) tags.push('바삭함');
  if (menu.feelings.includes('special')) tags.push('기분 전환');
  if (menu.features.includes('gentle')) tags.push('속 편함');
  return tags.slice(0, 3).map((tag) => `<span>${tag}</span>`).join('');
}

function renderResult() {
  const active = ctx.state.recommendations[ctx.state.activeIndex] ?? ctx.state.recommendations[0];
  if (!active) {
    return renderAppFrame(`
      <section class="empty-ctx.state">
        <h1>추천을 다시 준비할게요</h1>
        <button class="primary-button" type="button" data-action="restart">처음부터 고르기</button>
      </section>
    `);
  }

  const menu = active.menu;
  const reason = createRecommendationReason(menu, ctx.state.answers);
  const preference = Number(ctx.userData.preferences[menu.id] ?? 0);
  const alternatives = ctx.state.recommendations.filter((_, index) => index !== ctx.state.activeIndex);

  return renderAppFrame(`
    <section class="result-section">
      <header class="result-heading">
        <p class="eyebrow">오늘의 첫 번째 추천</p>
        <h1>오늘은 <span>${menu.name}</span> 어때요?</h1>
        <p>답변과 최근 기록을 브라우저 안에서 계산해 골랐어요.</p>
      </header>

      <article class="featured-menu-card">
        <div class="featured-image-wrap">
          <img src="${menu.image}" alt="${menu.name} 일러스트" decoding="async">
          <span class="category-badge">${menu.category}</span>
          <span class="rank-badge">BEST</span>
        </div>
        <div class="featured-content">
          <div class="menu-title-row">
            <div><small>오늘의 추천</small><h2>${menu.name}</h2></div>
            <button class="heart-button ${preference > 0 ? 'is-active' : ''}" type="button" data-action="feedback" data-type="like" data-id="${menu.id}" aria-label="${menu.name} 좋아요" aria-pressed="${preference > 0}">♡</button>
          </div>
          <p class="menu-description">${menu.description}</p>
          <div class="menu-tags">${menuTagMarkup(menu)}</div>
          <div class="reason-box"><span aria-hidden="true">✦</span><p>${reason}</p></div>

          <div class="result-primary-actions">
            <button class="primary-button primary-button-large" type="button" data-action="confirm-menu" data-id="${menu.id}">이걸로 먹을래요</button>
            <button class="secondary-button" type="button" data-action="share" data-id="${menu.id}"><span aria-hidden="true">↗</span> 남편에게 보내기</button>
          </div>

          <div class="feedback-row" aria-label="추천 피드백">
            <span>추천이 어땠나요?</span>
            <button type="button" data-action="feedback" data-type="like" data-id="${menu.id}">👍 좋아요</button>
            <button type="button" data-action="feedback" data-type="dislike" data-id="${menu.id}">👎 별로예요</button>
          </div>
        </div>
      </article>

      <section class="alternative-section">
        <div class="section-title-row"><div><p class="eyebrow">다른 선택지</p><h2>이 메뉴들도 잘 어울려요</h2></div></div>
        <div class="alternative-grid">
          ${alternatives.map((item) => `
            <button class="alternative-card" type="button" data-action="set-active" data-id="${item.menu.id}">
              <img src="${item.menu.image}" alt="${item.menu.name} 일러스트" loading="lazy" decoding="async">
              <span><small>${item.menu.category}</small><strong>${item.menu.name}</strong><em>${item.menu.description}</em></span>
              <i aria-hidden="true">→</i>
            </button>
          `).join('')}
        </div>
      </section>

      <div class="result-footer-actions">
        <button class="secondary-button" type="button" data-action="reroll"><span aria-hidden="true">↻</span> 다른 메뉴 세 개</button>
        <button class="text-button" type="button" data-action="restart">완전히 다시 고르기</button>
      </div>
    </section>
  `, { backAction: 'back-to-last-question', title: '오늘의 추천' });
}

function renderHistoryModal() {
  const history = ctx.userData.history.slice(0, 20);
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="history-title" data-modal-panel>
        <div class="modal-handle" aria-hidden="true"></div>
        <header class="modal-header">
          <div><p class="eyebrow">이 브라우저의 기록</p><h2 id="history-title">최근 저녁</h2></div>
          ${iconButton('close-modal', '닫기', '×')}
        </header>
        ${history.length ? `
          <div class="history-list">
            ${history.map((item) => {
              const menu = menuById.get(item.menuId);
              if (!menu) return '';
              return `
                <div class="history-item">
                  <img src="${menu.image}" alt="" loading="lazy">
                  <div><strong>${menu.name}</strong><span>${formatter.format(new Date(item.selectedAt))}</span></div>
                  <span>${item.method && LABELS.methods[item.method] ? LABELS.methods[item.method] : ''}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="modal-empty"><span aria-hidden="true">🍽️</span><strong>아직 고른 메뉴가 없어요</strong><p>첫 메뉴를 정하면 이곳에 기록돼요.</p></div>
        `}
      </section>
    </div>
  `;
}

function renderSettingsModal() {
  const installMarkup = ctx.installPrompt
    ? '<button class="settings-action" type="button" data-action="install"><span>홈 화면에 앱 설치</span><i>→</i></button>'
    : '';

  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal-sheet modal-sheet-settings" role="dialog" aria-modal="true" aria-labelledby="settings-title" data-modal-panel>
        <div class="modal-handle" aria-hidden="true"></div>
        <header class="modal-header">
          <div><p class="eyebrow">내 기기에서만</p><h2 id="settings-title">설정</h2></div>
          ${iconButton('close-modal', '닫기', '×')}
        </header>

        <section class="settings-group">
          <h3>최근 메뉴 중복 피하기</h3>
          <p>선택한 기간 안에 먹은 메뉴는 추천 점수를 낮춰요.</p>
          <div class="segmented-control" role="radiogroup" aria-label="최근 메뉴 제외 기간">
            ${[
              [0, '허용'], [3, '3일'], [7, '7일'], [14, '14일']
            ].map(([value, label]) => `
              <button type="button" role="radio" aria-checked="${ctx.userData.recentDays === value}" class="${ctx.userData.recentDays === value ? 'is-active' : ''}" data-action="recent-days" data-value="${value}">${label}</button>
            `).join('')}
          </div>
        </section>

        <section class="settings-group">
          <h3>내 데이터</h3>
          <p>좋아요와 식사 기록은 이 브라우저의 localStorage에만 저장돼요.</p>
          <div class="settings-list">
            ${installMarkup}
            <button class="settings-action" type="button" data-action="export-data"><span>취향 데이터 내보내기</span><i>↓</i></button>
            <label class="settings-action" for="import-file"><span>취향 데이터 가져오기</span><i>↑</i></label>
            <input id="import-file" class="visually-hidden" type="file" accept="application/json,.json" data-action="import-data">
            <button class="settings-action danger" type="button" data-action="reset-data"><span>모든 기록 초기화</span><i>×</i></button>
          </div>
        </section>

        <div class="privacy-detail">
          <span aria-hidden="true">⌁</span>
          <p><strong>외부 전송 없음</strong> 광고, 분석 도구, 외부 API를 사용하지 않으며 앱 파일과 메뉴 이미지만 불러옵니다.</p>
        </div>
      </section>
    </div>
  `;
}

function renderDecisionModal(menu) {
  return `
    <div class="modal-backdrop modal-backdrop-center" data-action="close-modal">
      <section class="decision-modal" role="dialog" aria-modal="true" aria-labelledby="decision-title" data-modal-panel>
        <div class="confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <img src="${menu.image}" alt="${menu.name} 일러스트">
        <p class="eyebrow">오늘 저녁 결정!</p>
        <h2 id="decision-title">${menu.name}으로 정했어요</h2>
        <p>맛있게 먹고 오늘 하루도 편안하게 마무리해요.</p>
        <button class="primary-button primary-button-large" type="button" data-action="share" data-id="${menu.id}">남편에게 알려주기 <span aria-hidden="true">↗</span></button>
        <button class="text-button" type="button" data-action="close-modal">결과로 돌아가기</button>
      </section>
    </div>
  `;
}

function renderModal(type) {
  if (type === 'history') return renderHistoryModal();
  if (type === 'settings') return renderSettingsModal();
  if (type?.name === 'decision') return renderDecisionModal(type.menu);
  return '';
}

export function render() {
  if (ctx.state.screen === 'home') app.innerHTML = renderHome();
  else if (ctx.state.screen === 'question') app.innerHTML = renderQuestion();
  else if (ctx.state.screen === 'result') app.innerHTML = renderResult();
  else app.innerHTML = renderHome();

  requestAnimationFrame(() => {
    const autofocus = app.querySelector('[data-autofocus]');
    if (autofocus) autofocus.focus({ preventScroll: true });
  });
}
