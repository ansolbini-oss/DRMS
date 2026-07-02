/* ════════════════════════════════════════════════════════════
   PRECHECK — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

const pcState = { filter:{status:'',data:'',type:'',q:''}, currentId:null };

// [Phase 17-L] 사전검증 단계 재정리 (도메인 통합)
//   - 옛 'SMD 데이터 분석' → 인프라 검증에 통합 (Phase 17-CX에서 완전 제거)
//   - 옛 '악의성 검증' → RRMSE 분석에 통합
// 결과: 4단계 (외부데이터 → 인프라 → RRMSE → CBL)
// [Phase 17-CX] 사전검증 인프라 검증은 한전 AMI 계량 데이터만 확인 (RTU·SMD 모두 제거)
const pcStepDefs = [
  {key:'ext',   name:'외부데이터 조회', desc:'한전·파워플래너 연동',                    auto:false},
  {key:'infra', name:'인프라 검증',      desc:'한전 AMI 설치·통신 및 계량 데이터 수집 확인', auto:false},
  {key:'rrmse', name:'RRMSE 분석',       desc:'부하 패턴 오차 분석 — 악의성 탐지 (자동)',   auto:true},
  {key:'cbl',   name:'CBL 분석',         desc:'기준부하 산정 및 유형 선택',                  auto:false},
];

// 옛 6단계 steps 배열을 새 4단계로 변환 (시드 호환).
// 옛 인덱스: 0:ext, 1:infra, 2:smd, 3:mali, 4:rrmse, 5:cbl
// 새 인덱스: 0:ext, 1:infra(+smd), 2:rrmse(+mali), 3:cbl
function pcMergeStepStates(a, b){
  // 둘 중 하나라도 실패면 실패 / 둘 다 완료면 완료 / 진행중 우선
  if(a === 0 || b === 0) return 0;
  if(a === 2 && b === 2) return 2;
  if(a === 3 || b === 3) return 3;
  return 1;
}
function pcNormalizeSteps(raw){
  if(!Array.isArray(raw)) return [1,1,1,1];
  if(raw.length === 4) return [...raw];
  if(raw.length === 6){
    return [
      raw[0],
      pcMergeStepStates(raw[1], raw[2]),
      pcMergeStepStates(raw[3], raw[4]),
      raw[5]
    ];
  }
  return [1,1,1,1];
}

function pcFilterByStatus(s){
  pcState.filter.status = (pcState.filter.status===s)? '' : s;
  ['pc-card-all','pc-card-progress','pc-card-done','pc-card-contracted','pc-card-reject']
    .forEach(id=>{ const el=$(id); if(el) el.classList.remove('active'); });
  const map = {'':'pc-card-all','검증진행':'pc-card-progress',
               '검증완료':'pc-card-done','계약완료':'pc-card-contracted','반려':'pc-card-reject'};
  const activeId = map[pcState.filter.status];
  if(activeId){ const el=$(activeId); if(el) el.classList.add('active'); }
  pcRenderTable();
}
function pcResetFilter(){
  $('pc-search').value=''; $('pc-filter-type').value='';
  pcState.filter = {status:'',data:'',type:'',q:''};
  ['pc-card-all','pc-card-progress','pc-card-done','pc-card-contracted','pc-card-reject']
    .forEach(id=>{ const el=$(id); if(el) el.classList.remove('active'); });
  const allCard = $('pc-card-all'); if(allCard) allCard.classList.add('active');
  pcRenderTable();
}

function pcRefreshCards(){
  const all = store.customers;
  $('pc-total').textContent = all.length;
  // 검증진행 = 검증대기 + 검증중 (통합)
  const progressCount = all.filter(c=>c.status==='검증대기'||c.status==='검증중').length;
  $('pc-progress').textContent = progressCount;
  $('pc-done').textContent = all.filter(c=>c.status==='검증완료').length;
  $('pc-contracted').textContent = all.filter(c=>c.status==='계약완료').length;
  $('pc-reject').textContent = all.filter(c=>c.status==='반려').length;
}

function pcFilteredList(){
  const q = ($('pc-search')?.value||'').trim().toLowerCase();
  const tF = $('pc-filter-type')?.value||'';
  const sF = pcState.filter.status;
  return store.customers.filter(c=>{
    if(sF){
      // '검증진행' 카드 클릭 시 검증대기 + 검증중 통합 매칭
      if(sF==='검증진행'){
        if(c.status!=='검증대기' && c.status!=='검증중') return false;
      } else if(c.status!==sF){
        return false;
      }
    }
    if(tF && c.drType!==tF) return false;
    if(q){
      // 사업자명·대표자·접수번호 + 사업장명·KEPCO 다중 검색
      let hay = `${c.name} ${c.ceo} ${c.recno} ${c.kepco||''}`;
      if(Array.isArray(c.sites)){
        c.sites.forEach(s => { hay += ` ${s.siteName||''} ${s.kepco||''}`; });
      }
      if(!hay.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

// 사업자 행 ▶/▼ 토글: 같은 데이터의 사업장 행들을 펴거나 접음
function pcToggleBusiness(bizId){
  const rows = document.querySelectorAll(`tr.site-row[data-parent-id="${bizId}"]`);
  if(rows.length===0) return;
  const isHidden = rows[0].style.display === 'none';
  rows.forEach(tr => { tr.style.display = isHidden ? '' : 'none'; });
  const bizRow = document.querySelector(`tr.business-row[data-biz-id="${bizId}"]`);
  if(bizRow){
    const icon = bizRow.querySelector('.accordion-icon');
    if(icon) icon.textContent = isHidden ? '▼' : '▶';
  }
}

// [Phase 17-L] 검증 단계 진행률 progress bar HTML (4단계 동적)
function pcStepBarHtml(steps){
  const normalized = pcNormalizeSteps(steps);
  const total = pcStepDefs.length;
  const done = normalized.filter(s=>s===2).length;
  const pct = Math.round(done/total*100);
  const barColor = done===total ? 'var(--green)' : done===0 ? 'var(--border-dark)' : 'var(--blue)';
  return `<div style="display:flex;align-items:center;gap:6px;"><div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;"></div></div><span style="font-size:11px;color:var(--text-hint);white-space:nowrap;">${done}/${total}</span></div>`;
}

// [Phase 17-M] 사업자 단위 검증 진행 — 모든 사업장의 단계 진행 합산.
// 비니 의도: 일관된 의미 "X/N 단계" (사업장 카운트가 아니라 단계 진행도).
// 사업장 3개 × 4단계 = 전체 12단계 중 N 완료.
function pcBusinessBarHtml(sites){
  const stepsPerSite = pcStepDefs.length;  // 4
  const total = sites.length * stepsPerSite;
  const done = sites.reduce((acc, s) => {
    const normalized = pcNormalizeSteps(s.steps);
    return acc + normalized.filter(x=>x===2).length;
  }, 0);
  const pct = total>0 ? Math.round(done/total*100) : 0;
  const barColor = done===total ? 'var(--green)' : done===0 ? 'var(--border-dark)' : 'var(--blue)';
  return `<div style="display:flex;align-items:center;gap:6px;"><div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;"></div></div><span style="font-size:11px;color:var(--text-hint);white-space:nowrap;">${done}/${total}</span></div>`;
}

/* [Phase 17-AC] 사전검증 목록 — 사업장 단위 평면 리스트
   옛 아코디언(사업자 펼침 → 사업장) 구조 해제.
   각 사업장이 독립적인 사전검증 단위라 평면 나열이 운영자 직관에 부합. */
function pcRenderTable(){
  pcRefreshCards();
  const list = pcFilteredList();
  const tbody = $('pc-tbody'); tbody.innerHTML = '';
  let siteTotal = 0;
  list.forEach(c => {
    const sites = pcGetSites(c);  // 가상 사이트 자동 매핑 보장
    sites.forEach(s => {
      siteTotal++;
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML = `
        <td>${c.name}</td>
        <td style="font-weight:600;color:var(--navy);">${s.siteName}</td>
        <td>${s.manager || c.ceo || '—'}</td>
        <td>${s.tel || c.tel || '—'}</td>
        <td>${s.addr || '—'}</td>
        <td style="font-family:monospace;font-size:11px;">${s.kepco || '—'}</td>
        <td style="text-align:center;">${c.drType ? `<span class="badge badge-gray">${c.drType}</span>` : '<span style="color:var(--text-hint);">—</span>'}</td>
        <td style="text-align:center;">${c.inflow==='사이트'?'<span class="badge badge-progress">사이트</span>':c.inflow==='영업'?'<span class="badge badge-purple">영업</span>':'<span style="color:var(--text-hint);">—</span>'}</td>
        <td style="text-align:center;">${pcStepBarHtml(s.steps)}</td>
        <td style="text-align:center;font-variant-numeric:tabular-nums;">${s.date || c.date || '—'}</td>
        <td style="text-align:center;"><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();pcShowDetailWithSite('${c.id}','${s.id}')">상세</button></td>`;
      tr.onclick = (e) => { if(e.target.tagName !== 'BUTTON') pcShowDetailWithSite(c.id, s.id); };
      tbody.appendChild(tr);
    });
  });
  $('pc-rowcount').textContent = `총 ${list.length}사업자 · ${siteTotal}사업장`;
}

function pcGotoList(){
  $('precheck-list-view').style.display = 'flex';
  $('precheck-detail-view').style.display = 'none';
  pcState.currentId = null;
}
function pcShowDetail(id){
  const c = custById(id); if(!c) return;
  pcState.currentId = id;
  $('precheck-list-view').style.display = 'none';
  $('precheck-detail-view').style.display = 'flex';
  $('pc-d-title').textContent = c.name;
  $('pc-d-sub').textContent = `${c.recno} · 접수일 ${c.date}`;
  const badge = $('pc-d-badge');
  badge.className = 'badge ' + statusBadgeClass(c.status);
  badge.textContent = c.status;
  // [Phase 17-AK] 사업자 정보 — 인라인 편집 (모달 X). pcCustEditing 상태로 텍스트뷰↔input폼 토글
  $('pc-d-name').textContent = c.name;
  $('pc-d-recno').textContent = c.recno;
  pcCustEditing = false;  // 사업자 전환 시 항상 비편집 모드로 시작
  pcRenderCustomerInfo(c);
  // 옛 호환 (hidden 필드)
  const setText = (id, val) => { const el = $(id); if(el) el.textContent = val; };
  setText('pc-d-bizno', c.bizno || '-');
  setText('pc-d-ceo', c.ceo || '-');
  setText('pc-d-tel', c.tel || '-');
  setText('pc-d-bizcat-only', c.bizcat || '-');
  setText('pc-d-biztype-only', c.biztype || '-');
  setText('pc-d-addr', c.addr || '-');
  setText('pc-d-bizcat', `${c.bizcat || '-'} / ${c.biztype || '-'}`);
  setText('pc-d-drtype', c.drType || '-');
  setText('pc-d-inflow', c.inflow || '-');
  // [Phase 17-AJ] 사업자 요약 — 사업장 수·검증 완료 (한전·60hz 계약전력 합계 제거)
  const sitesAll = pcGetSites(c);
  const totalSteps = pcStepDefs.length;
  const doneSites = sitesAll.filter(s => pcNormalizeSteps(s.steps).filter(x=>x===2).length === totalSteps).length;
  setText('pc-d-site-count', `${sitesAll.length}`);
  setText('pc-d-verify-done', `${doneSites} / ${sitesAll.length}`);
  // 사업장 정보 카드 (계약 정보 + 서류 업로드)
  pcRenderSitesInfo(c);
  pcRenderMemo(c);
  pcRenderDetailLog(c);
  pcUpdateContractBtn(c);
  pcRenderBusinessSummary(c);
  // 사업장 탭: 항상 표시 (사업장 1개여도 동일하게 UI 구분)
  const sitesTabBtn = $('pc-tab-sites-btn');
  if(sitesTabBtn){
    const sites = pcGetSites(c);
    sitesTabBtn.style.display = '';
    sitesTabBtn.textContent = `사업장 (${sites.length})`;
    pcRenderSitesTab(c);
  }
  pcSwitchTab('info');
}

// 사업자 → 사업장 배열 정규화. sites 없으면 customer 자체를 단일 사업장으로 변환
function pcGetSites(c){
  if(Array.isArray(c.sites) && c.sites.length > 0){
    // [Phase 17-L] 각 사이트의 steps를 4단계로 정규화 (옛 시드 6단계 호환)
    c.sites.forEach(s => {
      if(Array.isArray(s.steps) && s.steps.length !== 4){
        s.steps = pcNormalizeSteps(s.steps);
      }
    });
    return c.sites;
  }
  // [Phase 17-E] 가상 사이트도 c.sites에 영구 저장. 매 호출마다 새 객체를 반환하면
  // 단계 상태 갱신(s.steps[0]=2 등)이 다음 호출에서 사라져 화면에 반영 안 됨.
  c.sites = [{
    id: c.id + '-S1',
    siteName: c.name + ' 본사',
    kepco: c.kepco,
    addr: c.addr,
    power: c.power,
    tel: c.tel,
    manager: c.ceo,
    steps: pcNormalizeSteps(c.steps),  // 옛 6 → 새 4 변환. 사업자와 사업장 독립.
    dataStatus: c.dataStatus,
    verifyStatus: (c.status === '검증완료' || c.status === '계약완료') ? '검증완료' : c.status,
    date: c.date,
    cblType: c.cblType,
    cblAvg: c.cblAvg,
    rrmseVal: c.rrmseVal,
    infraS: c.infraS,
    extS: c.extS,
    reduction: c.reduction,
    _isVirtual: true
  }];
  return c.sites;
}

// 기본정보 탭 우측의 사업자 요약 카드 렌더링
/* [Phase 17-AE] 사업장 정보 카드 렌더 — 사업장별 기본 + 계약 정보 + 서류 */
function pcRenderSitesInfo(c){
  const el = $('pc-d-sites-info'); if(!el) return;
  const sites = pcGetSites(c);
  if(sites.length === 0){
    el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-hint);font-size:12px;">등록된 사업장이 없습니다. [+ 사업장 추가] 버튼으로 등록하세요.</div>`;
    return;
  }
  const totalSteps = pcStepDefs.length;
  el.innerHTML = sites.map(s => {
    const stepsArr = pcNormalizeSteps(s.steps);
    const done = stepsArr.filter(x=>x===2).length;
    const verifyBadge = done===totalSteps
      ? `<span class="badge badge-done" style="font-size:10px;">검증완료</span>`
      : `<span class="badge badge-progress" style="font-size:10px;">검증중 ${done}/${totalSteps}</span>`;
    const ct = s.contract || {};
    const docList = (ct.docs && ct.docs.length)
      ? `<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">${ct.docs.map(d=>`
          <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#fff;border:1px solid var(--border);border-radius:4px;font-size:11px;">
            <span style="color:var(--blue);">📄</span>
            <span style="flex:1;color:var(--text-sub);">${d.name}</span>
            <span style="color:var(--text-hint);font-size:10px;">${d.uploadedAt||''}</span>
          </div>`).join('')}</div>`
      : `<div style="font-size:11px;color:var(--text-hint);">업로드된 서류 없음</div>`;
    return `<div style="padding:14px 16px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px;background:#fff;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="font-size:14px;font-weight:700;color:var(--navy);">${s.siteName}</div>
          ${verifyBadge}
        </div>
        <button class="btn btn-secondary btn-sm" onclick="pcOpenEditSiteInfo('${c.id}','${s.id}')">수정</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;font-size:12px;">
        <div><div style="font-size:10px;color:var(--text-hint);">담당자</div><div style="font-weight:500;margin-top:2px;">${s.manager||'—'}</div></div>
        <div><div style="font-size:10px;color:var(--text-hint);">연락처</div><div style="font-weight:500;margin-top:2px;">${s.tel||'—'}</div></div>
        <div><div style="font-size:10px;color:var(--text-hint);">주소</div><div style="font-weight:500;margin-top:2px;">${s.addr||'—'}</div></div>
        <div><div style="font-size:10px;color:var(--text-hint);">KEPCO 고객번호</div><div style="font-family:monospace;font-weight:500;margin-top:2px;">${s.kepco||'—'}</div></div>
        <div><div style="font-size:10px;color:var(--text-hint);">한전 계약전력</div><div style="font-weight:500;margin-top:2px;">${s.power?s.power+' kW':'—'}</div></div>
        <div><div style="font-size:10px;color:var(--text-hint);">검증 진행</div><div style="font-weight:500;margin-top:2px;">${done}/${totalSteps} 단계</div></div>
      </div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--border);">
        <div style="font-size:11px;color:var(--text-hint);font-weight:600;margin-bottom:8px;">60hz 계약 정보</div>
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;font-size:12px;">
          <div><div style="font-size:10px;color:var(--text-hint);">60hz 계약전력</div><div style="font-weight:500;margin-top:2px;">${ct.power?ct.power+' kW':'—'}</div></div>
          <div><div style="font-size:10px;color:var(--text-hint);">수수료</div><div style="font-weight:500;margin-top:2px;">${ct.feeRate!=null?ct.feeRate+'%':'—'}</div></div>
          <div><div style="font-size:10px;color:var(--text-hint);">계약기간</div><div style="font-weight:500;margin-top:2px;">${ct.startDate&&ct.endDate?`${ct.startDate} ~ ${ct.endDate}`:'—'}</div></div>
        </div>
        <div style="margin-top:10px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
          <div style="flex:1;">
            <div style="font-size:10px;color:var(--text-hint);margin-bottom:4px;">계약서류</div>
            ${docList}
          </div>
          <button class="btn btn-secondary btn-sm" onclick="pcOpenUploadSiteDoc('${c.id}','${s.id}')">서류 업로드</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function pcRenderBusinessSummary(c){
  const el = $('pc-business-summary'); if(!el) return;
  const sites = pcGetSites(c);
  const total = sites.length;
  const done = sites.filter(s => Array.isArray(s.steps) && s.steps.every(x => x===2)).length;
  const totalPower = sites.reduce((sum, s) => sum + (Number(s.power)||0), 0);
  el.innerHTML = `
    <div class="result-grid">
      <div class="result-item"><div class="result-item-label">사업장 수</div><div class="result-item-val">${total}</div></div>
      <div class="result-item"><div class="result-item-label">검증 완료</div><div class="result-item-val">${done} / ${total}</div></div>
      <div class="result-item"><div class="result-item-label">총 한전 계약전력</div><div class="result-item-val">${totalPower.toLocaleString()} kW</div></div>
      <div class="result-item"><div class="result-item-label">DR 유형</div><div class="result-item-val">${c.drType}</div></div>
    </div>
  `;
}
// 사업장 행 [상세]: 사업자 상세 진입 → 사업장 탭 → 해당 사업장 선택
function pcShowDetailWithSite(bizId, siteId){
  pcShowDetail(bizId);
  pcSwitchTab('sites');
  pcSelectSite(bizId, siteId);
}

function pcSwitchTab(tab){
  $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
  // [Phase 17-AI] 기본정보 탭은 flex column (4영역 세로), 사업장·로그 탭은 grid 유지
  $('pc-tab-info').style.display = tab==='info'?'flex':'none';
  $('pc-tab-log').style.display  = tab==='log' ?'grid':'none';
  const sitesTab = $('pc-tab-sites');
  if(sitesTab) sitesTab.style.display = tab==='sites'?'grid':'none';
}

// 사업장 탭 렌더링: 좌측 리스트 + 첫 사업장 자동 선택
function pcRenderSitesTab(c){
  const list = $('pc-sites-list'); list.innerHTML = '';
  const sites = pcGetSites(c);
  if(sites.length===0) return;
  $('pc-sites-count').textContent = `총 ${sites.length}사업장`;
  sites.forEach((s, idx) => {
    // [Phase 17-L] 단계 수 동적 — 정규화 후 4단계 기준
    const stepsArr = pcNormalizeSteps(s.steps);
    const total = pcStepDefs.length;
    const done = stepsArr.filter(x=>x===2).length;
    const isDone = done===total;
    const item = document.createElement('div');
    item.className = 'site-list-item';
    item.dataset.siteId = s.id;
    item.style.cssText = 'padding:10px 12px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:#fff;transition:all .15s ease;';
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="font-weight:600;font-size:13px;color:var(--navy);">${s.siteName}</div>
        <span class="badge ${isDone?'badge-done':'badge-progress'}" style="font-size:10px;">${done}/${total}</span>
      </div>
      <div style="font-size:11px;color:var(--text-hint);margin-top:3px;font-family:monospace;">KEPCO ${s.kepco}</div>
    `;
    item.onclick = () => pcSelectSite(c.id, s.id);
    list.appendChild(item);
  });
  // 첫 사업장 자동 선택
  pcSelectSite(c.id, sites[0].id);
}

