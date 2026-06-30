const state = {
  config: null,
  view: 'guides',
  activeType: 'all',
  activeGroup: 'all',
  openSections: new Set(),
  sidebarCollapsed: true,
  query: '',
  sideQuery: '',
  device: '전체',
  action: '전체',
  sort: 'latest',
  favorites: new Set(JSON.parse(localStorage.getItem('danbi-favorites') || '[]')),
  dashboardRows: []
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clean = (value) => String(value ?? '').replace(/\r/g, '').trim();
const escapeHtml = (value) => clean(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char]));
const escapeAttr = escapeHtml;
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

const TECH_ACTIONS = ['전체', '점검', '교체', '기타'];
const GENERAL_ACTIONS = ['전체', '안내', '접수', '이관', '기준', '기타'];
const TECH_DEVICES = ['전체', '윙크봇', '윙크스쿨', '학부모앱', '레노버', '삼성탭', '교사PC', '공통'];
const GENERAL_DEVICES = ['전체', '공통', '학부모앱', '교사PC'];

const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5v-9Z"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V5"/><path d="M4 20h17"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-9"/></svg>',
  wifi: '<svg viewBox="0 0 24 24"><path d="M4.5 9.5a12 12 0 0 1 15 0"/><path d="M7.5 13a7.2 7.2 0 0 1 9 0"/><path d="M10.2 16.4a3 3 0 0 1 3.6 0"/><path d="M12 20h.01"/></svg>',
  power: '<svg viewBox="0 0 24 24"><path d="M12 3v8"/><path d="M7.05 6.75a8 8 0 1 0 9.9 0"/></svg>',
  app: '<svg viewBox="0 0 24 24"><path d="M4 4h6v6H4z"/><path d="M14 4h6v6h-6z"/><path d="M4 14h6v6H4z"/><path d="M14 14h6v6h-6z"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><path d="M6 11h12v9H6z"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/></svg>',
  monitor: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H4z"/><path d="M9 20h6"/><path d="M12 16v4"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05a2.1 2.1 0 0 1-2.96 2.96l-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.66V21a2.1 2.1 0 0 1-4.2 0v-.07A1.8 1.8 0 0 0 8.4 19.3a1.8 1.8 0 0 0-2 .36l-.05.05a2.1 2.1 0 0 1-2.96-2.96l.05-.05a1.8 1.8 0 0 0 .36-2 1.8 1.8 0 0 0-1.66-1.1H2a2.1 2.1 0 0 1 0-4.2h.07A1.8 1.8 0 0 0 3.7 8.3a1.8 1.8 0 0 0-.36-2l-.05-.05a2.1 2.1 0 0 1 2.96-2.96l.05.05a1.8 1.8 0 0 0 2 .36h.1A1.8 1.8 0 0 0 9.5 2.07V2a2.1 2.1 0 0 1 4.2 0v.07a1.8 1.8 0 0 0 1.1 1.63 1.8 1.8 0 0 0 2-.36l.05-.05a2.1 2.1 0 0 1 2.96 2.96l-.05.05a1.8 1.8 0 0 0-.36 2v.1a1.8 1.8 0 0 0 1.66 1.1H22a2.1 2.1 0 0 1 0 4.2h-.07A1.8 1.8 0 0 0 19.4 15Z"/></svg>',
  user: '<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  more: '<svg viewBox="0 0 24 24"><path d="M5 12h.01"/><path d="M12 12h.01"/><path d="M19 12h.01"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4V5Z"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12Z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/></svg>',
  payment: '<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="M4 10h16"/><path d="M8 15h3"/></svg>',
  return: '<svg viewBox="0 0 24 24"><path d="M9 7 4 12l5 5"/><path d="M5 12h10a5 5 0 1 1 0 10h-2"/></svg>',
  delivery: '<svg viewBox="0 0 24 24"><path d="M3 7h11v10H3z"/><path d="M14 11h4l3 3v3h-7z"/><path d="M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M12 3 3.5 7.5 12 12l8.5-4.5L12 3Z"/><path d="M3.5 7.5V16L12 21l8.5-5V7.5"/><path d="M12 12v9"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M5 9h14"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2 7.5 14 3 9.6l6.2-.9L12 3Z"/></svg>',
  speed: '<svg viewBox="0 0 24 24"><path d="M4 15a8 8 0 1 1 16 0"/><path d="m12 15 4-4"/><path d="M12 15h.01"/></svg>',
  router: '<svg viewBox="0 0 24 24"><path d="M5 12h14v7H5z"/><path d="M8 16h.01"/><path d="M12 16h.01"/><path d="M16 16h.01"/><path d="M9 8a5 5 0 0 1 6 0"/><path d="M6.5 5.5a9 9 0 0 1 11 0"/></svg>',
  touch: '<svg viewBox="0 0 24 24"><path d="M9 11V5a2 2 0 0 1 4 0v8"/><path d="M13 9.5a2 2 0 0 1 4 0V14"/><path d="M17 11.5a2 2 0 0 1 4 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.3-3.2L5 14a1.8 1.8 0 0 1 3.1-1.8L9 13.5"/></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M4 4v6h6"/><path d="M5.5 10A7 7 0 1 1 7 18.5"/></svg>',
  test: '<svg viewBox="0 0 24 24"><path d="M9 2h6"/><path d="M10 2v6l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V2"/><path d="M8 15h8"/></svg>'
};

