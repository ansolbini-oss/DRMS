/* ════════════════════════════════════════════════════════════
   RESOURCE — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

function trialRequiredForType(typeKey){
  return typeKey==='standard' || typeKey==='jeju';
}

// [v0.2 M-03] 자원 유형 13종 코드 매핑. 라벨(g.type)로부터 코드 유추 (seed backfill용)
const RM_TYPE_LABEL_TO_CODE = {
  '표준DR':'standard', 'H-표준DR':'h_standard',
  '중소형DR':'small', '중소형DR-충전EV':'small_ev',
  'H-중소형DR':'h_small', 'H-중소형DR(EV)':'h_small_ev',
  '국민DR':'national',
  '제주DR':'jeju', 'H-제주DR':'h_jeju',
  '제주DR(EV)':'jeju_ev', 'H-제주DR(EV)':'h_jeju_ev',
  '주파수DR':'freq', '플러스DR':'plus',
};
function rmTypeCode(g){
  return g.typeCode || RM_TYPE_LABEL_TO_CODE[g.type] || g.typeKey || '';
}
/* 시험 상태 → 라벨/뱃지
   dashboardLabel: 대시보드 표시용 업무 용어 (운영자 관점)
   label: 자원관리 상세 표시용 내부 상태어 */
function trialStatusMeta(t){
  if(!t) return {label:'-', dashboardLabel:'-', badge:'badge-gray'};
  const map = {
    NOT_REQUIRED:{label:'미대상',   dashboardLabel:'미대상',   badge:'badge-gray'},
    WAITING:     {label:'시험 대기', dashboardLabel:'시험 대기', badge:'badge-pending'},
    PASSED:      {label:'합격',     dashboardLabel:'합격',     badge:'badge-done'},
    FAILED:      {label:'불합격',   dashboardLabel:'불합격',   badge:'badge-fail'},
  };
  return map[t.status] || {label:t.status||'-', dashboardLabel:t.status||'-', badge:'badge-gray'};
}
/* 자원그룹의 시험 합격/면제 여부 — 활성화 가능 조건 */
function trialClearedForActivation(g){
  if(!g.trial) return true;               // 하위호환: trial 필드 없으면 통과
  if(!g.trial.required) return true;       // 면제 대상
  return g.trial.status==='PASSED';
}
/* 시험 대기/필요 그룹 (시험 대상이면서 미합격) */
function trialPendingGroups(){
  return store.groups.filter(g=>{
    if(!g.trial || !g.trial.required) return false;
    return g.trial.status !== 'PASSED';
  });
}

/* 공통 뱃지 클래스 */
const rmState = {
  filter:{card:'all', status:'', type:'', q:''},
  selectedGroupId:null,
  detailTab:'info',
  mappingSelected:new Set(),
  bulkSelected:new Set(),
};

function rmGroupCapacityTotal(g){
  let sum = 0;
  (g.customerIds||[]).forEach(id=>{
    const c = custById(id);
    if(c && c.status==='계약완료') sum += (c.reduction||0);
  });
  return sum;
}
function rmGroupCustomerCount(g){ return (g.customerIds||[]).length; }

/* 해당 자원그룹이 현재 참여중인 라이브 감축 이벤트(들)을 찾는다.
   설계서 §8.1에 따라 의무감축 + 자발적DR은 동시간대 병행 ACTIVE가 가능하므로 배열로 반환.
   없으면 빈 배열. */
function rmGroupCurrentLiveEvents(g){
  const result = [];
  (store.events.reduction||[]).forEach(e=>{
    if(!e.live) return;
    const res = e.resources?.find(r=>r.groupId===g.id);
    if(res) result.push({event:e, resource:res});
  });
  (store.events.plus||[]).forEach(e=>{
    if(!e.live) return;
    const res = e.resources?.find(r=>r.groupId===g.id);
    if(res) result.push({event:e, resource:res});
  });
  return result;
}
function rmHealth(g){
  if(!g.operational) return 'normal';
  const dc = g.operational.dataCollection;
  const pf = g.operational.performance;
  // 실적 데이터가 없는 신규 그룹은 이행률 기준 평가에서 제외 (데이터 수집 상태만 반영)
  const hasPerfData = pf && pf.count > 0;
  if(dc?.status==='FAILED' || (hasPerfData && pf.recentAvgRate<0.7)) return 'risk';
  if(dc?.status==='DELAYED' || dc?.status==='PARTIAL' || (hasPerfData && pf.recentAvgRate<0.85)) return 'warn';
  return 'normal';
}

/* 운영이상 자원그룹을 이상 사유/영향 정보와 함께 반환 (대시보드·자원관리 공용 단일 원천)
   반환 원소: { group, level:'risk'|'warn', reason:string, reasonKey, affectedCount }
   정렬: risk 먼저, 그 안에서 데이터수집 문제 > 저성과 순 */
function rmRefreshSummary(){
  // [Phase 17-B] Phase 10에서 칩 element 제거했으나 JS가 여전히 참조해서 null TypeError 발생 →
  // 모든 DOM 접근에 null guard. 한 개라도 null이면 silent skip.
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  };
  // inactive는 조회 제외라 전체 카운트에서 배제
  const g = store.groups.filter(x => x.status !== 'inactive');
  setText('rm-cnt-all', g.length);
  // 시험 대기 카운트
  const trialPending = (typeof trialPendingGroups === 'function') ? trialPendingGroups() : [];
  setText('rm-cnt-trial', trialPending.length);
  // 운영이상 카운트
  const problems = (typeof getProblematicGroups === 'function') ? getProblematicGroups() : [];
  const risk = problems.filter(p=>p.level==='risk').length;
  const warn = problems.filter(p=>p.level==='warn').length;
  setText('rm-cnt-risk', risk+warn);
}

function rmFilterByCard(card){
  rmState.filter.card = card;
  if(card==='all'){
    rmState.filter.status = '';
    rmState.filter.type = '';
    if($('rm-status-filter')) $('rm-status-filter').value = '';
    if($('rm-type-filter')) $('rm-type-filter').value = '';
  }
  ['rm-card-all','rm-card-trial','rm-card-risk']
    .forEach(id=>$(id)?.classList.remove('active'));
  const map = {all:'rm-card-all', trial:'rm-card-trial', risk:'rm-card-risk'};
  if(map[card]) $(map[card]).classList.add('active');
  rmApplyFilter();
}

function rmApplyFilter(){
  rmRefreshSummary();
  const q = (rmState.filter.q||'').trim().toLowerCase();
  const sF = rmState.filter.status||'';
  const tF = rmState.filter.type||'';
  const card = rmState.filter.card;
  let list = [...store.groups];
  // [v0.2 M-05] 비활성 자원은 기본 리스트에서 제외. '비활성' 상태 필터를 명시 선택한 경우에만 노출
  if(sF !== 'inactive'){
    list = list.filter(g => g.status !== 'inactive');
  }
  // 운영이상 카드
  if(card==='risk'){
    list = list.filter(g=>rmHealth(g)!=='normal');
  }
  // 시험 대기 카드: 시험 대상이면서 합격 전인 그룹만
  if(card==='trial'){
    list = list.filter(g=>g.trial && g.trial.required && g.trial.status!=='PASSED');
  }
  if(sF) list = list.filter(g=>g.status===sF);
  // [v0.2 M-03] 자원 유형 필터: 세분화 코드(typeCode) 기준. 코드가 없는 seed는 label→code 유추
  if(tF) list = list.filter(g => rmTypeCode(g) === tF);
  if(q)  list = list.filter(g=>g.name.toLowerCase().includes(q));
  rmRenderGroupList(list);
  $('rm-group-count').textContent = `총 ${list.length}개 자원그룹`;
  const totalCust = list.reduce((s,g)=>s+rmGroupCustomerCount(g), 0);
  $('rm-footer-count').textContent = `총 ${list.length}개 자원그룹 · ${totalCust}명 참여고객`;
  rmUpdateBulkBtn();
}

function rmRunSearch(){
  rmState.filter.q = $('rm-search')?.value || '';
  rmState.filter.status = $('rm-status-filter')?.value || '';
  rmState.filter.type = $('rm-type-filter')?.value || '';
  rmApplyFilter();
}

function rmResetFilters(){
  if($('rm-search')) $('rm-search').value = '';
  if($('rm-status-filter')) $('rm-status-filter').value = '';
  if($('rm-type-filter')) $('rm-type-filter').value = '';
  rmState.filter.q = '';
  rmState.filter.status = '';
  rmState.filter.type = '';
  rmState.filter.card = 'all';
  ['rm-card-all','rm-card-trial','rm-card-risk'].forEach(id=>$(id)?.classList.remove('active'));
  $('rm-card-all')?.classList.add('active');
  rmApplyFilter();
}

