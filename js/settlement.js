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

/* [Phase 17-BS] 정산 sub-tab 전환 — 기본 정산금 / 실적정산금 view 분기 */
let stmActiveSubTab = 'basic';
function stmSwitchSubTab(tab){
  stmActiveSubTab = tab || 'basic';
  const titleEl = document.querySelector('#page-settlement .page-title');
  if(titleEl){
    const label = tab === 'mandatory' ? '실적정산금 (의무)'
                : tab === 'voluntary' ? '실적정산금 (자발)'
                : '기본 정산금';
    titleEl.innerHTML = `고객정산관리 <span style="font-size:13px;font-weight:500;color:var(--text-sub);margin-left:8px;">› ${label}</span>`;
  }
  const basicView = document.getElementById('stm-basic-view');
  const perfView  = document.getElementById('stm-perf-view');
  if(basicView && perfView){
    if(tab === 'basic'){
      basicView.style.display = '';
      perfView.style.display  = 'none';
      stmBasicInit();
    } else {
      basicView.style.display = 'none';
      perfView.style.display  = '';
      // 기존 실적 정산금 화면 (mandatory/voluntary 공통, 추후 분리)
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   [Phase 17-BS] 기본 정산금 — 신뢰성DR 자원의 매월 KPX 정산 + 사업자 배분
   - 자원그룹 단위 row (매월 한 행)
   - KPX 입금금액 운영자 직접 입력 (공급가액·부가세·합계)
   - 사업자별 배분 = 60hz 계약전력 비중
   - 수수료 = 배분금액 × feeRate
   - 실 지급액 = 배분금액 − 수수료
═══════════════════════════════════════════════════════════════ */

/* 시드: 자원그룹 × 월별 기본 정산금 — 신뢰성DR 자원만 (의무감축 가능) */
const stmBasicSeed = (() => {
  // 신뢰성DR = 표준DR / 중소형DR / 국민DR / 제주DR (의무감축 가능)
  const reliabilityTypes = ['표준DR', '중소형DR', '국민DR', '제주DR'];
  const months = ['2026-04', '2026-05', '2026-06'];
  const seed = [];
  if(typeof store !== 'undefined' && Array.isArray(store.groups)){
    store.groups.forEach(g => {
      if(!reliabilityTypes.includes(g.type)) return;
      if(g.status !== 'active') return;
      months.forEach((month, idx) => {
        // 의무감축용량 기반 KPX 기본단가 (예: ₩202/kW·월)
        const baseUnitPrice = 202;
        const supply = (g.reg?.mandatoryCapacity || 1000) * baseUnitPrice;
        const vat = Math.round(supply * 0.1);
        const total = supply + vat;
        // 상태 분포 — 최근 월일수록 pending 비중 ↑
        const statusByIdx = idx === 0 ? ['completed','completed','in_progress']
                          : idx === 1 ? ['invoiced','in_progress','completed']
                          : ['pending','pending','invoiced'];
        const status = statusByIdx[g.id % statusByIdx.length] || 'pending';
        seed.push({
          id: `STMB-${g.id}-${month.replace('-','')}`,
          groupId: g.id,
          groupName: g.name,
          drType: g.type,
          mandatoryCapacity: g.reg?.mandatoryCapacity || 0,
          month,
          kpxSupply: status === 'pending' ? 0 : supply,
          kpxVat:    status === 'pending' ? 0 : vat,
          kpxTotal:  status === 'pending' ? 0 : total,
          kpxDate:   status === 'pending' ? '' : `${month}-15`,
          status,
          customerIds: g.customerIds || [],
        });
      });
    });
  }
  return seed;
})();

const stmBasicState = {
  month: '2026-06',
  status: 'all',
  search: '',
  currentDetailId: null,   // [Phase 17-BT] 상세 진입 시 row id
};

function stmBasicInit(){
  // [Phase 17-CP] 사이드바로 기본 정산금 재진입 시 항상 리스트 모드로 리셋
  //   (상세 진입 상태에서 다른 페이지 갔다 돌아와도 리스트 노출)
  stmBasicState.currentDetailId = null;
  stmBasicToggleViews(false);

  // 필터 초기값 설정 (한 번만)
  const monthEl = document.getElementById('stmb-month');
  if(monthEl && !monthEl.value) monthEl.value = stmBasicState.month;
  stmBasicRender();
}

function stmBasicReset(){
  stmBasicState.month = '2026-06';
  stmBasicState.status = 'all';
  stmBasicState.search = '';
  document.getElementById('stmb-month').value = '2026-06';
  document.getElementById('stmb-status').value = 'all';
  document.getElementById('stmb-search').value = '';
  stmBasicRender();
}

function stmBasicFilterByStatus(s){
  stmBasicState.status = s || 'all';
  const el = document.getElementById('stmb-status');
  if(el) el.value = stmBasicState.status;
  stmBasicRender();
}

function stmBasicFilteredRows(){
  const month = document.getElementById('stmb-month')?.value || stmBasicState.month;
  const status = document.getElementById('stmb-status')?.value || stmBasicState.status;
  const search = (document.getElementById('stmb-search')?.value || '').trim().toLowerCase();
  stmBasicState.month = month;
  stmBasicState.status = status;
  stmBasicState.search = search;
  return stmBasicSeed.filter(r => {
    if(month && r.month !== month) return false;
    if(status !== 'all' && r.status !== status) return false;
    if(search && !(r.groupName.toLowerCase().includes(search))) return false;
    return true;
  });
}

function stmBasicStatusBadge(s){
  const map = {
    'pending':     { cls:'badge-pending', label:'KPX 입금 대기' },
    'invoiced':    { cls:'badge-progress', label:'세금계산서 발행' },
    'in_progress': { cls:'badge-progress', label:'입금 진행' },
    'completed':   { cls:'badge-done', label:'정산완료' },
  };
  return map[s] || { cls:'badge-gray', label:s };
}

function stmBasicRender(){
  const rows = stmBasicFilteredRows();
  // KPI 갱신
  const countBy = s => stmBasicSeed.filter(r => r.month === stmBasicState.month && r.status === s).length;
  document.getElementById('stmb-kpi-total').textContent    = stmBasicSeed.filter(r => r.month === stmBasicState.month).length;
  document.getElementById('stmb-kpi-pending').textContent  = countBy('pending');
  document.getElementById('stmb-kpi-invoiced').textContent = countBy('invoiced');
  document.getElementById('stmb-kpi-inprog').textContent   = countBy('in_progress');
  document.getElementById('stmb-kpi-done').textContent     = countBy('completed');

  const body = document.getElementById('stmb-list-body');
  if(!body) return;
  if(rows.length === 0){
    body.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-hint);font-size:13px;background:#fff;border:1px solid var(--border);border-radius:var(--r);margin-top:12px;">조건에 맞는 정산 데이터가 없습니다.</div>`;
    return;
  }
  // 자원그룹별 사업자 수·60hz 계약전력 합 계산
  const grpInfo = (g) => {
    const sites60hzKw = (g.customerIds || []).reduce((sum, cid) => {
      const c = (typeof custById === 'function') ? custById(cid) : (store.customers||[]).find(x=>x.id===cid);
      if(!c) return sum;
      const siteSum = (c.sites || []).reduce((s2, st) => s2 + (st.contract?.power || 0), 0);
      return sum + (siteSum || c.power || 0);
    }, 0);
    return { count: (g.customerIds || []).length, kw: sites60hzKw };
  };

  body.innerHTML = `
  <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-top:12px;box-shadow:var(--shadow-xs);">
    <table style="width:100%;border-collapse:collapse;font-size:var(--fs-sm);">
      <thead>
        <tr style="background:var(--g-100);">
          <th style="padding:var(--sp-3) var(--sp-5);text-align:left;font-weight:600;color:var(--text-sub);font-size:var(--fs-xs);">정산월</th>
          <th style="padding:var(--sp-3) var(--sp-5);text-align:left;font-weight:600;color:var(--text-sub);font-size:var(--fs-xs);">자원그룹</th>
          <th style="padding:var(--sp-3) var(--sp-5);text-align:right;font-weight:600;color:var(--text-sub);font-size:var(--fs-xs);">참여고객</th>
          <th style="padding:var(--sp-3) var(--sp-5);text-align:right;font-weight:600;color:var(--text-sub);font-size:var(--fs-xs);">60hz 계약전력</th>
          <th style="padding:var(--sp-3) var(--sp-5);text-align:right;font-weight:600;color:var(--text-sub);font-size:var(--fs-xs);">KPX 입금금액</th>
          <th style="padding:var(--sp-3) var(--sp-5);text-align:center;font-weight:600;color:var(--text-sub);font-size:var(--fs-xs);">정산 상태</th>
          <th style="padding:var(--sp-3) var(--sp-5);text-align:center;font-weight:600;color:var(--text-sub);font-size:var(--fs-xs);">상세</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const g = (typeof groupById === 'function') ? groupById(r.groupId) : (store.groups||[]).find(x=>x.id===r.groupId);
          if(!g) return '';
          const info = grpInfo(g);
          const badge = stmBasicStatusBadge(r.status);
          const kpx = r.kpxTotal > 0
            ? `<div style="font-weight:600;color:var(--navy);">₩ ${r.kpxTotal.toLocaleString()}</div>
               <div style="font-size:10px;color:var(--text-hint);">공급 ${r.kpxSupply.toLocaleString()} + VAT ${r.kpxVat.toLocaleString()}</div>`
            : `<span style="color:var(--text-hint);">미입력</span>`;
          return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:var(--sp-4) var(--sp-5);font-variant-numeric:tabular-nums;font-weight:500;">${r.month}</td>
            <td style="padding:var(--sp-4) var(--sp-5);">
              <div style="font-weight:600;color:var(--navy);">${g.name}</div>
              <div style="font-size:10px;color:var(--text-hint);margin-top:2px;">${r.drType} · 의무감축 ${r.mandatoryCapacity.toLocaleString()} kW</div>
            </td>
            <td style="padding:var(--sp-4) var(--sp-5);text-align:right;font-weight:500;">${info.count}명</td>
            <td style="padding:var(--sp-4) var(--sp-5);text-align:right;font-weight:500;font-variant-numeric:tabular-nums;">${info.kw.toLocaleString()} kW</td>
            <td style="padding:var(--sp-4) var(--sp-5);text-align:right;font-variant-numeric:tabular-nums;">${kpx}</td>
            <td style="padding:var(--sp-4) var(--sp-5);text-align:center;"><span class="badge ${badge.cls}">${badge.label}</span></td>
            <td style="padding:var(--sp-4) var(--sp-5);text-align:center;"><button class="btn btn-secondary btn-sm" onclick="stmBasicOpenDetail('${r.id}')">상세</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
  <div style="padding:12px 4px;font-size:11px;color:var(--text-hint);">총 ${rows.length}건 · ${stmBasicState.month} 기준</div>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   [Phase 17-BT] 기본 정산금 — 상세 페이지
═══════════════════════════════════════════════════════════════ */

function stmBasicOpenDetail(rowId){
  stmBasicState.currentDetailId = rowId;
  stmBasicToggleViews(true);
  stmBasicRenderDetail();
}

function stmBasicGotoList(){
  stmBasicState.currentDetailId = null;
  stmBasicToggleViews(false);
  stmBasicRender();
}

/* list mode ↔ detail mode 토글 — KPI·필터·list 영역 숨김/표시 */
function stmBasicToggleViews(showDetail){
  // [Phase 17-CP] 이중 안전화 — 자식 순회 + 명시적 ID hide 병행
  const view = document.getElementById('stm-basic-view');
  if(!view) return;
  Array.from(view.children).forEach(child => {
    if(child.id === 'stmb-detail-body'){
      child.style.display = showDetail ? '' : 'none';
    } else {
      child.style.display = showDetail ? 'none' : '';
    }
  });
  // 자식 순회 놓쳐도 확실히 처리
  const listMode = !showDetail;
  ['stmb-wfnote','stmb-kpi-row','stmb-filter-row','stmb-list-body'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = listMode ? '' : 'none';
  });
  const detail = document.getElementById('stmb-detail-body');
  if(detail) detail.style.display = showDetail ? '' : 'none';
}

/* 상세 렌더 — 자원그룹별 정산 row의 detail view */
function stmBasicRenderDetail(){
  const row = stmBasicSeed.find(r => r.id === stmBasicState.currentDetailId);
  const body = document.getElementById('stmb-detail-body');
  if(!row || !body) return;
  const g = (typeof groupById === 'function') ? groupById(row.groupId) : (store.groups||[]).find(x=>x.id===row.groupId);
  if(!g){ body.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-hint);">자원그룹을 찾을 수 없습니다.</div>'; return; }

  // 사업자별 60hz 계약전력 + 평균 feeRate 산출
  const customers = (g.customerIds || []).map(cid => {
    const c = (typeof custById === 'function') ? custById(cid) : (store.customers||[]).find(x=>x.id===cid);
    if(!c) return null;
    const sites = Array.isArray(c.sites) ? c.sites : [];
    const power60hz = sites.reduce((s, st) => s + (st.contract?.power || 0), 0) || (c.power || 0);
    const feeRates = sites.map(st => st.contract?.feeRate).filter(v => v != null);
    const avgFeeRate = feeRates.length ? feeRates.reduce((a,b)=>a+b,0)/feeRates.length : 3.5;  // 기본값
    return { c, power60hz, avgFeeRate, sites: sites.length };
  }).filter(Boolean);

  const totalKw = customers.reduce((s,x) => s + x.power60hz, 0);
  const badge = stmBasicStatusBadge(row.status);

  // 사업자별 배분 계산
  const allocations = customers.map(x => {
    const ratio = totalKw > 0 ? x.power60hz / totalKw : 0;
    const baseAlloc = Math.round((row.kpxSupply || 0) * ratio);   // 기본 배분금액(공급가액 기준)
    const fee = Math.round(baseAlloc * (x.avgFeeRate / 100));
    const payout = baseAlloc - fee;
    return { ...x, ratio, baseAlloc, fee, payout };
  });

  const totalFee = allocations.reduce((s,x) => s + x.fee, 0);
  const totalPayout = allocations.reduce((s,x) => s + x.payout, 0);

  body.innerHTML = `
  <!-- [Phase 17-BU] 헤더 — 정보 위계 재정리: 목록 버튼(좌상단) / 자원명(L1) / 메타(L2) / 상태 뱃지 -->
  <div style="padding:8px 0 16px;">
    <button class="btn btn-secondary btn-sm" onclick="stmBasicGotoList()" style="margin-bottom:14px;">← 목록으로</button>
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:20px 24px;box-shadow:var(--shadow-xs);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:20px;font-weight:700;color:var(--navy);letter-spacing:-0.01em;line-height:1.2;">${g.name}</div>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:var(--text-sub);">
            <span><span style="color:var(--text-hint);">정산월</span> <b style="color:var(--navy);font-weight:600;font-variant-numeric:tabular-nums;">${row.month}</b></span>
            <span style="color:var(--border-dark);">|</span>
            <span><span style="color:var(--text-hint);">DR 유형</span> <b style="color:var(--navy);font-weight:600;">${row.drType}</b></span>
            <span style="color:var(--border-dark);">|</span>
            <span><span style="color:var(--text-hint);">의무감축용량</span> <b style="color:var(--navy);font-weight:600;font-variant-numeric:tabular-nums;">${row.mandatoryCapacity.toLocaleString()} kW</b></span>
          </div>
        </div>
        <span class="badge ${badge.cls}" style="flex-shrink:0;">${badge.label}</span>
      </div>
    </div>
  </div>

  <!-- [Phase 17-CA] 자원 정보 + KPX 입금 + 60hz 마진 — 폰트·패딩 가독성 ↑ -->
  <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:16px;">
    <!-- 자원 정보 -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:22px 26px;box-shadow:var(--shadow-xs);">
      <div style="font-size:14px;font-weight:700;color:var(--navy);margin-bottom:18px;letter-spacing:-0.01em;">자원 정보</div>
      <div style="font-size:18px;font-weight:700;color:var(--navy);margin-bottom:16px;letter-spacing:-0.01em;">${g.name}</div>
      <div style="display:flex;justify-content:space-between;padding:14px 0;border-top:1px solid var(--border);font-size:14px;">
        <span style="color:var(--text-sub);font-weight:500;">참여고객</span>
        <span style="font-weight:700;color:var(--navy);font-size:15px;">${customers.length}명</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:14px 0;border-top:1px solid var(--border);font-size:14px;">
        <span style="color:var(--text-sub);font-weight:500;">60hz 계약전력 합</span>
        <span style="font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums;font-size:15px;">${totalKw.toLocaleString()} kW</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:14px 0;border-top:1px solid var(--border);font-size:14px;">
        <span style="color:var(--text-sub);font-weight:500;">DR 유형</span>
        <span style="font-weight:700;color:var(--navy);font-size:15px;">${row.drType}</span>
      </div>
    </div>

    <!-- KPX 입금 입력 -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:22px 26px;box-shadow:var(--shadow-xs);">
      <div style="font-size:14px;font-weight:700;color:var(--navy);margin-bottom:18px;letter-spacing:-0.01em;">KPX 입금 정보</div>
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;color:var(--text-sub);font-weight:500;margin-bottom:8px;">공급가액 (₩)</label>
        <input type="number" id="stmb-d-supply" value="${row.kpxSupply || 0}" oninput="stmBasicRecalc()" style="width:100%;padding:11px 14px;border:1px solid var(--border-dark);border-radius:var(--r);font-size:14px;font-variant-numeric:tabular-nums;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;color:var(--text-sub);font-weight:500;margin-bottom:8px;">부가세 10% (₩)</label>
        <input type="number" id="stmb-d-vat" value="${row.kpxVat || 0}" oninput="stmBasicRecalc()" style="width:100%;padding:11px 14px;border:1px solid var(--border-dark);border-radius:var(--r);font-size:14px;font-variant-numeric:tabular-nums;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;color:var(--text-sub);font-weight:500;margin-bottom:8px;">합계 (₩)</label>
        <input type="number" id="stmb-d-total" value="${row.kpxTotal || 0}" oninput="stmBasicRecalc()" style="width:100%;padding:11px 14px;border:1px solid var(--border-dark);border-radius:var(--r);font-size:15px;font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums;background:var(--g-50);box-sizing:border-box;">
      </div>
      <div style="margin-bottom:18px;">
        <label style="display:block;font-size:13px;color:var(--text-sub);font-weight:500;margin-bottom:8px;">입금일</label>
        <input type="date" id="stmb-d-date" value="${row.kpxDate || ''}" style="width:100%;padding:11px 14px;border:1px solid var(--border-dark);border-radius:var(--r);font-size:14px;box-sizing:border-box;">
      </div>
      <button class="btn btn-primary" onclick="stmBasicSaveKpx()" style="width:100%;height:42px;font-size:14px;">저장 + 배분 산정</button>
    </div>

    <!-- 60hz 마진 요약 -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:22px 26px;box-shadow:var(--shadow-xs);">
      <div style="font-size:14px;font-weight:700;color:var(--navy);margin-bottom:18px;letter-spacing:-0.01em;">60hz 마진 요약</div>
      <div style="display:flex;justify-content:space-between;padding:14px 0;font-size:14px;">
        <span style="color:var(--text-sub);font-weight:500;">자원 총 매출 (KPX)</span>
        <span style="font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums;font-size:16px;">₩ ${(row.kpxSupply||0).toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:14px 0;border-top:1px solid var(--border);font-size:14px;">
        <span style="color:var(--text-sub);font-weight:500;">60hz 수수료 총합</span>
        <span style="font-weight:700;color:var(--green);font-variant-numeric:tabular-nums;font-size:16px;">₩ ${totalFee.toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:14px 0;border-top:1px solid var(--border);font-size:14px;">
        <span style="color:var(--text-sub);font-weight:500;">사업자 지급 합계</span>
        <span style="font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums;font-size:16px;">₩ ${totalPayout.toLocaleString()}</span>
      </div>
      <div style="margin-top:16px;padding:12px 14px;background:var(--g-50);border-radius:var(--r);font-size:12px;color:var(--text-sub);line-height:1.7;">
        수수료 = 배분금액 × 사업자 평균 feeRate<br>
        실 지급 = 배분금액 − 수수료
      </div>
    </div>
  </div>

  <!-- [Phase 17-BX] 참여고객별 배분 — 체크박스 + 폰트 가독성 + 사업자별 상태 -->
  <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow-xs);">
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);font-size:15px;font-weight:600;color:var(--navy);">
      참여고객별 배분 <span style="font-size:13px;color:var(--text-hint);font-weight:400;margin-left:6px;">${customers.length}명</span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:var(--g-100);">
          <th style="padding:12px 14px;text-align:center;width:40px;border-bottom:1px solid var(--border);"><input type="checkbox" id="stmb-d-checkall" onchange="stmBasicToggleAll(this.checked)" style="cursor:pointer;"></th>
          <th style="padding:12px 16px;text-align:left;color:var(--text-sub);font-weight:600;font-size:12px;border-bottom:1px solid var(--border);">참여고객</th>
          <th style="padding:12px 16px;text-align:right;color:var(--text-sub);font-weight:600;font-size:12px;border-bottom:1px solid var(--border);">60hz 계약용량</th>
          <th style="padding:12px 16px;text-align:right;color:var(--text-sub);font-weight:600;font-size:12px;border-bottom:1px solid var(--border);">기본 배분금액</th>
          <th style="padding:12px 16px;text-align:right;color:var(--text-sub);font-weight:600;font-size:12px;border-bottom:1px solid var(--border);">수수료</th>
          <th style="padding:12px 16px;text-align:right;color:var(--text-sub);font-weight:600;font-size:12px;border-bottom:1px solid var(--border);">실 지급금액</th>
          <th style="padding:12px 16px;text-align:center;color:var(--text-sub);font-weight:600;font-size:12px;border-bottom:1px solid var(--border);">세금계산서</th>
          <th style="padding:12px 16px;text-align:center;color:var(--text-sub);font-weight:600;font-size:12px;border-bottom:1px solid var(--border);">정산 상태</th>
        </tr>
      </thead>
      <tbody>
        ${allocations.map(a => {
          const ratioPct = (a.ratio * 100).toFixed(1);
          const st = stmBasicGetCustomerStatus(row, a.c.id);
          return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:14px;text-align:center;"><input type="checkbox" class="stmb-d-row-check" data-cid="${a.c.id}" style="cursor:pointer;"></td>
            <td style="padding:14px 16px;">
              <div style="font-weight:600;color:var(--navy);font-size:14px;">${a.c.name}</div>
              <div style="font-size:11px;color:var(--text-hint);margin-top:3px;">${a.sites}사업장 · feeRate ${a.avgFeeRate.toFixed(1)}%</div>
            </td>
            <td style="padding:14px 16px;text-align:right;font-variant-numeric:tabular-nums;">
              <div style="font-weight:600;font-size:13px;">${a.power60hz.toLocaleString()} kW</div>
              <div style="font-size:11px;color:var(--text-hint);">(${ratioPct}%)</div>
            </td>
            <td style="padding:14px 16px;text-align:right;font-weight:500;font-variant-numeric:tabular-nums;font-size:13px;">₩ ${a.baseAlloc.toLocaleString()}</td>
            <td style="padding:14px 16px;text-align:right;font-variant-numeric:tabular-nums;color:var(--green);font-size:13px;">₩ ${a.fee.toLocaleString()}</td>
            <td style="padding:14px 16px;text-align:right;font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums;font-size:14px;">₩ ${a.payout.toLocaleString()}</td>
            <td style="padding:14px 16px;text-align:center;">
              <span class="badge ${st.invoiced ? 'badge-done' : 'badge-pending'}">${st.invoiced ? '발행완료' : '발행대기'}</span>
            </td>
            <td style="padding:14px 16px;text-align:center;">
              <span class="badge ${st.settled ? 'badge-done' : (st.invoiced ? 'badge-progress' : 'badge-pending')}">${st.settled ? '입금완료' : (st.invoiced ? '입금대기' : '대기')}</span>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end;background:var(--g-50);align-items:center;">
      <span style="font-size:11px;color:var(--text-hint);margin-right:auto;">※ 세금계산서는 외부 발행, 본 시스템은 상태 기록만</span>
      <button class="btn btn-secondary btn-sm" onclick="stmBasicBulkUpdate('invoiced')">선택 항목 세금계산서 발행 표시</button>
      <button class="btn btn-secondary btn-sm" onclick="stmBasicBulkUpdate('uninvoiced')">발행 취소</button>
      <button class="btn btn-primary btn-sm" onclick="stmBasicBulkUpdate('settled')">선택 항목 입금 완료 표시</button>
    </div>
  </div>

  <!-- 진행 이력 -->
  <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:16px 20px;margin-top:14px;box-shadow:var(--shadow-xs);">
    <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:10px;">진행 이력</div>
    <div style="font-size:12px;color:var(--text-sub);line-height:1.8;">
      ${row.kpxDate ? `<div>${row.kpxDate} · KPX 입금 ₩ ${(row.kpxTotal||0).toLocaleString()} (공급 ${(row.kpxSupply||0).toLocaleString()} + VAT ${(row.kpxVat||0).toLocaleString()})</div>` : `<div style="color:var(--text-hint);">KPX 입금 미입력 — 위 입력 영역에서 명세서 정보 입력 후 [저장 + 배분 산정] 클릭</div>`}
      ${row.status === 'invoiced' || row.status === 'in_progress' || row.status === 'completed' ? `<div>세금계산서 ${customers.length}건 발행 완료</div>` : ''}
      ${row.status === 'in_progress' || row.status === 'completed' ? `<div>사업자 입금 진행 중</div>` : ''}
      ${row.status === 'completed' ? `<div style="color:var(--green);font-weight:600;">전체 사업자 입금 완료</div>` : ''}
    </div>
  </div>
  `;
}

/* KPX 입금 입력 — 자동 계산 (공급/부가/합계 3개 셀 중 하나 입력 시 나머지 자동) */
function stmBasicRecalc(){
  const sEl = document.getElementById('stmb-d-supply');
  const vEl = document.getElementById('stmb-d-vat');
  const tEl = document.getElementById('stmb-d-total');
  if(!sEl || !vEl || !tEl) return;
  // 어느 필드가 active focus인지 — 보수적 처리: 공급가액 입력 → VAT·합계 자동 / 합계 입력 → 공급·VAT 자동
  const active = document.activeElement;
  const supply = Number(sEl.value) || 0;
  const vat = Number(vEl.value) || 0;
  const total = Number(tEl.value) || 0;
  if(active === sEl){
    const newVat = Math.round(supply * 0.1);
    vEl.value = newVat;
    tEl.value = supply + newVat;
  } else if(active === tEl){
    const newSupply = Math.round(total / 1.1);
    const newVat = total - newSupply;
    sEl.value = newSupply;
    vEl.value = newVat;
  } else if(active === vEl){
    // VAT 직접 입력 시 합계 = 공급 + VAT
    tEl.value = supply + vat;
  }
}

/* KPX 입금 저장 → 시드 갱신 + 배분 산정 (상태를 'pending' → 'invoiced'로) */
function stmBasicSaveKpx(){
  const row = stmBasicSeed.find(r => r.id === stmBasicState.currentDetailId);
  if(!row) return;
  const supply = Number(document.getElementById('stmb-d-supply').value) || 0;
  const vat    = Number(document.getElementById('stmb-d-vat').value) || 0;
  const total  = Number(document.getElementById('stmb-d-total').value) || 0;
  const date   = document.getElementById('stmb-d-date').value || '';
  if(supply <= 0 || total <= 0){
    if(typeof showToast === 'function') showToast('공급가액·합계를 입력해 주세요.');
    return;
  }
  row.kpxSupply = supply;
  row.kpxVat = vat;
  row.kpxTotal = total;
  row.kpxDate = date;
  if(row.status === 'pending') row.status = 'invoiced';   // 자동 진전
  if(typeof showToast === 'function') showToast('KPX 입금 정보 저장 · 배분 산정 완료');
  if(typeof logAudit === 'function'){
    logAudit({objectType:'settlement', objectId:row.id, action:'kpx_input',
      title:`KPX 입금 입력 — ${row.groupName} ${row.month}`,
      desc:`공급 ₩${supply.toLocaleString()} + VAT ₩${vat.toLocaleString()} = ₩${total.toLocaleString()}`,
      actor:'운영자', tone:'info'});
  }
  stmBasicRenderDetail();
}

/* [Phase 17-BX] 사업자별 정산 상태 — row 단위로 저장 */
function stmBasicEnsureCustomerStatuses(row, customerIds){
  if(!row.customerStatuses) row.customerStatuses = {};
  const baseInvoiced = row.status !== 'pending';
  const baseSettled = row.status === 'completed';
  customerIds.forEach(cid => {
    if(!row.customerStatuses[cid]){
      row.customerStatuses[cid] = { invoiced: baseInvoiced, settled: baseSettled };
    }
  });
}

function stmBasicGetCustomerStatus(row, customerId){
  if(!row.customerStatuses) row.customerStatuses = {};
  if(!row.customerStatuses[customerId]){
    row.customerStatuses[customerId] = {
      invoiced: row.status !== 'pending',
      settled: row.status === 'completed',
    };
  }
  return row.customerStatuses[customerId];
}

/* 전체 선택/해제 */
function stmBasicToggleAll(checked){
  document.querySelectorAll('.stmb-d-row-check').forEach(cb => { cb.checked = checked; });
}

/* 일괄 상태 업데이트 — action: 'invoiced' | 'uninvoiced' | 'settled' */
function stmBasicBulkUpdate(action){
  const row = stmBasicSeed.find(r => r.id === stmBasicState.currentDetailId);
  if(!row) return;
  const checked = Array.from(document.querySelectorAll('.stmb-d-row-check')).filter(cb => cb.checked);
  if(checked.length === 0){
    if(typeof showToast === 'function') showToast('선택된 참여고객이 없습니다.');
    return;
  }
  const cids = checked.map(cb => cb.dataset.cid);
  stmBasicEnsureCustomerStatuses(row, cids);
  let actionLabel = '';
  cids.forEach(cid => {
    const st = row.customerStatuses[cid];
    if(action === 'invoiced'){ st.invoiced = true; }
    else if(action === 'uninvoiced'){ st.invoiced = false; st.settled = false; }
    else if(action === 'settled'){ st.settled = true; st.invoiced = true; }
  });
  actionLabel = action === 'invoiced' ? '세금계산서 발행 표시'
              : action === 'uninvoiced' ? '발행 취소'
              : '입금 완료 표시';
  // row 전체 status도 사업자 상태에 따라 자동 갱신
  stmBasicRecomputeRowStatus(row);
  if(typeof showToast === 'function') showToast(`${checked.length}명 → ${actionLabel}`);
  if(typeof logAudit === 'function'){
    logAudit({objectType:'settlement', objectId:row.id, action:`bulk_${action}`,
      title:`정산 일괄 처리 — ${row.groupName} ${row.month}`,
      desc:`${checked.length}명 ${actionLabel}`,
      actor:'운영자', tone:'info'});
  }
  stmBasicRenderDetail();
}

/* row 전체 status 자동 재계산 — 전체 사업자 상태 집계 */
function stmBasicRecomputeRowStatus(row){
  if(!row.customerStatuses) return;
  const statuses = Object.values(row.customerStatuses);
  if(statuses.length === 0) return;
  const allSettled = statuses.every(s => s.settled);
  const anyInvoiced = statuses.some(s => s.invoiced);
  const anySettled = statuses.some(s => s.settled);
  if(allSettled)      row.status = 'completed';
  else if(anySettled) row.status = 'in_progress';
  else if(anyInvoiced) row.status = 'invoiced';
  else                 row.status = 'pending';
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
  // Phase 11-F: 모든 KPI DOM 접근에 null guard — stm-kpi-amt 등 일부 ID가 Phase 11-A에서 제거됨
  if($('stm-kpi-total'))    $('stm-kpi-total').textContent = total;
  if($('stm-kpi-pending'))  $('stm-kpi-pending').textContent = pending;
  if($('stm-kpi-invoiced')) $('stm-kpi-invoiced').textContent = invoiced;
  if($('stm-kpi-inprog'))   $('stm-kpi-inprog').textContent = inprog;
  if($('stm-kpi-done'))     $('stm-kpi-done').textContent = done;
  if($('stm-kpi-amt'))      $('stm-kpi-amt').textContent = amtSum.toLocaleString();

  // 범위 정보
  const from = stmState.from, to = stmState.to;
  if($('stm-range-info')) $('stm-range-info').textContent = (from&&to) ? `${from} ~ ${to}` : '전체 기간';

  // 리스트
  const body = $('stm-list-body');
  if(!body){ console.error('[stmRender] stm-list-body DOM 못 찾음'); return; }
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
    showToast('이행검증에서 정합성 검증 완료 후 이용 가능합니다.');
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
  // Phase 14: '정합성 확정' 메타 제거 — 운영리포트 책임이라 정산관리에 노출 불필요 (Phase 9 책임 분리 원칙)
  $('stmd-confirmed').innerHTML = `
    <div class="rp-event-meta-item"><div class="k">참여 자원 · 고객</div><div class="v">${ev.resources.length}개 자원 · ${custs.length}명 고객</div></div>
    <div class="rp-event-meta-item"><div class="k">실 감축 / 이행률</div><div class="v">${totalActual.toLocaleString()} kW · ${Math.round(rate*100)}%</div></div>
    <div class="rp-event-meta-item"><div class="k">KPX 확정 정산금</div><div class="v" style="font-weight:700;color:var(--navy);">${(s.finalAmount||0).toLocaleString()} KRW</div></div>
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
    // [Phase 17-P] 비고 필드 제거 — KPX 확정금액과 실 입금액 차이는 '최종 확정 대비'에 자동 표기되어 운영자가 즉시 인지 가능. 별도 메모 불필요.
    box.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div><label class="form-label">수금일</label><input type="date" class="form-input" id="stmd-pay-date"></div>
        <div><label class="form-label">실 수금액 (KRW)</label><input class="form-input" id="stmd-pay-amt" type="number" placeholder="${s.finalAmount||0}"></div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="stmRegisterPayment()">입금 등록 → 배분 단계</button>
    `;
  } else {
    const rp = s.receivedFromKpx;
    const diff = (rp.amount||0) - (s.finalAmount||0);
    const diffCls = diff===0?'stg-diff-ok':diff>0?'stg-diff-warn':'stg-diff-bad';
    // [Phase 17-P] 표시도 3개 컬럼으로 (수금일·수금액·최종 확정 대비)
    box.innerHTML = `
      <div class="stg-meta">
        <div><div class="k">수금일</div><div class="v">${rp.receivedAt||'-'}</div></div>
        <div><div class="k">수금액</div><div class="v">${(rp.amount||0).toLocaleString()} KRW</div></div>
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
  const totalFee = dist.reduce((x,d)=>x+(d.feeAmount||0),0);
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
    const feeRate = d.feeRate!=null ? d.feeRate : 15;  // 기본 15% (계약관리 contractInfo.feeRate 기준)
    const feeAmt = d.feeAmount||0;
    return `<tr>
      <td>${d.customerName}${reasonCell}</td>
      <td class="num">${(d.contributionKw||d.capacity||0).toLocaleString()}</td>
      <td class="num">${((d.contributionRatio||d.share||0)*100).toFixed(1)}%</td>
      <td class="num">${(d.baseAmount||d.amount||0).toLocaleString()}</td>
      <td class="num" style="color:var(--navy);">-${feeAmt.toLocaleString()}<div style="font-size:10px;color:var(--text-hint);margin-top:1px;">(${feeRate}%)</div></td>
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
        <th style="text-align:right;">수수료 <span style="font-weight:400;color:var(--text-hint);">(우리)</span></th>
        <th style="text-align:right;">패널티</th>
        <th style="text-align:right;">고객 지급액</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:10px;padding:10px;background:#f8fafc;border-radius:6px;font-size:12px;">
      <div style="display:flex;justify-content:space-between;"><span>기초 배분 합계:</span><span style="font-variant-numeric:tabular-nums;">${totalBase.toLocaleString()} KRW</span></div>
      <div style="display:flex;justify-content:space-between;color:var(--navy);"><span>수수료 합계 (우리 귀속):</span><span style="font-variant-numeric:tabular-nums;">-${totalFee.toLocaleString()} KRW</span></div>
      <div style="display:flex;justify-content:space-between;color:var(--red);"><span>패널티 합계 (수요사업자 귀속):</span><span style="font-variant-numeric:tabular-nums;">-${totalPenalty.toLocaleString()} KRW</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid var(--border);margin-top:6px;padding-top:6px;"><span>고객 지급 합계:</span><span style="font-variant-numeric:tabular-nums;">${totalFinal.toLocaleString()} KRW</span></div>
      <div style="display:flex;justify-content:space-between;color:var(--text-hint);margin-top:4px;font-size:11px;"><span>수금액 대비 검증:</span><span style="font-variant-numeric:tabular-nums;">${recv.toLocaleString()} KRW ${recv===totalBase+totalPenalty?'일치':'불일치'}</span></div>
    </div>
    ${!locked ? `<div style="margin-top:8px;"><button class="btn btn-ghost btn-sm" onclick="stmRegenerateDistribution()">배분 재계산 (패널티·수수료 초기화)</button></div>` : ''}
  `;
}

/* [Phase 17-CM] 단계 ③ 고객별 진행 — 즉시 반영 + 일괄 처리 (편집 모드 X) */

/* 개별 체크박스 → 즉시 저장 (기존 stmToggleNotify/Transfer 재활용) */
/* 일괄 처리 — 선택된 행의 field를 즉시 완료 처리 */
function stmProgressBulkApply(field){
  const ev = store.events.reduction.find(e => e.id === stmState.selectedEventId);
  if(!ev) return;
  const checked = document.querySelectorAll('.stm-prog-select:checked');
  if(checked.length === 0){
    if(typeof showToast === 'function') showToast('처리할 항목을 선택하세요.');
    return;
  }
  const dist = ev.settlement.customerDistribution || [];
  const now = nowStr();
  let changed = 0;
  checked.forEach(cb => {
    const cid = cb.dataset.cid;
    const d = dist.find(x => x.customerId === cid);
    if(!d) return;
    if(field === 'notify' && !d.notifiedAt){ d.notifiedAt = now; changed++; }
    if(field === 'transfer' && !d.transferredAt){ d.transferredAt = now; changed++; }
  });
  if(typeof logAudit === 'function' && changed > 0){
    logAudit({objectType:'settlement', objectId:ev.id, action:`bulk_${field}`,
      title:`고객별 ${field === 'notify' ? '안내' : '이체'} 일괄 완료 — ${ev.id}`,
      desc:`${changed}건`, actor:'운영자', tone:'info'});
  }
  if(typeof showToast === 'function') showToast(`${changed}건 ${field === 'notify' ? '안내' : '이체'} 완료`);
  stmRenderProgress(ev);
  if(typeof stmRenderActions === 'function') stmRenderActions(ev);
}

function stmRenderProgress(ev){
  const s = ev.settlement;
  const box = $('stmd-progress');
  const dist = s.customerDistribution||[];
  if(!dist.length){
    box.innerHTML = `<div style="font-size:11px;color:var(--text-hint);padding:4px 0;">② 배분 계산 후 진행 가능합니다.</div>`;
    return;
  }
  const locked = s.status==='completed';

  const rows = dist.map(d => {
    if(locked){
      const notifyCell = d.notifiedAt ? `<span style="color:var(--green);">완료 · ${d.notifiedAt.substring(5,10)}</span>` : '<span style="color:var(--text-hint);">미처리</span>';
      const transferCell = d.transferredAt ? `<span style="color:var(--green);">완료 · ${d.transferredAt.substring(5,10)}</span>` : '<span style="color:var(--text-hint);">미처리</span>';
      return `<tr>
        <td></td>
        <td>${d.customerName}</td>
        <td class="num">${(d.finalAmount||d.amount||0).toLocaleString()}</td>
        <td>${notifyCell}</td>
        <td>${transferCell}</td>
      </tr>`;
    }
    // 개별 안내/이체 = 상태 표시(비활성). 처리는 앞 체크박스 선택 후 상단 [일괄] 버튼으로.
    const notifyCell = d.notifiedAt
      ? `<span style="color:var(--green);font-weight:500;">완료 · ${d.notifiedAt.substring(5,10)}</span>`
      : `<span style="color:var(--text-hint);">미처리</span>`;
    const transferCell = d.transferredAt
      ? `<span style="color:var(--green);font-weight:500;">완료 · ${d.transferredAt.substring(5,10)}</span>`
      : `<span style="color:var(--text-hint);">미처리</span>`;
    return `<tr>
      <td style="width:40px;text-align:center;"><input type="checkbox" class="stm-prog-select" data-cid="${d.customerId}"></td>
      <td>${d.customerName}</td>
      <td class="num">${(d.finalAmount||d.amount||0).toLocaleString()}</td>
      <td>${notifyCell}</td>
      <td>${transferCell}</td>
    </tr>`;
  }).join('');

  const headerActions = locked ? '' : `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;justify-content:flex-end;">
      <span style="font-size:11px;color:var(--text-hint);margin-right:auto;">체크박스로 선택 후 일괄 처리 가능</span>
      <button class="btn btn-secondary btn-sm" onclick="stmProgressBulkApply('notify')">일괄 안내 완료</button>
      <button class="btn btn-secondary btn-sm" onclick="stmProgressBulkApply('transfer')">일괄 이체 완료</button>
    </div>`;

  const selectAllHeader = locked ? '' : `
    <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;font-weight:500;color:var(--text-sub);">
      <input type="checkbox" onchange="document.querySelectorAll('.stm-prog-select').forEach(cb=>cb.checked=this.checked)"> 전체
    </label>`;

  box.innerHTML = `
    ${headerActions}
    <table class="rp-table">
      <thead><tr>
        <th style="text-align:center;">${selectAllHeader}</th>
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
  // [Phase 17-P] paymentRef(비고) 필드 제거 — KPX 확정금액과 차액은 자동 표시되어 별도 메모 불필요
  if(!date || !amt){ showToast('수금일과 금액을 입력하세요.'); return; }
  s.receivedFromKpx = {amount:amt, receivedAt:date};
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
  // Phase 14: 수수료 계산 — 고객별 계약 수수료율 적용 (Phase 7 contractInfo.feeRate)
  s.customerDistribution = list.map(c=>{
    const ratio = totalKw>0 ? c.kw/totalKw : 0;
    const baseAmount = Math.round(recv * ratio);
    // 고객(=사업자)의 계약 수수료율 — 기본 15%, 국민DR은 12% 등
    const cust = (typeof custById==='function') ? custById(c.id) : null;
    const feeRate = (cust?.contractInfo?.feeRate) ?? 15;
    const feeAmount = Math.round(baseAmount * feeRate / 100);
    return {
      customerId: c.id,
      customerName: c.name,
      contributionKw: Math.round(c.kw),
      contributionRatio: ratio,
      baseAmount: baseAmount,
      feeRate: feeRate,                 // Phase 14: 적용 수수료율
      feeAmount: feeAmount,             // Phase 14: 수수료 금액 (우리 귀속)
      penalty: {amount:0, reason:''},
      finalAmount: baseAmount - feeAmount, // 고객 지급액 = 기초 배분 - 수수료 (패널티는 별도 차감)
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
