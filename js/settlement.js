/* ════════════════════════════════════════════════════════════
   SETTLEMENT — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

const stmState = {
  period: '3m',
  from: null, to: null,
  statusFilter: 'all',
  typeFilter: 'all',
  search: '',
  searchScope: 'all',  // Phase 11-A: 검색 범위 초기값 명시
  selectedEventId: null,
  penaltyTargetCustomerId: null,
};

// Phase 11-B: KPI 카드 클릭 → 해당 상태 필터링 (status 필터 선택 + 리스트 영역으로 스크롤)
function stmFilterByStatus(status){
  stmState.statusFilter = status || 'all';
  if($('stm-status-filter')) $('stm-status-filter').value = stmState.statusFilter;
  stmRender();
  // 리스트 영역으로 스크롤 — KPI를 위로 올린 만큼 리스트가 화면 아래에 있어서
  setTimeout(()=>{
    const body = document.getElementById('stm-list-body');
    if(body && typeof body.scrollIntoView==='function'){
      body.scrollIntoView({behavior:'smooth', block:'start'});
    }
  }, 50);
}

function stmInit(){
  stmApplyPeriodRange();
  stmRender();
}

function stmApplyPeriodRange(){
  const today = new Date();
  const y=today.getFullYear(), m=today.getMonth(), d=today.getDate();
  const fmt = dt => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  let from=null, to=null;
  switch(stmState.period){
    case '3m': from = fmt(new Date(y,m-3,d)); to=fmt(today); break;
    case '6m': from = fmt(new Date(y,m-6,d)); to=fmt(today); break;
    case 'ytd': from = `${y}-01-01`; to=fmt(today); break;
    case '1y': from = fmt(new Date(y-1,m,d)); to=fmt(today); break;
    case 'all': from=null; to=null; break;
    case 'custom': from=$('stm-from').value||null; to=$('stm-to').value||null; break;
  }
  stmState.from=from; stmState.to=to;
  if($('stm-from')) $('stm-from').value = from||'';
  if($('stm-to')) $('stm-to').value = to||'';
}

function stmChangePeriod(v){
  stmState.period = v;
  const showCustom = v==='custom';
  $('stm-from').style.display = showCustom ? '' : 'none';
  $('stm-to').style.display = showCustom ? '' : 'none';
  $('stm-date-sep').style.display = showCustom ? '' : 'none';
  stmApplyPeriodRange();
  stmRender();
}

function stmSyncFilters(){
  stmState.statusFilter = $('stm-status-filter')?.value || 'all';
  stmState.typeFilter = $('stm-type-filter')?.value || 'all';
  stmState.search = $('stm-search')?.value || '';
  // Phase 11-A: 검색 범위 — 'all'(전체) | 'event' | 'group' | 'customer'
  stmState.searchScope = $('stm-search-scope')?.value || 'all';
  if(stmState.period==='custom'){
    stmState.from = $('stm-from')?.value || null;
    stmState.to = $('stm-to')?.value || null;
  }
}

function stmRunQuery(){
  stmSyncFilters();
  stmRender();
}

function stmResetFilters(){
  stmState.period = '3m';
  stmState.statusFilter = 'all';
  stmState.typeFilter = 'all';
  stmState.search = '';
  stmState.searchScope = 'all';
  if($('stm-period')) $('stm-period').value = '3m';
  if($('stm-status-filter')) $('stm-status-filter').value = 'all';
  if($('stm-type-filter')) $('stm-type-filter').value = 'all';
  if($('stm-search')) $('stm-search').value = '';
  if($('stm-search-scope')) $('stm-search-scope').value = 'all';
  stmChangePeriod('3m');
}

/* 정산관리에 노출되는 이벤트: 정합성 확정(received) 이후만
   Phase 11 — 4단계 lifecycle:
   received   = 정산대기         (확정데이터 기입 상태)
   invoiced   = 세금계산서 발행   (참여고객들과 최종 정산금 확인·확정)
   in_progress= 입금 진행         (세금계산서 금액을 통장으로 입금 중)
   completed  = 정산완료         (모든 참여고객에게 입금 완료) */