function rmRenderGroupList(list){
  const container = $('rm-group-list');
  if(!list.length){
    container.innerHTML = `<div class="empty-state">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      조건에 맞는 자원그룹이 없습니다.
    </div>`;
    return;
  }
  container.innerHTML = list.map(g=>{
    const cnt = rmGroupCustomerCount(g);
    const cap = rmGroupCapacityTotal(g);
    // 데이터 수집 상태 셀 (운영 상태와 분리)
    const dcStatus = g.operational?.dataCollection?.status || null;
    const dcMap = {
      NORMAL:  {cls:'dc-normal',  label:'정상'},
      DELAYED: {cls:'dc-delayed', label:'지연'},
      FAILED:  {cls:'dc-failed',  label:'이상'},
    };
    const dcMeta = dcStatus ? dcMap[dcStatus] : {cls:'dc-none', label:'미수집'};
    const dcChip = `<span class="dc-chip ${dcMeta.cls}" title="데이터 수집: ${dcMeta.label}"><span class="dc-led"></span>${dcMeta.label}</span>`;
    // [Phase 17-CY] 상태 + 등록시험 두 컬럼 → 운영 상태 하나로 통합
    //   등록불합격(trial.status=FAILED)은 이동 경로 없이 리스트에 계속 표기
    const opMeta = operationalStatusMeta(g);
    const opCell = `<span class="badge ${opMeta.cls}" style="font-size:11px;">${opMeta.label}</span>`;
    return `<div class="group-row">
      <div class="group-header">
        <span style="display:flex;align-items:center;justify-content:center;">
          <input type="checkbox" data-gid="${g.id}" onchange="rmToggleBulk(${g.id},this.checked)" style="width:14px;height:14px;accent-color:var(--blue);">
        </span>
        <span onclick="rmOpenDetail(${g.id})" style="cursor:pointer;">
          <span class="group-name">${g.name}</span>
        </span>
        <span onclick="rmOpenDetail(${g.id})" style="cursor:pointer;"><span class="badge badge-gray">${g.type}</span></span>
        <span onclick="rmOpenDetail(${g.id})" style="cursor:pointer;text-align:center;">${dcChip}</span>
        <span onclick="rmOpenDetail(${g.id})" style="cursor:pointer;">${opCell}</span>
        <span onclick="rmOpenDetail(${g.id})" style="cursor:pointer;color:var(--text-sub);font-size:11px;">${g.date}</span>
        <span onclick="rmOpenDetail(${g.id})" style="cursor:pointer;font-weight:500;">${cnt}명</span>
        <span onclick="rmOpenDetail(${g.id})" style="cursor:pointer;font-weight:600;color:var(--blue);">${cap.toLocaleString()}</span>
        <span style="text-align:center;">
          <button class="btn btn-primary btn-sm" onclick="rmOpenDetail(${g.id})">상세</button>
        </span>
      </div>
    </div>`;
  }).join('');
}

function rmToggleCheckAll(cb){
  document.querySelectorAll('#rm-group-list input[type=checkbox]').forEach(c=>{
    c.checked = cb.checked;
    const gid = parseInt(c.dataset.gid);
    if(cb.checked) rmState.bulkSelected.add(gid);
    else rmState.bulkSelected.delete(gid);
  });
  rmUpdateBulkBtn();
}
function rmToggleBulk(gid, checked){
  if(checked) rmState.bulkSelected.add(gid);
  else rmState.bulkSelected.delete(gid);
  rmUpdateBulkBtn();
}
function rmUpdateBulkBtn(){
  const empty = rmState.bulkSelected.size===0;
  const btn = $('rm-btn-bulk-delete');
  if(btn) btn.disabled = empty;
  const hard = $('rm-btn-bulk-delete-hard');
  if(hard) hard.disabled = empty;
}

/* 자원그룹 생성 */
function rmOpenCreate(){
  $('rm-f-name').value='';
  $('rm-f-type').value='';
  ['rm-f-standard','rm-f-national','rm-f-jeju','rm-f-freq','rm-f-plus','rm-dyn-fields']
    .forEach(id=>$(id).classList.add('field-hidden'));
  document.querySelectorAll('#rmCreateModal input[type=radio]').forEach(r=>r.checked=false);
  document.querySelectorAll('#rmCreateModal input[type=checkbox]').forEach(c=>c.checked=false);
  // 시험 대상 섹션은 자원 유형 선택 전까지 숨김
  $('rm-f-trial-section').style.display = 'none';
  $('rm-f-trial-required').checked = true;  // 기본값: 체크 (표준/중소형/제주 가정)
  openModal('rmCreateModal');
}
function rmOnTypeChange(val){
  ['rm-f-standard','rm-f-national','rm-f-jeju','rm-f-freq','rm-f-plus']
    .forEach(id=>$(id).classList.add('field-hidden'));
  if(!val){ $('rm-dyn-fields').classList.add('field-hidden'); $('rm-f-trial-section').style.display='none'; return; }
  $('rm-dyn-fields').classList.remove('field-hidden');
  const stdTypes = ['standard','h_standard','small','small_ev','h_small','h_small_ev'];
  if(stdTypes.includes(val)) $('rm-f-standard').classList.remove('field-hidden');
  else if(val==='national') $('rm-f-national').classList.remove('field-hidden');
  else if(['jeju','h_jeju','jeju_ev','h_jeju_ev'].includes(val)) $('rm-f-jeju').classList.remove('field-hidden');
  else if(val==='freq') $('rm-f-freq').classList.remove('field-hidden');
  else if(val==='plus') $('rm-f-plus').classList.remove('field-hidden');
  // 등록시험 섹션: 국민DR/주파수DR/플러스DR은 면제이므로 숨김
  //                 표준/중소형/제주DR은 시험 대상이라 섹션 노출 + 기본 체크
  const typeKey = stdTypes.includes(val) ? 'standard'
                : val==='national' ? 'national'
                : ['jeju','h_jeju','jeju_ev','h_jeju_ev'].includes(val) ? 'jeju'
                : val==='freq' ? 'freq' : val==='plus' ? 'plus' : null;
  if(trialRequiredForType(typeKey)){
    $('rm-f-trial-section').style.display = '';
    $('rm-f-trial-required').checked = true;
  } else {
    $('rm-f-trial-section').style.display = 'none';
    $('rm-f-trial-required').checked = false;
  }
}
function rmHandleCreate(){
  const name = $('rm-f-name').value.trim();
  const typeVal = $('rm-f-type').value;
  if(!name||!typeVal){ showToast('자원그룹명과 자원 종류를 입력하세요.'); return; }
  const typeMap = {
    'standard':      {type:'표준DR',          typeKey:'standard'},
    'h_standard':    {type:'H-표준DR',        typeKey:'standard'},
    'small':         {type:'중소형DR',        typeKey:'standard'},
    'small_ev':      {type:'중소형DR-충전EV',    typeKey:'standard'},
    'h_small':       {type:'H-중소형DR',      typeKey:'standard'},
    'h_small_ev':    {type:'H-중소형DR(EV)',  typeKey:'standard'},
    'national':      {type:'국민DR',          typeKey:'national'},
    'jeju':          {type:'제주DR',          typeKey:'jeju'},
    'h_jeju':        {type:'H-제주DR',        typeKey:'jeju'},
    'jeju_ev':       {type:'제주DR(EV)',      typeKey:'jeju'},
    'h_jeju_ev':     {type:'H-제주DR(EV)',    typeKey:'jeju'},
    'freq':          {type:'주파수DR',        typeKey:'freq'},
    'plus':          {type:'플러스DR',        typeKey:'plus'},
  };
  const meta = typeMap[typeVal];
  const reg = {};
  if(meta.typeKey==='standard'){
    const region = document.querySelector('input[name="rm-std-region"]:checked')?.value;
    const cap = parseInt($('rm-f-std-cap').value);
    if(!region||!cap){ showToast('지역구분과 의무감축용량을 입력하세요.'); return; }
    reg.region = region; reg.mandatoryCapacity = cap;
  } else if(meta.typeKey==='national'){
    const region = document.querySelector('input[name="rm-nat-region"]:checked')?.value;
    if(!region){ showToast('지역구분을 선택하세요.'); return; }
    reg.region = region;
  } else if(meta.typeKey==='jeju'){
    const cap = parseInt($('rm-f-jeju-cap').value);
    if(!cap){ showToast('의무감축용량을 입력하세요.'); return; }
    reg.region = '제주권'; reg.mandatoryCapacity = cap;
  } else if(meta.typeKey==='freq'){
    const s1 = document.querySelector('input[name="rm-freq-s1"]:checked')?.value;
    const s2 = document.querySelector('input[name="rm-freq-s2"]:checked')?.value;
    const m = document.querySelector('input[name="rm-freq-m"]:checked')?.value;
    const cap = parseInt($('rm-f-freq-cap').value);
    if(!s1||!s2||!m||!cap){ showToast('주파수DR 필수 항목을 모두 입력하세요.'); return; }
    reg.region='육지권'; reg.freqStep1=s1; reg.freqStep2=s2; reg.meterType=m; reg.estimatedCapacity=cap;
  } else if(meta.typeKey==='plus'){
    // 플러스DR: 지역구분만 입력. 의무증대량 없음 (정책서 3-1)
    const region = document.querySelector('input[name="rm-plus-region"]:checked')?.value;
    if(!region){ showToast('지역구분을 선택하세요.'); return; }
    reg.region = region;
  }
  const newId = Math.max(...store.groups.map(g=>g.id), 0) + 1;
  // 등록시험 대상 여부: 모달 체크박스 값 사용 (단, typeKey가 trial 대상이 아닐 땐 강제 false)
  const trialCheckboxOn = $('rm-f-trial-required').checked;
  const trialRequired = trialRequiredForType(meta.typeKey) && trialCheckboxOn;
  const trial = {
    required: trialRequired,
    status: trialRequired ? 'WAITING' : 'NOT_REQUIRED',
    history: [],
  };
  // [Phase 17-EA] v0.2 M-02: 신규 자원은 승인대기(pending)로 시작
  //   pending → (참여고객 매핑 완료) → waiting(시험대기) → active(활성)
  store.groups.push({
    id:newId, name, type:meta.type, typeKey:meta.typeKey, typeCode:typeVal,
    status:'pending', date:todayStr(), reg, file:null, customerIds:[],
    trial,
  });
  closeModal('rmCreateModal');
  rmApplyFilter();
  refreshSidebarBadges();
  showToast(`${name} 생성 완료 (승인대기)`);
}

