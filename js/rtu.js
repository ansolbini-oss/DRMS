/* ════════════════════════════════════════════════════════════
   RTU 관리 — Phase 17-R
   사업장별 RTU(Remote Terminal Unit) 통신 상태 모니터링.
   - 60hz 서버 ↔ RTU 통신 (인입)
   - KPX VEN 채널 ↔ RTU 데이터 송신 (송출)
   - RTU 스펙·인증서·펌웨어 정보
   책임 분리:
     · 전력데이터 수집현황 = 수신된 데이터 자체 진단
     · RTU 관리(여기)        = 물리 장비 + 통신 채널 상태
════════════════════════════════════════════════════════════ */

const rtuState = {
  filter: { q:'', status:'all', type:'all' },
  selectedRtuId: null,
};

/* 페이지 진입점 */
function rtuInit(){
  // 목록뷰로 복귀
  const listV = $('rtu-list-view'), detailV = $('rtu-detail-view');
  if(listV) listV.style.display = 'flex';
  if(detailV) detailV.style.display = 'none';
  rtuRender();
}

/* 사이트 + customer 정보를 합쳐 RTU 행 데이터 구성 */
function rtuCollectRows(){
  const rows = [];
  store.customers.forEach(c => {
    if(c.status !== '계약완료') return;
    const sites = (typeof pcGetSites === 'function') ? pcGetSites(c) : (c.sites || [{id:c.id+'-S1', siteName:c.name+' 본사', kepco:c.kepco}]);
    sites.forEach(s => {
      // RTU 정보가 없으면 시드 기본값 자동 생성 (KEPCO 끝자리 기반 시뮬레이션)
      if(!s.rtu) s.rtu = rtuGenerateMockRtu(s, c);
      // 자원그룹 찾기
      const ownerGroup = store.groups.find(g => (g.customerIds||[]).includes(c.id));
      rows.push({
        rtuId: s.rtu.id,
        custId: c.id,
        custName: c.name,
        siteId: s.id,
        siteName: s.siteName,
        kepco: s.kepco,
        ownerGroup,
        rtu: s.rtu,
      });
    });
  });
  return rows;
}

/* 가상 RTU 시드 — KEPCO 끝자리 기반 결정론적 분기 */
function rtuGenerateMockRtu(site, cust){
  const kepcoStr = String(site.kepco || cust.kepco || '');
  const lastDigit = parseInt(kepcoStr.slice(-1), 10) || 0;
  // 끝자리 짝수: 60hz 정상 / 홀수: 60hz 이상
  const hzOk = lastDigit % 2 === 0;
  // 끝자리 0~6: KPX 정상 / 7~9: KPX 이상
  const kpxOk = lastDigit <= 6;
  // 모델: 자원유형 기반
  const modelMap = {
    'standard': 'XEMS-RTU-2000',
    'small':    'XEMS-RTU-1000',
    'national': 'NEMS-RTU-500',
    'jeju':     'JEMS-RTU-1500',
  };
  const ownerGroup = store.groups.find(g => (g.customerIds||[]).includes(cust.id));
  const typeKey = ownerGroup?.typeKey || 'standard';
  // RTU 번호 (KEPCO 기반)
  const rtuNum = 'RTU-' + kepcoStr;
  // 펌웨어 버전 (KEPCO 패리티 기반)
  const fwVer = (lastDigit % 2 === 0) ? '2.4.1' : '2.3.5';
  // 인증서 만료일
  const certYear = 2027 - (lastDigit % 3);
  const certMonth = String(((lastDigit * 3) % 12) + 1).padStart(2, '0');
  return {
    id: rtuNum,
    serial: 'SN' + kepcoStr + (lastDigit * 7).toString().padStart(3, '0'),
    model: modelMap[typeKey] || 'XEMS-RTU-2000',
    manufacturer: 'Xems Korea',
    firmware: fwVer,
    ip: '10.' + (lastDigit + 1) + '.' + ((lastDigit * 3) % 256) + '.' + ((lastDigit * 7) % 256),
    port: 8443,
    hzCommStatus: hzOk ? 'OK' : 'FAIL',
    kpxCommStatus: kpxOk ? 'OK' : 'FAIL',
    lastHzSyncMinutesAgo: hzOk ? (lastDigit * 2 + 1) : (lastDigit * 30 + 60),
    lastKpxSyncMinutesAgo: kpxOk ? (lastDigit * 5 + 3) : (lastDigit * 45 + 90),
    venCertExpires: `${certYear}-${certMonth}-15`,
    venCertId: 'VEN-CERT-' + kepcoStr.slice(-4),
    installedAt: '2024-' + String(((lastDigit % 12) + 1)).padStart(2, '0') + '-15',
    lastInspectedAt: '2026-' + String(((lastDigit % 6) + 1)).padStart(2, '0') + '-10',
  };
}

