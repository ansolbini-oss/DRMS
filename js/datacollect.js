/* ════════════════════════════════════════════════════════════
   DATACOLLECT — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

function dcRouteFromDashboard(typeKey){
  // DR 유형에 속하는 첫 활성 그룹 ID 추출
  const g = store.groups.find(x=>x.typeKey===typeKey && x.status==='active');
  navigate('datacollect');
  setTimeout(()=>{
    if(g){
      dcState.groupId = g.id;
      const sel = $('dc-group');
      if(sel) sel.value = g.id;
    }
    dcRender();
  }, 100);
}

/* 시계 */
const dcState = {
  range:'7d',
  from:null, to:null,
  groupId:'all',
  status:'all',
  q:'',
  expandedGroupId:null,
  expandedBizIds:{},   // Phase 13: 사업자별 사업장 펼침 상태 {custId: true/false}
  // [v0.7] 계량 채널 탭 — 정책서 2343436292 §1-2
  //   'ami' = 한전AMI(전력량계) 15분, 정산 기준
  //   'rtu' = RTU(감시기기) 5분, 정산 근거 아님·상시 수신 품질 추적
  channel:'ami',
};
function dcChannelMeta(){
  return dcState.channel === 'rtu'
    ? {label:'RTU(5분)', stepMin:5, slotsPerDay:288, source:'RTU(감시기기)', purpose:'정산 근거 아님 · 상시 수신 품질 추적'}
    : {label:'한전AMI(15분)', stepMin:15, slotsPerDay:96, source:'한전AMI(전력량계, 한전OPM)', purpose:'정산 투입 원천 데이터'};
}
function dcSwitchChannel(ch){
  if(ch!=='ami' && ch!=='rtu') return;
  if(dcState.channel === ch) return;
  dcState.channel = ch;
  dcState.expandedGroupId = null;
  dcState.expandedBizIds = {};
  dcRender();
}

// Phase 13: 사업자 행 펼침 토글 (사업장 sub-행 노출)
function dcToggleBizSites(custId){
  dcState.expandedBizIds = dcState.expandedBizIds || {};
  dcState.expandedBizIds[custId] = !dcState.expandedBizIds[custId];
  dcRender();
}

function dcInit(){
  // 페이지 진입 시 항상 목록뷰로 복귀
  const listV = $('dc-list-view'), detailV = $('dc-detail-view');
  if(listV && detailV){
    listV.style.display = 'flex';
    detailV.style.display = 'none';
  }
  // 자원그룹 옵션 채우기 (hidden select, 호환성 유지)
  const gSel = $('dc-group');
  if(gSel){
    const current = dcState.groupId || 'all';
    gSel.innerHTML = '<option value="all">전체</option>' +
      store.groups.filter(g=>g.status==='active').map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
    gSel.value = current;
  }
  // [v0.7 필터 슬림] 조회기간·데이터상태 UI 제거 — dcState 기본값(range='7d', status='all') 그대로 사용
  if($('dc-range')) $('dc-range').value = dcState.range;
  dcApplyRange(false);
  dcRender();
  // [Phase 17-J] 사전검증 [수동 업로드]에서 진입한 경우 자동으로 업로드 모달 오픈
  if(dcState.pendingUpload){
    const ctx = dcState.pendingUpload;
    dcState.pendingUpload = null;  // 소비
    setTimeout(()=> dcOpenUploadModal(ctx), 100);
  }
}

/* ════════════════════════════════════════════════════════════
   [Phase 17-J] 엑셀 수동 업로드 — 한전 AMI 통신 실패 시 우회 경로
   ════════════════════════════════════════════════════════════ */

// 업로드 모달 오픈. ctx={bizId, siteId, kepco} 형태로 사전검증에서 전달 시 자동 채움.
function dcOpenUploadModal(ctx){
  const activeGroups = store.groups.filter(g=>g.status==='active');
  const preGroupId = ctx?.groupId ? String(ctx.groupId) : '';
  const preCustId  = ctx?.bizId || '';
  const preSiteId  = ctx?.siteId || '';
  const preKepco   = ctx?.kepco || '';

  // 자원그룹 옵션
  const groupOpts = activeGroups.map(g =>
    `<option value="${g.id}" ${String(g.id)===preGroupId?'selected':''}>${g.name}</option>`
  ).join('');

  // 사업자 옵션 (기본: 전체 customer 중 계약완료)
  const custOpts = store.customers
    .filter(c => c.status === '계약완료')
    .map(c => `<option value="${c.id}" ${c.id===preCustId?'selected':''}>${c.name}</option>`)
    .join('');

  $('cm-title').textContent = '엑셀 데이터 업로드';
  $('cm-sub').textContent = '한전 AMI 통신 실패 시 운영자가 직접 계량 데이터 엑셀 파일을 업로드합니다.';
  $('cm-body').innerHTML = `<div class="info-box" style="margin-bottom:12px;">
    ⓘ 업로드 양식: 15분 단위 슬롯 데이터 (시각, kW). 첨부 파일은 검증 후 시스템에 반영됩니다.
    <a href="#" onclick="event.preventDefault();dcDownloadTemplate();" style="margin-left:8px;color:var(--blue);text-decoration:underline;">양식 다운로드</a>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;">
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">자원그룹 <span style="color:var(--red);">*</span></label>
      <select id="dc-up-group" class="filter-select" style="width:100%;" onchange="dcOnUploadGroupChange()">
        <option value="">선택하세요</option>${groupOpts}
      </select>
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">사업자 <span style="color:var(--red);">*</span></label>
      <select id="dc-up-cust" class="filter-select" style="width:100%;" onchange="dcOnUploadCustChange()">
        <option value="">선택하세요</option>${custOpts}
      </select>
    </div>
    <div id="dc-up-site-wrap" style="display:${preSiteId?'block':'none'};">
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">사업장</label>
      <select id="dc-up-site" class="filter-select" style="width:100%;"></select>
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">KEPCO 고객번호</label>
      <input id="dc-up-kepco" type="text" value="${preKepco}" placeholder="자동 채워짐"
        style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;" readonly>
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">엑셀 파일 <span style="color:var(--red);">*</span></label>
      <input id="dc-up-file" type="file" accept=".xlsx,.xls,.csv"
        style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box;background:#fff;">
      <div style="font-size:10px;color:var(--text-hint);margin-top:4px;">.xlsx, .xls, .csv (최대 10MB)</div>
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">업로드 사유</label>
      <textarea id="dc-up-reason" placeholder="예: 한전 AMI 통신 장애로 수동 업로드"
        style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:12px;min-height:60px;box-sizing:border-box;resize:vertical;"></textarea>
    </div>
  </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="dcDoUpload()">업로드 실행</button>`;
  openModal('commonModal');
  // 사업자 선택 시 사업장 옵션 자동 채움
  if(preCustId) dcOnUploadCustChange();
  if(preSiteId){
    const siteSel = $('dc-up-site');
    if(siteSel){ siteSel.value = preSiteId; }
  }
}

