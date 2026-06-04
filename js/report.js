/* ════════════════════════════════════════════════════════════
   REPORT — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

const rpState = { tab:'events', from:null, to:null, drType:'all', stlFilter:'all', selectedEventId:null };

function rpInit(){
  // 기본 기간: 최근 3개월
  rpSetDefaultRange();
  // 타이틀 툴팁 주입 (한 번만)
  const t = $('rp-page-tip'); if(t && !t.innerHTML) t.innerHTML = tip('rp-page');
  rpRender();
}

function rpSetDefaultRange(){
  const today = new Date();
  const pad = n=>String(n).padStart(2,'0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const from = new Date(today.getFullYear(), today.getMonth()-2, 1);
  const to = new Date(today);
  rpState.from = fmt(from);
  rpState.to   = fmt(to);
  if($('rp-from')) $('rp-from').value = rpState.from;
  if($('rp-to'))   $('rp-to').value   = rpState.to;
}

function rpSyncRangeAndRender(){
  rpState.from = $('rp-from')?.value || '';
  rpState.to = $('rp-to')?.value || '';
  rpRender();
}

/* 대상 이벤트 추출 — 완료된 운영 감축 이벤트만 (등록시험·예정 제외) */
function rpCompletedEvents(){
  return store.events.reduction.filter(e =>
    !e.live && !e.scheduled && e.category==='operation' && e.settlement
  );
}
function rpFilteredEvents(){
  const from = $('rp-from')?.value || rpState.from;
  const to   = $('rp-to')?.value   || rpState.to;
  return rpCompletedEvents().filter(e=>{
    if(from && e.date < from) return false;
    if(to   && e.date > to)   return false;
    if(rpState.drType!=='all'){
      // 이벤트에 참여한 자원 중 해당 DR유형이 하나라도 있어야 함
      const hasType = (e.resources||[]).some(r=>{
        const g = groupById(r.groupId);
        return g && g.type===rpState.drType;
      });
      if(!hasType) return false;
    }
    if(rpState.stlFilter!=='all' && e.settlement.status !== rpState.stlFilter) return false;
    return true;
  }).sort((a,b)=> b.date.localeCompare(a.date));
}

/* 이벤트 집계 헬퍼 */
function rpEventAgg(ev){
  let ordered=0, actual=0;
  (ev.resources||[]).forEach(r=>{ ordered+=r.ordered||0; actual+=r.actual||0; });
  const rate = ordered>0 ? actual/ordered : 0;
  // 성능률 = Min(120%, rate) — 정산해설서 감축인정량 상한선 120%
  const perfRate = Math.min(1.2, rate);
  return { ordered, actual, rate, perfRate, resCount:(ev.resources||[]).length };
}

/* 정산 상태 배지 HTML — MVP 4단계 모델 */
// Phase 9: 라벨 정정 — 운영실적확정 책임 범위(데이터 입력→정산 대기 이관)에 맞춘 표현
function rpStlBadge(status){
  const map = {
    awaiting:    ['stl-pending',   'KPX 데이터 대기'],
    received:    ['stl-requested', '정산 대기'],
    in_progress: ['stl-received',  '정산 이관 (진행중)'],
    completed:   ['stl-completed', '정산 완료']
  };
  const [cls,label] = map[status] || ['stl-pending','-'];
  return `<span class="stl-badge ${cls}">${label}</span>`;
}
function rpStlLabel(status){
  return {awaiting:'KPX 데이터 대기', received:'정산 대기', in_progress:'정산 이관 (진행중)', completed:'정산 완료'}[status] || '-';
}
// 이벤트 목록에서 액션 버튼 라벨 — 상태별 행동 명확화 (Phase 9-A: B안 완전 분리)
function rpActionLabel(status){
  return {
    awaiting:    '확정 데이터 입력',
    received:    '확정 이력 확인',
    in_progress: '→ 정산관리로 이동',
    completed:   '→ 정산관리로 이동'
  }[status] || '확인';
}
/* 정산 소요일 계산 (이벤트 종료일 → 완료일 또는 현재) */
function rpSettlementDays(ev){
  const s = ev.settlement; if(!s) return null;
  const start = new Date(ev.date).getTime();
  const end = s.completedAt ? new Date(s.completedAt.substring(0,10)).getTime() : Date.now();
  return Math.max(0, Math.round((end-start)/86400000));
}

/* 메인 렌더 — MVP 4단계 기반 */
function rpRender(){
  const evs = rpFilteredEvents();
  let totalOrdered=0, totalActual=0;
  const cnt = {awaiting:0, received:0, in_progress:0, completed:0};
  evs.forEach(e=>{
    const a = rpEventAgg(e);
    totalOrdered += a.ordered; totalActual += a.actual;
    cnt[e.settlement.status] = (cnt[e.settlement.status]||0) + 1;
  });
  $('rp-kpi-events').textContent = evs.length;
  $('rp-kpi-reduction').textContent = (totalActual/1000).toFixed(1);
  $('rp-kpi-awaiting').textContent = cnt.awaiting;
  $('rp-kpi-received').textContent = cnt.received;
  $('rp-kpi-inprogress').textContent = cnt.in_progress;
  const fromV = $('rp-from')?.value || rpState.from;
  const toV   = $('rp-to')?.value   || rpState.to;
  $('rp-range-info').textContent = (fromV && toV) ? `${fromV} ~ ${toV}` : '';
  if(rpState.tab==='events') rpRenderEventsTab(evs);
  else if(rpState.tab==='resources') rpRenderResourcesTab(evs);
  else if(rpState.tab==='monthly') rpRenderMonthlyTab(evs);
}

function rpSwitchTab(tab){
  rpState.tab = tab;
  document.querySelectorAll('[data-rp-tab]').forEach(b=>b.classList.toggle('active', b.dataset.rpTab===tab));
  $('rp-tab-events').style.display    = tab==='events'    ? '' : 'none';
  $('rp-tab-resources').style.display = tab==='resources' ? '' : 'none';
  $('rp-tab-monthly').style.display   = tab==='monthly'   ? '' : 'none';
  rpRender();
}