/* 통신 종합 상태 (필터용) */
function rtuOverallStatus(r){
  const a = r.rtu.hzCommStatus === 'OK';
  const b = r.rtu.kpxCommStatus === 'OK';
  if(a && b) return 'ok';
  if(a && !b) return 'hz-only';
  if(!a && b) return 'kpx-only';
  return 'bad';
}

/* 필터 적용 */
function rtuFilteredRows(){
  const all = rtuCollectRows();
  const q = (rtuState.filter.q || '').trim().toLowerCase();
  const st = rtuState.filter.status;
  const tp = rtuState.filter.type;
  return all.filter(r => {
    if(q){
      const hit = r.custName.toLowerCase().includes(q)
               || r.siteName.toLowerCase().includes(q)
               || (r.rtu.id || '').toLowerCase().includes(q)
               || (r.kepco || '').includes(q);
      if(!hit) return false;
    }
    if(st !== 'all' && rtuOverallStatus(r) !== st) return false;
    if(tp !== 'all'){
      const ownerTypeKey = r.ownerGroup?.typeKey || '';
      if(ownerTypeKey !== tp) return false;
    }
    return true;
  });
}

/* KPI 카드 갱신 */
function rtuRefreshKpis(){
  const all = rtuCollectRows();
  const total = all.length;
  const hzOk  = all.filter(r => r.rtu.hzCommStatus === 'OK').length;
  const kpxOk = all.filter(r => r.rtu.kpxCommStatus === 'OK').length;
  const bad   = all.filter(r => rtuOverallStatus(r) === 'bad').length;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  set('rtu-kpi-total', total);
  set('rtu-kpi-hz', `${hzOk}/${total}`);
  set('rtu-kpi-kpx', `${kpxOk}/${total}`);
  set('rtu-kpi-bad', bad);
}

/* 목록 렌더 */
function rtuRender(){
  // 필터 값 동기화
  rtuState.filter.q = $('rtu-q')?.value || '';
  rtuState.filter.status = $('rtu-status-filter')?.value || 'all';
  rtuState.filter.type = $('rtu-type-filter')?.value || 'all';

  rtuRefreshKpis();
  const rows = rtuFilteredRows();
  const tbody = $('rtu-tbody');
  if(!tbody) return;

  if(rows.length === 0){
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-hint);">조건에 맞는 RTU가 없습니다.</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(r => {
      const hzBadge = rtuStatusBadge(r.rtu.hzCommStatus);
      const kpxBadge = rtuStatusBadge(r.rtu.kpxCommStatus);
      const lastSync = Math.min(r.rtu.lastHzSyncMinutesAgo, r.rtu.lastKpxSyncMinutesAgo);
      const lastSyncTxt = lastSync < 60 ? `${lastSync}분 전` : `${Math.floor(lastSync/60)}시간 전`;
      return `<tr style="cursor:pointer;" onclick="rtuOpenDetail('${r.rtu.id}')">
        <td>${r.custName}</td>
        <td>${r.siteName}<div style="font-size:10px;color:var(--text-hint);font-family:monospace;">KEPCO ${r.kepco}</div></td>
        <td style="font-family:monospace;font-size:11px;">${r.rtu.id}</td>
        <td>${r.rtu.model}<div style="font-size:10px;color:var(--text-hint);">FW ${r.rtu.firmware}</div></td>
        <td style="text-align:center;">${hzBadge}</td>
        <td style="text-align:center;">${kpxBadge}</td>
        <td style="font-size:11px;color:var(--text-sub);">${lastSyncTxt}</td>
        <td style="text-align:center;"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();rtuOpenDetail('${r.rtu.id}')">상세</button></td>
      </tr>`;
    }).join('');
  }
  const countEl = $('rtu-count');
  if(countEl) countEl.textContent = `총 ${rows.length}개 RTU`;
}

