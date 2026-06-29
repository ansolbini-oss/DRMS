/* ════════════════════════════════════════════════════════════
   MONITORING — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

const monState = { eventType:'reduction', category:'all', status:'all', currentEventId:null, selectedGroupId:null, viewMode:'5min', sort:'rate-asc' };
var monDmState = { groupId:null, eventId:null, customerId:null, queryDate:null, view:'summary' };

function monAllowedCategories(type){
  // FIX-02: 의무감축·자발적 별도 표시 정책
  return type==='plus'
    ? ['all']
    : ['all','mandatory','voluntary','test'];
}
function monEventStatusKey(ev){
  if(ev?.live) return 'live';
  if(ev?.scheduled) return 'scheduled';
  return 'completed';
}
function monEventStatusLabel(key){
  return {all:'전체', scheduled:'대기', live:'진행', completed:'완료'}[key] || '전체';
}
function monEventTypeKey(ev){
  if(!ev) return 'all';
  // FIX-02: 의무감축(mandatory) / 자발적(voluntary) 분리
  if(ev.dispatch_type==='MANDATORY_REDUCTION') return 'mandatory';
  if(ev.dispatch_type==='VOLUNTARY_REDUCTION') return 'voluntary';
  if(ev.dispatch_type==='REGISTRATION_TEST') return 'test';
  if(ev.dispatch_type==='VOLUNTARY_INCREASE' || ev.dispatch_type==='REALTIME_INCREASE_REQUEST') return 'increase';
  return 'all';
}
function monFilteredEvents(){
  const evs = store.events[monState.eventType] || [];
  const statusRank = {live:0, scheduled:1, completed:2};
  return evs.filter(ev=>{
    const statusOk = monState.status==='all' || monEventStatusKey(ev)===monState.status;
    const typeOk = monState.category==='all' || monEventTypeKey(ev)===monState.category;
    return statusOk && typeOk;
  }).sort((a,b)=>{
    const sa = statusRank[monEventStatusKey(a)] ?? 9;
    const sb = statusRank[monEventStatusKey(b)] ?? 9;
    if(sa!==sb) return sa-sb;
    const da = `${b.date||''} ${b.timeRange||''}`.localeCompare(`${a.date||''} ${a.timeRange||''}`);
    return da;
  });
}
function monSyncFilterButtons(){
  $$('#page-monitoring .event-tab').forEach((el,i)=>{
    el.classList.toggle('active', (i===0 && monState.eventType==='reduction') || (i===1 && monState.eventType==='plus'));
  });
  $$('#page-monitoring .mon-filter-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.status === monState.status);
  });
  const reductionBox = $('mon-type-filter-reduction');
  const plusBox = $('mon-type-filter-plus');
  if(reductionBox) reductionBox.style.display = monState.eventType==='reduction' ? 'inline-flex' : 'none';
  if(plusBox) plusBox.style.display = 'none';
  $$('#page-monitoring .mon-category-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.category === monState.category);
  });
}
function monEnsureCurrentSelection(){
  const evs = monFilteredEvents();
  if(evs.length){
    if(!monState.currentEventId || !evs.find(e=>e.id===monState.currentEventId)){
      monState.currentEventId = evs[0].id;
    }
  } else {
    monState.currentEventId = null;
    monState.selectedGroupId = null;
    return null;
  }
  const ev = evs.find(e=>e.id===monState.currentEventId) || evs[0];
  const validGroup = ev.resources.find(r=>r.groupId===monState.selectedGroupId);
  if(!validGroup){
    monState.selectedGroupId = ev.resources[0]?.groupId || null;
  }
  return ev;
}
function monInit(){
  if(!monAllowedCategories(monState.eventType).includes(monState.category)){
    monState.category = 'all';
  }
  monEnsureCurrentSelection();
  monRender();
}
function monSwitchEventType(type){
  monState.eventType = type;
  if(!monAllowedCategories(type).includes(monState.category)){
    monState.category = 'all';
  }
  monState.currentEventId = null;
  monState.selectedGroupId = null;
  monRender();
}
function monSwitchStatus(status){
  monState.status = status;
  monState.currentEventId = null;
  monState.selectedGroupId = null;
  monRender();
}
function monSwitchCategory(cat){
  monState.category = cat;
  monState.currentEventId = null;
  monState.selectedGroupId = null;
  monRender();
}
function monSelectEvent(id, focusDetail){
  monState.currentEventId = id;
  monState.selectedGroupId = null;
  monRender();
  if(focusDetail){
    setTimeout(()=>{
      const box = $('mon-kpi-bar');
      if(box && box.scrollIntoView) box.scrollIntoView({behavior:'smooth', block:'start'});
    }, 60);
  }
}
function monCurrentEvent(){
  const evs = monFilteredEvents();
  return evs.find(e=>e.id===monState.currentEventId) || evs[0] || null;
}
function monOpenEvent(eventType, eventId, groupId){
  navigate('monitoring');
  setTimeout(()=>{
    monState.eventType = eventType || 'reduction';
    monState.status = 'all';
    monState.category = 'all';
    monState.currentEventId = eventId || null;
    monState.selectedGroupId = groupId || null;
    monRender();
  }, 120);
}
function monOpenDetailModal(eventId){
  if(eventId){
    monState.currentEventId = eventId;
    monState.selectedGroupId = null;
  }
  monRender();
  openModal('monDetailModal');
}

/* dispatch_type → 사용자 표시 라벨 + 뱃지 클래스 (설계서 §5 + 등록시험 확장) */
// FIX-04: 이행률 색상 3단계 — ≥90% 파랑(good) / 70~90% 주황(warn) / <70% 빨강(bad)
function monRateCls(r){
  if(r==null) return '';
  if(r>=0.9) return 'good';
  if(r>=0.7) return 'warn';
  return 'bad';
}
function monRateColor(r){
  if(r==null) return 'var(--text-hint)';
  if(r>=0.9) return 'var(--blue)';
  if(r>=0.7) return '#f59e0b';   // 주황 (Tailwind amber-500 톤)
  return 'var(--red)';
}
function monDotCls(s){
  if(s==='FAILED' || s==='DELAYED') return 'dot-red';
  return 'dot-green';
}
function monTypeClass(t){
  const m = {
    '표준DR':'badge-purple','H-표준DR':'badge-purple','중소형DR':'badge-purple','H-중소형DR':'badge-purple','중소형DR(EV)':'badge-purple','H-중소형DR(EV)':'badge-purple',
    '국민DR':'badge-progress',
    '제주DR':'badge-done','H-제주DR':'badge-done','제주DR(EV)':'badge-done','H-제주DR(EV)':'badge-done',
    '주파수DR':'badge-pending','플러스DR':'badge-gray',
  };
  return m[t] || 'badge-gray';
}