function stmEligibleEvents(){
  return store.events.reduction.filter(e=>{
    if(!e.settlement) return false;
    const st = e.settlement.status;
    return st==='received' || st==='invoiced' || st==='in_progress' || st==='completed';
  });
}

function stmFilteredEvents(){
  const q = (stmState.search||'').toLowerCase().trim();
  return stmEligibleEvents().filter(e=>{
    // 기간
    if(stmState.from && e.date < stmState.from) return false;
    if(stmState.to && e.date > stmState.to) return false;
    // 상태
    if(stmState.statusFilter !== 'all' && e.settlement.status !== stmState.statusFilter) return false;
    // DR 유형
    if(stmState.typeFilter !== 'all' && e.dispatch_type !== stmState.typeFilter) return false;
    // Phase 11-A: 검색 — 범위 select 기준으로 분기
    if(q){
      const scope = stmState.searchScope || 'all';
      const matchEvent = () => e.id.toLowerCase().includes(q) || eventDisplayName(e).toLowerCase().includes(q);
      const matchGroup = () => (e.resources||[]).some(r=>{
        const g = (typeof groupById==='function') ? groupById(r.groupId) : null;
        return g && (g.name||'').toLowerCase().includes(q);
      });
      const matchCustomer = () => {
        const custs = (e.settlement.customerDistribution||[]);
        if(custs.some(c=>(c.customerName||'').toLowerCase().includes(q))) return true;
        // 배분 데이터가 없어도 자원그룹 customerIds → custById로 매칭
        return (e.resources||[]).some(r=>{
          const g = (typeof groupById==='function') ? groupById(r.groupId) : null;
          if(!g) return false;
          return (g.customerIds||[]).some(cid=>{
            const c = (typeof custById==='function') ? custById(cid) : null;
            return c && (c.name||'').toLowerCase().includes(q);
          });
        });
      };
      let match = false;
      if(scope==='event')        match = matchEvent();
      else if(scope==='group')   match = matchGroup();
      else if(scope==='customer')match = matchCustomer();
      else /* all */             match = matchEvent() || matchGroup() || matchCustomer();
      if(!match) return false;
    }
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date));
}

/* 이벤트에서 참여고객 목록 추출 (자원그룹→고객) */
function stmEventCustomers(ev){
  const list = [];
  const seen = new Set();
  ev.resources.forEach(r=>{
    const g = groupById(r.groupId); if(!g) return;
    (g.customerIds||[]).forEach(cid=>{
      if(seen.has(cid)) return;
      seen.add(cid);
      const c = custById(cid);
      if(c) list.push({id:cid, name:c.name, reduction:c.reduction||100, groupId:g.id, groupName:g.name});
    });
  });
  return list;
}

/* 배분 상태 라벨 — Phase 11 4단계 lifecycle */
function stmStatusBadge(status){
  const map = {
    received:    ['stl-pending',   '정산대기'],
    invoiced:    ['stl-requested', '세금계산서 발행'],
    in_progress: ['stl-received',  '입금 진행'],
    completed:   ['stl-completed', '정산완료']
  };
  const [cls,label] = map[status] || ['stl-pending','-'];
  return `<span class="stl-badge ${cls}">${label}</span>`;
}
function stmStatusLabel(status){
  return ({received:'정산대기', invoiced:'세금계산서 발행', in_progress:'입금 진행', completed:'정산완료'})[status] || '-';
}

/* 소요일 */
function stmDays(ev){
  const s = ev.settlement; if(!s) return 0;
  const start = new Date(ev.date).getTime();
  const end = s.completedAt ? new Date(s.completedAt.substring(0,10)).getTime() : Date.now();
  return Math.max(0, Math.round((end-start)/86400000));
}