/* 통신 상태 뱃지 */
function rtuStatusBadge(s){
  if(s === 'OK') return `<span class="badge badge-done" style="font-size:10px;">● 정상</span>`;
  if(s === 'FAIL') return `<span class="badge badge-fail" style="font-size:10px;">● 이상</span>`;
  return `<span class="badge badge-gray" style="font-size:10px;">● 미확인</span>`;
}

/* 필터 초기화 */
function rtuResetFilters(){
  if($('rtu-q')) $('rtu-q').value = '';
  if($('rtu-status-filter')) $('rtu-status-filter').value = 'all';
  if($('rtu-type-filter')) $('rtu-type-filter').value = 'all';
  rtuRender();
}

/* 통신 상태 새로고침 (시뮬레이션) */
function rtuRefreshAll(){
  if(typeof showToast === 'function') showToast('모든 RTU 통신 상태 점검 중...');
  setTimeout(() => {
    rtuRender();
    if(typeof showToast === 'function') showToast('통신 상태 점검 완료');
  }, 800);
}

/* 상세 진입 */
function rtuOpenDetail(rtuId){
  const rows = rtuCollectRows();
  const r = rows.find(x => x.rtu.id === rtuId);
  if(!r){ if(typeof showToast === 'function') showToast('RTU를 찾을 수 없습니다.'); return; }
  rtuState.selectedRtuId = rtuId;

  $('rtu-list-view').style.display = 'none';
  $('rtu-detail-view').style.display = 'flex';
  $('rtu-d-title').textContent = `${r.custName} - ${r.siteName}`;
  $('rtu-d-crumb').textContent = `${r.custName} > ${r.siteName}`;

  // [Phase 17-S] 상단 [전력데이터 수집현황 →] 버튼은 자원그룹 있을 때만 노출
  const jumpBtn = document.getElementById('rtu-d-jump-dc');
  if(jumpBtn){
    jumpBtn.style.display = r.ownerGroup ? '' : 'none';
    jumpBtn.dataset.gid = r.ownerGroup ? r.ownerGroup.id : '';
  }

  const rtu = r.rtu;
  const hzCls = rtu.hzCommStatus === 'OK' ? 'good' : 'bad';
  const kpxCls = rtu.kpxCommStatus === 'OK' ? 'good' : 'bad';
  const hzColor = rtu.hzCommStatus === 'OK' ? 'var(--green)' : 'var(--red)';
  const kpxColor = rtu.kpxCommStatus === 'OK' ? 'var(--green)' : 'var(--red)';

  // VEN 인증서 만료 임박 (90일 이내) 경고
  const certDate = new Date(rtu.venCertExpires);
  const daysToExpire = Math.floor((certDate - new Date()) / (1000 * 60 * 60 * 24));
  const certWarning = daysToExpire <= 90 && daysToExpire > 0;
  const certExpired = daysToExpire <= 0;

  $('rtu-d-body').innerHTML = `
    <!-- 통신 상태 카드 (2채널) -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <div class="op-card ${rtu.hzCommStatus === 'OK' ? '' : 'op-card-alert danger'}">
        <div style="padding:14px 16px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <div style="width:10px;height:10px;border-radius:50%;background:${hzColor};"></div>
            <div style="font-size:12px;color:var(--text-hint);font-weight:500;">60hz 서버 ↔ RTU</div>
          </div>
          <div style="font-size:18px;font-weight:700;color:${hzColor};">${rtu.hzCommStatus === 'OK' ? '정상' : '통신 실패'}</div>
          <div style="margin-top:8px;font-size:11px;color:var(--text-sub);">
            마지막 수신: ${rtu.lastHzSyncMinutesAgo < 60 ? `${rtu.lastHzSyncMinutesAgo}분 전` : `${Math.floor(rtu.lastHzSyncMinutesAgo/60)}시간 전`}
          </div>
        </div>
      </div>
      <div class="op-card ${rtu.kpxCommStatus === 'OK' ? '' : 'op-card-alert danger'}">
        <div style="padding:14px 16px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <div style="width:10px;height:10px;border-radius:50%;background:${kpxColor};"></div>
            <div style="font-size:12px;color:var(--text-hint);font-weight:500;">KPX VEN 채널</div>
          </div>
          <div style="font-size:18px;font-weight:700;color:${kpxColor};">${rtu.kpxCommStatus === 'OK' ? '정상' : '통신 실패'}</div>
          <div style="margin-top:8px;font-size:11px;color:var(--text-sub);">
            마지막 송신: ${rtu.lastKpxSyncMinutesAgo < 60 ? `${rtu.lastKpxSyncMinutesAgo}분 전` : `${Math.floor(rtu.lastKpxSyncMinutesAgo/60)}시간 전`}
          </div>
        </div>
      </div>
    </div>

    <!-- [Phase 17-S] 사업장 정보 카드 — 비니 요청: 사업장명·담당자·연락처·주소 + [정보 수정] 액션 -->
    <div class="r-card" style="margin-bottom:14px;">
      <div class="r-card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <div class="r-card-title">사업장 정보</div>
        <button class="btn btn-secondary btn-sm" onclick="rtuOpenEditSite('${r.rtu.id}')">정보 수정</button>
      </div>
      <div class="r-card-body">
        <table class="info-table">
          <tbody>
            <tr><td>사업장명</td><td>${r.siteName}</td></tr>
            <tr><td>담당자</td><td>${rtuGetSiteField(r, 'manager') || '—'}</td></tr>
            <tr><td>연락처</td><td>${rtuGetSiteField(r, 'tel') || '—'}</td></tr>
            <tr><td>주소</td><td>${rtuGetSiteField(r, 'addr') || '—'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- RTU 스펙 카드 -->
    <div class="r-card" style="margin-bottom:14px;">
      <div class="r-card-header"><div class="r-card-title">RTU 스펙</div></div>
      <div class="r-card-body">
        <table class="info-table">
          <tbody>
            <tr><td>RTU 번호</td><td style="font-family:monospace;">${rtu.id}</td></tr>
            <tr><td>시리얼 번호</td><td style="font-family:monospace;">${rtu.serial}</td></tr>
            <tr><td>모델명</td><td>${rtu.model}</td></tr>
            <tr><td>제조사</td><td>${rtu.manufacturer}</td></tr>
            <tr><td>펌웨어 버전</td><td>${rtu.firmware} ${rtu.firmware !== '2.4.1' ? '<span style="color:var(--amber);font-size:10px;margin-left:4px;">업데이트 권장</span>' : ''}</td></tr>
            <tr><td>설치일</td><td>${rtu.installedAt}</td></tr>
            <tr><td>최근 점검일</td><td>${rtu.lastInspectedAt}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 통신 설정 카드 -->
    <div class="r-card" style="margin-bottom:14px;">
      <div class="r-card-header"><div class="r-card-title">통신 설정</div></div>
      <div class="r-card-body">
        <table class="info-table">
          <tbody>
            <tr><td>IP 주소</td><td style="font-family:monospace;">${rtu.ip}</td></tr>
            <tr><td>포트</td><td style="font-family:monospace;">${rtu.port}</td></tr>
            <tr><td>VEN 인증서 ID</td><td style="font-family:monospace;">${rtu.venCertId}</td></tr>
            <tr><td>VEN 인증서 만료일</td><td>
              ${rtu.venCertExpires}
              ${certExpired ? '<span class="badge badge-fail" style="margin-left:8px;font-size:10px;">만료됨</span>'
                : certWarning ? `<span class="badge badge-pending" style="margin-left:8px;font-size:10px;">${daysToExpire}일 후 만료</span>`
                : '<span class="badge badge-done" style="margin-left:8px;font-size:10px;">유효</span>'}
            </td></tr>
          </tbody>
        </table>
        ${(certExpired || certWarning) ? `<div style="margin-top:10px;padding:10px 12px;background:var(--amber-light, #fffbf0);border:1px solid var(--amber-border, #f59e0b);border-radius:6px;font-size:11px;color:var(--text-sub);line-height:1.6;">
          ⚠️ VEN 인증서 ${certExpired ? '갱신이 필요합니다' : '만료가 임박했습니다'}. 운영팀과 협의해 사전 갱신 진행 부탁드립니다.
        </div>` : ''}
      </div>
    </div>

    <!-- 액션 (전력데이터 수집현황 점프는 상단으로 이동) + 설명 hint -->
    <div style="margin-bottom:14px;">
      <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="rtuRetestComm()">통신 재시도</button>
        <button class="btn btn-secondary btn-sm" onclick="rtuRequestFwUpdate()">펌웨어 업데이트 요청</button>
        <button class="btn btn-secondary btn-sm" onclick="rtuRenewCert()">VEN 인증서 갱신 요청</button>
      </div>
      <div style="padding:10px 12px;background:var(--grey-light,#f8f9fa);border-radius:6px;font-size:11px;color:var(--text-sub);line-height:1.6;">
        <b>· 펌웨어 업데이트</b> — KPX/한전 통신 프로토콜 변경·보안 패치·버그 수정 시 필수. 옛 펌웨어 RTU는 신규 표준에 송신 실패 가능.<br>
        <b>· VEN 인증서 갱신</b> — OpenADR 채널 인증서 만료 시 KPX 통신이 즉시 차단됨. 만료 90일 전부터 사전 갱신 필수.
      </div>
    </div>
  `;
}

