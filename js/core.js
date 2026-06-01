/* ════════════════════════════════════════════════════════════
   CORE — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   AUDIT LOG — 통합 감사 로그 (Phase 7)
   모든 객체(계약·이벤트·자원그룹·사용자 등)의 변경 이력 SSOT
   페이지별 상태이력 탭 = filtered 조회, 이력관리 페이지 = 전체 조회
════════════════════════════════════════════════════════════ */
function logAudit({objectType, objectId, action, title, desc, actor, tone}){
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const entry = {
    id: 'L-' + Date.now() + '-' + Math.floor(Math.random()*999),
    ts, objectType, objectId,
    action: action || 'updated',
    title: title || '(이벤트)',
    desc: desc || '',
    actor: actor || '시스템',
    tone: tone || 'info'
  };
  store.auditLogs.push(entry);
  return entry;
}

// 객체별 감사 로그 조회 (시간 역순, 최신 우선). limit 없으면 전체.
function getAuditLogs(objectType, objectId, limit){
  const all = store.auditLogs
    .filter(l => l.objectType === objectType && l.objectId === objectId)
    .sort((a,b) => b.ts.localeCompare(a.ts));
  return typeof limit === 'number' ? all.slice(0, limit) : all;
}

// "전체 이력 보기" 임시 핸들러 — 이력관리 페이지가 만들어지면 그쪽으로 라우팅
function showFullAuditLogs(objectType, objectId){
  if(typeof showToast==='function'){
    showToast(`이력관리 페이지에서 전체 이력 보기 (${objectType} · ${objectId}) — 추후 구현 예정`);
  } else {
    alert(`전체 이력 보기 (${objectType} · ${objectId}) — 이력관리 페이지 추후 구현`);
  }
}


/* 초기 로그 시드 */
(function seedLogs(){
  const pad = n => String(n).padStart(2,'0');
  const d = new Date();
  const todayS = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  store.verifyLogs.push(
    {date:todayS,time:'14:32',recno:'DR-2026-0013',cls:'done',     title:'결과 저장',           msg:'검증 중간 결과가 저장되었습니다.', user:'홍길동'},
    {date:todayS,time:'14:28',recno:'DR-2026-0013',cls:'progress', title:'CBL 분석 실행',        msg:'기준부하(CBL) 산정 분석 시작',       user:'시스템'},
    {date:todayS,time:'14:15',recno:'DR-2026-0013',cls:'done',     title:'RRMSE 분석 완료',      msg:'오차율 8% — 매우 우수',               user:'시스템'},
    {date:todayS,time:'13:50',recno:'DR-2026-0013',cls:'done',     title:'외부데이터 조회 완료',  msg:'한전 연동 성공, 데이터 포인트 8,760개', user:'시스템'},
    {date:todayS,time:'13:40',recno:'DR-2026-0013',cls:'done',     title:'사전검증 시작',         msg:'DR-2026-0013 검증 프로세스 시작',       user:'홍길동'},
    {date:todayS,time:'11:30',recno:'DR-2026-0014',cls:'progress', title:'RRMSE 분석 진행중',     msg:'데이터 포인트 분석 중 (진행률 63%)',    user:'시스템'},
    {date:todayS,time:'10:05',recno:'DR-2026-0014',cls:'done',     title:'외부데이터 조회 완료',  msg:'한전 연동 성공, 데이터 수집 완료',      user:'시스템'},
    {date:todayS,time:'09:15',recno:'DR-2026-0019',cls:'fail',     title:'외부데이터 조회 실패',  msg:'한전 API 응답 오류 (KEPCO-404) — 고객번호 불일치', user:'시스템'},
  );
})();

