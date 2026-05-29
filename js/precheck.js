/* ════════════════════════════════════════════════════════════
   PRECHECK — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

const pcState = { filter:{status:'',data:'',type:'',q:''}, currentId:null };

const pcStepDefs = [
  {key:'ext',   name:'외부데이터 조회', desc:'한전·파워플래너 연동',            auto:false},
  {key:'infra', name:'인프라 검증',      desc:'AMI/RTU 설치·통신 확인',          auto:false},
  {key:'smd',   name:'SMD 데이터 분석',  desc:'SMD 기기 설치·데이터 수집 확인',  auto:false},
  {key:'mali',  name:'악의성 검증',      desc:'이상 사용 패턴 확인 (자동)',       auto:true},
  {key:'rrmse', name:'RRMSE 분석',       desc:'사용 패턴 오차 분석 (자동)',       auto:true},
  {key:'cbl',   name:'CBL 분석',         desc:'기준부하 산정 및 유형 선택',       auto:false},
];

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

// 6단계 검증 진행률 progress bar HTML (사업장 단위 또는 단일 사업자)
function pcStepBarHtml(steps){
  const done = steps.filter(s=>s===2).length;
  const total = 6;
  const pct = Math.round(done/total*100);
  const barColor = done===total ? 'var(--green)' : done===0 ? 'var(--border-dark)' : 'var(--blue)';
  return `<div style="display:flex;align-items:center;gap:6px;"><div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;"></div></div><span style="font-size:11px;color:var(--text-hint);white-space:nowrap;">${done}/${total}</span></div>`;
}

// 사업자 단위 검증 진행 — "X/N 사업장 완료" (사업장 다수 사업자에서 사용)
function pcBusinessBarHtml(sites){
  const total = sites.length;
  const done = sites.filter(s => Array.isArray(s.steps) && s.steps.every(x => x===2)).length;
  const pct = total>0 ? Math.round(done/total*100) : 0;
  const barColor = done===total ? 'var(--green)' : done===0 ? 'var(--border-dark)' : 'var(--blue)';
  return `<div style="display:flex;align-items:center;gap:6px;"><div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;"></div></div><span style="font-size:11px;color:var(--text-hint);white-space:nowrap;">${done}/${total} 사업장</span></div>`;
}

function pcRenderTable(){
  pcRefreshCards();
  const list = pcFilteredList();
  const tbody = $('pc-tbody'); tbody.innerHTML = '';
  let siteTotal = 0;
  list.forEach(c=>{
    const hasSites = Array.isArray(c.sites) && c.sites.length > 0;
    siteTotal += hasSites ? c.sites.length : 1;
    // ───── 사업자 행 ─────
    const tr = document.createElement('tr');
    tr.className = 'business-row' + (hasSites ? ' has-children' : '');
    tr.dataset.bizId = c.id;
    const accordionIcon = hasSites
      ? `<span class="accordion-icon" style="display:inline-block;width:12px;color:var(--text-hint);font-size:10px;">▶</span> `
      : '<span style="display:inline-block;width:12px;"></span> ';
    const siteCountBadge = hasSites
      ? ` <span style="color:var(--text-hint);font-size:11px;font-weight:400;">· ${c.sites.length}사업장</span>`
      : '';
    tr.innerHTML = `
      <td><span class="company-name">${accordionIcon}${c.name}${siteCountBadge}</span></td>
      <td>${c.ceo}</td>
      <td>${c.tel}</td>
      <td>${c.addr}</td>
      <td style="font-family:monospace;font-size:11px;">${c.recno}</td>
      <td style="text-align:center;"><span class="badge badge-gray">${c.drType}</span></td>
      <td style="text-align:center;">${c.inflow==='사이트'?'<span class="badge badge-progress">사이트</span>':'<span class="badge badge-purple">영업</span>'}</td>
      <td style="text-align:center;">${hasSites ? pcBusinessBarHtml(c.sites) : pcStepBarHtml(c.steps)}</td>
      <td style="text-align:center;font-variant-numeric:tabular-nums;">${c.date}</td>
      <td style="text-align:center;"><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();pcShowDetail('${c.id}')">상세</button></td>`;
    // 사업장 다수 → 행 클릭 = 아코디언 토글 (상세는 [상세] 버튼으로만)
    // 사업장 단일 → 행 클릭 = 상세 이동 (기존 동작)
    tr.style.cursor = 'pointer';
    if(hasSites){
      tr.onclick = (e)=>{ if(e.target.tagName!=='BUTTON') pcToggleBusiness(c.id); };
    } else {
      tr.onclick = (e)=>{ if(e.target.tagName!=='BUTTON') pcShowDetail(c.id); };
    }
    tbody.appendChild(tr);
    // ───── 사업장 자식 행들 (기본 숨김) ─────
    if(hasSites){
      c.sites.forEach(s=>{
        const trSite = document.createElement('tr');
        trSite.className = 'site-row';
        trSite.dataset.parentId = c.id;
        trSite.style.display = 'none';
        trSite.style.background = 'var(--grey50)';
        trSite.innerHTML = `
          <td style="padding-left:32px;color:var(--grey700);">
            <span style="color:var(--text-hint);">└</span> ${s.siteName}
          </td>
          <td style="color:var(--grey700);">${s.manager||'—'}</td>
          <td style="color:var(--grey700);">${s.tel||'—'}</td>
          <td style="color:var(--grey700);">${s.addr}</td>
          <td style="font-family:monospace;font-size:11px;color:var(--grey700);">KEPCO ${s.kepco}</td>
          <td style="text-align:center;color:var(--text-hint);">—</td>
          <td style="text-align:center;color:var(--text-hint);">—</td>
          <td style="text-align:center;">${pcStepBarHtml(s.steps)}</td>
          <td style="text-align:center;font-variant-numeric:tabular-nums;color:var(--grey700);">${s.date}</td>
          <td style="text-align:center;"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();pcShowDetailWithSite('${c.id}','${s.id}')">상세</button></td>`;
        tbody.appendChild(trSite);
      });
    }
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
  $('pc-d-name').textContent = c.name;
  $('pc-d-recno').textContent = c.recno;
  $('pc-d-ceo').textContent = c.ceo;
  $('pc-d-tel').textContent = c.tel;
  $('pc-d-addr').textContent = c.addr;
  $('pc-d-date').textContent = c.date;
  $('pc-d-power').textContent = (c.power||'-') + ' kW';
  $('pc-d-drtype').textContent = c.drType;
  $('pc-r-cbl-type').textContent = c.cblType||'-';
  $('pc-r-cbl-avg').textContent = c.cblAvg||'-';
  $('pc-r-rrmse').textContent = c.rrmseVal||'-';
  $('pc-r-infra').textContent = c.infraS||'-';
  $('pc-r-reduction').textContent = c.reduction? c.reduction+' kW':'-';
  $('pc-r-ext').textContent = c.extS||'-';
  pcRenderSteps(c);
  pcRenderMemo(c);
  pcRenderDetailLog(c);
  pcUpdateContractBtn(c);
  // 사업장 탭: 사업장 2개 이상일 때만 표시
  const sitesTabBtn = $('pc-tab-sites-btn');
  if(sitesTabBtn){
    if(Array.isArray(c.sites) && c.sites.length >= 2){
      sitesTabBtn.style.display = '';
      sitesTabBtn.textContent = `사업장 (${c.sites.length})`;
      pcRenderSitesTab(c);
    } else {
      sitesTabBtn.style.display = 'none';
    }
  }
  pcSwitchTab('info');
}
// 사업장 행 [상세]: 사업자 상세 진입 → 사업장 탭 → 해당 사업장 선택
function pcShowDetailWithSite(bizId, siteId){
  pcShowDetail(bizId);
  pcSwitchTab('sites');
  pcSelectSite(bizId, siteId);
}

function pcSwitchTab(tab){
  $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
  $('pc-tab-info').style.display = tab==='info'?'grid':'none';
  $('pc-tab-log').style.display  = tab==='log' ?'grid':'none';
  const sitesTab = $('pc-tab-sites');
  if(sitesTab) sitesTab.style.display = tab==='sites'?'grid':'none';
}

// 사업장 탭 렌더링: 좌측 리스트 + 첫 사업장 자동 선택
function pcRenderSitesTab(c){
  const list = $('pc-sites-list'); list.innerHTML = '';
  if(!Array.isArray(c.sites) || c.sites.length===0) return;
  $('pc-sites-count').textContent = `총 ${c.sites.length}사업장`;
  c.sites.forEach((s, idx) => {
    const done = Array.isArray(s.steps) ? s.steps.filter(x=>x===2).length : 0;
    const isDone = done===6;
    const item = document.createElement('div');
    item.className = 'site-list-item';
    item.dataset.siteId = s.id;
    item.style.cssText = 'padding:10px 12px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:#fff;transition:all .15s ease;';
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="font-weight:600;font-size:13px;color:var(--navy);">${s.siteName}</div>
        <span class="badge ${isDone?'badge-done':'badge-progress'}" style="font-size:10px;">${done}/6</span>
      </div>
      <div style="font-size:11px;color:var(--text-hint);margin-top:3px;font-family:monospace;">KEPCO ${s.kepco}</div>
    `;
    item.onclick = () => pcSelectSite(c.id, s.id);
    list.appendChild(item);
  });
  // 첫 사업장 자동 선택
  pcSelectSite(c.id, c.sites[0].id);
}

function pcSelectSite(bizId, siteId){
  const c = custById(bizId); if(!c) return;
  const s = (c.sites||[]).find(x=>x.id===siteId); if(!s) return;
  // active 스타일 토글
  document.querySelectorAll('.site-list-item').forEach(el => {
    const isActive = el.dataset.siteId === siteId;
    el.style.background = isActive ? 'var(--blue-light)' : '#fff';
    el.style.borderColor = isActive ? 'var(--blue)' : 'var(--border)';
  });
  // 우측 상세 렌더
  const done = Array.isArray(s.steps) ? s.steps.filter(x=>x===2).length : 0;
  $('pc-site-detail').innerHTML = `
    <div class="r-card">
      <div class="r-card-header"><div class="r-card-title">${s.siteName}</div></div>
      <div class="r-card-body">
        <table class="info-table">
          <tbody>
            <tr><td>사업장 책임자</td><td>${s.manager||'—'}</td></tr>
            <tr><td>현장 연락처</td><td>${s.tel||'—'}</td></tr>
            <tr><td>주소</td><td>${s.addr||'—'}</td></tr>
            <tr><td>KEPCO 고객번호</td><td style="font-family:monospace;">${s.kepco}</td></tr>
            <tr><td>계약전력</td><td>${s.power||'—'} kW</td></tr>
            <tr><td>등록일</td><td>${s.date||'—'}</td></tr>
            <tr><td>검증 진행</td><td><b>${done} / 6 단계</b></td></tr>
            <tr><td>검증 상태</td><td><span class="badge ${done===6?'badge-done':'badge-progress'}">${s.verifyStatus||'—'}</span></td></tr>
            <tr><td>데이터 수집</td><td>${s.dataStatus||'—'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function pcRenderSteps(c){
  const list = $('pc-steps-list'); list.innerHTML='';
  let done = 0;
  pcStepDefs.forEach((s,i)=>{
    const st = c.steps[i];
    // 잠금조건: 순차 실행 (SMD(2): infra(1) 완료 필요, 악의성(3): 앞 3단계 필요, RRMSE(4): 악의성 필요, CBL(5): RRMSE 필요)
    const isLocked = (i===2 && c.steps[1]!==2)
                 || (i===3 && !(c.steps[0]===2 && c.steps[1]===2 && c.steps[2]===2))
                 || (i===4 && c.steps[3]!==2)
                 || (i===5 && c.steps[4]!==2);
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
  $('pc-step-count').textContent = `${done} / 6`;
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
    return `<div class="info-box">AMI 계량기 및 RTU 설치·통신 상태를 확인합니다.</div>
    <div class="form-row"><label class="form-label">AMI 계량기 설치</label>
      <select class="form-select" id="infra-ami"><option value="설치">설치</option><option value="미설치">미설치</option><option value="설치예정">설치예정</option></select>
    </div>
    <div class="form-row"><label class="form-label">RTU 통신</label>
      <div style="display:flex;gap:8px;"><input class="form-input" id="infra-rtu" placeholder="RTU ID" style="flex:1"><button class="btn btn-primary btn-sm" onclick="pcCheckRtu()">조회</button></div>
    </div>
    <div id="infra-rtu-box"></div>`;
  }
  if(key==='smd'){
    return `<div class="info-box">SMD(Smart Metering Device) 기기 설치 여부와 수집 데이터를 확인합니다.</div>
    <div class="form-row"><label class="form-label">SMD 기기 설치 상태</label>
      <select class="form-select"><option>설치완료</option><option>설치중</option><option>미설치</option></select>
    </div>
    <div class="form-row"><label class="form-label">기기 ID</label>
      <div style="display:flex;gap:8px;"><input class="form-input" id="smd-id" placeholder="SMD 기기 ID" style="flex:1"><button class="btn btn-primary btn-sm" onclick="pcCheckSmd()">조회</button></div>
    </div>
    <div id="smd-result-box"></div>`;
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

function pcCheckRtu(){
  const id = $('infra-rtu')?.value?.trim();
  if(!id){ showToast('RTU ID를 입력하세요.'); return; }
  $('infra-rtu-box').innerHTML = `<div class="info-box success" style="margin-top:10px;">RTU 통신 정상 · 실시간 데이터 수신 중</div>`;
}
function pcCheckSmd(){
  const id = $('smd-id')?.value?.trim();
  if(!id){ showToast('SMD 기기 ID를 입력하세요.'); return; }
  $('smd-result-box').innerHTML = `<div class="info-box success" style="margin-top:10px;">SMD 통신 정상 · 15분 데이터 수신 중 · 완결성 98.7%</div>`;
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

/* 리드 신규 등록 */
function pcCreateLead(){
  const name=$('rg-name').value.trim(), ceo=$('rg-ceo').value.trim(), tel=$('rg-tel').value.trim();
  const addr=$('rg-addr').value.trim(), power=parseInt($('rg-power').value)||0;
  const drType=$('rg-drtype').value, inflow=$('rg-inflow').value;
  if(!name||!ceo||!tel||!power||!drType){ showToast('필수 항목을 모두 입력하세요.'); return; }
  const d=new Date(), pad=n=>String(n).padStart(2,'0');
  const ymd = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  // 접수번호 자동 생성 (DR-YYYY-NNNN)
  const maxSeq = store.customers
    .map(c=>parseInt(c.recno.split('-')[2])||0)
    .reduce((m,v)=>Math.max(m,v),0);
  const recno = `DR-${d.getFullYear()}-${String(maxSeq+1).padStart(4,'0')}`;
  // 기존 고객 ID 중 최대값 + 1 (최소값 200 보장)
  const maxCid = store.customers
    .map(c=>parseInt((c.id||'').replace(/\D/g,''))||0)
    .reduce((m,v)=>Math.max(m,v),0);
  const newId = 'C'+String(Math.max(200, maxCid+1)).padStart(3,'0');
  const newCustomer = {
    id:newId, name, ceo, tel, addr, recno, date:ymd, power, kepco:'',
    drType, status:'검증대기', dataStatus:'미수집', inflow,
    steps:[1,1,1,1,1,1], extS:'미실행', rrmseS:'미실행', cblS:'미실행',
    cblType:'-', cblAvg:'-', reduction:null, rrmseVal:'-', infraS:'-'
  };
  store.customers.unshift(newCustomer);
  pcAddLog(newCustomer, '리드 등록', `${name} (${recno}) 신규 등록`, 'done');
  closeModal('registerModal');
  ['rg-name','rg-ceo','rg-tel','rg-addr','rg-power'].forEach(id=>$(id).value='');
  $('rg-drtype').value=''; $('rg-inflow').value='사이트';
  pcRenderTable();
  refreshSidebarBadges();
  showToast(`${name} 등록 완료 (${recno})`);
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
    c.contractHistory = [{
      time: `${ctTodayStr()} 09:00`,
      title: '계약관리 대상 생성',
      desc: c.status==='계약완료' ? '사전검증 완료 후 계약완료 고객으로 이관됨' : '사전검증 완료/반려 고객 기준으로 계약관리 대상화',
      tone: c.status==='반려' ? 'fail' : 'done'
    }];
  }
}
function ctGetStage(c){
  ctEnsureCustomerMeta(c);
  return c.contractStage || (c.status==='계약완료' ? '계약완료' : c.status==='반려' ? '반려' : c.status==='검증완료' ? '계약대기' : '');
}
function ctStageBadge(stage){
  if(stage==='계약대기') return 'badge-pending';
  if(stage==='검토중') return 'badge-progress';
  if(stage==='계약완료') return 'badge-done';
  if(stage==='반려') return 'badge-fail';
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
    const matchQ = !q || [c.name,c.recno,c.kepco,c.id,c.addr].join(' ').toLowerCase().includes(q);
    const matchType = !type || c.drType===type;
    const matchStage = !stage || s===stage;
    return matchQ && matchType && matchStage;
  });
}
function ctInit(){
  ctRenderSummary();
  ctRenderTable();
}
function ctRenderSummary(){
  const rows = ctEligibleCustomers();
  const count = (stage)=>rows.filter(c=>ctGetStage(c)===stage).length;
  $('ct-kpi-total').textContent = rows.length;
  $('ct-kpi-pending').textContent = count('계약대기');
  $('ct-kpi-review').textContent = count('검토중');
  $('ct-kpi-approved').textContent = count('계약완료');
  $('ct-kpi-rejected').textContent = count('반려');
}
function ctRenderTable(){
  const rows = ctFilteredCustomers();
  const tbody = $('ct-tbody');
  const empty = $('ct-empty');
  tbody.innerHTML = rows.map(c=>{
    const stage = ctGetStage(c);
    const ci = c.contractInfo || {};
    return `<tr onclick="ctOpenDetail('${c.id}')">
      <td>
        <div class="ct-name">${c.name}</div>
        <div class="ct-sub">${c.recno} · 고객번호 ${c.kepco||'-'}</div>
      </td>
      <td>${c.drType}</td>
      <td><span class="badge ${statusBadgeClass(c.status)}">${c.status}</span></td>
      <td><span class="badge ${ctStageBadge(stage)}">${stage}</span></td>
      <td>${(ci.mandatoryCapacity||0).toLocaleString()} kW</td>
      <td>${ci.startDate||'-'} ~ ${ci.endDate||'-'}</td>
      <td style="text-align:center;"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();ctOpenDetail('${c.id}')">상세보기</button></td>
    </tr>`;
  }).join('');
  empty.style.display = rows.length ? 'none' : 'block';
  $('ct-row-count').textContent = `총 ${rows.length}건`;
}
function ctResetFilters(){
  $('ct-search').value = '';
  $('ct-filter-type').value = '';
  $('ct-filter-status').value = '';
  ctRenderTable();
}
function ctOpenDetail(id){
  const c = store.customers.find(x=>x.id===id); if(!c) return;
  ctEnsureCustomerMeta(c);
  ctCurrentId = id;
  $('ct-d-title').textContent = c.name;
  $('ct-d-sub').innerHTML = `${c.recno} · ${c.drType} · <span class="badge ${ctStageBadge(ctGetStage(c))}">${ctGetStage(c)}</span>`;
  $('ct-tab-basic').style.display = '';
  $('ct-tab-docs').style.display = 'none';
  $('ct-tab-history').style.display = 'none';
  $$('#ctDetailPanel [data-ct-tab]').forEach((el,i)=>el.classList.toggle('active', i===0));

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
      <div class="ct-basic-section">
        <div class="ct-basic-section-title">계약 검토정보</div>
        <div class="ct-spec-frame">
          <table class="ct-spec-table">
            <colgroup>
              <col class="label">
              <col>
            </colgroup>
            <tbody>
              <tr><td class="label">계약 상태</td><td><span class="badge ${ctStageBadge(ctGetStage(c))}">${ctGetStage(c)}</span></td></tr>
              <tr><td class="label">계약전력</td><td class="num">${(c.power||0).toLocaleString()} kW</td></tr>
              <tr><td class="label">예상 감축량</td><td class="num">${(c.reduction||0).toLocaleString()} kW</td></tr>
              <tr><td class="label">수수료율</td><td class="num">${c.contractInfo.feeRate}%</td></tr>
              <tr><td class="label">의무감축용량</td><td class="num">${c.contractInfo.mandatoryCapacity.toLocaleString()} kW</td></tr>
              <tr><td class="label">계약기간</td><td class="mono">${c.contractInfo.startDate} ~ ${c.contractInfo.endDate}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  $('ct-tab-docs').innerHTML = `
    <div class="r-card ct-doc-card" style="margin-bottom:12px;">
      <div class="r-card-header"><div class="r-card-title">계약 조건</div></div>
      <div class="r-card-body">
        <div class="ct-doc-edit">
          <div class="form-row" style="margin:0;">
            <label class="form-label">계약 시작일</label>
            <input class="form-input" type="date" id="ct-contract-start" value="${c.contractInfo.startDate}">
          </div>
          <div class="form-row" style="margin:0;">
            <label class="form-label">계약 종료일</label>
            <input class="form-input" type="date" id="ct-contract-end" value="${c.contractInfo.endDate}">
          </div>
          <button class="btn btn-primary" onclick="ctSaveContractPeriod('${c.id}')">저장</button>
        </div>
      </div>
    </div>
    <div class="r-card ct-doc-card">
      <div class="r-card-header"><div class="r-card-title">계약 서류</div></div>
      <div class="r-card-body">
        <table class="ct-doc-table">
          <thead><tr><th>서류명</th><th>필수</th><th>파일</th><th>상태</th></tr></thead>
          <tbody>
            ${c.contractDocs.map(d=>`<tr>
              <td>${d.name}</td>
              <td>${d.required ? '<span style="color:var(--red);font-weight:600;">필수</span>' : '선택'}</td>
              <td>${d.fileName || '<span style="color:var(--text-hint);font-style:italic;">— 미제출</span>'}</td>
              <td><span class="badge ${d.status==='승인'?'badge-done':d.status==='제출완료'?'badge-progress':'badge-gray'}">${d.status}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  $('ct-tab-history').innerHTML = c.contractHistory.map(h=>`
    <div class="ct-history-item">
      <div class="ct-history-dot" style="background:${h.tone==='fail'?'var(--red)':h.tone==='wait'?'var(--amber)':'var(--blue)'};"></div>
      <div class="ct-history-time">${h.time}</div>
      <div class="ct-history-body">${h.title}<div class="ct-history-sub">${h.desc||''}</div></div>
    </div>`).join('');

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
  if(!startDate || !endDate){ showToast('계약 시작일과 종료일을 입력하세요.'); return; }
  if(startDate > endDate){ showToast('계약 종료일은 시작일 이후여야 합니다.'); return; }
  c.contractInfo.startDate = startDate;
  c.contractInfo.endDate = endDate;
  ctAddHistory(c, '계약기간 수정', `${startDate} ~ ${endDate}`, 'done');
  ctAfterChange('계약기간이 저장되었습니다.');
  ctOpenDetail(id);
  ctSwitchTab('docs', document.querySelector('#ctDetailPanel [data-ct-tab="docs"]'));
}
function ctAddHistory(c, title, desc='', tone='done'){
  ctEnsureCustomerMeta(c);
  c.contractHistory.unshift({ time: `${ctTodayStr()} 14:00`, title, desc, tone });
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
