/* ════════════════════════════════════════════════════════════
   ACCOUNT — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

function acctInit(){ acctRender(); }
function acctResetFilters(){
  $('acctSearchBox').value=''; selectedIds.clear(); acctRender();
}
function acctRender(){
  const q = ($('acctSearchBox').value||'').trim().toLowerCase();
  let rows = accounts.slice();
  // [Phase 17-DI] 검색 대상: 담당자명 · ID(이메일) · 전화번호로 한정
  if(q) rows = rows.filter(a=> (a.name+a.email+(a.phone||'')).toLowerCase().includes(q));
  const tbody = $('acctBody');
  if(rows.length===0){
    tbody.innerHTML = '<tr><td colspan="7" class="acct-empty">검색 조건에 해당하는 계정이 없습니다.</td></tr>';
  }else{
    tbody.innerHTML = rows.map(a=>{
      const role = ROLE_MAP[a.role]||{name:a.role,color:'gray'};
      const st = STATUS_META[a.status]||{label:a.status,badge:'badge-gray'};
      return `
      <tr data-id="${a.id}" class="${selectedIds.has(a.id)?'selected':''}" onclick="acctOpenDrawer('${a.id}')">
        <td class="center" onclick="event.stopPropagation()">
          <input type="checkbox" ${selectedIds.has(a.id)?'checked':''} onchange="acctToggleSel('${a.id}',this.checked)">
        </td>
        <!-- [Phase 17-I] 사번 표기 제거 (정책서 외 잔존 필드). 이름만 표시. -->
        <td><div class="acct-user-name">${a.name}</div></td>
        <td style="font-family:monospace;font-size:11.5px;color:var(--text-sub);">${a.email}</td>
        <td><span class="badge badge-${role.color}">${role.name}</span></td>
        <td>${a.company||a.team||'-'}<div style="font-size:11px;color:var(--text-hint);">${a.position||''}</div></td>
        <td class="center"><span class="badge ${st.badge}">${st.label}</span></td>
        <td class="center" onclick="event.stopPropagation()">
          <button class="btn btn-secondary btn-xs" onclick="acctOpenDrawer('${a.id}')">상세</button>
        </td>
      </tr>`;
    }).join('');
  }
  $('acctRowCount').textContent = `${rows.length}건 / 전체 ${accounts.length}건`;
  if(selectedIds.size>0){
    $('acctBulkBar').style.display='inline';
    $('acctBulkBar').textContent = `${selectedIds.size}명 선택됨`;
    $('acctBulkResetBtn').style.display='inline-flex';
    $('acctBulkDeactivateBtn').style.display='inline-flex';
  }else{
    $('acctBulkBar').style.display='none';
    $('acctBulkResetBtn').style.display='none';
    $('acctBulkDeactivateBtn').style.display='none';
  }
}
function acctToggleSel(id,checked){
  if(checked) selectedIds.add(id); else selectedIds.delete(id);
  acctRender();
}
function acctToggleAll(el){
  if(el.checked) accounts.forEach(a=>selectedIds.add(a.id));
  else selectedIds.clear();
  acctRender();
}
function acctBulkAction(act){
  if(act==='reset'){
    if(!confirm(`${selectedIds.size}명 비밀번호를 일괄 초기화하고 재설정 이메일을 발송하시겠습니까?`)) return;
    logAudit('일괄 비밀번호 초기화', `${selectedIds.size}명`);
    showToast(`${selectedIds.size}명에게 비밀번호 재설정 링크를 발송했습니다.`);
    selectedIds.clear(); acctRender();
  }else if(act==='deactivate'){
    if(!confirm(`${selectedIds.size}명을 일괄 비활성화하시겠습니까? (감사 로그에 기록됩니다)`)) return;
    const names=[];
    selectedIds.forEach(id=>{
      const a = accounts.find(x=>x.id===id);
      if(a && a.role!=='SYS_ADMIN'){ a.status='INACTIVE'; names.push(a.name); }
    });
    logAudit('일괄 비활성화', names.join(','));
    showToast(`${names.length}명이 비활성화되었습니다.`);
    selectedIds.clear(); acctRender();
  }
}

/* ── 생성 ── */
// Phase 14-A: 모든 DOM 접근에 null guard — HTML 변경으로 ID가 빠져있어도 함수 멈춤 X
function acctOpenCreate(){
  try {
    const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v; };
    const setChecked = (id, v) => { const el = document.getElementById(id); if(el) el.checked = v; };
    const setText = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
    const setCls = (id, v) => { const el = document.getElementById(id); if(el) el.className = v; };
    setVal('acctNewName',''); setVal('acctNewEmail','');
    setVal('acctNewPhone',''); setVal('acctNewTeam',''); setVal('acctNewPosition','');
    // [Phase 17-DI] 초기 비밀번호 자동 생성 (drms2026 프리픽스 + 랜덤 4자리)
    setVal('acctNewPwAuto', acctGeneratePwAuto());
    setCls('acctNewEmailHint', 'acct-form-hint');
    setText('acctNewEmailHint', '회사 이메일만 허용 (@60hz.io 도메인)');
    const sel = document.getElementById('acctNewRoleSelect');
    if(sel && typeof ROLES!=='undefined' && Array.isArray(ROLES)){
      sel.innerHTML = ROLES.map(r=>`<option value="${r.code}" ${r.code==='VIEWER'?'selected':''}>${r.name} (${r.code})</option>`).join('');
    } else {
      console.warn('[acctOpenCreate] acctNewRoleSelect 또는 ROLES 없음', {sel:!!sel, ROLES:typeof ROLES});
    }
    acctOnNewRoleChange('VIEWER');
    openModalAcct('acctModalCreate');
  } catch(err){
    console.error('[acctOpenCreate] 실패:', err);
    if(typeof showToast==='function') showToast('계정 생성 모달을 열 수 없습니다. 콘솔을 확인해 주세요.');
  }
}
function acctOnNewRoleChange(code){
  const roleMap = (typeof ROLE_MAP!=='undefined') ? ROLE_MAP : {};
  const role = roleMap[code] || {desc:'', perms:{}};
  const descEl = document.getElementById('acctNewRoleDesc');
  if(descEl) descEl.textContent = role.desc || '';
  newPermOverrides = JSON.parse(JSON.stringify(role.perms || {}));
  acctRenderNewPermMatrix();
}
function acctRenderNewPermMatrix(){
  const perms = newPermOverrides || {};
  const tableEl = document.getElementById('acctNewPermMatrix');
  if(!tableEl){ console.warn('[acctRenderNewPermMatrix] acctNewPermMatrix DOM 못 찾음'); return; }
  const tbody = tableEl.querySelector('tbody');
  if(!tbody){ console.warn('[acctRenderNewPermMatrix] tbody 못 찾음'); return; }
  if(typeof MENUS==='undefined' || !Array.isArray(MENUS)){ console.warn('[acctRenderNewPermMatrix] MENUS 없음'); return; }
  tbody.innerHTML = MENUS.map(m=>{
    const act = perms[m.key]||[];
    const cells = ['R','C','U','D','X'].map(k=>{
      const hasActionX = (m.key==='monitoring'||m.key==='settlement'||m.key==='bidding');
      if(k==='X' && !hasActionX) return '<td class="center" style="color:var(--text-hint)">—</td>';
      return `<td class="center"><input type="checkbox" data-menu="${m.key}" data-act="${k}" ${act.includes(k)?'checked':''} onchange="acctOnNewPermToggle(this)"></td>`;
    }).join('');
    return `<tr><td>${m.label}</td>${cells}</tr>`;
  }).join('');
}
function acctOnNewPermToggle(el){
  const m=el.dataset.menu, k=el.dataset.act;
  const arr = newPermOverrides[m] = newPermOverrides[m]||[];
  if(el.checked){ if(!arr.includes(k)) arr.push(k); }
  else{ const i=arr.indexOf(k); if(i>=0) arr.splice(i,1); }
}
function acctValidateEmail(el){
  const v = el.value.trim();
  const ok = /@60hz\.io$/i.test(v) || /@audit\.ext$/i.test(v);
  const hint = $('acctNewEmailHint');
  if(!v){ hint.className='acct-form-hint'; hint.textContent='회사 이메일만 허용 (@60hz.io 도메인)'; return;}
  if(!ok){ hint.className='acct-form-hint error'; hint.textContent='허용되지 않은 도메인입니다. (@60hz.io 또는 승인된 외부 도메인)';}
  else{ hint.className='acct-form-hint ok'; hint.textContent='사용 가능한 이메일입니다.'; }
}
function acctSubmitCreate(){
  // Phase 14-D: 정책서 4.2 — 소속 사업자명 필수
  const name = $('acctNewName')?.value.trim();
  const email = $('acctNewEmail')?.value.trim();
  const company = $('acctNewCompany')?.value.trim();
  const team = $('acctNewTeam')?.value;
  const role = $('acctNewRoleSelect')?.value;
  if(!name||!email||!company||!role){ showToast('필수 항목(담당자명·이메일·소속 사업자명·역할)을 모두 입력하세요.'); return; }
  if(accounts.some(a=>a.email===email)){ showToast('이미 사용 중인 이메일입니다.'); return; }
  const phone = $('acctNewPhone')?.value.trim() || '';
  const initPw = $('acctNewPwAuto')?.value || acctGeneratePwAuto();
  accounts.unshift({
    id:'u'+Date.now(), email, name, empNo:'-', role,
    company, phone,
    team: team || '',
    position:$('acctNewPosition')?.value||'-',
    // [Phase 17-DI] 자동 발급 초기 비밀번호 → 최초 로그인 시 재설정 필요 상태
    status: 'RESET_REQUIRED',
    lastLogin:'-', lastIp:'-', validUntil:null,
    createdAt: (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().slice(0,10),
    customPerms: JSON.parse(JSON.stringify(newPermOverrides||ROLE_MAP[role].perms))
  });
  logAudit('계정 생성', `${name} (${email}) — ${ROLE_MAP[role].name} · 초기 비밀번호 발급`);
  closeModalAcct('acctModalCreate');
  showToast(`${name} 계정 생성 완료. 초기 비밀번호: ${initPw}`);
  acctRender();
}

/* [Phase 17-DI] 초기 비밀번호 자동 생성기 — drms2026 프리픽스 + 랜덤 4자리 */
function acctGeneratePwAuto(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for(let i=0;i<4;i++) suffix += chars[Math.floor(Math.random()*chars.length)];
  return 'drms2026' + suffix;
}
function acctRegenPwAuto(){
  const el = document.getElementById('acctNewPwAuto');
  if(el) el.value = acctGeneratePwAuto();
}

/* ── 권한 수정 ── */
function acctOpenPerm(id){
  currentTargetId = id;
  const a = accounts.find(x=>x.id===id); if(!a) return;
  $('acctPermUserName').textContent = `${a.name} (${a.email})`;
  permRoleCode = a.role;
  permOverrides = JSON.parse(JSON.stringify(ROLE_MAP[a.role].perms));
  const sel = $('acctPermRoleSelect');
  sel.innerHTML = ROLES.map(r=>`<option value="${r.code}" ${r.code===a.role?'selected':''}>${r.name} (${r.code})</option>`).join('');
  $('acctPermRoleDesc').textContent = ROLE_MAP[a.role].desc;
  acctRenderPermMatrix();
  $('acctPermReason').value='';
  openModalAcct('acctModalPerm');
}
function acctOnPermRoleChange(code){
  permRoleCode = code;
  permOverrides = JSON.parse(JSON.stringify(ROLE_MAP[code].perms));
  $('acctPermRoleDesc').textContent = ROLE_MAP[code].desc;
  acctRenderPermMatrix();
}
function acctRenderPermMatrix(){
  const perms = permOverrides || ROLE_MAP[permRoleCode].perms;
  const tbody = $('acctPermMatrix').querySelector('tbody');
  tbody.innerHTML = MENUS.map(m=>{
    const act = perms[m.key]||[];
    const cells = ['R','C','U','D','X'].map(k=>{
      const hasActionX = (m.key==='monitoring'||m.key==='settlement'||m.key==='bidding');
      if(k==='X' && !hasActionX) return '<td class="center" style="color:var(--text-hint)">—</td>';
      return `<td class="center"><input type="checkbox" data-menu="${m.key}" data-act="${k}" ${act.includes(k)?'checked':''} onchange="acctOnPermToggle(this)"></td>`;
    }).join('');
    return `<tr><td>${m.label}</td>${cells}</tr>`;
  }).join('');
}
function acctOnPermToggle(el){
  const m=el.dataset.menu, k=el.dataset.act;
  if(!permOverrides) permOverrides = JSON.parse(JSON.stringify(ROLE_MAP[permRoleCode].perms));
  const arr = permOverrides[m] = permOverrides[m]||[];
  if(el.checked){ if(!arr.includes(k)) arr.push(k); }
  else{ const i=arr.indexOf(k); if(i>=0) arr.splice(i,1); }
}
function acctSubmitPerm(){
  const reason = $('acctPermReason').value.trim();
  if(!reason){ showToast('변경 사유를 입력하세요 (감사 로그 필수).'); return; }
  const a = accounts.find(x=>x.id===currentTargetId); if(!a) return;
  const prevRole = a.role;
  a.role = permRoleCode;
  logAudit('권한 변경', `${a.name} ${ROLE_MAP[prevRole].name} → ${ROLE_MAP[permRoleCode].name} (사유: ${reason})`);
  closeModalAcct('acctModalPerm');
  showToast(`${a.name} 권한이 변경되었습니다. 다음 로그인부터 반영됩니다.`);
  acctRender();
  acctRefreshDrawerIfOpen();
}

/* ── 비밀번호 초기화 ── */
function acctOpenReset(id){
  currentTargetId = id;
  const a = accounts.find(x=>x.id===id); if(!a) return;
  $('acctResetUserName').textContent = `${a.name} (${a.email})`;
  $('acctResetMode').value='email';
  $('acctResetReason').value='';
  $('acctResetForceLogout').checked=true;
  $('acctResetTempBox').style.display='none';
  openModalAcct('acctModalReset');
}
function acctOnResetModeChange(){
  if($('acctResetMode').value==='temp'){
    $('acctResetTempBox').style.display='block';
    $('acctTempPw').textContent = acctGenTempPw();
  }else{ $('acctResetTempBox').style.display='none'; }
}
function acctGenTempPw(){
  const chars='abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$';
  let out=''; for(let i=0;i<12;i++) out+=chars[Math.floor(Math.random()*chars.length)];
  return out;
}
function acctSubmitReset(){
  const reason = $('acctResetReason').value.trim();
  if(!reason){ showToast('초기화 사유를 입력하세요.'); return; }
  const a = accounts.find(x=>x.id===currentTargetId); if(!a) return;
  const mode = $('acctResetMode').value;
  logAudit('비밀번호 초기화', `${a.name} (${mode==='email'?'이메일 링크':'임시 비밀번호'} · 사유: ${reason})`);
  closeModalAcct('acctModalReset');
  showToast(`${a.name} 비밀번호가 초기화되었습니다.`);
}

/* ── 비활성화 ── */
function acctOpenDelete(id){
  currentTargetId = id;
  const a = accounts.find(x=>x.id===id); if(!a) return;
  $('acctDelUserName').textContent = `${a.name} (${a.email})`;
  $('acctDelReason').value=''; $('acctDelConfirm').checked=false; $('acctDelEffect').value='now';
  const impacts=[];
  if(a.role==='SETTLEMENT') impacts.push('정산 배치 담당자입니다. 진행 중인 정산 건 이관이 필요할 수 있습니다.');
  if(a.role==='DR_OPERATOR') impacts.push('DR 이벤트 발령 권한 보유자입니다. 대체 담당자를 지정하세요.');
  if(a.role==='SYS_ADMIN'){
    const admins = accounts.filter(x=>x.role==='SYS_ADMIN' && x.status==='ACTIVE');
    if(admins.length<=1) impacts.push('마지막 활성 시스템관리자입니다. 비활성화할 수 없습니다.');
  }
  impacts.push('생성한 자원, 이벤트, 정산 이력은 그대로 보존됩니다.');
  $('acctDelImpact').innerHTML = impacts.map(s=>`<div>${s}</div>`).join('');
  openModalAcct('acctModalDelete');
}
function acctSubmitDelete(){
  const reason = $('acctDelReason').value.trim();
  if(!reason){ showToast('사유를 입력하세요.'); return; }
  if(!$('acctDelConfirm').checked){ showToast('업무 이관 확인 체크가 필요합니다.'); return; }
  const a = accounts.find(x=>x.id===currentTargetId); if(!a) return;
  if(a.role==='SYS_ADMIN'){
    const admins = accounts.filter(x=>x.role==='SYS_ADMIN' && x.status==='ACTIVE');
    if(admins.length<=1){ showToast('마지막 시스템관리자는 비활성화할 수 없습니다.'); return; }
  }
  a.status='INACTIVE';
  logAudit('계정 비활성화', `${a.name} (사유: ${reason})`);
  closeModalAcct('acctModalDelete');
  showToast(`${a.name} 계정이 비활성화되었습니다.`);
  acctRender();
  acctRefreshDrawerIfOpen();
}
function acctReactivate(id){
  if(!confirm('이 계정을 재활성화하시겠습니까?')) return;
  const a = accounts.find(x=>x.id===id); if(!a) return;
  a.status='ACTIVE';
  logAudit('계정 재활성화', `${a.name}`);
  showToast(`${a.name} 계정이 재활성화되었습니다.`);
  acctRender();
  acctRefreshDrawerIfOpen();
}
function acctUnlock(id){
  if(!confirm('계정 잠금을 해제하시겠습니까? (로그인 실패 카운트 초기화)')) return;
  const a = accounts.find(x=>x.id===id); if(!a) return;
  a.status='ACTIVE';
  logAudit('계정 잠금 해제', `${a.name}`);
  showToast(`${a.name} 계정 잠금이 해제되었습니다.`);
  acctRender();
  acctRefreshDrawerIfOpen();
}

/* ── 상세 드로어 ── */
function acctOpenDrawer(id){
  const a = accounts.find(x=>x.id===id); if(!a) return;
  currentTargetId = id;
  const role = ROLE_MAP[a.role]||{name:a.role,color:'gray'};
  const st = STATUS_META[a.status]||{label:a.status,badge:'badge-gray'};
  $('acctDrawerName').textContent = a.name;
  $('acctDrawerEmail').textContent = a.email;
  $('acctDrawerBody').innerHTML = `
    <div class="acct-detail-section">
      <div class="acct-detail-section-title">기본 정보</div>
      <!-- [Phase 17-I] 사번 row 제거 (정책서 외 잔존 필드). 소속 사업자명 우선 표기. -->
      <div class="acct-detail-row"><div class="acct-detail-row-label">소속 사업자명</div><div class="acct-detail-row-val">${a.company||'—'}</div></div>
      ${a.team?`<div class="acct-detail-row"><div class="acct-detail-row-label">부서</div><div class="acct-detail-row-val">${a.team}</div></div>`:''}
      ${a.position?`<div class="acct-detail-row"><div class="acct-detail-row-label">직책</div><div class="acct-detail-row-val">${a.position}</div></div>`:''}
      <div class="acct-detail-row"><div class="acct-detail-row-label">상태</div><div class="acct-detail-row-val"><span class="badge ${st.badge}">${st.label}</span></div></div>
      ${a.phone?`<div class="acct-detail-row"><div class="acct-detail-row-label">전화번호</div><div class="acct-detail-row-val" style="font-variant-numeric:tabular-nums;">${a.phone}</div></div>`:''}
      <div class="acct-detail-row"><div class="acct-detail-row-label">생성일</div><div class="acct-detail-row-val">${a.createdAt}</div></div>
      ${a.validUntil?`<div class="acct-detail-row"><div class="acct-detail-row-label">유효기간</div><div class="acct-detail-row-val">${a.validUntil}</div></div>`:''}
    </div>
    <div class="acct-detail-section">
      <div class="acct-detail-section-title">최근 활동</div>
      <div class="acct-detail-row"><div class="acct-detail-row-label">최근 로그인</div><div class="acct-detail-row-val" style="font-variant-numeric:tabular-nums;">${a.lastLogin}</div></div>
      <div class="acct-detail-row"><div class="acct-detail-row-label">접속 IP</div><div class="acct-detail-row-val" style="font-family:monospace;">${a.lastIp}</div></div>
    </div>
    <div class="acct-detail-section">
      <div class="acct-detail-section-title">설정된 권한</div>
      <span class="badge badge-${role.color}" style="margin-bottom:8px;display:inline-block;">${role.name}</span>
      <div style="font-size:11px;color:var(--text-sub);line-height:1.55;">${role.desc}</div>
    </div>
    <div class="acct-detail-section">
      <div class="acct-drawer-actions">
        <button class="btn btn-primary btn-sm" onclick="acctOpenPerm('${a.id}')">권한 수정</button>
        <button class="btn btn-warn btn-sm" onclick="acctOpenReset('${a.id}')">비밀번호 초기화</button>
        ${a.status!=='INACTIVE'
          ? `<button class="btn btn-danger btn-sm" onclick="acctOpenDelete('${a.id}')">계정 비활성화</button>`
          : `<button class="btn btn-success btn-sm" onclick="acctReactivate('${a.id}')">재활성화</button>`}
        ${a.status==='LOCKED'?`<button class="btn btn-success btn-sm" onclick="acctUnlock('${a.id}')">잠금 해제</button>`:''}
      </div>
    </div>`;
  $('acctDrawer').classList.add('show');
}
function acctCloseDrawer(){ $('acctDrawer').classList.remove('show'); }
function acctRefreshDrawerIfOpen(){
  if($('acctDrawer').classList.contains('show') && currentTargetId) acctOpenDrawer(currentTargetId);
}

/* window에 노출 (onclick에서 참조) */