// 자원그룹 선택 시 자원그룹에 매핑된 customer로 사업자 select 갱신
function dcOnUploadGroupChange(){
  const gid = $('dc-up-group')?.value;
  if(!gid) return;
  const g = store.groups.find(x=>String(x.id)===String(gid));
  if(!g) return;
  const custSel = $('dc-up-cust'); if(!custSel) return;
  const ids = g.customerIds || [];
  const opts = store.customers
    .filter(c => ids.includes(c.id))
    .map(c => `<option value="${c.id}">${c.name}</option>`)
    .join('');
  custSel.innerHTML = '<option value="">선택하세요</option>' + opts;
}

// 사업자 선택 시 사업장 옵션 + KEPCO 자동 채움
function dcOnUploadCustChange(){
  const cid = $('dc-up-cust')?.value;
  if(!cid) return;
  const c = custById(cid); if(!c) return;
  const sites = (typeof pcGetSites === 'function') ? pcGetSites(c) : (c.sites||[]);
  const siteWrap = $('dc-up-site-wrap');
  const siteSel = $('dc-up-site');
  const kepcoInput = $('dc-up-kepco');
  if(sites.length > 1 && siteSel && siteWrap){
    siteWrap.style.display = 'block';
    siteSel.innerHTML = '<option value="">전체 (사업자 단위)</option>' +
      sites.map(s => `<option value="${s.id}" data-kepco="${s.kepco||''}">${s.siteName} (KEPCO ${s.kepco||'-'})</option>`).join('');
    siteSel.onchange = () => {
      const opt = siteSel.selectedOptions[0];
      if(kepcoInput) kepcoInput.value = opt?.dataset?.kepco || '';
    };
  } else if(sites.length === 1){
    if(siteWrap) siteWrap.style.display = 'none';
    if(kepcoInput) kepcoInput.value = sites[0].kepco || c.kepco || '';
  } else {
    if(siteWrap) siteWrap.style.display = 'none';
    if(kepcoInput) kepcoInput.value = c.kepco || '';
  }
}

// 양식 다운로드 (목업 — 안내 토스트)
function dcDownloadTemplate(){
  if(typeof showToast === 'function') showToast('양식 다운로드 — 실 환경에서는 .xlsx 파일이 다운로드됩니다 (목업)');
}

// 업로드 실행 — 시뮬레이션 (1.2초 로딩 → 완료)
function dcDoUpload(){
  const gid = $('dc-up-group')?.value;
  const cid = $('dc-up-cust')?.value;
  const siteId = $('dc-up-site')?.value;
  const file = $('dc-up-file')?.files?.[0];
  const reason = $('dc-up-reason')?.value?.trim() || '';
  if(!gid){ alert('자원그룹을 선택하세요.'); return; }
  if(!cid){ alert('사업자를 선택하세요.'); return; }
  if(!file){ alert('업로드할 엑셀 파일을 선택하세요.'); return; }
  if(file.size > 10 * 1024 * 1024){ alert('파일 크기는 10MB 이하여야 합니다.'); return; }

  const c = custById(cid);
  const g = store.groups.find(x=>String(x.id)===String(gid));

  // 로딩 모달
  $('cm-title').textContent = '엑셀 데이터 업로드 중';
  $('cm-body').innerHTML = `<div style="padding:32px 16px;text-align:center;">
      <div style="display:inline-block;width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--blue);border-radius:50%;animation:dc-up-spin 0.9s linear infinite;"></div>
      <div style="margin-top:14px;font-size:13px;color:var(--text-sub);font-weight:500;">파일 검증·반영 중...</div>
      <div style="margin-top:4px;font-size:11px;color:var(--text-hint);">${file.name} (${(file.size/1024).toFixed(1)} KB)</div>
    </div>
    <style>@keyframes dc-up-spin{to{transform:rotate(360deg);}}</style>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" disabled style="opacity:0.5;cursor:not-allowed;">처리 중...</button>`;

  setTimeout(()=>{
    // 사이트 컨텍스트가 있으면 ext 단계 완료로 마킹
    if(siteId && c){
      const sites = (typeof pcGetSites === 'function') ? pcGetSites(c) : (c.sites||[]);
      const s = sites.find(x=>x.id===siteId);
      if(s){
        // [Phase 17-L] 4단계 정규화 (옛 6 시드 호환)
        if(typeof pcNormalizeSteps === 'function'){ s.steps = pcNormalizeSteps(s.steps); }
        else if(!Array.isArray(s.steps)){ s.steps = [1,1,1,1]; }
        s.steps[0] = 2;  // 외부데이터 조회 = 완료 (수동 업로드로 충족)
        s.extS = '통과 (수동)';
      }
    }
    // 감사 로그
    logAudit?.({
      objectType:'site', objectId: siteId || cid,
      action:'manual_upload_completed',
      title:`엑셀 수동 업로드 — ${c?.name||cid} ${siteId?`(사업장 ${siteId})`:''}`,
      desc:`자원그룹 ${g?.name||gid} · 파일 ${file.name} (${(file.size/1024).toFixed(1)}KB)${reason?' · 사유: '+reason:''}`,
      actor:'운영자', tone:'info'
    });
    // 결과
    $('cm-title').textContent = '업로드 완료';
    $('cm-body').innerHTML = `<div style="background:var(--green-light);border:1px solid var(--green-border);border-radius:var(--radius);padding:18px 16px;display:flex;gap:12px;align-items:flex-start;">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">✓</div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;color:var(--green);">엑셀 업로드 성공</div>
          <div style="font-size:12px;color:var(--text-sub);margin-top:4px;line-height:1.6;">
            ${c?.name||''} ${siteId?'사업장':''} 데이터가 정상 반영되었습니다.<br>
            수동 업로드 이력은 감사 로그에 기록되었습니다.
          </div>
        </div>
      </div>
      <div class="check-item-row" style="margin-top:12px;"><span>파일명</span><span style="font-weight:600;">${file.name}</span></div>
      <div class="check-item-row"><span>자원그룹</span><span>${g?.name||gid}</span></div>
      <div class="check-item-row"><span>사업자</span><span>${c?.name||cid}</span></div>`;
    $('cm-footer').innerHTML = `<button class="btn btn-primary" onclick="closeModal('commonModal');dcRender();">확인</button>`;
    if(typeof showToast === 'function') showToast(`엑셀 업로드 완료 — ${file.name}`);
  }, 1200);
}