/* 상세 패널 */
function rmOpenDetail(gid, tab){
  rmState.selectedGroupId = gid;
  if(tab) rmState.detailTab = tab;
  const g = groupById(gid); if(!g) return;
  $('rm-d-title').textContent = g.name;
  $('rm-d-sub').textContent = `${g.type} · ${statusLabelRM(g.status)}`;
  const isWait = g.status==='waiting';
  const histCnt = g.reductionHistory? g.reductionHistory.length:0;
  const custCnt = rmGroupCustomerCount(g);
  const h = rmHealth(g);
  const healthDot = h==='risk'?'<span class="dot dot-red" style="margin-left:4px;"></span>':
                   h==='warn'?'<span class="dot dot-amber" style="margin-left:4px;"></span>':'';
  const tabs = [
    {k:'info',      label:'기본정보',  suf:''},
    {k:'op',        label:'가동상태',  suf:healthDot, dis:isWait},
    {k:'trial',     label:'등록시험',  suf:(()=>{
      if(!g.trial || !g.trial.required) return '<span class="tab-badge" style="background:var(--gray);font-size:9px;">미대상</span>';
      const tm = trialStatusMeta(g.trial);
      const color = g.trial.status==='PASSED'?'var(--green)':g.trial.status==='FAILED'?'var(--red)':'var(--amber)';
      return `<span class="tab-badge" style="background:${color};font-size:9px;">${tm.label}</span>`;
    })()},
    {k:'history',   label:'감축이력',  suf:histCnt?`<span class="tab-badge" style="background:var(--gray);">${histCnt}</span>`:'', dis:isWait},
    {k:'customers', label:'참여고객',  suf:custCnt?`<span class="tab-badge">${custCnt}</span>`:'', dis:false},
  ];
  $('rm-d-tabs').innerHTML = tabs.map(t=>`
    <div class="tab ${rmState.detailTab===t.k?'active':''} ${t.dis?'locked':''}" 
         style="${t.dis?'opacity:0.4;cursor:not-allowed;':''}"
         onclick="${t.dis?'':`rmSwitchDetailTab('${t.k}')`}">${t.label}${t.suf}</div>`).join('');
  rmRenderDetailBody(g);
  rmRenderDetailFooter(g);
  $('rmDetailPanel').classList.add('open');
}
function rmCloseDetail(){ $('rmDetailPanel').classList.remove('open'); rmState.selectedGroupId=null; }
function rmSwitchDetailTab(tab){
  rmState.detailTab = tab;
  rmOpenDetail(rmState.selectedGroupId);
}

function rmRenderDetailBody(g){
  const tab = rmState.detailTab;
  const body = $('rm-d-body');
  if(tab==='info')      body.innerHTML = rmTabInfoHtml(g);
  else if(tab==='op')   body.innerHTML = rmTabOpHtml(g);
  else if(tab==='trial') body.innerHTML = rmTabTrialHtml(g);
  else if(tab==='history') body.innerHTML = rmTabHistoryHtml(g);
  else if(tab==='customers') body.innerHTML = rmTabCustomersHtml(g);
}
function rmTabInfoHtml(g){
  const r = g.reg||{};
  const extra = (()=>{
    if(g.typeKey==='standard') return `
      <div class="detail-field"><div class="detail-field-label">지역구분</div><div class="detail-field-val">${r.region||'-'}</div></div>
      <div class="detail-field"><div class="detail-field-label">의무감축용량</div><div class="detail-field-val blue">${r.mandatoryCapacity?r.mandatoryCapacity.toLocaleString()+' kW':'-'}</div></div>`;
    if(g.typeKey==='national') return `<div class="detail-field full"><div class="detail-field-label">지역구분</div><div class="detail-field-val">${r.region||'-'}</div></div>`;
    if(g.typeKey==='jeju') return `
      <div class="detail-field"><div class="detail-field-label">지역구분</div><div class="detail-field-val">${r.region||'제주권'}</div></div>
      <div class="detail-field"><div class="detail-field-label">의무감축용량</div><div class="detail-field-val blue">${r.mandatoryCapacity?r.mandatoryCapacity.toLocaleString()+' kW':'-'}</div></div>`;
    if(g.typeKey==='freq') return `
      <div class="detail-field"><div class="detail-field-label">지역구분</div><div class="detail-field-val">${r.region||'-'}</div></div>
      <div class="detail-field"><div class="detail-field-label">계량 방식</div><div class="detail-field-val">${r.meterType||'-'}</div></div>
      <div class="detail-field"><div class="detail-field-label">기준주파수(개별)</div><div class="detail-field-val">${r.freqStep1||'-'}</div></div>
      <div class="detail-field"><div class="detail-field-label">기준주파수(양수)</div><div class="detail-field-val">${r.freqStep2||'-'}</div></div>
      <div class="detail-field full"><div class="detail-field-label">감축예상용량</div><div class="detail-field-val blue">${r.estimatedCapacity?r.estimatedCapacity.toLocaleString()+' kW':'-'}</div></div>`;
    if(g.typeKey==='plus') return `<div class="detail-field full"><div class="detail-field-label">지역구분</div><div class="detail-field-val">${r.region||'-'}</div></div>`;
    return '';
  })();
  // [Phase 17-CJ] 서류 업로드 영역 확장 — 등록신청서 + 추가 서류 여러 개
  if(!Array.isArray(g.docs)) g.docs = [];
  const regFileRow = g.file
    ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid var(--green-border);background:var(--green-light);border-radius:var(--r);">
         <div style="flex:1;min-width:0;">
           <div style="font-size:12px;color:var(--green);font-weight:600;">📄 등록신청서 <span style="font-size:10px;color:var(--text-hint);font-weight:400;margin-left:6px;">필수</span></div>
           <div style="font-size:12px;color:var(--text-sub);margin-top:4px;">${g.file.name}</div>
           <div style="font-size:11px;color:var(--text-hint);margin-top:2px;">${g.file.uploadedAt}</div>
         </div>
         <button class="btn btn-secondary btn-sm" onclick="rmUploadFile()">변경</button>
       </div>`
    : `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px dashed var(--amber-border);background:var(--amber-light);border-radius:var(--r);">
         <div style="flex:1;">
           <div style="font-size:12px;color:var(--amber);font-weight:600;">📄 등록신청서 <span style="font-size:10px;color:var(--text-hint);font-weight:400;margin-left:6px;">필수 · 미업로드</span></div>
         </div>
         <button class="btn btn-primary btn-sm" onclick="rmUploadFile()">파일 업로드</button>
       </div>`;
  const extraDocRows = g.docs.map(d => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid var(--border);background:#fff;border-radius:var(--r);">
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;color:var(--navy);font-weight:600;">📄 ${d.label || d.name}</div>
        <div style="font-size:12px;color:var(--text-sub);margin-top:4px;">${d.name}</div>
        <div style="font-size:11px;color:var(--text-hint);margin-top:2px;">${d.uploadedAt || ''}</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-secondary btn-sm" onclick="rmUpdateExtraDoc('${g.id}','${d.id}')">변경</button>
        <button class="btn btn-danger btn-sm" onclick="rmRemoveExtraDoc('${g.id}','${d.id}')">삭제</button>
      </div>
    </div>
  `).join('');
  const fileBox = `
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${regFileRow}
      ${extraDocRows}
      <button class="btn btn-secondary btn-sm" onclick="rmAddExtraDoc('${g.id}')" style="align-self:flex-start;margin-top:4px;">+ 추가 서류 업로드</button>
    </div>`;

  const suspendBox = g.status==='suspended' && g.suspendReason
    ? `<div style="background:var(--gray-light);border:1px solid var(--border-dark);border-radius:var(--radius);padding:12px 14px;margin-top:12px;">
         <div style="font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">일시중지 상태</div>
         <div style="font-size:11px;color:var(--text-sub);">사유: ${g.suspendReason.type}${g.suspendReason.detail?' — '+g.suspendReason.detail:''}</div>
         <div style="font-size:10px;color:var(--text-hint);margin-top:2px;">${g.suspendReason.at}</div>
       </div>`
    : '';
  // 운영 상태 뱃지만 표시. 상태 전환은 하단 액션 버튼(rmRenderDetailFooter)에서만 실행한다
  const opMeta = operationalStatusMeta(g);
  const statusCard = `
  <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--g-50);border:1px solid var(--border);border-radius:var(--r);margin-bottom:14px;">
    <span style="font-size:12px;color:var(--text-sub);font-weight:500;">운영 상태</span>
    <span class="badge ${opMeta.cls}" style="font-size:12px;padding:4px 10px;">${opMeta.label}</span>
  </div>`;

  return `${statusCard}
  <div class="detail-field-grid">
    <div class="detail-field"><div class="detail-field-label">자원유형</div><div class="detail-field-val">${g.type}</div></div>
    ${extra}
    <div class="detail-field"><div class="detail-field-label">참여고객</div><div class="detail-field-val">${rmGroupCustomerCount(g)}명</div></div>
    <div class="detail-field"><div class="detail-field-label">참여용량</div><div class="detail-field-val blue">${rmGroupCapacityTotal(g).toLocaleString()} kW</div></div>
    <div class="detail-field"><div class="detail-field-label">등록일</div><div class="detail-field-val">${g.date}</div></div>
  </div>
  <div style="font-size:12px;font-weight:600;color:var(--text-sub);margin-bottom:8px;">등록 신청서</div>
  ${fileBox}
  ${suspendBox}`;
}