function stmRender(){
  try {
    stmSyncFilters();
  } catch(err){ console.error('[stmRender] stmSyncFilters 실패:', err); }
  let evs = [];
  try {
    evs = stmFilteredEvents();
  } catch(err){
    console.error('[stmRender] stmFilteredEvents 실패:', err);
    const body = document.getElementById('stm-list-body');
    if(body) body.innerHTML = `<div class="empty" style="padding:40px;text-align:center;color:var(--red);">데이터 조회 중 오류가 발생했습니다. 브라우저 콘솔을 확인해 주세요.</div>`;
    return;
  }

  // KPI — Phase 11 4단계 (정산대기 / 세금계산서 / 입금 진행 / 정산완료)
  const total = evs.length;
  const pending = evs.filter(e=>e.settlement.status==='received').length;
  const invoiced = evs.filter(e=>e.settlement.status==='invoiced').length;
  const inprog = evs.filter(e=>e.settlement.status==='in_progress').length;
  const done = evs.filter(e=>e.settlement.status==='completed').length;
  const amtSum = evs.reduce((s,e)=>s+(e.settlement.finalAmount||0),0);
  $('stm-kpi-total').textContent = total;
  $('stm-kpi-pending').textContent = pending;
  if($('stm-kpi-invoiced')) $('stm-kpi-invoiced').textContent = invoiced;
  $('stm-kpi-inprog').textContent = inprog;
  $('stm-kpi-done').textContent = done;
  $('stm-kpi-amt').textContent = amtSum.toLocaleString();

  // 범위 정보
  const from = stmState.from, to = stmState.to;
  $('stm-range-info').textContent = (from&&to) ? `${from} ~ ${to}` : '전체 기간';

  // 리스트
  const body = $('stm-list-body');
  if(!evs.length){
    body.innerHTML = `<div class="empty" style="padding:40px;text-align:center;color:var(--text-hint);">해당 조건의 정산 항목이 없습니다.</div>`;
    return;
  }

  // Phase 11-E: 행별 try/catch로 한 이벤트 에러가 전체 렌더링을 멈추지 않게 격리
  const rowsArr = [];
  evs.forEach(e=>{
    try {
      const s = e.settlement || {};
      const dispLabel = e.dispatch_type==='MANDATORY_REDUCTION' ? '의무감축' : '자발적감축';
      const custs = Array.isArray(s.customerDistribution) ? s.customerDistribution : [];
      let totalCust = custs.length;
      if(!totalCust){
        try { totalCust = (stmEventCustomers(e)||[]).length; } catch(err){ totalCust = 0; }
      }
      const transferred = custs.filter(d=>d.transferredAt).length;
      const custProgress = totalCust ? `${transferred}/${totalCust}` : '-';
      const recv = s.receivedFromKpx && s.receivedFromKpx.amount;
      const recvCell = recv ? `${Number(recv).toLocaleString()}` : `<span style="color:var(--text-hint);">미입금</span>`;
      let days = 0;
      try { days = stmDays(e) || 0; } catch(err){ days = 0; }
      const daysCls = days>90 ? 'stg-diff-bad' : days>60 ? 'stg-diff-warn' : '';
      let titleHtml = e.id;
      try { titleHtml = eventDisplayName(e); } catch(err){ /* fallback to id */ }
      rowsArr.push(`<tr class="clickable" onclick="stmOpenDetail('${e.id}')">
        <td><strong>${titleHtml}</strong><div style="font-size:10px;color:var(--text-hint);margin-top:2px;">STL-${e.id} · ${e.date||''} ${e.timeRange||''}</div></td>
        <td>${dispLabel}</td>
        <td>${stmStatusBadge(s.status)}</td>
        <td class="num">${Number(s.finalAmount||0).toLocaleString()}</td>
        <td class="num">${recvCell}</td>
        <td class="num">${custProgress}</td>
        <td class="num ${daysCls}">${days}일</td>
        <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();stmOpenDetail('${e.id}')">상세</button></td>
      </tr>`);
    } catch(err){
      console.error('[stmRender] 행 렌더 실패:', e?.id, err);
      rowsArr.push(`<tr><td colspan="8" style="color:var(--red);font-size:11px;padding:8px 12px;">[렌더 오류] ${e?.id||'-'} — 콘솔 참조</td></tr>`);
    }
  });

  body.innerHTML = `
    <table class="rp-table">
      <thead><tr>
        <th>정산 ID · 이벤트</th>
        <th>유형</th>
        <th>상태</th>
        <th style="text-align:right;">확정 정산금</th>
        <th style="text-align:right;">수금액</th>
        <th style="text-align:center;">고객배분</th>
        <th style="text-align:right;">소요일</th>
        <th>액션</th>
      </tr></thead>
      <tbody>${rowsArr.join('')}</tbody>
    </table>
  `;
}