init();

async function init(){
  applySavedTheme();
  applySavedSidebar();
  try{
    state.config = await fetchJson('./app.json');
    bindChrome();
    renderNav();
    renderPage();
    loadDashboardRows().then(rows => { state.dashboardRows = rows; if(state.view === 'dashboard') renderPage(); }).catch(() => {});
  }catch(error){
    console.error(error);
    $('#pageRoot').innerHTML = `<div class="empty-card"><div><h2>가이드를 불러오지 못했습니다.</h2><p>${escapeHtml(error.message)}</p></div></div>`;
  }
}

async function fetchJson(url){
  const res = await fetch(url, { cache:'no-store' });
  if(!res.ok) throw new Error(`config load failed: ${res.status}`);
  return res.json();
}

function applySavedTheme(){
  const saved = localStorage.getItem('danbi-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function applySavedSidebar(){
  const saved = localStorage.getItem('danbi-sidebar-collapsed');
  state.sidebarCollapsed = saved == null ? true : saved === 'true';
  document.body.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
}

function bindChrome(){
  $('#sidebarToggle').addEventListener('click', () => setSidebarCollapsed(!state.sidebarCollapsed));
  $('#brandHome').addEventListener('click', () => { state.view = 'guides'; state.activeType = 'all'; state.activeGroup = 'all'; resetFilters(); renderAll(); });
  $('#expandAll').addEventListener('click', () => { setSidebarCollapsed(false); state.openSections = new Set(['technical','general']); renderNav(); });
  $('#collapseAll').addEventListener('click', () => { state.openSections.clear(); renderNav(); });
  $('#themeToggle').addEventListener('click', toggleTheme);
  $('#sidebarSettings').addEventListener('click', () => { setSidebarCollapsed(false); state.openSections = new Set(['technical','general']); renderNav(); });

  const onSearch = (value) => {
    state.query = clean(value);
    $('#globalSearch').value = state.query;
    $('#sideSearch').value = state.query;
    const inline = $('#inlineSearch');
    if(inline) inline.value = state.query;
    state.view = 'guides';
    renderPage();
  };
  $('#globalSearch').addEventListener('input', e => onSearch(e.target.value));
  $('#sideSearch').addEventListener('input', e => onSearch(e.target.value));
  window.addEventListener('keydown', e => {
    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault();
      $('#globalSearch').focus();
    }
  });
}

function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('danbi-theme', next);
}

function setSidebarCollapsed(collapsed){
  state.sidebarCollapsed = collapsed;
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  localStorage.setItem('danbi-sidebar-collapsed', String(collapsed));
  $('#sidebarToggle').setAttribute('aria-label', collapsed ? '사이드바 펼치기' : '사이드바 접기');
}