function pcSelectSite(bizId, siteId){
  const c = custById(bizId); if(!c) return;
  const sites = pcGetSites(c);
  const s = sites.find(x=>x.id===siteId); if(!s) return;
  // active 스타일 토글
  document.querySelectorAll('.site-list-item').forEach(el => {
    const isActive = el.dataset.siteId === siteId;
    el.style.background = isActive ? 'var(--blue-light)' : '#fff';
    el.style.borderColor = isActive ? 'var(--blue)' : 'var(--border)';
  });
  // 우측 상세 렌더 — 사업장 기본정보 + 검증 절차 + 산정 결과 + 외부데이터 검증 결과
  // [Phase 17-L] 4단계 정규화 + 동적 카운트
  const steps = pcNormalizeSteps(s.steps);
  s.steps = steps;  // 정규화 결과를 사이트에 영속 저장 (다음 갱신이 4 길이 기준으로 동작하도록)
  const total = pcStepDefs.length;
  const done = steps.filter(x=>x===2).length;
  // 사업장 단위 산정 결과: 사업장에 값이 있으면 우선, 없으면 사업자 customer 값 fallback
  const cblType   = s.cblType   ?? c.cblType   ?? '-';
  const cblAvg    = s.cblAvg    ?? c.cblAvg    ?? '-';
  const rrmseVal  = s.rrmseVal  ?? c.rrmseVal  ?? '-';
  const infraS    = s.infraS    ?? c.infraS    ?? '-';
  const extS      = s.extS      ?? c.extS      ?? '-';
  const reduction = s.reduction ?? c.reduction ?? null;

  // 검증 단계 6개 박스 — 상태별 운영자 액션 노출 (Phase 17-C)
  // ① 외부데이터 조회: 항상 [재조회] (실패 시엔 [재시도]+[수동 업로드])
  // ⑥ CBL 분석: [유형 변경] (운영자 의사결정 포인트)
  // 그 외: 완료/실패 시 [재실행]·[재시도] / 대기 시 [실행]
  const stepsHtml = pcStepDefs.map((def, i) => {
    const st = steps[i];
    const stateText = st===2 ? '완료' : st===3 ? '진행중' : st===0 ? '실패' : '대기';
    const stateCls  = st===2 ? 'badge-done' : st===3 ? 'badge-progress' : st===0 ? 'badge-reject' : 'badge-gray';
    // 액션 버튼 결정
    let actionBtn = '';
    if(def.key === 'ext'){
      const label = st===0 ? '재시도' : '재조회';
      const cls = st===0 ? 'btn-primary' : 'btn-secondary';
      actionBtn = `<button class="btn ${cls} btn-sm" onclick="pcOpenExtRecheck('${bizId}','${siteId}')">${label}</button>`;
      if(st===0){
        actionBtn += ` <button class="btn btn-secondary btn-sm" onclick="pcManualUploadSite('${bizId}','${siteId}')">수동 업로드</button>`;
      }
    } else if(def.key === 'cbl'){
      actionBtn = `<button class="btn btn-secondary btn-sm" onclick="pcOpenCblChange('${bizId}','${siteId}')">유형 변경</button>`;
    } else {
      // infra, smd, malicious, rrmse
      if(st===0){
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="pcRerunSiteStep('${bizId}','${siteId}',${i})">재시도</button>`;
      } else if(st===2){
        actionBtn = `<button class="btn btn-secondary btn-sm" onclick="pcRerunSiteStep('${bizId}','${siteId}',${i})">재실행</button>`;
      } else {
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="pcRerunSiteStep('${bizId}','${siteId}',${i})">실행</button>`;
      }
    }
    return `
      <div class="step-row" style="display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px 26px;border:1px solid var(--border);border-radius:var(--r);margin-bottom:12px;background:#fff;">
        <div style="display:flex;align-items:center;gap:18px;min-width:0;flex:1;">
          <div style="width:40px;height:40px;border-radius:50%;background:${st===2?'var(--green-light)':st===3?'var(--blue-light)':st===0?'var(--red-light,#fef2f2)':'var(--g-100)'};color:${st===2?'var(--green)':st===3?'var(--blue)':st===0?'var(--red)':'var(--text-sub)'};font-size:17px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</div>
          <div style="min-width:0;">
            <div style="font-weight:700;font-size:18px;color:var(--navy);letter-spacing:-0.01em;">${def.name}</div>
            <div style="font-size:14px;color:var(--g-600);margin-top:8px;line-height:1.6;">${def.desc}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <span class="badge ${stateCls}" style="font-size:13px;padding:6px 14px;font-weight:600;">${stateText}</span>
          ${actionBtn}
        </div>
      </div>
    `;
  }).join('');

  $('pc-site-detail').innerHTML = `
    <!-- 사업장 기본 정보 (Phase 17-AB: [수정] 버튼) -->
    <div class="r-card">
      <div class="r-card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <div class="r-card-title">${s.siteName}</div>
        <button class="btn btn-secondary btn-sm" onclick="pcOpenEditSite('${bizId}','${siteId}')">수정</button>
      </div>
      <div class="r-card-body">
        <!-- [Phase 17-CD] 2열 grid 배치 + 폰트·패딩 강화 (info-table CSS 의존 X) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;column-gap:48px;row-gap:0;">
          ${[
            ['사업장 책임자', s.manager||'—', false],
            ['현장 연락처', s.tel||'—', false],
            ['주소', s.addr||'—', true],
            ['KEPCO 고객번호', s.kepco||'—', false, 'monospace'],
            ['한전 계약전력', s.power ? s.power + ' kW' : '—', false],
            ['등록일', s.date||'—', false],
            ['데이터 수집', s.dataStatus||'—', false],
          ].map((row, idx) => {
            const [label, val, fullWidth, family] = row;
            const fontFamily = family === 'monospace' ? 'font-family:monospace;' : '';
            return `<div style="${fullWidth ? 'grid-column:1 / -1;' : ''}display:flex;align-items:center;gap:16px;padding:18px 0;border-top:${idx===0 ? 'none' : '1px solid var(--border)'};">
              <div style="font-size:14px;color:var(--text-sub);font-weight:500;min-width:130px;">${label}</div>
              <div style="font-size:15px;color:var(--navy);font-weight:600;${fontFamily}">${val}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- 검증 단계 진행 -->
    <div class="r-card">
      <div class="r-card-header">
        <div class="r-card-title">검증 단계 진행</div>
        <span style="font-size:11px;font-weight:700;color:var(--blue);">${done} / ${total}</span>
      </div>
      <div class="r-card-body">
        ${stepsHtml}
      </div>
    </div>

    <!-- 산정 결과 요약 -->
    <div class="r-card">
      <div class="r-card-header"><div class="r-card-title">산정 결과 요약</div></div>
      <div class="r-card-body">
        <div class="result-grid">
          <div class="result-item"><div class="result-item-label">CBL 유형</div><div class="result-item-val">${cblType}</div></div>
          <div class="result-item"><div class="result-item-label">CBL 평균</div><div class="result-item-val">${cblAvg}</div></div>
          <div class="result-item"><div class="result-item-label">RRMSE</div><div class="result-item-val">${rrmseVal}</div></div>
          <div class="result-item"><div class="result-item-label">인프라 검증</div><div class="result-item-val">${infraS}</div></div>
          <div class="result-item"><div class="result-item-label">예상 감축용량</div><div class="result-item-val">${reduction!==null && reduction!==undefined ? reduction+' kW' : '-'}</div></div>
          <div class="result-item"><div class="result-item-label">외부데이터</div><div class="result-item-val">${extS}</div></div>
        </div>
      </div>
    </div>

    <!-- 외부데이터 검증 결과 -->
    <div class="r-card">
      <div class="r-card-header"><div class="r-card-title">외부데이터 검증 결과</div></div>
      <div class="r-card-body">
        <div class="check-item-line"><span>한전 데이터 연동</span><span class="badge badge-done">통과</span></div>
        <div class="check-item-line"><span>파워플래너 데이터</span><span class="badge badge-done">통과</span></div>
        <div class="check-item-line"><span>데이터 완결성</span><span class="badge badge-done">99.2%</span></div>
        <div class="check-item-line"><span>이상치 검출</span><span class="badge badge-gray">없음</span></div>
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   [Phase 17-C] 사업장 단위 사전검증 단계 운영자 액션
   ════════════════════════════════════════════════════════════ */

// 사업장 객체 찾기 헬퍼
function pcFindSite(bizId, siteId){
  const c = custById(bizId); if(!c) return null;
  const sites = pcGetSites(c);
  return sites.find(x=>x.id===siteId) || null;
}

// 사업장 시뮬레이션 결과 분기 (KEPCO 고객번호 끝자리 패리티 기반 결정론)
// [Phase 17-K] siteId 기반 → KEPCO 기반으로 변경. 가상 사이트(*-S1)가 모두 실패되는 문제 해소.
function pcSiteOutcome(site){
  // 인자가 string(siteId)로 옛 호출이면 호환 처리
  if(typeof site === 'string'){
    const s = (typeof pcFindSiteAnywhere === 'function') ? pcFindSiteAnywhere(site) : null;
    site = s || {kepco:''};
  }
  const kepco = String(site?.kepco || '');
  const m = kepco.match(/(\d+)$/);
  const last = m ? parseInt(m[1].slice(-1), 10) : 0;
  return last % 2 === 0
    ? {ok:true}
    : {ok:false, reason:'한전 API 응답 없음 — 계량기 통신 또는 외부망 점검 필요'};
}

// ── ① 외부데이터 재조회 (KEPCO 정보 수정 + 재조회) ──
function pcOpenExtRecheck(bizId, siteId){
  const s = pcFindSite(bizId, siteId); if(!s) return;
  const c = custById(bizId);
  $('cm-title').textContent = '외부데이터 조회';
  $('cm-sub').textContent = `${c.name} - ${s.siteName}`;
  $('cm-body').innerHTML = `<div class="info-box">
    한전 AMI·파워플래너 데이터를 조회합니다. KEPCO 정보가 잘못 등록된 경우 아래에서 수정 후 [조회 실행].
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">KEPCO 고객번호 <span style="color:var(--red);">*</span></label>
      <input id="pc-ext-kepco" type="text" value="${s.kepco||''}" placeholder="예: 10012001"
        style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">한전 계약전력 (kW)</label>
      <input id="pc-ext-power" type="number" value="${s.power||''}" placeholder="예: 500"
        style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">현장 책임자 / 연락처</label>
      <div style="display:flex;gap:8px;">
        <input id="pc-ext-manager" type="text" value="${s.manager||''}" placeholder="이름"
          style="flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
        <input id="pc-ext-tel" type="text" value="${s.tel||''}" placeholder="010-0000-0000"
          style="flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
      </div>
    </div>
  </div>
  <div style="margin-top:10px;padding:8px 12px;background:var(--grey-light,#f8f9fa);border-radius:6px;font-size:10px;color:var(--text-hint);">
    ⓘ KEPCO 고객번호는 한전 AMI 시스템 등록 번호와 일치해야 합니다. 변경 시 감사로그가 기록됩니다.
  </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="pcDoExtRecheck('${bizId}','${siteId}')">조회 실행</button>`;
  openModal('commonModal');
}

function pcDoExtRecheck(bizId, siteId){
  const s = pcFindSite(bizId, siteId); if(!s) return;
  // [Phase 17-F] 입력값 검증 + 갱신
  const kepcoInput = $('pc-ext-kepco')?.value?.trim();
  const powerInput = $('pc-ext-power')?.value?.trim();
  const managerInput = $('pc-ext-manager')?.value?.trim();
  const telInput = $('pc-ext-tel')?.value?.trim();
  if(kepcoInput !== undefined){
    if(!kepcoInput){
      alert('KEPCO 고객번호는 필수 입력입니다.');
      return;
    }
    // KEPCO 변경 시 감사로그
    if(kepcoInput !== s.kepco){
      logAudit?.({objectType:'site', objectId:siteId, action:'kepco_changed',
        title:`KEPCO 고객번호 변경 — ${s.siteName}`,
        desc:`이전 ${s.kepco||'(미등록)'} → 변경 ${kepcoInput}`,
        actor:'운영자', tone:'warn'});
    }
    s.kepco = kepcoInput;
    if(powerInput) s.power = parseInt(powerInput, 10) || s.power;
    if(managerInput !== undefined) s.manager = managerInput;
    if(telInput !== undefined) s.tel = telInput;
  }
  // 로딩
  $('cm-title').textContent = '외부데이터 조회 중';
  $('cm-body').innerHTML = `<div style="padding:32px 16px;text-align:center;">
      <div style="display:inline-block;width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--blue);border-radius:50%;animation:pc-spin 0.9s linear infinite;"></div>
      <div style="margin-top:14px;font-size:13px;color:var(--text-sub);font-weight:500;">한전 AMI·파워플래너 조회 중...</div>
      <div style="margin-top:4px;font-size:11px;color:var(--text-hint);">${s.siteName} · ${s.kepco}</div>
    </div>
    <style>@keyframes pc-spin{to{transform:rotate(360deg);}}</style>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" disabled style="opacity:0.5;cursor:not-allowed;">처리 중...</button>`;
  setTimeout(()=>{
    // [Phase 17-K] KEPCO 끝자리 기반 분기 (siteId 기반은 가상 사이트 모두 실패 처리되던 문제 해소)
    // 이미 위에서 input으로 s.kepco가 갱신되었으므로 최신 KEPCO 기준으로 평가
    const result = pcSiteOutcome(s);
    if(result.ok){
      // 성공: ext 단계 완료로 마킹
      if(!Array.isArray(s.steps)) s.steps = [1,1,1,1];
      s.steps[0] = 2;
      s.extS = '통과';
      logAudit?.({objectType:'site', objectId:siteId, action:'ext_recheck_success',
        title:`외부데이터 재조회 성공 — ${s.siteName}`,
        desc:`KEPCO ${s.kepco} · 한전 AMI·파워플래너 정상`, actor:'운영자', tone:'success'});
      $('cm-title').textContent = '재조회 결과';
      $('cm-body').innerHTML = `<div style="background:var(--green-light);border:1px solid var(--green-border);border-radius:var(--radius);padding:18px 16px;display:flex;gap:12px;align-items:center;">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">✓</div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:700;color:var(--green);">수신 정상</div>
            <div style="font-size:12px;color:var(--text-sub);margin-top:4px;">${s.siteName} · ${s.kepco}</div>
          </div>
        </div>`;
      $('cm-footer').innerHTML = `<button class="btn btn-primary" onclick="pcCloseExtRecheck('${bizId}','${siteId}')">확인</button>`;
    } else {
      // 실패: ext 단계 실패로 마킹
      if(!Array.isArray(s.steps)) s.steps = [1,1,1,1];
      s.steps[0] = 0;
      s.extS = '실패';
      logAudit?.({objectType:'site', objectId:siteId, action:'ext_recheck_failed',
        title:`외부데이터 재조회 실패 — ${s.siteName}`,
        desc:`KEPCO ${s.kepco} · ${result.reason}`, actor:'운영자', tone:'warn'});
      $('cm-title').textContent = '재조회 결과';
      $('cm-body').innerHTML = `<div style="background:var(--red-light,#fef2f2);border:1px solid var(--red-border,#fecaca);border-radius:var(--radius);padding:18px 16px;display:flex;gap:12px;align-items:center;">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">!</div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:700;color:var(--red);">통신 실패</div>
            <div style="font-size:12px;color:var(--text-sub);margin-top:4px;">${s.siteName} · ${s.kepco}</div>
          </div>
        </div>`;
      // [Phase 17-E] 실패 [닫기]도 화면 갱신 흐름으로 통일 (단계 0/실패 뱃지 즉시 반영)
      $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="pcCloseExtRecheck('${bizId}','${siteId}')">닫기</button>
        <button class="btn btn-primary" onclick="pcDoExtRecheck('${bizId}','${siteId}')">다시 시도</button>`;
    }
  }, 1400);
}

function pcCloseExtRecheck(bizId, siteId){
  closeModal('commonModal');
  // [Phase 17-E] 좌측 사업장 목록(N/6 뱃지) + 우측 단계 박스 모두 갱신
  const c = custById(bizId);
  if(c && typeof pcRenderSitesTab === 'function') pcRenderSitesTab(c);
  pcSelectSite(bizId, siteId);
}

// ── 수동 업로드 (외부데이터 실패 시 우회) ──
// [Phase 17-J] 데이터수집현황 페이지로 이동 + 사업자/사업장 컨텍스트 전달.
// dcInit가 dcState.pendingUpload를 감지해 자동으로 엑셀 업로드 모달 오픈.
function pcManualUploadSite(bizId, siteId){
  const s = pcFindSite(bizId, siteId); if(!s) return;
  // 해당 사업자가 속한 자원그룹 찾기 (있으면 컨텍스트로 전달)
  const ownerGroup = store.groups.find(g => (g.customerIds||[]).includes(bizId));
  // 데이터수집 페이지에 업로드 컨텍스트 전달
  if(typeof dcState !== 'undefined'){
    dcState.pendingUpload = {
      bizId, siteId, kepco: s.kepco || '',
      groupId: ownerGroup ? ownerGroup.id : null
    };
  }
  logAudit?.({objectType:'site', objectId:siteId, action:'manual_upload_start',
    title:`수동 업로드 진입 — ${s.siteName}`,
    desc:`KEPCO ${s.kepco} · 외부데이터 조회 실패 우회`, actor:'운영자', tone:'info'});
  closeModal('commonModal');
  if(typeof navigate === 'function') navigate('datacollect');
}

// ── ⑥ CBL 유형 변경 ──
function pcOpenCblChange(bizId, siteId){
  const s = pcFindSite(bizId, siteId); if(!s) return;
  const c = custById(bizId);
  const current = s.cblType ?? c.cblType ?? 'High 5 of 10';
  $('cm-title').textContent = 'CBL 유형 변경';
  $('cm-sub').textContent = `${c.name} - ${s.siteName}`;
  $('cm-body').innerHTML = `<div class="info-box">
    CBL(Customer Baseline Load) 유형을 선택하면 사업장 기준부하가 재산정됩니다.
  </div>
  <div style="margin-top:12px;font-size:12px;color:var(--text-sub);margin-bottom:6px;">CBL 유형</div>
  <select id="pc-cbl-select" class="filter-select" style="width:100%;">
    <option value="High 5 of 10" ${current==='High 5 of 10'?'selected':''}>High 5 of 10 (최근 10영업일 중 상위 5일 평균)</option>
    <option value="Mid 4 of 6"   ${current==='Mid 4 of 6'?'selected':''}>Mid 4 of 6 (최근 6영업일 중 중간 4일 평균)</option>
    <option value="동일요일 평균" ${current==='동일요일 평균'?'selected':''}>동일요일 평균 (최근 4주 동일 요일)</option>
  </select>
  <div class="check-item-row" style="margin-top:14px;"><span>현재 CBL 평균</span><span style="font-weight:600;">${s.cblAvg ?? c.cblAvg ?? '—'}</span></div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="pcDoCblChange('${bizId}','${siteId}')">재산정</button>`;
  openModal('commonModal');
}

function pcDoCblChange(bizId, siteId){
  const s = pcFindSite(bizId, siteId); if(!s) return;
  const newType = $('pc-cbl-select')?.value;
  if(!newType) return;
  // 시뮬레이션: CBL 유형 적용 + 평균 약간 변동
  s.cblType = newType;
  const baseAvg = parseInt(String(s.cblAvg||'200').replace(/\D/g,''), 10) || 200;
  const delta = newType==='High 5 of 10' ? 0 : newType==='Mid 4 of 6' ? -8 : -15;
  s.cblAvg = (baseAvg + delta) + 'kW';
  if(!Array.isArray(s.steps)) s.steps = [1,1,1,1];
  s.steps[5] = 2;
  s.cblS = '완료';
  logAudit?.({objectType:'site', objectId:siteId, action:'cbl_changed',
    title:`CBL 유형 변경 — ${s.siteName}`,
    desc:`${newType} 적용 · 평균 ${s.cblAvg}`, actor:'운영자', tone:'info'});
  closeModal('commonModal');
  if(typeof showToast === 'function') showToast(`CBL 유형 변경: ${newType}`);
  // [Phase 17-E] 좌측 목록 N/6 뱃지도 갱신
  const c2 = custById(bizId);
  if(c2 && typeof pcRenderSitesTab === 'function') pcRenderSitesTab(c2);
  pcSelectSite(bizId, siteId);
}

// ── 일반 단계 재실행 (infra/smd/malicious/rrmse) ──
function pcRerunSiteStep(bizId, siteId, stepIdx){
  const s = pcFindSite(bizId, siteId); if(!s) return;
  const def = pcStepDefs[stepIdx];
  if(!Array.isArray(s.steps)) s.steps = [1,1,1,1];
  // 시뮬레이션: 1초 후 완료
  s.steps[stepIdx] = 3; // 진행중
  pcSelectSite(bizId, siteId);
  setTimeout(()=>{
    s.steps[stepIdx] = 2; // 완료
    // step별 status 필드 갱신
    if(def.key==='infra')     s.infraS = '완료';
    if(def.key==='rrmse')     s.rrmseS = '완료';
    logAudit?.({objectType:'site', objectId:siteId, action:'step_rerun',
      title:`${def.name} 재실행 완료 — ${s.siteName}`,
      desc:`KEPCO ${s.kepco}`, actor:'운영자', tone:'info'});
    // [Phase 17-E] 좌측 목록 + 우측 상세 둘 다 갱신
    const c3 = custById(bizId);
    if(c3 && typeof pcRenderSitesTab === 'function') pcRenderSitesTab(c3);
    pcSelectSite(bizId, siteId);
    if(typeof showToast === 'function') showToast(`${def.name} 재실행 완료`);
  }, 900);
}

function pcRenderSteps(c){
  const list = $('pc-steps-list'); list.innerHTML='';
  let done = 0;
  // [Phase 17-L] 사업자 c.steps도 4단계로 정규화 (옛 6 길이 시드 호환)
  const cSteps = pcNormalizeSteps(c.steps);
  c.steps = cSteps;  // 영구 저장
  pcStepDefs.forEach((s,i)=>{
    const st = cSteps[i];
    // 잠금조건: 순차 실행 (infra: ext 완료 / rrmse: infra 완료 / cbl: rrmse 완료)
    const isLocked = (i===1 && cSteps[0]!==2)
                 || (i===2 && cSteps[1]!==2)
                 || (i===3 && cSteps[2]!==2);
    let nc='step-num', bc='wait', bt='대기';
    if(st===2){nc+=' done'; bc='done'; bt='완료'; done++;}
    else if(st===3){nc+=' active-step'; bc='active-step'; bt=s.auto?'자동 실행중':'진행중';}
    else if(st===0){nc+=' failed'; bc='failed'; bt='실패';}
    else if(isLocked){bt='대기';}
    else{bt=s.auto?'자동 실행 예정':'대기';}
    const autoTag = s.auto&&st!==2 ? `<span style="font-size:9px;color:var(--text-hint);margin-left:4px;">AUTO</span>` : '';
    const d = document.createElement('div');
    d.className = 'step-item' + (isLocked&&st!==2?' locked':'');
    d.style.opacity = (isLocked&&st!==2)?'0.45':'1';
    d.innerHTML = `<div class="${nc}">${i+1}</div>
      <div class="step-info"><div class="step-name">${s.name}${autoTag}</div><div class="step-desc">${s.desc}</div></div>
      <span class="step-badge ${bc}">${bt}</span>`;
    if(!isLocked && st!==2 && st!==0){
      d.onclick = ()=> pcOpenStep(i);
    } else if(st===2){
      d.onclick = ()=> pcOpenStep(i); // 완료도 조회 가능
    } else if(st===0){
      d.onclick = ()=> pcOpenStep(i); // 실패도 조회
    }
    list.appendChild(d);
  });
  $('pc-step-count').textContent = `${done} / ${pcStepDefs.length}`;
}

function pcUpdateContractBtn(c){
  const btn = $('pc-contract-btn');
  const allDone = c.steps.every(s=>s===2);
  const contracted = c.status==='계약완료';
  const rejected = c.status==='반려';
  const handedOff = ['계약대기','검토중'].includes(c.contractStage);
  if(contracted){
    btn.disabled = true;
    btn.textContent = '계약 완료됨';
    btn.style.display = '';
  } else if(handedOff){
    btn.disabled = true;
    btn.textContent = `계약관리 ${c.contractStage}`;
    btn.style.display = '';
  } else if(rejected){
    btn.disabled = true;
    btn.textContent = '반려됨';
    btn.style.display = '';
  } else {
    btn.disabled = !allDone;
    btn.textContent = '계약관리로 이관';
    btn.style.display = '';
    btn.title = allDone?'':'모든 검증 단계 완료 후 계약관리 이관이 가능합니다.';
  }
}

function pcOpenStep(stepIdx){
  const c = custById(pcState.currentId); if(!c) return;
  const s = pcStepDefs[stepIdx];
  const st = c.steps[stepIdx];
  $('step-title').textContent = s.name;
  $('step-sub').textContent = `${c.recno} · ${c.name}`;
  $('step-body').innerHTML = pcStepBodyHtml(s.key, c, st);
  const footer = $('step-footer');
  if(st===2){
    footer.innerHTML = `<button class="btn btn-secondary" onclick="closeModal('stepModal')">닫기</button>`;
  } else if(st===0){
    footer.innerHTML = `<button class="btn btn-secondary" onclick="closeModal('stepModal')">닫기</button>
                       <button class="btn btn-primary" onclick="pcRunStep(${stepIdx})">재실행</button>`;
  } else {
    if(s.auto){
      footer.innerHTML = `<button class="btn btn-secondary" onclick="closeModal('stepModal')">닫기</button>
                         <button class="btn btn-primary" onclick="pcRunStep(${stepIdx})">자동 실행</button>`;
    } else {
      footer.innerHTML = `<button class="btn btn-secondary" onclick="closeModal('stepModal')">취소</button>
                         <button class="btn btn-primary" onclick="pcCompleteStep(${stepIdx})">완료 처리</button>`;
    }
  }
  openModal('stepModal');
}

function pcStepBodyHtml(key, c, st){
  if(key==='ext'){
    return `<div class="info-box">한전 및 파워플래너 API를 통해 고객 데이터를 조회합니다.</div>
    <div class="form-row"><label class="form-label">한전 고객번호</label><input class="form-input" value="${c.kepco||''}" placeholder="한전 고객번호"></div>
    <div class="form-row"><label class="form-label">파워플래너 ID</label><input class="form-input" placeholder="파워플래너 ID"></div>
    <div class="form-row"><label class="form-label">조회 기간</label>
      <div style="display:flex;gap:8px;align-items:center;"><input class="form-input" type="date" value="2025-01-01" style="flex:1"><span style="color:var(--text-hint);font-size:12px;">~</span><input class="form-input" type="date" value="2026-04-10" style="flex:1"></div>
    </div>
    ${st===2?'<div class="info-box success">조회 완료 — 데이터 포인트 8,760개 수집, 완결성 99.2%</div>':''}
    ${st===0?'<div class="info-box danger">조회 실패 — 한전 API 응답 오류 (KEPCO-404)</div>':''}`;
  }
  if(key==='infra'){
    // [Phase 17-CX] 사전검증 인프라 검증에서 RTU·SMD 모두 제거 — 한전 AMI만 확인
    return `<div class="info-box">한전 AMI 계량기 설치·통신 상태를 확인합니다.</div>
    <div class="form-row"><label class="form-label">한전 AMI 계량기 설치</label>
      <select class="form-select" id="infra-ami"><option value="설치">설치</option><option value="미설치">미설치</option><option value="설치예정">설치예정</option></select>
    </div>`;
  }
  if(key==='mali'){
    return `<div class="info-box">이상 사용 패턴을 자동으로 분석합니다. (AUTO)</div>
    <div class="check-item-row"><span>급격한 사용량 변동 (±30% 초과)</span><span class="badge badge-${st===2?'done':'gray'}">${st===2?'없음':'대기'}</span></div>
    <div class="check-item-row"><span>피크 집중 패턴 이상</span><span class="badge badge-${st===2?'done':'gray'}">${st===2?'정상':'대기'}</span></div>
    <div class="check-item-row"><span>데이터 조작 의심 구간</span><span class="badge badge-${st===2?'done':'gray'}">${st===2?'없음':'대기'}</span></div>
    <div class="check-item-row"><span>비정상 영업일 패턴</span><span class="badge badge-${st===2?'done':'gray'}">${st===2?'없음':'대기'}</span></div>
    ${st===2?'<div class="info-box success" style="margin-top:12px;">이상 패턴이 감지되지 않았습니다.</div>':''}`;
  }
  if(key==='rrmse'){
    return `<div class="info-box">검증기간의 시간별 기준부하와 실제 사용전력량의 평균 오차 비율로 전기소비 형태를 검증합니다. (AUTO)</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;">
      <div class="check-item-row"><span style="color:var(--green);font-weight:500;">매우 우수 (< 10%)</span><span style="font-weight:700;color:var(--green);">Excellent</span></div>
      <div class="check-item-row"><span style="color:var(--blue);font-weight:500;">우수 (10~20%)</span><span style="font-weight:700;color:var(--blue);">Good</span></div>
      <div class="check-item-row"><span style="color:var(--amber);font-weight:500;">허용 (20~30%)</span><span style="font-weight:700;color:var(--amber);">Fair</span></div>
      <div class="check-item-row"><span style="color:var(--red);font-weight:500;">낮음 (> 30%)</span><span style="font-weight:700;color:var(--red);">반려 대상</span></div>
    </div>
    ${st===2?`<div class="info-box success">현재 오차율 <b>${c.rrmseVal}</b> — 매우 우수</div>`:''}`;
  }
  if(key==='cbl'){
    const selected = c.cblType || 'High 5 of 10';
    return `<div class="info-box">기준부하(CBL)를 산정하고 적용 유형을 선택합니다.</div>
    <div class="form-row"><label class="form-label">CBL 유형 선택</label>
      <div class="radio-group">
        <label class="radio-item" style="padding:10px;border:1px solid var(--border);border-radius:var(--radius);">
          <input type="radio" name="cbl-type" value="High 5 of 10" ${selected==='High 5 of 10'?'checked':''}>
          <div><div style="font-weight:500;">High 5 of 10 <span class="badge badge-done" style="margin-left:6px;">권장</span></div>
            <div style="font-size:11px;color:var(--text-hint);margin-top:2px;">최근 10 영업일 중 상위 5일 평균</div></div>
        </label>
        <label class="radio-item" style="padding:10px;border:1px solid var(--border);border-radius:var(--radius);">
          <input type="radio" name="cbl-type" value="동일요일 평균" ${selected==='동일요일 평균'?'checked':''}>
          <div><div style="font-weight:500;">동일 요일 평균</div>
            <div style="font-size:11px;color:var(--text-hint);margin-top:2px;">최근 4주 동일 요일 평균값</div></div>
        </label>
        <label class="radio-item" style="padding:10px;border:1px solid var(--border);border-radius:var(--radius);">
          <input type="radio" name="cbl-type" value="회귀분석" ${selected==='회귀분석'?'checked':''}>
          <div><div style="font-weight:500;">회귀분석</div>
            <div style="font-size:11px;color:var(--text-hint);margin-top:2px;">기온 등 변수 활용 회귀 모델</div></div>
        </label>
      </div>
    </div>
    ${st===2?`<div class="info-box success">산정 완료 — CBL 유형: <b>${c.cblType}</b>, 평균: <b>${c.cblAvg}</b></div>`:''}`;
  }
  return '';
}

function pcCompleteStep(stepIdx){
  const c = custById(pcState.currentId); if(!c) return;
  // CBL은 라디오 선택 반영
  if(pcStepDefs[stepIdx].key==='cbl'){
    const sel = document.querySelector('input[name="cbl-type"]:checked')?.value;
    if(sel){
      c.cblType = sel;
      c.cblAvg = sel==='High 5 of 10'?Math.round(c.power*0.95)+'kW':sel==='동일요일 평균'?Math.round(c.power*0.90)+'kW':Math.round(c.power*0.92)+'kW';
    }
  }
  if(pcStepDefs[stepIdx].key==='ext') c.extS = '통과';
  if(pcStepDefs[stepIdx].key==='infra') c.infraS = '완료';
  if(pcStepDefs[stepIdx].key==='cbl') c.cblS = '완료';
  c.steps[stepIdx] = 2;
  pcAddLog(c, pcStepDefs[stepIdx].name+' 완료', `${c.recno} · ${pcStepDefs[stepIdx].name} 완료 처리`, 'done');
  // 상태 업데이트
  if(c.status==='검증대기' && c.steps.some(s=>s===2)) c.status='검증중';
  if(c.steps.every(s=>s===2)) c.status='검증완료';
  // 반려 상태였는데 재검증으로 다시 통과한 경우 검증중 상태로 복귀
  if(c.status==='반려' && c.steps.some(s=>s===2) && !c.steps.some(s=>s===0)) c.status='검증중';
  closeModal('stepModal');
  pcShowDetail(c.id);
  showToast(`${pcStepDefs[stepIdx].name} 완료 처리되었습니다.`);
  // 자동 실행 체인: 외부+인프라+SMD 모두 완료되면 → 악의성 → RRMSE 자동
  // ※ 이미 완료된 단계는 재실행하지 않음 (RRMSE 랜덤값 덮어쓰기 방지)
  const prereqDone = c.steps[0]===2 && c.steps[1]===2 && c.steps[2]===2;
  const maliDone = c.steps[3]===2;
  const rrmseDone = c.steps[4]===2;
  if((stepIdx===0||stepIdx===1||stepIdx===2) && prereqDone && !maliDone){
    setTimeout(()=>pcRunAuto(c, 3, '악의성 검증 자동 실행 중...', ()=>{
      if(!rrmseDone){
        setTimeout(()=>pcRunAuto(c, 4, 'RRMSE 분석 자동 실행 중...', null), 800);
      }
    }), 600);
  } else if((stepIdx===0||stepIdx===1||stepIdx===2) && prereqDone && maliDone && !rrmseDone){
    // 악의성은 이미 완료되어 있고 RRMSE만 남은 경우
    setTimeout(()=>pcRunAuto(c, 4, 'RRMSE 분석 자동 실행 중...', null), 600);
  }
}

function pcRunStep(stepIdx){
  const c = custById(pcState.currentId); if(!c) return;
  const s = pcStepDefs[stepIdx];
  closeModal('stepModal');
  pcRunAuto(c, stepIdx, `${s.name} 실행 중...`, null);
}

function pcRunAuto(c, stepIdx, msg, cb){
  c.steps[stepIdx] = 3;
  // 재실행 시점 status 강등: 이전에 검증완료였어도 하나라도 재실행 중이면 '검증중'으로 복귀
  if(c.status==='검증완료') c.status='검증중';
  pcRenderSteps(c);
  showToast(msg);
  pcAddLog(c, pcStepDefs[stepIdx].name+' 진행중', msg, 'progress');
  setTimeout(()=>{
    c.steps[stepIdx] = 2;
    if(stepIdx===4){ c.rrmseVal = (6+Math.floor(Math.random()*5))+'%'; c.rrmseS='완료'; }
    if(stepIdx===3) {} // 악의성: 별도 값 없음
    if(c.status==='검증대기') c.status='검증중';
    if(c.steps.every(s=>s===2)) c.status='검증완료';
    pcShowDetail(c.id);
    showToast(pcStepDefs[stepIdx].name + ' 완료');
    pcAddLog(c, pcStepDefs[stepIdx].name+' 완료', `${pcStepDefs[stepIdx].name} 자동 실행 성공`, 'done');
    if(cb) cb();
  }, 1800);
}

function pcAddLog(c, title, msg, cls){
  const d = new Date(), pad=n=>String(n).padStart(2,'0');
  store.verifyLogs.unshift({
    date:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
    time:`${pad(d.getHours())}:${pad(d.getMinutes())}`,
    recno:c.recno, cls, title, msg, user:'운영자'
  });
}
function pcRenderDetailLog(c){
  const logs = store.verifyLogs.filter(l=>l.recno===c.recno);
  const box = $('pc-log-list');
  if(!logs.length){ box.innerHTML = '<div style="padding:20px;font-size:12px;color:var(--text-hint);">로그가 없습니다.</div>'; return; }
  box.innerHTML = logs.map(l=>`<div class="d-log-item">
    <div class="d-log-dot ${l.cls}"></div>
    <div class="d-log-time">${l.time}<br><span style="font-size:9px;">${l.date}</span></div>
    <div class="d-log-body">
      <div class="d-log-title">${l.title}</div>
      <div class="d-log-desc">${l.msg}<span style="color:var(--text-hint);margin-left:8px;">· ${l.user}</span></div>
    </div></div>`).join('');
}

function pcRenderMemo(c){
  const memos = store.memos[c.recno] || [];
  const box = $('pc-memo-history');
  if(!memos.length){ box.innerHTML = '<div style="padding:20px;font-size:12px;color:var(--text-hint);">작성된 메모가 없습니다.</div>'; return; }
  box.innerHTML = memos.map(m=>`<div class="memo-item">
    <div class="memo-meta"><span>${m.user}</span><span>${m.at}</span></div>
    <div class="memo-text">${m.text}</div></div>`).join('');
}
function pcAddMemo(){
  const c = custById(pcState.currentId); if(!c) return;
  const txt = $('pc-memo-input').value.trim();
  if(!txt){ showToast('메모를 입력하세요.'); return; }
  if(!store.memos[c.recno]) store.memos[c.recno] = [];
  store.memos[c.recno].unshift({user:'현진영', at:nowStr(), text:txt});
  $('pc-memo-input').value = '';
  pcRenderMemo(c);
  showToast('메모가 저장되었습니다.');
}

/* [Phase 17-AB] 사업장 추가/수정 — 사전검증 상세 사업장 탭에서 호출 */

// 사업장 추가 모달
function pcOpenAddSite(){
  const c = custById(pcState.currentId); if(!c) return;
  pcRenderSiteForm({
    title: '사업장 추가',
    sub: `${c.name} - 새 사업장 등록`,
    site: { siteName:'', manager:c.ceo||'', tel:c.tel||'', addr:'', kepco:'', power:'' },
    onSave: pcSubmitAddSite,
  });
}

/* [Phase 17-AE] 사업장 정보 수정 (기본 + 60hz 계약 정보 통합) */
function pcOpenEditSiteInfo(bizId, siteId){
  const c = custById(bizId); if(!c) return;
  const sites = pcGetSites(c);
  const s = sites.find(x => x.id === siteId);
  if(!s){ showToast('사업장을 찾을 수 없습니다.'); return; }
  const ct = s.contract || {};
  $('cm-title').textContent = '사업장 정보 수정';
  $('cm-sub').textContent = `${c.name} - ${s.siteName}`;
  $('cm-body').innerHTML = `<div class="info-box" style="margin-bottom:12px;">
    사업장 기본 정보와 60hz 계약 정보를 함께 관리합니다.
  </div>
  <div style="font-size:11px;color:var(--text-hint);font-weight:600;margin-bottom:8px;">사업장 기본 정보</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">사업장명 <span style="color:var(--red);">*</span></label>
      <input id="pc-si-name" type="text" value="${(s.siteName||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">담당자</label>
      <input id="pc-si-manager" type="text" value="${(s.manager||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">연락처</label>
      <input id="pc-si-tel" type="text" value="${(s.tel||'').replace(/"/g,'&quot;')}" placeholder="010-0000-0000" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">한전 계약전력 (kW)</label>
      <input id="pc-si-power" type="number" value="${s.power||''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div style="grid-column:1/-1;">
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">주소</label>
      <input id="pc-si-addr" type="text" value="${(s.addr||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">KEPCO 고객번호</label>
      <input id="pc-si-kepco" type="text" value="${(s.kepco||'').replace(/"/g,'&quot;')}" placeholder="8자리" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;">
    </div>
  </div>
  <div style="font-size:11px;color:var(--text-hint);font-weight:600;margin-bottom:8px;">60hz 계약 정보</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">60hz 계약전력 (kW)</label>
      <input id="pc-ci-power" type="number" value="${ct.power||''}" placeholder="예: 400" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">수수료 (%)</label>
      <input id="pc-ci-fee" type="number" value="${ct.feeRate!=null?ct.feeRate:''}" placeholder="예: 15" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div></div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">계약 시작일</label>
      <input id="pc-ci-start" type="date" value="${ct.startDate||''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">계약 종료일</label>
      <input id="pc-ci-end" type="date" value="${ct.endDate||''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
  </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="pcSubmitEditSiteInfo('${bizId}','${siteId}')">저장</button>`;
  openModal('commonModal');
}

function pcSubmitEditSiteInfo(bizId, siteId){
  const c = custById(bizId); if(!c) return;
  const sites = pcGetSites(c);
  const s = sites.find(x => x.id === siteId);
  if(!s) return;
  const newName    = $('pc-si-name')?.value?.trim();
  const newManager = $('pc-si-manager')?.value?.trim();
  const newTel     = $('pc-si-tel')?.value?.trim();
  const newAddr    = $('pc-si-addr')?.value?.trim();
  const newKepco   = $('pc-si-kepco')?.value?.trim();
  const newPower   = parseInt($('pc-si-power')?.value, 10);
  const ctPower    = parseInt($('pc-ci-power')?.value, 10);
  const ctFee      = parseFloat($('pc-ci-fee')?.value);
  const ctStart    = $('pc-ci-start')?.value;
  const ctEnd      = $('pc-ci-end')?.value;
  if(!newName){ alert('사업장명은 필수 입력입니다.'); return; }
  const changes = [];
  const apply = (key, oldVal, newVal, label) => {
    const a = (oldVal == null ? '' : String(oldVal));
    const b = (newVal == null ? '' : String(newVal));
    if(a !== b){ changes.push(`${label}: ${a||'(미입력)'} → ${b||'(미입력)'}`); s[key] = newVal; }
  };
  apply('siteName', s.siteName, newName, '사업장명');
  apply('manager', s.manager, newManager, '담당자');
  apply('tel', s.tel, newTel, '연락처');
  apply('addr', s.addr, newAddr, '주소');
  apply('kepco', s.kepco, newKepco, 'KEPCO');
  if(!isNaN(newPower)) apply('power', s.power, newPower, '한전 계약전력');
  if(!s.contract) s.contract = {};
  const ct = s.contract;
  const applyCt = (key, oldVal, newVal, label) => {
    const a = (oldVal == null ? '' : String(oldVal));
    const b = (newVal == null ? '' : String(newVal));
    if(a !== b){ changes.push(`${label}: ${a||'(미입력)'} → ${b||'(미입력)'}`); ct[key] = newVal; }
  };
  if(!isNaN(ctPower)) applyCt('power', ct.power, ctPower, '60hz 계약전력');
  if(!isNaN(ctFee)) applyCt('feeRate', ct.feeRate, ctFee, '수수료');
  applyCt('startDate', ct.startDate, ctStart, '계약 시작일');
  applyCt('endDate', ct.endDate, ctEnd, '계약 종료일');
  logAudit?.({
    objectType:'site', objectId:siteId, action:'site_contract_updated',
    title:`사업장 정보 수정 — ${newName}`,
    desc: changes.length ? changes.join(' · ') : '변경 사항 없음',
    actor:'운영자', tone:'info'
  });
  pcAddLog(c, '사업장 정보 수정', changes.length ? `${newName} · ${changes.join(' · ')}` : `${newName} · 변경 사항 없음`, 'done');
  closeModal('commonModal');
  showToast(`사업장 정보 저장 — ${newName}`);
  pcShowDetail(c.id);
}

/* [Phase 17-AE] 계약서류 업로드 — 사업장 단위 */
function pcOpenUploadSiteDoc(bizId, siteId){
  const c = custById(bizId); if(!c) return;
  const sites = pcGetSites(c);
  const s = sites.find(x => x.id === siteId);
  if(!s) return;
  $('cm-title').textContent = '계약서류 업로드';
  $('cm-sub').textContent = `${c.name} - ${s.siteName}`;
  $('cm-body').innerHTML = `<div class="info-box" style="margin-bottom:12px;">
    계약서·부속서류 파일을 사업장에 첨부합니다. 변경 시 감사로그가 기록됩니다.
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;">
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">파일 <span style="color:var(--red);">*</span></label>
      <input id="pc-doc-file" type="file" accept=".pdf,.docx,.xlsx,.png,.jpg" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box;background:#fff;">
      <div style="font-size:10px;color:var(--text-hint);margin-top:4px;">.pdf, .docx, .xlsx, .png, .jpg (최대 20MB)</div>
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">서류 종류</label>
      <select id="pc-doc-type" class="filter-select" style="width:100%;">
        <option value="계약서">계약서</option>
        <option value="부속서류">부속서류</option>
        <option value="동의서">개인정보동의서</option>
        <option value="기타">기타</option>
      </select>
    </div>
  </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="pcSubmitUploadSiteDoc('${bizId}','${siteId}')">업로드</button>`;
  openModal('commonModal');
}

function pcSubmitUploadSiteDoc(bizId, siteId){
  const c = custById(bizId); if(!c) return;
  const sites = pcGetSites(c);
  const s = sites.find(x => x.id === siteId);
  if(!s) return;
  const file = $('pc-doc-file')?.files?.[0];
  const docType = $('pc-doc-type')?.value || '기타';
  if(!file){ alert('업로드할 파일을 선택하세요.'); return; }
  if(file.size > 20 * 1024 * 1024){ alert('파일 크기는 20MB 이하여야 합니다.'); return; }
  if(!s.contract) s.contract = {};
  if(!Array.isArray(s.contract.docs)) s.contract.docs = [];
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  s.contract.docs.push({
    name: `[${docType}] ${file.name}`,
    size: file.size,
    uploadedAt: `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,
  });
  logAudit?.({
    objectType:'site', objectId:siteId, action:'site_doc_uploaded',
    title:`계약서류 업로드 — ${s.siteName}`,
    desc:`${docType} · ${file.name} (${(file.size/1024).toFixed(1)} KB)`,
    actor:'운영자', tone:'info'
  });
  pcAddLog(c, '계약서류 업로드', `${s.siteName} · ${docType} · ${file.name}`, 'done');
  closeModal('commonModal');
  showToast(`서류 업로드 완료 — ${file.name}`);
  pcShowDetail(c.id);
}