/* [Phase 17-S] 사업장 필드 조회 헬퍼 */
function rtuGetSiteField(r, field){
  // 1) 사업자 c.sites 안의 사이트에서 우선 찾고
  const c = custById(r.custId);
  if(c){
    const sites = (typeof pcGetSites === 'function') ? pcGetSites(c) : (c.sites || []);
    const s = sites.find(x => x.id === r.siteId);
    if(s && s[field]) return s[field];
    // 2) customer 자체 필드 fallback (가상 사이트 케이스)
    if(c[field]) return c[field];
    if(field === 'manager' && c.ceo) return c.ceo;
  }
  return '';
}

/* [Phase 17-S] 사업장 정보 수정 모달 */
function rtuOpenEditSite(rtuId){
  const rows = rtuCollectRows();
  const r = rows.find(x => x.rtu.id === rtuId);
  if(!r) return;
  const cur = {
    siteName: r.siteName,
    manager:  rtuGetSiteField(r, 'manager'),
    tel:      rtuGetSiteField(r, 'tel'),
    addr:     rtuGetSiteField(r, 'addr'),
  };
  $('cm-title').textContent = '사업장 정보 수정';
  $('cm-sub').textContent = `${r.custName} - ${r.siteName}`;
  $('cm-body').innerHTML = `<div class="info-box" style="margin-bottom:12px;">
    사업장 운영 정보를 수정합니다. 변경 시 감사로그가 기록됩니다.
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;">
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">사업장명 <span style="color:var(--red);">*</span></label>
      <input id="rtu-edit-name" type="text" value="${(cur.siteName||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">담당자</label>
      <input id="rtu-edit-manager" type="text" value="${(cur.manager||'').replace(/"/g,'&quot;')}" placeholder="현장 책임자 이름" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">연락처</label>
      <input id="rtu-edit-tel" type="text" value="${(cur.tel||'').replace(/"/g,'&quot;')}" placeholder="010-0000-0000" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">주소</label>
      <input id="rtu-edit-addr" type="text" value="${(cur.addr||'').replace(/"/g,'&quot;')}" placeholder="시·구·상세주소" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
  </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="rtuSubmitEditSite('${rtuId}')">저장</button>`;
  openModal('commonModal');
}