function rmTabOpHtml(g){
  if(!g.operational) return '<div class="empty">가동 데이터가 없습니다.</div>';
  const dc = g.operational.dataCollection;
  const cds = g.operational.custDataStatus || {};
  const custIds = g.customerIds || [];
  const totalCust = custIds.length;

  // 수신 상태별 고객 분류 (custDataStatus 기반의 파생값 — 단일 원천)
  const failedList = [];
  const delayedList = [];
  const normalList = [];
  custIds.forEach(cid=>{
    const c = custById(cid); if(!c) return;
    const s = cds[cid]?.status || 'NORMAL';
    const mins = cds[cid]?.lastMinutesAgo ?? dc.lastMinutesAgo;
    const rec = {cid, name:c.name, recno:c.recno, mins};
    if(s==='FAILED') failedList.push(rec);
    else if(s==='DELAYED') delayedList.push(rec);
    else normalList.push(rec);
  });

  // 수집 상태 라벨
  const colStatus = {
    NORMAL:['정상','good',''],
    DELAYED:['지연','warn',''],
    FAILED:['수집실패','bad',''],
    PARTIAL:['일부수집','warn',''],
  }[dc.status] || ['-','good',''];

  // [Phase 17-N] 미니멀 데이터 수집 카드 — 상태 한 줄 + 진입점만.
  // 사업장별 미수신·재조회·수동 업로드 등 깊은 진단은 모두 전력데이터 수집현황 페이지 책임.
  // 미수신 명단 카드(missingCard)도 제거 (전력데이터 수집현황으로 일원화).
  const isAbnormal = dc.status !== 'NORMAL';
  const statusText = colStatus[0];
  const statusColor = colStatus[1] === 'good' ? 'var(--green)' : colStatus[1] === 'warn' ? 'var(--amber)' : 'var(--red)';
  const collectCard = `<div class="op-card ${isAbnormal ? 'op-card-alert danger' : ''}">
    <div style="padding:14px 16px;display:flex;align-items:center;gap:12px;">
      <div style="width:10px;height:10px;border-radius:50%;background:${statusColor};flex-shrink:0;"></div>
      <div style="flex:1;">
        <div style="font-size:12px;color:var(--text-hint);font-weight:500;">데이터 수집 상태</div>
        <div style="font-size:14px;font-weight:700;color:${statusColor};margin-top:2px;">${statusText}</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="rmGoToDataCollect(${g.id})">전력데이터 수집현황 →</button>
    </div>
  </div>`;

  // 현재 라이브 이벤트 카드 (조건부) — 병행 이벤트가 있으면 모두 표시 (설계서 §8.1)
  let liveEventCard = '';
  const liveCtxList = rmGroupCurrentLiveEvents(g);
  if(liveCtxList.length > 0){
    const isParallel = liveCtxList.length > 1;
    // [Phase 17-BN] 병행 이벤트 안내 배너 제거 — 이벤트 목록으로 자명
    const parallelBanner = '';
    const eventBlocks = liveCtxList.map(({event:ev, resource:r})=>{
      const rate = r.actual!=null && r.ordered>0 ? r.actual/r.ordered : null;
      const rateColor = rate==null?'var(--text-hint)':rate>=0.9?'var(--green)':rate>=0.7?'var(--amber)':'var(--red)';
      const rateLabel = rate==null?'—':`${Math.round(rate*100)}%`;
      const dm = dispatchTypeMeta(ev.dispatch_type);
      const monTabKey = dm.direction==='increase' ? 'plus' : 'reduction';
      const directionWord = dm.direction==='increase' ? '증대' : '감축';
      const noTarget = ev.dispatch_type==='REALTIME_INCREASE_REQUEST'; // [Phase 17-EZ] 실시간 증대요청: 목표량·이행률 없음
      return `<div class="op-live-event-block">
        <div style="padding:10px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="badge ${dm.badge}" style="font-size:10px;">${dm.label}</span>
          <span style="font-size:12px;color:var(--text-sub);">${ev.label}</span>
          ${ev.remainingMinutes!=null?`<span style="font-size:11px;color:var(--text-hint);margin-left:auto;">잔여 <b>${ev.remainingMinutes}분</b></span>`:''}
        </div>
        <div class="op-metric op-metric-3">
          <div class="op-metric-item">
            <div class="op-metric-lbl">${noTarget?'목표 증대량':dm.direction==='increase'?'계획 증대량':'지시용량'}</div>
            <div class="op-metric-val">${r.ordered!=null ? `${r.ordered.toLocaleString()} kW` : '—'}</div>
          </div>
          <div class="op-metric-item">
            <div class="op-metric-lbl">현재 실적</div>
            <div class="op-metric-val" style="color:${rateColor};">${r.actual!=null?r.actual.toLocaleString()+' kW':'—'}</div>
          </div>
          <div class="op-metric-item">
            <div class="op-metric-lbl">실시간 이행률</div>
            <div class="op-metric-val" style="color:${rateColor};" ${noTarget?'title="실시간 증대요청 · 이행량 기준 없음"':''}>${rateLabel}</div>
          </div>
        </div>
        <div style="padding:6px 14px 10px;">
          <button class="btn btn-primary btn-sm" onclick="monOpenEvent('${monTabKey}','${ev.id}',${g.id});">
            감축 모니터링에서 상세 보기 →
          </button>
        </div>
      </div>`;
    }).join('<div style="height:1px;background:var(--border);margin:0 14px;"></div>');
    liveEventCard = `<div class="op-card op-card-live">
      <div class="op-card-title">
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <span class="dot dot-red"></span>
          <span>${isParallel?'이벤트 진행 중 (병행)':'이벤트 진행 중'}</span>
          <span class="badge badge-fail" style="font-size:10px;">LIVE</span>
        </span>
      </div>
      ${parallelBanner}
      ${eventBlocks}
    </div>`;
  } else {
    // 이벤트가 없을 때: 이행률을 표시할 근거가 없으므로, 과거 이력 참조 안내만 표시
    const historyCount = g.reductionHistory?.length || 0;
    liveEventCard = `<div class="op-card op-card-idle">
      <div class="op-card-title">감축 이벤트 상태</div>
      <div class="op-idle">
        <div class="op-idle-main">진행 중인 감축 이벤트 없음</div>
        ${historyCount>0 ? `<button class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="rmSwitchDetailTab('history')">감축이력 보기 →</button>` : ''}
      </div>
    </div>`;
  }

  // [Phase 17-N] missingCard 제거 — 수신 이상 고객 명단은 전력데이터 수집현황 책임으로 일원화
  return collectCard + liveEventCard;
}

/* 자원 상세 [전력데이터 수집현황 →] 클릭 → 해당 자원그룹의 데이터 수집 상세 페이지로 바로 점프.
   [Phase 17-O] 옛: 데이터 수집 목록뷰로 이동 후 운영자가 다시 클릭
   새: 자원그룹 상세뷰(dcOpenDetail)로 한 번에 이동 — 한 단계 줄임. */
function rmGoToDataCollect(gid){
  // 자원관리 상세 패널 닫기
  const panel = document.getElementById('rmDetailPanel');
  if(panel) panel.classList.remove('open');
  // datacollect 페이지의 자원그룹 필터도 미리 세팅 (목록뷰 fallback 대비)
  if(typeof dcState !== 'undefined') dcState.groupId = String(gid);
  // 페이지 이동 (dcInit이 자동 호출 → 목록뷰 렌더)
  navigate('datacollect');
  // 다음 tick에 자원그룹 상세뷰로 전환 (navigate의 closeTransientUi + dcInit 끝난 후 안전 호출)
  setTimeout(()=>{
    if(typeof dcOpenDetail === 'function') dcOpenDetail(gid);
  }, 0);
}

/* ═══ 등록시험 탭 ═══ */
function rmTabTrialHtml(g){
  // 면제 대상
  if(!g.trial || !g.trial.required){
    return `<div class="op-card">
      <div style="padding:14px 16px;font-size:12px;color:var(--text-sub);">등록시험 미대상 자원입니다.</div>
    </div>`;
  }
  // 시험 대상
  const tm = trialStatusMeta(g.trial);
  const history = g.trial.history || [];
  const attempts = history.length;

  const summaryCard = `<div class="op-card">
    <div class="op-card-title">등록시험 현황</div>
    <div class="op-metric op-metric-1">
      <div class="op-metric-item">
        <div class="op-metric-lbl">시험 대상</div>
        <div class="op-metric-val" style="font-size:13px;">${g.type}</div>
      </div>
    </div>
  </div>`;

  // 상태별 운영자 안내·액션
  let actionCard = '';
  if(g.trial.status==='WAITING'){
    // 시험 대기 — 통보 전/수신 후/진행 중 모두 자동 처리 상태
    const testEventId = g.trial.currentTestEventId;
    const ev = testEventId ? store.events.reduction.find(e=>e.id===testEventId) : null;
    const eventInfoRow = ev
      ? `<div class="trial-info-row">
          <span class="trial-info-lbl">시험 이벤트</span>
          <span class="trial-info-val">${eventDisplayName(ev)}</span>
        </div>
        <div class="trial-info-row">
          <span class="trial-info-lbl">시험 시간대</span>
          <span class="trial-info-val">${eventDisplaySub(ev)}${ev.remainingMinutes!=null?` <span style="color:var(--amber);font-weight:600;">(잔여 ${ev.remainingMinutes}분)</span>`:''}</span>
        </div>`
      : `<div class="trial-info-row">
          <span class="trial-info-lbl">수신 상태</span>
          <span class="trial-info-val" style="color:var(--text-hint);">KPX 시험 이벤트 미수신</span>
        </div>`;
    actionCard = `<div class="op-card">
      <div class="op-card-title">KPX 등록시험 대기</div>
      <div style="padding:12px 14px;">
        <div class="trial-info-grid">${eventInfoRow}</div>
        <div style="margin-top:10px;">
          ${testEventId
            ? `<button class="btn btn-primary btn-sm" onclick="rmGoToMonitoringEvent('${testEventId}')">감축 모니터링에서 이 시험 보기 →</button>`
            : `<button class="btn btn-secondary btn-sm" onclick="rmGoToMonitoringTest()">감축 모니터링 시험 이벤트 목록 →</button>`}
        </div>
      </div>
    </div>`;
  } else if(g.trial.status==='FAILED'){
    // 불합격 → 일시중지 전환만 제공. 등록시험은 재시험 제도가 없다 (정책서 3-7)
    actionCard = `<div class="op-card op-card-risk">
      <div class="op-card-title" style="color:var(--red);">운영자 판단 필요</div>
      <div style="padding:12px 14px;">
        <div class="trial-decision-grid">
          <button class="trial-decision-btn danger" onclick="rmSuspend(${g.id})">
            <div class="trial-decision-title">일시중지 전환</div>
            <div class="trial-decision-desc">사유: 등록시험 불합격</div>
          </button>
        </div>
      </div>
    </div>`;
  } else if(g.trial.status==='PASSED'){
    // 합격 — 운영자가 할 일: waiting 상태면 활성 전환, active면 카드 불필요
    // (판정 기준·이행률·이벤트는 상단 요약 카드 + 하단 시험 이력 테이블에 이미 표시됨)
    // 합격 후 활성 전환은 하단 액션 버튼에서 실행 — 별도 안내 카드 없음
  }

  // 이력 테이블 — 운영 이벤트 클릭 시 이행검증(RPT-01)에서 해당 시험 이벤트 상세로 이동
  const historyCard = `<div class="op-card">
    <div class="op-card-title">시험 이력 (${attempts}회)</div>
    ${attempts===0
      ? '<div class="empty" style="padding:30px 20px;">시험 이력이 없습니다.</div>'
      : `<div class="trial-list">
        <div class="trial-row trial-row-head">
          <span>시험 결과</span>
          <span>시험일</span>
          <span>운영 이벤트</span>
          <span style="text-align:right;">이행률</span>
          <span style="text-align:center;">등록 판정</span>
        </div>
        ${history.map(h=>{
          const isPass = h.result==='PASS';
          const r = h.performanceRate;
          // 3구간 색상: 97%↑ 녹색 / 80~97% amber / 80%↓ 빨강
          const rateColor = r>=0.97 ? 'var(--green)' : r>=0.80 ? 'var(--amber)' : 'var(--red)';
          // 판정 라벨: 규칙상 "정상 등록 / 용량 조정 / 참여 제한" 3분류
          let verdictLabel, verdictBadge;
          if(r>=0.97){ verdictLabel='정상 등록'; verdictBadge='badge-done'; }
          else if(r>=0.80){ verdictLabel='용량 조정'; verdictBadge='badge-pending'; }
          else { verdictLabel='참여 제한'; verdictBadge='badge-fail'; }
          const evIdCell = (h.testEventId && h.testEventId!=='—')
            ? `<span class="trial-event-link" style="font-size:10px;color:var(--blue);cursor:pointer;text-decoration:underline;" onclick="rpOpenEventExternal('${h.testEventId}')" title="이행검증에서 상세 보기">${(()=>{ const tev = (store.events?.reduction||[]).find(e=>e.id===h.testEventId); return tev ? `${eventDisplayName(tev)}<span style="display:block;color:var(--text-hint);font-family:monospace;">${h.testEventId}</span>` : h.testEventId; })()}</span>`
            : `<span class="trial-event-link" style="font-size:10px;color:var(--text-hint);">—</span>`;
          return `<div class="trial-row">
            <span><span class="badge ${isPass?'badge-done':'badge-fail'}" style="font-size:10px;">${isPass?'합격':'불합격'}</span></span>
            <span class="hist-date">${h.testDate}</span>
            ${evIdCell}
            <span style="text-align:right;font-weight:700;color:${rateColor};">${Math.round(r*100)}%</span>
            <span style="text-align:center;"><span class="badge ${verdictBadge}" style="font-size:10px;" title="${isPass?'PASS':'FAIL'}">${verdictLabel}</span></span>
          </div>`;
        }).join('')}
      </div>`}
  </div>`;

  return summaryCard + actionCard + historyCard;
}