// 사업장 수정 모달
function pcOpenEditSite(bizId, siteId){
  const c = custById(bizId); if(!c) return;
  const sites = pcGetSites(c);
  const s = sites.find(x => x.id === siteId);
  if(!s){ showToast('사업장을 찾을 수 없습니다.'); return; }
  pcRenderSiteForm({
    title: '사업장 정보 수정',
    sub: `${c.name} - ${s.siteName}`,
    site: s,
    onSave: () => pcSubmitEditSite(bizId, siteId),
  });
}

// 공통 폼 렌더
function pcRenderSiteForm({title, sub, site, onSave}){
  $('cm-title').textContent = title;
  $('cm-sub').textContent = sub;
  $('cm-body').innerHTML = `<div class="info-box" style="margin-bottom:12px;">
    사업장 기본 정보를 입력합니다. 변경 시 감사로그가 기록됩니다.
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;">
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">사업장명 <span style="color:var(--red);">*</span></label>
      <input id="pc-s-name" type="text" value="${(site.siteName||'').replace(/"/g,'&quot;')}" placeholder="예: 수원사업장" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div>
        <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">사업장 책임자</label>
        <input id="pc-s-manager" type="text" value="${(site.manager||'').replace(/"/g,'&quot;')}" placeholder="현장 책임자 이름" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
      </div>
      <div>
        <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">현장 연락처</label>
        <input id="pc-s-tel" type="text" value="${(site.tel||'').replace(/"/g,'&quot;')}" placeholder="010-0000-0000" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
      </div>
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">주소</label>
      <input id="pc-s-addr" type="text" value="${(site.addr||'').replace(/"/g,'&quot;')}" placeholder="시·구·상세주소" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div>
        <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">KEPCO 고객번호</label>
        <input id="pc-s-kepco" type="text" value="${(site.kepco||'').replace(/"/g,'&quot;')}" placeholder="8자리 숫자" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;">
      </div>
      <div>
        <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">한전 계약전력 (kW)</label>
        <input id="pc-s-power" type="number" value="${site.power||''}" placeholder="예: 500" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
      </div>
    </div>
  </div>`;
  // onSave 함수 참조를 위해 전역에 임시 저장
  window.__pcSiteFormSave = onSave;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="window.__pcSiteFormSave && window.__pcSiteFormSave()">저장</button>`;
  openModal('commonModal');
}

// 사업장 추가 저장
function pcSubmitAddSite(){
  const c = custById(pcState.currentId); if(!c) return;
  const newName = $('pc-s-name')?.value?.trim();
  if(!newName){ alert('사업장명은 필수 입력입니다.'); return; }

  // 사이트 ID 생성 — 사업자 id + 사이트 번호 시퀀스
  pcGetSites(c); // sites 배열 보장
  const existingNums = (c.sites||[]).map(s => {
    const m = String(s.id||'').match(/-S(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  });
  const nextNum = Math.max(0, ...existingNums) + 1;
  const newSiteId = c.id + '-S' + nextNum;

  const today = (() => {
    const d = new Date(), pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  })();

  const newSite = {
    id: newSiteId,
    siteName: newName,
    manager: $('pc-s-manager')?.value?.trim() || '',
    tel: $('pc-s-tel')?.value?.trim() || '',
    addr: $('pc-s-addr')?.value?.trim() || '',
    kepco: $('pc-s-kepco')?.value?.trim() || '',
    power: parseInt($('pc-s-power')?.value, 10) || 0,
    steps: [1,1,1,1],
    dataStatus: '미수집',
    verifyStatus: c.status,
    date: today,
  };
  c.sites = c.sites || [];
  c.sites.push(newSite);

  logAudit?.({
    objectType:'site', objectId:newSiteId, action:'site_added',
    title:`사업장 추가 — ${newName}`,
    desc:`${c.name} 사업자에 사업장 신규 등록 · KEPCO ${newSite.kepco||'(미입력)'}`,
    actor:'운영자', tone:'info'
  });
  pcAddLog(c, '사업장 추가', `${newName} (KEPCO ${newSite.kepco||'-'}) 신규 등록`, 'done');
  closeModal('commonModal');
  showToast(`사업장 추가 — ${newName}`);
  // 화면 갱신
  pcRenderSitesTab(c);
  pcSelectSite(c.id, newSiteId);
  pcRenderTable(); // 목록의 사업장 수도 갱신
}

// 사업장 수정 저장
function pcSubmitEditSite(bizId, siteId){
  const c = custById(bizId); if(!c) return;
  const sites = pcGetSites(c);
  const s = sites.find(x => x.id === siteId);
  if(!s) return;

  const newName    = $('pc-s-name')?.value?.trim();
  const newManager = $('pc-s-manager')?.value?.trim();
  const newTel     = $('pc-s-tel')?.value?.trim();
  const newAddr    = $('pc-s-addr')?.value?.trim();
  const newKepco   = $('pc-s-kepco')?.value?.trim();
  const newPower   = parseInt($('pc-s-power')?.value, 10) || 0;
  if(!newName){ alert('사업장명은 필수 입력입니다.'); return; }

  const changes = [];
  const apply = (key, oldVal, newVal, label) => {
    const a = (oldVal == null ? '' : String(oldVal));
    const b = (newVal == null ? '' : String(newVal));
    if(a !== b){ changes.push(`${label}: ${a||'(미입력)'} → ${b||'(미입력)'}`); s[key] = newVal; }
  };
  apply('siteName', s.siteName, newName, '사업장명');
  apply('manager', s.manager, newManager, '책임자');
  apply('tel', s.tel, newTel, '연락처');
  apply('addr', s.addr, newAddr, '주소');
  apply('kepco', s.kepco, newKepco, 'KEPCO');
  if(newPower) apply('power', s.power, newPower, '한전 계약전력');

  logAudit?.({
    objectType:'site', objectId:siteId, action:'site_info_updated',
    title:`사업장 정보 수정 — ${newName}`,
    desc: changes.length ? changes.join(' · ') : '변경 사항 없음',
    actor:'운영자', tone:'info'
  });
  pcAddLog(c, '사업장 정보 수정', `${newName}: ${changes.length ? changes.join(' · ') : '변경 사항 없음'}`, 'done');
  closeModal('commonModal');
  showToast(`사업장 정보 저장 — ${newName}`);
  pcRenderSitesTab(c);
  pcSelectSite(bizId, siteId);
}

/* [Phase 17-AA] 사업자 정보 수정 모달 — 사전검증 상세 기본정보 탭에서 호출 */
/* [Phase 17-AK] 사업자 정보 인라인 편집 — 모달 X, 같은 카드에서 [수정]↔[저장]/[취소] 토글 */
let pcCustEditing = false;

/* [Phase 17-AL] 비니 와이어프레임 반영 — 좌측 라벨 + 우측 입력 row 형태 (table-like) */
function pcRenderCustomerInfo(c){
  if(!c) return;
  const body = $('pc-d-cust-body');
  const actions = $('pc-d-cust-actions');
  if(!body || !actions) return;
  // 공통 row 스타일
  const rowStyle  = 'display:grid;grid-template-columns:140px 1fr;border-bottom:1px solid var(--border);';
  const labelCell = 'padding:12px 14px;background:var(--grey50);font-size:12px;color:var(--text-sub);font-weight:600;display:flex;align-items:center;';
  const valCell   = 'padding:12px 14px;font-size:13px;font-weight:500;color:var(--navy);display:flex;align-items:center;';
  const inpCell   = 'padding:8px 14px;display:flex;align-items:center;gap:6px;';
  const inpStyle  = 'flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-weight:500;color:var(--navy);box-sizing:border-box;';
  const req = `<span style="color:var(--red);">*</span>`;
  const tableWrap = 'border:1px solid var(--border);border-radius:8px;overflow:hidden;';

  if(!pcCustEditing){
    // 텍스트뷰 (와이어 형태)
    body.innerHTML = `<div style="${tableWrap}">
      <div style="${rowStyle}">
        <div style="${labelCell}">사업자등록번호</div>
        <div style="${valCell}">${c.bizno || '-'}</div>
      </div>
      <div style="${rowStyle}">
        <div style="${labelCell}">상호명</div>
        <div style="${valCell}">${c.name || '-'}</div>
      </div>
      <div style="${rowStyle}">
        <div style="${labelCell}">담당자 이름</div>
        <div style="${valCell}">${c.ceo || '-'}</div>
      </div>
      <div style="${rowStyle}">
        <div style="${labelCell}">담당자 연락처</div>
        <div style="${valCell}">${c.tel || '-'}</div>
      </div>
      <div style="${rowStyle}">
        <div style="${labelCell}">업종</div>
        <div style="${valCell}">${c.bizcat || '-'}</div>
      </div>
      <div style="${rowStyle}">
        <div style="${labelCell}">업태</div>
        <div style="${valCell}">${c.biztype || '-'}</div>
      </div>
      <div style="display:grid;grid-template-columns:140px 1fr;">
        <div style="${labelCell}">사업자 주소</div>
        <div style="${valCell}">${c.addr || '-'}</div>
      </div>
    </div>`;
    actions.innerHTML = `<button class="btn btn-secondary btn-sm" onclick="pcEnterCustEdit()">사업자 정보 수정</button>`;
  } else {
    // input 폼 (편집 모드, 와이어 형태)
    const esc = (v) => String(v||'').replace(/"/g,'&quot;');
    body.innerHTML = `<div style="${tableWrap}">
      <div style="${rowStyle}">
        <div style="${labelCell}">사업자등록번호 ${req}</div>
        <div style="${inpCell}">
          <input id="pc-ec-bizno" type="text" value="${esc(c.bizno)}" placeholder="000-00-00000" style="${inpStyle}">
          <button class="btn btn-secondary btn-sm" type="button" onclick="pcEcLookupBizno()">조회</button>
        </div>
      </div>
      <div style="${rowStyle}">
        <div style="${labelCell}">상호명 ${req}</div>
        <div style="${inpCell}">
          <input id="pc-ec-name" type="text" value="${esc(c.name)}" placeholder="상호명(법인명)을 입력하세요" style="${inpStyle}">
        </div>
      </div>
      <div style="${rowStyle}">
        <div style="${labelCell}">담당자 이름 ${req}</div>
        <div style="${inpCell}">
          <input id="pc-ec-ceo" type="text" value="${esc(c.ceo)}" placeholder="담당자 성함" style="${inpStyle}">
        </div>
      </div>
      <div style="${rowStyle}">
        <div style="${labelCell}">담당자 연락처 ${req}</div>
        <div style="${inpCell}">
          <input id="pc-ec-tel" type="text" value="${esc(c.tel)}" placeholder="010-0000-0000" style="${inpStyle}">
        </div>
      </div>
      <div style="${rowStyle}">
        <div style="${labelCell}">업종</div>
        <div style="${inpCell}">
          <input id="pc-ec-bizcat" type="text" value="${esc(c.bizcat)}" placeholder="예: 제조업, 서비스업" style="${inpStyle};background:#f8fafc;" readonly>
        </div>
      </div>
      <div style="${rowStyle}">
        <div style="${labelCell}">업태</div>
        <div style="${inpCell}">
          <input id="pc-ec-biztype" type="text" value="${esc(c.biztype)}" placeholder="예: 반도체, 도소매" style="${inpStyle};background:#f8fafc;" readonly>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:140px 1fr;">
        <div style="${labelCell}">사업자 주소</div>
        <div style="${inpCell}">
          <input id="pc-ec-addr" type="text" value="${esc(c.addr)}" placeholder="시·구·상세주소" style="${inpStyle}">
        </div>
      </div>
      <input id="pc-ec-inflow" type="hidden" value="${esc(c.inflow)}">
    </div>`;
    actions.innerHTML = `<button class="btn btn-secondary btn-sm" onclick="pcCancelCustEdit()">취소</button>
                         <button class="btn btn-primary btn-sm" onclick="pcSaveCustEdit()">정보 저장하기</button>`;
  }
}

function pcEnterCustEdit(){
  pcCustEditing = true;
  pcRenderCustomerInfo(custById(pcState.currentId));
}

function pcCancelCustEdit(){
  pcCustEditing = false;
  pcRenderCustomerInfo(custById(pcState.currentId));
}

function pcSaveCustEdit(){
  const c = custById(pcState.currentId); if(!c) return;
  const newName    = $('pc-ec-name')?.value?.trim() || c.name;
  const newBizno   = $('pc-ec-bizno')?.value?.trim();
  const newBizcat  = $('pc-ec-bizcat')?.value?.trim();
  const newBiztype = $('pc-ec-biztype')?.value?.trim();
  const newCeo     = $('pc-ec-ceo')?.value?.trim();
  const newTel     = $('pc-ec-tel')?.value?.trim();
  const newAddr    = $('pc-ec-addr')?.value?.trim();
  const newInflow  = $('pc-ec-inflow')?.value || c.inflow;
  if(!newName || !newBizno || !newCeo || !newTel){
    alert('필수 항목(사업자번호·상호명·담당자 이름·담당자 연락처)을 모두 입력하세요.');
    return;
  }
  const changes = [];
  const apply = (key, oldVal, newVal, label) => {
    const a = (oldVal == null ? '' : String(oldVal));
    const b = (newVal == null ? '' : String(newVal));
    if(a !== b){ changes.push(`${label}: ${a||'(미입력)'} → ${b||'(미입력)'}`); c[key] = newVal; }
  };
  apply('name', c.name, newName, '상호명');
  apply('bizno', c.bizno, newBizno, '사업자번호');
  apply('bizcat', c.bizcat, newBizcat, '업종');
  apply('biztype', c.biztype, newBiztype, '업태');
  apply('ceo', c.ceo, newCeo, '담당자 이름');
  apply('tel', c.tel, newTel, '담당자 연락처');
  apply('addr', c.addr, newAddr, '주소');
  logAudit?.({
    objectType:'customer', objectId:c.id, action:'customer_info_updated',
    title:`사업자 정보 수정 — ${c.name}`,
    desc: changes.length ? changes.join(' · ') : '변경 사항 없음',
    actor:'운영자', tone:'info'
  });
  if(changes.length) pcAddLog(c, '사업자 정보 수정', changes.join(' · '), 'done');
  pcCustEditing = false;
  showToast(changes.length ? `정보가 변경되었습니다 (${changes.length}건)` : '변경 사항 없음');
  pcShowDetail(c.id);   // 전체 화면 갱신 (옛 hidden 필드도 동기화)
  pcRenderTable();
}

/* 인라인 편집용 사업자번호 조회 (옛 함수명 유지 — 호환) */
function pcEcLookupBizno(){
  const bizno = $('pc-ec-bizno')?.value?.trim();
  if(!bizno){ showToast('사업자번호를 입력하세요.'); return; }
  const lastDigit = parseInt(bizno.replace(/\D/g,'').slice(-1), 10) || 0;
  const bizcatMap  = ['제조업','도매업','서비스업','정보통신업','전기·가스','건설업','부동산업','운수업','금융업','교육서비스'];
  const biztypeMap = ['반도체','종합도매','데이터센터','SI개발','발전사업','종합건설','임대업','물류운송','은행','학원'];
  if($('pc-ec-bizcat')) $('pc-ec-bizcat').value = bizcatMap[lastDigit] || '제조업';
  if($('pc-ec-biztype')) $('pc-ec-biztype').value = biztypeMap[lastDigit] || '일반';
  showToast('사업자번호 조회 완료');
}

/* 옛 모달 함수 alias — 호환성 유지 (다른 곳에서 호출 가능성) */
function pcOpenEditCustomer(){ pcEnterCustEdit(); }
function pcSubmitEditCustomer(){ pcSaveCustEdit(); }

/* [Phase 17-Y] 사업자번호 조회 — 업종·업태 자동 입력 stub */
function pcLookupBizno(){
  const bizno = $('rg-bizno')?.value?.trim();
  if(!bizno){
    showToast('사업자번호를 입력하세요.');
    return;
  }
  // 시뮬레이션: 사업자번호 → 업종·업태 자동 매핑
  // 실 환경에선 국세청 사업자등록정보 진위확인 API 호출
  const lastDigit = parseInt(bizno.replace(/\D/g,'').slice(-1), 10) || 0;
  const bizcatMap   = ['제조업','도매업','서비스업','정보통신업','전기·가스','건설업','부동산업','운수업','금융업','교육서비스'];
  const biztypeMap = ['반도체','종합도매','데이터센터','SI개발','발전사업','종합건설','임대업','물류운송','은행','학원'];
  const bizcat = bizcatMap[lastDigit] || '제조업';
  const biztype = biztypeMap[lastDigit] || '일반';
  $('rg-bizcat').value = bizcat;
  $('rg-biztype').value = biztype;
  showToast(`사업자번호 조회 완료 — ${bizcat} / ${biztype}`);
}

/* [Phase 17-Y] 참여신청 등록 — 1차 필수(사업자·담당자)만으로 검증리스트 인입.
   사업장·한전 정보는 선택 입력이며, 미입력 시 등록 후 상세에서 추가 가능. */
function pcCreateLead(){
  // 1단계 필수
  const name   = $('rg-name')?.value?.trim() || '';
  const bizno  = $('rg-bizno')?.value?.trim() || '';
  const bizcat = $('rg-bizcat')?.value?.trim() || '';
  const biztype= $('rg-biztype')?.value?.trim() || '';
  const ceo    = $('rg-ceo')?.value?.trim() || '';
  const tel    = $('rg-tel')?.value?.trim() || '';
  // [Phase 17-AA] 희망 DR 유형 필드 제거 — 사전검증 단계에서는 미수집
  const drType = '';
  const inflow = $('rg-inflow')?.value || '사이트';
  // 2단계 선택
  const siteName = $('rg-site-name')?.value?.trim() || '';
  const siteAddr = $('rg-site-addr')?.value?.trim() || '';
  const power    = parseInt($('rg-power')?.value, 10) || 0;
  const kepco    = $('rg-kepco')?.value?.trim() || '';

  // 필수 검증
  if(!name || !bizno || !ceo || !tel){
    showToast('필수 항목(사업자명·사업자번호·담당자 이름·연락처)을 모두 입력하세요.');
    return;
  }
  // 사업자번호 조회 안 했으면 자동 트리거
  if(!bizcat || !biztype){
    pcLookupBizno();
  }

  const d = new Date(), pad = n => String(n).padStart(2,'0');
  const ymd = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const maxSeq = store.customers
    .map(c => parseInt((c.recno||'').split('-')[2]) || 0)
    .reduce((m,v) => Math.max(m,v), 0);
  const recno = `DR-${d.getFullYear()}-${String(maxSeq+1).padStart(4,'0')}`;
  const maxCid = store.customers
    .map(c => parseInt((c.id||'').replace(/\D/g,'')) || 0)
    .reduce((m,v) => Math.max(m,v), 0);
  const newId = 'C' + String(Math.max(200, maxCid+1)).padStart(3,'0');

  // 사업장 정보가 입력됐으면 sites 배열 즉시 생성. 미입력이면 빈 배열 (가상 사이트 자동 매핑 trigger)
  const sites = [];
  if(siteName || siteAddr || power || kepco){
    sites.push({
      id: newId + '-S1',
      siteName: siteName || `${name} 본사`,
      addr: siteAddr || '',
      power: power || 0,
      kepco: kepco || '',
      manager: ceo,
      tel: tel,
      steps: [1,1,1,1],
      dataStatus: '미수집',
      verifyStatus: '검증대기',
      date: ymd,
    });
  }

  const newCustomer = {
    id: newId, name, ceo, tel, recno, date: ymd,
    bizno, bizcat, biztype,             // [신규] 사업자 정보
    addr: '',                           // 사업자 주소는 사업장 정보로 일원화 (옛 필드는 비움)
    power: power || 0,                  // 사업자 단위 fallback (사이트가 있으면 사이트 우선)
    kepco: kepco || '',
    drType, status: '검증대기', dataStatus: '미수집', inflow,
    sites: sites.length > 0 ? sites : undefined,  // 미입력 시 가상 사이트 자동 생성됨
    steps: [1,1,1,1],
    extS: '미실행', rrmseS: '미실행', cblS: '미실행',
    cblType: '-', cblAvg: '-', reduction: null, rrmseVal: '-', infraS: '-',
  };
  store.customers.unshift(newCustomer);
  pcAddLog(newCustomer, '참여신청 등록', `${name} (${recno}) 신규 등록 · ${bizcat||'-'} / ${biztype||'-'}`, 'done');
  closeModal('registerModal');
  // 폼 초기화
  ['rg-name','rg-bizno','rg-bizcat','rg-biztype','rg-ceo','rg-tel','rg-site-name','rg-site-addr','rg-power','rg-kepco']
    .forEach(id => { const el = $(id); if(el) el.value = ''; });
  if($('rg-inflow'))   $('rg-inflow').value = '사이트';
  pcRenderTable();
  refreshSidebarBadges();
  showToast(`${name} 등록 완료 (${recno}) — 검증리스트 인입`);
}

/* 계약 전환 → 자원 풀 등록 */
function pcOpenContract(){
  const c = custById(pcState.currentId); if(!c) return;
  const allDone = c.steps.every(s=>s===2);
  if(!allDone){ showToast('모든 검증 단계를 완료해야 합니다.'); return; }
  if(c.status==='계약완료'){ showToast('이미 계약 완료된 고객입니다.'); return; }
  if(['계약대기','검토중'].includes(c.contractStage)){ showToast('이미 계약관리로 이관된 고객입니다.'); return; }
  $('cm-title').textContent = '계약관리 이관 확인';
  $('cm-sub').textContent = `${c.name} (${c.recno})을(를) 계약관리로 이관합니다.`;
  $('cm-body').innerHTML = `<div class="info-box">이관 후 계약관리 페이지에서 서류 검토, 계약 확정/반려를 이어서 처리할 수 있습니다.</div>
    <div class="check-item-row"><span>예상 감축용량</span><span style="font-weight:600;color:var(--blue);">${c.reduction||'-'} kW</span></div>
    <div class="check-item-row"><span>CBL 유형</span><span style="font-weight:600;">${c.cblType}</span></div>
    <div class="check-item-row"><span>RRMSE</span><span style="font-weight:600;color:var(--green);">${c.rrmseVal}</span></div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-success" onclick="pcConfirmContract()">계약관리 이관</button>`;
  openModal('commonModal');
}
function pcConfirmContract(){
  const c = custById(pcState.currentId); if(!c) return;
  c.status = '검증완료';
  c.contractStage = '계약대기';
  if(typeof ctEnsureCustomerMeta==='function') ctEnsureCustomerMeta(c);
  if(c.contractHistory){
    c.contractHistory.unshift({
      time: `${todayStr()} 14:10`,
      title: '사전검증 이관 완료',
      desc: '사전검증 완료 후 계약관리 대기열로 자동 이관됨',
      tone: 'done'
    });
  }
  pcAddLog(c, '계약관리 이관', `${c.name} — 계약관리에서 계약 검토 가능 상태로 전환`, 'done');
  if(window.logAudit) window.logAudit('사전검증 이관', `${c.name} (${c.recno})`);
  closeModal('commonModal');
  if(typeof ctInit==='function') ctInit();
  pcRefreshCards();
  pcRenderTable();
  pcShowDetail(c.id);
  refreshSidebarBadges();
  showToast(`${c.name} 계약관리로 이관되었습니다.`);
  navigate('contract');
  setTimeout(()=>{ if(typeof ctOpenDetail==='function') ctOpenDetail(c.id); }, 120);
}