function rtuSubmitEditSite(rtuId){
  const rows = rtuCollectRows();
  const r = rows.find(x => x.rtu.id === rtuId);
  if(!r) return;
  const c = custById(r.custId);
  const sites = (typeof pcGetSites === 'function') ? pcGetSites(c) : (c.sites || []);
  const s = sites.find(x => x.id === r.siteId);
  if(!s){ if(typeof showToast === 'function') showToast('사업장을 찾을 수 없습니다.'); return; }

  const newName    = $('rtu-edit-name')?.value?.trim();
  const newManager = $('rtu-edit-manager')?.value?.trim();
  const newTel     = $('rtu-edit-tel')?.value?.trim();
  const newAddr    = $('rtu-edit-addr')?.value?.trim();
  if(!newName){ alert('사업장명은 필수 입력입니다.'); return; }

  const changes = [];
  if(s.siteName !== newName){ changes.push(`사업장명: ${s.siteName} → ${newName}`); s.siteName = newName; }
  if((s.manager||'') !== newManager){ changes.push(`담당자: ${s.manager||'(미입력)'} → ${newManager||'(미입력)'}`); s.manager = newManager; }
  if((s.tel||'') !== newTel){ changes.push(`연락처: ${s.tel||'(미입력)'} → ${newTel||'(미입력)'}`); s.tel = newTel; }
  if((s.addr||'') !== newAddr){ changes.push(`주소: ${s.addr||'(미입력)'} → ${newAddr||'(미입력)'}`); s.addr = newAddr; }

  logAudit?.({
    objectType:'site', objectId:r.siteId, action:'site_info_updated',
    title:`사업장 정보 수정 — ${newName}`,
    desc: changes.length ? changes.join(' · ') : '변경 사항 없음',
    actor:'운영자', tone:'info'
  });
  closeModal('commonModal');
  if(typeof showToast === 'function') showToast(`사업장 정보 저장 — ${newName}`);
  rtuOpenDetail(rtuId);
}