/* 감축 모니터링으로 이동 (등록시험 카테고리 자동 선택) */
function rmGoToMonitoringTest(){
  navigate('monitoring');
  setTimeout(()=>{
    monState.eventType = 'reduction';
    monState.status = 'all';
    monState.category = 'test';
    monSwitchCategory('test');
  }, 120);
}

/* 감축 모니터링에서 특정 시험 이벤트 열기 */
function rmGoToMonitoringEvent(eventId){
  navigate('monitoring');
  setTimeout(()=>{
    monState.eventType = 'reduction';
    monState.status = 'all';
    monState.category = 'test';
    monSwitchCategory('test');
    setTimeout(()=>{
      const evs = store.events.reduction.filter(e=>e.category==='test');
      if(evs.find(e=>e.id===eventId)){
        monState.currentEventId = eventId;
        monRender();
      }
    }, 50);
  }, 120);
}

function rmTabHistoryHtml(g){
  if(!g.reductionHistory?.length) return '<div class="empty">감축이력이 없습니다.</div>';
  return `<div class="hist-list">
    <div class="hist-row" style="background:#f8f9fc;font-weight:500;color:var(--text-sub);font-size:10px;cursor:default;">
      <span>일시</span><span>유형</span><span style="text-align:right;">지시/실적</span><span style="text-align:right;">이행률</span><span style="text-align:center;">정산</span>
    </div>
    ${g.reductionHistory.map(h=>{
      const rate = h.performanceRate;
      const rateCls = rate>=0.9?'good':rate>=0.7?'mid':'bad';
      const rateColor = rate>=0.9?'var(--green)':rate>=0.7?'var(--amber)':'var(--red)';
      return `<div class="hist-row">
        <span class="hist-date">${h.date}</span>
        <span><span class="badge ${h.type==='mandatory'?'badge-progress':'badge-purple'}">${h.type==='mandatory'?'의무':'계획'}</span></span>
        <span style="text-align:right;font-size:11px;">
          <div style="color:var(--text);font-weight:500;">${h.orderedKw.toLocaleString()} / ${h.reducedKw.toLocaleString()}</div>
        </span>
        <span class="hist-rate" style="color:${rateColor};">${Math.round(rate*100)}%</span>
        <span style="text-align:center;"><span class="badge ${h.settlement==='COMPLETE'?'badge-done':'badge-pending'}" style="font-size:9px;">${h.settlement==='COMPLETE'?'완료':'대기'}</span></span>
      </div>`;
    }).join('')}
  </div>`;
}
function rmTabCustomersHtml(g){
  const cust = (g.customerIds||[]).map(id=>custById(id)).filter(Boolean);
  // [v0.2 M-07] 참여고객 편입·삭제는 승인대기(pending) 상태에서만 활성화
  // 시험대기·활성·일시중지·비활성 상태에서는 매핑 잠금 (구성 확정 이후 변경 불가)
  const canMap = g.status==='pending';
  const statusLabel = statusLabelRM(g.status);
  // 비활성 자원만 사유 표시. 그 외 상태 안내문은 두지 않는다
  const statusHint = g.status==='inactive'
    ? `<div style="font-size:11px;color:var(--text-hint);padding:8px 14px;background:var(--bg);border-radius:var(--radius);margin-bottom:10px;line-height:1.6;">비활성 사유: ${g.deactivateReason||'-'}${g.deactivateNote?` / ${g.deactivateNote}`:''}${g.deactivatedAt?` · ${g.deactivatedAt}`:''}</div>`
    : '';

  if(!cust.length){
    if(canMap){
      return `${statusHint}<div class="empty">매핑된 참여고객이 없습니다.<div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="rmOpenMapping(${g.id})">+ 고객 매핑</button></div></div>`;
    }
    return `${statusHint}<div class="empty">참여고객이 없습니다. (${statusLabel})</div>`;
  }
  return `${statusHint}<div class="cust-mini-head">
    <span>고객명</span><span style="text-align:right;">유형</span><span style="text-align:right;">용량 (kW)</span><span style="text-align:center;">상태</span><span style="text-align:center;">-</span>
  </div>
  ${cust.map(c=>`<div class="cust-mini-row">
    <span><div style="font-weight:600;color:var(--navy);">${c.name}</div><div style="font-size:10px;color:var(--text-hint);margin-top:2px;">${c.recno}</div></span>
    <span style="text-align:right;"><span class="badge badge-gray" style="font-size:9px;">${c.drType}</span></span>
    <span style="text-align:right;font-weight:600;color:var(--blue);">${(c.reduction||0).toLocaleString()}</span>
    <span style="text-align:center;"><span class="badge badge-done" style="font-size:9px;">활성</span></span>
    <span style="text-align:center;">
      ${canMap?`<button class="btn btn-danger btn-sm" onclick="rmUnmap(${g.id},'${c.id}')">제거</button>`:'-'}
    </span>
  </div>`).join('')}
  `;
}

function rmRenderDetailFooter(g){
  const footer = $('rm-d-footer');
  const btns = [];
  if(g.status==='pending'){
    // [v0.2 M-07] 승인대기 상태에서만 참여고객 편입·삭제 가능
    if(rmDeleteEligibility(g).ok) btns.push(`<button class="btn btn-danger btn-sm" onclick="rmDeleteResource(${g.id})">자원 삭제</button>`);
    btns.push(`<button class="btn btn-danger btn-sm" onclick="rmDeleteGroup(${g.id})">자원 비활성화</button>`);
    btns.push(`<button class="btn btn-primary btn-sm" onclick="rmOpenMapping(${g.id})">+ 고객추가</button>`);
    // [v0.2 M-09] 상태 전환 버튼 시험 대상 여부에 따라 분기
    //  - 시험 대상(표준·중소형·제주 및 H- 파생 10종): 시험대기 전환
    //  - 시험 미대상(국민DR·주파수DR·플러스DR): 활성 전환 직행 (§3-3 단계 A')
    const isTrialTarget = !!(g.trial && g.trial.required);
    const gate = rmActivationPrecheck(g);
    const dis = gate.ok ? '' : 'disabled';
    const tip = gate.ok ? '' : gate.reason;
    if(isTrialTarget){
      btns.push(`<button class="btn btn-success btn-sm" onclick="rmMoveToWaiting(${g.id})" ${dis} title="${tip}">시험대기 전환</button>`);
    } else {
      btns.push(`<button class="btn btn-success btn-sm" onclick="rmActivateDirect(${g.id})" ${dis} title="${tip}">활성 전환</button>`);
    }
  } else if(g.status==='waiting'){
    const hasFile = !!g.file;
    const trialOk = trialClearedForActivation(g);
    const canActivate = hasFile && trialOk;
    // 비활성화 사유 상세 안내
    let disableReason = '';
    if(!hasFile) disableReason = '등록 신청서 업로드 필요';
    else if(!trialOk){
      const tm = trialStatusMeta(g.trial);
      disableReason = `등록시험 합격 필요 — 현재 상태: ${tm.label}`;
    }
    if(rmDeleteEligibility(g).ok) btns.push(`<button class="btn btn-danger btn-sm" onclick="rmDeleteResource(${g.id})">자원 삭제</button>`);
    btns.push(`<button class="btn btn-danger btn-sm" onclick="rmDeleteGroup(${g.id})">자원 비활성화</button>`);
    btns.push(`<button class="btn btn-success btn-sm" onclick="rmActivate(${g.id})" ${canActivate?'':'disabled'} title="${canActivate?'':disableReason}">활성 전환</button>`);
  } else if(g.status==='active'){
    btns.push(`<button class="btn btn-secondary btn-sm" onclick="rmSuspend(${g.id})">일시중지</button>`);
  } else if(g.status==='suspended'){
    btns.push(`<button class="btn btn-success btn-sm" onclick="rmResume(${g.id})">운영 재개</button>`);
  }
  btns.push(`<button class="btn btn-secondary btn-sm" onclick="rmCloseDetail()">닫기</button>`);
  footer.innerHTML = btns.join('');
}