function dcApplyRange(doRender){
  // [v0.7 필터 슬림] 조회기간 UI 제거 — dcState.range 기본값 '7d' 고정 사용
  const v = ($('dc-range') && $('dc-range').value) || dcState.range || '7d';
  dcState.range = v;
  const fromEl = $('dc-from'), toEl = $('dc-to');
  const today = new Date();
  const pad = n=>String(n).padStart(2,'0');
  const ymd = d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  let from, to;
  if(v==='today'){ from = to = new Date(today); }
  else if(v==='yesterday'){ const y = new Date(today); y.setDate(y.getDate()-1); from = to = y; }
  else if(v==='7d'){ to = new Date(today); from = new Date(today); from.setDate(from.getDate()-6); }
  else if(v==='30d'){ to = new Date(today); from = new Date(today); from.setDate(from.getDate()-29); }
  else if(fromEl && toEl){ // custom (UI가 있을 때만)
    fromEl.style.display = 'inline-block';
    toEl.style.display = 'inline-block';
    if(!fromEl.value){ const d = new Date(today); d.setDate(d.getDate()-6); fromEl.value = ymd(d); }
    if(!toEl.value) toEl.value = ymd(today);
    dcState.from = fromEl.value; dcState.to = toEl.value;
    if(doRender!==false) dcRender();
    return;
  } else {
    to = new Date(today); from = new Date(today); from.setDate(from.getDate()-6);
  }
  if(fromEl) fromEl.style.display = 'none';
  if(toEl)   toEl.style.display   = 'none';
  dcState.from = ymd(from);
  dcState.to   = ymd(to);
  if(doRender!==false) dcRender();
}

/* 자원그룹 × 기간 집계 */
function dcAggregateGroup(g){
  const from = new Date(dcState.from), to = new Date(dcState.to);
  const meta = dcChannelMeta();
  const custs = (g.customerIds||[]).map(id=>custById(id)).filter(Boolean);
  let totalSlots = 0, missTotal = 0;
  const perCust = custs.map(c=>{
    const days = pcDmGenerateData(c, from, to, {stepMin: meta.stepMin});
    let ts=0, ms=0;
    days.forEach(d=>{ ts += d.slots.length; ms += d.missCnt; });
    totalSlots += ts; missTotal += ms;
    const rxRate = ts ? (ts-ms)/ts : 0;
    // 정책서 3-2-1 기준: 미수신 0건=정상, 1건 이상=이상 (2단계, 보정 개념 폐지)
    const state = ms>0 ? 'risk' : 'ok';
    return { cust:c, totalSlots:ts, missCnt:ms, rxRate, state };
  });
  const rxRate = totalSlots ? (totalSlots-missTotal)/totalSlots : 0;
  const riskCnt = perCust.filter(p=>p.state==='risk').length;
  return { group:g, perCust, totalSlots, missTotal, rxRate, riskCnt };
}

function dcFilteredGroups(){
  const q = ($('dc-q')?.value||'').trim().toLowerCase();
  dcState.q = q;
  // [v0.7 필터 슬림] dc-group·dc-status UI 제거 — 존재 시에만 값 반영, 기본값 유지
  const gSel = $('dc-group');
  if(gSel) dcState.groupId = gSel.value;
  const sSel = $('dc-status');
  if(sSel) dcState.status = sSel.value;
  const activeGroups = store.groups.filter(g=>g.status==='active');
  let targets = activeGroups;
  if(dcState.groupId !== 'all') targets = targets.filter(g=>String(g.id)===String(dcState.groupId));
  if(q){
    targets = targets.filter(g=>{
      if((g.name||'').toLowerCase().includes(q)) return true;
      return (g.customerIds||[]).some(cid=>{
        const c = custById(cid);
        return c && (c.name||'').toLowerCase().includes(q);
      });
    });
  }
  return targets.map(dcAggregateGroup);
}

/* "이상 자원" KPI 카드 클릭 → 이상 필터 적용 */
function dcFilterByRisk(){
  dcState.status = 'risk';
  if($('dc-status')) $('dc-status').value = 'risk';
  dcRender();
}

/* 필터 초기화 (v0.7 슬림 — 검색어 리셋 + 조회기간 기본 7일 + 상태 all) */
function dcResetFilters(){
  dcState.range = '7d';
  dcState.status = 'all';
  dcState.q = '';
  if($('dc-range'))  $('dc-range').value = '7d';
  if($('dc-status')) $('dc-status').value = 'all';
  if($('dc-q'))      $('dc-q').value = '';
  dcApplyRange(false);
  dcRender();
}

function dcRender(){
  const meta = dcChannelMeta();
  // [v0.7] 채널 탭 활성 상태 + 캐비어트 문구
  const chAmi = $('dc-ch-ami'), chRtu = $('dc-ch-rtu');
  if(chAmi) chAmi.classList.toggle('active', dcState.channel==='ami');
  if(chRtu) chRtu.classList.toggle('active', dcState.channel==='rtu');
  const caveat = $('dc-ch-caveat');
  if(caveat){
    caveat.textContent = dcState.channel==='rtu'
      ? '정산 근거 아님 · 이벤트 무관 상시 수신 품질 추적 · 5분 슬롯 (일 288)'
      : '정산 투입 원천 데이터 · 15분 슬롯 (일 96)';
  }
  // RTU 탭에선 엑셀 업로드 불가 (한전AMI 통신 실패 우회용이라 채널 미해당)
  const upBtn = $('dc-btn-upload');
  if(upBtn) upBtn.style.display = dcState.channel==='rtu' ? 'none' : '';

  const aggs = dcFilteredGroups();
  $('dc-range-info').textContent = `${dcState.from} ~ ${dcState.to} · ${aggs.length}개 그룹 · ${meta.label}`;

  // [v0.7 카드 4장 개편] 총자원 · 활성 · 비활성 · 이상자원
  //   - 총/활성/비활성은 store.groups 기준 (조회기간·검색 필터와 무관하게 자원 전체 통계)
  //   - 이상자원은 조회 결과(aggs) 기준 미수신 발생 자원그룹 수
  const activeCnt   = store.groups.filter(g=>g.status==='active').length;
  const inactiveCnt = store.groups.filter(g=>g.status==='inactive').length;
  const totalCnt    = activeCnt + inactiveCnt;
  const riskGroups  = aggs.filter(a=>a.missTotal>0).length;

  if($('dc-kpi-total'))    $('dc-kpi-total').textContent    = totalCnt;
  if($('dc-kpi-active'))   $('dc-kpi-active').textContent   = activeCnt;
  if($('dc-kpi-inactive')) $('dc-kpi-inactive').textContent = inactiveCnt;
  if($('dc-kpi-risk')){
    $('dc-kpi-risk').textContent = riskGroups + '개';
    $('dc-kpi-risk').style.color = riskGroups>0 ? 'var(--red)' : 'var(--text)';
  }

  dcRenderTabGroups(aggs);

  // 사이드바 뱃지 (이상 자원그룹 수)
  const dcBadge = $('sb-dc-badge');
  if(dcBadge){
    if(riskGroups>0){
      dcBadge.textContent = String(riskGroups);
      dcBadge.style.background = 'var(--red)';
      dcBadge.style.display = 'inline-block';
      dcBadge.title = `수집 이상 자원그룹 ${riskGroups}개`;
    } else {
      dcBadge.style.display = 'none';
    }
  }
}