/* ══════ 정산 상세 모달 ══════ */
function stmOpenDetail(eventId){
  const ev = store.events.reduction.find(e=>e.id===eventId);
  if(!ev || !ev.settlement){ showToast('정산 대상이 아닙니다.'); return; }
  const s = ev.settlement;
  if(s.status==='awaiting'){
    showToast('운영리포트에서 정합성 검증 완료 후 이용 가능합니다.');
    navigate('report');
    setTimeout(()=>rpOpenSettlement(eventId), 200);
    return;
  }
  stmState.selectedEventId = eventId;

  const dispLabel = ev.dispatch_type==='MANDATORY_REDUCTION' ? '의무감축' : '자발적감축';
  $('stmd-title').textContent = eventDisplayName(ev);
  $('stmd-sub').textContent = `STL-${ev.id} · ${dispLabel} · ${ev.date} ${ev.timeRange}`;

  // 플로우
  const steps = ['received','invoiced','in_progress','completed'];
  const labels = {received:'정산대기', invoiced:'세금계산서 발행', in_progress:'입금 진행', completed:'정산완료'};
  const curIdx = steps.indexOf(s.status);
  $('stmd-flow').innerHTML = steps.map((st,i)=>{
    const cls = i<curIdx?'done':i===curIdx?'current':'';
    return `<span class="step ${cls}">${labels[st]}</span>${i<steps.length-1?'<span class="arrow">→</span>':''}`;
  }).join('');

  // 운영리포트 확정 데이터 (참조)
  const custs = stmEventCustomers(ev);
  const totalActual = (ev.resources||[]).reduce((s,r)=>s+(r.actual||0),0);
  const totalOrdered = (ev.resources||[]).reduce((s,r)=>s+(r.ordered||0),0);
  const rate = totalOrdered>0 ? totalActual/totalOrdered : 0;
  $('stmd-confirmed').innerHTML = `
    <div class="rp-event-meta-item"><div class="k">참여 자원 · 고객</div><div class="v">${ev.resources.length}개 자원 · ${custs.length}명 고객</div></div>
    <div class="rp-event-meta-item"><div class="k">실 감축 / 이행률</div><div class="v">${totalActual.toLocaleString()} kW · ${Math.round(rate*100)}%</div></div>
    <div class="rp-event-meta-item"><div class="k">KPX 확정 정산금</div><div class="v" style="font-weight:700;color:var(--navy);">${(s.finalAmount||0).toLocaleString()} KRW</div></div>
    <div class="rp-event-meta-item"><div class="k">정합성 확정</div><div class="v">${s.confirmedAt||'-'} / ${s.confirmedBy||'-'}</div></div>
  `;

  // 단계 ① 실 정산 입금
  stmRenderPayment(ev);

  // 단계 ② 배분
  stmRenderDistribution(ev);

  // 단계 ③ 고객별 진행
  stmRenderProgress(ev);

  // 액션
  stmRenderActions(ev);

  // 이력
  const history = s.history||[];
  $('stmd-history').innerHTML = history.length
    ? history.map(h=>`<div class="history-item"><span class="history-time">${h.at}</span> <span class="history-user">${h.user}</span> <span class="history-note">${h.note}</span></div>`).join('')
    : `<div class="empty" style="padding:10px;color:var(--text-hint);">이력 없음</div>`;

  openModal('stmDetailModal');
}