function rmUploadFile(){
  const g = groupById(rmState.selectedGroupId); if(!g) return;
  g.file = {name:`수요반응자원_등록신청서_${g.name}.pdf`, size:500000+Math.floor(Math.random()*100000), uploadedAt:nowStr()};
  rmRenderDetailBody(g);
  rmRenderDetailFooter(g);
  showToast('신청서가 업로드되었습니다.');
}

/* [Phase 17-CJ] 추가 서류 업로드/변경/삭제 */
function rmAddExtraDoc(gid){
  const g = groupById(gid); if(!g) return;
  const label = prompt('서류 이름을 입력하세요 (예: 사업자등록증, 통장사본, 위임장 등)');
  if(!label) return;
  if(!Array.isArray(g.docs)) g.docs = [];
  const docId = 'doc_' + (Math.floor(Math.random()*100000).toString(36));
  g.docs.push({
    id: docId,
    label: label.trim(),
    name: `${label.trim()}_${g.name}.pdf`,
    size: 200000 + Math.floor(Math.random()*300000),
    uploadedAt: nowStr(),
  });
  logAudit?.({objectType:'group', objectId:gid, action:'doc_uploaded',
    title:`서류 업로드 — ${g.name}`, desc:label.trim(), actor:'운영자', tone:'info'});
  showToast(`${label.trim()} 업로드 완료`);
  rmRenderDetailBody(g);
}
function rmUpdateExtraDoc(gid, docId){
  const g = groupById(gid); if(!g) return;
  const doc = (g.docs||[]).find(d => d.id === docId);
  if(!doc) return;
  doc.name = `${doc.label}_${g.name}_v${Math.floor(Math.random()*99)+1}.pdf`;
  doc.uploadedAt = nowStr();
  logAudit?.({objectType:'group', objectId:gid, action:'doc_updated',
    title:`서류 변경 — ${g.name}`, desc:doc.label, actor:'운영자', tone:'info'});
  showToast(`${doc.label} 파일 변경 완료`);
  rmRenderDetailBody(g);
}
function rmRemoveExtraDoc(gid, docId){
  const g = groupById(gid); if(!g) return;
  const doc = (g.docs||[]).find(d => d.id === docId);
  if(!doc) return;
  if(!confirm(`'${doc.label}' 서류를 삭제할까요?`)) return;
  g.docs = g.docs.filter(d => d.id !== docId);
  logAudit?.({objectType:'group', objectId:gid, action:'doc_deleted',
    title:`서류 삭제 — ${g.name}`, desc:doc.label, actor:'운영자', tone:'warn'});
  showToast(`${doc.label} 삭제 완료`);
  rmRenderDetailBody(g);
}
// [v0.2 M-06] 승인대기 → 시험대기/활성 전환 사전 조건 체크 (§3-3 Hard Gate 3조건)
//   1) 참여고객 수 ≥ 10명 (플러스DR은 1명 이상, 정책서 3-3)
//   2) 참여용량 ≥ 의무감축용량 (해당 유형만; 국민DR·플러스DR 등 용량 필드 없는 유형은 스킵)
//   3) KPX 자원 등록 완료 (g.kpxRegistered 명시 필드가 있으면 그 값; 없으면 status!=='pending'이면 완료로 간주)
const RM_MIN_CUSTOMERS = 10;
function rmMinCustomers(g){ return g?.typeKey==='plus' ? 1 : RM_MIN_CUSTOMERS; }
function rmKpxRegistered(g){
  if(g && typeof g.kpxRegistered === 'boolean') return g.kpxRegistered;
  return !!(g && g.status && g.status !== 'pending');
}
function rmParticipationCapacity(g){
  return (g?.customerIds||[]).reduce((s,cid)=>{
    const c = custById(cid);
    return s + (c?.reduction || 0);
  }, 0);
}
function rmTargetCapacity(g){
  // 플러스DR은 목표 용량(의무증대량)이 없다 → 0
  return g?.reg?.mandatoryCapacity || g?.reg?.estimatedCapacity || 0;
}
function rmActivationPrecheck(g){
  if(!g) return {ok:false, reason:'자원그룹 없음'};
  const issues = [];
  const custCnt = (g.customerIds||[]).length;
  const minCust = rmMinCustomers(g);
  if(custCnt < minCust){
    issues.push(`참여고객 부족 (현재 ${custCnt}명 / 필요 ${minCust}명)`);
  }
  const target = rmTargetCapacity(g);
  if(target > 0){
    const total = rmParticipationCapacity(g);
    if(total < target){
      issues.push(`참여용량 부족 (현재 ${total.toLocaleString()} kW / 목표 ${target.toLocaleString()} kW)`);
    }
  }
  if(!rmKpxRegistered(g)){
    issues.push('KPX 등록 미완료');
  }
  return {ok: issues.length === 0, reason: issues.join(' · ')};
}

// [v0.2 M-09] 승인대기 → 시험대기 전환 (시험 대상 유형만)
function rmMoveToWaiting(gid){
  const g = groupById(gid); if(!g) return;
  if(g.status!=='pending'){ showToast('승인대기 상태에서만 시험대기로 전환할 수 있습니다.'); return; }
  if(!(g.trial && g.trial.required)){ showToast('시험 미대상 유형은 시험대기 단계를 거치지 않습니다.'); return; }
  const gate = rmActivationPrecheck(g);
  if(!gate.ok){ showToast(gate.reason || '전환 조건 미충족'); return; }
  const prev = g.status;
  g.status = 'waiting';
  if(!g.trial.status || g.trial.status==='NOT_REQUIRED') g.trial.status = 'WAITING';
  g.audit = g.audit || [];
  g.audit.push({type:'STATE_CHANGE', at: nowStr(), from: prev, to: 'waiting'});
  rmApplyFilter();
  rmOpenDetail(gid);
  refreshSidebarBadges();
  showToast(`${g.name} 시험대기 전환 완료`);
}

// [v0.2 M-09] 승인대기 → 활성 직행 (시험 미대상 유형 국민·주파수·플러스)
function rmActivateDirect(gid){
  const g = groupById(gid); if(!g) return;
  if(g.status!=='pending'){ showToast('승인대기 상태에서만 활성 직행 전환이 가능합니다.'); return; }
  if(g.trial && g.trial.required){ showToast('시험 대상 유형은 시험대기 단계를 먼저 거쳐야 합니다.'); return; }
  const gate = rmActivationPrecheck(g);
  if(!gate.ok){ showToast(gate.reason || '전환 조건 미충족'); return; }
  const prev = g.status;
  g.status = 'active';
  if(!g.operational){
    const custDataStatus = {};
    (g.customerIds||[]).forEach(cid=>{ custDataStatus[cid] = {status:'NORMAL', lastMinutesAgo:2}; });
    g.operational = {
      dataCollection:{status:'NORMAL', lastMinutesAgo:2, failedCustomers:0},
      performance:{recentAvgRate:0, trend:'flat', count:0, lastRate:0},
      custDataStatus,
    };
    g.reductionHistory = [];
  }
  g.audit = g.audit || [];
  g.audit.push({type:'ACTIVATE', at: nowStr(), from: prev, via:'direct'});
  rmApplyFilter();
  rmOpenDetail(gid);
  refreshSidebarBadges();
  showToast(`${g.name} 활성 전환 완료`);
}

function rmActivate(gid){
  const g = groupById(gid); if(!g) return;
  if(!g.file){ showToast('등록 신청서를 먼저 업로드해야 합니다.'); return; }
  // 등록시험 게이트: 시험 대상 자원은 합격해야 활성화 가능 (면제 대상은 통과)
  if(!trialClearedForActivation(g)){
    const tm = trialStatusMeta(g.trial);
    showToast(`등록시험을 먼저 통과해야 합니다. 현재 상태: ${tm.label}`);
    return;
  }
  g.status = 'active';
  // 기본 가동 데이터 부여
  if(!g.operational){
    const custDataStatus = {};
    (g.customerIds||[]).forEach(cid=>{
      custDataStatus[cid] = {status:'NORMAL', lastMinutesAgo:2};
    });
    g.operational = {
      dataCollection:{status:'NORMAL', lastMinutesAgo:2, failedCustomers:0},
      performance:{recentAvgRate:0, trend:'flat', count:0, lastRate:0},
      custDataStatus,
    };
    g.reductionHistory = [];
  }
  rmApplyFilter();
  rmOpenDetail(gid);
  refreshSidebarBadges();
  showToast(`${g.name} 활성 전환 완료`);
}
function rmSuspend(gid){
  const g = groupById(gid); if(!g) return;
  $('cm-title').textContent = '운영 일시중지';
  $('cm-sub').textContent = `${g.name} 운영을 일시중지합니다.`;
  // [v0.2 M-08] 정책서 §3-2 하위 사유 4종으로 통일 (등록시험 불합격 · 감축시험 불합격 · 관리자 임시 정지 · 기타)
  $('cm-body').innerHTML = `<div class="info-box warning">일시중지된 자원은 감축지시 대상에서 제외됩니다.</div>
    <div class="form-row"><label class="form-label">중지 사유 <span class="req">*</span></label>
      <select class="form-select" id="sus-reason">
        <option value="">사유 선택</option>
        <option value="관리자 임시 정지">관리자 임시 정지</option>
        <option value="등록시험 불합격">등록시험 불합격</option>
        <option value="감축시험 불합격">감축시험 불합격</option>
        <option value="기타">기타</option>
      </select>
    </div>
    <div class="form-row"><label class="form-label">상세 사유 (선택, '기타'는 필수)</label><textarea class="form-textarea" id="sus-detail" placeholder="상세 사유를 입력하세요"></textarea></div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="rmConfirmSuspend(${gid})">일시중지</button>`;
  openModal('commonModal');
}
function rmConfirmSuspend(gid){
  const reason = $('sus-reason').value;
  if(!reason){ showToast('중지 사유를 선택하세요.'); return; }
  const detail = $('sus-detail').value.trim();
  if(reason==='기타' && !detail){ showToast("'기타' 사유는 상세 사유 입력이 필수입니다."); return; }
  const g = groupById(gid);
  const prev = g.status;
  g.status = 'suspended';
  g.suspendReason = {type:reason, detail, at:nowStr()};
  g.audit = g.audit || [];
  g.audit.push({type:'SUSPEND', at: g.suspendReason.at, from: prev, reason, detail});
  closeModal('commonModal');
  rmApplyFilter();
  rmOpenDetail(gid);
  showToast(`${g.name} 일시중지 (${reason})`);
}
function rmResume(gid){
  const g = groupById(gid);
  g.status = 'active';
  delete g.suspendReason;
  rmApplyFilter();
  rmOpenDetail(gid);
  showToast(`${g.name} 운영 재개`);
}
/* ═══ 자원 삭제 (정책서 4-4-1) ═══
   제도 참여 이력이 없는 자원만 물리 삭제. 조건 5개를 모두 충족해야 한다.
   ※ 목업은 시험대기(waiting) 상태가 아직 남아 있어 pending·waiting 둘 다
     승인대기로 취급한다. 정책서는 v0.12에서 시험대기를 승인대기로 통합했다. */