/* ────────────────────────────────────────
   목록: 자원그룹별 요약 (수신률·피크·평균·최근수신 + 상세 버튼)
   ──────────────────────────────────────── */
function dcRenderTabGroups(aggs){
  const filtered = aggs.filter(a=>{
    if(dcState.status==='all') return true;
    // 정책서 3-2-1 기준: 그룹 전체 미수신 슬롯 0건=정상, 1건 이상=이상 (2단계)
    const groupState = a.missTotal>0 ? 'risk' : 'ok';
    return groupState===dcState.status;
  });
  if(!filtered.length){
    $('dc-tab-groups').innerHTML = `<div class="empty" style="padding:60px 20px;">조회 조건에 해당하는 자원그룹이 없습니다.</div>`;
    return;
  }

  const rows = filtered.map(a=>{
    const g = a.group;
    const groupKey = String(g.id);
    const expanded = String(dcState.expandedGroupId)===groupKey;
    const rxPct = Math.round(a.rxRate*1000)/10;
    const rxColor = rxPct>=99?'var(--green)':rxPct>=95?'var(--amber)':'var(--red)';
    const totalCust = a.perCust.length;

    // 추가 지표: 기간 내 평균 · 피크 · 최근수신
    let totalKw = 0, kwCount = 0, peakKw = 0, lastSlot = null;
    const from = new Date(dcState.from), to = new Date(dcState.to);
    a.perCust.forEach(p=>{
      const days = pcDmGenerateData(p.cust, from, to, {stepMin: dcChannelMeta().stepMin});
      days.forEach(d=>{
        d.slots.forEach(s=>{
          if(s.kw!=null){
            totalKw += s.kw; kwCount++;
            if(s.kw > peakKw) peakKw = s.kw;
            if(!s.missing && (!lastSlot || (d.date+s.time) > lastSlot)) lastSlot = d.date+' '+s.time;
          }
        });
      });
    });
    const avgKw = kwCount ? Math.round(totalKw/kwCount) : 0;
    const peakFmt = peakKw>=1000 ? (peakKw/1000).toFixed(2)+' MW' : Math.round(peakKw)+' kW';
    const avgFmt = avgKw>=1000 ? (avgKw/1000).toFixed(2)+' MW' : avgKw+' kW';

    // 상태 뱃지 (정책서 3-2-1 기준 2단계: 정상/이상)
    const stateBadges = [];
    if(a.riskCnt>0) stateBadges.push(`<span class="badge badge-fail" style="font-size:10px;">이상 ${a.riskCnt}</span>`);
    if(!stateBadges.length) stateBadges.push(`<span class="badge badge-done" style="font-size:10px;">정상</span>`);
    // Phase 13: 사업자 행 + (사업장 다수일 때) 사업장 sub-행 펼침
    const customerRows = [...a.perCust].sort((x,y)=>{
      const prio = {risk:0, ok:1};
      return (prio[x.state] ?? 9) - (prio[y.state] ?? 9);
    }).map(p=>{
      const stateMeta = {
        risk:{label:'이상', cls:'badge-fail'},
        ok:{label:'정상', cls:'badge-done'}
      }[p.state] || {label:'정상', cls:'badge-done'};
      const rx = Math.round(p.rxRate*1000)/10;
      const sites = Array.isArray(p.cust.sites) ? p.cust.sites : [];
      const hasSites = sites.length > 0;
      const bizExpanded = (dcState.expandedBizIds||{})[p.cust.id];
      const accordionIcon = hasSites
        ? `<span class="dc-biz-chevron" onclick="event.stopPropagation();dcToggleBizSites(${JSON.stringify(p.cust.id)})">${bizExpanded?'−':'+'}</span>`
        : '<span class="dc-biz-chevron-empty"></span>';
      const sitesBadge = hasSites
        ? ` <span style="color:var(--text-hint);font-size:10px;font-weight:400;">· ${sites.length}사업장</span>`
        : '';

      // 사업자 행 (메인) — 펼침 가능, 행 본문 클릭 시 사업자 상세 모니터링
      const bizRow = `<div class="dc-customer-jump">
        ${accordionIcon}
        <span onclick='dcOpenCustomerDetail(${JSON.stringify(g.id)}, ${JSON.stringify(p.cust.id)})' style="cursor:pointer;">
          <div class="dc-customer-jump-name">${p.cust.name}${sitesBadge}</div>
          <div class="dc-customer-jump-meta">${p.cust.id} · 계약전력 ${p.cust.power ? p.cust.power.toLocaleString() : '-'} kW</div>
        </span>
        <span class="dc-customer-jump-val">${rx}%</span>
        <span class="dc-customer-jump-val" style="color:${p.missCnt>0?'var(--red)':'var(--text-hint)'};">${p.missCnt}</span>
        <span class="dc-customer-jump-state"><span class="badge ${stateMeta.cls}" style="font-size:10px;">${stateMeta.label}</span></span>
      </div>`;

      // 사업장 sub-행 (펼침 상태일 때만)
      const sitesRows = (hasSites && bizExpanded) ? sites.map(s=>{
        // 사업장 단위 통신상태는 사업자 전체 평균 적용 (시드 단순화 — 향후 사업장별 다른 값 가능)
        return `<div class="dc-site-jump">
          <span class="dc-site-indent">└</span>
          <span style="cursor:pointer;" onclick='dcOpenCustomerDetail(${JSON.stringify(g.id)}, ${JSON.stringify(p.cust.id)})'>
            <div class="dc-customer-jump-name" style="font-weight:500;">${s.siteName}</div>
            <div class="dc-customer-jump-meta">KEPCO ${s.kepco} · ${s.addr||''} · ${s.power||'-'} kW</div>
          </span>
          <span class="dc-customer-jump-val">${rx}%</span>
          <span class="dc-customer-jump-val" style="color:${p.missCnt>0?'var(--red)':'var(--text-hint)'};">${p.missCnt}</span>
          <span class="dc-customer-jump-state"><span class="badge ${stateMeta.cls}" style="font-size:10px;">${stateMeta.label}</span></span>
        </div>`;
      }).join('') : '';

      return bizRow + sitesRows;
    }).join('');
    const expandRow = expanded ? `<tr class="dc-expand-row">
      <td colspan="8">
        <div class="dc-expand-inner">
          <div class="dc-expand-head">
            <span>소속 참여고객 ${totalCust}명 · 고객을 클릭하면 해당 고객 상세 모니터링으로 바로 이동합니다.</span>
            <span>컬럼: 수신률 / 미수신</span>
          </div>
          <div class="dc-expand-list">${customerRows}</div>
        </div>
      </td>
    </tr>` : '';

    return `<tr>
      <td style="padding:12px;text-align:left;padding-left:14px;">
        <button class="dc-group-toggle" onclick="dcToggleGroupCustomers(${JSON.stringify(g.id)})">
          <span class="dc-group-chevron">${expanded?'−':'+'}</span>
          <span>
            <div class="dc-group-name">${g.name}</div>
            <div class="dc-group-meta">${g.type||''} · ${g.id} · ${totalCust}명 참여</div>
          </span>
        </button>
      </td>
      <td style="padding:12px;text-align:right;font-weight:700;color:${rxColor};font-variant-numeric:tabular-nums;">${rxPct}%</td>
      <td style="padding:12px;text-align:right;color:${a.missTotal>0?'var(--red)':'var(--text-hint)'};font-weight:${a.missTotal>0?'600':'normal'};font-variant-numeric:tabular-nums;">${a.missTotal.toLocaleString()}</td>
      <td style="padding:12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--blue);font-weight:600;">${peakFmt}</td>
      <td style="padding:12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--text-sub);">${avgFmt}</td>
      <td style="padding:12px;text-align:center;font-variant-numeric:tabular-nums;font-size:11px;color:var(--text-sub);">${lastSlot||'—'}</td>
      <td style="padding:12px;text-align:left;"><div style="display:flex;flex-wrap:wrap;gap:3px;">${stateBadges.join('')}</div></td>
      <td style="padding:12px;text-align:center;">
        <button class="btn btn-sm btn-primary" onclick="dcOpenDetail(${JSON.stringify(g.id)})">상세</button>
      </td>
    </tr>${expandRow}`;
  }).join('');

  $('dc-tab-groups').innerHTML = `
    <div style="font-size:11px;color:var(--text-hint);margin-bottom:8px;">
      자원그룹을 펼치면 고객별 수신 상태를 확인할 수 있습니다.
    </div>
    <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;background:#fff;">
      <table class="dc-summary-table">
        <thead>
          <tr>
            <th style="padding:10px 14px;text-align:left;">자원그룹</th>
            <th style="padding:10px 14px;text-align:right;">수신률</th>
            <th style="padding:10px 14px;text-align:right;">미수신</th>
            <th style="padding:10px 14px;text-align:right;">피크</th>
            <th style="padding:10px 14px;text-align:right;">평균</th>
            <th style="padding:10px 14px;text-align:center;">최근 수신</th>
            <th style="padding:10px 14px;text-align:left;">상태</th>
            <th style="padding:10px 14px;text-align:center;width:80px;">관리</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ────────────────────────────────────────
   상세 화면 — 페이지 전환형
   ──────────────────────────────────────── */
const dcDState = {
  groupId: null,
  from: null,
  to: null,
  customerId: 'all', // 'all' | customer.id
  custSearchQuery: '',
};

function dcOpenDetail(groupId){
  const g = store.groups.find(x=>String(x.id)===String(groupId));
  if(!g){ showToast('자원그룹을 찾을 수 없습니다.'); return; }
  dcDState.groupId = g.id;
  dcDState.customerId = 'all';
  dcDState.custSearchQuery = '';
  // 상세 기간 기본값 = 목록 조회 기간 동기화
  dcDState.from = dcState.from;
  dcDState.to   = dcState.to;
  // 뷰 전환
  $('dc-list-view').style.display = 'none';
  $('dc-detail-view').style.display = 'flex';
  // 헤더 반영
  $('dc-d-title').textContent = g.name;
  $('dc-d-crumb').textContent = g.name;
  $('dc-d-type').textContent = g.type || '—';
  // 입력 필드 초기화
  $('dc-d-from').value = dcDState.from;
  $('dc-d-to').value = dcDState.to;
  $('dc-d-cust-search').value = '';
  // 고객 드롭다운 채우기
  dcDFillCustomerSelect(g);
  dcDQuery();
}
function dcOpenCustomerDetail(groupId, customerId){
  const g = store.groups.find(x=>String(x.id)===String(groupId));
  const c = custById(customerId);
  if(!g || !c){ showToast('참여고객 정보를 찾을 수 없습니다.'); return; }
  dcOpenDetail(groupId);
  dcDState.customerId = customerId;
  dcDFillCustomerSelect(g);
  dcDQuery();
}
function dcToggleGroupCustomers(groupId){
  const next = String(groupId);
  dcState.expandedGroupId = String(dcState.expandedGroupId)===next ? null : next;
  dcRender();
}
function dcGotoList(){
  $('dc-detail-view').style.display = 'none';
  $('dc-list-view').style.display = 'flex';
  dcDState.groupId = null;
}
function dcDSetPreset(days){
  const today = new Date();
  const pad = n=>String(n).padStart(2,'0');
  const ymd = d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const from = new Date(today); from.setDate(from.getDate() - (days-1));
  $('dc-d-from').value = ymd(from);
  $('dc-d-to').value = ymd(today);
  dcDState.from = ymd(from);
  dcDState.to = ymd(today);
  dcDQuery();
}
function dcDFillCustomerSelect(g){
  const sel = $('dc-d-cust');
  const custs = (g.customerIds||[]).map(id=>custById(id)).filter(Boolean);
  const q = (dcDState.custSearchQuery||'').toLowerCase();
  const filtered = q
    ? custs.filter(c => (c.name+c.id).toLowerCase().includes(q))
    : custs;
  sel.innerHTML = `<option value="all">전체 참여고객 (${custs.length}명 합산)</option>`
    + filtered.map(c=>`<option value="${c.id}" ${dcDState.customerId===c.id?'selected':''}>${c.name} (${c.id}) · ${c.power||'-'}kW</option>`).join('');
  sel.onchange = ()=>{ dcDState.customerId = sel.value; dcDQuery(); };
}
function dcDFilterCustomers(){
  dcDState.custSearchQuery = $('dc-d-cust-search').value;
  const g = store.groups.find(x=>String(x.id)===String(dcDState.groupId));
  if(g) dcDFillCustomerSelect(g);
}
function dcDQuery(){
  const g = store.groups.find(x=>String(x.id)===String(dcDState.groupId));
  if(!g) return;
  dcDState.from = $('dc-d-from').value;
  dcDState.to   = $('dc-d-to').value;
  if(!dcDState.from || !dcDState.to){ showToast('조회 기간을 선택하세요.'); return; }
  if(new Date(dcDState.from) > new Date(dcDState.to)){ showToast('시작일이 종료일보다 클 수 없습니다.'); return; }
  const days = Math.floor((new Date(dcDState.to)-new Date(dcDState.from))/86400000)+1;
  if(days > 90){ showToast('한 번에 조회 가능한 기간은 최대 90일입니다.'); return; }

  const targets = (dcDState.customerId==='all')
    ? (g.customerIds||[]).map(id=>custById(id)).filter(Boolean)
    : [custById(dcDState.customerId)].filter(Boolean);

  dcDRender(g, targets, days);
}

/* 상세 렌더: 요약 지표 + 전체 그래프 + 고객별 15분 단위 상세 차트 + 테이블 */
function dcDRender(g, customers, dayCount){
  const body = $('dc-detail-body');
  if(!customers.length){
    body.innerHTML = `<div class="empty" style="padding:60px 20px;">조회 대상 참여고객이 없습니다.</div>`;
    return;
  }
  const from = new Date(dcDState.from), to = new Date(dcDState.to);

  // 1) 전체 집계: 고객×일자 합산
  const allDays = customers.map(c => ({cust:c, days: pcDmGenerateData(c, from, to, {stepMin: dcChannelMeta().stepMin})}));

  // 2) 요약 지표
  let tSlots=0, tMiss=0, totalKw=0, kwCount=0, peakKw=0;
  allDays.forEach(ad=>{
    ad.days.forEach(d=>{
      tSlots += d.slots.length;
      tMiss += d.missCnt;
      d.slots.forEach(s=>{
        if(s.kw!=null){
          totalKw += s.kw; kwCount++;
          if(s.kw > peakKw) peakKw = s.kw;
        }
      });
    });
  });
  const rxPct = tSlots ? Math.round((tSlots-tMiss)/tSlots*1000)/10 : 0;
  const avgKw = kwCount ? Math.round(totalKw/kwCount) : 0;
  const rxColor = rxPct>=99?'var(--green)':rxPct>=95?'var(--amber)':'var(--red)';
  const isMW = peakKw>=1000;
  const peakFmt = isMW ? (peakKw/1000).toFixed(2)+' MW' : Math.round(peakKw)+' kW';
  const avgFmt = avgKw>=1000 ? (avgKw/1000).toFixed(2)+' MW' : avgKw+' kW';

  const scopeLabel = dcDState.customerId==='all'
    ? `자원그룹 전체 (${customers.length}명 합산)`
    : `${customers[0].name} (${customers[0].id})`;

  const summaryHtml = `
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div>
          <div style="font-size:12px;color:var(--text-hint);">조회 대상</div>
          <div style="font-size:14px;font-weight:700;color:var(--navy);margin-top:2px;">${scopeLabel}</div>
        </div>
        <div style="font-size:11px;color:var(--text-hint);font-variant-numeric:tabular-nums;">
          ${dcDState.from} ~ ${dcDState.to} · ${dayCount}일
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
        <div style="background:var(--bg);border-radius:var(--radius);padding:12px;">
          <div style="font-size:10px;color:var(--text-hint);">수신률</div>
          <div style="font-size:20px;font-weight:700;color:${rxColor};margin-top:3px;font-variant-numeric:tabular-nums;">${rxPct}%</div>
          <div style="font-size:10px;color:var(--text-hint);margin-top:3px;">총 ${tSlots.toLocaleString()}슬롯 중 ${(tSlots-tMiss).toLocaleString()}슬롯 수신</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius);padding:12px;">
          <div style="font-size:10px;color:var(--text-hint);">미수신</div>
          <div style="font-size:20px;font-weight:700;color:${tMiss>0?'var(--red)':'var(--text)'};margin-top:3px;font-variant-numeric:tabular-nums;">${tMiss.toLocaleString()}</div>
          <div style="font-size:10px;color:var(--text-hint);margin-top:3px;">${dcState.channel==='rtu'?'수신 실패 슬롯 (참고)':'정산 투입 제외 슬롯'}</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius);padding:12px;">
          <div style="font-size:10px;color:var(--text-hint);">피크 사용량</div>
          <div style="font-size:20px;font-weight:700;color:var(--blue);margin-top:3px;font-variant-numeric:tabular-nums;">${peakFmt}</div>
          <div style="font-size:10px;color:var(--text-hint);margin-top:3px;">${dcChannelMeta().stepMin}분 단위 기준 최댓값</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius);padding:12px;">
          <div style="font-size:10px;color:var(--text-hint);">평균 사용량</div>
          <div style="font-size:20px;font-weight:700;color:var(--text);margin-top:3px;font-variant-numeric:tabular-nums;">${avgFmt}</div>
          <div style="font-size:10px;color:var(--text-hint);margin-top:3px;">수신 슬롯 전체 평균</div>
        </div>
      </div>
    </div>`;

  // 3) 전체 그래프 (일자별 집계) — 사전검증 데이터모니터링과 유사 구성
  let chartHtml = '';
  if(dcDState.customerId === 'all'){
    // 자원그룹 합산 — 일자별 합계 라인
    const dailyMap = {};
    allDays.forEach(ad=>{
      ad.days.forEach(d=>{
        if(!dailyMap[d.date]) dailyMap[d.date] = { date:d.date, total:0, miss:0, imp:0, sumKw:0, peak:0 };
        d.slots.forEach(s=>{
          dailyMap[d.date].total++;
          if(s.missing) dailyMap[d.date].miss++;
          if(s.imputed) dailyMap[d.date].imp++;
          if(s.kw!=null){
            dailyMap[d.date].sumKw += s.kw;
            if(s.kw > dailyMap[d.date].peak) dailyMap[d.date].peak = s.kw;
          }
        });
      });
    });
    const daily = Object.values(dailyMap).sort((x,y)=>x.date.localeCompare(y.date));
    chartHtml = dcRenderAggregateChart(daily, isMW);
  } else {
    // 개별 고객 — 사전검증의 15분 단위 그래프 재활용
    const c = customers[0];
    const days = pcDmGenerateData(c, from, to, {stepMin: dcChannelMeta().stepMin});
    chartHtml = `
      <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-size:13px;font-weight:600;color:var(--navy);">📈 ${dcChannelMeta().stepMin}분 단위 수집 데이터 추이</div>
          <div style="font-size:11px;color:var(--text-hint);">${c.name} · CBL (기준부하) · 실제 사용량 · 수집 실패 표기</div>
        </div>
        ${pcDmRenderChart(days)}
      </div>`;
  }

  // 4) 상세 테이블 — 고객별 OR 고객별 15분 테이블
  let tableHtml = '';
  if(dcDState.customerId === 'all'){
    // 자원그룹 합산 — 고객별 요약 테이블
    const custRows = allDays.map(ad=>{
      const c = ad.cust;
      let ts=0, ms=0, pk=0, sumk=0, cnt=0;
      ad.days.forEach(d=>{
        ts += d.slots.length; ms += d.missCnt;
        d.slots.forEach(s=>{ if(s.kw!=null){ sumk += s.kw; cnt++; if(s.kw>pk) pk=s.kw; } });
      });
      const rx = ts ? Math.round((ts-ms)/ts*1000)/10 : 0;
      const rxClr = rx>=99?'var(--green)':rx>=95?'var(--amber)':'var(--red)';
      const avg = cnt ? Math.round(sumk/cnt) : 0;
      // 정책서 3-2-1 기준 2단계: 미수신 0건=정상, 1건 이상=이상 (보정 개념 폐지)
      const state = ms>0 ? 'risk' : 'ok';
      const stMeta = {risk:{l:'이상',cls:'badge-fail'},ok:{l:'정상',cls:'badge-done'}}[state];
      return `<tr>
        <td style="padding:9px 12px;font-weight:500;">${c.name} <span style="font-size:10px;color:var(--text-hint);">${c.id}</span></td>
        <td style="padding:9px 12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--text-sub);">${c.power?c.power.toLocaleString():'-'} kW</td>
        <td style="padding:9px 12px;text-align:right;font-weight:600;color:${rxClr};font-variant-numeric:tabular-nums;">${rx}%</td>
        <td style="padding:9px 12px;text-align:right;color:${ms>0?'var(--red)':'var(--text-hint)'};font-variant-numeric:tabular-nums;">${ms}</td>
        <td style="padding:9px 12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--blue);">${Math.round(pk)} kW</td>
        <td style="padding:9px 12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--text-sub);">${avg} kW</td>
        <td style="padding:9px 12px;text-align:center;"><span class="badge ${stMeta.cls}" style="font-size:10px;">${stMeta.l}</span></td>
        <td style="padding:9px 12px;text-align:center;">
          <button class="btn btn-xs btn-secondary" onclick="dcDSelectCustomer('${c.id}')">고객 상세</button>
        </td>
      </tr>`;
    }).join('');
    tableHtml = `
      <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:13px;font-weight:600;color:var(--navy);background:#f8f9fc;">
          👥 참여고객별 수집 상세 (${customers.length}명)
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead style="background:#fafbfe;">
            <tr>
              <th style="padding:9px 12px;text-align:left;color:var(--text-sub);font-weight:500;border-bottom:1px solid var(--border);">고객</th>
              <th style="padding:9px 12px;text-align:right;color:var(--text-sub);font-weight:500;border-bottom:1px solid var(--border);">계약전력</th>
              <th style="padding:9px 12px;text-align:right;color:var(--text-sub);font-weight:500;border-bottom:1px solid var(--border);">수신률</th>
              <th style="padding:9px 12px;text-align:right;color:var(--text-sub);font-weight:500;border-bottom:1px solid var(--border);">미수신</th>
              <th style="padding:9px 12px;text-align:right;color:var(--text-sub);font-weight:500;border-bottom:1px solid var(--border);">피크</th>
              <th style="padding:9px 12px;text-align:right;color:var(--text-sub);font-weight:500;border-bottom:1px solid var(--border);">평균</th>
              <th style="padding:9px 12px;text-align:center;color:var(--text-sub);font-weight:500;border-bottom:1px solid var(--border);">상태</th>
              <th style="padding:9px 12px;text-align:center;color:var(--text-sub);font-weight:500;border-bottom:1px solid var(--border);width:90px;">관리</th>
            </tr>
          </thead>
          <tbody>${custRows}</tbody>
        </table>
      </div>`;
  } else {
    // 개별 고객 — 사전검증의 15분 테이블 재활용
    const c = customers[0];
    const days = pcDmGenerateData(c, from, to, {stepMin: dcChannelMeta().stepMin});
    tableHtml = `
      <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:13px;font-weight:600;color:var(--navy);background:#f8f9fc;">
          📋 ${c.name} · ${dcChannelMeta().stepMin}분 단위 수집 상세
        </div>
        <div style="padding:12px 16px;">${pcDmRenderTable(days)}</div>
      </div>`;
  }

  body.innerHTML = summaryHtml + chartHtml + tableHtml;
}

/* 자원그룹 합산 — 일자별 집계 그래프 (스택 막대 + 피크 라인) */
function dcRenderAggregateChart(daily, isMW){
  if(!daily.length) return '';
  const W = 820, H = 240, P = {l:50, r:12, t:20, b:34};
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const unitDiv = isMW ? 1000 : 1;
  const unitLabel = isMW ? 'MW' : 'kW';
  const peakMax = Math.max(1, ...daily.map(d=>d.peak)) / unitDiv;
  const yMax = peakMax * 1.15;
  const x = i => P.l + (daily.length===1 ? iw/2 : (i/(daily.length-1))*iw);
  const y = v => P.t + ih - (v/yMax)*ih;
  const barW = Math.min(26, Math.max(4, iw/Math.max(daily.length,1) - 4));

  // 일자별 막대 (피크값) + 수신률 색상
  const bars = daily.map((d,i)=>{
    const peak = d.peak/unitDiv;
    const rx = d.total ? (d.total-d.miss)/d.total : 0;
    const color = rx>=0.99?'#86c9a9':rx>=0.95?'#f6d89a':'#f4a8a8';
    const bh = Math.max(0, ih - (y(peak) - P.t));
    return `<rect x="${(x(i)-barW/2).toFixed(1)}" y="${y(peak).toFixed(1)}" width="${barW}" height="${bh.toFixed(1)}" fill="${color}" stroke="${rx>=0.99?'var(--green)':rx>=0.95?'var(--amber)':'var(--red)'}" stroke-width="1">
      <title>${d.date} · 피크 ${peak.toFixed(isMW?2:0)} ${unitLabel} · 수신률 ${(rx*100).toFixed(1)}%</title>
    </rect>`;
  }).join('');

  // 피크 라인 (연결)
  const linePath = daily.map((d,i)=>`${i===0?'M':'L'}${x(i).toFixed(1)},${y(d.peak/unitDiv).toFixed(1)}`).join(' ');

  // Y축 눈금
  const yTicks = Array.from({length:5},(_,i)=>{
    const v = yMax*(i/4);
    return {y:y(v), label: isMW ? v.toFixed(2) : Math.round(v).toLocaleString()};
  });

  // X축 날짜 라벨 (최대 10개 표시)
  const step = Math.max(1, Math.ceil(daily.length/10));
  const xLabels = daily.map((d,i)=> (i%step===0 || i===daily.length-1)
    ? `<text x="${x(i)}" y="${H-12}" font-size="9" fill="var(--text-sub)" text-anchor="middle">${d.date.substring(5)}</text>`
    : '').join('');

  return `
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:13px;font-weight:600;color:var(--navy);">📊 일자별 수집 현황 (${daily.length}일)</div>
        <div style="display:flex;gap:10px;font-size:10px;color:var(--text-sub);">
          <span><span style="display:inline-block;width:10px;height:10px;background:#86c9a9;border:1px solid var(--green);border-radius:2px;vertical-align:middle;margin-right:3px;"></span>정상 (≥99%)</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#f6d89a;border:1px solid var(--amber);border-radius:2px;vertical-align:middle;margin-right:3px;"></span>주의 (≥95%)</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#f4a8a8;border:1px solid var(--red);border-radius:2px;vertical-align:middle;margin-right:3px;"></span>위험 (&lt;95%)</span>
          <span><span style="display:inline-block;width:14px;height:2px;background:var(--blue);vertical-align:middle;margin-right:3px;"></span>피크 추이</span>
        </div>
      </div>
      <svg width="100%" viewBox="0 0 ${W} ${H}" style="background:#fafbfd;border-radius:6px;">
        ${yTicks.map(t=>`<line x1="${P.l}" y1="${t.y}" x2="${W-P.r}" y2="${t.y}" stroke="var(--border)" stroke-dasharray="2,3"/>
                         <text x="${P.l-6}" y="${t.y+3}" font-size="9" fill="var(--text-hint)" text-anchor="end">${t.label}</text>`).join('')}
        <text x="${P.l-6}" y="${P.t-4}" font-size="9" fill="var(--text-sub)" text-anchor="end">${unitLabel}</text>
        ${bars}
        <path d="${linePath}" fill="none" stroke="var(--blue)" stroke-width="1.8" stroke-linejoin="round"/>
        ${daily.map((d,i)=>`<circle cx="${x(i)}" cy="${y(d.peak/unitDiv)}" r="2.5" fill="var(--blue)"/>`).join('')}
        ${xLabels}
      </svg>
      <div style="font-size:10px;color:var(--text-hint);margin-top:6px;">* 막대 색상 = 일자별 수신률 등급 · 파란 선 = 자원그룹 합산 피크 사용량 추이</div>
    </div>`;
}

function dcDSelectCustomer(cid){
  dcDState.customerId = cid;
  const g = store.groups.find(x=>String(x.id)===String(dcDState.groupId));
  if(g){ dcDFillCustomerSelect(g); dcDQuery(); }
}

/* 상세 화면 CSV */
function dcExportDetailCsv(){
  const g = store.groups.find(x=>String(x.id)===String(dcDState.groupId));
  if(!g){ showToast('상세 화면이 아닙니다.'); return; }
  const from = new Date(dcDState.from), to = new Date(dcDState.to);
  const targets = (dcDState.customerId==='all')
    ? (g.customerIds||[]).map(id=>custById(id)).filter(Boolean)
    : [custById(dcDState.customerId)].filter(Boolean);
  const rows = [['date','group','customerId','customer','time','cbl_kw','kw','missing']];
  targets.forEach(c=>{
    const days = pcDmGenerateData(c, from, to, {stepMin: dcChannelMeta().stepMin});
    days.forEach(d=>{
      d.slots.forEach(s=>{
        rows.push([d.date, g.name, c.id, c.name, s.time, s.cbl, s.missing?'':s.kw, s.missing?1:0]);
      });
    });
  });
  const csv = rows.map(r=>r.map(v=>{
    const s = String(v??'');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const scope = dcDState.customerId==='all' ? g.name : (custById(dcDState.customerId)?.name||'cust');
  a.href = url; a.download = `dc_${scope}_${dcDState.from}_${dcDState.to}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV 파일을 다운로드했습니다.');
}


