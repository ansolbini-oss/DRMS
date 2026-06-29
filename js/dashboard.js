/* ════════════════════════════════════════════════════════════
   DASHBOARD — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

function dashRenderMonitoringStatusCards(){
  const box = $('dashEventStatusGrid');
  if(!box) return;
  const cards = [
    {key:'reduction', label:'감축', head:'감축 이벤트', cls:'status-live'},
    {key:'increase', label:'증대', head:'증대 이벤트', cls:'status-scheduled'},
    {key:'test', label:'시험', head:'등록시험', cls:'status-completed'}
  ];
  box.innerHTML = cards.map(card=>{
    const matched = dashMonitoringEventsByType(card.key);
    const scheduledCount = matched.filter(ev=>monEventStatusKey(ev)==='scheduled').length;
    const liveCount = matched.filter(ev=>monEventStatusKey(ev)==='live').length;
    const hasIssue = matched.some(ev=>monEventHealth(ev).tone==='bad' && monEventStatusKey(ev)!=='completed');
    return `<div class="dash-status-card ${card.cls}${hasIssue?' is-alert':''}" onclick="dashGoToMonitoringType('${card.key}')">
      <div class="dash-status-head">
        <span class="dash-status-label">${card.head}</span>
        <span class="dash-status-dot"></span>
      </div>
      <div class="dash-status-value">${card.label}</div>
      <div class="dash-status-counts">
        <button class="dash-status-count-btn" onclick="event.stopPropagation();dashGoToMonitoringTypeStatus('${card.key}','scheduled')">
          <span>대기</span>
          <span class="count">${scheduledCount}건</span>
        </button>
        <button class="dash-status-count-btn" onclick="event.stopPropagation();dashGoToMonitoringTypeStatus('${card.key}','live')">
          <span>진행</span>
          <span class="count">${liveCount}건</span>
        </button>
      </div>
    </div>`;
  }).join('');
}

function dashMonitoringEventsByType(typeKey){
  if(typeKey==='reduction'){
    return (store.events.reduction || []).filter(ev=>monEventTypeKey(ev)==='reduction');
  }
  if(typeKey==='increase'){
    return store.events.plus || [];
  }
  if(typeKey==='test'){
    return (store.events.reduction || []).filter(ev=>monEventTypeKey(ev)==='test');
  }
  return [];
}

function dashMonitoringRouteState(typeKey, statusKey){
  if(typeKey==='increase'){
    return {eventType:'plus', category:'all', status:statusKey || 'all'};
  }
  if(typeKey==='test'){
    return {eventType:'reduction', category:'test', status:statusKey || 'all'};
  }
  return {eventType:'reduction', category:'reduction', status:statusKey || 'all'};
}

function dashGoToMonitoringType(typeKey){
  const next = dashMonitoringRouteState(typeKey, 'all');
  navigate('monitoring');
  setTimeout(()=>{
    monState.eventType = next.eventType;
    monState.status = next.status;
    monState.category = next.category;
    monState.currentEventId = null;
    monState.selectedGroupId = null;
    monRender();
  }, 120);
}

function dashGoToMonitoringTypeStatus(typeKey, statusKey){
  const next = dashMonitoringRouteState(typeKey, statusKey);
  navigate('monitoring');
  setTimeout(()=>{
    monState.eventType = next.eventType;
    monState.status = next.status;
    monState.category = next.category;
    monState.currentEventId = null;
    monState.selectedGroupId = null;
    monRender();
  }, 120);
}

function dashRenderEventList(){
  const list = $('dashEvList');
  const all = [];
  // 감축 계열 이벤트 → 'reduction' 탭으로 라우팅
  (store.events.reduction||[]).forEach(e=>all.push({...e, _monTab:'reduction'}));
  // 플러스DR 계열 → 'plus' 탭으로 라우팅
  (store.events.plus||[]).forEach(e=>all.push({...e, _monTab:'plus'}));
  // 최신순 정렬 (live 우선)
  all.sort((a,b)=>{
    if(a.live && !b.live) return -1;
    if(!a.live && b.live) return 1;
    return (b.date||'').localeCompare(a.date||'');
  });
  const show = all.slice(0, 4);
  if(!show.length){ list.innerHTML = '<div class="empty" style="padding:30px 20px;">최근 이벤트가 없습니다.</div>'; return; }
  list.innerHTML = show.map(e=>{
    const totalOrd = e.resources.reduce((s,r)=>s+r.ordered, 0);
    const totalAct = e.resources.reduce((s,r)=>s+(r.actual||0), 0);
    const rate = totalOrd>0 ? totalAct/totalOrd : 0;
    const cls = e.live?'live':e.scheduled?'scheduled':'done';
    const tagHtml = e.live ? '<span class="badge badge-progress" style="font-size:10px;">진행중</span>' :
                    e.scheduled ? '<span class="badge badge-pending" style="font-size:10px;">예정</span>' :
                    '<span class="badge badge-done" style="font-size:10px;">완료</span>';
    const rateHtml = e.scheduled ? '-' : `<span style="color:${monRateColor(rate)};font-weight:700;">${Math.round(rate*100)}%</span>`;
    // dispatch_type 기반 라벨 (단일 원천)
    const dm = dispatchTypeMeta(e.dispatch_type);
    return `<div class="ev-row ${cls}" onclick="navigate('monitoring');setTimeout(()=>{monState.eventType='${e._monTab}';monState.currentEventId='${e.id}';monState.selectedGroupId=null;monRender();},100);">
      <div class="ev-cell" style="width:100px;"><div class="ev-label">상태</div>${tagHtml}</div>
      <div class="ev-cell grow">
        <div class="ev-label">이벤트</div>
        <div class="ev-val">${eventDisplayName(e)}<span class="badge badge-gray" style="font-size:9px;margin-left:6px;">${e.source||'KPX'}</span></div>
        <div class="ev-sub">${eventDisplaySub(e)} · <span class="badge ${dm.badge}" style="font-size:9px;padding:1px 6px;">${dm.label}</span></div>
      </div>
      <div class="ev-cell" style="width:110px;">
        <div class="ev-label">지시용량</div>
        <div class="ev-val">${totalOrd.toLocaleString()} kW</div>
      </div>
      <div class="ev-cell" style="width:90px;">
        <div class="ev-label">이행률</div>
        <div class="ev-val">${rateHtml}</div>
      </div>
      <div class="ev-cell" style="width:70px;">
        <div class="ev-label">대상</div>
        <div class="ev-val">${e.resources.length}개</div>
      </div>
    </div>`;
  }).join('');
}

/* 운영이상 자원그룹 위젯 렌더링 */
function dashRenderRiskList(){
  const listBox = $('dashRiskList');
  const linkBox = $('dashRiskLink');
  const problems = getProblematicGroups();

  // 본문: 운영이상이 없을 때는 빈 상태 (시험 필요는 별도 섹션)
  if(problems.length === 0){
    listBox.innerHTML = `<div class="risk-list-empty">
      <b>모든 자원그룹이 정상 가동 중입니다.</b>
      <div style="margin-top:4px;font-size:11px;color:var(--text-sub);">데이터 수집 상태와 이행 성과가 모두 기준 이내입니다.</div>
    </div>`;
    linkBox.style.display = 'none';
    return;
  }
  linkBox.style.display = '';
  const MAX = 5;
  const shown = problems.slice(0, MAX);
  const remaining = problems.length - shown.length;
  listBox.innerHTML = shown.map(p=>{
    const g = p.group;
    return `<div class="dash-risk-item level-${p.level}" onclick="dashGoToRiskGroup(${g.id})">
      <div class="dash-risk-dot ${p.level}"></div>
      <div>
        <div class="dash-risk-name">${g.name}</div>
        <div class="dash-risk-meta">${g.type}</div>
      </div>
      <span class="dash-risk-reason ${p.level}">${p.reason}</span>
      <span class="dash-risk-arrow">›</span>
    </div>`;
  }).join('') + (remaining>0
    ? `<div style="padding:8px 14px;font-size:11px;color:var(--text-hint);text-align:center;">
         외 ${remaining}건 더 있음 — 자원관리에서 전체 확인
       </div>`
    : '');
}