function rmDeleteEligibility(g){
  const fails = [];
  if(g.status!=='pending' && g.status!=='waiting') fails.push('운영 상태가 승인대기가 아님');
  const kpxRequested = !!(g.kpxRegRequestedAt || g.trial?.currentTestEventId || g.trial?.autoOptedInAt);
  if(kpxRequested) fails.push('KPX 자원 등록을 신청함');
  if((g.trial?.history||[]).length) fails.push('시험 이력 있음');
  if(rmEventParticipated(g.id)) fails.push('감축 이력 있음');
  if(rmSettlementExists(g.id)) fails.push('정산 기록 있음');
  return {ok: fails.length===0, fails};
}
/* 감축 이벤트 참여 여부 — 이벤트 자원 목록에 해당 자원이 있으면 참여 이력으로 본다 */
function rmEventParticipated(gid){
  if((groupById(gid)?.reductionHistory||[]).length) return true;
  const buckets = Object.values(store.events||{});
  return buckets.some(list => (list||[]).some(ev =>
    (ev.resources||[]).some(rs => rs.groupId===gid)));
}
/* 정산 기록 여부 — 정산 필드가 부여된 이벤트에 해당 자원이 있으면 정산 기록으로 본다 */
function rmSettlementExists(gid){
  const buckets = Object.values(store.events||{});
  return buckets.some(list => (list||[]).some(ev =>
    ev.settlement && (ev.resources||[]).some(rs => rs.groupId===gid)));
}
function rmDeleteResource(gid){
  const g = groupById(gid); if(!g) return;
  const el = rmDeleteEligibility(g);
  if(!el.ok){
    showToast(`삭제 불가 — ${el.fails.join(' / ')}`);
    return;
  }
  $('cm-title').textContent = '자원 삭제';
  $('cm-sub').textContent = `${g.name}`;
  $('cm-body').innerHTML = `<div class="info-box danger">
    이 자원을 삭제하시겠습니까? <b>삭제된 자원은 복구할 수 없습니다.</b>
  </div>
  <div style="font-size:11px;color:var(--text-sub);line-height:1.7;padding:8px 10px;background:var(--bg);border-radius:var(--radius);margin-top:10px;">
    편입된 사업장은 매핑만 해제되고 사업장 데이터는 유지됩니다.
  </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-danger" onclick="rmConfirmDeleteResource(${gid})">확인</button>`;
  openModal('commonModal');
}
function rmConfirmDeleteResource(gid){
  const g = groupById(gid); if(!g) return;
  const el = rmDeleteEligibility(g);
  if(!el.ok){ showToast(`삭제 불가 — ${el.fails.join(' / ')}`); return; }
  const name = g.name;
  logAudit({objectType:'resource', objectId:gid, action:'deleted', title:'[DELETE] 자원 삭제',
    desc:`${name} · ${g.type} · 삭제 조건 5개 충족`, actor:'운영관리자', tone:'danger'});
  const i = store.groups.findIndex(x=>x.id===gid);
  if(i>=0) store.groups.splice(i,1);
  rmState.bulkSelected.delete(gid);
  closeModal('commonModal');
  rmCloseDetail();
  rmApplyFilter();
  refreshSidebarBadges();
  showToast(`${name} 삭제 완료`);
}
/* 목록 체크박스 일괄 삭제 — 미충족 자원은 표시하고 차단 */
function rmOpenBulkDeleteResource(){
  if(rmState.bulkSelected.size===0) return;
  const ids = [...rmState.bulkSelected];
  const rows = ids.map(id=>{
    const g = groupById(id);
    return {g, el: rmDeleteEligibility(g)};
  });
  const blocked = rows.filter(x=>!x.el.ok);
  const okRows = rows.filter(x=>x.el.ok);
  $('cm-title').textContent = '자원 삭제';
  $('cm-sub').textContent = `선택된 ${ids.length}개 자원을 삭제합니다.`;
  $('cm-body').innerHTML = `<div class="info-box danger">
    이 자원을 삭제하시겠습니까? <b>삭제된 자원은 복구할 수 없습니다.</b>
  </div>
  ${okRows.length?`<div style="font-size:11px;color:var(--text-sub);border:1px solid var(--border);border-radius:var(--radius);padding:8px 10px;margin:10px 0;">
    <div style="font-weight:600;margin-bottom:4px;">삭제 대상 ${okRows.length}건</div>
    ${okRows.map(x=>`<div>• ${x.g.name}</div>`).join('')}
  </div>`:''}
  ${blocked.length?`<div style="font-size:11px;color:var(--red);border:1px solid var(--red);border-radius:var(--radius);padding:8px 10px;margin:10px 0;">
    <div style="font-weight:600;margin-bottom:4px;">삭제 불가 ${blocked.length}건 — 비활성 또는 일시중지 대상</div>
    ${blocked.map(x=>`<div>• ${x.g.name} — ${x.el.fails.join(' / ')}</div>`).join('')}
  </div>`:''}`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-danger" ${okRows.length?'':'disabled'} onclick="rmConfirmBulkDeleteResource()">확인 (${okRows.length}건)</button>`;
  openModal('commonModal');
}
function rmConfirmBulkDeleteResource(){
  let cnt = 0;
  [...rmState.bulkSelected].forEach(id=>{
    const g = groupById(id); if(!g) return;
    if(!rmDeleteEligibility(g).ok) return;
    logAudit({objectType:'resource', objectId:id, action:'deleted', title:'[DELETE] 자원 삭제',
      desc:`${g.name} · ${g.type} · 삭제 조건 5개 충족 (일괄 처리)`, actor:'운영관리자', tone:'danger'});
    const i = store.groups.findIndex(x=>x.id===id);
    if(i>=0) store.groups.splice(i,1);
    rmState.bulkSelected.delete(id);
    cnt++;
  });
  closeModal('commonModal');
  rmApplyFilter();
  refreshSidebarBadges();
  showToast(`${cnt}개 자원 삭제 완료`);
}

function rmDeleteGroup(gid){
  const g = groupById(gid); if(!g) return;
  // [v0.2 M-05] Hard delete 금지. 사유 입력 필수 + 상태를 'inactive'로 전환 (soft delete)
  $('cm-title').textContent = '자원 비활성화';
  $('cm-sub').textContent = `${g.name}`;
  $('cm-body').innerHTML = `<div class="info-box danger">
    이 자원을 비활성하시겠습니까? <b>비활성된 자원은 활성 자원으로 복구할 수 없습니다.</b>
  </div>
  <div class="form-row"><label class="form-label">비활성화 사유 <span style="color:var(--red)">*</span></label>
    <select class="form-select" id="rm-deactivate-reason">
      <option value="">사유 선택</option>
      <option value="계약 해지">계약 해지</option>
      <option value="계약 만료">계약 만료</option>
      <option value="자원 재구성">자원 재구성 (참여고객 변경 필요)</option>
      <option value="기타">기타 (아래 상세 사유 필수)</option>
    </select>
  </div>
  <div class="form-row"><label class="form-label">상세 사유 (선택, '기타'는 필수)</label>
    <textarea class="form-textarea" id="rm-deactivate-note" placeholder="필요 시 상세 사유"></textarea>
  </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-danger" onclick="rmConfirmDelete(${gid})">비활성 처리 확정</button>`;
  openModal('commonModal');
}
function rmConfirmDelete(gid){
  const g = groupById(gid); if(!g) return;
  const reason = $('rm-deactivate-reason')?.value || '';
  const note = ($('rm-deactivate-note')?.value || '').trim();
  if(!reason){ showToast('비활성화 사유를 선택하세요.'); return; }
  if(reason==='기타' && !note){ showToast("'기타' 사유는 상세 사유 입력이 필수입니다."); return; }
  // Soft delete: status='inactive'로 전환. 사유·감사 로그 필드 기록.
  const prev = g.status;
  g.status = 'inactive';
  g.deactivatedAt = nowStr();
  g.deactivateReason = reason;
  g.deactivateNote = note;
  g.audit = g.audit || [];
  g.audit.push({type:'DEACTIVATE', at: g.deactivatedAt, from: prev, reason, note});
  closeModal('commonModal');
  rmCloseDetail();
  rmApplyFilter();
  refreshSidebarBadges();
  showToast(`${g.name} 비활성 처리 완료 (사유: ${reason})`);
}
function rmOpenBulkDelete(){
  if(rmState.bulkSelected.size===0) return;
  const ids = [...rmState.bulkSelected];
  $('cm-title').textContent = '자원 일괄 비활성화';
  $('cm-sub').textContent = `선택된 ${ids.length}개 자원그룹을 비활성 처리합니다.`;
  // [v0.2 M-05] Soft delete + 사유 입력 필수 (일괄)
  $('cm-body').innerHTML = `<div class="info-box danger">
    선택한 자원을 비활성하시겠습니까? <b>비활성된 자원은 활성 자원으로 복구할 수 없습니다.</b>
  </div>
  <div style="max-height:140px;overflow-y:auto;font-size:11px;color:var(--text-sub);border:1px solid var(--border);border-radius:var(--radius);padding:8px 10px;margin:10px 0;">
    ${ids.map(id=>{ const g=groupById(id); return `<div>• ${g.name}</div>`; }).join('')}
  </div>
  <div class="form-row"><label class="form-label">비활성화 사유 <span style="color:var(--red)">*</span> (선택 자원 공통 적용)</label>
    <select class="form-select" id="rm-bulk-deactivate-reason">
      <option value="">사유 선택</option>
      <option value="계약 해지">계약 해지</option>
      <option value="계약 만료">계약 만료</option>
      <option value="자원 재구성">자원 재구성 (참여고객 변경 필요)</option>
      <option value="기타">기타</option>
    </select>
  </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-danger" onclick="rmConfirmBulkDelete()">비활성 처리 확정</button>`;
  openModal('commonModal');
}
function rmConfirmBulkDelete(){
  const reason = $('rm-bulk-deactivate-reason')?.value || '';
  if(!reason){ showToast('비활성화 사유를 선택하세요.'); return; }
  // [v0.2 M-05] Soft delete: 선택 자원 status='inactive' 일괄 전환
  const ts = nowStr();
  [...rmState.bulkSelected].forEach(id=>{
    const g = groupById(id); if(!g) return;
    const prev = g.status;
    g.status = 'inactive';
    g.deactivatedAt = ts;
    g.deactivateReason = reason;
    g.audit = g.audit || [];
    g.audit.push({type:'DEACTIVATE', at: ts, from: prev, reason, note:'(일괄 처리)'});
  });
  const cnt = rmState.bulkSelected.size;
  rmState.bulkSelected.clear();
  closeModal('commonModal');
  rmApplyFilter();
  refreshSidebarBadges();
  showToast(`${cnt}개 자원 비활성 처리 완료 (사유: ${reason})`);
}

