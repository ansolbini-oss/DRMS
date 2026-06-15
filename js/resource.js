/* ════════════════════════════════════════════════════════════
   RESOURCE — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

function trialRequiredForType(typeKey){
  return typeKey==='standard' || typeKey==='jeju';
}
/* 시험 상태 → 라벨/뱃지
   dashboardLabel: 대시보드 표시용 업무 용어 (운영자 관점)
   label: 자원관리 상세 표시용 내부 상태어 */
function trialStatusMeta(t){
  if(!t) return {label:'-', dashboardLabel:'-', badge:'badge-gray'};
  const map = {
    NOT_REQUIRED:{label:'면제',     dashboardLabel:'면제',     badge:'badge-gray'},
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
/* 하위 호환: 단일 반환 버전 — 첫 번째 라이브 이벤트 반환 (기존 호출부용) */
function rmGroupCurrentLiveEvent(g){
  const all = rmGroupCurrentLiveEvents(g);
  return all.length ? all[0] : null;
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
  const setStyle = (id, prop, val) => {
    const el = document.getElementById(id);
    if(el) el.style[prop] = val;
  };
  const g = store.groups;
  const waitCnt = g.filter(x=>x.status==='waiting').length;
  const activeCnt = g.filter(x=>x.status==='active').length;
  const suspendCnt = g.filter(x=>x.status==='suspended').length;
  setText('rm-cnt-all', g.length);
  // 상태 칩 카운트 갱신 (Phase 10에서 제거된 element일 수 있음 → guard)
  setText('rm-chip-waiting', waitCnt);
  setText('rm-chip-active', activeCnt);
  setText('rm-chip-suspended', suspendCnt);
  // 중지 상태 칩은 일시중지된 그룹이 있을 때만 표시
  setStyle('rm-chip-suspended-btn', 'display', suspendCnt>0 ? '' : 'none');
  // 칩 활성 상태는 rm-status-filter와 양방향 동기화
  const curStatus = $('rm-status-filter')?.value || '';
  document.querySelectorAll('.rm-status-chip').forEach(chip=>{
    chip.classList.toggle('active', chip.dataset.status === curStatus);
  });
  // 시험 대기 카운트
  const trialPending = (typeof trialPendingGroups === 'function') ? trialPendingGroups() : [];
  setText('rm-cnt-trial', trialPending.length);
  // 운영이상 카운트
  const problems = (typeof getProblematicGroups === 'function') ? getProblematicGroups() : [];
  const risk = problems.filter(p=>p.level==='risk').length;
  const warn = problems.filter(p=>p.level==='warn').length;
  setText('rm-cnt-risk', risk+warn);
}

/* 상태 필터 칩 토글 — rm-status-filter 드롭다운과 양방향 동기화 */
function rmToggleStatusChip(status){
  const sel = $('rm-status-filter'); if(!sel) return;
  // 재클릭 시 해제 (= '상태 전체'로 복귀)
  const cur = sel.value;
  sel.value = (cur === status) ? '' : status;
  // 상태 필터를 바꿀 때, 카드 필터가 'risk'인 경우에는 그대로 유지
  //   ('risk' 그룹에서 '승인대기' 또는 '활성'만 추가 필터링하는 AND 조합이 유용함)
  // 단, rm-card-all이 활성 상태가 아니면(=유형/위험 카드 활성) 상태만 바뀌는 것이 맞음.
  rmRunSearch();
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
  // 운영이상 카드
  if(card==='risk'){
    list = list.filter(g=>rmHealth(g)!=='normal');
  }
  // 시험 대기 카드: 시험 대상이면서 합격 전인 그룹만
  if(card==='trial'){
    list = list.filter(g=>g.trial && g.trial.required && g.trial.status!=='PASSED');
  }
  if(sF) list = list.filter(g=>g.status===sF);
  if(tF) list = list.filter(g=>g.typeKey===tF);
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
    // 등록시험 셀: 면제면 회색 '면제', 시험 대상이면 상태 뱃지만 표시 (상세 탭에서 이력 확인)
    let trialCell = '';
    if(!g.trial || !g.trial.required){
      trialCell = `<span class="badge badge-gray" style="font-size:10px;">면제</span>`;
    } else {
      const tm = trialStatusMeta(g.trial);
      trialCell = `<span class="badge ${tm.badge}" style="font-size:10px;">${tm.label}</span>`;
    }
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
        <span onclick="rmOpenDetail(${g.id})" style="cursor:pointer;"><span class="badge ${statusBadgeClass(g.status)}">${statusLabelRM(g.status)}</span></span>
        <span onclick="rmOpenDetail(${g.id}, 'trial')" style="cursor:pointer;">${trialCell}</span>
        <span onclick="rmOpenDetail(${g.id})" style="cursor:pointer;color:var(--text-sub);font-size:11px;">${g.date}</span>
        <span onclick="rmOpenDetail(${g.id})" style="cursor:pointer;font-weight:500;">${cnt}명</span>
        <span onclick="rmOpenDetail(${g.id})" style="cursor:pointer;font-weight:600;color:var(--blue);">${cap.toLocaleString()}</span>
        <span style="text-align:center;">
          ${g.status==='active'?`<button class="btn btn-secondary btn-sm" onclick="rmOpenMapping(${g.id})">+ 추가</button>`:'<span style="font-size:10px;color:var(--text-hint);">—</span>'}
        </span>
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
  const btn = $('rm-btn-bulk-delete');
  btn.disabled = rmState.bulkSelected.size===0;
}

/* 자원그룹 생성 */
function rmOpenCreate(){
  $('rm-f-name').value='';
  $('rm-f-type').value='';
  ['rm-f-standard','rm-f-national','rm-f-jeju','rm-f-freq','rm-f-plus','rm-dyn-fields','rm-plus-land']
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
    // 제주DR 세부 안내
    $('rm-f-trial-hint').innerHTML = typeKey==='jeju'
      ? '제주DR 자원은 등록시험 합격 후 감축지시 이행이 가능합니다.<br>이 항목을 체크하면 시험 상태가 <b>미시행</b>으로 초기화되며, 시험 합격 전까지 활성 전환이 제한됩니다.'
      : '표준·중소형DR 자원은 등록시험 합격 후 감축지시 이행이 가능합니다.<br>이 항목을 체크하면 시험 상태가 <b>미시행</b>으로 초기화되며, 시험 합격 전까지 활성 전환이 제한됩니다.';
  } else {
    $('rm-f-trial-section').style.display = 'none';
    $('rm-f-trial-required').checked = false;
  }
}
function rmOnPlusRegion(val){
  if(val==='육지권') $('rm-plus-land').classList.remove('field-hidden');
  else $('rm-plus-land').classList.add('field-hidden');
}
function rmHandleCreate(){
  const name = $('rm-f-name').value.trim();
  const typeVal = $('rm-f-type').value;
  if(!name||!typeVal){ showToast('자원그룹명과 자원 종류를 입력하세요.'); return; }
  const typeMap = {
    'standard':      {type:'표준DR',          typeKey:'standard'},
    'h_standard':    {type:'H-표준DR',        typeKey:'standard'},
    'small':         {type:'중소형DR',        typeKey:'standard'},
    'small_ev':      {type:'중소형DR(EV)',    typeKey:'standard'},
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
    const region = document.querySelector('input[name="rm-plus-region"]:checked')?.value;
    if(!region){ showToast('지역구분을 선택하세요.'); return; }
    reg.region = region;
    if(region==='육지권'){
      const subs = [...document.querySelectorAll('#rm-plus-land .check-group input:checked')].map(c=>c.value);
      const cap = parseInt($('rm-f-plus-cap').value);
      if(!subs.length||!cap){ showToast('육지권 세부구분과 증대 가능용량을 입력하세요.'); return; }
      reg.landSubRegion = subs; reg.increaseCapacity = cap;
    }
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
  store.groups.push({
    id:newId, name, type:meta.type, typeKey:meta.typeKey,
    status:'waiting', date:todayStr(), reg, file:null, customerIds:[],
    trial,
  });
  closeModal('rmCreateModal');
  rmApplyFilter();
  refreshSidebarBadges();
  const trialMsg = trialRequired ? ' · 등록시험 필요' : '';
  showToast(`${name} 생성 완료 — 승인대기 상태${trialMsg}`);
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
      if(!g.trial || !g.trial.required) return '<span class="tab-badge" style="background:var(--gray);font-size:9px;">면제</span>';
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
    if(g.typeKey==='plus') return `
      <div class="detail-field"><div class="detail-field-label">지역구분</div><div class="detail-field-val">${r.region||'-'}</div></div>
      <div class="detail-field"><div class="detail-field-label">증대 가능용량</div><div class="detail-field-val blue">${r.increaseCapacity?r.increaseCapacity.toLocaleString()+' kW':'-'}</div></div>
      ${r.landSubRegion?`<div class="detail-field full"><div class="detail-field-label">육지권 세부구분</div><div class="detail-field-val">${r.landSubRegion.join(', ')}</div></div>`:''}`;
    return '';
  })();
  const fileBox = g.file
    ? `<div style="background:var(--green-light);border:1px solid var(--green-border);border-radius:var(--radius);padding:12px 14px;display:flex;align-items:center;justify-content:space-between;">
         <div><div style="font-size:11px;color:var(--green);font-weight:600;">등록신청서 업로드 완료</div>
         <div style="font-size:11px;color:var(--text-sub);margin-top:3px;">${g.file.name}</div>
         <div style="font-size:10px;color:var(--text-hint);margin-top:2px;">${g.file.uploadedAt}</div></div>
         <button class="btn btn-secondary btn-sm">변경</button>
       </div>`
    : `<div style="background:var(--amber-light);border:1px solid var(--amber-border);border-radius:var(--radius);padding:12px 14px;">
         <div style="font-size:11px;color:var(--amber);font-weight:600;margin-bottom:6px;">※ 등록신청서 업로드 필요</div>
         <div style="font-size:11px;color:var(--text-sub);margin-bottom:8px;">활성 전환 전 수요반응자원 등록신청서 파일을 업로드해야 합니다.</div>
         <button class="btn btn-primary btn-sm" onclick="rmUploadFile()">파일 업로드</button>
       </div>`;

  const suspendBox = g.status==='suspended' && g.suspendReason
    ? `<div style="background:var(--gray-light);border:1px solid var(--border-dark);border-radius:var(--radius);padding:12px 14px;margin-top:12px;">
         <div style="font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">일시중지 상태</div>
         <div style="font-size:11px;color:var(--text-sub);">사유: ${g.suspendReason.type}${g.suspendReason.detail?' — '+g.suspendReason.detail:''}</div>
         <div style="font-size:10px;color:var(--text-hint);margin-top:2px;">${g.suspendReason.at}</div>
       </div>`
    : '';
  return `<div class="detail-field-grid">
    <div class="detail-field"><div class="detail-field-label">자원유형</div><div class="detail-field-val">${g.type}</div></div>
    <div class="detail-field"><div class="detail-field-label">상태</div><div class="detail-field-val"><span class="badge ${statusBadgeClass(g.status)}">${statusLabelRM(g.status)}</span></div></div>
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
        <div style="font-size:14px;font-weight:700;color:${statusColor};margin-top:2px;">${statusText}${isAbnormal ? ' — 사업장별 진단 필요' : ''}</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="rmGoToDataCollect(${g.id})">전력데이터 수집현황 →</button>
    </div>
  </div>`;

  // 현재 라이브 이벤트 카드 (조건부) — 병행 이벤트가 있으면 모두 표시 (설계서 §8.1)
  let liveEventCard = '';
  const liveCtxList = rmGroupCurrentLiveEvents(g);
  if(liveCtxList.length > 0){
    const isParallel = liveCtxList.length > 1;
    const parallelBanner = isParallel
      ? `<div style="padding:6px 14px;font-size:10px;color:var(--blue);background:var(--blue-light);border-bottom:1px solid var(--blue-border);">
           ⓘ 병행 이벤트 ${liveCtxList.length}건 동시 진행 중 — 각 이벤트별로 독립 평가 (설계서 §8.1)
         </div>`
      : '';
    const eventBlocks = liveCtxList.map(({event:ev, resource:r})=>{
      const rate = r.actual!=null && r.ordered>0 ? r.actual/r.ordered : null;
      const rateColor = rate==null?'var(--text-hint)':rate>=0.9?'var(--green)':rate>=0.7?'var(--amber)':'var(--red)';
      const rateLabel = rate==null?'—':`${Math.round(rate*100)}%`;
      const dm = dispatchTypeMeta(ev.dispatch_type);
      const monTabKey = dm.direction==='increase' ? 'plus' : 'reduction';
      const directionWord = dm.direction==='increase' ? '증대' : '감축';
      return `<div class="op-live-event-block">
        <div style="padding:10px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="badge ${dm.badge}" style="font-size:10px;">${dm.label}</span>
          <span style="font-size:12px;color:var(--text-sub);">${ev.label}</span>
          ${ev.remainingMinutes!=null?`<span style="font-size:11px;color:var(--text-hint);margin-left:auto;">잔여 <b>${ev.remainingMinutes}분</b></span>`:''}
        </div>
        <div class="op-metric op-metric-3">
          <div class="op-metric-item">
            <div class="op-metric-lbl">지시용량</div>
            <div class="op-metric-val">${r.ordered.toLocaleString()} kW</div>
          </div>
          <div class="op-metric-item">
            <div class="op-metric-lbl">현재 실적</div>
            <div class="op-metric-val" style="color:${rateColor};">${r.actual!=null?r.actual.toLocaleString()+' kW':'—'}</div>
          </div>
          <div class="op-metric-item">
            <div class="op-metric-lbl">실시간 이행률</div>
            <div class="op-metric-val" style="color:${rateColor};">${rateLabel}</div>
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
        <div class="op-idle-sub">
          ${historyCount>0
            ? `이 자원의 과거 감축 성과는 <b>감축이력</b> 탭(${historyCount}건)에서 확인할 수 있습니다.`
            : `아직 이 자원의 감축 이력이 없습니다.`}
        </div>
        ${historyCount>0 ? `<button class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="rmSwitchDetailTab('history')">감축이력 보기 →</button>` : ''}
      </div>
    </div>`;
  }

  // [Phase 17-N] missingCard 제거 — 수신 이상 고객 명단은 전력데이터 수집현황 책임으로 일원화
  return collectCard + liveEventCard;
}

/* 자원 상세 [상세 보기 →] 클릭 → 전력데이터 수집현황 페이지로 라우팅.
   해당 자원그룹을 미리 dcState에 세팅해 진입 시 그 자원그룹으로 필터된 상태를 보여준다. */
function rmGoToDataCollect(gid){
  // 자원관리 상세 패널 닫기
  const panel = document.getElementById('rmDetailPanel');
  if(panel) panel.classList.remove('open');
  // datacollect 페이지의 자원그룹 필터를 해당 그룹으로 미리 세팅
  if(typeof dcState !== 'undefined') dcState.groupId = String(gid);
  // 페이지 이동 (dcInit이 자동 호출되어 dcState.groupId 기준 렌더)
  navigate('datacollect');
}

/* 참여고객 데이터 재조회 요청 (확인 모달) */
function rmRequestRecollect(gid, cid){
  const g = groupById(gid); if(!g) return;
  const c = custById(cid); if(!c) return;
  $('cm-title').textContent = '데이터 재조회';
  $('cm-sub').textContent = `${c.name} (${c.recno})의 한전 AMI 계량 데이터를 즉시 재조회합니다.`;
  $('cm-body').innerHTML = `<div class="info-box">
    참여고객의 한전 AMI 채널로 재조회를 시도합니다. 통신 상태에 따라 수초 내 결과가 표시됩니다.
  </div>
  <div class="check-item-row"><span>참여고객</span><span style="font-weight:600;">${c.name}</span></div>
  <div class="check-item-row"><span>한전 고객번호</span><span style="font-family:monospace;">${c.kepco||'-'}</span></div>
  <div class="check-item-row"><span>최근 수신</span><span style="color:var(--red);font-weight:600;">${g.operational?.custDataStatus?.[cid]?.lastMinutesAgo||'-'}분 전</span></div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="rmConfirmRecollect(${gid},'${cid}')">재조회 실행</button>`;
  openModal('commonModal');
}

/* 재조회 시뮬레이션 — 참여고객(cid)별 결정론 분기.
   cid 끝자리 패리티로 통신 성공/실패를 갈라 시연한다 (백엔드 연동 시 실제 API 응답으로 교체) */
function rmSimulateRecollectOutcome(cid){
  const m = (cid||'').match(/(\d+)$/);
  const last = m ? parseInt(m[1].slice(-1), 10) : 0;
  if(last % 2 === 0){
    return {ok:true};
  }
  return {ok:false, reason:'한전 AMI 응답 없음 — 계량기 통신 또는 외부망 점검 필요'};
}

/* 재조회 실행 — 로딩 표시 후 시뮬레이션 결과를 모달에 표기 */
function rmConfirmRecollect(gid, cid){
  const g = groupById(gid); if(!g) return;
  const c = custById(cid); if(!c) return;

  // 1) 모달을 로딩 상태로 전환
  $('cm-title').textContent = '데이터 재조회 중';
  $('cm-sub').textContent = `${c.name} (${c.recno})`;
  $('cm-body').innerHTML = `<div style="padding:32px 16px;text-align:center;">
      <div class="spinner-inline" style="display:inline-block;width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--blue);border-radius:50%;animation:rm-recollect-spin 0.9s linear infinite;"></div>
      <div style="margin-top:14px;font-size:13px;color:var(--text-sub);font-weight:500;">한전 AMI 재조회 중...</div>
      <div style="margin-top:4px;font-size:11px;color:var(--text-hint);">한전 고객번호 ${c.kepco||'-'} · 응답 대기</div>
    </div>
    <style>@keyframes rm-recollect-spin{to{transform:rotate(360deg);}}</style>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" disabled style="opacity:0.5;cursor:not-allowed;">처리 중...</button>`;

  // 2) 1.4초 후 결과 분기 (목업 — 백엔드 응답으로 교체될 위치)
  setTimeout(()=>{
    const result = rmSimulateRecollectOutcome(cid);
    if(result.ok){
      // 성공: 상태 정상 복구
      if(g.operational?.custDataStatus?.[cid]){
        g.operational.custDataStatus[cid] = {status:'NORMAL', lastMinutesAgo:1};
      }
      if(g.operational?.dataCollection){
        const statusMap = g.operational.custDataStatus || {};
        const failed = Object.values(statusMap).filter(s=>s.status==='FAILED').length;
        const delayed = Object.values(statusMap).filter(s=>s.status==='DELAYED').length;
        g.operational.dataCollection.failedCustomers = failed;
        if(failed===0 && delayed===0){
          g.operational.dataCollection.status = 'NORMAL';
          g.operational.dataCollection.lastMinutesAgo = 1;
        }
      }
      logAudit?.({
        objectType:'customer', objectId:cid, action:'recollect_success',
        title:`재조회 성공 — ${c.name}`,
        desc:`한전 고객번호 ${c.kepco||'-'} · 한전 AMI 통신 정상 · 최신 데이터 수신`,
        actor:'운영자', tone:'success'
      });
      $('cm-title').textContent = '재조회 결과';
      $('cm-body').innerHTML = `<div style="background:var(--green-light);border:1px solid var(--green-border);border-radius:var(--radius);padding:18px 16px;display:flex;gap:12px;align-items:center;">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">✓</div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:700;color:var(--green);">수신 정상</div>
            <div style="font-size:12px;color:var(--text-sub);margin-top:4px;">${c.name} · ${c.kepco||'-'}</div>
          </div>
        </div>`;
      $('cm-footer').innerHTML = `<button class="btn btn-primary" onclick="rmCloseRecollect(${gid})">확인</button>`;
    } else {
      // 실패: 상태 유지 + 수동업로드 우회 경로 노출
      logAudit?.({
        objectType:'customer', objectId:cid, action:'recollect_failed',
        title:`재조회 실패 — ${c.name}`,
        desc:`한전 고객번호 ${c.kepco||'-'} · ${result.reason}`,
        actor:'운영자', tone:'warn'
      });
      $('cm-title').textContent = '재조회 결과';
      $('cm-body').innerHTML = `<div style="background:var(--red-light,#fef2f2);border:1px solid var(--red-border,#fecaca);border-radius:var(--radius);padding:18px 16px;display:flex;gap:12px;align-items:center;">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">!</div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:700;color:var(--red);">통신 실패</div>
            <div style="font-size:12px;color:var(--text-sub);margin-top:4px;">${c.name} · ${c.kepco||'-'}</div>
          </div>
        </div>`;
      $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">닫기</button>
        <button class="btn btn-primary" onclick="rmConfirmRecollect(${gid},'${cid}')">다시 시도</button>`;
    }
  }, 1400);
}

/* 재조회 성공 후 모달 닫기 + 화면 동기화 */
function rmCloseRecollect(gid){
  closeModal('commonModal');
  rmOpenDetail(gid, 'op');
  rmApplyFilter();
  refreshSidebarBadges?.();
}

/* ═══ 등록시험 탭 ═══ */
function rmTabTrialHtml(g){
  // 면제 대상
  if(!g.trial || !g.trial.required){
    return `<div class="op-card">
      <div class="op-card-title">등록시험 면제 대상</div>
      <div style="padding:14px 16px;font-size:12px;color:var(--text-sub);line-height:1.7;">
        이 자원(<b>${g.type}</b>)은 KPX 제도상 <b>등록시험이 면제</b>되는 자원입니다.<br>
        감축지시 이행을 위한 사전 시험 없이 자원 등록 후 바로 활성화할 수 있습니다.
      </div>
    </div>`;
  }
  // 시험 대상
  const tm = trialStatusMeta(g.trial);
  const history = g.trial.history || [];
  const attempts = history.length;
  const lastAttempt = attempts>0 ? history[history.length-1] : null;

  // 현재 상태 요약 카드 — 수치 중심, 설명은 CSS 툴팁으로
  const summaryTipBody = `<b>등록시험</b>이란?<br>KPX(전력거래소)가 발령하는 감축지시로, 자원의 실제 이행 능력을 검증 (전력시장운영규칙 제12.3.1조).<br><br><b>판정 기준</b> (제12.3.1.4조):<br>• <span class="tip-good">97% 이상</span> 정상 등록<br>• <span class="tip-warn">80~97%</span> 용량 조정 등록<br>• <span class="tip-bad">80% 미만 또는 시간대별 70% 미만</span> 참여 제한<br><br>시험은 자격 검증 목적이며 <b>정산 대상 아님</b>.`;
  const summaryCard = `<div class="op-card">
    <div class="op-card-title">
      <span style="display:inline-flex;align-items:center;gap:6px;">
        등록시험 현황
        <span class="tip"><span class="tip-icon">ⓘ</span><span class="tip-body">${summaryTipBody}</span></span>
      </span>
    </div>
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
    const waitingTooltip = '시험 참여는 KPX 통신 규격에 따라 시스템이 자동 처리하며, 운영자의 별도 조작이 필요하지 않습니다. 시험 발령·진행 현황은 감축 모니터링 → 구분: 등록시험에서 확인할 수 있으며, 시험 종료 후 KPX 공식 판정 결과가 자동 반영됩니다.';
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
      <div class="op-card-title">
        <span style="display:inline-flex;align-items:center;gap:6px;">
          ⏳ KPX 등록시험 대기
          <span class="info-icon" title="${waitingTooltip}">ⓘ</span>
        </span>
      </div>
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
    // 참여 제한 → 운영자 판단 필요 (제12.3.1.4조 제2항)
    // 이행률·이벤트 정보는 요약 카드 + 이력 테이블에 이미 표시됨 → 여기서는 판단 버튼만 제공
    const failedAttempt = lastAttempt;
    const failedTooltip = '전력시장운영규칙 제12.3.1.4조 제2항: 평균 감축이행률 80% 미만 또는 시간대별 최소 감축이행률 70% 미만인 수요반응자원은 해당 거래기간 참여가 제한되며, 기본정산금·실적정산금을 지급하지 않습니다.';
    actionCard = `<div class="op-card op-card-risk">
      <div class="op-card-title" style="color:var(--red);">
        <span style="display:inline-flex;align-items:center;gap:6px;">
          운영자 판단 필요
          <span class="info-icon" title="${failedTooltip}">ⓘ</span>
        </span>
      </div>
      <div style="padding:12px 14px;">
        <div class="trial-decision-grid">
          <button class="trial-decision-btn" onclick="rmRetryTrial(${g.id})" title="자원을 재시험 대기 상태로 전환. 필요 시 참여고객 탭에서 자원 구성 변경(제12.3.1.8조) 후 KPX 재시험 일정 통보를 대기할 수 있습니다.">
            <div class="trial-decision-title">재시험 대기 전환</div>
            <div class="trial-decision-desc">차기 등록 신청기간 재시험 응시</div>
          </button>
          <button class="trial-decision-btn danger" onclick="rmDeleteGroupConfirm(${g.id})" title="이 자원그룹을 시스템에서 완전히 제거합니다. 반복 실패·재구성 불가 등으로 등록을 포기할 때 선택합니다.">
            <div class="trial-decision-title">자원 삭제</div>
            <div class="trial-decision-desc">등록 포기</div>
          </button>
        </div>
      </div>
    </div>`;
  } else if(g.trial.status==='PASSED'){
    // 합격 — 운영자가 할 일: waiting 상태면 활성 전환, active면 카드 불필요
    // (판정 기준·이행률·이벤트는 상단 요약 카드 + 하단 시험 이력 테이블에 이미 표시됨)
    if(g.status==='waiting'){
      actionCard = `<div class="op-card">
        <div style="padding:12px 14px;font-size:12px;color:var(--text-sub);line-height:1.6;">
          합격 상태입니다. 상단 <b>활성 전환</b> 버튼으로 상용 감축지시 대상 편입이 가능합니다.
        </div>
      </div>`;
    }
    // g.status==='active'면 actionCard를 비워둠 — 요약 카드와 이력 테이블로 충분
  }

  // 이력 테이블 — 이벤트 ID 클릭 시 감축 모니터링으로 이동
  const historyCard = `<div class="op-card">
    <div class="op-card-title">시험 이력 (${attempts}회)</div>
    ${attempts===0
      ? '<div class="empty" style="padding:30px 20px;">아직 KPX로부터 시험 통보를 받지 않았습니다.<br><span style="font-size:10px;">시험 발령 시 감축 모니터링에서 자동으로 확인할 수 있습니다.</span></div>'
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
            ? `<span class="trial-event-link" style="font-size:10px;color:var(--blue);cursor:pointer;text-decoration:underline;" onclick="rmGoToMonitoringEvent('${h.testEventId}')" title="감축 모니터링에서 상세 보기">${(()=>{ const tev = (store.events?.reduction||[]).find(e=>e.id===h.testEventId); return tev ? `${eventDisplayName(tev)}<span style="display:block;color:var(--text-hint);font-family:monospace;">${h.testEventId}</span>` : h.testEventId; })()}</span>`
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

/* 불합격 자원 재시험 응시 결정 (운영자 판단 기록) */
function rmRetryTrial(gid){
  const g = groupById(gid); if(!g) return;
  $('cm-title').textContent = '재시험 응시 결정';
  $('cm-sub').textContent = `${g.name}`;
  $('cm-body').innerHTML = `<div class="info-box">
    이 자원을 <b>재시험 대기 상태</b>로 전환합니다.<br>
    재시험 대기 중에는 언제든지 <b>참여고객 탭</b>에서 자원 구성을 변경할 수 있으며,
    KPX로부터 재시험 일정이 통보되면 <b>감축 모니터링 → 구분: 등록시험</b>에서 확인할 수 있습니다.
  </div>
  <div class="form-row"><label class="form-label">운영자 판단 메모</label>
    <textarea class="form-textarea" id="trial-retry-note" placeholder="재시험 사유, 자원 구성 변경 계획 등"></textarea>
  </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="rmConfirmRetry(${gid})">재시험 응시 확정</button>`;
  openModal('commonModal');
}

function rmConfirmRetry(gid){
  const g = groupById(gid); if(!g) return;
  const note = $('trial-retry-note').value.trim();
  // FAILED → WAITING로 전환 (재시험 일정 통보 대기)
  g.trial.status = 'WAITING';
  // 운영자 판단 이력 기록
  g.trial.retryDecisions = g.trial.retryDecisions || [];
  g.trial.retryDecisions.push({
    decidedAt: nowStr(),
    afterAttemptNo: (g.trial.history?.length || 0),
    note,
    decidedBy: '운영자',
  });
  closeModal('commonModal');
  rmOpenDetail(gid, 'trial');
  rmApplyFilter();
  refreshSidebarBadges();
  showToast('재시험 대기 상태로 전환되었습니다. KPX 재시험 일정 통보를 기다립니다.');
}

/* 자원 삭제 확인 (FAILED 자원의 등록 포기) — 기존 rmDeleteGroup 플로우 재활용 */
function rmDeleteGroupConfirm(gid){
  const g = groupById(gid); if(!g) return;
  $('cm-title').textContent = '자원 삭제 (등록 포기)';
  $('cm-sub').textContent = `${g.name}`;
  $('cm-body').innerHTML = `<div class="info-box danger">
    <b>자원그룹을 시스템에서 완전히 삭제합니다.</b><br>
    이 자원은 상용 감축지시 대상에서 제외되며, 시험 이력을 포함한 관련 데이터가 함께 제거됩니다.
    되돌릴 수 없으므로 신중히 결정하세요.
  </div>
  <div class="form-row"><label class="form-label">삭제 사유</label>
    <textarea class="form-textarea" id="trial-delete-reason" placeholder="예: 반복 시험 실패, 자원 재구성 불가"></textarea>
  </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-danger" onclick="rmConfirmDeleteFromTrial(${gid})">자원 삭제 확정</button>`;
  openModal('commonModal');
}
function rmConfirmDeleteFromTrial(gid){
  const g = groupById(gid); if(!g) return;
  const reason = $('trial-delete-reason').value.trim() || '사유 미기재';
  // 삭제 전에 사유를 toast에 반영할 수 있도록 기록
  const name = g.name;
  const idx = store.groups.findIndex(x=>x.id===gid);
  if(idx>=0) store.groups.splice(idx, 1);
  closeModal('commonModal');
  rmCloseDetail();
  rmApplyFilter();
  refreshSidebarBadges();
  showToast(`${name} 자원그룹이 삭제되었습니다. (사유: ${reason})`);
}


function rmTabHistoryHtml(g){
  if(!g.reductionHistory?.length) return '<div class="empty">감축이력이 없습니다.</div>';
  return `<div style="font-size:11px;color:var(--text-hint);margin-bottom:10px;">* 감축 모니터링 페이지에서 각 이벤트 상세를 확인할 수 있습니다.</div>
  <div class="hist-list">
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
  // 매핑 가능 조건: 일시중지 상태만 제외 (활성 + 승인대기 모두 허용)
  // 승인대기 상태에서도 등록시험 응시를 위해 참여고객이 필요하므로 매핑 허용
  const canMap = g.status==='active' || g.status==='waiting';
  // 상태별 안내 문구
  const statusHint = g.status==='waiting'
    ? '<div style="font-size:11px;color:var(--text-hint);padding:8px 14px;background:var(--bg);border-radius:var(--radius);margin-bottom:10px;line-height:1.6;">* 등록시험 응시를 위해 <b>승인대기 상태에서도 참여고객 매핑</b>이 가능합니다. 시험 합격 후 활성화 단계로 넘어갑니다.</div>'
    : g.status==='suspended'
    ? '<div style="font-size:11px;color:var(--text-hint);padding:8px 14px;background:var(--bg);border-radius:var(--radius);margin-bottom:10px;line-height:1.6;">* 일시중지 상태에서는 참여고객을 변경할 수 없습니다. 운영 재개 후 변경하세요.</div>'
    : '';

  if(!cust.length){
    if(canMap){
      return `${statusHint}<div class="empty">매핑된 참여고객이 없습니다.<div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="rmOpenMapping(${g.id})">+ 고객 매핑</button></div></div>`;
    }
    return '<div class="empty">참여고객이 없습니다. (일시중지 상태)</div>';
  }
  return `${statusHint}<div class="cust-mini-head">
    <span>고객명</span><span style="text-align:right;">유형</span><span style="text-align:right;">용량 (kW)</span><span style="text-align:center;">상태</span><span style="text-align:center;">-</span>
  </div>
  ${cust.map(c=>`<div class="cust-mini-row">
    <span><div style="font-weight:600;color:var(--navy);">${c.name}</div><div style="font-size:10px;color:var(--text-hint);margin-top:2px;">${c.recno}</div></span>
    <span style="text-align:right;"><span class="badge badge-gray" style="font-size:9px;">${c.drType}</span></span>
    <span style="text-align:right;font-weight:600;color:var(--blue);">${(c.reduction||0).toLocaleString()}</span>
    <span style="text-align:center;"><span class="badge badge-done" style="font-size:9px;">ACTIVE</span></span>
    <span style="text-align:center;">
      ${canMap?`<button class="btn btn-danger btn-sm" onclick="rmUnmap(${g.id},'${c.id}')">제거</button>`:'-'}
    </span>
  </div>`).join('')}
  ${canMap?`<div style="padding:12px 14px;text-align:center;"><button class="btn btn-secondary btn-sm" onclick="rmOpenMapping(${g.id})">+ 고객 매핑 추가</button></div>`:''}`;
}

function rmRenderDetailFooter(g){
  const footer = $('rm-d-footer');
  const btns = [];
  if(g.status==='waiting'){
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
    btns.push(`<button class="btn btn-danger btn-sm" onclick="rmDeleteGroup(${g.id})">삭제</button>`);
    btns.push(`<button class="btn btn-success btn-sm" onclick="rmActivate(${g.id})" ${canActivate?'':'disabled'} title="${canActivate?'':disableReason}">활성 전환</button>`);
  } else if(g.status==='active'){
    btns.push(`<button class="btn btn-secondary btn-sm" onclick="rmSuspend(${g.id})">일시중지</button>`);
    btns.push(`<button class="btn btn-primary btn-sm" onclick="rmOpenMapping(${g.id})">+ 고객 매핑</button>`);
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
  $('cm-body').innerHTML = `<div class="info-box warning">일시중지된 자원은 감축지시 대상에서 제외됩니다. 단, 계량 데이터 수집은 계속됩니다.</div>
    <div class="form-row"><label class="form-label">중지 사유 <span class="req">*</span></label>
      <select class="form-select" id="sus-reason">
        <option value="">사유 선택</option>
        <option value="계량 장애">계량 장애</option>
        <option value="참여고객 대량 이탈">참여고객 대량 이탈</option>
        <option value="정기 점검">정기 점검</option>
        <option value="재심사">재심사</option>
        <option value="기타">기타</option>
      </select>
    </div>
    <div class="form-row"><label class="form-label">상세 사유</label><textarea class="form-textarea" id="sus-detail" placeholder="상세 사유를 입력하세요"></textarea></div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="rmConfirmSuspend(${gid})">일시중지</button>`;
  openModal('commonModal');
}
function rmConfirmSuspend(gid){
  const reason = $('sus-reason').value;
  if(!reason){ showToast('중지 사유를 선택하세요.'); return; }
  const detail = $('sus-detail').value.trim();
  const g = groupById(gid);
  g.status = 'suspended';
  g.suspendReason = {type:reason, detail, at:nowStr()};
  closeModal('commonModal');
  rmApplyFilter();
  rmOpenDetail(gid);
  showToast(`${g.name} 일시중지 처리`);
}
function rmResume(gid){
  const g = groupById(gid);
  g.status = 'active';
  delete g.suspendReason;
  rmApplyFilter();
  rmOpenDetail(gid);
  showToast(`${g.name} 운영 재개`);
}
function rmDeleteGroup(gid){
  const g = groupById(gid);
  $('cm-title').textContent = '자원그룹 삭제';
  $('cm-sub').textContent = `${g.name}`;
  $('cm-body').innerHTML = `<div class="info-box danger">자원그룹을 삭제하면 참여고객 매핑 정보 및 신청서 파일이 모두 제거됩니다. 복구할 수 없습니다.</div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-danger" onclick="rmConfirmDelete(${gid})">삭제</button>`;
  openModal('commonModal');
}
function rmConfirmDelete(gid){
  const idx = store.groups.findIndex(g=>g.id===gid);
  if(idx>-1) store.groups.splice(idx,1);
  closeModal('commonModal');
  rmCloseDetail();
  rmApplyFilter();
  refreshSidebarBadges();
  showToast('자원그룹이 삭제되었습니다.');
}
function rmOpenBulkDelete(){
  if(rmState.bulkSelected.size===0) return;
  const ids = [...rmState.bulkSelected];
  $('cm-title').textContent = '자원그룹 일괄 삭제';
  $('cm-sub').textContent = `선택된 ${ids.length}개 자원그룹을 삭제합니다.`;
  $('cm-body').innerHTML = `<div class="info-box danger">삭제된 자원그룹은 복구할 수 없습니다.</div>
    <div style="max-height:140px;overflow-y:auto;font-size:11px;color:var(--text-sub);">
      ${ids.map(id=>{ const g=groupById(id); return `<div>• ${g.name}</div>`; }).join('')}
    </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-danger" onclick="rmConfirmBulkDelete()">삭제</button>`;
  openModal('commonModal');
}
function rmConfirmBulkDelete(){
  [...rmState.bulkSelected].forEach(id=>{
    const idx = store.groups.findIndex(g=>g.id===id);
    if(idx>-1) store.groups.splice(idx,1);
  });
  const cnt = rmState.bulkSelected.size;
  rmState.bulkSelected.clear();
  closeModal('commonModal');
  rmApplyFilter();
  refreshSidebarBadges();
  showToast(`${cnt}개 자원그룹이 삭제되었습니다.`);
}

/* 고객 매핑 */
function rmOpenMapping(gid){
  const g = groupById(gid); if(!g) return;
  if(g.status!=='active'){ showToast('활성 상태의 자원그룹만 고객 매핑이 가능합니다.'); return; }
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
  const target = g.reg?.mandatoryCapacity || g.reg?.estimatedCapacity || g.reg?.increaseCapacity || 0;
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
  const target = g.reg?.mandatoryCapacity || g.reg?.estimatedCapacity || g.reg?.increaseCapacity || 0;
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
        <div style="font-size:11px;color:var(--text-sub);margin-top:8px;">
          의무감축용량을 초과하면 정산 시 초과분은 인정되지 않을 수 있습니다. 그래도 진행하시겠습니까?
        </div>`;
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
  $('cm-body').innerHTML = `<div class="info-box warning">제거된 고객은 자원 풀에는 남아있으며, 다른 자원그룹에 다시 매핑할 수 있습니다.</div>`;
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