/* [Phase 17-S] 상단 헤더에서 전력데이터 수집현황으로 점프 */
function rtuGoToDataCollectFromDetail(){
  const btn = document.getElementById('rtu-d-jump-dc');
  const gid = btn?.dataset?.gid;
  if(!gid){ if(typeof showToast === 'function') showToast('연결된 자원그룹이 없습니다.'); return; }
  rtuGoToDataCollect(parseInt(gid, 10));
}

/* [Phase 17-S] 엑셀 업로드 — 일괄 RTU 정보 등록·수정 */
function rtuOpenUpload(){
  $('cm-title').textContent = 'RTU 정보 엑셀 업로드';
  $('cm-sub').textContent = '여러 사업장의 RTU 정보를 한 번에 등록·수정합니다.';
  $('cm-body').innerHTML = `<div class="info-box" style="margin-bottom:12px;">
    ⓘ 양식: 사업자명·사업장명·KEPCO·RTU 번호·시리얼·모델·펌웨어·IP·포트·VEN 인증서 정보 등 (.xlsx)
    <a href="#" onclick="event.preventDefault();rtuDownloadTemplate();" style="margin-left:8px;color:var(--blue);text-decoration:underline;">양식 다운로드</a>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;">
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">엑셀 파일 <span style="color:var(--red);">*</span></label>
      <input id="rtu-up-file" type="file" accept=".xlsx,.xls,.csv" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box;background:#fff;">
      <div style="font-size:10px;color:var(--text-hint);margin-top:4px;">.xlsx, .xls, .csv (최대 10MB)</div>
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">업로드 모드</label>
      <select id="rtu-up-mode" class="filter-select" style="width:100%;">
        <option value="upsert">신규 등록 + 기존 수정 (upsert)</option>
        <option value="insert">신규 등록만 (기존 있으면 skip)</option>
        <option value="update">기존 수정만 (신규 행 skip)</option>
      </select>
    </div>
  </div>
  <div style="margin-top:10px;padding:8px 12px;background:var(--grey-light,#f8f9fa);border-radius:6px;font-size:10px;color:var(--text-hint);">
    ⓘ 업로드 후 검증 결과(성공·실패·warning) 리포트가 표시됩니다.
  </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="rtuDoUpload()">업로드 실행</button>`;
  openModal('commonModal');
}