function monEventSummary(ev){
  const totalOrd = ev.resources.reduce((sum, r)=>sum + (r.ordered || 0), 0);
  const hasActual = ev.resources.some(r=>r.actual!=null);
  const totalAct = hasActual ? ev.resources.reduce((sum, r)=>sum + (r.actual || 0), 0) : null;
  const rate = (!ev.scheduled && hasActual && totalOrd>0) ? totalAct / totalOrd : null;
  return {totalOrd, totalAct, rate, targetCount:ev.resources.length};
}
// FIX-06: 4단계 상태값 — 대기(neutral) / 정상(good ≥90%) / 주의(warn 70~90%) / 이상(bad <70%)
function monEventHealth(ev){
  if(ev.scheduled){
    return {tone:'neutral', label:'대기', abnormalCount:0, warnCount:0};
  }
  let abnormalCount = 0;   // <70% 또는 데이터 불량
  let warnCount = 0;       // 70~90%
  ev.resources.forEach(r=>{
    const rate = (r.actual!=null && r.ordered>0) ? (r.actual / r.ordered) : 1;
    const dataBad = r.status==='FAILED' || r.status==='DELAYED';
    if(dataBad || rate < 0.7) abnormalCount += 1;
    else if(rate < 0.9) warnCount += 1;
  });
  const summary = monEventSummary(ev);
  const sumRate = summary.rate;
  // 이벤트 종합 판정: 이상 자원 존재 또는 종합 이행률 70% 미만 → 이상
  if(abnormalCount>0 || (sumRate!=null && sumRate < 0.7)){
    return {tone:'bad', label:`이상 ${Math.max(abnormalCount, 1)}개`, abnormalCount:Math.max(abnormalCount, 1), warnCount};
  }
  // 주의: 70~90% 자원 존재 또는 종합 이행률 70~90%
  if(warnCount>0 || (sumRate!=null && sumRate < 0.9)){
    return {tone:'warn', label:`주의 ${Math.max(warnCount, 1)}개`, abnormalCount:0, warnCount:Math.max(warnCount, 1)};
  }
  return {tone:'good', label:'정상', abnormalCount:0, warnCount:0};
}
function monStatusPillHtml(statusKey){
  return `<span class="mon-status-pill ${statusKey}">${monEventStatusLabel(statusKey)}</span>`;
}
function monHealthBadgeHtml(health){
  return `<span class="mon-health-badge ${health.tone}">${health.label}</span>`;
}
function monRenderEventTable(evs){
  const body = $('mon-event-table-body');
  if(!body) return;
  if(!evs.length){
    body.innerHTML = `<div class="mon-table-empty">조건에 맞는 이벤트가 없습니다.</div>`;
    return;
  }
  body.innerHTML = evs.map(ev=>{
    const statusKey = monEventStatusKey(ev);
    const typeMeta = dispatchTypeMeta(ev.dispatch_type);
    const summary = monEventSummary(ev);
    const health = monEventHealth(ev);
    const rateText = summary.rate!=null
      ? `<span style="color:${monRateColor(summary.rate)};font-weight:700;">${Math.round(summary.rate*100)}%</span>`
      : `<span style="color:var(--text-hint);">—</span>`;
    const activeCls = monState.currentEventId===ev.id ? ' active' : '';
    // [Phase 17-BQ] 빨간 점 → 삼각형 ⚠ 아이콘 (계약관리 패턴 일관)
    const abnormalIcon = health.tone === 'bad'
      ? `<span title="이상 ${health.abnormalCount}건 — 상세에서 확인" style="display:inline-flex;color:var(--red);font-size:14px;line-height:1;margin-right:6px;vertical-align:-1px;flex-shrink:0;">⚠</span>`
      : '';
    return `<div class="mon-table-row${activeCls}" onclick="monSelectEvent('${ev.id}')">
      <span>${monStatusPillHtml(statusKey)}</span>
      <span>
        <div class="mon-table-event-name">${abnormalIcon}${eventDisplayName(ev)}</div>
        <div class="mon-table-event-sub">${ev.id}</div>
      </span>
      <span style="color:var(--text-sub);font-variant-numeric:tabular-nums;">${ev.date}<br>${ev.timeRange}</span>
      <span><span class="badge ${typeMeta.badge}" style="font-size:10px;">${typeMeta.label}</span></span>
      <span style="text-align:right;font-weight:600;">${summary.targetCount}개</span>
      <span style="text-align:right;font-weight:600;">${summary.totalOrd.toLocaleString()} kW</span>
      <span style="text-align:center;">${rateText}</span>
      <span style="text-align:center;"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();monOpenDetailModal('${ev.id}')">상세</button></span>
    </div>`;
  }).join('');
}

function monRender(){
  const evs = monFilteredEvents();
  const ev = monEnsureCurrentSelection();
  monSyncFilterButtons();
  if(evs.length){
    $('mon-event-select').innerHTML = evs.map(e=>{
      const dm = dispatchTypeMeta(e.dispatch_type);
      return `<option value="${e.id}">[${dm.short}] ${eventDisplayName(e)}</option>`;
    }).join('');
    $('mon-event-select').disabled = false;
  } else {
    $('mon-event-select').innerHTML = `<option value="">해당 조건의 이벤트가 없습니다</option>`;
    $('mon-event-select').disabled = true;
  }
  if(ev) $('mon-event-select').value = ev.id;
  monRenderEventTable(evs);
  if($('mon-detail-title')){
    $('mon-detail-title').textContent = ev ? `${eventDisplayName(ev)} 상세` : '이벤트 상세';
  }
  if($('mon-detail-sub')){
    $('mon-detail-sub').innerHTML = ev
      ? `${dispatchTypeMeta(ev.dispatch_type).label} · ${ev.id} · ${ev.date} ${ev.timeRange}`
      : '선택한 이벤트의 자원별 현황과 참여고객 상세를 확인합니다.';
  }
  // LIVE 배지
  $('mon-live-badge').style.display = ev && ev.live ? 'inline-flex':'none';

  // [Phase 17-BL] 등록시험 이벤트 배너 제거 — 운영자는 학습된 정보라 노출 불필요
  const testBanner = $('mon-test-banner');
  if(testBanner){
    testBanner.style.display = 'none';
    testBanner.innerHTML = '';
  }
  // 이벤트 메타 — dispatch_type 라벨 + 병행 이벤트 안내
  if(ev){
    const dm = dispatchTypeMeta(ev.dispatch_type);
    let metaHtml = `<span class="badge ${dm.badge}" style="font-size:10px;margin-right:6px;">${dm.label}</span><span style="font-weight:700;">${eventDisplayName(ev)}</span><span style="font-family:monospace;color:var(--text-hint);margin-left:6px;">${ev.id}</span>`;
    // 등록시험 이벤트인 경우 대상 자원그룹/차수 안내 추가
    if(ev.category==='test' && ev.trialTargetGroupId){
      const tg = groupById(ev.trialTargetGroupId);
      if(tg) metaHtml += ` <span style="margin-left:8px;font-size:11px;color:var(--amber);font-weight:600;">· ${tg.name} ${ev.trialAttemptNo||1}차 시험</span>`;
    }
    // 병행 이벤트 안내 (설계서 §8.1)
    if(ev.parallelWith){
      const pe = evs.find(e=>e.id===ev.parallelWith) || (store.events?.reduction||[]).find(e=>e.id===ev.parallelWith) || (store.events?.plus||[]).find(e=>e.id===ev.parallelWith);
      metaHtml += ` <span style="margin-left:8px;font-size:11px;color:var(--text-hint);">· 병행: ${pe?eventDisplayName(pe):ev.parallelWith}</span>`;
    }
    // 역방향 참조: 이 이벤트를 parallelWith로 지정한 다른 이벤트
    const counterpart = evs.find(e=>e.parallelWith===ev.id);
    if(counterpart){
      metaHtml += ` <span style="margin-left:8px;font-size:11px;color:var(--text-hint);">· 병행: ${eventDisplayName(counterpart)}</span>`;
    }
    // 완료된 운영 이벤트 → 운영 리포트 진입점 (시니어 기획 판단: 감축 종료 후 바로 정산 업무로 이어지는 동선)
    if(!ev.live && !ev.scheduled && ev.category==='operation' && ev.settlement){
      const stlMap = {pending:'정산요청 대기', requested:'정산요청 완료', received:'수금 완료'};
      metaHtml += ` <button class="link" style="margin-left:10px;" onclick="navigate('report');setTimeout(()=>rpOpenEvent('${ev.id}'),150);">이행검증 (${stlMap[ev.settlement.status]||'-'}) →</button>`;
    }
    $('mon-event-meta').innerHTML = metaHtml;
  } else {
    $('mon-event-meta').textContent = '-';
  }
  // KPI
  monRenderKPI(ev);
  // 상세 모달 좌우 영역
  monRenderRightPane(ev);
  monSyncGroupSelector(ev);
}