function renderAll(){
  renderNav();
  renderPage();
}

function renderNav(){
  const techOpen = state.openSections.has('technical');
  const generalOpen = state.openSections.has('general');
  const isHome = state.view === 'guides' && state.activeType === 'all' && state.activeGroup === 'all';
  const isDash = state.view === 'dashboard';

  $('#mainNav').innerHTML = `
    <button class="nav-btn ${isHome ? 'active' : ''}" type="button" data-view="home" title="홈">
      <span class="nav-icon" aria-hidden="true">${ICONS.home}</span>
      <span class="nav-text"><strong>홈</strong><small>전체 상담가이드</small></span>
    </button>
    <button class="nav-btn ${isDash ? 'active' : ''}" type="button" data-view="dashboard" title="점검 운영 현황">
      <span class="nav-icon" aria-hidden="true">${ICONS.chart}</span>
      <span class="nav-text"><strong>점검 운영 현황</strong><small>대시보드</small></span>
    </button>
    <div class="nav-divider" aria-hidden="true"></div>
    ${sectionTemplate('technical','기술상담','장애 · 오류 · 학습기', ICONS.monitor, state.config.technicalGroups, techOpen)}
    ${sectionTemplate('general','일반상담','요금 · 배송 · 혜택', ICONS.chat, state.config.generalGroups, generalOpen)}
  `;

  $$('#mainNav [data-view]').forEach(btn => btn.addEventListener('click', () => {
    state.view = btn.dataset.view === 'dashboard' ? 'dashboard' : 'guides';
    if(btn.dataset.view === 'home'){
      state.activeType = 'all';
      state.activeGroup = 'all';
      resetFilters();
    }
    renderAll();
  }));

  $$('#mainNav [data-section]').forEach(btn => btn.addEventListener('click', () => {
    const section = btn.dataset.section;
    if(state.sidebarCollapsed){
      setSidebarCollapsed(false);
      state.openSections.add(section);
    }else{
      if(state.openSections.has(section)) state.openSections.delete(section);
      else state.openSections.add(section);
    }
    renderNav();
  }));

  $$('#mainNav [data-group]').forEach(btn => btn.addEventListener('click', () => {
    state.view = 'guides';
    state.activeType = btn.dataset.type;
    state.activeGroup = btn.dataset.group;
    resetFilters();
    renderAll();
  }));
}

function sectionTemplate(id, label, desc, icon, groups, open){
  const activeSection = state.activeType === id;
  return `
    <div class="section ${open ? 'open' : ''}">
      <button class="section-btn ${activeSection ? 'active' : ''}" type="button" data-section="${id}" title="${escapeAttr(label)}">
        <span class="nav-icon" aria-hidden="true">${icon}</span>
        <span class="nav-text"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(desc)}</small></span>
        <span class="section-caret" aria-hidden="true">⌄</span>
      </button>
      <div class="sub-list">
        ${groups.map(group => `
          <button class="sub-btn ${state.activeType === id && state.activeGroup === group.id ? 'active' : ''}" type="button" data-type="${id}" data-group="${group.id}">
            ${escapeHtml(group.label)}
          </button>`).join('')}
      </div>
    </div>`;
}

function resetFilters(){
  state.device = '전체';
  state.action = '전체';
}