/* 반려 */
function pcOpenReject(){
  const c = custById(pcState.currentId); if(!c) return;
  if(c.status==='반려'){ showToast('이미 반려된 고객입니다.'); return; }
  if(c.status==='계약완료'){ showToast('계약 완료된 고객은 반려할 수 없습니다.'); return; }
  $('cm-title').textContent = '반려 처리';
  $('cm-sub').textContent = `${c.name} (${c.recno})을(를) 반려합니다.`;
  $('cm-body').innerHTML = `<div class="info-box danger">반려 시 검증 프로세스가 중단되며, 재개하려면 담당자가 다시 검증대기 상태로 변경해야 합니다.</div>
    <div class="form-row"><label class="form-label">반려 사유</label>
      <textarea class="form-textarea" id="reject-reason" placeholder="반려 사유를 입력하세요"></textarea>
    </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-danger" onclick="pcConfirmReject()">반려 확정</button>`;
  openModal('commonModal');
}
function pcConfirmReject(){
  const c = custById(pcState.currentId); if(!c) return;
  const reason = $('reject-reason').value.trim()||'사유 미기재';
  c.status = '반려';
  pcAddLog(c, '반려 처리', `사유: ${reason}`, 'fail');
  closeModal('commonModal');
  pcShowDetail(c.id);
  refreshSidebarBadges();
  showToast('반려 처리되었습니다.');
}