function monRenderKPI(ev){
  const bar = $('mon-kpi-bar');
  if(!ev){ bar.innerHTML = '<div class="empty" style="grid-column:1/-1;">이벤트가 없습니다.</div>'; return; }
  const summary = monEventSummary(ev);
  const health = monEventHealth(ev);
  const rateColor = summary.rate!=null ? monRateColor(summary.rate) : 'var(--text-sub)';
  // FIX-06: 이상(bad) / 주의(warn) / 정상(good) 케이스 분기 표시
  const abnormalText = health.tone==='bad' ? `${health.abnormalCount}개 자원`
                     : health.tone==='warn' ? `${health.warnCount}개 자원`
                     : '없음';
  if(ev.scheduled){
    bar.innerHTML = `
      <div class="kpi-card accent"><div class="kpi-label">대상 자원</div><div class="kpi-value blue">${summary.targetCount}개</div><div class="kpi-sub">감축 지시 대상</div></div>
      <div class="kpi-card"><div class="kpi-label">예정 지시용량</div><div class="kpi-value">${summary.totalOrd.toLocaleString()}<span style="font-size:12px;color:var(--text-hint);font-weight:500;"> kW</span></div></div>
      <div class="kpi-card"><div class="kpi-label">이벤트 일시</div><div class="kpi-value" style="font-size:14px;">${ev.date}</div><div class="kpi-sub">${ev.timeRange}</div></div>
      <div class="kpi-card"><div class="kpi-label">이벤트 유형</div><div class="kpi-value" style="font-size:14px;">${dispatchTypeMeta(ev.dispatch_type).label}</div><div class="kpi-sub">${ev.category==='test'?'자격 검증 이벤트':'시작 전 이벤트'}</div></div>
      <div class="kpi-card"><div class="kpi-label">상태</div><div class="kpi-value" style="font-size:14px;color:var(--text-sub);">대기</div><div class="kpi-sub">시작 전</div></div>`;
    return;
  }
  const resultLabel = ev.live ? '현재 실적' : '최종 실적';
  bar.innerHTML = `
    <div class="kpi-card accent"><div class="kpi-label">대상 자원</div><div class="kpi-value blue">${summary.targetCount}개</div><div class="kpi-sub">감축 지시 대상</div></div>
    <div class="kpi-card"><div class="kpi-label">지시용량</div><div class="kpi-value">${summary.totalOrd.toLocaleString()}<span style="font-size:12px;color:var(--text-hint);font-weight:500;"> kW</span></div></div>
    <div class="kpi-card"><div class="kpi-label">${resultLabel}</div><div class="kpi-value" style="color:${rateColor};">${(summary.totalAct||0).toLocaleString()}<span style="font-size:12px;color:var(--text-hint);font-weight:500;"> kW</span></div></div>
    <div class="kpi-card"><div class="kpi-label">종합 이행률</div><div class="kpi-value" style="color:${rateColor};">${summary.rate!=null?`${Math.round(summary.rate*100)}%`:'—'}</div><div class="kpi-sub">목표 100% · 달성기준 97% 이상</div></div>
    <div class="kpi-card ${health.tone==='bad'?'warn':health.tone==='warn'?'warn':''}"><div class="kpi-label">이상 자원</div><div class="kpi-value" style="color:${health.tone==='bad'?'var(--red)':health.tone==='warn'?'#f59e0b':'var(--green)'};">${abnormalText}</div><div class="kpi-sub">${health.tone==='bad'?'이행률 70% 미만 또는 데이터 미수신':health.tone==='warn'?'이행률 70~90% (주의)':'정상 운영'}</div></div>
    <div class="kpi-card ${ev.live?'warn':''}"><div class="kpi-label">${ev.live?'잔여 시간':'종료'}</div>
      <div class="kpi-value" style="font-size:14px;color:${ev.live?'var(--blue)':'var(--text-sub)'};">${ev.live?`${ev.remainingMinutes}분`:'완료됨'}</div>
      <div class="kpi-sub">${ev.date} ${ev.timeRange}</div></div>`;
}

function monRenderResourceList(ev){
  const list = $('mon-res-list');
  if(!ev || !ev.resources.length){ list.innerHTML = '<div class="empty">이벤트 대상 자원이 없습니다.</div>'; $('mon-res-sub').textContent='-'; return; }
  $('mon-res-sub').textContent = `${ev.resources.length}개 자원 (클릭하여 상세 확인)`;
  // 정렬
  const arr = [...ev.resources];
  const sort = monState.sort;
  if(sort==='rate-asc')  arr.sort((a,b)=> (a.actual/a.ordered||0) - (b.actual/b.ordered||0));
  if(sort==='rate-desc') arr.sort((a,b)=> (b.actual/b.ordered||0) - (a.actual/a.ordered||0));
  if(sort==='ord-desc')  arr.sort((a,b)=> b.ordered - a.ordered);
  list.innerHTML = arr.map(r=>{
    const g = groupById(r.groupId);
    const name = g?.name || `자원그룹 #${r.groupId}`;
    const type = g?.type || '-';
    const rate = r.actual!=null ? r.actual/r.ordered : null;
    const isActive = r.groupId===monState.selectedGroupId;
    return `<div class="res-row ${isActive?'active':''}" onclick="monSelectResource(${r.groupId})">
      <div><div class="res-row-name">${name}</div><div class="res-row-type"><span class="badge ${monTypeClass(type)}" style="font-size:9px;padding:1px 6px;">${type}</span></div></div>
      <div class="res-row-val">${r.ordered.toLocaleString()}</div>
      <div class="res-row-val">${r.actual!=null?r.actual.toLocaleString():'—'}</div>
      <div style="text-align:right;">${rate!=null?`<span class="rate-pill ${monRateCls(rate)}">${Math.round(rate*100)}%</span>`:'<span style="color:var(--text-hint);font-size:11px;">—</span>'}</div>
      <div style="text-align:center;">${r.status==='SCHEDULED'?'<span style="font-size:10px;color:var(--text-hint);">대기</span>':`<span class="dot ${monDotCls(r.status)}"></span>`}</div>
    </div>`;
  }).join('');
}
function monSelectResource(groupId){
  monState.selectedGroupId = groupId;
  monRender();
}

function monLiveStatusMeta(r){
  if(r.status==='FAILED') return {cls:'bad', label:'데이터 수집 이상'};
  if(r.status==='DELAYED') return {cls:'warn', label:'데이터 수집 지연'};
  return {cls:'good', label:'데이터 수집 정상'};
}