/* 자원그룹 운영 상태 시드 */
(function seedOperational(){
  const profiles = {
    1:  {col:'NORMAL',  lastMin:2,  failed:0, rate:0.92, trend:'up',   count:8,  last:0.95},
    2:  {col:'NORMAL',  lastMin:5,  failed:0, rate:0.88, trend:'flat', count:6,  last:0.89},
    3:  {col:null},
    5:  {col:'NORMAL',  lastMin:3,  failed:0, rate:0.95, trend:'up',   count:12, last:0.97},
    8:  {col:'FAILED',  lastMin:62, failed:2, rate:0.65, trend:'down', count:7,  last:0.58},
    10: {col:'NORMAL',  lastMin:1,  failed:0, rate:0.96, trend:'up',   count:15, last:0.98},
    12: {col:'NORMAL',  lastMin:6,  failed:0, rate:0.91, trend:'up',   count:11, last:0.94},
  };
  const pastLabel = (daysAgo, hour) => {
    const d = new Date(Date.now() - daysAgo*86400000);
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(hour)}:00~${pad(hour+1)}:00`;
  };
  const genHistory = (count, avgRate) => {
    if(!count) return [];
    const h = [];
    for(let i=0; i<count; i++){
      const daysAgo = (i+1)*7 + Math.floor(Math.random()*3);
      const variance = (Math.random()-0.5)*0.2;
      const rate = Math.max(0.4, Math.min(1.0, avgRate + variance));
      const ordered = 500 + Math.floor(Math.random()*2500);
      const reduced = Math.round(ordered * rate);
      const cbl = Math.round(ordered / 0.35);
      h.push({
        id:`E${Date.now()-daysAgo*86400000}-${i}`.substring(0,18),
        date:pastLabel(daysAgo, 13 + Math.floor(Math.random()*3)),
        type:Math.random() > 0.4 ? 'mandatory' : 'planned',
        orderedKw:ordered, reducedKw:reduced, cblKw:cbl,
        performanceRate:Math.round(rate*1000)/1000,
        penalty:rate < 0.7, settlement:daysAgo > 14 ? 'COMPLETE' : 'PENDING',
      });
    }
    return h;
  };
  store.groups.forEach(g=>{
    const p = profiles[g.id] || {col:null};
    if(p.col){
      // 참여고객별 데이터 송신 상태 생성
      // NORMAL 그룹: 모든 고객 정상
      // DELAYED 그룹: 일부 지연
      // FAILED 그룹: failedCustomers 명이 실제로 미수신 상태 (명단 포함)
      const custIds = g.customerIds || [];
      const custDataStatus = {};
      const rngSeed = g.id * 31;
      const prng = i=>{ const s=Math.sin(rngSeed+i*7)*10000; return s-Math.floor(s); };
      // 미수신으로 표시할 고객 인덱스 결정 (앞쪽부터)
      const failCount = Math.min(p.failed || 0, custIds.length);
      custIds.forEach((cid, i)=>{
        if(i < failCount){
          // 미수신: 수신 지연시간을 큰 값으로
          const mins = 45 + Math.floor(prng(i)*40); // 45~84분
          custDataStatus[cid] = {status:'FAILED', lastMinutesAgo:mins};
        } else if(p.col==='DELAYED' && i < failCount+1){
          custDataStatus[cid] = {status:'DELAYED', lastMinutesAgo:18 + Math.floor(prng(i)*10)};
        } else {
          custDataStatus[cid] = {status:'NORMAL', lastMinutesAgo:1 + Math.floor(prng(i)*4)};
        }
      });
      g.operational = {
        dataCollection:{status:p.col, lastMinutesAgo:p.lastMin, failedCustomers:p.failed},
        performance:{recentAvgRate:p.rate, trend:p.trend, count:p.count, lastRate:p.last},
        custDataStatus,
      };
      g.reductionHistory = genHistory(p.count, p.rate);
    }
  });
})();

/* 운영리포트 — 종료된 이벤트에 정산 필드 부여 + 과거 샘플 이벤트 추가
   ★ MVP 재설계: 이벤트 정산 상태 4단계
     awaiting       (데이터 대기) — KPX 정산기준 데이터 수신 전. 운영자 대기 상태.
     received       (정산 시작/접수) — KPX 데이터 수신, 운영리포트와 대사·이의제기·최종 기준 확정
     in_progress    (정산 중) — KPX 수금 완료, 참여고객 배분 진행
     completed      (정산 완료) — 전 참여고객 배분 완료
   (정산해설서 기반 3대 정산금 = DRP 실적정산금 / DRFBP 고정기본정산금 / DRDBP 자동기본정산금)
   (KPX 정산월: 2월/5월/8월/11월 분기 — 감축발생월의 다음 분기 정산월에 제출)
   (우리→고객 배분은 capacity 비율 단순 안분 — MVP 범위, DPCF 정밀배분은 v2) */
(function seedReport(){
  // 과거 완료된 운영 이벤트 추가 (지난 3개월 분포)
  const past = [
    // 2026-03 (전월)
    {id:'EVM20260318-01', dt:'MANDATORY_REDUCTION', date:'2026-03-18', tr:'14:00~15:00', resources:[
      {groupId:1, ordered:2400, actual:2280, status:'NORMAL'},
      {groupId:2, ordered:850,  actual:790,  status:'NORMAL'},
      {groupId:5, ordered:1000, actual:960,  status:'NORMAL'},
    ]},
    {id:'EVV20260312-01', dt:'VOLUNTARY_REDUCTION', date:'2026-03-12', tr:'13:00~14:00', resources:[
      {groupId:1, ordered:1500, actual:1425, status:'NORMAL'},
      {groupId:5, ordered:800,  actual:760,  status:'NORMAL'},
    ]},
    // 2026-02 (지지난달)
    {id:'EVM20260222-01', dt:'MANDATORY_REDUCTION', date:'2026-02-22', tr:'15:00~16:00', resources:[
      {groupId:1, ordered:2500, actual:2350, status:'NORMAL'},
      {groupId:2, ordered:900,  actual:850,  status:'NORMAL'},
      {groupId:5, ordered:1050, actual:995,  status:'NORMAL'},
      {groupId:8, ordered:400,  actual:310,  status:'NORMAL'},
    ]},
    {id:'EVM20260208-01', dt:'MANDATORY_REDUCTION', date:'2026-02-08', tr:'14:00~15:00', resources:[
      {groupId:1, ordered:2300, actual:2185, status:'NORMAL'},
      {groupId:2, ordered:880,  actual:850,  status:'NORMAL'},
    ]},
  ];
  past.forEach(p=>{
    store.events.reduction.push({
      id:p.id, dispatch_type:p.dt, category:'operation',
      date:p.date, timeRange:p.tr,
      label:`${p.date} ${p.tr} · ${p.dt==='MANDATORY_REDUCTION'?'의무감축':'자발적감축'}`,
      source:'KPX', live:false, resources:p.resources,
    });
  });

  // 완료된 운영 이벤트(live:false && !scheduled && category:'operation')에 정산 필드 초기화
  const completed = store.events.reduction.filter(e=>!e.live && !e.scheduled && e.category==='operation');
  completed.forEach(e=>{
    const totalReduced = (e.resources||[]).reduce((s,r)=>s+(r.actual||0),0);
    // 예상정산금 = 실적(kW) × MGP(가정 120원/kWh) × 1h (샘플값)
    const estAmount = Math.round(totalReduced * 120);
    e.settlement = {
      status: 'awaiting',  // 데이터 대기 (KPX 정산기준 데이터 수신 전)
      ourAmount: estAmount,            // 우리 측 추정 정산금 (운영리포트 기반)
      kpxData: null,                   // ① KPX 정산기준 데이터 (수신 시 생성)
      finalAmount: null,               // 대사·이의 후 최종 확정 기준 금액
      confirmedAt: null,               // 정합성 확정 시각 (운영리포트 → 정산관리 이관)
      confirmedBy: '',                 // 정합성 확정 담당자
      receivedFromKpx: null,           // ② KPX 수금 정보
      customerDistribution: [],        // ③ 참여고객 배분 내역
      completedAt: null,               // 정산 완료 시각
      note: '',
      history: [{at: e.date+' 16:00', user:'system', fromStatus:null, toStatus:'awaiting', note:'감축 이벤트 종료 — KPX 정산기준 데이터 수신 대기'}]
    };
  });

  // 일부 과거 이벤트는 단계별 진행 상태로 시뮬레이션
  const setStl = (id, patch) => {
    const ev = store.events.reduction.find(e=>e.id===id);
    if(!ev || !ev.settlement) return;
    Object.assign(ev.settlement, patch);
  };

  // EVM20260208-01: 가장 오래된 이벤트 — 아직 in_progress (KPX 수금 완료, 고객 배분 진행 중)
  // 금액 스케일: 실적(kW) × 120원/kWh × 1h 기준 (실적정산금 단일, 기본정산금은 MVP 단순화)
  setStl('EVM20260208-01', {
    status:'in_progress',
    kpxData: {
      receivedAt:'2026-04-20', kpxReductionKw: 3012, kpxPerformanceRate: 0.95,
      kpxAmount: 361440, ourReductionKw: 3020, discrepancyKw: -8, discrepancyPct: -0.26,
      objection:{raised:false, reason:'', finalAmount: 361440}
    },
    finalAmount: 361440,
    receivedFromKpx:{amount: 361440, receivedAt:'2026-05-15', paymentRef:'5월 정산월 1차'},
    customerDistribution:[],
    note:'2026-02월 감축 — KPX 수금 완료, 참여고객 배분 준비 중',
    history:[
      {at:'2026-02-08 16:00', user:'system', fromStatus:null, toStatus:'awaiting', note:'감축 이벤트 종료'},
      {at:'2026-04-20 09:00', user:'현진영', fromStatus:'awaiting', toStatus:'received', note:'KPX 정산기준 데이터 수신·등록'},
      {at:'2026-04-22 14:00', user:'현진영', fromStatus:'received', toStatus:'received', note:'운영리포트 대사 완료 — 차이 -0.26% (허용 범위)'},
      {at:'2026-05-15 15:00', user:'현진영', fromStatus:'received', toStatus:'in_progress', note:'KPX 수금 확인 — 361,440 KRW'},
    ]
  });

  // EVM20260222-01: received (KPX 데이터 접수, 검증 중)
  setStl('EVM20260222-01', {
    status:'received',
    kpxData:{
      receivedAt:'2026-04-25', kpxReductionKw: 4405, kpxPerformanceRate: 0.94,
      kpxAmount: 528600, ourReductionKw: 4445, discrepancyKw: -40, discrepancyPct: -0.90,
      objection:{raised:false, reason:'', finalAmount: 528600}
    },
    finalAmount: 528600,
    note:'2026-02월 감축 1건 — KPX 기준 대사 완료, 수금 대기',
    history:[
      {at:'2026-02-22 16:00', user:'system', fromStatus:null, toStatus:'awaiting', note:'감축 이벤트 종료'},
      {at:'2026-04-25 10:00', user:'현진영', fromStatus:'awaiting', toStatus:'received', note:'KPX 정산기준 데이터 수신·등록'},
      {at:'2026-04-26 14:20', user:'현진영', fromStatus:'received', toStatus:'received', note:'운영리포트 대사 — 차이 -0.9% (허용 범위)'},
    ]
  });

  // EVV20260312-01: received (KPX 데이터 접수, 이의 제기 상태)
  setStl('EVV20260312-01', {
    status:'received',
    kpxData:{
      receivedAt:'2026-04-28', kpxReductionKw: 2085, kpxPerformanceRate: 0.88,
      kpxAmount: 250200, ourReductionKw: 2185, discrepancyKw: -100, discrepancyPct: -4.58,
      objection:{raised:true, reason:'C001 고객 15분 구간 4개에서 KPX 측 CBL 산정 오류 추정 — 추가 검토 요청', finalAmount: null}
    },
    finalAmount: null,
    note:'2026-03월 자발적감축 — 우리 측 실적 대비 -4.6% 차이 발생, KPX 이의제기 중',
    history:[
      {at:'2026-03-12 16:00', user:'system', fromStatus:null, toStatus:'awaiting', note:'감축 이벤트 종료'},
      {at:'2026-04-28 11:00', user:'박정산', fromStatus:'awaiting', toStatus:'received', note:'KPX 정산기준 데이터 수신·등록'},
      {at:'2026-04-29 10:30', user:'박정산', fromStatus:'received', toStatus:'received', note:'대사 결과 -4.6% 차이 — 허용 초과, 이의 제기 진행'},
    ]
  });
  // EVM20260318-01 / EVM20260410-01 는 기본 awaiting 유지 (KPX 데이터 미수신)
})();

/* 정산관리 — 이벤트 단위 정산 시드
   - 정산 ID = STL-{eventId} (예: STL-EVM20260208-01)
   - 정산은 이벤트 단위로 독립 처리 (월별 배치 폐기)
   - 상태: awaiting → received(정합성 확정) → in_progress(입금·배분) → completed */
(function seedSettlementExtra(){
  // 과거 paid 배치용 시드 이벤트 추가 (2025-11 감축 2건)
  store.events.reduction.push(
    {id:'EVM20251115-01', dispatch_type:'MANDATORY_REDUCTION', category:'operation',
     date:'2025-11-15', timeRange:'14:00~15:00',
     label:'2025-11-15 14:00~15:00 · 의무감축',
     source:'KPX', live:false,
     resources:[
       {groupId:1, ordered:2400, actual:2280, status:'NORMAL'},
       {groupId:2, ordered:850,  actual:810,  status:'NORMAL'},
       {groupId:5, ordered:1000, actual:960,  status:'NORMAL'},
     ]},
    {id:'EVV20251128-01', dispatch_type:'VOLUNTARY_REDUCTION', category:'operation',
     date:'2025-11-28', timeRange:'13:00~14:00',
     label:'2025-11-28 13:00~14:00 · 자발적감축',
     source:'KPX', live:false,
     resources:[
       {groupId:1, ordered:1400, actual:1330, status:'NORMAL'},
       {groupId:5, ordered:700,  actual:680,  status:'NORMAL'},
     ]},
  );
  // 과거 완료 이벤트 — 이미 completed (전 참여고객 배분 완료)
  ['EVM20251115-01','EVV20251128-01'].forEach(id=>{
    const ev = store.events.reduction.find(e=>e.id===id);
    const totalA = ev.resources.reduce((s,r)=>s+(r.actual||0),0);
    const ourAmount = Math.round(totalA*120);
    const kpxAmount = Math.round(totalA*118);  // -1.7% 차액 시뮬레이션
    // 참여고객 배분 (capacity 비율 단순 안분)
    const allCustIds = [];
    ev.resources.forEach(r=>{
      const g = groupById(r.groupId);
      if(g) (g.customerIds||[]).forEach(cid=>{ if(!allCustIds.includes(cid)) allCustIds.push(cid); });
    });
    const totalCap = allCustIds.reduce((s,cid)=>{ const c = custById(cid); return s + (c?.reduction||100); }, 0);
    const distribution = allCustIds.map(cid=>{
      const c = custById(cid);
      const cap = c?.reduction||100;
      const share = totalCap>0 ? cap/totalCap : 0;
      return {
        customerId: cid, customerName: c?.name||cid,
        capacity: cap, share: share,
        amount: Math.round(kpxAmount * share),
        scheduledAt:'2026-02-28', transferredAt:'2026-02-27',
        status:'transferred'
      };
    });
    ev.settlement = {
      status:'completed',
      ourAmount: ourAmount,
      kpxData:{
        receivedAt:'2026-01-20', kpxReductionKw: Math.round(totalA*0.99), kpxPerformanceRate: 0.94,
        kpxAmount: kpxAmount, ourReductionKw: totalA, discrepancyKw: Math.round(totalA*-0.01), discrepancyPct: -1.7,
        objection:{raised:false, reason:'', finalAmount: kpxAmount}
      },
      finalAmount: kpxAmount,
      confirmedAt:'2026-01-20 10:00', confirmedBy:'현진영',
      receivedFromKpx:{amount: kpxAmount, receivedAt:'2026-02-15', paymentRef:'2월 정산월 1차'},
      customerDistribution: distribution,
      completedAt:'2026-02-27',
      note:'2025-11월 감축 — 전 단계 정산 완료',
      history:[
        {at:`${ev.date} 16:00`, user:'system', fromStatus:null, toStatus:'awaiting', note:'감축 이벤트 종료'},
        {at:'2026-01-20 10:00', user:'현진영', fromStatus:'awaiting', toStatus:'received', note:'KPX 정산기준 데이터 수신·정합성 확정'},
        {at:'2026-02-15 15:00', user:'현진영', fromStatus:'received', toStatus:'in_progress', note:'KPX 수금 확인'},
        {at:'2026-02-27 17:00', user:'현진영', fromStatus:'in_progress', toStatus:'completed', note:'참여고객 배분 집행 완료'},
      ]
    };
  });

})();

/* ════════════════════════════════════════════════════════════
   ★ 공통 유틸
════════════════════════════════════════════════════════════ */
function $(id){ return document.getElementById(id); }
function $$(sel){ return document.querySelectorAll(sel); }


const tipState = { checks:{}, openId:null };

function tip(id){
  const def = TIPS[id];
  if(!def) return '';
  const checksHtml = def.checks && def.checks.length ? `
    <div class="tip-pop-list">
      <div class="tip-pop-list-hdr">확인 체크리스트</div>
      ${def.checks.map((label,i)=>{
        const key = id+'_'+i;
        const checked = tipState.checks[key] ? 'checked' : '';
        return `<label class="tip-pop-item"><input type="checkbox" ${checked} onchange="tipCheck('${key}', this.checked, '${id}')"><span>${label}</span></label>`;
      }).join('')}
      <div class="tip-pop-progress" id="tipprog-${id}">${tipProgText(id)}</div>
    </div>` : '';
  return `<span class="tip" onclick="tipToggle('${id}', event)" title="안내 보기">i<span class="tip-pop" id="tippop-${id}" onclick="event.stopPropagation()">
    <span class="tip-pop-close" onclick="tipToggle('${id}', event)">닫기</span>
    <div class="tip-pop-title">${def.title}</div>
    <div class="tip-pop-body">${def.body}</div>
    ${checksHtml}
  </span></span>`;
}
function tipProgText(id){
  const def = TIPS[id]; if(!def?.checks?.length) return '';
  const total = def.checks.length;
  const done = def.checks.reduce((s,_,i)=> s + (tipState.checks[id+'_'+i]?1:0), 0);
  return `체크 ${done}/${total}`;
}
function tipToggle(id, ev){
  if(ev) ev.stopPropagation();
  // 다른 툴팁 닫기
  document.querySelectorAll('.tip-pop.show').forEach(p=>{
    if(p.id !== 'tippop-'+id) p.classList.remove('show');
  });
  document.querySelectorAll('.tip.active').forEach(t=>t.classList.remove('active'));
  const pop = document.getElementById('tippop-'+id);
  if(!pop) return;
  const willOpen = !pop.classList.contains('show');
  pop.classList.toggle('show', willOpen);
  if(ev?.target?.classList?.contains('tip')) ev.target.classList.toggle('active', willOpen);
  tipState.openId = willOpen ? id : null;
}
function tipCheck(key, checked, tipId){
  tipState.checks[key] = checked;
  const el = document.getElementById('tipprog-'+tipId);
  if(el) el.textContent = tipProgText(tipId);
}
// 외부 클릭·ESC로 닫기
document.addEventListener('click', (e)=>{
  if(e.target.closest('.tip')||e.target.closest('.tip-pop')) return;
  document.querySelectorAll('.tip-pop.show').forEach(p=>p.classList.remove('show'));
  document.querySelectorAll('.tip.active').forEach(t=>t.classList.remove('active'));
  tipState.openId = null;
});
document.addEventListener('keydown', (e)=>{
  if(e.key==='Escape'){
    document.querySelectorAll('.tip-pop.show').forEach(p=>p.classList.remove('show'));
    document.querySelectorAll('.tip.active').forEach(t=>t.classList.remove('active'));
    tipState.openId = null;
  }
});
function showToast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }
function openModal(id){ $(id).classList.add('show'); }
function closeModal(id){ $(id).classList.remove('show'); }
function closeCommonModal(){ closeModal('commonModal'); }
function closeTransientUi(){
  [
    'commonModal','registerModal','stepModal','dmModal','reEventModal','stlModal',
    'stmDetailModal','stmPenaltyModal','rmCreateModal','rmMappingModal','ctRejectOverlay'
  ].forEach(id=>{
    const el = $(id);
    if(el) el.classList.remove('show', 'active');
  });
  ['modalFindPw','logoutConfirmModal'].forEach(id=>{
    const el = $(id);
    if(el) el.classList.remove('show');
  });
  const ctPanel = $('ctDetailPanel');
  if(ctPanel) ctPanel.classList.remove('open');
  const rmPanel = $('rmDetailPanel');
  if(rmPanel) rmPanel.classList.remove('open');
  const acctDrawer = $('acctDrawer');
  if(acctDrawer) acctDrawer.classList.remove('show');
}
function nowStr(){ const d=new Date(), pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function todayStr(){ const d=new Date(), pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function custById(id){ return store.customers.find(c=>c.id===id); }
function groupById(id){ return store.groups.find(g=>g.id===id); }

/* ═══ 등록시험 관련 헬퍼 ═══ */
/* typeKey에 따라 시험 의무 여부 결정. 표준·중소형·제주는 의무, 국민DR·주파수DR·플러스DR은 면제 */
function statusBadgeClass(s){
  switch(s){
    case '검증대기': return 'badge-pending';
    case '검증중':   return 'badge-progress';
    case '검증완료': return 'badge-done';
    case '계약완료': return 'badge-purple';
    case '반려':     return 'badge-fail';
    case 'active':   return 'badge-done';
    case 'waiting':  return 'badge-pending';
    case 'suspended':return 'badge-gray';
    default: return 'badge-gray';
  }
}
function statusLabelRM(s){
  return s==='active'?'활성':s==='waiting'?'승인대기':s==='suspended'?'일시중지':s;
}
function dataBadgeClass(d){ return d==='수집완료'?'badge-done':d==='수집중'?'badge-collecting':'badge-fail'; }

/* ════════════════════════════════════════════════════════════
   ★ 네비게이션
════════════════════════════════════════════════════════════ */
function navigate(pageKey){
  closeTransientUi();
  $$('.sidebar-item').forEach(el=>el.classList.toggle('active', el.dataset.page===pageKey));
  $$('.page').forEach(el=>el.classList.remove('active'));
  $('page-'+pageKey).classList.add('active');
  if(pageKey==='dashboard')     renderDashboard();
  if(pageKey==='precheck')      { pcGotoList(); pcRenderTable(); pcRefreshCards(); }
  if(pageKey==='resource')      { rmApplyFilter(); rmRefreshSummary(); }
  if(pageKey==='contract')      ctInit();
  if(pageKey==='communication') comInit();
  if(pageKey==='monitoring')    monInit();
  if(pageKey==='report')        rpInit();
  if(pageKey==='settlement')    stmInit();
  if(pageKey==='bidding')       bidInit();
  if(pageKey==='datacollect')   dcInit();
  if(pageKey==='accounts')      acctInit();
  if(pageKey==='system')        sysInit();
  refreshSidebarBadges();
}
function refreshSidebarBadges(){
  // 사전검증 뱃지: 계약완료를 제외한 모든 사전검증 관리 대상 (대기/진행/완료/반려)
  const pcCount = store.customers.filter(c=>c.status!=='계약완료').length;
  $('sb-precheck-count').textContent = pcCount;
  $('sb-precheck-count').style.display = pcCount ? 'inline-block' : 'none';

  const contractTarget = store.customers.filter(c=>['검증완료','반려','계약완료'].includes(c.status)).length;
  const contractPending = store.customers.filter(c=>['계약대기','검토중'].includes(ctGetStage(c))).length;
  const contractBadge = $('sb-contract-count');
  if(contractBadge){
    contractBadge.textContent = contractPending || contractTarget || 0;
    contractBadge.style.display = contractTarget ? 'inline-block' : 'none';
    contractBadge.style.background = contractPending ? 'var(--amber)' : 'var(--green)';
    contractBadge.title = contractPending ? `계약 처리 필요 ${contractPending}건` : `계약 처리 완료 포함 ${contractTarget}건`;
  }

  // 자원관리 뱃지: 운영이상이 있으면 "위험수 + 아이콘" 경고 스타일, 아니면 전체 개수
  const rmCount = store.groups.length;
  const rmBadge = $('sb-resource-count');
  const problems = getProblematicGroups();
  const riskCnt = problems.filter(p=>p.level==='risk').length;
  const warnCnt = problems.filter(p=>p.level==='warn').length;
  if(riskCnt > 0){
    // 위험 건이 있으면 빨강 뱃지로 강조
    rmBadge.textContent = String(riskCnt);
    rmBadge.style.background = 'var(--red)';
    rmBadge.title = `위험 ${riskCnt}건 · 주의 ${warnCnt}건 — 점검 필요`;
  } else if(warnCnt > 0){
    // 주의만 있으면 노랑 뱃지
    rmBadge.textContent = String(warnCnt);
    rmBadge.style.background = 'var(--amber)';
    rmBadge.title = `주의 ${warnCnt}건`;
  } else {
    // 평상시 기본 파랑 뱃지 (전체 그룹 수)
    rmBadge.textContent = rmCount;
    rmBadge.style.background = '';  // CSS 기본값(var(--blue))으로 복귀
    rmBadge.title = `전체 ${rmCount}개 자원그룹`;
  }
  rmBadge.style.display = rmCount ? 'inline-block' : 'none';

  const hasLive = store.events.reduction.some(e=>e.live);
  $('sb-monitoring-badge').style.display = hasLive ? 'inline-flex' : 'none';

  // 운영리포트 뱃지: 운영자 액션 필요한 이벤트 수 = received(접수/대사) 단계
  const actionableEvents = store.events.reduction.filter(e=>!e.live && !e.scheduled && e.category==='operation' && e.settlement && e.settlement.status==='received').length;
  const rpBadge = $('sb-report-pending');
  if(rpBadge){
    rpBadge.textContent = actionableEvents;
    rpBadge.style.display = actionableEvents ? 'inline-block' : 'none';
    rpBadge.title = `대사/이의제기 단계 ${actionableEvents}건`;
  }

  // 정산관리 뱃지: 진행 중 배치 수 (완료가 아닌 배치)
  const stmBadge = $('sb-stm-badge');
  if(stmBadge){
    // 정산관리 뱃지 = 진행 중(정합성 확정~배분중) 이벤트 수
    const actionable = store.events.reduction.filter(e=>{
      const st = e.settlement?.status;
      return st === 'received' || st === 'in_progress';
    }).length;
    stmBadge.textContent = actionable;
    stmBadge.style.display = actionable ? 'inline-block' : 'none';
    stmBadge.title = `진행 중인 정산 ${actionable}건`;
  }
}

/* ════════════════════════════════════════════════════════════
   ★ PAGE: 사전검증 관리
════════════════════════════════════════════════════════════ */
function getProblematicGroups(){
  const out = [];
  store.groups.forEach(g=>{
    const level = rmHealth(g);
    if(level==='normal') return;
    const dc = g.operational?.dataCollection;
    const pf = g.operational?.performance;
    // 주된 이상 사유 결정 (우선순위: 데이터수집 실패 > 지연 > 저성과)
    let reason = '', reasonKey = '', affected = 0;
    if(dc?.status==='FAILED'){
      reasonKey = 'collect_fail';
      reason = '데이터 수집 실패';
      affected = dc.failedCustomers || 0;
    } else if(dc?.status==='DELAYED'){
      reasonKey = 'collect_delay';
      reason = '데이터 수집 지연';
      affected = dc.failedCustomers || 0;
    } else if(dc?.status==='PARTIAL'){
      reasonKey = 'collect_partial';
      reason = '일부 고객 수집 실패';
      affected = dc.failedCustomers || 0;
    } else if(pf && pf.count>0 && pf.recentAvgRate < 0.7){
      reasonKey = 'low_perf';
      reason = `저조한 이행률 ${Math.round(pf.recentAvgRate*100)}%`;
      affected = (g.customerIds||[]).length;
    } else if(pf && pf.count>0 && pf.recentAvgRate < 0.85){
      reasonKey = 'mid_perf';
      reason = `이행률 주의 ${Math.round(pf.recentAvgRate*100)}%`;
      affected = (g.customerIds||[]).length;
    } else {
      reasonKey = 'other';
      reason = '운영 점검 필요';
      affected = (g.customerIds||[]).length;
    }
    out.push({ group:g, level, reason, reasonKey, affectedCount:affected });
  });
  // 정렬: risk 먼저, 같은 레벨 내에서는 수집문제 우선
  const prio = {collect_fail:0, collect_delay:1, collect_partial:2, low_perf:3, mid_perf:4, other:5};
  out.sort((a,b)=>{
    if(a.level!==b.level) return a.level==='risk'?-1:1;
    return (prio[a.reasonKey]||9) - (prio[b.reasonKey]||9);
  });
  return out;
}

function dispatchTypeMeta(dt){
  const map = {
    MANDATORY_REDUCTION:      {label:'의무감축',   short:'의무',   badge:'badge-progress', direction:'reduce'},
    VOLUNTARY_REDUCTION:      {label:'자발적감축', short:'자발',   badge:'badge-purple',   direction:'reduce'},
    VOLUNTARY_INCREASE:       {label:'플러스DR 계획', short:'계획', badge:'badge-pending',  direction:'increase'},
    REALTIME_INCREASE_REQUEST:{label:'플러스DR 실시간', short:'실시간', badge:'badge-fail', direction:'increase'},
    REGISTRATION_TEST:        {label:'등록시험',   short:'시험',   badge:'badge-pending',  direction:'reduce'},
  };
  return map[dt] || {label:dt||'-', short:'-', badge:'badge-gray', direction:'reduce'};
}
function eventDisplayKind(ev){
  const dt = ev?.dispatch_type;
  if(dt==='MANDATORY_REDUCTION') return '신뢰성DR';
  if(dt==='VOLUNTARY_REDUCTION') return '자발적DR';
  if(dt==='VOLUNTARY_INCREASE' || dt==='REALTIME_INCREASE_REQUEST') return '플러스DR';
  if(dt==='REGISTRATION_TEST') return '등록시험';
  return dispatchTypeMeta(dt).label || '이벤트';
}
function eventDisplaySeq(ev){
  if(!ev) return 1;
  const year = String(ev.date||'').slice(0,4);
  const kind = eventDisplayKind(ev);
  const events = [
    ...(store.events?.reduction || []),
    ...(store.events?.plus || []),
  ].filter(x=>x && String(x.date||'').slice(0,4)===year && eventDisplayKind(x)===kind)
   .sort((a,b)=>{
     const da = `${a.date||''} ${a.timeRange||''} ${a.id||''}`;
     const db = `${b.date||''} ${b.timeRange||''} ${b.id||''}`;
     return da.localeCompare(db);
   });
  const idx = events.findIndex(x=>x.id===ev.id);
  return idx>=0 ? idx+1 : 1;
}
function eventDisplayName(ev){
  if(!ev) return '-';
  const yy = String(ev.date||'').slice(2,4) || '--';
  return `${yy}년 ${eventDisplayKind(ev)} ${eventDisplaySeq(ev)}차`;
}
function eventDisplaySub(ev){
  if(!ev) return '-';
  return `${ev.id} · ${ev.date||'-'} ${ev.timeRange||''}`.trim();
}
function renderDashboard(){
  const cs = store.customers;
  // 정산 현황 — 동적 월 표기 ("N월")
  const monEl = $('dashSettleMonth');
  if(monEl){
    const m = new Date().getMonth() + 1;
    monEl.textContent = `— ${m}월`;
  }
  // 참여고객 수(인라인 "참여고객 현황" 섹션에서 사용)
  const groups = store.groups;
  const activeGroups = groups.filter(g=>g.status==='active');
  const totalCust = activeGroups.reduce((s,g)=>s + (g.customerIds?.length||0), 0);

  // 감축 이벤트 · 등록시험 상태 카드
  dashRenderMonitoringStatusCards();
  // 운영이상 자원그룹
  dashRenderRiskList();
  // 전력 데이터 수집 현황
  dashRenderBars();
  // 대시보드 참여고객 현황
  $('d-cust-total').textContent = totalCust;
  const d = new Date();
  const curYm = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  // 이번 달 신규 = 이번 달 계약 전환된 고객 (contractDate 기준, 없으면 접수일로 fallback)
  const newThisMonth = cs.filter(c=>{
    if(c.status!=='계약완료') return false;
    const ref = c.contractDate || c.date;
    return ref && ref.startsWith(curYm);
  }).length;
  $('d-cust-new').textContent = newThisMonth;

  // 대기 리스트
  const registered = cs.filter(c=>c.status==='검증대기').length;
  const inProgress = cs.filter(c=>c.status==='검증중').length;
  const contractWait = cs.filter(c=>c.status==='검증완료').length;
  $('dashPending').innerHTML = `
    <div class="pend-item"><span class="p-label">신규 접수 (검증대기)</span><span class="${registered>0?'p-warn':'p-num'}">${registered}건${registered>0?' · 확인 필요':''}</span></div>
    <div class="pend-item"><span class="p-label">검증 진행중</span><span class="p-num">${inProgress}건</span></div>
    <div class="pend-item"><span class="p-label">계약 전환 대기</span><span class="${contractWait>0?'p-warn':'p-num'}">${contractWait}건</span></div>`;
}

(function clock(){
  function tick(){
    const d=new Date(), pad=n=>String(n).padStart(2,'0');
    const el=$('dashClock');
    if(el) el.textContent=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  tick(); setInterval(tick,1000);
})();

/* ════════════════════════════════════════════════════════════
   ★ PAGE: 운영 리포트
   - 감축 모니터링에서 종료된 이벤트(live:false && !scheduled && category:'operation')를 대상으로
     이벤트별/자원별/월별 집계 + 정산 요청 상태 관리 + 참여고객 리포트 CSV 생성
   - 기능 우선순위 (시니어 기획 판단):
     (1) 완료 이벤트 리스트 · 이행률 · 정산 상태 (운영자의 매일 업무)
     (2) 이벤트 상세 · 자원별 이행 · 참여고객별 CSV (KPX 수기 정산요청 보조)
     (3) 정산 상태 생명주기 관리 (pending → requested → received, 이력 보존)
     (4) 월별 요약 · 자원 랭킹 (운영·영업 리포팅)
════════════════════════════════════════════════════════════ */
(function clock(){
  function tick(){
    const d=new Date(), pad=n=>String(n).padStart(2,'0');
    const el=$('dashClock');
    if(el) el.textContent=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  tick(); setInterval(tick,1000);
})();

/* ════════════════════════════════════════════════════════════
   ★ PAGE: 데이터 관리 › 전력데이터 수집현황 (DATA-01)
   - 기존 pcDmGenerateData를 재사용하여 자원그룹×기간 집계
   - 3개 탭: ①자원그룹 요약 / ②시간대 히트맵 / ③고객 상세
   - PRD §5.2 보정 Flag를 UI 전반에서 명시 구분
════════════════════════════════════════════════════════════ */
(function seedCommunication(){
  store.commTemplates = [
    {id:'TPL-001', code:'EVENT_ISSUED', title:'감축 지시 발령', channels:['PUSH','SMS','KKO'],
     body:'[DR 감축 지시] 이벤트 번호 {{eventId}} · 감축 시간 {{timeRange}} · 요청 감축량 {{orderedKw}}. 앱에서 "수신확인"을 눌러주세요.',
     active:true, lastUpdated:'2026-04-10 10:20'},
    {id:'TPL-002', code:'EVENT_END', title:'감축 종료 안내', channels:['PUSH','KKO'],
     body:'[DR 감축 종료] {{eventId}} 이행률 {{rate}}%. 상세 리포트는 앱에서 확인하세요.',
     active:true, lastUpdated:'2026-04-10 10:22'},
    {id:'TPL-003', code:'UNDER_PERFORM_WARN', title:'이행률 미달 경고', channels:['PUSH','SMS','MAIL'],
     body:'[경고] 최근 3회 평균 이행률 {{rate}}%로 80% 미만입니다. 참여 제한 대상이 될 수 있어 담당자 확인 요망.',
     active:true, lastUpdated:'2026-03-28 14:00'},
    {id:'TPL-004', code:'MONTHLY_REPORT', title:'월간 운영 리포트', channels:['MAIL','KKO'],
     body:'{{customerName}} {{month}} 감축 실적 · 정산 예정액 · 개선 제안이 포함된 월간 리포트가 발송되었습니다.',
     active:true, lastUpdated:'2026-04-01 09:00'},
    {id:'TPL-005', code:'TRIAL_SCHEDULED', title:'등록시험 예정 안내', channels:['SMS','KKO','MAIL'],
     body:'{{groupName}} 자원 등록시험이 {{date}}에 예정되어 있습니다. 시험 당일 정상 가동 상태를 유지해 주세요.',
     active:true, lastUpdated:'2026-04-15 11:00'},
  ];
  const mkSendLog = (i,{evt,cust,tpl,ch,result,ack,at})=>({
    id:'SND'+String(i).padStart(5,'0'), eventId:evt, customerId:cust,
    templateCode:tpl, channel:ch, sentAt:at, result, ack
  });
  let idx=0;
  store.commSendLog = [];
  const pushLog = (o)=>{ idx++; store.commSendLog.push(mkSendLog(idx,o)); };
  const liveGrp = [1,2,5,8];
  liveGrp.forEach((gid,gi)=>{
    const g = store.groups.find(x=>x.id===gid); if(!g) return;
    (g.customerIds||[]).forEach((cid,ci)=>{
      const pushResult = (gid===8 && ci<2) ? 'FAIL' : 'OK';
      const pushAck = (gid===8 && ci<2) ? false : (pushResult==='OK' && (ci+gi)%7!==6);
      pushLog({evt:'EVM20260420-01', cust:cid, tpl:'EVENT_ISSUED', ch:'PUSH',
        result:pushResult, ack:pushAck, at:`2026-04-20 13:30:${String(10+ci*3).padStart(2,'0')}`});
      if(!pushAck){
        pushLog({evt:'EVM20260420-01', cust:cid, tpl:'EVENT_ISSUED', ch:'SMS',
          result:'OK', ack:(gid===8 && ci<2) ? false : true,
          at:`2026-04-20 13:45:${String(10+ci*3).padStart(2,'0')}`});
      }
    });
  });
  [1,2,5].forEach((gid,gi)=>{
    const g = store.groups.find(x=>x.id===gid); if(!g) return;
    (g.customerIds||[]).slice(0,2).forEach((cid,ci)=>{
      pushLog({evt:'EVM20260410-01', cust:cid, tpl:'EVENT_END', ch:'KKO',
        result:'OK', ack:true, at:`2026-04-10 16:15:${String(5+ci*4).padStart(2,'0')}`});
    });
  });
  store.groups.filter(g=>g.status==='active').slice(0,3).forEach((g,gi)=>{
    (g.customerIds||[]).slice(0,3).forEach((cid,ci)=>{
      pushLog({evt:null, cust:cid, tpl:'MONTHLY_REPORT', ch:'MAIL',
        result:'OK', ack:null, at:`2026-04-05 09:${String(10+ci*2).padStart(2,'0')}:00`});
    });
  });
  const g4 = store.groups.find(x=>x.id===4);
  if(g4){
    (g4.customerIds||[]).forEach((cid,ci)=>{
      pushLog({evt:'EVT20260405-01', cust:cid, tpl:'UNDER_PERFORM_WARN', ch:'SMS',
        result:'OK', ack:true, at:`2026-04-06 10:${String(10+ci*2).padStart(2,'0')}:00`});
    });
  }
  store.monthlyReportSchedule = {
    nextSendDate:'2026-05-05 09:00', lastSentDate:'2026-04-05 09:00',
    frequency:'매월 5일 09:00',
    includeCustomers:store.groups.filter(g=>g.status==='active')
      .reduce((s,g)=>s+(g.customerIds?.length||0),0),
    contents:['월별 감축 실적','정산 예정 금액','개선 제안','다음달 예상 이벤트'],
  };
  store.commMemos = [
    {id:'MEM-001', customerId:'C011', at:'2026-04-15 14:30', by:'박영업', kind:'통화',
     summary:'EVM20260420 지시 수신 확인 방법 재안내. 앱 푸시 수신 설정 점검.'},
    {id:'MEM-002', customerId:'C013', at:'2026-04-10 11:00', by:'박영업', kind:'방문',
     summary:'월간 리포트 피드백 청취. 감축 가능 시간대 17~19시 확장 검토 요청.'},
    {id:'MEM-003', customerId:'C041', at:'2026-04-07 10:15', by:'현진영', kind:'통화',
     summary:'등록시험 불합격(42%) 원인 확인. 설비 노후로 재투자 필요. 차기 등록기간 재신청 협의.'},
    {id:'MEM-004', customerId:'C042', at:'2026-04-08 15:00', by:'현진영', kind:'이메일',
     summary:'충남B 자원 재구성 논의. C042 단독 참여 여부 검토 요청 회신.'},
    {id:'MEM-005', customerId:'C016', at:'2026-04-18 09:45', by:'박영업', kind:'통화',
     summary:'연간 참여 계약 갱신 의사 확인 완료. 5월 중 정식 계약서 수령.'},
  ];
})();

/* COM · 상태 & 유틸 */
const CH_META = {
  PUSH:{label:'앱푸시', color:'var(--blue)',   bg:'var(--blue-light)'},
  SMS :{label:'SMS',    color:'var(--purple)', bg:'var(--purple-light)'},
  KKO :{label:'알림톡', color:'var(--amber)',  bg:'var(--amber-light)'},
  MAIL:{label:'이메일', color:'var(--gray)',   bg:'var(--gray-light)'},
};

const CATEGORY_META = {
  EVENT_DISPATCH:{label:'감축지시', color:'#dc2626', bg:'#fee2e2'},
  EVENT_END     :{label:'감축종료', color:'#059669', bg:'#d1fae5'},
  UNDER_PERFORM :{label:'미달경고', color:'#d97706', bg:'#fed7aa'},
  REPORT        :{label:'리포트',   color:'#4a7fd4', bg:'#dbeafe'},
  CUSTOM        :{label:'공지',     color:'#6b7280', bg:'#f3f4f6'},
};

/* 템플릿 코드 기반 카테고리 추론 (기존 시드 호환) */
(function seedBidding(){
  // ═══ 입찰 이력 시드 (자발적DR/플러스DR) ═══
  // 기존 store.bids 폐기 · 모두 이벤트로 통합
  // 낙찰 전/유찰은 bidStatus 필드로 표시 (감축 모니터링/운영리포트는 status 기반이라 영향 없음)
  store.events.reduction.push(
    // 과거 낙찰·완료된 자발적감축 (2026-04-12)
    {
      id:'EVV20260412-01',
      dispatch_type:'VOLUNTARY_REDUCTION',
      category:'operation',
      date:'2026-04-12', timeRange:'14:00~15:00',
      label:'2026-04-12 14:00~15:00 · 자발적감축',
      source:'KPX', live:false,
      bid:{
        submittedAt:'2026-04-12 08:20', submittedBy:'김감축',
        bidVolume:500, bidProgram:'ECONOMIC',
        awardedAt:'2026-04-12 11:00', awardedVolume:500,
        rejectionReason:''
      },
      resources:[
        {groupId:1, ordered:500, actual:478, status:'NORMAL'},
      ]
    },
    // 유찰된 자발적감축 (2026-04-14)
    {
      id:'EVV20260414-01',
      dispatch_type:'VOLUNTARY_REDUCTION',
      category:'operation',
      date:'2026-04-14', timeRange:'14:00~15:00',
      label:'2026-04-14 14:00~15:00 · 자발적감축 (유찰)',
      source:'KPX', live:false, scheduled:false,
      bid:{
        submittedAt:'2026-04-14 08:15', submittedBy:'김감축',
        bidVolume:600, bidProgram:'ECONOMIC',
        awardedAt:'2026-04-14 11:00', awardedVolume:0,
        rejectionReason:'입찰가 과다 — 차기 입찰 시 가격 전략 재검토'
      },
      bidStatus:'BID_REJECTED',
      resources:[
        {groupId:1, ordered:600, actual:null, status:'CANCELLED'},
      ]
    },
    // 유찰된 자발적감축 (2026-04-17, 중소형DR)
    {
      id:'EVV20260417-01',
      dispatch_type:'VOLUNTARY_REDUCTION',
      category:'operation',
      date:'2026-04-17', timeRange:'14:00~15:00',
      label:'2026-04-17 14:00~15:00 · 자발적감축 (유찰)',
      source:'KPX', live:false, scheduled:false,
      bid:{
        submittedAt:'2026-04-17 08:25', submittedBy:'현진영',
        bidVolume:200, bidProgram:'ECONOMIC',
        awardedAt:'2026-04-17 11:00', awardedVolume:0,
        rejectionReason:'입찰가 과다 — 차기 입찰 시 가격 전략 재검토'
      },
      bidStatus:'BID_REJECTED',
      resources:[
        {groupId:2, ordered:200, actual:null, status:'CANCELLED'},
      ]
    },
    // 낙찰·완료된 플러스DR 계획 (2026-04-18)
    {
      id:'EVP20260418-01',
      dispatch_type:'VOLUNTARY_INCREASE',
      category:'operation',
      date:'2026-04-18', timeRange:'15:00~16:00',
      label:'2026-04-18 15:00~16:00 · 플러스DR (계획)',
      source:'KPX', live:false,
      bid:{
        submittedAt:'2026-04-17 16:20', submittedBy:'현진영',
        bidVolume:800, bidProgram:'PLUS_PLANNED',
        awardedAt:'2026-04-17 18:00', awardedVolume:800,
        rejectionReason:''
      },
      resources:[
        {groupId:1, ordered:800, actual:780, status:'NORMAL'},
      ]
    },
    // 추가 접수중 자발적감축 (2026-04-22, 별도 이벤트 - 제주DR 자원)
    {
      id:'EVV20260422-02',
      dispatch_type:'VOLUNTARY_REDUCTION',
      category:'operation',
      date:'2026-04-22', timeRange:'13:00~14:00',
      label:'2026-04-22 13:00~14:00 · 자발적감축 (접수)',
      source:'KPX', live:false, scheduled:true,
      bid:{
        submittedAt:'2026-04-21 16:35', submittedBy:'현진영',
        bidVolume:300, bidProgram:'ECONOMIC',
        awardedAt:null, awardedVolume:null,
        rejectionReason:''
      },
      bidStatus:'BID_SUBMITTED',
      resources:[
        {groupId:8, ordered:300, actual:null, status:'SCHEDULED'},
      ]
    },
  );
})();

/* BID · 입찰관리 (이벤트 통합)
   - store.bids 폐기 · event.bid 기반
   - 자발적감축(VOLUNTARY_REDUCTION) + 플러스DR 계획(VOLUNTARY_INCREASE)만 표시
   - 실시간 플러스DR(REALTIME_INCREASE_REQUEST)는 입찰 없음 → 제외 */
const BID_TYPE_META = {
  VOLUNTARY_REDUCTION:       {label:'자발적감축',     badge:'badge-purple'},
  VOLUNTARY_INCREASE:        {label:'플러스DR (계획)', badge:'badge-progress'},
};
const BID_STATUS_META = {
  BID_SUBMITTED: {label:'접수',        badge:'badge-pending'},
  BID_WON:       {label:'낙찰',        badge:'badge-done'},
  BID_REJECTED:  {label:'유찰',        badge:'badge-fail'},
  ACTIVE:        {label:'낙찰·진행중', badge:'badge-progress'},
  COMPLETED:     {label:'낙찰·완료',   badge:'badge-done'},
};

(function seedSystem(){
  store.auditLog = [
    {at:'2026-04-21 13:45:22', user:'현진영', role:'SUPER_ADMIN', action:'공통코드 수정', target:'CD-01 · STD', ip:'10.0.12.44', result:'성공'},
    {at:'2026-04-21 11:30:15', user:'박정산', role:'OPS_MANAGER', action:'정산 배치 생성', target:'STL-2026-Q2', ip:'10.0.12.51', result:'성공'},
    {at:'2026-04-21 10:25:08', user:'박정산', role:'OPS_MANAGER', action:'이의제기 등록',  target:'EVV20260312-01', ip:'10.0.12.51', result:'성공'},
    {at:'2026-04-20 13:30:00', user:'시스템', role:'—',            action:'지시 알림 자동발송', target:'EVM20260420-01 (47건)', ip:'—', result:'성공'},
    {at:'2026-04-20 13:29:58', user:'시스템', role:'—',            action:'KPX 이벤트 수신', target:'EVM20260420-01', ip:'—', result:'성공'},
    {at:'2026-04-20 08:32:11', user:'김감축', role:'OPS_MANAGER', action:'입찰 등록',       target:'EVV20260420-01', ip:'10.0.12.63', result:'성공'},
    {at:'2026-04-19 17:18:55', user:'박영업', role:'SALES',       action:'사전검증 반려',   target:'C109 서진물류센터', ip:'10.0.12.72', result:'성공'},
    {at:'2026-04-19 09:02:30', user:'외부감사', role:'AUDITOR',  action:'감사로그 조회',    target:'2026-03 전체',   ip:'203.xx.xx.xx', result:'성공'},
    {at:'2026-04-18 16:45:10', user:'현진영', role:'SUPER_ADMIN', action:'계정 생성',       target:'이모니터 (OPS_WORKER)', ip:'10.0.12.44', result:'성공'},
    {at:'2026-04-18 14:12:08', user:'최발송', role:'OPS_WORKER', action:'상담 메모 작성',   target:'C041',          ip:'10.0.12.88', result:'성공'},
  ];
})();

/* SYS · 렌더러 (감사로그 전용) */
function openCommonModal(title, sub, bodyHTML, footerActions){
  $('cm-title').textContent = title;
  $('cm-sub').textContent = sub || '';
  $('cm-body').innerHTML = bodyHTML || '';
  $('cm-footer').innerHTML = (footerActions&&footerActions.length)
    ? footerActions.map(a=>`<button class="btn ${a.cls||''}" onclick="${a.onclick||''}">${a.label}</button>`).join('')
    : `<button class="btn btn-secondary" onclick="closeModal('commonModal')">닫기</button>`;
  $('commonModal').classList.add('active');
}

/* 사이드바 뱃지 갱신 (신규 메뉴 수신확인 / 입찰 포함) */
(function patchSidebarBadges(){
  const orig = refreshSidebarBadges;
  refreshSidebarBadges = function(){
    orig();
    const pendingCount = store.commSendLog ? store.commSendLog.filter(l=>l.ack===false).length : 0;
    const comBadge = $('sb-com-badge');
    if(comBadge){
      if(pendingCount>0){
        comBadge.textContent = '미확인 '+pendingCount;
        comBadge.style.background = 'var(--amber)';
        comBadge.style.display = 'inline-block';
        comBadge.title = `수신 미확인 ${pendingCount}건`;
      } else { comBadge.style.display = 'none'; }
    }
    // 입찰 접수 대기 건수 = bidStatus가 BID_SUBMITTED인 이벤트 + 낙찰 전 bid 보유 이벤트
    const openBid = store.events.reduction.filter(e=>{
      if(!e.bid) return false;
      if(e.bidStatus==='BID_SUBMITTED') return true;
      return e.bid.awardedVolume == null && !e.bidStatus;
    }).length;
    const bidBadge = $('sb-bid-badge');
    if(bidBadge){
      if(openBid>0){ bidBadge.textContent = openBid; bidBadge.style.display='inline-block'; }
      else { bidBadge.style.display='none'; }
    }
  };
})();

/* ══════════════════════════════════════════════════════════════════════
   LOGIN · LOGOUT · 계정관리 모달 유틸
══════════════════════════════════════════════════════════════════════ */
let loginFailCount = 0;
let lockUntil = null;

function doLogin(e){
  if(e && e.preventDefault) e.preventDefault();
  const idEl = $('loginId');
  const pwEl = $('loginPw');
  if(!idEl || !pwEl) return false;
  const id = (idEl.value||'').trim().toLowerCase();
  const pw = (pwEl.value||'').trim();
  const alertBox = $('loginAlert');
  alertBox.className = 'login-alert';
  if(lockUntil && Date.now()<lockUntil){
    const remain = Math.ceil((lockUntil-Date.now())/60000);
    alertBox.textContent = `계정이 잠겼습니다. 약 ${remain}분 후 재시도하거나 관리자에게 문의하세요.`;
    alertBox.classList.add('show'); return false;
  }
  // 데모 계정 체크 — 대소문자 무시, 공백 제거
  const DEMO_ID = 'admin@60hz.io';
  const DEMO_PW = 'Demo1234!';
  if(id === DEMO_ID && pw === DEMO_PW){
    loginFailCount = 0;
    lockUntil = null;
    alertBox.classList.add('show','info');
    alertBox.textContent = '로그인 성공. 운영시스템으로 이동합니다...';
    try{ if($('loginKeep').checked) sessionStorage.setItem('dr_last_id', id); }catch(_){}
    if(window.store && store.auditLog){
      store.auditLog.unshift({
        at: new Date().toISOString().substring(0,19).replace('T',' '),
        user:'현진영', role:'SUPER_ADMIN', action:'로그인',
        target:'운영시스템 접속', ip:'10.0.12.44', result:'성공'
      });
    }
    setTimeout(()=>{
      try{
        $('loginScreen').style.display = 'none';
        $('appWrap').style.display = 'flex';
        if(typeof navigate === 'function') navigate('dashboard');
      }catch(err){
        console.error('로그인 후 이동 실패:', err);
        alertBox.textContent = '페이지 이동 중 오류가 발생했습니다: ' + err.message;
      }
    }, 500);
    return false;
  }
  loginFailCount++;
  pwEl.classList.add('error');
  if(loginFailCount>=5){
    lockUntil = Date.now()+30*60*1000;
    alertBox.textContent = `로그인 실패가 5회 누적되어 계정이 30분간 잠겼습니다. (보안 정책)`;
    alertBox.classList.add('show');
  }else{
    // 디버그 정보 포함 — 어느 단계에서 실패했는지 명확히
    const reason = id !== DEMO_ID ? '아이디 불일치' : '비밀번호 불일치';
    alertBox.textContent = `로그인 실패 — ${reason}. (${loginFailCount}/5회) · 데모: admin@60hz.io / Demo1234!`;
    alertBox.classList.add('show','amber');
  }
  return false;
}
function checkCaps(e){
  if(e.getModifierState && e.getModifierState('CapsLock')) $('capsWarn').classList.add('show');
  else $('capsWarn').classList.remove('show');
}
function toggleLoginPw(){
  const el = $('loginPw');
  el.type = el.type==='password' ? 'text' : 'password';
}
function openFindPw(){ openModalAcct('modalFindPw'); }
function submitFindPw(){
  const email = $('findPwEmail').value.trim();
  if(!email){ showToast('이메일을 입력하세요'); return; }
  if(!store.passwordResetRequests) store.passwordResetRequests = [];
  store.passwordResetRequests.unshift({
    id:`PW-${Date.now()}`,
    email,
    requestedAt: nowStr(),
    expiresAt: `${todayStr()} 23:59`,
    channel:'EMAIL',
    requestedBy:'self-service'
  });
  if(store.auditLog){
    store.auditLog.unshift({
      at: new Date().toISOString().substring(0,19).replace('T',' '),
      user:'미로그인 사용자', role:'—', action:'비밀번호 재설정 요청',
      target: email, ip:'10.0.12.44', result:'성공'
    });
  }
  closeModalAcct('modalFindPw');
  $('findPwEmail').value = '';
  showToast(`재설정 링크 발송 요청이 접수되었습니다. (${email})`);
}
function doLogout(){
  // 인앱 confirm 모달 (브라우저 기본 confirm 대체)
  const m = document.getElementById('logoutConfirmModal');
  if(m){ m.classList.add('show'); return; }
  // 폴백: 모달이 없으면 기본 confirm
  if(!confirm('로그아웃 하시겠습니까?')) return;
  performLogout();
}
function performLogout(){
  const m = document.getElementById('logoutConfirmModal');
  if(m) m.classList.remove('show');
  if(store.auditLog){
    store.auditLog.unshift({
      at: new Date().toISOString().substring(0,19).replace('T',' '),
      user:'현진영', role:'SUPER_ADMIN', action:'로그아웃',
      target:'운영시스템 세션 종료', ip:'10.0.12.44', result:'성공'
    });
  }
  $('appWrap').style.display = 'none';
  $('loginScreen').style.display = 'flex';
  $('loginPw').value = '';
  $('loginPw').classList.remove('error');
  $('loginAlert').className = 'login-alert';
  $('loginId').focus();
  showToast('로그아웃되었습니다.');
}
function cancelLogout(){
  const m = document.getElementById('logoutConfirmModal');
  if(m) m.classList.remove('show');
}
function openModalAcct(id){ $(id).classList.add('show'); }
function closeModalAcct(id){ $(id).classList.remove('show'); }

/* 데모 즉시 로그인 — 자동완성/타이핑 이슈 완전 우회 */
function doDemoLogin(){
  $('loginId').value = 'admin@60hz.io';
  $('loginPw').value = 'Demo1234!';
  doLogin({preventDefault:()=>{}});
}

/* ══════════════════════════════════════════════════════════════════════
   ACCOUNT MANAGEMENT — 계정관리 (IIFE로 네임스페이스 격리)
══════════════════════════════════════════════════════════════════════ */
(function(){
const ROLES = [
  { code:'SYS_ADMIN', name:'시스템관리자', color:'purple',
    desc:'전 메뉴 CRUD + 계정/권한/시스템 설정. 최소 인원 유지 권장.',
    perms:{dashboard:['R'],precheck:['R','C','U','D'],resource:['R','C','U','D'],monitoring:['R','C','U','D','X'],report:['R','C','U','D'],settlement:['R','C','U','D'],datacollect:['R','C','U','D'],communication:['R','C','U','D'],bidding:['R','C','U','D','X'],account:['R','C','U','D'],audit:['R'],system:['R','C','U','D']}},
  { code:'DR_OPERATOR', name:'DR 운영팀', color:'blue',
    desc:'자원/고객 관리, DR 이벤트 발령 및 실시간 모니터링, 운영 리포트 작성.',
    perms:{dashboard:['R'],precheck:['R','C','U','D'],resource:['R','C','U','D'],monitoring:['R','C','U','D','X'],report:['R','C','U','D'],settlement:['R'],datacollect:['R'],communication:['R','C','U'],bidding:['R','C','U','X'],account:[],audit:[],system:[]}},
  { code:'SETTLEMENT', name:'정산담당자', color:'green',
    desc:'CBL 산정, 정산 배치 실행, 이의신청 처리, 정산 리포트 승인.',
    perms:{dashboard:['R'],precheck:['R'],resource:['R'],monitoring:['R'],report:['R','U'],settlement:['R','C','U','D','X'],datacollect:['R'],communication:['R'],bidding:['R'],account:[],audit:[],system:[]}},
  { code:'CUSTOMER_SUPPORT', name:'고객지원', color:'amber',
    desc:'고객/자원 정보 조회·일부 수정, 이의신청 접수, 문의 대응.',
    perms:{dashboard:['R'],precheck:['R','U'],resource:['R','U'],monitoring:['R'],report:['R'],settlement:['R'],datacollect:[],communication:['R','C','U'],bidding:[],account:[],audit:[],system:[]}},
  { code:'VIEWER', name:'조회자', color:'gray',
    desc:'읽기 전용. 감사인/외부 파트너/경영진 모니터링용.',
    perms:{dashboard:['R'],precheck:['R'],resource:['R'],monitoring:['R'],report:['R'],settlement:['R'],datacollect:['R'],communication:['R'],bidding:['R'],account:[],audit:[],system:[]}},
];
const ROLE_MAP = Object.fromEntries(ROLES.map(r=>[r.code,r]));
const MENUS = [
  {key:'dashboard', label:'대시보드'},
  {key:'precheck',  label:'사전검증 관리'},
  {key:'resource',  label:'자원관리'},
  {key:'monitoring',label:'감축 모니터링 (이벤트 발령 = X)'},
  {key:'report',    label:'운영 리포트'},
  {key:'settlement',label:'정산관리 (배치 실행 = X)'},
  {key:'datacollect',label:'전력데이터 수집'},
  {key:'communication',label:'고객 소통'},
  {key:'bidding',   label:'입찰 관리 (입찰 제출 = X)'},
  {key:'account',   label:'계정관리'},
  {key:'audit',     label:'감사 로그'},
  {key:'system',    label:'시스템 설정'},
];
const STATUS_META = {
  ACTIVE:   {label:'활성',    badge:'badge-green',  dot:'#22c55e'},
  LOCKED:   {label:'잠김',    badge:'badge-red',    dot:'#ef4444'},
  INACTIVE: {label:'비활성',  badge:'badge-gray',   dot:'#94a3b8'},
  EXPIRED:  {label:'만료',    badge:'badge-amber',  dot:'#f59e0b'},
  PENDING:  {label:'초대 대기',badge:'badge-blue',  dot:'#4A7FD4'},
};
const DEMO_ACCOUNTS = [
  {id:'u001', email:'admin@60hz.io',     name:'현진영', empNo:'20200001', role:'SYS_ADMIN',       team:'IT운영팀',   position:'CTO',     status:'ACTIVE',  lastLogin:'2026-04-21 13:42', lastIp:'10.0.1.12',   validUntil:null, mfa:true,  createdAt:'2024-03-01'},
  {id:'u002', email:'jho.park@60hz.io',  name:'박재호', empNo:'20200015', role:'DR_OPERATOR',     team:'DR운영팀',   position:'팀장',    status:'ACTIVE',  lastLogin:'2026-04-21 09:15', lastIp:'10.0.1.34',   validUntil:null, mfa:true,  createdAt:'2024-05-12'},
  {id:'u003', email:'syj.kim@60hz.io',   name:'김수연', empNo:'20210042', role:'DR_OPERATOR',     team:'DR운영팀',   position:'매니저',  status:'ACTIVE',  lastLogin:'2026-04-20 18:33', lastIp:'10.0.1.58',   validUntil:null, mfa:true,  createdAt:'2024-06-21'},
  {id:'u004', email:'hjs.lee@60hz.io',   name:'이현수', empNo:'20220103', role:'SETTLEMENT',      team:'정산팀',     position:'팀장',    status:'ACTIVE',  lastLogin:'2026-04-21 10:07', lastIp:'10.0.1.71',   validUntil:null, mfa:true,  createdAt:'2024-08-05'},
  {id:'u005', email:'ebs.choi@60hz.io',  name:'최은비', empNo:'20230071', role:'SETTLEMENT',      team:'정산팀',     position:'주임',    status:'LOCKED',  lastLogin:'2026-04-18 16:22', lastIp:'10.0.1.88',   validUntil:null, mfa:false, createdAt:'2024-11-18'},
  {id:'u006', email:'dw.jung@60hz.io',   name:'정도원', empNo:'20230112', role:'CUSTOMER_SUPPORT',team:'고객지원팀', position:'매니저',  status:'ACTIVE',  lastLogin:'2026-04-21 11:04', lastIp:'10.0.2.10',   validUntil:null, mfa:false, createdAt:'2024-12-03'},
  {id:'u007', email:'sh.yoon@60hz.io',   name:'윤소현', empNo:'20230145', role:'CUSTOMER_SUPPORT',team:'고객지원팀', position:'주임',    status:'ACTIVE',  lastLogin:'2026-04-20 17:51', lastIp:'10.0.2.14',   validUntil:null, mfa:false, createdAt:'2025-01-14'},
  {id:'u008', email:'inspector@audit.ext',name:'감사원 김', empNo:'EXT001',role:'VIEWER',        team:'외부파트너',  position:'감사인',  status:'ACTIVE',  lastLogin:'2026-04-15 10:00', lastIp:'218.55.12.3', validUntil:'2026-06-30', mfa:true, createdAt:'2025-12-01'},
  {id:'u009', email:'tmp.partner@60hz.io',name:'장민호', empNo:'TMP023',   role:'DR_OPERATOR',   team:'외부파트너',  position:'파트너',  status:'EXPIRED', lastLogin:'2026-03-12 14:00', lastIp:'221.148.9.77',validUntil:'2026-04-01', mfa:false,createdAt:'2025-10-01'},
  {id:'u010', email:'newbie@60hz.io',     name:'신입사원', empNo:'20260001',role:'VIEWER',       team:'운영본부',    position:'사원',    status:'PENDING', lastLogin:'-',                lastIp:'-',           validUntil:null, mfa:false, createdAt:'2026-04-20'},
  {id:'u011', email:'dormant@60hz.io',    name:'한지훈', empNo:'20190003', role:'DR_OPERATOR',   team:'DR운영팀',    position:'매니저',  status:'ACTIVE',  lastLogin:'2025-11-10 09:00', lastIp:'10.0.1.44',   validUntil:null, mfa:true,  createdAt:'2019-05-10'},
  {id:'u012', email:'resigned@60hz.io',   name:'전영주', empNo:'20210088', role:'DR_OPERATOR',   team:'DR운영팀',    position:'매니저',  status:'INACTIVE',lastLogin:'2026-02-28 18:00', lastIp:'10.0.1.66',   validUntil:null, mfa:true,  createdAt:'2021-04-01'},
];
let accounts = JSON.parse(JSON.stringify(DEMO_ACCOUNTS));
let selectedIds = new Set();
let currentTargetId = null;
let permRoleCode = null;
let permOverrides = null;
let newPermOverrides = null;

/* 감사로그 자동 기록 헬퍼 */
function logAudit(action, target, result='성공'){
  if(!store.auditLog) return;
  store.auditLog.unshift({
    at: new Date().toISOString().substring(0,19).replace('T',' '),
    user:'현진영', role:'SUPER_ADMIN', action, target,
    ip:'10.0.12.44', result
  });
}

/* ── 초기화 & 렌더 ── */
window.acctInit = acctInit;
window.acctRender = acctRender;
window.acctResetFilters = acctResetFilters;
window.acctToggleSel = acctToggleSel;
window.acctToggleAll = acctToggleAll;
window.acctBulkAction = acctBulkAction;
window.acctOpenCreate = acctOpenCreate;
window.acctOnNewRoleChange = acctOnNewRoleChange;
window.acctOnNewPermToggle = acctOnNewPermToggle;
window.acctValidateEmail = acctValidateEmail;
window.acctSubmitCreate = acctSubmitCreate;
window.acctOpenPerm = acctOpenPerm;
window.acctOnPermRoleChange = acctOnPermRoleChange;
window.acctOnPermToggle = acctOnPermToggle;
window.acctSubmitPerm = acctSubmitPerm;
window.acctOpenReset = acctOpenReset;
window.acctOnResetModeChange = acctOnResetModeChange;
window.acctSubmitReset = acctSubmitReset;
window.acctOpenDelete = acctOpenDelete;
window.acctSubmitDelete = acctSubmitDelete;
window.acctReactivate = acctReactivate;
window.acctUnlock = acctUnlock;
window.acctOpenDrawer = acctOpenDrawer;
window.acctCloseDrawer = acctCloseDrawer;
window.logAudit = logAudit;
})();


/* ════════════════════════════════════════════════════════════
   ★ 계약관리
════════════════════════════════════════════════════════════ */
(function boot(){
  // 세션 복구: 이전에 아이디 저장 체크했다면 자동 채움
  try{
    const last = sessionStorage.getItem('dr_last_id');
    if(last){ $('loginId').value = last; $('loginKeep').checked = true; }
  }catch(_){}
  $('loginId').focus();
  // 앱 본체는 로그인 전에는 렌더만 준비 (display:none 상태)
  renderDashboard();
  refreshSidebarBadges();
})();