/* ════════════════════════════════════════════════════════════
   ★ PAGE: 사전검증 → 데이터 모니터링 탭
   15분 단위 전력사용량(kW) 및 CBL 수집 현황 조회
════════════════════════════════════════════════════════════ */
const pcDmState = { from:null, to:null };

/* 탭 진입 시 초기화: 기간 기본값을 "최근 3일"로 설정하고 즉시 조회 */
function pcDmInit(){
  const c = custById(pcState.currentId); if(!c) return;
  // 고객 식별 표시
  $('pc-dm-customer-info').innerHTML = `<span style="font-family:monospace;">${c.recno}</span> · ${c.name}`;
  // 고객의 dataStatus가 '미수집'이면 안내 후 종료
  if(c.dataStatus === '미수집'){
    $('pc-dm-result').innerHTML = `<div class="dm-empty">
      <div style="font-size:14px;color:var(--text-sub);margin-bottom:6px;">아직 수집된 데이터가 없습니다</div>
      <div>이 고객은 외부데이터 수집 단계가 완료되지 않은 상태입니다.<br>
      검증 단계에서 <b>외부데이터 조회</b>를 먼저 완료해주세요.</div>
    </div>`;
    // 기간 UI는 기본값만 세팅 (조회해도 의미 없음)
    pcDmSetPreset(3, /*skipQuery*/true);
    return;
  }
  // 기간 기본값: 최근 3일
  pcDmSetPreset(3);
}

/* 프리셋 기간 설정 */
function pcDmSetPreset(days, skipQuery){
  const c = custById(pcState.currentId); if(!c) return;
  // 기준일: 현재 날짜 사용 (외부데이터 수집이 "오늘 기준 최근 N일"로 들어온다는 가정)
  const today = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const from = new Date(today.getTime() - (days-1)*86400000);
  $('pc-dm-from').value = fmt(from);
  $('pc-dm-to').value = fmt(today);
  if(!skipQuery) pcDmQuery();
}

/* 조회 실행 */
function pcDmQuery(){
  const c = custById(pcState.currentId); if(!c) return;
  if(c.dataStatus === '미수집'){
    showToast('수집된 데이터가 없습니다. 외부데이터 조회 단계를 먼저 완료하세요.');
    return;
  }
  const fromStr = $('pc-dm-from').value;
  const toStr = $('pc-dm-to').value;
  if(!fromStr || !toStr){ showToast('조회 기간을 설정하세요.'); return; }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if(from > to){ showToast('시작일이 종료일보다 클 수 없습니다.'); return; }
  const dayDiff = Math.floor((to - from)/86400000) + 1;
  if(dayDiff > 14){ showToast('한 번에 조회 가능한 기간은 최대 14일입니다.'); return; }
  pcDmState.from = fromStr;
  pcDmState.to = toStr;
  // 시드 데이터 생성
  const days = pcDmGenerateData(c, from, to);
  pcDmRender(days, c);
}

/* 결정론적 시드 기반 시뮬레이션 데이터 생성
   - 고객 id와 날짜를 시드로 써서 재현 가능한 15분 단위 데이터 생성
   - 실제 시스템에서는 AMI/한전 API에서 받은 데이터로 대체됨 */