/* 고객 매핑 */
function rmOpenMapping(gid){
  const g = groupById(gid); if(!g) return;
  // [v0.2 M-07] 승인대기(pending) 상태에서만 참여고객 편입·삭제 가능
  if(g.status!=='pending'){ showToast('승인대기 상태의 자원그룹만 참여고객 편입이 가능합니다.'); return; }
  rmState.selectedGroupId = gid;
  rmState.mappingSelected.clear();
  const allowedTypes = store.custTypeMap[g.typeKey] || [];
  $('rm-map-sub').innerHTML = `<strong>[${g.name}]</strong> — 매핑 가능 유형: ${allowedTypes.join(', ')}`;
  rmRenderMappingSummary();
  rmRenderMappingList();
  $('rm-map-search').value='';
  openModal('rmMappingModal');
}
function rmAvailableCustomers(g){
  const allowedTypes = store.custTypeMap[g.typeKey] || [];
  const mappedIds = new Set(g.customerIds||[]);
  return store.customers.filter(c=>
    c.status==='계약완료' &&
    allowedTypes.includes(c.drType) &&
    !mappedIds.has(c.id)
  );
}
function rmRenderMappingList(){
  const g = groupById(rmState.selectedGroupId); if(!g) return;
  const q = ($('rm-map-search').value||'').trim().toLowerCase();
  let list = rmAvailableCustomers(g);
  if(q) list = list.filter(c=>c.name.toLowerCase().includes(q));
  const box = $('rm-map-list');
  if(!list.length){
    box.innerHTML = `<div class="empty" style="padding:30px 20px;">매핑 가능한 고객이 없습니다.<br><span style="font-size:10px;">사전검증 → 계약완료 상태의 고객만 매핑 가능합니다.</span></div>`;
    return;
  }
  box.innerHTML = list.map(c=>{
    const sel = rmState.mappingSelected.has(c.id);
    return `<div class="cust-pick-row ${sel?'selected':''}" onclick="rmToggleMappingPick('${c.id}')">
      <input type="checkbox" ${sel?'checked':''} style="accent-color:var(--blue);" onclick="event.stopPropagation();rmToggleMappingPick('${c.id}')">
      <span><div style="font-weight:600;color:var(--navy);">${c.name}</div><div style="font-size:10px;color:var(--text-hint);margin-top:2px;">${c.ceo} · ${c.addr}</div></span>
      <span style="text-align:right;"><span class="badge badge-gray" style="font-size:9px;">${c.drType}</span></span>
      <span style="text-align:right;font-weight:600;color:var(--blue);">${(c.reduction||0).toLocaleString()}</span>
      <span style="text-align:center;font-family:monospace;font-size:10px;color:var(--text-hint);">${c.recno}</span>
    </div>`;
  }).join('');
  rmRenderMappingSummary();
}
function rmToggleMappingPick(cid){
  if(rmState.mappingSelected.has(cid)) rmState.mappingSelected.delete(cid);
  else rmState.mappingSelected.add(cid);
  rmRenderMappingList();
  $('rm-map-count').textContent = `${rmState.mappingSelected.size}명 선택`;
}
function rmRenderMappingSummary(){
  const g = groupById(rmState.selectedGroupId); if(!g) return;
  const target = rmTargetCapacity(g);
  const mapped = rmGroupCapacityTotal(g);
  let selectedSum = 0;
  rmState.mappingSelected.forEach(id=>{
    const c = custById(id);
    if(c) selectedSum += (c.reduction||0);
  });
  const after = mapped + selectedSum;
  const remaining = target ? (target - after) : null;
  const summary = $('rm-map-summary');
  if(target){
    summary.innerHTML = `
      <div class="mapping-summary-row"><span class="mapping-summary-lbl">목표 용량</span><span class="mapping-summary-val">${target.toLocaleString()} kW</span></div>
      <div class="mapping-summary-row"><span class="mapping-summary-lbl">현재 매핑 용량</span><span class="mapping-summary-val">${mapped.toLocaleString()} kW</span></div>
      <div class="mapping-summary-row"><span class="mapping-summary-lbl">선택 용량 (+)</span><span class="mapping-summary-val" style="color:var(--green);">${selectedSum.toLocaleString()} kW</span></div>
      <div class="mapping-summary-row"><span class="mapping-summary-lbl">확정 후 잔여</span><span class="mapping-summary-val" style="color:${remaining>=0?'var(--blue)':'var(--red)'};">${remaining.toLocaleString()} kW</span></div>`;
  } else {
    summary.innerHTML = `
      <div class="mapping-summary-row"><span class="mapping-summary-lbl">현재 매핑 용량</span><span class="mapping-summary-val">${mapped.toLocaleString()} kW</span></div>
      <div class="mapping-summary-row"><span class="mapping-summary-lbl">선택 용량 (+)</span><span class="mapping-summary-val" style="color:var(--green);">${selectedSum.toLocaleString()} kW</span></div>`;
  }
}
function rmConfirmMapping(){
  const g = groupById(rmState.selectedGroupId); if(!g) return;
  if(rmState.mappingSelected.size===0){ showToast('매핑할 고객을 선택하세요.'); return; }
  // 용량 초과 검증
  const target = rmTargetCapacity(g);
  if(target > 0){
    const mapped = rmGroupCapacityTotal(g);
    let selectedSum = 0;
    rmState.mappingSelected.forEach(id=>{
      const c = custById(id);
      if(c) selectedSum += (c.reduction||0);
    });
    const after = mapped + selectedSum;
    if(after > target){
      const over = after - target;
      $('cm-title').textContent = '목표 용량 초과';
      $('cm-sub').textContent = `${g.name}의 목표 용량을 초과하여 매핑됩니다.`;
      $('cm-body').innerHTML = `<div class="info-box warning">
        <b>목표 용량</b> ${target.toLocaleString()} kW<br>
        <b>매핑 후 용량</b> ${after.toLocaleString()} kW<br>
        <b>초과량</b> <span style="color:var(--red);font-weight:700;">+${over.toLocaleString()} kW</span>
        </div>
        <div style="font-size:11px;color:var(--text-sub);margin-top:8px;">그래도 진행하시겠습니까?</div>`;
      $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
        <button class="btn btn-danger" onclick="closeModal('commonModal');rmDoConfirmMapping();">초과 매핑 진행</button>`;
      openModal('commonModal');
      return;
    }
  }
  rmDoConfirmMapping();
}
function rmDoConfirmMapping(){
  const g = groupById(rmState.selectedGroupId); if(!g) return;
  rmState.mappingSelected.forEach(id=>{ g.customerIds.push(id); });
  const cnt = rmState.mappingSelected.size;
  rmState.mappingSelected.clear();
  closeModal('rmMappingModal');
  rmApplyFilter();
  rmOpenDetail(g.id, 'customers');
  showToast(`${cnt}명 고객이 매핑되었습니다.`);
}
function rmUnmap(gid, cid){
  const g = groupById(gid); if(!g) return;
  const c = custById(cid);
  $('cm-title').textContent = '참여고객 제거';
  $('cm-sub').textContent = `${c?.name||cid}을(를) 자원그룹에서 제거합니다.`;
  $('cm-body').innerHTML = '';
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-danger" onclick="rmConfirmUnmap(${gid},'${cid}')">제거</button>`;
  openModal('commonModal');
}
function rmConfirmUnmap(gid, cid){
  const g = groupById(gid);
  g.customerIds = g.customerIds.filter(id=>id!==cid);
  closeModal('commonModal');
  rmApplyFilter();
  rmOpenDetail(gid, 'customers');
  showToast('고객이 제거되었습니다.');
}

/* ════════════════════════════════════════════════════════════
   ★ PAGE: 감축 모니터링
════════════════════════════════════════════════════════════ */