/* 등록시험 현황 위젯 — 시험 대상 자원 중 합격 전인 자원 목록 */
function dashRenderTrialList(){
  const listBox = $('dashTrialList');
  const countBox = $('dashTrialCount');
  const linkBox = $('dashTrialLink');
  const pending = trialPendingGroups();
  const waiting = pending.filter(g=>g.trial.status==='WAITING').length;
  const failed  = pending.filter(g=>g.trial.status==='FAILED').length;

  // 헤더 카운트
  if(pending.length === 0){
    countBox.innerHTML = `<span class="badge badge-done" style="font-size:10px;">전체 합격·면제</span>`;
    linkBox.style.display = 'none';
  } else {
    const parts = [];
    if(waiting>0) parts.push(`<span style="color:var(--text-sub);">대기 ${waiting}</span>`);
    if(failed>0)  parts.push(`<span style="color:var(--red);">불합격 ${failed}</span>`);
    countBox.innerHTML = `<span class="dash-risk-count-badge">${parts.join(' · ')}</span>`;
    linkBox.style.display = '';
  }

  // 빈 상태
  if(pending.length === 0){
    listBox.innerHTML = `<div class="risk-list-empty">
      <b>등록시험이 필요한 자원이 없습니다.</b>
      <div style="margin-top:4px;font-size:11px;color:var(--text-sub);">모든 시험 대상 자원이 합격했거나 면제 대상입니다.</div>
    </div>`;
    return;
  }

  // 정렬: 불합격(판단 필요) > 대기 (긴급도 순)
  const priority = {FAILED:0, WAITING:1};
  const sorted = [...pending].sort((a,b)=>(priority[a.trial.status] ?? 9) - (priority[b.trial.status] ?? 9));
  const MAX = 5;
  const shown = sorted.slice(0, MAX);
  const remaining = sorted.length - shown.length;

  listBox.innerHTML = shown.map(g=>{
    const tm = trialStatusMeta(g.trial);
    const lastAttempt = g.trial.history?.length ? g.trial.history[g.trial.history.length-1] : null;
    const attemptTxt = g.trial.history?.length
      ? `${g.trial.history.length}차${lastAttempt?.result==='FAIL' ? ' 불합격' : ''}`
      : '최초 시험';
    // 직전 이행률 — 3구간 색상 (97%↑ 정상 / 80~97% 조정 / 80%↓ 참여 제한)
    const rateTxt = lastAttempt
      ? (()=>{
          const r = lastAttempt.performanceRate;
          const color = r>=0.97 ? 'var(--green)' : r>=0.80 ? 'var(--amber)' : 'var(--red)';
          return `<span style="color:${color};font-weight:700;">${Math.round(r*100)}%</span>`;
        })()
      : `<span style="color:var(--text-hint);">—</span>`;
    // 상태별 시각적 톤: 불합격만 빨강, 그 외는 중립
    const borderColor = g.trial.status==='FAILED' ? 'var(--red-border)' : 'var(--border)';
    return `<div class="dash-trial-item" style="border-left:3px solid ${borderColor};" onclick="dashGoToTrialGroup(${g.id})">
      <div>
        <div class="dash-risk-name">${g.name}</div>
        <div class="dash-risk-meta">${g.type} · ${attemptTxt}</div>
      </div>
      <span><span class="badge ${tm.badge}" style="font-size:10px;">${tm.dashboardLabel}</span></span>
      <span style="text-align:right;font-size:11px;">
        <div style="color:var(--text-hint);font-size:10px;">직전 이행률</div>
        <div>${rateTxt}</div>
      </span>
      <span class="dash-risk-arrow">›</span>
    </div>`;
  }).join('') + (remaining>0
    ? `<div style="padding:8px 14px;font-size:11px;color:var(--text-hint);text-align:center;">
         외 ${remaining}건 더 있음 — 자원관리에서 전체 확인
       </div>`
    : '');
}