/* ── 탭 1: 이벤트별 이행 결과 ── */
function rpRenderEventsTab(evs){
  const box = $('rp-tab-events');
  if(!evs.length){
    box.innerHTML = `<div class="empty">해당 조건의 종료된 이벤트가 없습니다.</div>`;
    return;
  }
  const rows = evs.map(e=>{
    const a = rpEventAgg(e);
    const rateCls = a.rate>=0.97 ? 'rate-green' : a.rate>=0.8 ? 'rate-amber' : 'rate-red';
    const dispLabel = e.dispatch_type==='MANDATORY_REDUCTION' ? '의무감축' : '자발적감축';
    const stlActive = ['received','in_progress','completed'].includes(e.settlement.status);
    const batchCell = stlActive
      ? `<button class="link" onclick="event.stopPropagation();navigate('settlement');setTimeout(()=>stmOpenDetail('${e.id}'),150);">STL-${e.id}</button>`
      : `<span style="color:var(--text-hint);font-size:10px;">확정 전</span>`;
    const s = e.settlement;
    const amount = s.finalAmount || s.ourAmount || 0;
    const days = rpSettlementDays(e);
    const daysCls = days>90 ? 'stg-diff-bad' : days>60 ? 'stg-diff-warn' : '';
    return `<tr class="clickable" onclick="rpOpenEvent('${e.id}')">
      <td><strong>${eventDisplayName(e)}</strong><div style="font-size:10px;color:var(--text-hint);margin-top:2px;">${eventDisplaySub(e)}</div></td>
      <td>${dispLabel}</td>
      <td class="num">${a.resCount}</td>
      <td class="num">${a.actual.toLocaleString()}</td>
      <td class="num"><span class="rate-pill ${rateCls}">${Math.round(a.rate*100)}%</span></td>
      <td>${rpStlBadge(s.status)}</td>
      <td>${batchCell}</td>
      <td class="num">${amount.toLocaleString()}</td>
      <td class="num ${daysCls}">${days}일</td>
      <td>${
        (e.settlement.status==='in_progress' || e.settlement.status==='completed')
          ? `<button class="link" onclick="event.stopPropagation();navigate('settlement');setTimeout(()=>stmOpenDetail('${e.id}'),150);">${rpActionLabel(e.settlement.status)}</button>`
          : `<button class="link" onclick="event.stopPropagation();rpOpenSettlement('${e.id}')">${rpActionLabel(e.settlement.status)}</button>`
      }</td>
    </tr>`;
  }).join('');
  box.innerHTML = `<table class="rp-table">
    <thead><tr>
      <th>이벤트</th><th>유형</th><th style="text-align:right;">자원</th>
      <th style="text-align:right;">실적(kW)</th>
      <th style="text-align:right;">이행률</th>
      <th>정산 상태</th><th>정산 ID</th>
      <th style="text-align:right;">정산금(KRW)</th>
      <th style="text-align:right;">소요일</th>
      <th>액션</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/* ── 탭 2: 자원별 집계 ── */
function rpRenderResourcesTab(evs){
  const box = $('rp-tab-resources');
  // 자원별 집계
  const agg = {};
  evs.forEach(e=>{
    (e.resources||[]).forEach(r=>{
      const g = groupById(r.groupId);
      if(!g) return;
      if(!agg[r.groupId]) agg[r.groupId] = {group:g, events:0, ordered:0, actual:0, pending:0};
      agg[r.groupId].events++;
      agg[r.groupId].ordered += r.ordered||0;
      agg[r.groupId].actual  += r.actual||0;
      // "pending" 컬럼의 의미: 아직 정산 완료가 아닌 진행 중 이벤트
      if(e.settlement.status !== 'completed') agg[r.groupId].pending++;
    });
  });
  const list = Object.values(agg).sort((a,b)=>b.actual-a.actual);
  if(!list.length){ box.innerHTML = `<div class="empty">해당 조건의 자원 집계 데이터가 없습니다.</div>`; return; }
  const rows = list.map(x=>{
    const rate = x.ordered>0 ? x.actual/x.ordered : 0;
    const rateCls = rate>=0.97 ? 'rate-green' : rate>=0.8 ? 'rate-amber' : 'rate-red';
    return `<tr>
      <td><strong>${x.group.name}</strong></td>
      <td>${x.group.type}</td>
      <td class="num">${x.events}</td>
      <td class="num">${x.ordered.toLocaleString()}</td>
      <td class="num">${x.actual.toLocaleString()}</td>
      <td class="num"><span class="rate-pill ${rateCls}">${Math.round(rate*100)}%</span></td>
      <td class="num">${x.pending}</td>
      <td><button class="link" onclick="rpDrillResource(${x.group.id})">참여고객 리포트</button></td>
    </tr>`;
  }).join('');
  box.innerHTML = `<table class="rp-table">
    <thead><tr>
      <th>자원그룹</th><th>유형</th>
      <th style="text-align:right;">참여 이벤트</th>
      <th style="text-align:right;">누적 지시(kW)</th>
      <th style="text-align:right;">누적 실적(kW)</th>
      <th style="text-align:right;">평균 이행률</th>
      <th style="text-align:right;">정산 대기</th>
      <th>액션</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/* ── 탭 3: 월별 요약 + 자원 랭킹 ── */
function rpRenderMonthlyTab(evs){
  const box = $('rp-tab-monthly');
  // 월별 집계
  const byMonth = {};
  evs.forEach(e=>{
    const ym = e.date.substring(0,7);
    if(!byMonth[ym]) byMonth[ym] = {events:0, ordered:0, actual:0};
    const a = rpEventAgg(e);
    byMonth[ym].events++; byMonth[ym].ordered += a.ordered; byMonth[ym].actual += a.actual;
  });
  const months = Object.keys(byMonth).sort();
  const maxActual = Math.max(1, ...months.map(m=>byMonth[m].actual));
  // 자원 랭킹 Top 5
  const resAgg = {};
  evs.forEach(e=>(e.resources||[]).forEach(r=>{
    if(!resAgg[r.groupId]) resAgg[r.groupId]={ordered:0,actual:0};
    resAgg[r.groupId].ordered += r.ordered||0;
    resAgg[r.groupId].actual  += r.actual||0;
  }));
  const ranking = Object.entries(resAgg).map(([gid,v])=>{
    const g = groupById(Number(gid)); if(!g) return null;
    return {g, ...v, rate:v.ordered>0?v.actual/v.ordered:0};
  }).filter(Boolean).sort((a,b)=>b.actual-a.actual).slice(0,5);

  // 정산 파이프라인 (4단계 기준)
  let awaitAmt=0, recvAmt=0, ipAmt=0, compAmt=0;
  evs.forEach(e=>{
    const s = e.settlement;
    const amt = s.finalAmount || s.ourAmount || 0;
    if(s.status==='awaiting') awaitAmt += amt;
    else if(s.status==='received') recvAmt += amt;
    else if(s.status==='in_progress') ipAmt += amt;
    else if(s.status==='completed') compAmt += (s.receivedFromKpx?.amount || amt);
  });

  const monthsHtml = months.length ? months.map(m=>{
    const v = byMonth[m];
    const rate = v.ordered>0 ? v.actual/v.ordered : 0;
    const width = maxActual>0 ? (v.actual/maxActual*100) : 0;
    return `<div class="rp-month-bar">
      <div class="rp-month-label">${m}</div>
      <div class="rp-month-track"><div class="rp-month-fill" style="width:${width}%;"></div></div>
      <div class="rp-month-val">${v.actual.toLocaleString()} kW (${v.events}건 · ${Math.round(rate*100)}%)</div>
    </div>`;
  }).join('') : `<div class="empty" style="padding:20px;">데이터 없음</div>`;

  const rankingHtml = ranking.length ? ranking.map((x,i)=>{
    return `<tr>
      <td style="width:40px;text-align:center;font-weight:600;color:${i<3?'var(--blue)':'var(--text-sub)'};">#${i+1}</td>
      <td><strong>${x.g.name}</strong> <span style="color:var(--text-hint);font-size:10px;">${x.g.type}</span></td>
      <td class="num">${x.actual.toLocaleString()}</td>
      <td class="num"><span class="rate-pill ${x.rate>=0.97?'rate-green':x.rate>=0.8?'rate-amber':'rate-red'}">${Math.round(x.rate*100)}%</span></td>
    </tr>`;
  }).join('') : `<tr><td colspan="4" style="text-align:center;color:var(--text-hint);padding:20px;">데이터 없음</td></tr>`;

  box.innerHTML = `
    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:14px;">
      <div class="rp-event-detail">
        <div style="font-weight:600;margin-bottom:10px;color:var(--navy);">월별 감축 실적</div>
        ${monthsHtml}
      </div>
      <div class="rp-event-detail">
        <div style="font-weight:600;margin-bottom:10px;color:var(--navy);">자원 랭킹 Top 5 (기간 누적 실적)</div>
        <table class="rp-table" style="border:none;">
          <thead><tr><th style="width:40px;"></th><th>자원</th><th style="text-align:right;">누적(kW)</th><th style="text-align:right;">이행률</th></tr></thead>
          <tbody>${rankingHtml}</tbody>
        </table>
      </div>
    </div>
    <div class="rp-event-detail" style="margin-top:12px;">
      <div style="font-weight:600;margin-bottom:10px;color:var(--navy);">정산 파이프라인 (기간 누적, 단계별 금액 기준)</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
        <div style="padding:14px;background:#f3f4f6;border-radius:var(--radius);">
          <div style="font-size:11px;color:#374151;">데이터 대기</div>
          <div style="font-size:18px;font-weight:700;color:#374151;margin-top:4px;">${awaitAmt.toLocaleString()} <span style="font-size:10px;font-weight:400;">KRW</span></div>
        </div>
        <div style="padding:14px;background:#dbeafe;border-radius:var(--radius);">
          <div style="font-size:11px;color:#1e40af;">정산 대기</div>
          <div style="font-size:18px;font-weight:700;color:#1e40af;margin-top:4px;">${recvAmt.toLocaleString()} <span style="font-size:10px;font-weight:400;">KRW</span></div>
        </div>
        <div style="padding:14px;background:#fef3c7;border-radius:var(--radius);">
          <div style="font-size:11px;color:#92400e;">정산 중</div>
          <div style="font-size:18px;font-weight:700;color:#92400e;margin-top:4px;">${ipAmt.toLocaleString()} <span style="font-size:10px;font-weight:400;">KRW</span></div>
        </div>
        <div style="padding:14px;background:#d1fae5;border-radius:var(--radius);">
          <div style="font-size:11px;color:#065f46;">정산 완료</div>
          <div style="font-size:18px;font-weight:700;color:#065f46;margin-top:4px;">${compAmt.toLocaleString()} <span style="font-size:10px;font-weight:400;">KRW</span></div>
        </div>
      </div>
    </div>
  `;
}

/* ══════ 이벤트 상세 모달 ══════ */
function rpOpenEvent(eventId){
  const ev = store.events.reduction.find(e=>e.id===eventId);
  if(!ev) return;
  rpState.selectedEventId = eventId;
  const a = rpEventAgg(ev);
  const dispLabel = ev.dispatch_type==='MANDATORY_REDUCTION' ? '의무감축' : '자발적감축';
  // 자원별 이행 테이블
  const resRows = (ev.resources||[]).map(r=>{
    const g = groupById(r.groupId);
    const rate = r.ordered>0 ? r.actual/r.ordered : 0;
    const perf = Math.min(1.2, rate);
    const rateCls = rate>=0.97 ? 'rate-green' : rate>=0.8 ? 'rate-amber' : 'rate-red';
    return `<tr>
      <td><strong>${g?.name || r.groupId}</strong></td>
      <td>${g?.type || '-'}</td>
      <td class="num">${r.ordered.toLocaleString()}</td>
      <td class="num">${(r.actual||0).toLocaleString()}</td>
      <td class="num"><span class="rate-pill ${rateCls}">${Math.round(rate*100)}%</span></td>
      <td class="num">${Math.round(perf*100)}%</td>
      <td><button class="link" onclick="rpViewCustomers('${ev.id}', ${r.groupId})">참여고객 상세</button></td>
    </tr>`;
  }).join('');

  $('re-title').innerHTML = `${eventDisplayName(ev)} <span style="font-weight:400;color:var(--text-hint);font-size:12px;">· ${ev.id} · ${dispLabel}</span>`;
  $('re-sub').textContent = '';

  // Phase 9-B: 상단 액션 버튼 — 상태별 분기 (정산 lifecycle 노출 X)
  const stStatus = ev.settlement.status;
  const slot = $('re-action-slot');
  if(slot){
    if(stStatus==='awaiting'){
      slot.innerHTML = `<button class="btn btn-primary btn-sm" onclick="closeModal('reEventModal');rpOpenSettlement('${ev.id}')">확정 데이터 입력</button>`;
    } else if(stStatus==='received'){
      slot.innerHTML = `<button class="btn btn-secondary btn-sm" onclick="closeModal('reEventModal');rpOpenSettlement('${ev.id}')">확정 이력 보기</button>`;
    } else { // in_progress / completed → 정산관리로 라우팅 (운영실적확정 책임 끝)
      slot.innerHTML = `<button class="btn btn-secondary btn-sm" onclick="closeModal('reEventModal');navigate('settlement');setTimeout(()=>stmOpenDetail('${ev.id}'),150);">→ 정산관리에서 보기</button>`;
    }
  }

  // Phase 9-B: re-meta — 확정 도메인 정보만 (정산 상태/ID/최종 확정금 등 정산 lifecycle 메타 제거)
  const confirmStateLabel = stStatus==='awaiting' ? 'KPX 데이터 대기' : '정산 대기 (확정 완료)';
  const confirmStateCls = stStatus==='awaiting' ? 'stl-pending' : 'stl-requested';
  $('re-meta').innerHTML = `
    <table class="rp-table" style="font-size:12px;">
      <tbody>
        <tr><th style="width:140px;text-align:left;background:#f8fafc;">발령원</th><td>${ev.source||'KPX'}</td>
            <th style="width:140px;text-align:left;background:#f8fafc;">발령유형</th><td>${dispLabel}</td></tr>
        <tr><th style="text-align:left;background:#f8fafc;">일시</th><td>${ev.date} ${ev.timeRange}</td>
            <th style="text-align:left;background:#f8fafc;">성능률</th><td>${Math.round(a.perfRate*100)}% <span style="color:var(--text-hint);font-size:10px;">(Min(120%, 이행률))</span></td></tr>
        <tr><th style="text-align:left;background:#f8fafc;">확정 상태</th><td colspan="3"><span class="stl-badge ${confirmStateCls}">${confirmStateLabel}</span></td></tr>
        <tr><th style="text-align:left;background:#f8fafc;">우리 측 예상 정산금</th><td colspan="3" style="font-weight:700;color:var(--navy);">${(ev.settlement.ourAmount||0).toLocaleString()} KRW</td></tr>
      </tbody>
    </table>
  `;
  $('re-res-body').innerHTML = resRows;
  $('re-cust-box').innerHTML = `<div class="empty" style="padding:20px;">위 "참여고객 상세"를 눌러 자원그룹별 이행 데이터를 확인하세요.</div>`;
  openModal('reEventModal');
}

function rpViewCustomers(eventId, groupId){
  const ev = store.events.reduction.find(e=>e.id===eventId);
  const g = groupById(groupId);
  const r = ev?.resources.find(x=>x.groupId===groupId);
  if(!ev || !g || !r){ showToast('데이터를 찾을 수 없습니다.'); return; }
  // 기존 monRenderCustTable 로직 재활용 (자원그룹 내 참여고객별 이행)
  const html = monRenderCustTable(r, g);
  $('re-cust-box').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <div style="font-weight:600;color:var(--navy);">${g.name} — 참여고객별 이행</div>
      <div style="font-size:11px;color:var(--text-hint);">지시 ${r.ordered.toLocaleString()}kW · 실적 ${(r.actual||0).toLocaleString()}kW</div>
      <div style="margin-left:auto;display:flex;gap:6px;">
        <button class="btn btn-secondary btn-sm rp-download-btn" onclick="rpExportCustomerCsv('${eventId}', ${groupId})">참여고객 리포트 CSV</button>
        <button class="btn btn-secondary btn-sm" onclick="rpOpenDataMonitor('${eventId}', ${groupId})">데이터 모니터링</button>
      </div>
    </div>
    ${html}
  `;
}

function rpOpenDataMonitor(eventId, groupId){
  // 기존 dmOpen 모달 재활용
  closeModal('reEventModal');
  dmOpen({ groupId: groupId, eventId: eventId });
}

/* 자원별 집계 탭 → 참여고객 리포트 요약 */
function rpDrillResource(groupId){
  const g = groupById(groupId);
  if(!g){ showToast('자원그룹을 찾을 수 없습니다.'); return; }
  const evs = rpFilteredEvents().filter(e => (e.resources||[]).some(r=>r.groupId===groupId));
  if(!evs.length){ showToast('해당 자원의 집계 대상 이벤트가 없습니다.'); return; }
  rpOpenResourceDetail(groupId, evs);
}

function rpOpenResourceDetail(groupId, evs){
  const g = groupById(groupId);
  if(!g) return;
  const rows = evs.map(ev=>{
    const r = (ev.resources||[]).find(x=>x.groupId===groupId);
    if(!r) return '';
    const rate = r.ordered>0 ? r.actual/r.ordered : 0;
    const rateCls = rate>=0.97 ? 'rate-green' : rate>=0.8 ? 'rate-amber' : 'rate-red';
    const dispLabel = ev.dispatch_type==='MANDATORY_REDUCTION' ? '의무감축' : '자발적감축';
    return `<tr>
      <td><strong>${eventDisplayName(ev)}</strong><div style="font-size:10px;color:var(--text-hint);margin-top:2px;">${ev.id}</div></td>
      <td>${ev.date} ${ev.timeRange}</td>
      <td>${dispLabel}</td>
      <td class="num">${(r.ordered||0).toLocaleString()}</td>
      <td class="num">${(r.actual||0).toLocaleString()}</td>
      <td class="num"><span class="rate-pill ${rateCls}">${Math.round(rate*100)}%</span></td>
      <td>${rpStlBadge(ev.settlement.status)}</td>
      <td><button class="link" onclick="rpViewResourceCustomers('${ev.id}', ${groupId})">참여고객 상세</button></td>
    </tr>`;
  }).join('');
  const ordered = evs.reduce((sum, ev)=>{
    const r = (ev.resources||[]).find(x=>x.groupId===groupId);
    return sum + (r?.ordered||0);
  }, 0);
  const actual = evs.reduce((sum, ev)=>{
    const r = (ev.resources||[]).find(x=>x.groupId===groupId);
    return sum + (r?.actual||0);
  }, 0);
  const rate = ordered>0 ? actual/ordered : 0;
  $('rr-title').textContent = `${g.name} 상세`;
  $('rr-sub').textContent = `${g.type} · 기간 내 참여 이벤트 ${evs.length}건`;
  $('rr-meta').innerHTML = `
    <table class="rp-table" style="font-size:12px;">
      <tbody>
        <tr>
          <th style="width:140px;text-align:left;background:#f8fafc;">자원유형</th><td>${g.type}</td>
          <th style="width:140px;text-align:left;background:#f8fafc;">참여고객</th><td>${(g.customers||[]).length}명</td>
        </tr>
        <tr>
          <th style="text-align:left;background:#f8fafc;">누적 지시(kW)</th><td>${ordered.toLocaleString()}</td>
          <th style="text-align:left;background:#f8fafc;">누적 실적(kW)</th><td>${actual.toLocaleString()}</td>
        </tr>
        <tr>
          <th style="text-align:left;background:#f8fafc;">평균 이행률</th><td colspan="3"><span class="rate-pill ${rate>=0.97?'rate-green':rate>=0.8?'rate-amber':'rate-red'}">${Math.round(rate*100)}%</span></td>
        </tr>
      </tbody>
    </table>
  `;
  $('rr-event-body').innerHTML = rows;
  $('rr-cust-box').innerHTML = `<div class="empty" style="padding:20px;">위 "참여고객 상세"를 눌러 이벤트별 참여고객 상세를 확인하세요.</div>`;
  $('rr-download-btn').onclick = () => rpExportResourceCsv(groupId, evs);
  openModal('reResourceModal');
}

function rpViewResourceCustomers(eventId, groupId){
  const ev = store.events.reduction.find(e=>e.id===eventId);
  const g = groupById(groupId);
  const r = ev?.resources.find(x=>x.groupId===groupId);
  if(!ev || !g || !r){ showToast('데이터를 찾을 수 없습니다.'); return; }
  const html = monRenderCustTable(r, g);
  $('rr-cust-box').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <div style="font-weight:600;color:var(--navy);">${eventDisplayName(ev)} — ${g.name} 참여고객 상세</div>
      <div style="font-size:11px;color:var(--text-hint);">지시 ${r.ordered.toLocaleString()}kW · 실적 ${(r.actual||0).toLocaleString()}kW</div>
      <div style="margin-left:auto;display:flex;gap:6px;">
        <button class="btn btn-secondary btn-sm rp-download-btn" onclick="rpExportCustomerCsv('${eventId}', ${groupId})">참여고객 리포트 CSV</button>
        <button class="btn btn-secondary btn-sm" onclick="closeModal('reResourceModal');dmOpen({ groupId:${groupId}, eventId:'${eventId}' });">데이터 모니터링</button>
      </div>
    </div>
    ${html}
  `;
}

/* ══════ CSV 내보내기 (참여고객 리포트 · KPX 수기 정산요청 보조) ══════ */
function rpCsvEscape(v){
  const s = String(v ?? '');
  if(s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g,'""')}"`;
  return s;
}
function rpDownloadCsv(filename, rows){
  // UTF-8 BOM + CRLF for Excel
  const bom = '\uFEFF';
  const csv = rows.map(r=>r.map(rpCsvEscape).join(',')).join('\r\n');
  const blob = new Blob([bom+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

/* 이벤트 × 자원그룹 → 참여고객별 CSV */
function rpExportCustomerCsv(eventId, groupId){
  const ev = store.events.reduction.find(e=>e.id===eventId);
  const g = groupById(groupId);
  const r = ev?.resources.find(x=>x.groupId===groupId);
  if(!ev||!g||!r) return;
  // monRenderCustTable 내부 로직과 동일한 계산 (고객별 지시·실적·이행률)
  const custIds = g.customerIds||[];
  const baseRate = r.ordered>0 ? r.actual/r.ordered : 0;
  const seed = r.groupId*137;
  const rand = i=>{ const s=Math.sin(seed*i+3)*10000; return s-Math.floor(s); };
  const raw = custIds.map((cid,i)=>{
    const c = custById(cid); if(!c) return null;
    const ordered = c.reduction||100;
    const rawV = Math.max(0.3, Math.min(1.0, baseRate + (rand(i)-0.5)*0.2));
    return {c, ordered, rawV};
  }).filter(Boolean);
  const rawSum = raw.reduce((s,x)=>s+x.ordered*x.rawV,0);
  const scale = rawSum>0 ? r.actual/rawSum : 1;
  const rows = [[
    '이벤트ID','감축일자','시간대','발령유형','자원그룹','DR유형',
    '고객ID','사업자명','대표자','전화','접수번호','한전고객번호',
    '지시용량(kW)','실적(kW)','이행률(%)','성능률(%)','판정(80%이상)','CBL유형','CBL평균(kW)'
  ]];
  raw.forEach(({c,ordered,rawV})=>{
    const actual = Math.round(ordered*rawV*scale);
    const rate = ordered>0 ? actual/ordered : 0;
    const perf = Math.min(1.2, rate);
    rows.push([
      ev.id, ev.date, ev.timeRange,
      ev.dispatch_type==='MANDATORY_REDUCTION'?'의무감축':'자발적감축',
      g.name, g.type,
      c.id, c.name, c.ceo||'', c.tel||'', c.recno||'', c.kepco||'',
      ordered, actual, Math.round(rate*100), Math.round(perf*100),
      rate>=0.8?'Y':'N', c.cblType||'-', c.cblAvg||'-'
    ]);
  });
  const fname = `참여고객리포트_${ev.id}_${g.name}_${ev.date}.csv`;
  rpDownloadCsv(fname, rows);
  showToast(`CSV 다운로드: ${fname}`);
}

/* 자원그룹 × 기간 → 이벤트별 집계 CSV */
function rpExportResourceCsv(groupId, evs){
  const g = groupById(groupId);
  if(!g) return;
  const rows = [[
    '자원그룹','DR유형','이벤트ID','감축일자','시간대','발령유형',
    '지시용량(kW)','실적(kW)','이행률(%)','성능률(%)',
    '정산상태','정산ID','예상정산금(우리)','최종확정(KPX)','수금액','수금일','이의제기','비고'
  ]];
  evs.forEach(ev=>{
    const r = ev.resources.find(x=>x.groupId===groupId); if(!r) return;
    const rate = r.ordered>0 ? r.actual/r.ordered : 0;
    const perf = Math.min(1.2, rate);
    const s = ev.settlement;
    const stlId = ['received','in_progress','completed'].includes(s.status) ? `STL-${ev.id}` : '';
    rows.push([
      g.name, g.type, ev.id, ev.date, ev.timeRange,
      ev.dispatch_type==='MANDATORY_REDUCTION'?'의무감축':'자발적감축',
      r.ordered, r.actual||0, Math.round(rate*100), Math.round(perf*100),
      rpStlLabel(s.status), stlId,
      s.ourAmount||'', s.finalAmount||'',
      s.receivedFromKpx?.amount||'', s.receivedFromKpx?.receivedAt||'',
      s.kpxData?.objection?.raised?'Y':'N', s.note||''
    ]);
  });
  const fname = `자원리포트_${g.name}_${rpState.from||''}_${rpState.to||''}.csv`;
  rpDownloadCsv(fname, rows);
  showToast(`CSV 다운로드: ${fname}`);
}

/* ══════ 정산 상태 관리 모달 — MVP 3단계 업무 플로우 ══════
   운영자 관점:
   ① 정산 시작(접수): KPX 정산기준 데이터 수신·등록 → 우리 운영리포트와 대사 → 이의제기 여부 결정 → 최종 기준 확정
   ② 정산 중      : KPX 수금 입력 → 참여고객 배분 플랜 생성(capacity 안분)
   ③ 정산 완료    : 배분 집행 상황을 배치 상세에서 관리 (운영리포트 모달에선 읽기 전용) */
function rpOpenSettlement(eventId){
  const ev = store.events.reduction.find(e=>e.id===eventId);
  if(!ev||!ev.settlement) return;
  rpState.selectedEventId = eventId;
  const s = ev.settlement;
  const a = rpEventAgg(ev);
  // Phase 9: 모달 제목·라벨 정정 (운영실적 확정 책임 명시)
  $('stl-title').innerHTML = `운영실적 확정 — ${ev.id}`;
  $('stl-sub').textContent = `${ev.date} ${ev.timeRange} · ${ev.dispatch_type==='MANDATORY_REDUCTION'?'의무감축':'자발적감축'} · 소요 ${rpSettlementDays(ev)}일`;

  // Phase 9-B: 운영실적확정의 책임 lifecycle만 노출 (2단계). 정산 lifecycle은 정산관리에서.
  const steps = ['awaiting','received'];
  const labels = {awaiting:'KPX 데이터 대기', received:'정산 대기 (확정 완료)'};
  const isAfterConfirm = ['received','in_progress','completed'].includes(s.status);
  const curIdx = s.status==='awaiting' ? 0 : 1;
  $('stl-flow').innerHTML = steps.map((st,i)=>{
    const cls = i<curIdx?'done':i===curIdx?'current':'';
    return `<span class="step ${cls}">${labels[st]}</span>${i<steps.length-1?'<span class="arrow">→</span>':''}`;
  }).join('');

  // 메타 요약 — 확정 도메인 정보만 (정산 ID·최종 정산금·수금·배분 등 정산 메타 제거)
  const confirmStateLabel = s.status==='awaiting' ? 'KPX 데이터 대기' : '정산 대기 (확정 완료)';
  const confirmStateCls = s.status==='awaiting' ? 'stl-pending' : 'stl-requested';
  $('stl-meta').innerHTML = `
    <div><div class="k">이벤트 실적 (우리 측)</div><div class="v">${a.actual.toLocaleString()}kW · 이행률 ${Math.round(a.rate*100)}%</div></div>
    <div><div class="k">확정 상태</div><div class="v"><span class="stl-badge ${confirmStateCls}">${confirmStateLabel}</span></div></div>
    <div><div class="k">우리 측 예상 정산금</div><div class="v">${(s.ourAmount||0).toLocaleString()} KRW</div></div>
  `;

  // 단계 클래스 (단계 ① 입력 · 단계 ② 참여고객 실적)
  if(s.status==='awaiting'){
    $('stl-stg1').className = 'stg-section active';
    $('stl-stg3').className = 'stg-section disabled';
  } else {
    $('stl-stg1').className = 'stg-section done';
    $('stl-stg3').className = 'stg-section done';
  }

  // Phase 9-D: 정산 관련 체크리스트 툴팁 제거 (운영실적확정 책임 외 항목이라 혼란 유발)

  // ── 단계 1 body: KPX 데이터 대사 ──
  const ev_ordered = a.ordered, ev_actual = a.actual;
  if(!s.kpxData){
    $('stl-stg1-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
        <div><label class="form-label">KPX 감축인정량 (kW)</label><input class="form-input" id="stl-k-kw" type="number" placeholder="${ev_actual}"></div>
        <div><label class="form-label">KPX 성능률 (%)</label><input class="form-input" id="stl-k-perf" type="number" step="0.1" placeholder="${Math.round(a.rate*100)}"></div>
        <div><label class="form-label">KPX 산정 정산금 (KRW)</label><input class="form-input" id="stl-k-amt" type="number" placeholder="${s.ourAmount||0}"></div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="rpRegisterKpxData()">확정 데이터 저장 → 정합성 검토</button>
      <div style="margin-top:8px;font-size:11px;color:var(--text-hint);">※ 저장 후 정합성 검증을 거치면 자동으로 <b>정산 대기</b> 상태로 전환됩니다.</div>
    `;
  } else {
    const k = s.kpxData;
    const diffClass = Math.abs(k.discrepancyPct)<1 ? 'stg-diff-ok' : Math.abs(k.discrepancyPct)<3 ? 'stg-diff-warn' : 'stg-diff-bad';
    $('stl-stg1-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
        <div class="stg-meta" style="grid-template-columns:1fr;">
          <div><div class="k">우리 측 (운영리포트)</div><div class="v">${(k.ourReductionKw||ev_actual).toLocaleString()} kW · 이행률 ${Math.round(a.rate*100)}%</div></div>
          <div><div class="k">예상 정산금</div><div class="v">${(s.ourAmount||0).toLocaleString()} KRW</div></div>
        </div>
        <div class="stg-meta" style="grid-template-columns:1fr;">
          <div><div class="k">KPX 제공 (수신 ${k.receivedAt})</div><div class="v">${(k.kpxReductionKw||0).toLocaleString()} kW · 성능률 ${Math.round((k.kpxPerformanceRate||0)*100)}%</div></div>
          <div><div class="k">KPX 산정 정산금</div><div class="v">${(k.kpxAmount||0).toLocaleString()} KRW</div></div>
        </div>
        <div class="stg-meta" style="grid-template-columns:1fr;">
          <div><div class="k">대사 결과 (우리-KPX)${tip('stl-discrepancy')}</div><div class="v ${diffClass}">${k.discrepancyKw>0?'+':''}${(k.discrepancyKw||0).toLocaleString()} kW (${k.discrepancyPct>0?'+':''}${(k.discrepancyPct||0).toFixed(2)}%)</div></div>
        </div>
      </div>
      <div class="form-row"><label class="form-label">이의 제기 여부</label>
        <div style="display:flex;gap:14px;align-items:center;font-size:12px;">
          <label><input type="radio" name="stl-obj" value="no" ${!k.objection?.raised?'checked':''}> 이의 없음 (KPX 기준 수용)</label>
          <label><input type="radio" name="stl-obj" value="yes" ${k.objection?.raised?'checked':''}> 이의 제기 진행</label>
        </div>
      </div>
      <div class="form-row" id="stl-obj-reason-box" style="${k.objection?.raised?'':'display:none;'}">
        <label class="form-label">이의 제기 사유 / 진행 메모</label>
        <textarea class="form-input" id="stl-obj-reason" rows="2" placeholder="예) C001 고객 15분 구간 4개에서 CBL 산정 오류 추정">${k.objection?.reason||''}</textarea>
      </div>
      <div class="form-row">
        <label class="form-label">최종 확정 정산금 (KRW) ${k.objection?.raised?'<span style="color:var(--amber);font-size:10px;">· 이의 해결 후 KPX 재통보값</span>':''}</label>
        <input class="form-input" id="stl-final-amt" type="number" value="${s.finalAmount || (k.objection?.raised?'':k.kpxAmount) || ''}" placeholder="${k.kpxAmount||0}">
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="rpSaveKpxDataPatch()">대사 · 이의 · 확정금액 저장</button>
        ${s.status==='awaiting' ? `<button class="btn btn-primary btn-sm" onclick="rpConfirmAndGoSettlement()">정합성 검증 완료 → 정산 대기 (자동 전환)</button>` : ''}
        ${s.status==='received' ? `<button class="btn btn-ghost btn-sm" onclick="rpOpenAmendData()">KPX 데이터 정정 (사유 입력)</button>` : ''}
      </div>
    `;
    // 라디오 change
    setTimeout(()=>{
      document.querySelectorAll('input[name="stl-obj"]').forEach(r=>{
        r.addEventListener('change', ()=>{
          $('stl-obj-reason-box').style.display = r.value==='yes' && r.checked ? '' : $('stl-obj-reason-box').style.display;
          const yesChecked = document.querySelector('input[name="stl-obj"]:checked')?.value==='yes';
          $('stl-obj-reason-box').style.display = yesChecked?'':'none';
        });
      });
    },0);
  }

  // Phase 9-B: 모달 푸터 안내 영역 — 단계가 아닌 라우팅 안내만 (운영실적확정 책임 명시적 종료)
  if(s.status==='awaiting'){
    // 아직 KPX 데이터 입력 안 한 상태 — 안내 표시 X (입력에 집중)
    $('stl-stg2-body').innerHTML = '';
  } else {
    $('stl-stg2-body').innerHTML = `
      <div style="padding:14px 16px;background:#f0f7ff;border:1px solid #c8ddfc;border-radius:8px;display:flex;align-items:center;gap:14px;">
        <div style="flex:1;font-size:12px;line-height:1.6;color:var(--text);">
          <div style="font-weight:600;color:var(--navy);margin-bottom:2px;">✓ 확정 데이터 등록 완료</div>
          정산금 수금·참여고객 배분 등 정산 진행 정보는 <b>[고객정산관리]</b> 메뉴에서 확인하세요.
        </div>
        <button class="btn btn-primary btn-sm" onclick="rpGoToSettlement()" style="flex-shrink:0;">→ 정산관리로 이동</button>
      </div>
    `;
  }

  // ── 단계 3 body: 참여고객 실적 (확정 후 잠금) — Phase 9 FIX-F ──
  // ev.resources를 기반으로 자원그룹별 + 그 안의 참여고객(있으면) 실적 표 생성
  const resources = Array.isArray(ev.resources) ? ev.resources : [];
  if(resources.length === 0){
    $('stl-stg3-body').innerHTML = `<div style="font-size:11px;color:var(--text-hint);padding:8px 0;">참여 자원 데이터가 없습니다.</div>`;
  } else {
    const totalOrd = resources.reduce((s,r)=>s+(r.ordered||0), 0);
    const totalAct = resources.reduce((s,r)=>s+(r.actual||0), 0);
    const totalRate = totalOrd>0 ? (totalAct/totalOrd) : 0;
    const rowsHtml = resources.map(r=>{
      const rate = (r.actual!=null && r.ordered>0) ? (r.actual/r.ordered) : 0;
      const rateCls = rate>=0.97 ? 'rate-green' : rate>=0.9 ? 'rate-amber' : rate>=0.7 ? 'rate-amber' : 'rate-red';
      const stateTxt = r.status==='FAILED' ? '데이터 미수신' : r.status==='DELAYED' ? '데이터 지연' : (rate>=0.9 ? '정상' : rate>=0.7 ? '주의' : '이상');
      const stateBadgeCls = (r.status==='FAILED'||r.status==='DELAYED'||rate<0.7) ? 'badge-reject' : (rate<0.9 ? 'badge-pending' : 'badge-done');
      const g = (typeof store!=='undefined' && Array.isArray(store.groups)) ? store.groups.find(x=>x.id===r.groupId) : null;
      const gName = g ? g.name : `자원그룹 ${r.groupId||'-'}`;
      const gType = g?.type || '-';
      return `<tr>
        <td><strong>${gName}</strong><div style="font-size:10px;color:var(--text-hint);">${gType}</div></td>
        <td class="num">${(r.ordered||0).toLocaleString()}</td>
        <td class="num">${(r.actual||0).toLocaleString()}</td>
        <td class="num"><span class="rate-pill ${rateCls}">${Math.round(rate*100)}%</span></td>
        <td><span class="badge ${stateBadgeCls}">${stateTxt}</span></td>
      </tr>`;
    }).join('');
    // Phase 9-D: '확정 후 잠금' 표기 제거 (감축모니터링에서 자동 수집된 데이터라 의미 없는 표현)
    $('stl-stg3-body').innerHTML = `
      <div style="font-size:11px;color:var(--text-hint);margin-bottom:8px;">자원그룹 단위 이행 실적 (감축모니터링 메터링 데이터)</div>
      <table class="rp-table" style="margin-top:0;">
        <thead><tr>
          <th>자원그룹</th>
          <th style="text-align:right;">지시(kW)</th>
          <th style="text-align:right;">실적(kW)</th>
          <th style="text-align:right;">이행률</th>
          <th>상태</th>
        </tr></thead>
        <tbody>${rowsHtml}
          <tr style="background:var(--grey50);font-weight:600;">
            <td>합계</td>
            <td class="num">${totalOrd.toLocaleString()}</td>
            <td class="num">${totalAct.toLocaleString()}</td>
            <td class="num">${Math.round(totalRate*100)}%</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  // 이력
  $('stl-history-list').innerHTML = (s.history||[]).map(h=>{
    const arrow = (h.fromStatus?rpStlLabel(h.fromStatus):'·') + ' → ' + rpStlLabel(h.toStatus);
    return `<div class="stl-history-item">
      <div class="time">${h.at}</div>
      <div class="text"><strong>${h.user}</strong> · ${arrow}<div style="color:var(--text-hint);font-size:10px;margin-top:2px;">${h.note||''}</div></div>
    </div>`;
  }).join('') || `<div style="color:var(--text-hint);font-size:11px;">이력 없음</div>`;

  openModal('stlModal');
}

/* 단계 1 액션 */
function rpRegisterKpxData(){
  const ev = store.events.reduction.find(e=>e.id===rpState.selectedEventId);
  if(!ev||!ev.settlement) return;
  const kwV = Number($('stl-k-kw').value || 0);
  const perfV = Number($('stl-k-perf').value || 0)/100;
  const amtV = Number($('stl-k-amt').value || 0);
  if(!kwV || !amtV){ showToast('KPX 감축인정량과 정산금을 입력하세요.'); return; }
  const a = rpEventAgg(ev);
  const ourKw = a.actual;
  const dKw = ourKw - kwV;
  const dPct = kwV>0 ? (dKw/kwV*100) : 0;
  ev.settlement.kpxData = {
    receivedAt: todayStr(),
    kpxReductionKw: kwV, kpxPerformanceRate: perfV,
    kpxAmount: amtV,
    ourReductionKw: ourKw, discrepancyKw: dKw, discrepancyPct: Number(dPct.toFixed(2)),
    objection:{raised: Math.abs(dPct)>3, reason:'', finalAmount: Math.abs(dPct)>3 ? null : amtV}
  };
  ev.settlement.finalAmount = Math.abs(dPct)>3 ? null : amtV;
  const prev = ev.settlement.status;
  ev.settlement.status = 'received';
  ev.settlement.history.push({at:nowStr(), user:'현진영', fromStatus:prev, toStatus:'received', note:`KPX 정산기준 데이터 등록 · 대사 차이 ${dPct.toFixed(2)}%${Math.abs(dPct)>3?' · 이의제기 대상':''}`});
  rpOpenSettlement(ev.id);
  refreshSidebarBadges();
  rpRender();
  showToast(`KPX 확정 데이터 저장 완료 · 정합성 검토 단계로 이동`);
}
function rpSaveKpxDataPatch(){
  const ev = store.events.reduction.find(e=>e.id===rpState.selectedEventId);
  if(!ev?.settlement?.kpxData) return;
  const objYes = document.querySelector('input[name="stl-obj"]:checked')?.value==='yes';
  ev.settlement.kpxData.objection = {
    raised: objYes,
    reason: objYes ? ($('stl-obj-reason')?.value || '') : '',
    finalAmount: objYes ? null : ev.settlement.kpxData.kpxAmount
  };
  const finalV = Number($('stl-final-amt').value || 0);
  if(finalV>0){
    ev.settlement.finalAmount = finalV;
    ev.settlement.kpxData.objection.finalAmount = finalV;
  }
  ev.settlement.history.push({at:nowStr(), user:'현진영', fromStatus:ev.settlement.status, toStatus:ev.settlement.status, note:`대사 저장 · 이의 ${objYes?'제기':'없음'} · 최종 ${(ev.settlement.finalAmount||0).toLocaleString()} KRW`});
  rpOpenSettlement(ev.id);
  showToast('대사 정보 저장');
}
/* 정합성 검증 완료 → 정산관리 이관 */
function rpConfirmAndGoSettlement(){
  const ev = store.events.reduction.find(e=>e.id===rpState.selectedEventId);
  if(!ev?.settlement || !ev.settlement.kpxData) return;
  const s = ev.settlement;
  if(!s.finalAmount){
    showToast('최종 확정 정산금을 먼저 입력·저장하세요.');
    return;
  }
  const prev = s.status;
  s.status = 'received';
  s.confirmedAt = nowStr();
  s.confirmedBy = '현진영';
  s.history.push({at:nowStr(), user:'현진영', fromStatus:prev, toStatus:'received', note:`정합성 검증 완료 · 확정 정산금 ${(s.finalAmount||0).toLocaleString()} KRW · 정산관리 이관`});
  closeModal('stlModal');
  refreshSidebarBadges();
  rpRender();
  showToast('정합성 검증 완료 — 정산관리로 이동합니다');
  navigate('settlement');
  setTimeout(()=>stmOpenDetail(ev.id), 200);
}

/* 운영리포트에서 정산관리 열기 (confirmed 이후) */
function rpGoToSettlement(){
  const ev = store.events.reduction.find(e=>e.id===rpState.selectedEventId);
  if(!ev) return;
  closeModal('stlModal');
  navigate('settlement');
  setTimeout(()=>stmOpenDetail(ev.id), 200);
}

// Phase 9-E: 정정 정책 — 사유 입력 다이얼로그 (received 상태에서만 가능)
function rpOpenAmendData(){
  const ev = store.events.reduction.find(e=>e.id===rpState.selectedEventId);
  if(!ev?.settlement) return;
  // 정산관리 진행 중/완료된 건 운영실적확정에서 정정 불가
  if(ev.settlement.status !== 'received'){
    showToast('정산관리 진행 또는 완료된 건은 운영실적확정에서 정정할 수 없습니다.');
    return;
  }
  $('cm-title').textContent = 'KPX 확정 데이터 정정';
  $('cm-sub').textContent   = `${eventDisplayName(ev)} · ${ev.id}`;
  $('cm-body').innerHTML = `
    <div class="form-row">
      <label class="form-label">정정 사유 <span style="color:var(--red);">*</span></label>
      <textarea class="form-input" id="rp-amend-reason" rows="4"
        placeholder="예) KPX가 감축인정량 정정 통보 (15:30 미터 누락 보정 / 2024-09-15)"></textarea>
    </div>
    <div style="margin-top:14px;padding:12px 14px;background:#fff5f5;border:1px solid #ffd6d6;border-radius:8px;display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:16px;line-height:1;color:var(--red);flex-shrink:0;">⚠️</span>
      <div style="font-size:12px;color:var(--red);line-height:1.7;">
        <b>정정 시 진행 중인 정산은 초기화 됩니다.</b><br>
        <span style="color:var(--text-sub);font-weight:400;">
          현재 입력된 KPX 데이터·정산 대기 상태가 모두 해제되고
          'KPX 데이터 대기' 상태로 되돌아갑니다. 이 작업은 감사 로그에 기록됩니다.
        </span>
      </div>
    </div>
  `;
  $('cm-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-danger" onclick="rpConfirmAmendData()">정정 확정</button>
  `;
  openModal('commonModal');
}

function rpConfirmAmendData(){
  const ev = store.events.reduction.find(e=>e.id===rpState.selectedEventId);
  if(!ev?.settlement) return;
  if(ev.settlement.status !== 'received'){
    showToast('정정 가능한 상태가 아닙니다.');
    closeModal('commonModal');
    return;
  }
  const reason = ($('rp-amend-reason')?.value || '').trim();
  if(!reason){ showToast('정정 사유를 입력하세요.'); return; }
  const prev = ev.settlement.status;
  ev.settlement.kpxData = null;
  ev.settlement.finalAmount = null;
  ev.settlement.confirmedAt = null;
  ev.settlement.confirmedBy = '';
  ev.settlement.status = 'awaiting';
  ev.settlement.history.push({at:nowStr(), user:'현진영', fromStatus:prev, toStatus:'awaiting', note:`KPX 데이터 정정 · 사유: ${reason}`});
  // 통합 감사 로그(audit logs)에도 기록
  if(typeof logAudit === 'function'){
    logAudit({
      objectType:'settlement',
      objectId: ev.id,
      action:'data_amended',
      title:'KPX 확정 데이터 정정',
      desc: reason,
      actor:'현진영',
      tone:'wait'
    });
  }
  closeModal('commonModal');
  rpOpenSettlement(ev.id);
  refreshSidebarBadges();
  rpRender();
  showToast('정정 처리 완료 · KPX 데이터 대기 상태로 되돌아갔습니다.');
}

// 구버전 호환 — 외부 onclick에서 rpResetKpxData를 직접 호출하던 코드가 있다면 새 흐름으로 라우팅
function rpResetKpxData(){ rpOpenAmendData(); }

/* ════════════════════════════════════════════════════════════
   ★ PAGE: 정산관리 (이벤트 단위 정산)
   - 월별 배치 폐기 → 이벤트 1건당 정산 1건 (STL-{eventId})
   - 운영리포트에서 정합성 검증 완료된 이벤트만 조회
   - 상태: received(입금대기) → in_progress(배분중) → completed
   - 기능: 기간 필터 · 수기 입금 · 자동 안분 · 패널티 수기 차감 · 고객 이체 체크
════════════════════════════════════════════════════════════ */