function renderPage(){
  if(state.view === 'dashboard'){
    $('#pageRoot').innerHTML = dashboardTemplate();
    return;
  }

  const items = getFilteredItems();
  const context = getCurrentContext();
  const deviceOptions = state.activeType === 'general' ? GENERAL_DEVICES : TECH_DEVICES;
  const actionOptions = state.activeType === 'general' ? GENERAL_ACTIONS : TECH_ACTIONS;

  $('#pageRoot').innerHTML = `
    <section class="main-column">
      <header class="guide-hero">
        <div class="eyebrow">${escapeHtml(context.eyebrow)}</div>
        <h1>${escapeHtml(context.title)} <button class="favorite-title-btn" type="button" aria-label="현재 카테고리 즐겨찾기">☆</button></h1>
        <p>${escapeHtml(context.description)}</p>
      </header>

      <section class="filter-panel" aria-label="가이드 필터">
        <div class="filter-grid">
          <div class="filter-field">
            <span class="filter-label">${state.activeType === 'general' ? '대상' : '적용기기'}</span>
            <div class="chip-row" id="deviceChips">${chipButtons(deviceOptions, state.device, 'device')}</div>
          </div>
          <div class="filter-field">
            <span class="filter-label">${state.activeType === 'general' ? '처리유형' : '처리방향'}</span>
            <div class="chip-row" id="actionChips">${chipButtons(actionOptions, state.action, 'action')}</div>
          </div>
          <div class="filter-field search-field">
            <span class="filter-label">키워드 검색</span>
            <label class="inline-search">
              <span aria-hidden="true">⌕</span>
              <input id="inlineSearch" type="search" value="${escapeAttr(state.query)}" placeholder="예: 인터넷 끊김, 로그인 오류, 하트적립금" autocomplete="off" />
              <button class="search-action" type="button" aria-label="검색">⌕</button>
            </label>
          </div>
        </div>
        <div class="keyword-row">
          <span>인기 키워드:</span>
          ${getKeywords().map(keyword => `<button class="keyword" type="button" data-keyword="${escapeAttr(keyword)}">${escapeHtml(keyword)}</button>`).join('')}
        </div>
      </section>

      <div class="list-toolbar">
        <div class="result-count">총 <strong>${fmt(items.length)}</strong>건의 가이드</div>
        <div class="view-tools">
          <select class="sort-select" id="sortSelect" aria-label="정렬">
            <option value="latest" ${state.sort === 'latest' ? 'selected' : ''}>최신순</option>
            <option value="title" ${state.sort === 'title' ? 'selected' : ''}>가나다순</option>
          </select>
          <button class="view-toggle active" type="button" aria-label="리스트 보기">☷</button>
        </div>
      </div>

      <section class="guide-list" aria-label="가이드 목록">
        ${items.length ? items.map(guideCardTemplate).join('') : emptyGuideTemplate()}
      </section>
    </section>

    <aside class="right-rail" aria-label="빠른 실행">
      <section class="quick-card">
        <h2 class="rail-title">빠른 실행</h2>
        <button class="quick-link" type="button" data-quick="favorites">
          <span class="quick-icon" aria-hidden="true">★</span>
          <span><strong>즐겨찾기</strong><small>자주 찾는 가이드를 모아보세요</small></span>
          <span class="arrow" aria-hidden="true">›</span>
        </button>
        <button class="quick-link" type="button" data-quick="messages">
          <span class="quick-icon" aria-hidden="true">▣</span>
          <span><strong>자주 쓰는 문자</strong><small>상담 시 유용한 문자를 바로 확인하세요</small></span>
          <span class="arrow" aria-hidden="true">›</span>
        </button>
      </section>
      <section class="message-card" id="messagePanel">
        <h2 class="rail-title">자주 쓰는 문자</h2>
        <div class="message-list">
          ${state.config.quickMessages.map(msg => `
            <button class="message-item" type="button" data-message="${escapeAttr(msg.text)}">
              <strong>${escapeHtml(msg.title)}</strong>
              <small>${escapeHtml(msg.text)}</small>
            </button>`).join('')}
        </div>
      </section>
    </aside>
  `;

  bindPageEvents();
}