let monLiveTimerHandle = null;
function monStopLiveTimer(){
  if(monLiveTimerHandle){
    clearInterval(monLiveTimerHandle);
    monLiveTimerHandle = null;
  }
}
function monFormatLiveTimer(totalSeconds){
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = String(Math.floor(safe / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
  const seconds = String(safe % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}
function monStartLiveTimer(totalSeconds){
  monStopLiveTimer();
  const timerEl = $('mon-live-timer');
  if(!timerEl) return;
  let remain = Math.max(0, Math.floor(totalSeconds || 0));
  const render = ()=>{ timerEl.textContent = monFormatLiveTimer(remain); };
  render();
  monLiveTimerHandle = setInterval(()=>{
    if(remain<=0){
      monStopLiveTimer();
      return;
    }
    remain -= 1;
    render();
  }, 1000);
}

function monRenderLiveOverview(r, ev, g){
  const rate = r.actual/r.ordered;
  const pct = Math.round(rate*100);
  const gaugePct = Math.max(0, Math.min(100, pct));
  const health = monLiveStatusMeta(r);
  return `
    <div class="mon-section">
      <div class="mon-live-layout">
        <div class="mon-live-header">
          <div class="mon-title-control-row">
            <select class="filter-select mon-inline-select mon-title-select" id="mon-group-select" onchange="monSelectResource(Number(this.value))"></select>
          </div>
          <div class="mon-live-toolbar">
            <div class="view-tab-group">
              <button class="view-tab ${monState.viewMode==='5min'?'active':''}" onclick="monSwitchView('5min')">5분 단위</button>
              <button class="view-tab ${monState.viewMode==='15min'?'active':''}" onclick="monSwitchView('15min')">15분 단위</button>
            </div>
            <div class="mon-live-status ${health.cls}"><span class="mon-live-status-dot"></span>${health.label}</div>
          </div>
        </div>

        <div class="mon-live-summary-grid">
          <div class="mon-live-summary-card">
            <div class="mon-live-summary-label">목표 감축량</div>
            <div class="mon-live-summary-value">${r.ordered.toLocaleString()}<span class="mon-live-summary-unit">kW</span></div>
          </div>
          <div class="mon-live-summary-card accent">
            <div class="mon-live-summary-label">현재 진행량</div>
            <div class="mon-live-summary-value ${rate>=1?'good':''}">${r.actual.toLocaleString()}<span class="mon-live-summary-unit">kW</span></div>
          </div>
        </div>

        <div class="mon-live-hero">
          <div class="mon-live-trend">
            <div class="chart-legend" style="padding-top:2px;padding-bottom:14px;">
              <span class="legend-item"><span class="legend-line" style="background:#64748b;"></span>CBL (기준)</span>
              <span class="legend-item"><span class="legend-line" style="background:var(--blue);"></span>실제 사용량</span>
              <span class="legend-item"><span class="legend-line" style="background:var(--red);"></span>${dispatchTypeMeta(ev.dispatch_type).direction==='increase'?'증대 목표선':'감축 목표선'}</span>
            </div>
            ${monRenderChart(r, ev)}
          </div>
          <div class="mon-live-side">
            <div class="mon-live-gauge-card">
              <div class="mon-live-gauge-label">현재 이행률</div>
              <div class="mon-live-gauge-wrap" style="--gauge-angle:${gaugePct * 3.6}deg;">
                <div class="mon-live-gauge-inner">
                  <div class="mon-live-gauge-rate">${pct}%</div>
                  <div class="mon-live-gauge-sub">달성률</div>
                </div>
              </div>
              <div class="mon-live-timer-block">
                <div class="mon-live-timer-label">잔여시간</div>
                <div class="mon-live-timer" id="mon-live-timer">${monFormatLiveTimer((ev.remainingMinutes || 0) * 60)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function monSyncGroupSelector(ev){
  const select = $('mon-group-select');
  if(!select) return;
  if(!ev || !ev.resources.length){
    select.innerHTML = '<option value="">자원 없음</option>';
    select.disabled = true;
    return;
  }
  const options = ev.resources.map(r=>{
    const g = groupById(r.groupId);
    const name = g?.name || `자원그룹 #${r.groupId}`;
    const type = g?.type || '-';
    const rate = (r.actual!=null && r.ordered>0) ? Math.round((r.actual/r.ordered)*100) : null;
    const statusLabel = r.status==='SCHEDULED' ? '대기' : (rate!=null ? `${rate}%` : '실적 미수신');
    return `<option value="${r.groupId}">${name} · ${type} · ${statusLabel}</option>`;
  }).join('');
  select.innerHTML = options;
  select.disabled = false;
  if(!ev.resources.find(r=>r.groupId===monState.selectedGroupId)){
    monState.selectedGroupId = ev.resources[0].groupId;
  }
  select.value = String(monState.selectedGroupId);
}

function monRenderEmbeddedDm(ev){
  const controls = $('mon-dm-controls');
  const body = $('mon-dm-body');
  const title = $('mon-dm-title');
  const sub = $('mon-dm-sub');
  if(!controls || !body || !title || !sub) return;
  if(!ev || !monState.selectedGroupId){
    controls.innerHTML = '';
    body.innerHTML = '<div class="mon-dm-empty">자원을 선택하면 상세 모니터링이 표시됩니다.</div>';
    title.textContent = '상세 모니터링';
    sub.textContent = '선택한 자원의 참여고객별 데이터 수집 현황을 확인합니다.';
    return;
  }
  const g = groupById(monState.selectedGroupId);
  if(!g){
    controls.innerHTML = '';
    body.innerHTML = '<div class="mon-dm-empty">자원 정보를 찾을 수 없습니다.</div>';
    return;
  }
  if(monDmState.groupId!==g.id || monDmState.eventId!==ev.id){
    monDmState = dmBuildState({ groupId:g.id, eventId:ev.id, initialCustomerId:null });
  }
  title.textContent = '상세 모니터링';
  sub.innerHTML = `${g.name} · ${g.type} · 참여고객 ${(g.customerIds||[]).length}명`;
  dmRenderScope('monDm');
}

function monOpenEmbeddedDm(){
  if(!monDmState.groupId) return;
  dmOpen({
    groupId: monDmState.groupId,
    eventId: monDmState.eventId,
    initialCustomerId: monDmState.customerId || null
  });
  if(monDmState.queryDate){
    dmState.queryDate = monDmState.queryDate;
    dmRefresh();
  }
}

function monRenderRightPane(ev){
  const pane = $('mon-right-pane');
  monStopLiveTimer();
  if(!monState.selectedGroupId || !ev){
    pane.innerHTML = `<div class="empty" style="margin-top:80px;">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
      <p>상단에서 자원을 선택하면<br>이벤트 자원 상세를 확인할 수 있습니다.</p>
    </div>`;
    return;
  }
  const r = ev.resources.find(x=>x.groupId===monState.selectedGroupId);
  if(!r){ pane.innerHTML = '<div class="empty">자원 정보를 찾을 수 없습니다.</div>'; return; }
  const g = groupById(r.groupId);
  const type = g?.type||'-';
  const name = g?.name||`자원그룹 #${r.groupId}`;

  if(r.status==='SCHEDULED'){
    pane.innerHTML = `<div class="mon-section" style="margin-top:16px;">
      <div class="mon-section-head">
        <div>
          <div class="mon-title-control-row">
            <select class="filter-select mon-inline-select mon-title-select" id="mon-group-select" onchange="monSelectResource(Number(this.value))"></select>
          </div>
          <div class="mon-section-sub"><span class="badge ${monTypeClass(type)}" style="font-size:10px;">${type}</span></div>
        </div>
      </div>
      <div class="empty" style="padding:40px 20px;background:var(--blue-light);border-radius:var(--radius);color:var(--blue);">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p style="color:var(--blue);font-weight:500;">시작 대기 중입니다.</p>
        <p style="margin-top:6px;font-size:11px;color:var(--blue-mid);">${ev.date} ${ev.timeRange}에 시작 예정</p>
      </div>
    </div>`;
    return;
  }

  const rate = r.actual/r.ordered;
  const statusText = r.status==='NORMAL'?'정상 감축 중':r.status==='DELAYED'?'데이터 지연':r.status==='FAILED'?'감축 미달':'';
  if(ev.live){
    pane.innerHTML = `
      ${monRenderLiveOverview(r, ev, g)}

      <div class="mon-section">
        <div class="mon-section-head">
          <div><div class="mon-section-title">참여고객별 이행 추이</div><div class="mon-section-sub">시간대별 이행률 히트맵 (5분 단위)</div></div>
        </div>
        ${monRenderHeatmap(r, g)}
      </div>

      <div class="mon-section">
      <div class="mon-section-head"><div><div class="mon-section-title">참여고객 현황</div><div class="mon-section-sub">고객별 실시간 ${dispatchTypeMeta(ev.dispatch_type).direction==='increase'?'증대':'감축'} 실적</div></div></div>
      ${monRenderCustTable(r, g)}
    </div>`;
    monStartLiveTimer((ev.remainingMinutes || 0) * 60);
    return;
  }
  pane.innerHTML = `
    <div class="mon-section">
      <div class="mon-section-head">
        <div>
          <div class="mon-title-control-row">
            <select class="filter-select mon-inline-select mon-title-select" id="mon-group-select" onchange="monSelectResource(Number(this.value))"></select>
          </div>
          <div style="font-size:11px;color:var(--text-hint);margin-top:3px;">
            <span class="badge ${monTypeClass(type)}" style="font-size:10px;">${type}</span>
            <span class="dot ${monDotCls(r.status)}" style="margin-left:8px;"></span>
            <span style="margin-left:4px;color:${monRateColor(rate)};">${statusText}</span>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        <div style="padding:10px 12px;background:var(--bg);border-radius:6px;">
          <div style="font-size:10px;color:var(--text-hint);">지시용량</div>
          <div style="font-size:17px;font-weight:700;color:var(--text);margin-top:2px;">${r.ordered.toLocaleString()} <span style="font-size:11px;font-weight:500;color:var(--text-hint);">kW</span></div>
        </div>
        <div style="padding:10px 12px;background:var(--bg);border-radius:6px;">
          <div style="font-size:10px;color:var(--text-hint);">현재 실적</div>
          <div style="font-size:17px;font-weight:700;color:${monRateColor(rate)};margin-top:2px;">${r.actual.toLocaleString()} <span style="font-size:11px;font-weight:500;color:var(--text-hint);">kW</span></div>
        </div>
        <div style="padding:10px 12px;background:${rate>=0.9?'var(--green-light)':rate>=0.7?'var(--amber-light)':'var(--red-light)'};border-radius:6px;">
          <div style="font-size:10px;color:${monRateColor(rate)};">이행률</div>
          <div style="font-size:17px;font-weight:700;color:${monRateColor(rate)};margin-top:2px;">${Math.round(rate*100)}%</div>
        </div>
      </div>
    </div>

    <div class="mon-section">
      <div class="mon-section-head">
        <div>
          <div class="mon-section-title">${dispatchTypeMeta(ev.dispatch_type).direction==='increase'?'증대 추이':'감축 추이'}</div>
          <div class="mon-section-sub">CBL · 실제 사용량 · ${dispatchTypeMeta(ev.dispatch_type).direction==='increase'?'증대 지시선':'감축 지시선'}</div>
        </div>
        <div class="view-tab-group">
          <button class="view-tab ${monState.viewMode==='5min'?'active':''}" onclick="monSwitchView('5min')">5분 단위</button>
          <button class="view-tab ${monState.viewMode==='15min'?'active':''}" onclick="monSwitchView('15min')">15분 단위</button>
        </div>
      </div>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-line" style="background:#64748b;"></span>CBL (기준)</span>
        <span class="legend-item"><span class="legend-line" style="background:var(--blue);"></span>실제 사용량</span>
        <span class="legend-item"><span class="legend-line" style="background:var(--red);"></span>${dispatchTypeMeta(ev.dispatch_type).direction==='increase'?'증대 목표선':'감축 목표선'}</span>
      </div>
      ${monRenderChart(r, ev)}
    </div>

    <div class="mon-section">
      <div class="mon-section-head">
        <div><div class="mon-section-title">참여고객별 이행 추이</div><div class="mon-section-sub">시간대별 이행률 히트맵 (5분 단위)</div></div>
      </div>
      ${monRenderHeatmap(r, g)}
    </div>

    <div class="mon-section">
      <div class="mon-section-head"><div><div class="mon-section-title">참여고객 현황</div><div class="mon-section-sub">고객별 실시간 ${dispatchTypeMeta(ev.dispatch_type).direction==='increase'?'증대':'감축'} 실적</div></div></div>
      ${monRenderCustTable(r, g)}
    </div>`;
}

function monSwitchView(v){ monState.viewMode = v; monRender(); }

function monRenderChart(r, ev){
  const W=600, H=220, P={l:40,r:10,t:14,b:26};
  const innerW = W - P.l - P.r, innerH = H - P.t - P.b;
  const points = monState.viewMode==='5min'?24:8;
  // 증대/감축 방향은 dispatch_type(이벤트 종류)로 결정 (자원 유형이 아님)
  // - MANDATORY_REDUCTION / VOLUNTARY_REDUCTION: CBL 아래로 감축
  // - VOLUNTARY_INCREASE / REALTIME_INCREASE_REQUEST: CBL 위로 증대
  const dm = dispatchTypeMeta(ev?.dispatch_type);
  const isIncrease = dm.direction === 'increase';
  // CBL 기준 산식: 감축은 지시량이 CBL의 약 35%, 증대는 약 25%
  const cblBase = isIncrease ? (r.ordered/0.25) : (r.ordered/0.35);
  const rate = (r.actual!=null && r.ordered>0) ? r.actual/r.ordered : 0;
  // 데이터 생성
  const seed = r.groupId*137 + points;
  const rand = (i)=>{ const s=Math.sin(seed*i+seed)*10000; return s-Math.floor(s); };
  const cbl = [], actual = [];
  for(let i=0;i<points;i++){
    cbl.push(cblBase + Math.sin(i*0.7)*cblBase*0.04 + (rand(i)-0.5)*cblBase*0.03);
    if(i<points/2) actual.push(cbl[i] + (rand(i+10)-0.5)*cblBase*0.03);
    else {
      const delta = r.ordered * rate;
      actual.push(cbl[i] + (isIncrease?1:-1)*delta + (rand(i+20)-0.5)*cblBase*0.04);
    }
  }
  const target = isIncrease ? (cblBase + r.ordered) : (cblBase - r.ordered);
  const all = [...cbl, ...actual, target];
  const yMax = Math.max(...all)*1.08, yMin = Math.min(...all)*0.88;
  const x = i => P.l + (i/(points-1))*innerW;
  const y = v => P.t + innerH - ((v-yMin)/(yMax-yMin))*innerH;
  const pathStr = arr => arr.map((v,i)=>`${i===0?'M':'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const yTicks = Array.from({length:5}, (_,i)=>({y:y(yMin+(yMax-yMin)*(i/4)), label:Math.round(yMin+(yMax-yMin)*(i/4)).toLocaleString()}));
  const xLabels = ['13:00','13:30','14:00','14:30','15:00'];
  const eventBgX = P.l + innerW/2, eventBgW = innerW/2;
  const targetLabel = isIncrease ? '증대 목표선' : '감축 목표선';
  const eventLabel = isIncrease ? '증대 구간' : '감축 구간';
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="background:#fafbfd;border-radius:6px;">
    <rect x="${eventBgX}" y="${P.t}" width="${eventBgW}" height="${innerH}" fill="var(--red-light)" opacity="0.3"/>
    <text x="${eventBgX + eventBgW/2}" y="${P.t+10}" font-size="9" fill="var(--red)" text-anchor="middle" font-weight="600">${eventLabel}</text>
    ${yTicks.map(t=>`<line x1="${P.l}" y1="${t.y}" x2="${W-P.r}" y2="${t.y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="2,3"/><text x="${P.l-5}" y="${t.y+3}" font-size="9" fill="var(--text-hint)" text-anchor="end">${t.label}</text>`).join('')}
    ${xLabels.map((lb,i)=>{ const xpos=P.l+(i/(xLabels.length-1))*innerW; return `<text x="${xpos}" y="${H-8}" font-size="9" fill="var(--text-hint)" text-anchor="middle">${lb}</text>`; }).join('')}
    <line x1="${P.l}" y1="${y(target)}" x2="${W-P.r}" y2="${y(target)}" stroke="var(--red)" stroke-width="1.5" stroke-dasharray="4,3"/>
    <text x="${W-P.r-50}" y="${y(target)-3}" font-size="9" fill="var(--red)" font-weight="600">${targetLabel}</text>
    <path d="${pathStr(cbl)}" fill="none" stroke="#64748b" stroke-width="1.5"/>
    <path d="${pathStr(actual)}" fill="none" stroke="var(--blue)" stroke-width="2"/>
  </svg>`;
}

function monRenderHeatmap(r, g){
  const custIds = (g?.customerIds||[]).slice(0, 6);
  if(!custIds.length) return '<div class="empty" style="padding:20px;">참여고객 정보가 없습니다.</div>';
  const blocks = 12;
  const baseRate = r.actual/r.ordered;
  const seed = r.groupId*137;
  const rand = (i,j)=>{ const s=Math.sin(seed+i*31+j*7)*10000; return s-Math.floor(s); };
  const colorFor = v => {
    if(v>=0.95) return '#1a7a4a';
    if(v>=0.85) return '#4ca878';
    if(v>=0.7) return '#f59e0b';
    if(v>=0.5) return '#ea8a0a';
    return '#b91c1c';
  };
  return `<div class="heatmap-wrap">
    <div style="display:grid;grid-template-columns:80px 1fr;gap:6px;padding:2px 0 6px;font-size:9px;color:var(--text-hint);">
      <span></span>
      <div style="display:flex;gap:2px;">
        ${Array.from({length:blocks}, (_,i)=>`<span style="flex:1;text-align:center;">${i%3===0?`${14+Math.floor(i/12)}:${String((i*5)%60).padStart(2,'0')}`:''}</span>`).join('')}
      </div>
    </div>
    ${custIds.map((cid,i)=>{
      const c = custById(cid);
      const name = c?.name||cid;
      return `<div class="heatmap-row">
        <span class="heatmap-label">${name.substring(0,6)}</span>
        <div class="heatmap-cells">
          ${Array.from({length:blocks}, (_,j)=>{
            const variance = (rand(i,j)-0.5)*0.25;
            const v = Math.max(0.3, Math.min(1.0, baseRate + variance));
            return `<div class="heatmap-cell" style="background:${colorFor(v)};" title="${name} · ${Math.round(v*100)}%"></div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}
    <div class="heatmap-legend">
      <span>이행률:</span>
      <span>낮음</span>
      <div class="heatmap-scale">
        <span style="background:#b91c1c;"></span>
        <span style="background:#ea8a0a;"></span>
        <span style="background:#f59e0b;"></span>
        <span style="background:#4ca878;"></span>
        <span style="background:#1a7a4a;"></span>
      </div>
      <span>높음</span>
    </div>
  </div>`;
}

function monRenderCustTable(r, g){
  const custIds = g?.customerIds||[];
  if(!custIds.length) return '<div class="empty" style="padding:20px;">참여고객이 없습니다.</div>';
  const baseRate = r.actual/r.ordered;
  const seed = r.groupId*137;
  const rand = i=>{ const s=Math.sin(seed*i+3)*10000; return s-Math.floor(s); };
  // 고객별 지시용량/원시 변동률을 먼저 계산한 뒤,
  // 실적 합이 그룹 r.actual과 일치하도록 스케일 팩터 적용 (회계 원칙: 그룹 실적 = 고객 실적 합)
  const rows = custIds.map((cid,i)=>{
    const c = custById(cid); if(!c) return null;
    const ordered = c.reduction||100;
    const rawV = Math.max(0.3, Math.min(1.0, baseRate + (rand(i)-0.5)*0.2));
    return {c, ordered, rawV};
  }).filter(Boolean);
  const rawActualSum = rows.reduce((s,x)=>s + x.ordered*x.rawV, 0);
  const scale = rawActualSum>0 ? (r.actual / rawActualSum) : 1;
  return `<div class="cust-head">
      <span>고객명</span><span style="text-align:right;">지시(kW)</span><span style="text-align:right;">실적(kW)</span><span style="text-align:center;">이행률</span>
    </div>
    ${rows.map(({c,ordered,rawV})=>{
      const actual = Math.round(ordered * rawV * scale);
      const v = ordered>0 ? actual/ordered : 0;
      return `<div class="cust-row">
        <span><div style="font-weight:600;color:var(--navy);">${c.name}</div><div style="font-size:10px;color:var(--text-hint);margin-top:1px;">${c.recno}</div></span>
        <span style="text-align:right;font-weight:500;">${ordered.toLocaleString()}</span>
        <span style="text-align:right;font-weight:500;color:${monRateColor(v)};">${actual.toLocaleString()}</span>
        <span style="text-align:center;"><span class="rate-pill ${monRateCls(v)}" style="font-size:10px;min-width:48px;" title="${v>=0.9?'정상':v>=0.7?'주의':'이상'}">${Math.round(v*100)}%</span></span>
      </div>`;
    }).join('')}`;
}

/* ════════════════════════════════════════════════════════════
   ★ 공통 데이터 모니터링 모달
   - 감축 모니터링의 "상세 모니터링" 버튼과
     자원관리 가동상태 탭의 "데이터 수집 상세보기" 버튼이 공용으로 호출
   - options:
     { groupId: 자원그룹 ID (필수)
       eventId: 감축 이벤트 ID (옵션) — 감축 맥락일 때 목표선·감축구간 강조
       initialCustomerId: 시작 시 바로 포커스할 고객 (옵션) }
════════════════════════════════════════════════════════════ */
var dmState = { groupId:null, eventId:null, customerId:null, queryDate:null, view:'summary' };

function dmFindEvent(eventId){
  return [
    ...(store.events?.reduction || []),
    ...(store.events?.plus || [])
  ].find(e=>e.id===eventId) || null;
}

function dmDefaultQueryDate(){
  const d = new Date();
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}

function dmBuildState(options){
  const opts = options || {};
  const g = groupById(opts.groupId);
  const ev = opts.eventId ? dmFindEvent(opts.eventId) : null;
  return {
    groupId: g?.id || null,
    eventId: ev?.id || opts.eventId || null,
    customerId: opts.initialCustomerId || null,
    queryDate: opts.queryDate || (ev ? ev.date : dmDefaultQueryDate()),
    view: opts.initialCustomerId ? 'detail' : 'summary'
  };
}

function dmScopeMeta(scope){
  return scope==='monDm'
    ? { controls:'mon-dm-controls', body:'mon-dm-body' }
    : { controls:'dm-controls', body:'dm-body' };
}

function dmGetState(scope='dm'){
  return scope==='monDm' ? monDmState : dmState;
}

function dmAssignState(scope='dm', nextState){
  if(scope==='monDm') monDmState = nextState;
  else dmState = nextState;
  return dmGetState(scope);
}

function dmOpen(options){
  const opts = options || {};
  const g = groupById(opts.groupId);
  if(!g){ showToast('자원그룹을 찾을 수 없습니다.'); return; }
  const ev = opts.eventId ? dmFindEvent(opts.eventId) : null;
  dmAssignState('dm', dmBuildState(opts));
  // 제목 및 부제
  $('dm-title').innerHTML = `데이터 모니터링 — ${g.name}`;
  const subParts = [`${g.type}`, `참여고객 ${(g.customerIds||[]).length}명`];
  if(ev) subParts.push(`<span style="color:var(--amber);">이벤트: ${ev.id} · ${ev.date} ${ev.timeRange}</span>`);
  $('dm-sub').innerHTML = subParts.join(' · ');
  openModal('dmModal');
  dmRenderScope('dm');
}

function dmRefresh(){
  dmRenderScope('dm');
}

function dmRenderScope(scope='dm'){
  const state = dmGetState(scope);
  const g = groupById(state.groupId);
  const meta = dmScopeMeta(scope);
  const ctlBox = $(meta.controls);
  if(!g || !ctlBox) return;
  const ev = state.eventId ? dmFindEvent(state.eventId) : null;
  // 컨트롤 바 렌더
  const custIds = g.customerIds||[];
  const custOptions = custIds.map(id=>{
    const c = custById(id);
    if(!c) return '';
    const sel = id===state.customerId ? 'selected' : '';
    return `<option value="${id}" ${sel}>${id} · ${c.name}</option>`;
  }).join('');
  ctlBox.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;">
      <button class="btn btn-sm ${state.view==='summary'?'btn-primary':'btn-secondary'}" onclick="dmSwitchView('summary','${scope}')">전체 요약</button>
      <button class="btn btn-sm ${state.view==='detail'?'btn-primary':'btn-secondary'}" onclick="dmSwitchView('detail','${scope}')" ${custIds.length===0?'disabled':''}>고객별 상세</button>
    </div>
    ${state.view==='detail' ? `
      <span style="font-size:11px;color:var(--text-hint);margin-left:8px;">고객:</span>
      <select class="form-select" style="height:32px;font-size:12px;width:220px;" onchange="dmSelectCustomer('${scope}', this.value)">
        <option value="">— 고객 선택 —</option>
        ${custOptions}
      </select>
    ` : ''}
    <span style="font-size:11px;color:var(--text-hint);margin-left:8px;">조회일:</span>
    <input type="date" class="form-input" style="height:32px;font-size:12px;width:150px;" value="${state.queryDate}" onchange="dmSetQueryDate('${scope}', this.value)">
    ${ev ? `<span class="badge badge-pending" style="font-size:10px;margin-left:auto;">이벤트 맥락</span>` : ''}
  `;
  // 본문 렌더
  if(state.view==='summary'){
    dmRenderSummary(g, ev, state, meta.body, scope);
  } else {
    dmRenderDetail(g, ev, state, meta.body, scope);
  }
}

function dmSwitchView(v, scope='dm'){
  const state = dmGetState(scope);
  state.view = v;
  if(v==='summary') state.customerId = null;
  dmRenderScope(scope);
}

function dmSelectCustomer(scope, customerId){
  const state = dmGetState(scope);
  state.customerId = customerId || null;
  state.view = customerId ? 'detail' : 'summary';
  dmRenderScope(scope);
}

function dmSetQueryDate(scope, value){
  const state = dmGetState(scope);
  state.queryDate = value;
  dmRenderScope(scope);
}

/* 전체 요약: 참여고객별 데이터 수집 상태 + 시간×고객 매트릭스 */
function dmRenderSummary(g, ev, state=dmState, bodyId='dm-body', scope='dm'){
  const body = $(bodyId);
  const custIds = g.customerIds||[];
  if(custIds.length===0){
    body.innerHTML = `<div class="empty" style="padding:60px 20px;">이 자원그룹에 매핑된 참여고객이 없습니다.</div>`;
    return;
  }
  const qDate = new Date(state.queryDate);
  // 각 고객별 하루 전체 데이터 로드
  const rows = custIds.map(id=>{
    const c = custById(id);
    if(!c) return null;
    const days = pcDmGenerateData(c, qDate, qDate);
    const day = days[0];
    if(!day) return null;
    const validSlots = day.slots.filter(s=>!s.missing);
    const missCnt = day.slots.filter(s=>s.missing).length;
    const imputedCnt = day.slots.filter(s=>s.imputed).length;
    const lastSlot = validSlots[validSlots.length-1];
    const avgKw = validSlots.length ? validSlots.reduce((a,s)=>a+s.kw,0)/validSlots.length : 0;
    // 수집 상태: 미수신(우선) > 다량 보정 > 정상
    const rateState = missCnt>3 ? 'risk' : missCnt>0 ? 'warn' : imputedCnt>6 ? 'imp' : 'ok';
    return { id, c, day, validSlots, missCnt, imputedCnt, lastSlot, avgKw, rateState };
  }).filter(Boolean);

  // 감축 시간대 파악 + 자원그룹 지시용량 기반 고객별 감축 목표 추정
  let drStartHM = null, drEndHM = null;
  if(ev){
    const m = (ev.timeRange||'').match(/(\d{2}:\d{2})~(\d{2}:\d{2})/);
    if(m){ drStartHM = m[1]; drEndHM = m[2]; }
  }
  const resInEvent = ev?.resources?.find(res=>res.groupId===g.id);
  const groupOrdered = resInEvent?.ordered || null;
  const totalPower = (g.customerIds||[]).reduce((a,id)=>{
    const cc = custById(id); return a + (cc?.power||400);
  }, 0) || 1;
  const matrixWrapId = scope==='monDm' ? 'mon-dm-matrix-wrap' : 'dm-matrix-wrap';
  const drStartId = scope==='monDm' ? 'mon-dm-dr-start' : 'dm-mx-dr-start';

  // 매트릭스 데이터: 96 슬롯 (00:00 ~ 23:45) 기준, 각 고객 행
  const allSlots = rows[0]?.day.slots || [];

  // 시간대 셀 값 계산 함수
  // 이벤트 맥락: 감축 시간대 슬롯은 이행률 % · 그 외 슬롯은 실측값 kW
  // 평시: 모든 슬롯 실측값 kW
  // 보정 슬롯: 별도 배경 + · 표식 (정산 투입값이지만 출처가 보정임을 명시)
  const cellValue = (slot, row)=>{
    if(slot.missing) return {txt:'—', cls:'dm-mx-miss'};
    const inDr = (drStartHM && drEndHM && slot.time>=drStartHM && slot.time<drEndHM);
    if(ev && inDr && groupOrdered){
      // 고객별 감축 목표 = 자원 지시용량 × (고객 계약전력 비중)
      const custOrdered = groupOrdered * (row.c.power||400) / totalPower;
      const reduced = Math.max(0, slot.cbl - slot.kw);
      const rate = custOrdered>0 ? reduced/custOrdered : 0;
      const pct = Math.round(rate*100);
      let cls = rate>=0.95 ? 'dm-mx-good' : rate>=0.70 ? 'dm-mx-warn' : 'dm-mx-bad';
      if(slot.imputed) cls += ' dm-mx-imputed';
      return {txt:`${pct}%`, cls};
    }
    // 평시 또는 감축 시간대 외: 실측값 kW (보정 슬롯은 별도 스타일)
    if(slot.imputed) return {txt: Math.round(slot.kw).toString(), cls:'dm-mx-imputed'};
    return {txt: Math.round(slot.kw).toString(), cls:'dm-mx-normal'};
  };

  // 매트릭스 컬럼 헤더 (15분 단위 시각)
  const headerCells = allSlots.map(s=>{
    const inDr = (drStartHM && drEndHM && s.time>=drStartHM && s.time<drEndHM);
    // 정시(00분)만 라벨 표시, 그 외는 점(·)으로 간결화
    const label = s.time.endsWith(':00') ? s.time : '·';
    return `<th class="${inDr?'dm-mx-dr-col':''}" data-time="${s.time}" ${s.time===drStartHM?`id="${drStartId}"`:''}>${label}</th>`;
  }).join('');

  // 매트릭스 본문 행
  const matrixRows = rows.map(row=>{
    const cells = allSlots.map((_,i)=>{
      const slot = row.day.slots[i];
      const v = cellValue(slot, row);
      const inDr = (drStartHM && drEndHM && slot.time>=drStartHM && slot.time<drEndHM);
      // 평시 일반 셀에만 감축 배경 적용 (보정·미수신·이행률 셀은 고유 배경 유지)
      const drBgClass = (inDr && v.cls==='dm-mx-normal') ? 'dm-mx-dr-bg' : '';
      let tip;
      if(slot.missing){
        tip = `${row.c.name} · ${slot.time} · 미수신 (보정 실패)`;
      } else if(slot.imputed){
        tip = `${row.c.name} · ${slot.time} · 🔧 보정값 (${slot.imputeRule||'-'}) · ${slot.imputeReason||''} · CBL ${slot.cbl.toFixed(1)} / 보정값 ${slot.kw.toFixed(1)}`;
      } else {
        tip = `${row.c.name} · ${slot.time} · CBL ${slot.cbl.toFixed(1)} / 실측 ${slot.kw.toFixed(1)}`;
      }
      return `<td class="${v.cls} ${drBgClass}" title="${tip}">${v.txt}</td>`;
    }).join('');
    return `<tr><td class="dm-mx-cust" title="${row.c.name}">${row.c.name}</td>${cells}</tr>`;
  }).join('');

  // 범례
  const legend = ev
    ? `<div class="dm-mx-legend">
        <span>감축 시간대 셀은 <b>이행률 %</b></span>
        <span class="dm-mx-legend-item"><span class="dm-mx-legend-swatch" style="background:#d4efdc;"></span>95% 이상</span>
        <span class="dm-mx-legend-item"><span class="dm-mx-legend-swatch" style="background:#fde4b8;"></span>70~95%</span>
        <span class="dm-mx-legend-item"><span class="dm-mx-legend-swatch" style="background:#fad3d3;"></span>70% 미만</span>
        <span class="dm-mx-legend-item"><span class="dm-mx-legend-swatch" style="background:#e7f0ff;"></span>보정값(<b>·</b>)</span>
        <span class="dm-mx-legend-item"><span class="dm-mx-legend-swatch" style="background:#ebedf0;"></span>미수신</span>
        <span style="margin-left:auto;color:var(--text-hint);">감축 외 시간대 셀은 실측 kW</span>
       </div>`
    : `<div class="dm-mx-legend">
        <span>셀 값: <b>실측 kW</b></span>
        <span class="dm-mx-legend-item"><span class="dm-mx-legend-swatch" style="background:#e7f0ff;"></span>보정값(<b>·</b>)</span>
        <span class="dm-mx-legend-item"><span class="dm-mx-legend-swatch" style="background:#ebedf0;"></span>미수신</span>
        <span style="margin-left:auto;color:var(--text-hint);">셀에 마우스를 올리면 CBL·보정규칙 상세 확인</span>
       </div>`;

  body.innerHTML = `
    <!-- 상단: 고객별 요약 테이블 (간소화) -->
    <div style="margin-bottom:8px;font-size:11px;color:var(--text-hint);">
      ${rows.length}명 참여고객 · ${state.queryDate} 기준 ${ev?'(이벤트 당일)':'(조회일 현재)'}
    </div>
    <table class="dm-table" style="margin-bottom:16px;">
      <thead>
        <tr>
          <th style="text-align:left;padding-left:12px;">고객</th>
          <th>계약전력</th>
          <th>실측 평균</th>
          <th>미수신</th>
          <th>보정 적용</th>
          <th>최종 수신</th>
          <th>수집 상태</th>
          <th>상세</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r=>{
          const stateLabel = r.rateState==='ok' ? '정상'
                           : r.rateState==='imp' ? '보정 다수'
                           : r.rateState==='warn' ? '일부 결측'
                           : '다수 결측';
          const stateBadge = r.rateState==='ok' ? 'badge-done'
                           : r.rateState==='imp' ? 'badge-progress'
                           : r.rateState==='warn' ? 'badge-pending'
                           : 'badge-fail';
          return `
          <tr>
            <td style="text-align:left;padding-left:12px;">
              <div style="font-weight:600;">${r.c.name}</div>
              <div style="color:var(--text-hint);font-size:9px;margin-top:1px;">${r.id}</div>
            </td>
            <td>${r.c.power?.toLocaleString()||'—'} kW</td>
            <td style="font-weight:600;">${Math.round(r.avgKw).toLocaleString()} kW</td>
            <td style="color:${r.missCnt>0?'var(--red)':'var(--text-sub)'};font-weight:${r.missCnt>0?'600':'normal'};">${r.missCnt}개</td>
            <td>${r.imputedCnt>0?`<span class="dm-imp-badge" title="보정 적용 슬롯 수">${r.imputedCnt}개</span>`:'<span style="color:var(--text-hint);">0</span>'}</td>
            <td>${r.lastSlot?r.lastSlot.time:'—'}</td>
            <td>
              <span class="badge ${stateBadge}" style="font-size:9px;">${stateLabel}</span>
            </td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="dmSelectCustomer('${scope}','${r.id}')">보기</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <!-- 하단: 시간대×고객 매트릭스 -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
      <div style="font-size:12px;font-weight:600;color:var(--text);">
        시간대별 수집 현황 ${ev?'<span style="font-weight:400;color:var(--text-hint);font-size:10px;">· 감축 시간대 이행률 집중</span>':''}
      </div>
      <div style="font-size:10px;color:var(--text-hint);">15분 단위 · 96슬롯 · 가로 스크롤</div>
    </div>
    <div class="dm-matrix-wrap" id="${matrixWrapId}">
      <table class="dm-matrix">
        <thead>
          <tr>
            <th class="dm-mx-cust-col">고객</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${matrixRows}
        </tbody>
      </table>
    </div>
    ${legend}
  `;

  // 감축 시간대가 있으면 해당 위치로 자동 스크롤
  if(ev && drStartHM){
    setTimeout(()=>{
      const wrap = $(matrixWrapId);
      const drCell = document.getElementById(drStartId);
      if(wrap && drCell){
        // 감축 시작 지점에서 약간 앞쪽(2슬롯 전)부터 보이도록
        const targetLeft = Math.max(0, drCell.offsetLeft - 120);
        wrap.scrollLeft = targetLeft;
      }
    }, 50);
  }
}

/* 고객별 상세: 15분 단위 데이터 테이블 */
function dmRenderDetail(g, ev, state=dmState, bodyId='dm-body', scope='dm'){
  const body = $(bodyId);
  if(!state.customerId){
    body.innerHTML = `<div class="empty" style="padding:60px 20px;">상단에서 고객을 선택하세요.</div>`;
    return;
  }
  const c = custById(state.customerId);
  if(!c){
    body.innerHTML = `<div class="empty" style="padding:60px 20px;">고객 정보를 찾을 수 없습니다.</div>`;
    return;
  }
  const qDate = new Date(state.queryDate);
  const days = pcDmGenerateData(c, qDate, qDate);
  const day = days[0];
  if(!day){
    body.innerHTML = `<div class="empty" style="padding:60px 20px;">조회 데이터가 없습니다.</div>`;
    return;
  }
  // 감축 이벤트 맥락일 때 감축 목표선 계산 (이벤트 시간대에 해당하는 슬롯만)
  let drStartHM = null, drEndHM = null;
  if(ev){
    const m = (ev.timeRange||'').match(/(\d{2}:\d{2})~(\d{2}:\d{2})/);
    if(m){ drStartHM = m[1]; drEndHM = m[2]; }
  }
  const resInEvent = ev?.resources?.find(res=>res.groupId===g.id);
  const groupOrdered = resInEvent?.ordered || null;
  // 자원그룹 전체 고객의 총 CBL 대비 이 고객의 비중을 기반으로 고객별 감축 목표 추정 (시뮬레이션)
  const custShare = (c.power||400) / (g.customerIds||[]).reduce((a,id)=>{
    const cc = custById(id); return a + (cc?.power||400);
  }, 0);
  const custOrdered = groupOrdered ? groupOrdered * custShare : null;

  // 통계
  const validSlots = day.slots.filter(s=>!s.missing);
  const missCnt = day.slots.filter(s=>s.missing).length;
  const imputedCnt = day.slots.filter(s=>s.imputed).length;
  const drSlots = (drStartHM && drEndHM) ? day.slots.filter(s=>s.time>=drStartHM && s.time<drEndHM) : [];
  const drValidSlots = drSlots.filter(s=>!s.missing);
  const drImputedInWin = drSlots.filter(s=>s.imputed).length;
  const drAvgRed = drValidSlots.length ? drValidSlots.reduce((a,s)=>a+Math.max(0,s.cbl-s.kw),0)/drValidSlots.length : 0;
  const drRate = (custOrdered && drAvgRed) ? drAvgRed/custOrdered : null;

  body.innerHTML = `
    <!-- 고객 헤더 카드 -->
    <div class="dm-detail-grid">
      <div class="dm-detail-card primary">
        <div class="dm-detail-label">참여고객</div>
        <div class="dm-detail-value">${c.name}</div>
        <div class="dm-detail-meta">${c.id} · ${c.drType} · 계약전력 ${c.power?.toLocaleString()} kW</div>
      </div>
      ${ev ? `
        <div class="dm-detail-card emphasis">
          <div class="dm-detail-label">감축량 평균</div>
          <div class="dm-detail-value">${Math.round(drAvgRed).toLocaleString()} <span style="font-size:11px;color:var(--text-hint);font-weight:500;">kW</span></div>
          <div class="dm-detail-meta">감축 시간 평균 · ${drStartHM||'—'}~${drEndHM||'—'}</div>
        </div>
      ` : `
        <div class="dm-detail-card emphasis">
          <div class="dm-detail-label">수신 슬롯</div>
          <div class="dm-detail-value">${validSlots.length} <span style="font-size:11px;color:var(--text-hint);font-weight:500;">/ 96</span></div>
          <div class="dm-detail-meta">
            ${missCnt>0?`<span style="color:var(--red);">미수신 ${missCnt}</span>`:''}
            ${imputedCnt>0?`<span style="color:#1e5ab5;">보정 ${imputedCnt}</span>`:''}
            ${(missCnt===0 && imputedCnt===0)?`<span style="color:var(--green);">완전 수집</span>`:''}
          </div>
        </div>
      `}
      <div class="dm-detail-card emphasis">
        <div class="dm-detail-label">평균 실측</div>
        <div class="dm-detail-value">${validSlots.length?Math.round(validSlots.reduce((a,s)=>a+s.kw,0)/validSlots.length).toLocaleString():'—'} <span style="font-size:11px;color:var(--text-hint);font-weight:500;">kW</span></div>
      </div>
      ${ev && drRate!==null ? `
        <div class="dm-detail-card emphasis">
          <div class="dm-detail-label">감축 시간 이행률</div>
          <div class="dm-detail-value" style="color:${drRate>=0.8?'var(--green)':drRate>=0.5?'var(--amber)':'var(--red)'};">${Math.round(drRate*100)}%</div>
          <div class="dm-detail-meta">추정 · ${drStartHM}~${drEndHM}</div>
        </div>
      ` : `
        <div class="dm-detail-card emphasis">
          <div class="dm-detail-label">CBL 평균</div>
          <div class="dm-detail-value">${Math.round(day.slots.reduce((a,s)=>a+s.cbl,0)/day.slots.length).toLocaleString()} <span style="font-size:11px;color:var(--text-hint);font-weight:500;">kW</span></div>
        </div>
      `}
    </div>

    <!-- 15분 단위 데이터 테이블 (업무시간 + 감축시간 중심으로 표시) -->
    <div class="dm-detail-table-wrap">
      <table class="dm-table">
        <thead>
          <tr>
            <th>시각</th>
            <th>CBL (kW)</th>
            <th>실측/보정 (kW)</th>
            <th>감축량 (kW)</th>
            ${ev && custOrdered ? '<th>감축목표 (kW)</th><th>슬롯 이행률</th>' : ''}
            <th>출처·상태</th>
          </tr>
        </thead>
        <tbody>
          ${day.slots.map(s=>{
            const inDr = (drStartHM && drEndHM && s.time>=drStartHM && s.time<drEndHM);
            const reduced = s.missing ? null : Math.max(0, s.cbl - s.kw);
            const slotRate = (inDr && custOrdered && reduced!==null) ? reduced/custOrdered : null;
            const rowBg = s.imputed ? 'background:#eff5ff;' : (inDr ? 'background:#fff7e6;' : '');
            const kwColor = s.missing ? 'var(--text-hint)' : s.imputed ? '#1e5ab5' : 'var(--text)';
            const kwTip = s.imputed ? ` title="🔧 보정값 · ${s.imputeRule||''} · ${s.imputeReason||''}"` : '';
            let statusBadge;
            if(s.missing){
              statusBadge = '<span class="badge badge-fail" style="font-size:9px;">미수신</span>';
            } else if(s.imputed){
              statusBadge = `<span class="dm-imp-badge" title="${s.imputeReason||''}">🔧 보정(${s.imputeRule||'-'})</span>${inDr?' <span class="badge badge-pending" style="font-size:9px;margin-left:4px;">감축중</span>':''}`;
            } else if(inDr){
              statusBadge = '<span class="badge badge-pending" style="font-size:9px;">감축중</span>';
            } else {
              statusBadge = '<span class="badge badge-done" style="font-size:9px;">정상수신</span>';
            }
            return `<tr style="${rowBg}">
              <td style="font-weight:${inDr?'600':'normal'};">${s.time}${inDr?' ':''}</td>
              <td>${s.cbl.toFixed(1)}</td>
              <td${kwTip} style="font-weight:${s.missing?'normal':'600'};color:${kwColor};">${s.missing?'—':s.kw.toFixed(1)}${s.imputed?' <span style="font-size:9px;color:#1e5ab5;">🔧</span>':''}</td>
              <td style="color:${reduced===null?'var(--text-hint)':reduced>0?'var(--green)':'var(--text-sub)'};">${reduced===null?'—':reduced.toFixed(1)}</td>
              ${ev && custOrdered ? `
                <td style="color:${inDr?'var(--red)':'var(--text-hint)'};">${inDr?custOrdered.toFixed(0):'—'}</td>
                <td style="font-weight:${inDr?'700':'normal'};color:${slotRate===null?'var(--text-hint)':slotRate>=0.7?'var(--green)':slotRate>=0.3?'var(--amber)':'var(--red)'};">
                  ${slotRate===null?'—':Math.round(slotRate*100)+'%'}
                </td>
              ` : ''}
              <td>${statusBadge}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="dm-detail-note">
      <span><b>보정(imputed)</b> 슬롯은 PRD §5.2 누락데이터 자동보정 규칙에 따라 채워진 값으로, KPX 정산 투입은 가능하지만 원수신 데이터는 아닙니다.</span>
      ${ev ? `<span>감축 시간대 (${drStartHM}~${drEndHM}) · 윈도우 내 보정 ${drImputedInWin}개</span>` : ''}
      ${ev ? '<span>감축목표는 자원그룹 지시용량을 고객별 계약전력 비중으로 추정, 실제 정산은 KPX 집계 기준</span>' : ''}
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   ★ PAGE: 대시보드
════════════════════════════════════════════════════════════ */