/* 단계 ① 실 정산 입금 */
function stmRenderPayment(ev){
  const s = ev.settlement;
  const box = $('stmd-payment');
  if(!s.receivedFromKpx){
    box.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
        <div><label class="form-label">수금일</label><input type="date" class="form-input" id="stmd-pay-date"></div>
        <div><label class="form-label">실 수금액 (KRW)</label><input class="form-input" id="stmd-pay-amt" type="number" placeholder="${s.finalAmount||0}"></div>
        <div><label class="form-label">비고</label><input class="form-input" id="stmd-pay-ref" placeholder="예) 5월 정산월 1차"></div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="stmRegisterPayment()">입금 등록 → 배분 단계</button>
    `;
  } else {
    const rp = s.receivedFromKpx;
    const diff = (rp.amount||0) - (s.finalAmount||0);
    const diffCls = diff===0?'stg-diff-ok':diff>0?'stg-diff-warn':'stg-diff-bad';
    box.innerHTML = `
      <div class="stg-meta">
        <div><div class="k">수금일</div><div class="v">${rp.receivedAt||'-'}</div></div>
        <div><div class="k">수금액</div><div class="v">${(rp.amount||0).toLocaleString()} KRW</div></div>
        <div><div class="k">비고</div><div class="v">${rp.paymentRef||'-'}</div></div>
        <div><div class="k">최종 확정 대비</div><div class="v ${diffCls}">${diff===0?'일치':`차액 ${diff.toLocaleString()} KRW`}</div></div>
      </div>
      ${s.status!=='completed' ? `<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm" onclick="stmResetPayment()">입금 기록 삭제</button></div>` : ''}
    `;
  }
}

/* 단계 ② 배분 처리 */
function stmRenderDistribution(ev){
  const s = ev.settlement;
  const box = $('stmd-dist');
  if(!s.receivedFromKpx){
    box.innerHTML = `<div style="font-size:11px;color:var(--text-hint);padding:4px 0;">① 입금 등록 후 진행 가능합니다.</div>`;
    return;
  }
  const dist = s.customerDistribution||[];
  if(!dist.length){
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:11px;color:var(--text-hint);">수금액 기준으로 참여고객에게 실감축 비율로 자동 안분합니다.</span>
      </div>
      <button class="btn btn-primary btn-sm" onclick="stmGenerateDistribution()">배분 계산 실행</button>
    `;
    return;
  }
  const totalBase = dist.reduce((x,d)=>x+(d.baseAmount||d.amount||0),0);
  const totalPenalty = dist.reduce((x,d)=>x+(d.penalty?.amount||0),0);
  const totalFinal = dist.reduce((x,d)=>x+(d.finalAmount||d.amount||0),0);
  const recv = s.receivedFromKpx.amount||0;
  const locked = s.status==='completed';

  const rows = dist.map(d=>{
    const pen = d.penalty?.amount||0;
    const penBtn = locked
      ? (pen>0 ? `<span class="stl-badge stl-pending">차감 ${pen.toLocaleString()}</span>` : '<span style="color:var(--text-hint);font-size:11px;">-</span>')
      : (pen>0
          ? `<button class="btn btn-ghost btn-sm" onclick="stmOpenPenalty('${d.customerId}')" style="color:var(--red);">-${pen.toLocaleString()}</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="stmOpenPenalty('${d.customerId}')">패널티</button>`);
    const reasonCell = pen>0 && d.penalty?.reason ? `<div style="font-size:10px;color:var(--text-hint);margin-top:2px;">${d.penalty.reason}</div>` : '';
    return `<tr>
      <td>${d.customerName}${reasonCell}</td>
      <td class="num">${(d.contributionKw||d.capacity||0).toLocaleString()}</td>
      <td class="num">${((d.contributionRatio||d.share||0)*100).toFixed(1)}%</td>
      <td class="num">${(d.baseAmount||d.amount||0).toLocaleString()}</td>
      <td class="num">${penBtn}</td>
      <td class="num" style="font-weight:700;">${(d.finalAmount||d.amount||0).toLocaleString()}</td>
    </tr>`;
  }).join('');

  box.innerHTML = `
    <table class="rp-table">
      <thead><tr>
        <th>고객</th>
        <th style="text-align:right;">감축량(kW)</th>
        <th style="text-align:right;">비율</th>
        <th style="text-align:right;">기초 배분</th>
        <th style="text-align:right;">패널티</th>
        <th style="text-align:right;">고객 지급액</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:10px;padding:10px;background:#f8fafc;border-radius:6px;font-size:12px;">
      <div style="display:flex;justify-content:space-between;"><span>기초 배분 합계:</span><span style="font-variant-numeric:tabular-nums;">${totalBase.toLocaleString()} KRW</span></div>
      <div style="display:flex;justify-content:space-between;color:var(--red);"><span>패널티 합계 (수요사업자 귀속):</span><span style="font-variant-numeric:tabular-nums;">-${totalPenalty.toLocaleString()} KRW</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid var(--border);margin-top:6px;padding-top:6px;"><span>고객 지급 합계:</span><span style="font-variant-numeric:tabular-nums;">${totalFinal.toLocaleString()} KRW</span></div>
      <div style="display:flex;justify-content:space-between;color:var(--text-hint);margin-top:4px;font-size:11px;"><span>수금액 대비 검증:</span><span style="font-variant-numeric:tabular-nums;">${recv.toLocaleString()} KRW ${recv===totalBase+totalPenalty?'일치':'불일치'}</span></div>
    </div>
    ${!locked ? `<div style="margin-top:8px;"><button class="btn btn-ghost btn-sm" onclick="stmRegenerateDistribution()">배분 재계산 (패널티 초기화)</button></div>` : ''}
  `;
}