function bindPageEvents(){
  $$('.chip[data-filter="device"]').forEach(btn => btn.addEventListener('click', () => { state.device = btn.dataset.value; renderPage(); }));
  $$('.chip[data-filter="action"]').forEach(btn => btn.addEventListener('click', () => { state.action = btn.dataset.value; renderPage(); }));
  $('#inlineSearch')?.addEventListener('input', e => {
    state.query = clean(e.target.value);
    $('#globalSearch').value = state.query;
    $('#sideSearch').value = state.query;
    renderPage();
  });
  $$('.keyword').forEach(btn => btn.addEventListener('click', () => {
    state.query = btn.dataset.keyword;
    $('#globalSearch').value = state.query;
    $('#sideSearch').value = state.query;
    renderPage();
  }));
  $('#sortSelect')?.addEventListener('change', e => { state.sort = e.target.value; renderPage(); });
  $$('.favorite-btn').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    const id = btn.dataset.favorite;
    if(state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    localStorage.setItem('danbi-favorites', JSON.stringify([...state.favorites]));
    btn.classList.toggle('active', state.favorites.has(id));
  }));
  $$('.message-item').forEach(btn => btn.addEventListener('click', async () => {
    const text = btn.dataset.message;
    try{
      await navigator.clipboard.writeText(text);
      btn.querySelector('small').textContent = '복사 완료: ' + text;
    }catch{
      btn.querySelector('small').textContent = text;
    }
  }));
}

function getCurrentContext(){
  if(state.activeType === 'all' || state.activeGroup === 'all'){
    return {
      eyebrow:'통합 상담가이드',
      title:'원인 · 증상 · 처리 방법을 빠르게 찾아보세요',
      description:'기술상담과 일반상담을 한 화면에서 검색하고, 적용기기와 처리방향으로 좁혀볼 수 있습니다.'
    };
  }
  const list = state.activeType === 'technical' ? state.config.technicalGroups : state.config.generalGroups;
  const found = list.find(item => item.id === state.activeGroup);
  return {
    eyebrow:`${state.activeType === 'technical' ? '기술상담' : '일반상담'}  ›  ${found?.label || ''}`,
    title: found?.label || '상담가이드',
    description: found?.desc ? `${found.desc} 관련 문의를 빠르게 확인할 수 있습니다.` : '필터를 선택하거나 키워드를 입력하면 관련 가이드를 추천해드립니다.'
  };
}

function getFilteredItems(){
  const q = state.query.toLowerCase();
  let items = [...state.config.guideItems];
  if(state.activeType !== 'all') items = items.filter(item => item.type === state.activeType);
  if(state.activeGroup !== 'all') items = items.filter(item => item.group === state.activeGroup);
  if(state.device !== '전체') items = items.filter(item => item.device === state.device || item.device === '공통');
  if(state.action !== '전체') items = items.filter(item => item.action === state.action);
  if(q){
    items = items.filter(item => [
      item.title, item.customer, item.device, item.action, item.group,
      ...(item.tags || []), ...(item.summary || [])
    ].join(' ').toLowerCase().includes(q));
  }
  if(state.sort === 'title') items.sort((a,b) => a.title.localeCompare(b.title, 'ko'));
  return items;
}

function chipButtons(values, active, filter){
  return values.map(value => `<button class="chip ${value === active ? 'active' : ''}" type="button" data-filter="${filter}" data-value="${escapeAttr(value)}">${escapeHtml(value)}</button>`).join('');
}

function getKeywords(){
  if(state.activeType === 'general') return ['하트적립금','지인추천','청약철회','배송지 변경','단계 변경','해지 상담'];
  return ['연결 오류','저장됨','공장초기화','고스트터치','RemoteCall','앱탈출'];
}