function rtuDoUpload(){
  const file = $('rtu-up-file')?.files?.[0];
  const mode = $('rtu-up-mode')?.value || 'upsert';
  if(!file){ alert('업로드할 엑셀 파일을 선택하세요.'); return; }
  if(file.size > 10 * 1024 * 1024){ alert('파일 크기는 10MB 이하여야 합니다.'); return; }

  $('cm-title').textContent = 'RTU 정보 업로드 중';
  $('cm-body').innerHTML = `<div style="padding:32px 16px;text-align:center;">
      <div style="display:inline-block;width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--blue);border-radius:50%;animation:rtu-up-spin 0.9s linear infinite;"></div>
      <div style="margin-top:14px;font-size:13px;color:var(--text-sub);font-weight:500;">파일 검증·반영 중...</div>
      <div style="margin-top:4px;font-size:11px;color:var(--text-hint);">${file.name} (${(file.size/1024).toFixed(1)} KB) · 모드: ${mode}</div>
    </div>
    <style>@keyframes rtu-up-spin{to{transform:rotate(360deg);}}</style>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" disabled style="opacity:0.5;cursor:not-allowed;">처리 중...</button>`;

  setTimeout(()=>{
    // 시뮬레이션: 성공 N건 / 경고 M건 / 실패 K건
    const total = 12 + Math.floor(Math.random() * 8);
    const fail = Math.floor(Math.random() * 3);
    const warn = Math.floor(Math.random() * 2);
    const ok = total - fail - warn;
    logAudit?.({
      objectType:'rtu', objectId:'bulk', action:'rtu_bulk_upload',
      title:`RTU 일괄 업로드`,
      desc:`파일 ${file.name} · 모드 ${mode} · 성공 ${ok} · 경고 ${warn} · 실패 ${fail}`,
      actor:'운영자', tone: fail > 0 ? 'warn' : 'info'
    });
    $('cm-title').textContent = '업로드 완료';
    $('cm-body').innerHTML = `<div style="background:var(--green-light);border:1px solid var(--green-border);border-radius:var(--radius);padding:16px;display:flex;gap:12px;align-items:flex-start;margin-bottom:12px;">
        <div style="width:24px;height:24px;border-radius:50%;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">✓</div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;color:var(--green);">업로드 완료</div>
          <div style="font-size:12px;color:var(--text-sub);margin-top:4px;">총 ${total}행 처리</div>
        </div>
      </div>
      <div class="check-item-row"><span>성공</span><span style="color:var(--green);font-weight:600;">${ok}건</span></div>
      <div class="check-item-row"><span>경고</span><span style="color:var(--amber);font-weight:600;">${warn}건</span></div>
      <div class="check-item-row"><span>실패</span><span style="color:var(--red);font-weight:600;">${fail}건</span></div>
      ${(warn > 0 || fail > 0) ? '<div style="margin-top:10px;padding:8px 12px;background:var(--grey-light,#f8f9fa);border-radius:6px;font-size:11px;color:var(--text-sub);">경고/실패 행은 별도 리포트에서 확인 (목업)</div>' : ''}`;
    $('cm-footer').innerHTML = `<button class="btn btn-primary" onclick="closeModal('commonModal');rtuRender();">확인</button>`;
    if(typeof showToast === 'function') showToast(`RTU 업로드 완료 — 성공 ${ok}건`);
  }, 1200);
}

function rtuDownloadTemplate(){
  if(typeof showToast === 'function') showToast('RTU 양식 다운로드 — 실 환경에서는 .xlsx 파일이 다운로드됩니다 (목업)');
}