/* 단계 ③ 고객별 진행 */
function stmRenderProgress(ev){
  const s = ev.settlement;
  const box = $('stmd-progress');
  const dist = s.customerDistribution||[];
  if(!dist.length){
    box.innerHTML = `<div style="font-size:11px;color:var(--text-hint);padding:4px 0;">② 배분 계산 후 진행 가능합니다.</div>`;
    return;
  }
  const locked = s.status==='completed';
  const rows = dist.map(d=>{
    const notifyBtn = locked
      ? (d.notifiedAt ? `<span style="color:var(--green);">☑ ${d.notifiedAt.substring(5,10)}</span>` : '<span style="color:var(--text-hint);">☐</span>')
      : `<label><input type="checkbox" ${d.notifiedAt?'checked':''} onchange="stmToggleNotify('${d.customerId}', this.checked)"> ${d.notifiedAt?d.notifiedAt.substring(5,10):'안내'}</label>`;
    const transferBtn = locked
      ? (d.transferredAt ? `<span style="color:var(--green);">☑ ${d.transferredAt.substring(5,10)}</span>` : '<span style="color:var(--text-hint);">☐</span>')
      : `<label><input type="checkbox" ${d.transferredAt?'checked':''} onchange="stmToggleTransfer('${d.customerId}', this.checked)"> ${d.transferredAt?d.transferredAt.substring(5,10):'이체'}</label>`;
    return `<tr>
      <td>${d.customerName}</td>
      <td class="num">${(d.finalAmount||d.amount||0).toLocaleString()}</td>
      <td>${notifyBtn}</td>
      <td>${transferBtn}</td>
    </tr>`;
  }).join('');
  box.innerHTML = `
    <table class="rp-table">
      <thead><tr>
        <th>고객</th>
        <th style="text-align:right;">지급액</th>
        <th>안내</th>
        <th>이체</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* 액션 버튼 */
function stmRenderActions(ev){
  const s = ev.settlement;
  const dist = s.customerDistribution||[];
  const allTransferred = dist.length>0 && dist.every(d=>d.transferredAt);
  let btns = '';
  if(s.status==='in_progress' && allTransferred){
    btns += `<button class="btn btn-primary btn-sm" onclick="stmCompleteSettlement()">정산 완료 처리</button>`;
  }
  if(s.status==='completed'){
    btns += `<span class="stl-badge stl-completed">정산 완료 · ${s.completedAt||''}</span>`;
  }
  $('stmd-actions').innerHTML = btns || `<span style="font-size:11px;color:var(--text-hint);">${s.status==='received'?'입금 등록이 필요합니다.':'모든 고객 이체 완료 시 정산 완료 처리가 가능합니다.'}</span>`;
}

/* ══════ 입금 등록/삭제 ══════ */
function stmRegisterPayment(){
  const ev = store.events.reduction.find(e=>e.id===stmState.selectedEventId);
  if(!ev) return;
  const s = ev.settlement;
  const date = $('stmd-pay-date').value;
  const amt = parseInt($('stmd-pay-amt').value,10);
  const ref = $('stmd-pay-ref').value||'';
  if(!date || !amt){ showToast('수금일과 금액을 입력하세요.'); return; }
  s.receivedFromKpx = {amount:amt, receivedAt:date, paymentRef:ref};
  const prev = s.status;
  s.status = 'in_progress';
  s.history.push({at:nowStr(), user:'현진영', fromStatus:prev, toStatus:'in_progress', note:`KPX 수금 등록 · ${amt.toLocaleString()} KRW`});
  refreshSidebarBadges();
  stmRender();
  stmOpenDetail(ev.id);
  showToast('수금 등록 완료. 이제 배분 계산을 진행하세요.');
}

function stmResetPayment(){
  const ev = store.events.reduction.find(e=>e.id===stmState.selectedEventId);
  if(!ev) return;
  const s = ev.settlement;
  if(!confirm('입금 기록과 고객 배분까지 초기화됩니다. 계속할까요?')) return;
  s.receivedFromKpx = null;
  s.customerDistribution = [];
  const prev = s.status;
  s.status = 'received';
  s.history.push({at:nowStr(), user:'현진영', fromStatus:prev, toStatus:'received', note:'입금 기록 삭제 · 배분 초기화'});
  refreshSidebarBadges();
  stmRender();
  stmOpenDetail(ev.id);
}

/* ══════ 배분 계산 ══════ */
function stmGenerateDistribution(){
  const ev = store.events.reduction.find(e=>e.id===stmState.selectedEventId);
  if(!ev) return;
  const s = ev.settlement;
  if(!s.receivedFromKpx){ showToast('입금 등록 후 가능합니다.'); return; }

  // 고객별 실감축 기여도 계산 (자원별 actual을 고객 capacity 비율로 안분)
  const recv = s.receivedFromKpx.amount;
  const custContrib = {};
  ev.resources.forEach(r=>{
    const g = groupById(r.groupId); if(!g) return;
    const ids = g.customerIds||[];
    const sumCap = ids.reduce((x,cid)=>{ const c = custById(cid); return x + (c?.reduction||100); }, 0);
    ids.forEach(cid=>{
      const c = custById(cid); if(!c) return;
      const cap = c.reduction||100;
      const share = sumCap>0 ? cap/sumCap : 0;
      const contrib = (r.actual||0) * share;
      if(!custContrib[cid]) custContrib[cid] = {id:cid, name:c.name, kw:0};
      custContrib[cid].kw += contrib;
    });
  });

  const list = Object.values(custContrib);
  const totalKw = list.reduce((x,c)=>x+c.kw,0);
  s.customerDistribution = list.map(c=>{
    const ratio = totalKw>0 ? c.kw/totalKw : 0;
    const baseAmount = Math.round(recv * ratio);
    return {
      customerId: c.id,
      customerName: c.name,
      contributionKw: Math.round(c.kw),
      contributionRatio: ratio,
      baseAmount: baseAmount,
      penalty: {amount:0, reason:''},
      finalAmount: baseAmount,
      notifiedAt: null,
      transferredAt: null,
    };
  });
  s.history.push({at:nowStr(), user:'현진영', fromStatus:s.status, toStatus:s.status, note:`배분 계산 · ${list.length}명 · 총 ${recv.toLocaleString()} KRW`});
  stmOpenDetail(ev.id);
  showToast('배분 계산 완료');
}

function stmRegenerateDistribution(){
  if(!confirm('기존 배분(패널티·이체 상태 포함)이 초기화됩니다. 계속할까요?')) return;
  const ev = store.events.reduction.find(e=>e.id===stmState.selectedEventId);
  if(!ev) return;
  ev.settlement.customerDistribution = [];
  stmGenerateDistribution();
}

/* ══════ 패널티 ══════ */
function stmOpenPenalty(customerId){
  const ev = store.events.reduction.find(e=>e.id===stmState.selectedEventId);
  if(!ev) return;
  const d = (ev.settlement.customerDistribution||[]).find(x=>x.customerId===customerId);
  if(!d) return;
  stmState.penaltyTargetCustomerId = customerId;
  $('stmp-sub').textContent = d.customerName;
  $('stmp-base').textContent = (d.baseAmount||0).toLocaleString() + ' KRW';
  $('stmp-current').textContent = (d.finalAmount||0).toLocaleString() + ' KRW';
  $('stmp-amount').value = d.penalty?.amount || '';
  $('stmp-reason').value = d.penalty?.reason || '';
  openModal('stmPenaltyModal');
}

function stmPenaltyApply(){
  const ev = store.events.reduction.find(e=>e.id===stmState.selectedEventId);
  if(!ev) return;
  const d = (ev.settlement.customerDistribution||[]).find(x=>x.customerId===stmState.penaltyTargetCustomerId);
  if(!d) return;
  const amt = parseInt($('stmp-amount').value,10) || 0;
  const reason = $('stmp-reason').value || '';
  if(amt < 0){ showToast('0 이상의 금액을 입력하세요.'); return; }
  if(amt > (d.baseAmount||0)){ showToast('기초 배분액을 초과할 수 없습니다.'); return; }
  d.penalty = {amount: amt, reason};
  d.finalAmount = (d.baseAmount||0) - amt;
  ev.settlement.history.push({at:nowStr(), user:'현진영', fromStatus:ev.settlement.status, toStatus:ev.settlement.status, note:`패널티 차감 · ${d.customerName} · -${amt.toLocaleString()} KRW (${reason||'사유 없음'})`});
  closeModal('stmPenaltyModal');
  stmOpenDetail(ev.id);
  showToast(amt>0 ? `${d.customerName} 패널티 ${amt.toLocaleString()} KRW 차감` : `${d.customerName} 패널티 해제`);
}

function stmPenaltyClear(){
  $('stmp-amount').value = '0';
  $('stmp-reason').value = '';
  stmPenaltyApply();
}

/* ══════ 안내 · 이체 체크 ══════ */
function stmToggleNotify(customerId, checked){
  const ev = store.events.reduction.find(e=>e.id===stmState.selectedEventId);
  if(!ev) return;
  const d = (ev.settlement.customerDistribution||[]).find(x=>x.customerId===customerId);
  if(!d) return;
  d.notifiedAt = checked ? nowStr() : null;
  ev.settlement.history.push({at:nowStr(), user:'현진영', fromStatus:ev.settlement.status, toStatus:ev.settlement.status, note:`${d.customerName} 안내 ${checked?'완료':'해제'}`});
  stmOpenDetail(ev.id);
}

function stmToggleTransfer(customerId, checked){
  const ev = store.events.reduction.find(e=>e.id===stmState.selectedEventId);
  if(!ev) return;
  const d = (ev.settlement.customerDistribution||[]).find(x=>x.customerId===customerId);
  if(!d) return;
  d.transferredAt = checked ? nowStr() : null;
  ev.settlement.history.push({at:nowStr(), user:'현진영', fromStatus:ev.settlement.status, toStatus:ev.settlement.status, note:`${d.customerName} 이체 ${checked?'완료':'해제'} · ${(d.finalAmount||0).toLocaleString()} KRW`});
  stmOpenDetail(ev.id);
}

/* ══════ 정산 완료 ══════ */
function stmCompleteSettlement(){
  const ev = store.events.reduction.find(e=>e.id===stmState.selectedEventId);
  if(!ev) return;
  const s = ev.settlement;
  const dist = s.customerDistribution||[];
  if(!dist.length || !dist.every(d=>d.transferredAt)){
    showToast('모든 고객 이체 완료 후 가능합니다.'); return;
  }
  const prev = s.status;
  s.status = 'completed';
  s.completedAt = nowStr();
  s.history.push({at:nowStr(), user:'현진영', fromStatus:prev, toStatus:'completed', note:`정산 완료 · 고객 ${dist.length}명 이체 집행 완료`});
  refreshSidebarBadges();
  stmRender();
  stmOpenDetail(ev.id);
  showToast('정산 완료 처리됨');
}

/* ══════ 보조 ══════ */
function stmGoToReportEvent(eventId){
  if(!eventId) return;
  closeModal('stmDetailModal');
  navigate('report');
  setTimeout(()=>rpOpenEvent(eventId), 150);
}

/* 시계 */