function pcDmGenerateData(c, fromDate, toDate){
  const out = [];
  // 고객별 기준 부하 수준 결정 (contract power의 85%를 평시 피크로 가정)
  const basePeak = (c.power||400) * 0.85;
  // 결정론적 해시 (고객 id + 날짜 + 슬롯 인덱스)
  const hashStr = s => {
    let h = 0; for(let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) / 0x7fffffff;
  };
  for(let d = new Date(fromDate); d <= toDate; d = new Date(d.getTime()+86400000)){
    const pad = n => String(n).padStart(2,'0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const dow = d.getDay(); // 0=일, 6=토
    const isWeekend = (dow===0 || dow===6);
    const slots = [];
    let missCnt = 0;
    for(let h=0; h<24; h++){
      for(let m=0; m<60; m+=15){
        // 시간대별 부하 팩터 (업무시간 9~18 피크, 야간 저부하)
        const hourFactor = isWeekend
          ? (0.35 + 0.10*Math.sin((h-10)*Math.PI/14))
          : (h>=9 && h<=18)
            ? (0.85 + 0.15*Math.sin((h-9)*Math.PI/9))
            : (h>=7 && h<9) ? 0.55
            : (h>18 && h<=21) ? 0.60
            : 0.30;
        // 결정론 노이즈
        const seedKey = `${c.id}-${dateStr}-${h}-${m}`;
        const noise = (hashStr(seedKey) - 0.5) * 0.08; // ±4%
        const kw = Math.max(0, basePeak * (hourFactor + noise));
        // CBL은 영업일 기준 High 5 of 10 등으로 산정된 평활 값 — 여기서는 같은 시간대 평균으로 근사
        // 영업일이 아닐 때는 CBL이 낮은 편 (주말 별도 CBL 로직 생략)
        const cblFactor = (h>=9 && h<=18) ? (0.80 + 0.18*Math.sin((h-9)*Math.PI/9))
                        : (h>=7 && h<9) ? 0.55
                        : (h>18 && h<=21) ? 0.58
                        : 0.28;
        const cbl = basePeak * cblFactor;
        // 수집 실패 시뮬레이션 (결정론적): 약 1.2% 결측
        const failKey = hashStr(`fail-${c.id}-${dateStr}-${h}-${m}`);
        const rawMissing = failKey < 0.012;
        // 보정 시뮬레이션 — 운영규칙상 결측 발생 시 전일·전후 평균 등으로 자동 보정
        // (PRD §5.2 '누락 데이터 자동 보정' + 정산해설서 부록-3 규칙)
        // 결측 중 약 70%는 자동 보정 가능, 30%는 규칙 밖(미수신)으로 남김
        const imputeKey = hashStr(`imp-${c.id}-${dateStr}-${h}-${m}`);
        const imputed = rawMissing && imputeKey < 0.70;
        const missing = rawMissing && !imputed;  // 최종 '미수신' = 보정도 실패
        // 보정 규칙 결정 (imputeKey 구간별)
        let imputeRule = null, imputeReason = null;
        if(imputed){
          if(imputeKey < 0.35){
            imputeRule = '전일 동시간대';
            imputeReason = '통신 타임아웃 · 전일 같은 시간대 값으로 보정';
          } else if(imputeKey < 0.55){
            imputeRule = '전후 평균';
            imputeReason = '전후 슬롯 선형 보간';
          } else {
            imputeRule = 'CBL 근사';
            imputeReason = '유사일 평균값 기반 근사 보정';
          }
        }
        // 보정값은 CBL 근처 + 약한 노이즈 (실측과 구별되는 결정론적 값)
        const imputedKw = imputed
          ? Math.max(0, cbl * (0.92 + (hashStr(`impval-${c.id}-${dateStr}-${h}-${m}`) - 0.5) * 0.10))
          : null;
        slots.push({
          time:`${pad(h)}:${pad(m)}`,
          kw: missing ? null : imputed ? Math.round(imputedKw*10)/10 : Math.round(kw*10)/10,
          cbl: Math.round(cbl*10)/10,
          missing,      // 최종 미수신 (보정 실패)
          imputed,      // 보정 적용 여부 (true면 kw는 보정값)
          imputeRule,   // 보정 규칙명
          imputeReason, // 보정 근거
        });
        if(missing) missCnt++;
      }
    }
    const imputedCnt = slots.filter(s=>s.imputed).length;
    out.push({date:dateStr, dow, isWeekend, slots, missCnt, imputedCnt});
  }
  return out;
}

/* 결과 렌더링 (요약 + 차트 + 테이블) */
function pcDmRender(days, c){
  if(!days.length){
    $('pc-dm-result').innerHTML = `<div class="dm-empty">조회된 데이터가 없습니다.</div>`;
    return;
  }
  // 요약 통계
  const totalSlots = days.reduce((s,d)=>s+d.slots.length, 0);
  const totalMiss = days.reduce((s,d)=>s+d.missCnt, 0);
  const totalImputed = days.reduce((s,d)=>s+(d.imputedCnt||0), 0);
  // ★ 최종 수신률 = (정상수신 + 보정성공) / 전체 — KPX 정산 투입 가능 슬롯 비율
  const rxRate = Math.round((totalSlots-totalMiss)/totalSlots*1000)/10;
  // ★ 원수신률 = 보정 전 실제 수신된 슬롯 비율 (통신·계측기 건전성 지표)
  const rawRxRate = Math.round((totalSlots-totalMiss-totalImputed)/totalSlots*1000)/10;
  const allKw = days.flatMap(d=>d.slots.map(s=>s.kw).filter(v=>v!=null));
  const peakKw = allKw.length ? Math.max(...allKw) : 0;
  const avgKw = allKw.length ? allKw.reduce((a,b)=>a+b,0)/allKw.length : 0;

  const summaryHtml = `<div class="dm-summary">
    <div class="dm-summary-item"><div class="dm-summary-lbl">조회 일수</div><div class="dm-summary-val">${days.length}일</div></div>
    <div class="dm-summary-item"><div class="dm-summary-lbl">최종 수신률 <span style="font-size:9px;color:var(--text-hint);font-weight:400;">(보정 포함)</span></div>
      <div class="dm-summary-val" style="color:${rxRate>=99?'var(--green)':rxRate>=95?'var(--amber)':'var(--red)'};">${rxRate}%</div>
      <div style="font-size:10px;color:var(--text-hint);margin-top:2px;">원수신 ${rawRxRate}% · 보정 ${totalImputed}개 · 미수신 ${totalMiss}개</div>
    </div>
    <div class="dm-summary-item"><div class="dm-summary-lbl">평균 사용량</div><div class="dm-summary-val">${Math.round(avgKw).toLocaleString()} kW</div></div>
    <div class="dm-summary-item"><div class="dm-summary-lbl">피크 사용량</div><div class="dm-summary-val" style="color:var(--blue);">${Math.round(peakKw).toLocaleString()} kW</div></div>
  </div>`;

  const chartHtml = pcDmRenderChart(days);
  const tableHtml = pcDmRenderTable(days);

  $('pc-dm-result').innerHTML = summaryHtml + chartHtml + tableHtml;
}

/* 차트: 일자 x 시간 연속 플롯. 사용량과 CBL 두 라인 */
function pcDmRenderChart(days){
  const W = 820, H = 240, P = {l:42, r:12, t:18, b:30};
  const innerW = W - P.l - P.r, innerH = H - P.t - P.b;
  // 모든 슬롯을 연속된 시퀀스로
  const seq = [];
  days.forEach(d=>{
    d.slots.forEach(s=>seq.push({date:d.date, time:s.time, kw:s.kw, cbl:s.cbl, missing:s.missing, imputed:s.imputed, imputeRule:s.imputeRule}));
  });
  if(!seq.length) return '';
  const kws = seq.map(s=>s.kw).filter(v=>v!=null);
  const cbls = seq.map(s=>s.cbl);
  const yMax = Math.max(...kws, ...cbls) * 1.10;
  const yMin = 0;
  const x = i => P.l + (i/(seq.length-1))*innerW;
  const y = v => P.t + innerH - ((v-yMin)/(yMax-yMin))*innerH;

  // 실제 사용량 line (null 구간은 path 분리)
  const kwSegments = [];
  let curSeg = [];
  seq.forEach((s, i)=>{
    if(s.kw != null){
      curSeg.push(`${curSeg.length===0?'M':'L'}${x(i).toFixed(1)},${y(s.kw).toFixed(1)}`);
    } else {
      if(curSeg.length) kwSegments.push(curSeg.join(' '));
      curSeg = [];
    }
  });
  if(curSeg.length) kwSegments.push(curSeg.join(' '));

  // CBL line (연속)
  const cblPath = seq.map((s, i)=> `${i===0?'M':'L'}${x(i).toFixed(1)},${y(s.cbl).toFixed(1)}`).join(' ');

  // Y축 눈금
  const yTicks = Array.from({length:5}, (_,i)=>{
    const v = yMin + (yMax-yMin)*(i/4);
    return {y:y(v), label:Math.round(v).toLocaleString()};
  });

  // X축 일자 구분선 + 라벨
  const slotsPerDay = days[0]?.slots.length || 96;
  const dayDividers = days.map((d, di)=>{
    const startIdx = di * slotsPerDay;
    const xpos = x(startIdx);
    const showLabel = days.length <= 7 || di % Math.ceil(days.length/7) === 0;
    return {xpos, date:d.date, showLabel};
  });

  // 수집 실패 지점 표시 (빨간 점)
  const missDots = seq.map((s, i)=> s.missing ? `<circle cx="${x(i).toFixed(1)}" cy="${(P.t+innerH-3).toFixed(1)}" r="2" fill="var(--red)"/>` : '').join('');
  // 보정 슬롯 표시 (청색 점 + 라인 위에 작은 원)
  const impDots = seq.map((s, i)=> {
    if(!s.imputed) return '';
    const ypos = y(s.kw);
    return `<circle cx="${x(i).toFixed(1)}" cy="${ypos.toFixed(1)}" r="2.2" fill="#3b82f6" stroke="#fff" stroke-width="0.8"><title>${s.date} ${s.time} · 보정(${s.imputeRule||''}) · ${s.kw.toFixed(1)} kW</title></circle>`;
  }).join('');

  return `<div class="dm-chart-wrap">
    <div class="dm-chart-head">
      <div class="dm-chart-title">15분 단위 수집 데이터 추이</div>
      <div class="dm-chart-legend">
        <span><span class="lg" style="background:var(--blue);"></span>실제 사용량 (kW)</span>
        <span><span class="lg" style="background:var(--gray);border-top:1px dashed var(--gray);height:0;"></span>CBL (기준부하)</span>
        <span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#3b82f6;border:1px solid #fff;box-shadow:0 0 0 1px #3b82f6;vertical-align:middle;margin-right:4px;"></span>보정값 (imputed)</span>
        <span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--red);vertical-align:middle;margin-right:4px;"></span>수집 실패 (미수신)</span>
      </div>
    </div>
    <svg width="100%" viewBox="0 0 ${W} ${H}" style="background:#fff;border-radius:6px;">
      ${yTicks.map(t=>`<line x1="${P.l}" y1="${t.y}" x2="${W-P.r}" y2="${t.y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="2,3"/>
                       <text x="${P.l-5}" y="${t.y+3}" font-size="9" fill="var(--text-hint)" text-anchor="end">${t.label}</text>`).join('')}
      ${dayDividers.map(d=>`${d.xpos>P.l+1?`<line x1="${d.xpos}" y1="${P.t}" x2="${d.xpos}" y2="${P.t+innerH}" stroke="var(--border-dark)" stroke-width="1" stroke-dasharray="3,3"/>`:''}
                           ${d.showLabel?`<text x="${d.xpos+3}" y="${H-10}" font-size="9" fill="var(--text-sub)" font-weight="500">${d.date.substring(5)}</text>`:''}`).join('')}
      <path d="${cblPath}" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4,3"/>
      ${kwSegments.map(seg=>`<path d="${seg}" fill="none" stroke="var(--blue)" stroke-width="1.6"/>`).join('')}
      ${impDots}
      ${missDots}
    </svg>
  </div>`;
}

/* 테이블: 행=일자, 열=15분 슬롯. 구체적 수치 표기 */
function pcDmRenderTable(days){
  // 15분 단위는 96개라 가로가 길어 스크롤. 시간 헤더는 "HH:MM"
  if(!days.length) return '';
  const slotTimes = days[0].slots.map(s=>s.time);
  // 헤더: 일자 | 00:00 | 00:15 | ...
  const ths = slotTimes.map(t=>{
    // 정시(:00)만 굵게 표시하여 가독성 확보
    const isHour = t.endsWith(':00');
    return `<th style="${isHour?'background:#dce8f7;':''}">${isHour?t:t.substring(3)}</th>`;
  }).join('');

  const rows = days.map(d=>{
    const dow = ['일','월','화','수','목','금','토'][d.dow];
    const dowColor = d.isWeekend ? 'color:var(--red);' : '';
    const cells = d.slots.map(s=>{
      if(s.missing) return `<td class="dm-cell-miss" title="미수신 (보정 실패) — KPX 정산 대상 제외 가능">—</td>`;
      if(s.imputed){
        // 보정 셀: 옅은 청색 배경 + 값 옆 · 표기 + 보정 사유 툴팁
        return `<td class="dm-cell-imputed" title="🔧 보정값 · 규칙: ${s.imputeRule||'-'} · ${s.imputeReason||''} · 보정값 ${s.kw} kW · CBL ${s.cbl} kW">
          <div class="dm-cell-kw">${s.kw.toFixed(0)}<span style="font-size:8px;color:#1e5ab5;margin-left:1px;">·</span></div>
          <div class="dm-cell-cbl">${s.cbl.toFixed(0)}</div>
        </td>`;
      }
      return `<td title="사용량 ${s.kw} kW · CBL ${s.cbl} kW">
        <div class="dm-cell-kw">${s.kw.toFixed(0)}</div>
        <div class="dm-cell-cbl">${s.cbl.toFixed(0)}</div>
      </td>`;
    }).join('');
    // 일자 배지: 미수신 + 보정 별도 표시
    const badges = [];
    if(d.missCnt>0) badges.push(`<span class="badge badge-fail" style="font-size:9px;margin-left:4px;">미수신 ${d.missCnt}</span>`);
    if((d.imputedCnt||0)>0) badges.push(`<span class="dm-imp-badge" style="margin-left:4px;">보정 ${d.imputedCnt}</span>`);
    return `<tr>
      <td class="dm-td-date"><span style="${dowColor}">${d.date}<br><span style="font-size:10px;font-weight:400;">(${dow})</span>${badges.join('')}</span></td>
      ${cells}
    </tr>`;
  }).join('');

  return `<div style="font-size:11px;color:var(--text-hint);margin-bottom:6px;">
    * 각 셀의 <span style="color:var(--blue);font-weight:600;">파란 숫자</span>는 실측 사용량(kW), <span style="color:var(--gray);">회색 숫자</span>는 CBL(kW).
    <span style="background:#eff5ff;padding:1px 4px;border-radius:2px;color:#1e5ab5;">옅은 파란 배경</span> 셀은 <b>보정값(imputed)</b> — 값 옆 <span style="color:#1e5ab5;font-weight:600;">·</span> 표식.
    마우스를 올리면 보정 규칙·사유가 표시됩니다.
  </div>
  <div class="dm-table-wrap">
    <table class="dm-table">
      <thead><tr><th class="dm-th-date">일자</th>${ths}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   ★ PAGE: 자원관리
════════════════════════════════════════════════════════════ */
let ctCurrentId = null;
let ctRejectTargetId = null;

function ctTodayStr(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function ctEnsureCustomerMeta(c){
  if(!c.contractStage){
    if(c.status==='계약완료') c.contractStage = '계약완료';
    else if(c.status==='반려') c.contractStage = '반려';
    else if(c.status==='검증완료') c.contractStage = '계약대기';
    else c.contractStage = null;
  }
  if(!c.contractInfo){
    c.contractInfo = {
      feeRate: c.drType==='국민DR' ? 12 : 15,
      mandatoryCapacity: Math.max(50, Math.round((c.reduction || Math.max(30, Math.round((c.power||100)*0.2)))/10)*10),
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      manager: '박운영'
    };
  }
  if(!c.contractDocs){
    const docs = [
      {name:'계약서', required:true, submitted:true},
      {name:'수요반응참여고객 등록신청서', required:true, submitted:true},
      {name:'수요반응자원 등록신청서', required:true, submitted:c.status!=='검증완료' ? true : false},
      {name:'사업자등록증', required:true, submitted:c.status==='계약완료'},
    ];
    c.contractDocs = docs.map((d, idx)=>({
      ...d,
      status: d.submitted ? (c.status==='계약완료' ? '승인' : '제출완료') : '미제출',
      fileName: d.submitted ? `${d.name.replaceAll(' ','_')}_${c.id}_${idx+1}.pdf` : ''
    }));
  }
  if(!c.contractHistory){
    const seedTitle = '계약관리 대상 생성';
    const seedDesc = c.status==='계약완료' ? '사전검증 완료 후 계약완료 고객으로 이관됨' : '사전검증 완료/반려 고객 기준으로 계약관리 대상화';
    const seedTone = c.status==='반려' ? 'fail' : 'done';
    c.contractHistory = [{ time: `${ctTodayStr()} 09:00`, title: seedTitle, desc: seedDesc, tone: seedTone }];
    // 통합 감사 로그에도 시드 마이그레이션 (Phase 7)
    if(typeof logAudit === 'function'){
      logAudit({objectType:'contract', objectId:c.id, action:'created', title:seedTitle, desc:seedDesc, actor:'시스템', tone:seedTone});
    }
  }
  // [Phase 17-AS] 사업장 siteStatus 자동 부여 (운영자가 한 번도 안 건드린 사업장만)
  if(typeof pcGetSites === 'function') pcGetSites(c);
  if(Array.isArray(c.sites)){
    const today = (new Date()).toISOString().slice(0,10);
    c.sites.forEach(s => {
      if(s.siteStatus) return;  // 운영자 manual override 보존
      const ct = s.contract || {};
      if(ct.startDate && ct.endDate){
        s.siteStatus = (today > ct.endDate) ? '계약만료' : '계약완료';
      } else if(c.status === '반려'){
        s.siteStatus = '계약만료';
      } else {
        s.siteStatus = '계약대기';
      }
    });
  }
}
/* [Phase 17-AV] 사업자 종합 상태 — 사업장 siteStatus 기반 파생(저장 X, 계산 O), 계약해지 추가 */
function ctComputeBizStatus(c){
  ctEnsureCustomerMeta(c);
  const sites = Array.isArray(c.sites) ? c.sites : [];
  if(sites.length === 0) return { status:'계약대기', expiringCount:0, counts:{'계약대기':0,'계약완료':0,'계약만료':0,'계약해지':0} };
  const counts = { '계약대기':0, '계약완료':0, '계약만료':0, '계약해지':0 };
  let expiringCount = 0;
  const now = new Date();
  const sixtyDaysLater = new Date(now.getTime() + 60*86400000).toISOString().slice(0,10);
  sites.forEach(s => {
    const st = s.siteStatus || '계약대기';
    counts[st] = (counts[st] || 0) + 1;
    if(st === '계약완료' && s.contract && s.contract.endDate && s.contract.endDate <= sixtyDaysLater){
      expiringCount++;
    }
  });
  let status;
  if(counts['계약대기'] >= 1)              status = '계약대기';
  else if(counts['계약해지'] === sites.length) status = '계약해지';
  else if(counts['계약만료'] === sites.length) status = '계약만료';
  else                                       status = '계약완료';
  return { status, expiringCount, counts };
}
function ctGetStage(c){
  return ctComputeBizStatus(c).status;
}
function ctStageBadge(stage){
  if(stage==='계약대기') return 'badge-pending';
  if(stage==='계약진행') return 'badge-progress';
  if(stage==='계약완료') return 'badge-done';
  if(stage==='계약만료') return 'badge-gray';
  if(stage==='계약해지') return 'badge-fail';
  return 'badge-gray';
}
function ctEligibleCustomers(){
  return store.customers.filter(c=>['검증완료','계약완료','반려'].includes(c.status)).map(c=>{
    ctEnsureCustomerMeta(c);
    return c;
  });
}
function ctFilteredCustomers(){
  const q = ($('ct-search')?.value || '').trim().toLowerCase();
  const type = $('ct-filter-type')?.value || '';
  const stage = $('ct-filter-status')?.value || '';
  return ctEligibleCustomers().filter(c=>{
    const s = ctGetStage(c);
    // 사업자 + 사업장 정보 모두 검색 hay에 포함 (Phase 17-AS: 사업자명·사업자번호 중심)
    const hayParts = [c.name, c.bizno, c.ceo, c.tel, c.recno, c.kepco, c.id, c.addr];
    if(Array.isArray(c.sites)){
      c.sites.forEach(site => hayParts.push(site.siteName||'', site.kepco||'', site.manager||'', site.tel||''));
    }
    const matchQ = !q || hayParts.join(' ').toLowerCase().includes(q);
    const matchType = !type || c.drType===type;
    const matchStage = !stage || s===stage;
    return matchQ && matchType && matchStage;
  });
}

// 계약관리 사업자 행 ▶/▼ 토글 (사전검증의 pcToggleBusiness와 동일 패턴)
function ctToggleBusiness(bizId){
  const rows = document.querySelectorAll(`tr.ct-site-row[data-parent-id="${bizId}"]`);
  if(rows.length===0) return;
  const isHidden = rows[0].style.display === 'none';
  rows.forEach(tr => { tr.style.display = isHidden ? '' : 'none'; });
  const bizRow = document.querySelector(`tr.ct-business-row[data-biz-id="${bizId}"]`);
  if(bizRow){
    const icon = bizRow.querySelector('.accordion-icon');
    if(icon) icon.textContent = isHidden ? '▼' : '▶';
  }
}
function ctInit(){
  ctRenderSummary();
  ctRenderTable();
}
function ctRenderSummary(){
  const rows = ctEligibleCustomers();
  const bizList = rows.map(c => ({ c, biz: ctComputeBizStatus(c) }));
  const count = (st)=> bizList.filter(x => x.biz.status === st).length;
  const expiringBizCount = bizList.filter(x => x.biz.expiringCount > 0).length;
  $('ct-kpi-total').textContent    = rows.length;
  $('ct-kpi-pending').textContent  = count('계약대기');
  $('ct-kpi-approved').textContent = count('계약완료');
  $('ct-kpi-review').textContent   = expiringBizCount;   // [Phase 17-AS] 만료 예정 사업자
  $('ct-kpi-rejected').textContent = count('계약만료');
}
/* [Phase 17-AD] 계약관리 — 사업자 단위 평면 리스트 (아코디언 해제)
   계약은 사업자 단위로 체결되므로 사업장 자식 행 제거. 사업장 N개 카운트는 사업자명 옆에 표시.
   상세 모달에서 사업장 미리보기 + 검증 결과 확인 가능. */
function ctRenderTable(){
  const rows = ctFilteredCustomers();
  const tbody = $('ct-tbody');
  const empty = $('ct-empty');
  let siteTotal = 0;
  tbody.innerHTML = rows.map(c => {
    const biz = ctComputeBizStatus(c);
    const sites = (typeof pcGetSites === 'function') ? pcGetSites(c) : (Array.isArray(c.sites) ? c.sites : []);
    const siteCount = sites.length || 1;
    siteTotal += siteCount;
    const counts = biz.counts || {'계약대기':0,'계약완료':0,'계약만료':0,'계약해지':0};
    const cell = (n, color) => n > 0
      ? `<span style="color:${color};font-weight:600;">${n}개</span>`
      : `<span style="color:var(--text-hint);">—</span>`;
    const expiringIcon = biz.expiringCount > 0
      ? `<span title="만료 예정 ${biz.expiringCount}건 (60일 내 종료)" style="margin-left:4px;color:var(--amber);font-size:13px;line-height:1;">⚠</span>`
      : '';
    return `<tr class="ct-business-row" data-biz-id="${c.id}" style="cursor:pointer;">
      <td><div class="ct-name">${c.name||'—'}</div></td>
      <td style="font-family:monospace;">${c.bizno||'—'}</td>
      <td>${siteCount}개</td>
      <td style="text-align:center;">${cell(counts['계약대기'], 'var(--amber)')}</td>
      <td style="text-align:center;">${cell(counts['계약완료'], 'var(--green)')}${expiringIcon}</td>
      <td style="text-align:center;">${cell(counts['계약만료'], 'var(--text-sub)')}</td>
      <td style="text-align:center;">${cell(counts['계약해지'], 'var(--red)')}</td>
      <td style="text-align:center;"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();ctOpenDetail('${c.id}')">상세보기</button></td>
    </tr>`;
  }).join('');

  // 행 클릭 → 상세 모달 (모든 사업자가 동일 동작)
  tbody.querySelectorAll('tr.ct-business-row').forEach(tr => {
    const bizId = tr.dataset.bizId;
    tr.onclick = (e) => {
      if(e.target.tagName === 'BUTTON') return;
      ctOpenDetail(bizId);
    };
  });

  empty.style.display = rows.length ? 'none' : 'block';
  $('ct-row-count').textContent = `총 ${rows.length}사업자 · ${siteTotal}사업장`;
}
function ctResetFilters(){
  const s = $('ct-search');         if(s) s.value = '';
  const ft = $('ct-filter-type');   if(ft) ft.value = '';
  const fs = $('ct-filter-status'); if(fs) fs.value = '';
  ctRenderTable();
}
/* [Phase 17-AN] 계약관리 상세 — 사이드 패널 → 페이지뷰 라우팅 */
function ctOpenDetail(id, siteId){
  const c = store.customers.find(x=>x.id===id); if(!c) return;
  ctEnsureCustomerMeta(c);
  ctCurrentId = id;
  ctCustEditing = false;  // [Phase 17-AO] 진입 시 편집 모드 초기화
  // 페이지뷰 전환
  const listV = document.getElementById('ct-list-view');
  const detV  = document.getElementById('ct-detail-view');
  if(listV && detV){
    listV.style.display = 'none';
    detV.style.display = 'flex';
    // 새 페이지뷰 헤더 채우기
    const stage = ctGetStage(c);
    const titleEl = document.getElementById('ct-d-page-title');
    const subEl   = document.getElementById('ct-d-page-sub');
    const crumbEl = document.getElementById('ct-d-crumb');
    const badgeEl = document.getElementById('ct-d-stage-badge');
    if(titleEl) titleEl.textContent = c.name;
    if(subEl)   subEl.textContent   = `${c.recno} · 접수일 ${c.date||'-'}`;
    if(crumbEl) crumbEl.textContent = c.name;
    if(badgeEl) badgeEl.innerHTML   = `<span class="badge ${ctStageBadge(stage)}">${stage}</span>`;
    // 본문 렌더 (사업자 정보 + 요약 + 사업장 계약 카드)
    if(typeof ctRenderDetailPage === 'function') ctRenderDetailPage(c);
    return;
  }
  // 옛 사이드 패널 fallback (호환성)
  const site = siteId && Array.isArray(c.sites) ? c.sites.find(s=>s.id===siteId) : null;
  $('ct-d-title').textContent = site ? `${c.name} - ${site.siteName}` : c.name;
  $('ct-d-sub').innerHTML = `${c.recno} · <span class="badge ${ctStageBadge(ctGetStage(c))}">${ctGetStage(c)}</span>`;
  $('ct-tab-basic').style.display = '';
  $('ct-tab-docs').style.display = 'none';
  $('ct-tab-history').style.display = 'none';
  $$('#ctDetailPanel [data-ct-tab]').forEach((el,i)=>el.classList.toggle('active', i===0));

  // ───── 기본정보 탭: 고객 기본정보만 ─────
  $('ct-tab-basic').innerHTML = `
    <div class="ct-basic-table-wrap">
      <div class="ct-basic-section">
        <div class="ct-basic-section-title">고객 기본정보</div>
        <div class="ct-spec-frame">
          <table class="ct-spec-table">
            <colgroup>
              <col class="label">
              <col>
            </colgroup>
            <tbody>
              <tr><td class="label">참여고객명</td><td>${c.name}</td></tr>
              <tr><td class="label">대표자명</td><td>${c.ceo||'-'}</td></tr>
              <tr><td class="label">사업자등록 접수번호</td><td class="mono">${c.recno}</td></tr>
              <tr><td class="label">전기요금 고객번호</td><td class="mono">${c.kepco||'-'}</td></tr>
              <tr><td class="label">DR 유형</td><td>${c.drType}</td></tr>
              <tr><td class="label">주소</td><td>${c.addr||'-'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  // ───── 계약정보 및 서류 탭: 계약 감축용량·계약기간·계약서류 ─────
  $('ct-tab-docs').innerHTML = `
    <div class="r-card ct-doc-card" style="margin-bottom:12px;">
      <div class="r-card-header"><div class="r-card-title">계약 조건</div></div>
      <div class="r-card-body">
        <div class="ct-doc-edit" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-row" style="margin:0;">
            <label class="form-label">계약 감축용량 (의무)</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <input class="form-input" type="number" min="0" step="10" id="ct-mandatory-capacity" value="${c.contractInfo.mandatoryCapacity}">
              <span style="font-size:12px;color:var(--text-hint);">kW</span>
            </div>
          </div>
          <div class="form-row" style="margin:0;">
            <label class="form-label">수수료율</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <input class="form-input" type="number" min="0" max="100" step="0.1" id="ct-fee-rate" value="${c.contractInfo.feeRate}">
              <span style="font-size:12px;color:var(--text-hint);">%</span>
            </div>
          </div>
          <div class="form-row" style="margin:0;">
            <label class="form-label">계약 시작일</label>
            <input class="form-input" type="date" id="ct-contract-start" value="${c.contractInfo.startDate}">
          </div>
          <div class="form-row" style="margin:0;">
            <label class="form-label">계약 종료일</label>
            <input class="form-input" type="date" id="ct-contract-end" value="${c.contractInfo.endDate}">
          </div>
          <div style="grid-column:1/-1;display:flex;justify-content:flex-end;">
            <button class="btn btn-primary" onclick="ctSaveContractPeriod('${c.id}')">저장</button>
          </div>
        </div>
      </div>
    </div>
    <div class="r-card ct-doc-card">
      <div class="r-card-header">
        <div class="r-card-title">계약 서류</div>
        <span style="font-size:11px;color:var(--text-hint);">총 ${c.contractDocs.length}건</span>
      </div>
      <div class="r-card-body">
        <table class="ct-doc-table">
          <thead><tr><th>서류명</th><th>필수</th><th>파일</th><th>상태</th><th style="text-align:center;">동작</th></tr></thead>
          <tbody>
            ${c.contractDocs.map((d, idx)=>`<tr>
              <td>${d.name}</td>
              <td>${d.required ? '<span style="color:var(--red);font-weight:600;">필수</span>' : '선택'}</td>
              <td>${d.fileName || '<span style="color:var(--text-hint);font-style:italic;">— 미제출</span>'}</td>
              <td><span class="badge ${d.status==='승인'?'badge-done':d.status==='제출완료'?'badge-progress':'badge-gray'}">${d.status}</span></td>
              <td style="text-align:center;">
                ${d.fileName
                  ? `<button class="btn btn-secondary btn-sm" onclick="ctDownloadDoc('${c.id}', ${idx})">다운로드</button>`
                  : `<button class="btn btn-primary btn-sm" onclick="ctUploadDoc('${c.id}', ${idx})">업로드</button>`}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  // ───── 상태이력 탭: store.auditLogs 기반 시간순 + "전체 이력 보기" 링크 ─────
  const logs = (typeof getAuditLogs==='function') ? getAuditLogs('contract', c.id, 20) : [];
  const totalLogs = store.auditLogs ? store.auditLogs.filter(l => l.objectType==='contract' && l.objectId===c.id).length : 0;
  $('ct-tab-history').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:0 4px;">
      <div style="font-size:12px;color:var(--text-hint);">
        최근 ${logs.length}건 표시${totalLogs > logs.length ? ` (전체 ${totalLogs}건)` : ''}
      </div>
      <button class="btn btn-secondary btn-sm" onclick="showFullAuditLogs('contract','${c.id}')">전체 이력 보기 →</button>
    </div>
    ${logs.length===0
      ? '<div style="padding:30px;text-align:center;color:var(--text-hint);">기록된 이력이 없습니다.</div>'
      : logs.map(h=>`
        <div class="ct-history-item">
          <div class="ct-history-dot" style="background:${h.tone==='fail'?'var(--red)':h.tone==='wait'?'var(--amber)':h.tone==='info'?'var(--text-hint)':'var(--blue)'};"></div>
          <div class="ct-history-time">${h.ts}<div style="font-size:10px;color:var(--text-hint);margin-top:2px;">${h.actor||''}</div></div>
          <div class="ct-history-body">${h.title}<div class="ct-history-sub">${h.desc||''}</div></div>
        </div>`).join('')
    }`;

  const stage = ctGetStage(c);
  $('ct-d-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="ctCloseDetail()">닫기</button>
    <div style="flex:1;"></div>
    <div class="ct-stage-actions">
      <button class="btn btn-secondary" onclick="ctOpenEditBasic('${c.id}')">고객정보 수정</button>
      ${stage==='계약대기' ? `<button class="btn btn-secondary" onclick="ctMoveToReview('${c.id}')">검토 시작</button>` : ''}
      ${(stage==='계약대기' || stage==='검토중') ? `<button class="btn btn-danger" onclick="ctOpenReject('${c.id}')">반려</button><button class="btn btn-primary" onclick="ctApprove('${c.id}')">계약 완료</button>` : ''}
      ${stage==='반려' ? `<button class="btn btn-secondary" onclick="ctMoveToReview('${c.id}')">재검토 시작</button>` : ''}
    </div>`;
  $('ctDetailPanel').classList.add('open');
}
function ctCloseDetail(){ $('ctDetailPanel').classList.remove('open'); }

/* [Phase 17-AN] 계약관리 — 페이지뷰 목록 복귀 */
function ctGotoList(){
  const listV = document.getElementById('ct-list-view');
  const detV  = document.getElementById('ct-detail-view');
  if(listV) listV.style.display = 'flex';
  if(detV)  detV.style.display  = 'none';
  ctCurrentId = null;
}

/* [Phase 17-AN/AO] 계약관리 상세 페이지 본문 렌더 — 사업자 정보(인라인 편집) + 요약 + 사업장 계약 카드 + 운영자 메모 */
let ctCustEditing = false;

function ctRenderDetailPage(c){
  const body = document.getElementById('ct-d-body');
  if(!body) return;
  const sites = (typeof pcGetSites === 'function') ? pcGetSites(c) : (Array.isArray(c.sites) ? c.sites : []);
  const contractedCount = sites.filter(s => s.contract && s.contract.startDate && s.contract.endDate).length;

  // 공통 row 스타일 (와이어 형태) — [Phase 17-AQ] 가독성 패딩 +
  const rowStyle  = 'display:grid;grid-template-columns:160px 1fr;border-bottom:1px solid var(--border);';
  const rowLast   = 'display:grid;grid-template-columns:160px 1fr;';
  const labelCell = 'padding:16px 18px;background:var(--grey50);font-size:12px;color:var(--text-sub);font-weight:600;display:flex;align-items:center;';
  const valCell   = 'padding:16px 18px;font-size:13px;font-weight:500;color:var(--navy);display:flex;align-items:center;';
  const inpCell   = 'padding:10px 18px;display:flex;align-items:center;gap:6px;';
  const inpStyle  = 'flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-weight:500;color:var(--navy);box-sizing:border-box;';
  const tableWrap = 'border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#fff;';
  const req = `<span style="color:var(--red);">*</span>`;
  const esc = (v) => String(v||'').replace(/"/g,'&quot;');

  // ① 사업자 정보 카드 — 인라인 편집 토글
  let custInner, custBtn;
  if(!ctCustEditing){
    custInner = `<div style="${tableWrap}">
      <div style="${rowStyle}"><div style="${labelCell}">사업자등록번호</div><div style="${valCell}">${c.bizno || '-'}</div></div>
      <div style="${rowStyle}"><div style="${labelCell}">상호명</div><div style="${valCell}">${c.name || '-'}</div></div>
      <div style="${rowStyle}"><div style="${labelCell}">담당자 이름</div><div style="${valCell}">${c.ceo || '-'}</div></div>
      <div style="${rowStyle}"><div style="${labelCell}">담당자 연락처</div><div style="${valCell}">${c.tel || '-'}</div></div>
      <div style="${rowStyle}"><div style="${labelCell}">업종</div><div style="${valCell}">${c.bizcat || '-'}</div></div>
      <div style="${rowStyle}"><div style="${labelCell}">업태</div><div style="${valCell}">${c.biztype || '-'}</div></div>
      <div style="${rowLast}"><div style="${labelCell}">사업자 주소</div><div style="${valCell}">${c.addr || '-'}</div></div>
    </div>`;
    custBtn = `<button class="btn btn-secondary btn-sm" onclick="ctEnterCustEdit()">사업자 정보 수정</button>`;
  } else {
    custInner = `<div style="${tableWrap}">
      <div style="${rowStyle}"><div style="${labelCell}">사업자등록번호 ${req}</div><div style="${inpCell}">
        <input id="ct-ec-bizno" type="text" value="${esc(c.bizno)}" placeholder="000-00-00000" style="${inpStyle}">
        <button class="btn btn-secondary btn-sm" type="button" onclick="ctEcLookupBizno()">조회</button>
      </div></div>
      <div style="${rowStyle}"><div style="${labelCell}">상호명 ${req}</div><div style="${inpCell}">
        <input id="ct-ec-name" type="text" value="${esc(c.name)}" placeholder="상호명을 입력해 주세요" style="${inpStyle}">
      </div></div>
      <div style="${rowStyle}"><div style="${labelCell}">담당자 이름 ${req}</div><div style="${inpCell}">
        <input id="ct-ec-ceo" type="text" value="${esc(c.ceo)}" placeholder="담당자 성함" style="${inpStyle}">
      </div></div>
      <div style="${rowStyle}"><div style="${labelCell}">담당자 연락처 ${req}</div><div style="${inpCell}">
        <input id="ct-ec-tel" type="text" value="${esc(c.tel)}" placeholder="010-0000-0000" style="${inpStyle}">
      </div></div>
      <div style="${rowStyle}"><div style="${labelCell}">업종</div><div style="${inpCell}">
        <input id="ct-ec-bizcat" type="text" value="${esc(c.bizcat)}" placeholder="조회 시 자동 입력" style="${inpStyle};background:#f8fafc;" readonly>
      </div></div>
      <div style="${rowStyle}"><div style="${labelCell}">업태</div><div style="${inpCell}">
        <input id="ct-ec-biztype" type="text" value="${esc(c.biztype)}" placeholder="조회 시 자동 입력" style="${inpStyle};background:#f8fafc;" readonly>
      </div></div>
      <div style="${rowLast}"><div style="${labelCell}">사업자 주소</div><div style="${inpCell}">
        <input id="ct-ec-addr" type="text" value="${esc(c.addr)}" placeholder="시·구·상세주소" style="${inpStyle}">
      </div></div>
    </div>`;
    custBtn = `<button class="btn btn-secondary btn-sm" onclick="ctCancelCustEdit()">취소</button>
               <button class="btn btn-primary btn-sm" onclick="ctSaveCustEdit()">정보 저장하기</button>`;
  }
  const custCard = `<div class="r-card">
    <div class="r-card-header" style="display:flex;align-items:center;justify-content:space-between;">
      <div class="r-card-title">사업자 정보</div>
      <div style="display:flex;gap:6px;">${custBtn}</div>
    </div>
    <div class="r-card-body">${custInner}</div>
  </div>`;

  // ② 요약 카드 (사업장 수 / 계약 완료)
  const summaryCard = `<div class="r-card">
    <div class="r-card-header"><div class="r-card-title">사업자 요약</div></div>
    <div class="r-card-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div>
          <div style="font-size:11px;color:var(--text-hint);font-weight:500;">사업장 수</div>
          <div style="font-size:22px;font-weight:700;color:var(--navy);margin-top:4px;">${sites.length}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-hint);font-weight:500;">계약 정보 입력 완료</div>
          <div style="font-size:22px;font-weight:700;color:var(--green);margin-top:4px;">${contractedCount} / ${sites.length}</div>
        </div>
      </div>
    </div>
  </div>`;

  // ③ 사업장 관리 테이블 (비니 와이어 — 행 + 아코디언 확장)
  const siteCards = ctRenderSitesTable(c, sites);

  // ④ 운영자 메모 카드
  const memoCard = `<div class="r-card">
    <div class="r-card-header"><div class="r-card-title">운영자 메모</div></div>
    <div id="ct-d-memo-history" style="max-height:200px;overflow-y:auto;"></div>
    <div style="padding:12px 18px;border-top:1px solid var(--border);">
      <textarea id="ct-d-memo-input" style="width:100%;height:60px;border:1px solid var(--border-dark);border-radius:var(--radius);padding:8px 10px;font-size:12px;font-family:inherit;resize:none;outline:none;line-height:1.5;box-sizing:border-box;" placeholder="메모를 입력하세요"></textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:8px;">
        <button class="btn btn-primary btn-sm" onclick="ctAddMemo()">메모 저장</button>
      </div>
    </div>
  </div>`;

  body.innerHTML = custCard + summaryCard + siteCards + memoCard;
  // 메모 히스토리 렌더
  ctRenderMemoHistory(c);
}

/* [Phase 17-AO] 계약관리 메모 — 사전검증과 동일 store.memos[c.recno] 공유 (운영자가 양쪽에서 같은 메모 확인) */
function ctRenderMemoHistory(c){
  const el = document.getElementById('ct-d-memo-history');
  if(!el) return;
  const memos = (store.memos && store.memos[c.recno]) || [];
  if(memos.length === 0){
    el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-hint);font-size:12px;">작성된 메모가 없습니다.</div>`;
    return;
  }
  el.innerHTML = memos.map(m => `<div style="padding:10px 18px;border-bottom:1px solid var(--border);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <span style="font-size:11px;font-weight:600;color:var(--navy);">${m.user || '운영자'}</span>
      <span style="font-size:10px;color:var(--text-hint);">${m.at || ''}</span>
    </div>
    <div style="font-size:12px;color:var(--text-sub);line-height:1.5;white-space:pre-wrap;">${(m.text||'').replace(/</g,'&lt;')}</div>
  </div>`).join('');
}

function ctAddMemo(){
  const c = store.customers.find(x => x.id === ctCurrentId); if(!c) return;
  const input = document.getElementById('ct-d-memo-input');
  const text = input?.value?.trim();
  if(!text){ if(typeof showToast === 'function') showToast('메모 내용을 입력하세요.'); return; }
  if(!store.memos) store.memos = {};
  if(!store.memos[c.recno]) store.memos[c.recno] = [];
  store.memos[c.recno].unshift({ user:'현진영', at: (typeof nowStr==='function'?nowStr():new Date().toISOString().slice(0,16).replace('T',' ')), text });
  if(input) input.value = '';
  if(typeof showToast === 'function') showToast('메모가 저장되었습니다.');
  ctRenderMemoHistory(c);
}

/* [Phase 17-AO] 계약관리 — 사업자 정보 인라인 편집 토글 */
function ctEnterCustEdit(){
  ctCustEditing = true;
  const c = store.customers.find(x => x.id === ctCurrentId); if(!c) return;
  ctRenderDetailPage(c);
}
function ctCancelCustEdit(){
  ctCustEditing = false;
  const c = store.customers.find(x => x.id === ctCurrentId); if(!c) return;
  ctRenderDetailPage(c);
}
function ctSaveCustEdit(){
  const c = store.customers.find(x => x.id === ctCurrentId); if(!c) return;
  const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
  const newBizno   = getVal('ct-ec-bizno');
  const newName    = getVal('ct-ec-name');
  const newCeo     = getVal('ct-ec-ceo');
  const newTel     = getVal('ct-ec-tel');
  const newBizcat  = getVal('ct-ec-bizcat');
  const newBiztype = getVal('ct-ec-biztype');
  const newAddr    = getVal('ct-ec-addr');
  if(!newBizno || !newName || !newCeo || !newTel){
    alert('필수 항목(사업자등록번호·상호명·담당자·연락처)을 모두 입력하세요.');
    return;
  }
  const changes = [];
  const apply = (key, oldVal, newVal, label) => {
    const a = (oldVal == null ? '' : String(oldVal));
    const b = (newVal == null ? '' : String(newVal));
    if(a !== b){ changes.push(`${label}: ${a||'(미입력)'} → ${b||'(미입력)'}`); c[key] = newVal; }
  };
  apply('bizno', c.bizno, newBizno, '사업자등록번호');
  apply('name', c.name, newName, '상호명');
  apply('ceo', c.ceo, newCeo, '담당자 이름');
  apply('tel', c.tel, newTel, '담당자 연락처');
  apply('bizcat', c.bizcat, newBizcat, '업종');
  apply('biztype', c.biztype, newBiztype, '업태');
  apply('addr', c.addr, newAddr, '사업자 주소');
  logAudit?.({
    objectType:'customer', objectId:c.id, action:'customer_info_updated',
    title:`사업자 정보 수정 — ${c.name}`,
    desc: changes.length ? changes.join(' · ') : '변경 사항 없음',
    actor:'운영자', tone:'info'
  });
  ctCustEditing = false;
  if(typeof showToast === 'function') showToast(changes.length ? `정보가 변경되었습니다 (${changes.length}건)` : '변경 사항 없음');
  // 상세 페이지 헤더(타이틀 + breadcrumb) 갱신
  const titleEl = document.getElementById('ct-d-page-title');
  if(titleEl) titleEl.textContent = c.name;
  const crumbEl = document.getElementById('ct-d-crumb');
  if(crumbEl) crumbEl.textContent = c.name;
  ctRenderDetailPage(c);
  if(typeof ctRenderTable === 'function') ctRenderTable();
}
function ctEcLookupBizno(){
  const bizno = document.getElementById('ct-ec-bizno')?.value?.trim();
  if(!bizno){ if(typeof showToast === 'function') showToast('사업자등록번호를 입력하세요.'); return; }
  const lastDigit = parseInt(bizno.replace(/\D/g,'').slice(-1), 10) || 0;
  const bizcatMap  = ['제조업','도매업','서비스업','정보통신업','전기·가스','건설업','부동산업','운수업','금융업','교육서비스'];
  const biztypeMap = ['반도체','종합도매','데이터센터','SI개발','발전사업','종합건설','임대업','물류운송','은행','학원'];
  const bizcatEl  = document.getElementById('ct-ec-bizcat');
  const biztypeEl = document.getElementById('ct-ec-biztype');
  if(bizcatEl)  bizcatEl.value  = bizcatMap[lastDigit]  || '제조업';
  if(biztypeEl) biztypeEl.value = biztypeMap[lastDigit] || '일반';
  if(typeof showToast === 'function') showToast('사업자등록번호 조회 완료');
}

/* [Phase 17-AP] 사업장 관리 — 테이블 + 아코디언 확장 (비니 와이어 형태) */
let ctExpandedSiteId = null;
let ctSiteEditingId = null;  // [Phase 17-CG] 편집 모드 사업장 ID

function ctRenderSitesTable(c, sites){
  // 상태 계산 헬퍼 — 계약기간 기준
  const today = new Date().toISOString().slice(0, 10);
  const calcStatus = (s) => {
    const ct = s.contract || {};
    if(!ct.startDate || !ct.endDate) return {label:'계약 미입력', color:'var(--text-hint)', bg:'var(--grey50)'};
    if(today < ct.startDate) return {label:'계약 예정', color:'var(--blue)', bg:'var(--blue-light, #eff6ff)'};
    if(today > ct.endDate)   return {label:'계약만료', color:'var(--text-hint)', bg:'var(--grey50)'};
    return {label:'계약중', color:'var(--green)', bg:'var(--green-light, #ecfdf5)'};
  };
  const fmtDate = (d) => d || '—';
  const escAttr = (v) => String(v||'').replace(/"/g,'&quot;');

  const rows = sites.map(s => {
    const ct = s.contract || {};
    const st = calcStatus(s);
    const period = ct.startDate && ct.endDate ? `${ct.startDate} ~ ${ct.endDate}` : '—';
    const power  = ct.power ? `${ct.power.toLocaleString()} kW` : '—';
    const fee    = ct.feeRate != null ? `${ct.feeRate}%` : '—';
    const isExpanded = ctExpandedSiteId === s.id;
    const arrowSvg = isExpanded
      ? `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M18 15l-6-6-6 6"/></svg>`
      : `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>`;
    const headBg = isExpanded ? 'var(--blue-light, #eff6ff)' : '';
    const headerRow = `<tr style="cursor:pointer;background:${headBg};border-bottom:1px solid var(--border);" onclick="ctToggleSiteExpand('${c.id}','${s.id}')">
      <td style="padding:14px 12px;width:40px;"><input type="checkbox" class="ct-site-check" data-site-id="${s.id}" onclick="event.stopPropagation();" style="cursor:pointer;"></td>
      <td style="padding:14px 12px;font-weight:600;color:var(--navy);">${s.siteName || '-'}</td>
      <td style="padding:14px 12px;">${s.manager || '—'}</td>
      <td style="padding:14px 12px;color:var(--text-sub);">${s.tel || '—'}</td>
      <td style="padding:14px 12px;font-size:12px;color:var(--text-sub);">${period}</td>
      <td style="padding:14px 12px;font-weight:500;">${power}</td>
      <td style="padding:14px 12px;">${fee}</td>
      <td style="padding:14px 12px;"><span class="badge" style="background:${st.bg};color:${st.color};font-size:11px;padding:3px 8px;border-radius:10px;">${st.label}</span></td>
      <td style="padding:14px 12px;color:var(--text-hint);width:40px;text-align:center;">${arrowSvg}</td>
    </tr>`;
    if(!isExpanded) return headerRow;
    // [Phase 17-AQ] 확장 콘텐츠 — 사업장 정보(단일 컬럼 row) + 증빙 서류 현황(테이블)
    const docTypes = [
      {key:'bizReg',   label:'사업자등록증',   required:true},
      {key:'idCard',   label:'대표자 신분증', required:true},
      {key:'bankBook', label:'통장 사본',     required:false},
      {key:'etc',      label:'기타 서류',     required:false},
    ];
    const docs = ct.docs || {};
    const addrText = s.addr ? `${s.addr}${s.addrDetail?` ${s.addrDetail}`:''}` : '—';
    // 사업장 정보 — 한 줄씩 (라벨 좌 회색 중앙정렬 / 값 우)
    const curStatus = s.siteStatus || '계약대기';
    // [Phase 17-CG] 계약상태: 편집 모드일 때만 드롭다운 활성, 그 외엔 뱃지 표시
    const isEditingSite = ctSiteEditingId === s.id;
    const statusSelect = ['계약대기','계약완료','계약만료','계약해지'].map(opt =>
      `<option value="${opt}"${opt===curStatus?' selected':''}>${opt}</option>`
    ).join('');
    let statusDropdown;
    if(isEditingSite){
      statusDropdown = `<select onchange="ctSetSiteStatus('${c.id}','${s.id}', this.value)" style="padding:8px 12px;border:1px solid var(--blue);border-radius:6px;font-size:13px;font-weight:500;color:var(--navy);background:#fff;cursor:pointer;outline:none;box-shadow:0 0 0 2px rgba(27,95,193,0.1);">${statusSelect}</select>
        <span style="margin-left:10px;font-size:11px;color:var(--blue);font-weight:500;">편집 중</span>`;
    } else {
      const stBadge = curStatus === '계약완료' ? 'badge-done'
                    : curStatus === '계약대기' ? 'badge-pending'
                    : curStatus === '계약만료' ? 'badge-gray'
                    : 'badge-fail';
      statusDropdown = `<span class="badge ${stBadge}" style="font-size:12px;padding:5px 12px;">${curStatus}</span>`;
    }
    const siteFields = [
      ['사업장명', s.siteName],
      ['담당자', s.manager],
      ['담당자 연락처', s.tel],
      ['주소', addrText],
      ['계약기간', period],
      ['계약전력', power],
      ['수수료', fee],
      ['계약상태', statusDropdown],   // [Phase 17-AS] manual override
    ];
    const siteInfoRows = siteFields.map(([label, val], i) => {
      const last = (i === siteFields.length - 1);
      const bb = last ? '' : 'border-bottom:1px solid var(--border);';
      return `<tr>
        <td style="width:160px;padding:14px 16px;background:var(--grey50);color:var(--text-sub);font-size:12px;font-weight:500;text-align:center;${bb}">${label}</td>
        <td style="padding:14px 18px;color:var(--navy);font-size:13px;font-weight:500;${bb}">${val||'—'}</td>
      </tr>`;
    }).join('');
    const siteInfoTable = `<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#fff;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${siteInfoRows}</tbody>
      </table>
    </div>`;
    // 증빙 서류 현황 — 테이블 (서류명 | 파일/상태)
    const docRows = docTypes.map((def, i) => {
      const d = docs[def.key];
      const last = (i === docTypes.length - 1);
      const reqMark = def.required ? `<span style="color:var(--red);margin-left:3px;">*</span>` : '';
      const bb = last ? '' : 'border-bottom:1px solid var(--border);';
      let fileCell;
      if(d){
        fileCell = `<span style="display:inline-flex;align-items:center;gap:8px;padding:7px 12px;background:#fff;border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--text-sub);">
          <span style="color:var(--blue);">📄</span> ${d.name}
          <span style="cursor:pointer;color:var(--text-hint);font-size:13px;" onclick="ctRemoveDoc('${c.id}','${s.id}','${def.key}')" title="삭제">⊗</span>
        </span>`;
      } else {
        fileCell = `<span style="color:var(--text-hint);font-size:12px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;" onclick="ctTriggerDocUpload('${c.id}','${s.id}','${def.key}')">미첨부</span>`;
      }
      return `<tr>
        <td style="width:200px;padding:14px 18px;color:var(--navy);font-size:12px;font-weight:500;${bb}">${def.label}${reqMark}</td>
        <td style="padding:14px 18px;${bb}">${fileCell}</td>
      </tr>`;
    }).join('');
    const docsTable = `<div style="font-size:13px;font-weight:700;color:var(--navy);margin:24px 0 12px;">증빙 서류 현황</div>
      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:var(--grey50);border-bottom:1px solid var(--border);">
              <th style="padding:12px 18px;text-align:left;color:var(--text-sub);font-weight:600;font-size:12px;">서류명</th>
              <th style="padding:12px 18px;text-align:left;color:var(--text-sub);font-weight:600;font-size:12px;">파일/상태</th>
            </tr>
          </thead>
          <tbody>${docRows}</tbody>
        </table>
      </div>`;
    // [Phase 17-CG] 편집 모드일 땐 [저장][취소]로 토글
    const actionButtons = isEditingSite
      ? `<button class="btn btn-secondary btn-sm" onclick="ctCancelSiteEdit('${c.id}','${s.id}')">취소</button>
         <button class="btn btn-primary btn-sm" onclick="ctSaveSiteEdit('${c.id}','${s.id}')">저장</button>`
      : `<button class="btn btn-secondary btn-sm" onclick="ctOpenSiteEdit('${c.id}','${s.id}')">수정</button>
         <button class="btn btn-danger btn-sm" onclick="ctDeleteSite('${c.id}','${s.id}')">삭제</button>`;
    const expandRow = `<tr style="background:var(--blue-light, #eff6ff);">
      <td colspan="9" style="padding:18px 28px 22px;">
        <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:24px 28px;">
          ${siteInfoTable}
          ${docsTable}
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:22px;">
            ${actionButtons}
          </div>
        </div>
      </td>
    </tr>`;
    return headerRow + expandRow;
  }).join('');

  return `<div class="r-card">
    <div class="r-card-header" style="display:flex;align-items:center;justify-content:space-between;">
      <div class="r-card-title">사업장 관리</div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-danger btn-sm" onclick="ctBulkDeleteSites('${c.id}')">선택 삭제</button>
        <button class="btn btn-primary btn-sm" onclick="ctOpenAddSite('${c.id}')">+ 사업장 추가</button>
      </div>
    </div>
    <div class="r-card-body" style="padding:0;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:var(--grey50);border-bottom:1px solid var(--border);">
            <th style="padding:12px;width:40px;"><input type="checkbox" id="ct-site-checkall" onchange="ctToggleAllSites(this.checked)" style="cursor:pointer;"></th>
            <th style="padding:12px;text-align:left;color:var(--text-sub);font-weight:600;">사업장명</th>
            <th style="padding:12px;text-align:left;color:var(--text-sub);font-weight:600;">담당자</th>
            <th style="padding:12px;text-align:left;color:var(--text-sub);font-weight:600;">담당자 연락처</th>
            <th style="padding:12px;text-align:left;color:var(--text-sub);font-weight:600;">계약기간</th>
            <th style="padding:12px;text-align:left;color:var(--text-sub);font-weight:600;">계약전력</th>
            <th style="padding:12px;text-align:left;color:var(--text-sub);font-weight:600;">수수료</th>
            <th style="padding:12px;text-align:left;color:var(--text-sub);font-weight:600;">상태</th>
            <th style="padding:12px;width:40px;"></th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="9" style="padding:30px;text-align:center;color:var(--text-hint);font-size:12px;">등록된 사업장이 없습니다. [+ 사업장 추가] 버튼으로 등록하세요.</td></tr>`}</tbody>
      </table>
    </div>
  </div>`;
}

function ctToggleSiteExpand(bizId, siteId){
  ctExpandedSiteId = (ctExpandedSiteId === siteId) ? null : siteId;
  const c = store.customers.find(x => x.id === bizId); if(!c) return;
  ctRenderDetailPage(c);
}

/* [Phase 17-AS] 사업장 계약상태 manual override — 즉시 저장 + 감사로그 */
function ctSetSiteStatus(bizId, siteId, newStatus){
  const c = store.customers.find(x => x.id === bizId); if(!c) return;
  const s = (c.sites||[]).find(x => x.id === siteId); if(!s) return;
  const old = s.siteStatus || '계약대기';
  if(old === newStatus) return;
  s.siteStatus = newStatus;
  logAudit?.({objectType:'site', objectId:s.id, action:'site_status_changed',
    title:`사업장 계약상태 변경 — ${s.siteName}`,
    desc:`${old} → ${newStatus} (${c.name})`,
    actor:'운영자', tone:'info'});
  if(typeof showToast === 'function') showToast(`사업장 계약상태가 '${newStatus}'(으)로 변경되었습니다.`);
  // 사업자 종합 상태·KPI·목록 갱신
  ctRenderDetailPage(c);
  if(typeof ctRenderTable === 'function')   ctRenderTable();
  if(typeof ctRenderSummary === 'function') ctRenderSummary();
}

/* 사업장 추가 — 비어있는 사업장 신규 생성 */
function ctOpenAddSite(bizId){
  const c = store.customers.find(x => x.id === bizId); if(!c) return;
  if(!Array.isArray(c.sites)) c.sites = [];
  const idx = c.sites.length + 1;
  const newSite = {
    id: `${c.id}-S${Date.now().toString().slice(-6)}`,
    siteName: `신규 사업장 ${idx}`,
    manager: '',
    tel: '',
    addr: '',
    addrDetail: '',
    kepco: '',
    power: 0,
    steps: [1,1,1,1],
    contract: { startDate:'', endDate:'', power:0, feeRate:0, docs:{} },
  };
  c.sites.push(newSite);
  ctExpandedSiteId = newSite.id;  // 신규 사업장 자동 확장
  if(typeof showToast === 'function') showToast(`${newSite.siteName} 추가 완료 — 정보를 입력하세요`);
  logAudit?.({objectType:'site', objectId:newSite.id, action:'site_added',
    title:`사업장 추가 — ${newSite.siteName}`, desc:`${c.name}`, actor:'운영자', tone:'info'});
  ctRenderDetailPage(c);
}

/* 사업장 삭제 */
function ctDeleteSite(bizId, siteId){
  const c = store.customers.find(x => x.id === bizId); if(!c) return;
  if(!Array.isArray(c.sites)) return;
  const s = c.sites.find(x => x.id === siteId); if(!s) return;
  if(!confirm(`'${s.siteName}' 사업장을 삭제할까요? 계약 정보·서류도 함께 삭제됩니다.`)) return;
  c.sites = c.sites.filter(x => x.id !== siteId);
  ctExpandedSiteId = null;
  logAudit?.({objectType:'site', objectId:siteId, action:'site_deleted',
    title:`사업장 삭제 — ${s.siteName}`, desc:`${c.name}`, actor:'운영자', tone:'warn'});
  if(typeof showToast === 'function') showToast(`${s.siteName} 삭제 완료`);
  ctRenderDetailPage(c);
}

/* 사업장 정보 수정 — TODO: 인라인 편집 추가 예정 */
/* [Phase 17-CG] 사업장 편집 모드 진입 — 계약상태 드롭다운 활성 */
function ctOpenSiteEdit(bizId, siteId){
  ctSiteEditingId = siteId;
  ctExpandedSiteId = siteId;  // 펼쳐진 상태 유지
  const c = store.customers.find(x => x.id === bizId); if(!c) return;
  ctRenderDetailPage(c);
}
function ctCancelSiteEdit(bizId, siteId){
  ctSiteEditingId = null;
  const c = store.customers.find(x => x.id === bizId); if(!c) return;
  ctRenderDetailPage(c);
}
function ctSaveSiteEdit(bizId, siteId){
  // 드롭다운은 onchange로 즉시 저장됨 (ctSetSiteStatus). 명시적 [저장]은 편집 모드 종료만.
  ctSiteEditingId = null;
  if(typeof showToast === 'function') showToast('사업장 정보 저장 완료');
  const c = store.customers.find(x => x.id === bizId); if(!c) return;
  ctRenderDetailPage(c);
}

/* [Phase 17-CG] 전체 선택 + 일괄 삭제 */
function ctToggleAllSites(checked){
  document.querySelectorAll('.ct-site-check').forEach(cb => { cb.checked = checked; });
}
function ctBulkDeleteSites(bizId){
  const c = store.customers.find(x => x.id === bizId); if(!c) return;
  if(!Array.isArray(c.sites)) return;
  const checked = Array.from(document.querySelectorAll('.ct-site-check')).filter(cb => cb.checked);
  if(checked.length === 0){
    if(typeof showToast === 'function') showToast('삭제할 사업장을 선택하세요.');
    return;
  }
  const targetIds = checked.map(cb => cb.dataset.siteId);
  const targetNames = targetIds.map(id => c.sites.find(s => s.id === id)?.siteName).filter(Boolean);
  if(!confirm(`선택된 ${targetIds.length}개 사업장을 삭제할까요?\n\n${targetNames.join(', ')}\n\n계약 정보·서류도 함께 삭제됩니다.`)) return;
  c.sites = c.sites.filter(s => !targetIds.includes(s.id));
  ctExpandedSiteId = null;
  ctSiteEditingId = null;
  logAudit?.({objectType:'site', objectId:bizId, action:'sites_bulk_deleted',
    title:`사업장 일괄 삭제 — ${c.name}`,
    desc:`${targetIds.length}건: ${targetNames.join(', ')}`,
    actor:'운영자', tone:'warn'});
  if(typeof showToast === 'function') showToast(`${targetIds.length}개 사업장 삭제 완료`);
  ctRenderDetailPage(c);
}

/* 서류 제거 */
function ctRemoveDoc(bizId, siteId, docKey){
  const c = store.customers.find(x => x.id === bizId); if(!c) return;
  const s = (c.sites||[]).find(x => x.id === siteId); if(!s) return;
  if(!s.contract || !s.contract.docs || !s.contract.docs[docKey]) return;
  if(!confirm('이 서류를 삭제할까요?')) return;
  const removed = s.contract.docs[docKey];
  delete s.contract.docs[docKey];
  logAudit?.({objectType:'site_contract', objectId:siteId, action:'doc_removed',
    title:`서류 삭제 — ${s.siteName}`, desc:`${docKey} · ${removed.name}`, actor:'운영자', tone:'warn'});
  if(typeof showToast === 'function') showToast(`서류 삭제 완료`);
  ctRenderDetailPage(c);
}

/* 옛 함수 — 호환성 위해 빈 stub (호출처가 있을 수 있어서 에러 방지) */
function ctRenderSiteContractCard(c, s, styles){
  const ct = s.contract || {};
  const docs = ct.docs || {};
  const inpStyle = 'flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-weight:500;color:var(--navy);box-sizing:border-box;';
  const inpCell  = 'padding:8px 14px;display:flex;align-items:center;gap:6px;';
  const esc = (v) => String(v||'').replace(/"/g,'&quot;');
  const req = `<span style="color:var(--red);">*</span>`;

  // 서류 업로드 영역 — 4종 (사업자등록증·대표자 신분증·통장 사본·기타 서류)
  const docTypes = [
    {key:'bizReg',   label:'사업자등록증',   req:true},
    {key:'idCard',   label:'대표자 신분증',  req:true},
    {key:'bankBook', label:'통장 사본',     req:false},
    {key:'etc',      label:'기타 서류',     req:false},
  ];
  const docRow = (def) => {
    const d = docs[def.key];
    const uploaded = !!d;
    const fileLabel = uploaded ? `<span style="color:var(--green);font-weight:600;">📄 ${d.name}</span>` : '';
    return `<div style="${styles.rowStyle}">
      <div style="${styles.labelCell}">${def.label} ${def.req?req:''}</div>
      <div style="${styles.inpCell || 'padding:14px;'};flex-direction:column;align-items:stretch;">
        <div onclick="ctTriggerDocUpload('${c.id}','${s.id}','${def.key}')"
             style="border:2px dashed var(--border-dark);border-radius:8px;padding:24px;text-align:center;cursor:pointer;background:var(--grey50);transition:all .15s ease;"
             onmouseover="this.style.background='#fff';this.style.borderColor='var(--blue)';"
             onmouseout="this.style.background='var(--grey50)';this.style.borderColor='var(--border-dark)';">
          <div style="font-size:20px;color:var(--text-hint);margin-bottom:6px;">☁️</div>
          <div style="font-size:12px;color:var(--text-sub);font-weight:500;">파일을 끌어다 놓거나 클릭하여 업로드</div>
          <div style="font-size:10px;color:var(--text-hint);margin-top:3px;">.pdf .jpg .png (최대 10MB)</div>
          ${uploaded ? `<div style="margin-top:10px;padding:6px 10px;background:var(--green-light,#ecfdf5);border:1px solid var(--green-border,#86efac);border-radius:4px;display:inline-block;font-size:11px;">${fileLabel}</div>` : ''}
        </div>
      </div>
    </div>`;
  };

  return `<div class="r-card">
    <div class="r-card-header" style="display:flex;align-items:center;justify-content:space-between;">
      <div class="r-card-title">${s.siteName}</div>
      <button class="btn btn-primary btn-sm" onclick="ctSaveSiteContract('${c.id}','${s.id}')">저장</button>
    </div>
    <div class="r-card-body">
      <!-- 사업장 정보 -->
      <div style="font-size:11px;color:var(--text-hint);font-weight:600;margin-bottom:8px;">사업장 정보</div>
      <div style="${styles.tableWrap};margin-bottom:18px;">
        <div style="${styles.rowStyle}">
          <div style="${styles.labelCell}">사업장명 ${req}</div>
          <div style="${inpCell}"><input id="ct-s-name-${s.id}" type="text" value="${esc(s.siteName)}" placeholder="사업장명을 입력해 주세요" style="${inpStyle}"></div>
        </div>
        <div style="${styles.rowStyle}">
          <div style="${styles.labelCell}">담당자 ${req}</div>
          <div style="${inpCell}"><input id="ct-s-manager-${s.id}" type="text" value="${esc(s.manager)}" placeholder="담당자 성함을 입력해 주세요" style="${inpStyle}"></div>
        </div>
        <div style="${styles.rowStyle}">
          <div style="${styles.labelCell}">담당자 연락처 ${req}</div>
          <div style="${inpCell}"><input id="ct-s-tel-${s.id}" type="text" value="${esc(s.tel)}" placeholder="000-0000-0000" style="${inpStyle}"></div>
        </div>
        <div style="${styles.rowStyle}">
          <div style="${styles.labelCell}">주소 ${req}</div>
          <div style="padding:8px 14px;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;gap:6px;">
              <input id="ct-s-addr-${s.id}" type="text" value="${esc(s.addr)}" placeholder="주소를 검색해 주세요" style="${inpStyle}">
              <button class="btn btn-secondary btn-sm" type="button" onclick="ctSearchAddr('${s.id}')">주소 검색</button>
            </div>
            <input id="ct-s-addrDetail-${s.id}" type="text" value="${esc(s.addrDetail)}" placeholder="상세 주소를 입력해 주세요" style="${inpStyle}">
          </div>
        </div>
        <div style="${styles.rowStyle}">
          <div style="${styles.labelCell}">계약기간 ${req}</div>
          <div style="${inpCell}">
            <input id="ct-s-start-${s.id}" type="date" value="${esc(ct.startDate)}" style="${inpStyle}">
            <span style="color:var(--text-hint);">~</span>
            <input id="ct-s-end-${s.id}" type="date" value="${esc(ct.endDate)}" style="${inpStyle}">
          </div>
        </div>
        <div style="${styles.rowStyle}">
          <div style="${styles.labelCell}">계약전력</div>
          <div style="${inpCell}">
            <input id="ct-s-power-${s.id}" type="number" value="${ct.power||0}" style="max-width:200px;${inpStyle}">
            <span style="color:var(--text-sub);font-size:13px;">kW</span>
          </div>
        </div>
        <div style="${styles.rowLast}">
          <div style="${styles.labelCell}">수수료</div>
          <div style="${inpCell}">
            <input id="ct-s-fee-${s.id}" type="number" value="${ct.feeRate||0}" style="max-width:200px;${inpStyle}">
            <span style="color:var(--text-sub);font-size:13px;">%</span>
          </div>
        </div>
      </div>

      <!-- 서류 업로드 -->
      <div style="font-size:11px;color:var(--text-hint);font-weight:600;margin-bottom:8px;">서류 업로드</div>
      <div style="${styles.tableWrap}">
        ${docTypes.map(docRow).join('')}
      </div>
    </div>
  </div>`;
}

/* 사업장 계약 카드 — 저장 */
function ctSaveSiteContract(bizId, siteId){
  const c = store.customers.find(x => x.id === bizId); if(!c) return;
  const sites = (typeof pcGetSites === 'function') ? pcGetSites(c) : (c.sites || []);
  const s = sites.find(x => x.id === siteId); if(!s) return;
  const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
  const newName = getVal(`ct-s-name-${siteId}`);
  const newManager = getVal(`ct-s-manager-${siteId}`);
  const newTel = getVal(`ct-s-tel-${siteId}`);
  const newAddr = getVal(`ct-s-addr-${siteId}`);
  const newAddrDetail = getVal(`ct-s-addrDetail-${siteId}`);
  const newStart = getVal(`ct-s-start-${siteId}`);
  const newEnd = getVal(`ct-s-end-${siteId}`);
  const newPower = parseInt(getVal(`ct-s-power-${siteId}`), 10) || 0;
  const newFee = parseFloat(getVal(`ct-s-fee-${siteId}`)) || 0;
  if(!newName || !newManager || !newTel || !newAddr || !newStart || !newEnd){
    alert('필수 항목(사업장명·담당자·담당자 연락처·주소·계약기간)을 모두 입력하세요.');
    return;
  }
  s.siteName = newName;
  s.manager = newManager;
  s.tel = newTel;
  s.addr = newAddr;
  s.addrDetail = newAddrDetail;
  if(!s.contract) s.contract = {};
  s.contract.startDate = newStart;
  s.contract.endDate = newEnd;
  s.contract.power = newPower;
  s.contract.feeRate = newFee;
  logAudit?.({
    objectType:'site_contract', objectId:siteId, action:'contract_saved',
    title:`사업장 계약 정보 저장 — ${newName}`,
    desc:`${newStart} ~ ${newEnd} · ${newPower} kW · 수수료 ${newFee}%`,
    actor:'운영자', tone:'info'
  });
  if(typeof showToast === 'function') showToast(`${newName} 계약 정보 저장 완료`);
  ctRenderDetailPage(c);  // 화면 갱신
}

/* 주소 검색 stub */
function ctSearchAddr(siteId){
  if(typeof showToast === 'function') showToast('주소 검색 — 다음/카카오 주소 API 연동 예정 (목업)');
}

/* 서류 업로드 트리거 — 파일 input을 동적 생성해서 클릭 */
function ctTriggerDocUpload(bizId, siteId, docKey){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.jpg,.png';
  input.onchange = (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    if(file.size > 10 * 1024 * 1024){ alert('파일 크기는 10MB 이하여야 합니다.'); return; }
    const c = store.customers.find(x => x.id === bizId); if(!c) return;
    const sites = (typeof pcGetSites === 'function') ? pcGetSites(c) : (c.sites || []);
    const s = sites.find(x => x.id === siteId); if(!s) return;
    if(!s.contract) s.contract = {};
    if(!s.contract.docs) s.contract.docs = {};
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    s.contract.docs[docKey] = {
      name: file.name,
      size: file.size,
      uploadedAt: `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,
    };
    const docLabel = ({bizReg:'사업자등록증', idCard:'대표자 신분증', bankBook:'통장 사본', etc:'기타 서류'})[docKey] || docKey;
    logAudit?.({
      objectType:'site_contract', objectId:siteId, action:'doc_uploaded',
      title:`${docLabel} 업로드 — ${s.siteName}`,
      desc:`${file.name} (${(file.size/1024).toFixed(1)} KB)`,
      actor:'운영자', tone:'info'
    });
    if(typeof showToast === 'function') showToast(`${docLabel} 업로드 완료 — ${file.name}`);
    ctRenderDetailPage(c);
  };
  input.click();
}
function ctSwitchTab(tab, el){
  $$('#ctDetailPanel [data-ct-tab]').forEach(x=>x.classList.remove('active'));
  if(el) el.classList.add('active');
  $('ct-tab-basic').style.display = tab==='basic' ? '' : 'none';
  $('ct-tab-docs').style.display = tab==='docs' ? '' : 'none';
  $('ct-tab-history').style.display = tab==='history' ? '' : 'none';
}
function ctOpenEditBasic(id){
  const c = store.customers.find(x=>x.id===id); if(!c) return;
  $('cm-title').textContent = '고객정보 수정';
  $('cm-sub').textContent = `${c.name} 기본정보를 계약관리 화면에서 바로 수정합니다.`;
  $('cm-body').innerHTML = `
    <div class="form-row">
      <label class="form-label">참여고객명</label>
      <input class="form-input" id="ct-edit-name" value="${c.name}">
    </div>
    <div class="form-row">
      <label class="form-label">대표자명</label>
      <input class="form-input" id="ct-edit-ceo" value="${c.ceo||''}">
    </div>
    <div class="form-row">
      <label class="form-label">전기요금 고객번호</label>
      <input class="form-input" id="ct-edit-kepco" value="${c.kepco||''}">
    </div>
    <div class="form-row">
      <label class="form-label">주소</label>
      <input class="form-input" id="ct-edit-addr" value="${c.addr||''}">
    </div>
    <div class="form-row">
      <label class="form-label">계약전력 (kW)</label>
      <input class="form-input" id="ct-edit-power" type="number" min="0" value="${c.power||0}">
    </div>
    <div class="form-row">
      <label class="form-label">예상 감축량 (kW)</label>
      <input class="form-input" id="ct-edit-reduction" type="number" min="0" value="${c.reduction||0}">
    </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="ctSaveBasic('${c.id}')">저장</button>`;
  openModal('commonModal');
}
function ctSaveBasic(id){
  const c = store.customers.find(x=>x.id===id); if(!c) return;
  const name = $('ct-edit-name')?.value.trim();
  const ceo = $('ct-edit-ceo')?.value.trim();
  const kepco = $('ct-edit-kepco')?.value.trim();
  const addr = $('ct-edit-addr')?.value.trim();
  const power = parseInt($('ct-edit-power')?.value, 10);
  const reduction = parseInt($('ct-edit-reduction')?.value, 10);
  if(!name || !ceo || !addr){ showToast('고객명, 대표자명, 주소를 입력하세요.'); return; }
  c.name = name;
  c.ceo = ceo;
  c.kepco = kepco;
  c.addr = addr;
  c.power = Number.isFinite(power) ? power : c.power;
  c.reduction = Number.isFinite(reduction) ? reduction : c.reduction;
  if(c.contractInfo){
    c.contractInfo.mandatoryCapacity = Math.max(50, Math.round(((c.reduction || Math.max(30, Math.round((c.power||100)*0.2))))/10)*10);
  }
  closeModal('commonModal');
  ctAddHistory(c, '고객정보 수정', '계약관리 상세에서 고객 기본정보를 수정함', 'done');
  if(typeof pcAddLog==='function') pcAddLog(c, '고객정보 수정', `${c.name} 기본정보 수정`, 'done');
  ctAfterChange(`${c.name} 고객정보를 저장했습니다.`);
  ctOpenDetail(id);
}
function ctSaveContractPeriod(id){
  const c = store.customers.find(x=>x.id===id); if(!c || !c.contractInfo) return;
  const startDate = $('ct-contract-start')?.value;
  const endDate = $('ct-contract-end')?.value;
  const mandatory = parseInt($('ct-mandatory-capacity')?.value, 10);
  const feeRate = parseFloat($('ct-fee-rate')?.value);
  if(!startDate || !endDate){ showToast('계약 시작일과 종료일을 입력하세요.'); return; }
  if(startDate > endDate){ showToast('계약 종료일은 시작일 이후여야 합니다.'); return; }
  if(!Number.isFinite(mandatory) || mandatory<=0){ showToast('계약 감축용량을 정확히 입력하세요.'); return; }
  if(!Number.isFinite(feeRate) || feeRate<0 || feeRate>100){ showToast('수수료율은 0~100% 범위로 입력하세요.'); return; }

  // 변경 감지 — 무엇이 바뀌었는지 추적
  const changes = [];
  if(c.contractInfo.startDate !== startDate || c.contractInfo.endDate !== endDate){
    changes.push(`계약기간 ${c.contractInfo.startDate}~${c.contractInfo.endDate} → ${startDate}~${endDate}`);
  }
  if(c.contractInfo.mandatoryCapacity !== mandatory){
    changes.push(`감축용량 ${c.contractInfo.mandatoryCapacity}kW → ${mandatory}kW`);
  }
  if(c.contractInfo.feeRate !== feeRate){
    changes.push(`수수료율 ${c.contractInfo.feeRate}% → ${feeRate}%`);
  }
  c.contractInfo.startDate = startDate;
  c.contractInfo.endDate = endDate;
  c.contractInfo.mandatoryCapacity = mandatory;
  c.contractInfo.feeRate = feeRate;

  if(changes.length>0){
    ctAddHistory(c, '계약 조건 수정', changes.join(' · '), 'done');
  }
  ctAfterChange('계약 조건이 저장되었습니다.');
  ctOpenDetail(id);
  ctSwitchTab('docs', document.querySelector('#ctDetailPanel [data-ct-tab="docs"]'));
}