/* [Phase 17-S] 엑셀 다운로드 — 현재 필터 범위의 RTU 정보 전체 */
function rtuExportExcel(){
  const rows = rtuFilteredRows();
  if(typeof showToast === 'function') showToast(`RTU ${rows.length}건 엑셀 다운로드 (목업) — 사업자·사업장·RTU·통신·인증서 정보 포함`);
  logAudit?.({
    objectType:'rtu', objectId:'bulk', action:'rtu_excel_export',
    title:`RTU 정보 엑셀 다운로드`,
    desc:`${rows.length}건 추출`,
    actor:'운영자', tone:'info'
  });
}

/* 목록으로 복귀 */
function rtuGotoList(){
  $('rtu-list-view').style.display = 'flex';
  $('rtu-detail-view').style.display = 'none';
  rtuState.selectedRtuId = null;
}

/* 통신 재시도 (시뮬레이션) */
function rtuRetestComm(){
  const rtuId = rtuState.selectedRtuId;
  if(!rtuId){ if(typeof showToast === 'function') showToast('대상 RTU가 없습니다.'); return; }
  const rows = rtuCollectRows();
  const r = rows.find(x => x.rtu.id === rtuId);
  if(!r) return;
  // 시뮬레이션: 1.2초 후 상태 복구 시도 (KEPCO 끝자리 짝수만 성공)
  if(typeof showToast === 'function') showToast(`${r.siteName} RTU 통신 재시도 중...`);
  setTimeout(() => {
    const kepcoStr = String(r.kepco || '');
    const lastDigit = parseInt(kepcoStr.slice(-1), 10) || 0;
    const success = lastDigit % 2 === 0;
    if(success){
      r.rtu.hzCommStatus = 'OK';
      r.rtu.kpxCommStatus = 'OK';
      r.rtu.lastHzSyncMinutesAgo = 1;
      r.rtu.lastKpxSyncMinutesAgo = 3;
      if(typeof showToast === 'function') showToast(`${r.siteName} 통신 정상 복구`);
      logAudit?.({objectType:'rtu', objectId:rtuId, action:'comm_retry_success',
        title:`RTU 통신 재시도 성공 — ${r.siteName}`,
        desc:`KEPCO ${r.kepco}`, actor:'운영자', tone:'success'});
    } else {
      if(typeof showToast === 'function') showToast(`${r.siteName} 통신 실패 — 현장 점검 필요`);
      logAudit?.({objectType:'rtu', objectId:rtuId, action:'comm_retry_failed',
        title:`RTU 통신 재시도 실패 — ${r.siteName}`,
        desc:`KEPCO ${r.kepco}`, actor:'운영자', tone:'warn'});
    }
    rtuOpenDetail(rtuId);
  }, 1200);
}

/* 펌웨어 업데이트 요청 stub */
function rtuRequestFwUpdate(){
  if(typeof showToast === 'function') showToast('펌웨어 업데이트 요청 접수 — 운영팀이 일정 협의 후 진행합니다 (목업)');
  logAudit?.({objectType:'rtu', objectId:rtuState.selectedRtuId, action:'fw_update_requested',
    title:`펌웨어 업데이트 요청`, desc:'운영팀 협의 대기', actor:'운영자', tone:'info'});
}

/* VEN 인증서 갱신 요청 stub */
function rtuRenewCert(){
  if(typeof showToast === 'function') showToast('VEN 인증서 갱신 요청 접수 — 발급 기관 협의 후 진행합니다 (목업)');
  logAudit?.({objectType:'rtu', objectId:rtuState.selectedRtuId, action:'cert_renew_requested',
    title:`VEN 인증서 갱신 요청`, desc:'발급 기관 협의 대기', actor:'운영자', tone:'info'});
}

/* 전력데이터 수집현황으로 점프 */
function rtuGoToDataCollect(groupId){
  if(typeof dcState !== 'undefined') dcState.groupId = String(groupId);
  if(typeof navigate === 'function') navigate('datacollect');
  setTimeout(() => {
    if(typeof dcOpenDetail === 'function') dcOpenDetail(groupId);
  }, 0);
}

/* CSV 내보내기 stub */
function rtuExportCsv(){
  if(typeof showToast === 'function') showToast('RTU 목록 CSV 다운로드 (목업)');
}