/* 운영이상 항목 클릭 → 자원관리 페이지로 이동 + 운영이상 카드 필터 + 상세 패널 자동 오픈.
   Phase 17-B에서 rmRefreshSummary null reference 버그 fix 후, rmApplyFilter가 throw 없이
   정상 완료되므로 rmOpenDetail이 정상 호출됨. navigate의 closeTransientUi와의 transition
   충돌 회피를 위해 setTimeout(0)으로 한 tick만 미룬다. */
function dashGoToRiskGroup(gid){
  // [Phase 17-BY] 운영이상 자원그룹 → 전력데이터 수집현황 상세로 점프
  // (이전: 자원관리 가동상태 탭이었으나, 이상 원인 확인 흐름상 데이터 수집현황이 더 자연스러움)
  navigate('datacollect');
  setTimeout(()=>{
    if(typeof dcOpenDetail === 'function') dcOpenDetail(gid);
  }, 0);
}

/* 시험 필요 자원 배너 클릭 → 자원관리 '시험 대기' 필터로 이동 */
function dashGoToTrialPending(){
  navigate('resource');
  if(typeof rmFilterByCard === 'function') rmFilterByCard('trial');
}

/* 대시보드 시험 아이템 클릭 → 자원관리로 이동 + 시험 대기 필터.
   상세 패널 자동 오픈은 환경별 race condition 가능 → 운영자가 리스트에서 행을 한 번 더 클릭한다. */