// 계약 서류 업로드 (목업 — 실제 파일 입력 없이 즉시 등록 처리)
function ctUploadDoc(id, docIdx){
  const c = store.customers.find(x=>x.id===id); if(!c) return;
  const doc = c.contractDocs?.[docIdx]; if(!doc) return;
  doc.fileName = `${doc.name.replaceAll(' ','_')}_${c.id}_${docIdx+1}.pdf`;
  doc.status = '제출완료';
  ctAddHistory(c, '계약 서류 업로드', `${doc.name} — ${doc.fileName}`, 'done');
  ctAfterChange(`${doc.name} 서류가 업로드되었습니다.`);
  ctOpenDetail(id);
  ctSwitchTab('docs', document.querySelector('#ctDetailPanel [data-ct-tab="docs"]'));
}

// 계약 서류 다운로드 (목업 — 토스트만)
function ctDownloadDoc(id, docIdx){
  const c = store.customers.find(x=>x.id===id); if(!c) return;
  const doc = c.contractDocs?.[docIdx]; if(!doc?.fileName) return;
  showToast(`${doc.fileName} 다운로드 시작 (목업)`);
  ctAddHistory(c, '계약 서류 다운로드', `${doc.name} — ${doc.fileName}`, 'info');
}
function ctAddHistory(c, title, desc='', tone='done'){
  ctEnsureCustomerMeta(c);
  c.contractHistory.unshift({ time: `${ctTodayStr()} 14:00`, title, desc, tone });
  // 통합 감사 로그에도 기록 (Phase 7)
  if(typeof logAudit === 'function'){
    const action = tone==='fail' ? 'rejected' : tone==='wait' ? 'review_started' : 'updated';
    logAudit({objectType:'contract', objectId:c.id, action, title, desc, actor:'운영자', tone});
  }
}
function ctMoveToReview(id){
  const c = store.customers.find(x=>x.id===id); if(!c) return;
  ctEnsureCustomerMeta(c);
  c.contractStage = '검토중';
  ctAddHistory(c, '계약 검토 시작', '운영자가 계약 조건 및 필수 서류 검토를 시작함', 'wait');
  ctAfterChange(`${c.name} 계약 검토를 시작했습니다.`);
  ctOpenDetail(id);
}
function ctApprove(id){
  const c = store.customers.find(x=>x.id===id); if(!c) return;
  ctEnsureCustomerMeta(c);
  c.contractStage = '계약완료';
  c.status = '계약완료';
  c.contractDate = ctTodayStr();
  c.contractDocs.forEach(d=>{ if(d.submitted) d.status='승인'; });
  ctAddHistory(c, '계약 완료', '계약 확정 후 자원관리 매핑 가능 상태로 전환됨', 'done');
  // precheck log if available
  if(typeof pcAddLog==='function') pcAddLog(c, '계약 완료', `${c.name} — 계약관리에서 계약완료 처리`, 'done');
  ctAfterChange(`${c.name} 계약이 완료되었습니다.`);
  ctOpenDetail(id);
}
function ctOpenReject(id){
  ctRejectTargetId = id;
  $('ct-reject-reason').value = '서류 미비';
  $('ct-reject-note').value = '';
  $('ctRejectOverlay').classList.add('show');
}
function ctCloseReject(){
  $('ctRejectOverlay').classList.remove('show');
  ctRejectTargetId = null;
}
function ctConfirmReject(){
  const id = ctRejectTargetId;
  const c = store.customers.find(x=>x.id===id); if(!c) return;
  ctEnsureCustomerMeta(c);
  const reason = $('ct-reject-reason').value;
  const note = $('ct-reject-note').value.trim();
  c.contractStage = '반려';
  c.status = '반려';
  ctAddHistory(c, '계약 반려', `${reason}${note ? ' · ' + note : ''}`, 'fail');
  if(typeof pcAddLog==='function') pcAddLog(c, '계약 반려', `${c.name} — ${reason}`, 'fail');
  ctCloseReject();
  ctAfterChange(`${c.name} 계약을 반려했습니다.`);
  ctOpenDetail(id);
}
function ctAfterChange(msg){
  ctRenderSummary();
  ctRenderTable();
  if(typeof pcRefreshCards==='function') pcRefreshCards();
  if(typeof pcRenderTable==='function') pcRenderTable();
  if(typeof rmApplyFilter==='function') rmApplyFilter();
  if(typeof rmRefreshSummary==='function') rmRefreshSummary();
  if(typeof renderDashboard==='function') renderDashboard();
  refreshSidebarBadges();
  showToast(msg);
}


/* ════════════════════════════════════════════════════════════
   ★ 초기 부팅 (로그인 게이트 포함)
════════════════════════════════════════════════════════════ */