/* CSV 내보내기 — 증빙용 15분 슬롯 원자료. 검색어·조회기간·데이터상태 필터를 모두 반영한다 */
function dcExportCsv(){
  const aggs = dcFilteredGroups().filter(a=>{
    if(dcState.status==='all') return true;
    const groupState = a.missTotal>0 ? 'risk' : 'ok';
    return groupState===dcState.status;
  });
  const from = new Date(dcState.from), to = new Date(dcState.to);
  const rows = [['date','group','customerId','customer','time','cbl_kw','kw','missing']];
  aggs.forEach(a=>{
    a.perCust.forEach(p=>{
      const days = pcDmGenerateData(p.cust, from, to, {stepMin: dcChannelMeta().stepMin});
      days.forEach(d=>{
        d.slots.forEach(s=>{
          rows.push([d.date, a.group.name, p.cust.id, p.cust.name, s.time,
            s.cbl, s.missing?'':s.kw, s.missing?1:0]);
        });
      });
    });
  });
  const csv = rows.map(r=>r.map(v=>{
    const s = String(v??'');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `dc_${dcState.from}_${dcState.to}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* 재수집 요청 — 통신 이상으로 미수신된 슬롯을 한전OPM/RTU에 재조회 요청 (시뮬레이션 토스트) */
function dcRerun(){
  const aggs = dcFilteredGroups();
  const missGroups = aggs.filter(a=>a.missTotal>0).length;
  if(!missGroups){ alert('현재 조회 범위에 미수신 슬롯이 있는 자원그룹이 없습니다.'); return; }
  alert(`${dcState.from} ~ ${dcState.to} 범위, 미수신 슬롯이 있는 ${missGroups}개 자원그룹에 재조회 요청을 전송했습니다.\n실제 반영은 한전OPM/RTU 통신 정상화 후 다음 수집 주기에 이뤄집니다. (시뮬레이션)`);
}

/* ════════════════════════════════════════════════════════════
   ★ PART 8 — 고객 소통 (COM) · 입찰 관리 (BID) · 시스템 관리 (SYS)
   v3 확장: 부재 TOP 10 중 🔴 1·2·3 및 🟡 7·8 반영
════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   COM · 시드 데이터
───────────────────────────────────────────── */