function dashGoToTrialGroup(gid){
  navigate('resource');
  if(typeof rmFilterByCard === 'function') rmFilterByCard('trial');
  if(typeof rmOpenDetail === 'function')   rmOpenDetail(gid, 'trial');
}

function dashRenderBars(){
  // DR 유형별 활성 자원그룹의 가동상태 기반 데이터 수집률 계산
  const typeKeys = [
    {k:'standard', label:'표준·중소형DR'},
    {k:'national', label:'국민DR'},
    {k:'jeju',     label:'제주DR'},
    {k:'freq',     label:'주파수DR'},
    {k:'plus',     label:'플러스DR'},
  ];
  const box = $('dashBars');
  if(!box) return;
  box.innerHTML = typeKeys.map(t=>{
    const groupsOfType = store.groups.filter(g=>g.typeKey===t.k && g.status==='active' && g.operational);
    if(!groupsOfType.length){
      return `<div class="bar-group">
        <div class="bar-row">
          <span class="bar-label">${t.label}</span>
          <div class="bar-track"></div>
          <span class="bar-pct" style="color:var(--text-hint);">—</span>
        </div>
      </div>`;
    }
    // 간단 계산: NORMAL은 98~100%, DELAYED는 85~92%, FAILED는 60~75%
    const rateFor = g=>{
      const s = g.operational.dataCollection.status;
      if(s==='NORMAL') return 0.97 + (g.id%4)*0.01;
      if(s==='DELAYED') return 0.85 + (g.id%5)*0.01;
      if(s==='PARTIAL') return 0.88 + (g.id%3)*0.01;
      if(s==='FAILED') return 0.60 + (g.id%6)*0.02;
      return 0.95;
    };
    const avg = groupsOfType.reduce((s,g)=>s+rateFor(g), 0) / groupsOfType.length;
    const pct = Math.round(avg*100);
    const color = pct>=95?'var(--green)':pct>=90?'var(--blue)':pct>=80?'var(--amber)':'var(--red)';
    const colorText = pct>=95?'var(--green)':pct>=90?'var(--blue)':pct>=80?'var(--amber)':'var(--red)';
    // 누락 자원 개수와 리스크
    const failedCustomers = groupsOfType.reduce((s,g)=>s + (g.operational.dataCollection.failedCustomers||0), 0);
    const missingKw = failedCustomers * 30; // 간단 추정
    const risk = Math.round(missingKw * 3000 / 10000); // 만원 단위
    const riskRow = (pct<95 && failedCustomers>0)
      ? `<div class="risk-row">
          <span class="risk-chip">누락 자원 ${failedCustomers}건 · 영향 ≈ ${missingKw} kW</span>
          <span class="risk-chip err">정산 리스크 ≈ ₩${risk.toLocaleString()}만</span>
        </div>`
      : '';
    return `<div class="bar-group" style="cursor:pointer;" onclick="event.stopPropagation();dcRouteFromDashboard('${t.k}')" title="${t.label} 수집 상세 보기">
      <div class="bar-row">
        <span class="bar-label">${t.label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color};"></div></div>
        <span class="bar-pct" style="color:${colorText};">${pct}%</span>
      </div>
      ${riskRow}
    </div>`;
  }).join('');
}

/* 대시보드 → 수집현황 페이지 라우팅 (DR 유형 기반 첫 그룹 선택) */