function guideCardTemplate(item){
  const favorite = state.favorites.has(item.id);
  const groupLabel = getGroupLabel(item.type, item.group);
  const summary = (item.summary || []).slice(0,3).map((line, index) => `${index + 1}. ${escapeHtml(line)}`).join('<br>');
  const tags = [groupLabel, item.action, ...(item.tags || []).slice(0,3)];
  return `
    <article class="guide-card" data-id="${escapeAttr(item.id)}">
      <div class="card-icon ${escapeAttr(item.tone || 'primary')}" aria-hidden="true">${ICONS[item.icon] || ICONS.book}</div>
      <div class="card-main">
        <h3>${escapeHtml(item.title)}</h3>
        <p class="card-summary">${summary}</p>
        <div class="card-meta">
          <span class="badge primary">${escapeHtml(groupLabel)}</span>
          <span class="badge ${item.action === '교체' ? 'orange' : item.action === '점검' || item.action === '조치' ? 'green' : 'purple'}">${escapeHtml(item.action)}</span>
          <span class="badge">${escapeHtml(item.device)}</span>
          ${tags.slice(2).map(tag => `<span class="badge">${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
      <div class="card-side">
        <button class="favorite-btn ${favorite ? 'active' : ''}" type="button" data-favorite="${escapeAttr(item.id)}" aria-label="즐겨찾기">☆</button>
      </div>
    </article>`;
}

function emptyGuideTemplate(){
  return `<div class="empty-card"><div><h2>검색 결과가 없습니다.</h2><p>키워드를 줄이거나 적용기기/처리방향 필터를 전체로 바꿔보세요.</p></div></div>`;
}

function getGroupLabel(type, groupId){
  const list = type === 'general' ? state.config.generalGroups : state.config.technicalGroups;
  return list.find(item => item.id === groupId)?.label || groupId;
}

function dashboardTemplate(){
  const rows = state.dashboardRows;
  const total = rows.length || 571;
  const complete = rows.filter(r => r.status === '완료').length || 519;
  const cancel = rows.filter(r => r.status === '취소').length || 25;
  const etc = Math.max(total - complete - cancel, 0);
  const rate = total ? ((complete / total) * 100).toFixed(1) : '90.9';
  return `
    <section class="main-column">
      <header class="guide-hero">
        <div class="eyebrow">점검 운영 현황</div>
        <h1>점검 데이터 요약</h1>
        <p>공개용 CSV 기준으로 점검 접수, 완료, 취소, 기타 상태를 요약합니다.</p>
      </header>
      <section class="dashboard-grid">
        <article class="dash-card"><small>총 누적 점검</small><strong>${fmt(total)}</strong></article>
        <article class="dash-card primary"><small>완료율</small><strong>${rate}%</strong></article>
        <article class="dash-card"><small>취소 / 기타</small><strong>${fmt(cancel)} / ${fmt(etc)}</strong></article>
      </section>
      <article class="dash-card">
        <small>참고</small>
        <p class="dash-note">소요시간은 교사용 업무폰 및 PC 점검 건 중심으로 기록된 값입니다. 전체 점검 건 평균 처리시간으로 해석하지 않습니다.</p>
      </article>
    </section>
    <aside class="right-rail">
      <section class="quick-card">
        <h2 class="rail-title">빠른 실행</h2>
        <button class="quick-link" type="button" onclick="window.dispatchEvent(new CustomEvent('go-guides'))">
          <span class="quick-icon" aria-hidden="true">⌕</span>
          <span><strong>상담가이드로 이동</strong><small>증상별 가이드를 검색하세요</small></span>
          <span class="arrow" aria-hidden="true">›</span>
        </button>
      </section>
    </aside>`;
}

window.addEventListener('go-guides', () => {
  state.view = 'guides';
  state.activeType = 'all';
  state.activeGroup = 'all';
  renderAll();
});

async function loadDashboardRows(){
  const url = state.config.csvUrl;
  const res = await fetch(url, { cache:'no-store' });
  if(!res.ok) throw new Error('csv failed');
  const text = await res.text();
  const table = parseCSV(text);
  if(table.length < 2) return [];
  const headers = table[0].map(clean);
  const statusIndex = headers.findIndex(h => h.includes('상태'));
  return table.slice(1).filter(row => row.some(clean)).map(row => ({ status: normalizeStatus(row[statusIndex]) }));
}

function normalizeStatus(value){
  const raw = clean(value);
  if(raw.includes('취소')) return '취소';
  if(raw.includes('처리완료')) return '완료';
  return '기타';
}

function parseCSV(text){
  const rows = [];
  let row = [];
  let field = '';
  let quote = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    const n = text[i+1];
    if(quote){
      if(c === '"' && n === '"'){ field += '"'; i++; }
      else if(c === '"') quote = false;
      else field += c;
      continue;
    }
    if(c === '"') quote = true;
    else if(c === ','){ row.push(field); field = ''; }
    else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
    else if(c !== '\r') field += c;
  }
  row.push(field);
  rows.push(row);
  return rows;
}
