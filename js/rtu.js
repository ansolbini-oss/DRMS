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
      // [v0.7] '_pendingRtu' 플래그가 붙은 사업장은 auto-generate 스킵 → RTU 등록 팝업 대상으로 남김
      if(!s.rtu && !s._pendingRtu) s.rtu = rtuGenerateMockRtu(s, c);
      if(!s.rtu) return; // 아직 등록되지 않은 사업장은 목록에서 제외
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
        contractStatus: rtuContractStatus(c, s),
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
  // [v0.7 도메인 필드 확장] 인터넷 연결 방식·연결 계량기·하위 설비
  const connType = (lastDigit % 3 === 0) ? '무선 LTE' : '유선 이더넷(LAN)';
  const meterKinds = ['본관 메인 계량기', '발전용 계량기', '수용가 총괄 계량기'];
  const meterName = meterKinds[lastDigit % meterKinds.length];
  const downstreamPool = [
    {type:'인버터',   model:'KSTAR KSG1-250K'},
    {type:'접속함',   model:'DY-5010'},
    {type:'특고압 계전기', model:'현대 VCB'},
    {type:'저압 계전기',   model:'LS ACB'},
    {type:'전력용 콘덴서', model:'YPC-3P-30kVar'},
  ];
  // 자원유형별 하위 설비 조합 (결정론적)
  const dsMap = {
    standard: [downstreamPool[0], downstreamPool[2], downstreamPool[3]],
    small:    [downstreamPool[3]],
    national: [downstreamPool[4]],
    jeju:     [downstreamPool[0], downstreamPool[1]],
  };
  const downstream = dsMap[typeKey] || [downstreamPool[3]];

  return {
    id: rtuNum,
    serial: 'SN' + kepcoStr + (lastDigit * 7).toString().padStart(3, '0'),
    model: modelMap[typeKey] || 'XEMS-RTU-2000',
    manufacturer: 'Xems Korea',
    firmware: fwVer,
    ip: '10.' + (lastDigit + 1) + '.' + ((lastDigit * 3) % 256) + '.' + ((lastDigit * 7) % 256),
    port: 8443,
    // [v0.7] 통신 연결 정보 확장
    connType,                    // 인터넷 연결 방식 (유선 LAN / 무선 LTE)
    consolePort: 'MicroUSB',     // 현장 점검용 콘솔 포트 (참고)
    hzCommStatus: hzOk ? 'OK' : 'FAIL',
    kpxCommStatus: kpxOk ? 'OK' : 'FAIL',
    lastHzSyncMinutesAgo: hzOk ? (lastDigit * 2 + 1) : (lastDigit * 30 + 60),
    lastKpxSyncMinutesAgo: kpxOk ? (lastDigit * 5 + 3) : (lastDigit * 45 + 90),
    venCertExpires: `${certYear}-${certMonth}-15`,
    venCertId: 'VEN-CERT-' + kepcoStr.slice(-4),
    installedAt: '2024-' + String(((lastDigit % 12) + 1)).padStart(2, '0') + '-15',
    lastInspectedAt: '2026-' + String(((lastDigit % 6) + 1)).padStart(2, '0') + '-10',
    // [v0.7] 하위 연결 설비
    meterName,
    meterKepco: kepcoStr,
    downstream,
  };
}

/* [v0.7] 사업장 단위 계약 상태 판정
   우선순위: siteStatus 명시(계약해지) > contract.endDate 만료 > 60일 내 만료 임박 > 계약완료 > (사업자 status 미계약) */
function rtuContractStatus(cust, site){
  if(site && site.siteStatus === '계약해지') return {label:'계약해지', cls:'badge-fail'};
  const end = site?.contract?.endDate;
  if(end){
    const today = todayStr();
    if(end < today) return {label:'계약만료', cls:'badge-gray'};
    // 60일 내 만료 임박 판정
    const d1 = new Date(end), d0 = new Date(today);
    const daysLeft = Math.floor((d1 - d0) / 86400000);
    if(daysLeft <= 60) return {label:`만료임박 D-${daysLeft}`, cls:'badge-amber'};
  }
  if(cust?.status === '계약완료') return {label:'계약완료', cls:'badge-done'};
  return {label: cust?.status || '-', cls:'badge-gray'};
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

/* 필터 적용 (v0.7 슬림 — 검색어 단일 필터) */
function rtuFilteredRows(){
  const all = rtuCollectRows();
  const q = (rtuState.filter.q || '').trim().toLowerCase();
  const st = rtuState.filter.status || 'all';
  const tp = rtuState.filter.type || 'all';
  return all.filter(r => {
    if(q){
      const hit = r.custName.toLowerCase().includes(q)
               || r.siteName.toLowerCase().includes(q)
               || (r.rtu.id || '').toLowerCase().includes(q)
               || (r.kepco || '').includes(q);
      if(!hit) return false;
    }
    // 통신·유형 필터는 UI 폐지. state 값이 남아있어도 'all'이면 무영향.
    if(st !== 'all' && rtuOverallStatus(r) !== st) return false;
    if(tp !== 'all'){
      const ownerTypeKey = r.ownerGroup?.typeKey || '';
      if(ownerTypeKey !== tp) return false;
    }
    return true;
  });
}

/* [Phase 17-W] KPI 카드 갱신 — 3개 단순화 (전체 / 정상 통신 / 이상) */
function rtuRefreshKpis(){
  const all = rtuCollectRows();
  const total = all.length;
  const ok  = all.filter(r => rtuOverallStatus(r) === 'ok').length;
  const bad = total - ok;  // 어느 한 채널이라도 이상이면 점검 대상
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  // [Phase 17-X] 분수 표기 제거 — 전체 N이 옆에 있어 합산으로 검증 가능
  set('rtu-kpi-total', total);
  set('rtu-kpi-ok', ok);
  set('rtu-kpi-bad', bad);
}

/* 목록 렌더 */
function rtuRender(){
  // [v0.7 필터 슬림] 검색어만 UI 동기화. status·type 셀렉트는 폐지.
  rtuState.filter.q = $('rtu-q')?.value || '';
  const stSel = $('rtu-status-filter');
  if(stSel) rtuState.filter.status = stSel.value;
  const tpSel = $('rtu-type-filter');
  if(tpSel) rtuState.filter.type = tpSel.value;

  rtuRefreshKpis();
  const rows = rtuFilteredRows();
  const tbody = $('rtu-tbody');
  if(!tbody) return;

  if(rows.length === 0){
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-hint);">조건에 맞는 RTU가 없습니다.</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(r => {
      const hzBadge = rtuStatusBadge(r.rtu.hzCommStatus);
      const kpxBadge = rtuStatusBadge(r.rtu.kpxCommStatus);
      const lastSync = Math.min(r.rtu.lastHzSyncMinutesAgo, r.rtu.lastKpxSyncMinutesAgo);
      const lastSyncTxt = lastSync < 60 ? `${lastSync}분 전` : `${Math.floor(lastSync/60)}시간 전`;
      const cs = r.contractStatus || {label:'-', cls:'badge-gray'};
      return `<tr style="cursor:pointer;" onclick="rtuOpenDetail('${r.rtu.id}')">
        <td>${r.custName}</td>
        <td>${r.siteName}</td>
        <td style="text-align:center;"><span class="badge ${cs.cls}" style="font-size:10px;">${cs.label}</span></td>
        <td style="font-family:monospace;font-size:11px;color:var(--text-sub);">${r.kepco || '-'}</td>
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

/* 필터 초기화 (v0.7 슬림) */
function rtuResetFilters(){
  rtuState.filter.q = '';
  rtuState.filter.status = 'all';
  rtuState.filter.type = 'all';
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

  // [Phase 17-T] 통신 상태 컴팩트 — 큰 2 카드 → 한 줄 인포 박스
  const hzText = rtu.hzCommStatus === 'OK' ? '정상' : '통신 실패';
  const kpxText = rtu.kpxCommStatus === 'OK' ? '정상' : '통신 실패';
  const hzMinTxt = rtu.lastHzSyncMinutesAgo < 60 ? `${rtu.lastHzSyncMinutesAgo}분 전` : `${Math.floor(rtu.lastHzSyncMinutesAgo/60)}시간 전`;
  const kpxMinTxt = rtu.lastKpxSyncMinutesAgo < 60 ? `${rtu.lastKpxSyncMinutesAgo}분 전` : `${Math.floor(rtu.lastKpxSyncMinutesAgo/60)}시간 전`;
  const certBadge = certExpired ? `<span class="badge badge-fail" style="margin-left:6px;font-size:10px;">만료됨</span>`
                  : certWarning ? `<span class="badge badge-pending" style="margin-left:6px;font-size:10px;">${daysToExpire}일 후 만료</span>`
                  : `<span class="badge badge-done" style="margin-left:6px;font-size:10px;">유효</span>`;

  $('rtu-d-body').innerHTML = `
    <!-- [Phase 17-T] 통신 상태 컴팩트 인포 박스 -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${hzColor};"></div>
        <span style="font-size:12px;color:var(--text-sub);">RTU ↔ 60hz</span>
        <span style="font-size:13px;font-weight:700;color:${hzColor};">${hzText}</span>
        <span style="font-size:11px;color:var(--text-hint);">· ${hzMinTxt}</span>
      </div>
      <div style="width:1px;height:18px;background:var(--border);"></div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${kpxColor};"></div>
        <span style="font-size:12px;color:var(--text-sub);">60hz ↔ KPX</span>
        <span style="font-size:13px;font-weight:700;color:${kpxColor};">${kpxText}</span>
        <span style="font-size:11px;color:var(--text-hint);">· ${kpxMinTxt}</span>
      </div>
    </div>

    <!-- 사업장 정보 카드 (정보 확인용, 수정 불가) — [v0.7] 계약상태 뱃지 병기 -->
    <div class="r-card" style="margin-bottom:14px;">
      <div class="r-card-header" style="display:flex;align-items:center;gap:10px;">
        <div class="r-card-title">사업장 정보</div>
        ${(() => { const cs = rtuContractStatus(custById(r.custId), (custById(r.custId)?.sites||[]).find(x=>x.id===r.siteId)); return `<span class="badge ${cs.cls}" style="font-size:11px;">${cs.label}</span>`; })()}
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

    <!-- [Phase 17-T] RTU 정보 카드 — 스펙 + 통신 설정 + VEN 인증서 통합 + [정보 수정] 운영자 액션 -->
    <div class="r-card" style="margin-bottom:14px;">
      <div class="r-card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <div class="r-card-title">RTU 정보</div>
        <button class="btn btn-secondary btn-sm" onclick="rtuOpenEditRtu('${r.rtu.id}')">정보 수정</button>
      </div>
      <div class="r-card-body">
        <table class="info-table">
          <tbody>
            <tr><td>RTU 번호</td><td style="font-family:monospace;">${rtu.id}</td></tr>
            <tr><td>시리얼 번호</td><td style="font-family:monospace;">${rtu.serial}</td></tr>
            <tr><td>모델명</td><td>${rtu.model}</td></tr>
            <tr><td>제조사</td><td>${rtu.manufacturer}</td></tr>
            <tr><td>펌웨어 버전</td><td>${rtu.firmware}</td></tr>
            <tr><td>설치일</td><td>${rtu.installedAt}</td></tr>
            <tr><td>최근 점검일</td><td>${rtu.lastInspectedAt}</td></tr>
            <tr><td colspan="2" style="padding-top:14px;font-size:10px;color:var(--text-hint);font-weight:600;">통신 연결 정보</td></tr>
            <tr><td>장비 IP 주소</td><td style="font-family:monospace;">${rtu.ip}</td></tr>
            <tr><td>인터넷 연결 방식</td><td>${rtu.connType || '—'}</td></tr>
            <tr><td>OpenADR TCP 포트</td><td style="font-family:monospace;">${rtu.port}</td></tr>
            <tr><td>현장 콘솔 포트</td><td>${rtu.consolePort || '—'}</td></tr>
            <tr><td>VEN 인증서 ID</td><td style="font-family:monospace;">${rtu.venCertId}</td></tr>
            <tr><td>VEN 인증서 만료일</td><td>${rtu.venCertExpires}${certBadge}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- [v0.7] 하위 연결 설비 카드 — 연결된 전력량계 + 인버터·접속함·계전기 등 -->
    <div class="r-card" style="margin-bottom:14px;">
      <div class="r-card-header"><div class="r-card-title">하위 연결 설비</div></div>
      <div class="r-card-body">
        <table class="info-table">
          <tbody>
            <tr><td>연결된 전력량계</td><td>${rtu.meterName || '—'}${rtu.meterKepco ? ` <span style="color:var(--text-hint);font-family:monospace;font-size:11px;">(KEPCO ${rtu.meterKepco})</span>` : ''}</td></tr>
            <tr><td>하위 연동 기기</td><td>${
              (Array.isArray(rtu.downstream) && rtu.downstream.length)
                ? rtu.downstream.map(d=>`${d.type} <span style="color:var(--text-hint);font-size:11px;">· ${d.model}</span>`).join('<br>')
                : '—'
            }</td></tr>
          </tbody>
        </table>
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

/* [Phase 17-T] RTU 정보 수정 — 사업장 정보는 read-only, RTU 스펙·통신 설정만 운영자 편집 가능 */
/* [v0.7] RTU 신규 등록 팝업 — 2-step wizard (①사업자·사업장 선택 → ②RTU 정보 입력) */
const rtuRegState = { pickedCustId: null, step: 1, selectedSiteIds: [], form: {} };

function rtuOpenRegister(){
  rtuRegState.pickedCustId = null;
  rtuRegState.step = 1;
  rtuRegState.selectedSiteIds = [];
  rtuRegState.form = {};
  // 헤더에 우측 상단 X 버튼 삽입
  $('cm-title').innerHTML = `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
    <span>RTU 정보 등록</span>
    <button onclick="closeModal('commonModal')" title="닫기" style="background:transparent;border:none;font-size:22px;line-height:1;color:var(--text-hint);cursor:pointer;padding:0 4px;">×</button>
  </div>`;
  openModal('commonModal');
  rtuRegRender();
}

function rtuRegRender(){
  if(rtuRegState.step === 1) rtuRegRenderStep1();
  else rtuRegRenderStep2();
}

/* Step 1: 사업자 검색 + 사업장 체크박스 다중 선택 */
function rtuRegRenderStep1(){
  $('cm-sub').innerHTML = `<span style="color:var(--blue);font-weight:600;">1/2</span> · 계약완료된 사업자를 검색해 RTU를 설치할 사업장을 선택하세요.`;
  $('cm-body').innerHTML = `
    <div class="info-box" style="margin-bottom:14px;">
      계약완료 상태의 참여고객·사업장만 검색됩니다. 사업장을 여러 개 체크하면 각 사업장 KEPCO 기반으로 RTU 번호·시리얼이 자동 채번되어 개별 등록됩니다.
    </div>
    <!-- 사업자 검색 -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:12px;">
      <label style="display:block;font-size:12px;color:var(--text-sub);font-weight:700;margin-bottom:6px;">사업자 검색 <span style="color:var(--red)">*</span></label>
      <input id="rtu-r-cust-q" type="text" placeholder="사업자명 · 사업자번호 · 대표자" oninput="rtuRegisterRenderCustList()" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:6px;font-size:14px;box-sizing:border-box;">
      <div id="rtu-r-cust-list" style="margin-top:10px;max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;background:var(--bg);"></div>
    </div>
    <!-- 사업장 체크박스 리스트 -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:14px 16px;">
      <label style="display:block;font-size:12px;color:var(--text-sub);font-weight:700;margin-bottom:6px;">RTU 설치 사업장 선택 <span style="color:var(--red)">*</span> <span style="font-weight:400;color:var(--text-hint);">(체크 · 다중 선택 가능)</span></label>
      <div id="rtu-r-site-list" style="border:1px solid var(--border);border-radius:6px;background:var(--bg);min-height:60px;padding:6px;">
        <div style="padding:14px;color:var(--text-hint);font-size:12px;text-align:center;">사업자를 먼저 선택하세요.</div>
      </div>
    </div>
  `;
  $('cm-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="rtuRegGoStep2()">다음 →</button>
  `;
  rtuRegisterRenderCustList();
  // 사업자가 이미 선택돼있으면 사업장 리스트도 복원
  if(rtuRegState.pickedCustId){ rtuRegisterPickCustomer(rtuRegState.pickedCustId, /*keepChecked=*/true); }
}

/* Step 2: RTU 정보 입력 */
function rtuRegRenderStep2(){
  const c = custById(rtuRegState.pickedCustId);
  const sites = c ? ((typeof pcGetSites === 'function') ? pcGetSites(c) : (c.sites||[])) : [];
  const picked = sites.filter(s => rtuRegState.selectedSiteIds.includes(s.id));
  const summaryHtml = picked.map(s => `<span class="badge badge-blue" style="font-size:10px;margin:2px;">${s.siteName} · KEPCO ${s.kepco||'-'}</span>`).join('');
  const f = rtuRegState.form || {};

  $('cm-sub').innerHTML = `<span style="color:var(--blue);font-weight:600;">2/2</span> · 선택한 사업장에 공통으로 적용될 RTU 정보를 입력하세요. RTU 번호·시리얼은 사업장 KEPCO 기반으로 각각 자동 채번됩니다.`;
  $('cm-body').innerHTML = `
    <!-- 선택 요약 -->
    <div style="background:#f0f7ff;border:1px solid var(--blue-border);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;">
      <div style="color:var(--navy);font-weight:600;margin-bottom:4px;">${c?.name||'-'} · ${picked.length}개 사업장 선택</div>
      <div>${summaryHtml || '<span style="color:var(--text-hint);">선택된 사업장 없음</span>'}</div>
    </div>

    <!-- RTU 스펙 · 통신 -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:12px;">
      <div style="font-size:12px;color:var(--text-sub);font-weight:700;margin-bottom:10px;">RTU 스펙 · 통신 연결</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">모델명</label>
          <input id="rtu-r-model" type="text" value="${(f.model||'').replace(/"/g,'&quot;')}" placeholder="예: XEMS-RTU-2000" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">제조사</label>
          <input id="rtu-r-mfr" type="text" value="${(f.mfr||'').replace(/"/g,'&quot;')}" placeholder="예: Xems Korea" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">설치일</label>
          <input id="rtu-r-installed" type="date" value="${f.installed || todayStr()}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">최근 점검일</label>
          <input id="rtu-r-inspected" type="date" value="${f.inspected || todayStr()}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">장비 IP 주소</label>
          <input id="rtu-r-ip" type="text" value="${(f.ip||'').replace(/"/g,'&quot;')}" placeholder="예: 10.20.30.40" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">인터넷 연결 방식</label>
          <select id="rtu-r-conn" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;background:#fff;">
            <option value="유선 이더넷(LAN)" ${f.conn==='유선 이더넷(LAN)'?'selected':''}>유선 이더넷(LAN)</option>
            <option value="무선 LTE" ${f.conn==='무선 LTE'?'selected':''}>무선 LTE</option>
          </select>
        </div>
        <div>
          <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">OpenADR TCP 포트</label>
          <input id="rtu-r-port" type="number" value="${f.port || 8443}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">현장 콘솔 포트</label>
          <input id="rtu-r-console" type="text" value="${(f.console||'MicroUSB').replace(/"/g,'&quot;')}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">VEN 인증서 ID <span style="font-weight:400;color:var(--text-hint);">(KEPCO 뒤 4자리 자동 접미)</span></label>
          <input id="rtu-r-cert-id" type="text" value="${(f.certBase||'').replace(/"/g,'&quot;')}" placeholder="예: VEN-CERT" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">VEN 인증서 만료일</label>
          <input id="rtu-r-cert-exp" type="date" value="${f.certExp||''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
        </div>
      </div>
    </div>

    <!-- 하위 연결 설비 -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:14px 16px;">
      <div style="font-size:12px;color:var(--text-sub);font-weight:700;margin-bottom:10px;">하위 연결 설비</div>
      <div>
        <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">연결된 전력량계</label>
        <input id="rtu-r-meter-name" type="text" value="${(f.meterName||'').replace(/"/g,'&quot;')}" placeholder="예: 본관 메인 계량기" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
      </div>
      <div style="margin-top:10px;">
        <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">하위 연동 기기 <span style="font-weight:400;color:var(--text-hint);">(한 줄에 하나: "유형 · 모델명")</span></label>
        <textarea id="rtu-r-downstream" rows="3" placeholder="예)&#10;인버터 · KSTAR KSG1-250K&#10;접속함 · DY-5010" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box;font-family:monospace;resize:vertical;">${(f.downstream||'').replace(/"/g,'&quot;')}</textarea>
      </div>
    </div>
  `;
  $('cm-footer').innerHTML = `
    <button class="btn btn-secondary" onclick="rtuRegBackToStep1()">← 이전</button>
    <button class="btn btn-primary" onclick="rtuSubmitRegister()">저장</button>
  `;
}

/* Step 1 → Step 2 진행 시 검증 및 상태 저장 */
function rtuRegGoStep2(){
  if(!rtuRegState.pickedCustId){ alert('사업자를 먼저 선택하세요.'); return; }
  const checked = [...document.querySelectorAll('.rtu-r-site-cb:checked')].map(el => el.value);
  if(!checked.length){ alert('사업장을 최소 1개 이상 선택하세요.'); return; }
  rtuRegState.selectedSiteIds = checked;
  rtuRegState.step = 2;
  rtuRegRender();
}

/* Step 2 → Step 1 되돌아가면서 현재 폼 값 임시 보존 */
function rtuRegBackToStep1(){
  rtuRegState.form = {
    model:    $('rtu-r-model')?.value || '',
    mfr:      $('rtu-r-mfr')?.value || '',
    installed:$('rtu-r-installed')?.value || '',
    inspected:$('rtu-r-inspected')?.value || '',
    ip:       $('rtu-r-ip')?.value || '',
    conn:     $('rtu-r-conn')?.value || '유선 이더넷(LAN)',
    port:     parseInt($('rtu-r-port')?.value, 10) || 8443,
    console:  $('rtu-r-console')?.value || 'MicroUSB',
    certBase: $('rtu-r-cert-id')?.value || '',
    certExp:  $('rtu-r-cert-exp')?.value || '',
    meterName:$('rtu-r-meter-name')?.value || '',
    downstream: $('rtu-r-downstream')?.value || '',
  };
  rtuRegState.step = 1;
  rtuRegRender();
}

/* 사업자 검색 결과 카드형 리스트 렌더 (계약완료 참여고객만) */
function rtuRegisterRenderCustList(){
  const box = $('rtu-r-cust-list'); if(!box) return;
  const q = ($('rtu-r-cust-q')?.value||'').trim().toLowerCase();
  const list = store.customers.filter(c => c.status==='계약완료' && (
    !q ||
    (c.name||'').toLowerCase().includes(q) ||
    (c.bizno||'').toLowerCase().includes(q) ||
    (c.ceo||'').toLowerCase().includes(q)
  ));
  if(!list.length){
    box.innerHTML = `<div style="padding:14px;color:var(--text-hint);font-size:12px;text-align:center;">일치하는 사업자가 없습니다.</div>`;
    return;
  }
  box.innerHTML = list.map(c => {
    const sites = c.sites || [{id:c.id+'-S1'}];
    const active = rtuRegState.pickedCustId === c.id;
    const nSites = sites.length;
    const nRegistered = sites.filter(s=>!!s.rtu).length;
    return `<div onclick="rtuRegisterPickCustomer('${c.id}')" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;background:${active?'#eff6ff':'#fff'};">
      <div>
        <div style="font-weight:600;color:var(--navy);font-size:13px;">${c.name} <span style="color:var(--text-hint);font-weight:400;font-size:11px;">(${c.bizno||c.id})</span></div>
        <div style="font-size:11px;color:var(--text-sub);margin-top:2px;">대표자 ${c.ceo||'-'} · 사업장 ${nSites}개 (등록됨 ${nRegistered}개)</div>
      </div>
      <div style="font-size:11px;color:${active?'var(--blue)':'var(--text-hint)'};font-weight:${active?'600':'400'};">${active?'선택됨':'선택'}</div>
    </div>`;
  }).join('');
}

/* 사업자 하나를 선택 → 사업장 체크박스 리스트 렌더. keepChecked=true 시 rtuRegState.selectedSiteIds 복원 */
function rtuRegisterPickCustomer(cid, keepChecked){
  if(rtuRegState.pickedCustId !== cid){
    rtuRegState.pickedCustId = cid;
    if(!keepChecked) rtuRegState.selectedSiteIds = [];
  }
  rtuRegisterRenderCustList();
  const c = custById(cid);
  const sites = c ? ((typeof pcGetSites === 'function') ? pcGetSites(c) : (c.sites||[{id:c.id+'-S1', siteName:c.name+' 본사', kepco:c.kepco}])) : [];
  const box = $('rtu-r-site-list'); if(!box) return;
  if(!sites.length){
    box.innerHTML = `<div style="padding:14px;color:var(--text-hint);font-size:12px;text-align:center;">사업장 정보가 없습니다.</div>`;
    return;
  }
  const preselected = new Set(rtuRegState.selectedSiteIds || []);
  box.innerHTML = sites.map(s => {
    const already = !!s.rtu;
    const checked = !already && preselected.has(s.id);
    return `<label style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border);${already?'opacity:0.55;cursor:not-allowed;':'cursor:pointer;'}background:${already?'var(--grey50)':'#fff'};">
      <div style="display:flex;align-items:center;gap:10px;">
        <input type="checkbox" class="rtu-r-site-cb" value="${s.id}" ${already?'disabled':''} ${checked?'checked':''} style="width:16px;height:16px;cursor:${already?'not-allowed':'pointer'};accent-color:var(--blue);">
        <div>
          <div style="font-weight:600;color:var(--navy);font-size:13px;">${s.siteName}${already?` <span class="badge badge-gray" style="font-size:9px;margin-left:6px;">이미 등록됨</span>`:''}</div>
          <div style="font-size:11px;color:var(--text-sub);margin-top:2px;">KEPCO ${s.kepco||'-'} · ${s.addr||'-'} · 계약전력 ${s.power?s.power.toLocaleString()+' kW':'-'}</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--text-hint);font-family:monospace;">${already?('RTU '+s.rtu.id):'RTU '+(s.kepco?'RTU-'+s.kepco+' (자동)':'—')}</div>
    </label>`;
  }).join('');
}

/* 등록 확정 — 체크된 사업장 각각에 RTU 저장 (사업장 KEPCO 기반 채번), 감사로그, 리렌더 */
function rtuSubmitRegister(){
  const cid = rtuRegState.pickedCustId;
  if(!cid){ alert('사업자를 먼저 선택하세요.'); return; }
  const c = custById(cid);
  const sites = (typeof pcGetSites === 'function') ? pcGetSites(c) : (c.sites||[]);
  // Step 2에선 체크박스가 DOM에 없으므로 rtuRegState.selectedSiteIds 사용. Step 1에서 넘어올 때 이미 세팅됨.
  const checked = (rtuRegState.selectedSiteIds && rtuRegState.selectedSiteIds.length)
    ? rtuRegState.selectedSiteIds.slice()
    : [...document.querySelectorAll('.rtu-r-site-cb:checked')].map(el => el.value);
  if(!checked.length){ alert('사업장을 최소 1개 이상 선택하세요.'); return; }

  const commonModel   = $('rtu-r-model')?.value?.trim() || '';
  const commonMfr     = $('rtu-r-mfr')?.value?.trim() || '';
  const commonIp      = $('rtu-r-ip')?.value?.trim() || '';
  const commonConn    = $('rtu-r-conn')?.value || '유선 이더넷(LAN)';
  const commonPort    = parseInt($('rtu-r-port')?.value, 10) || 8443;
  const commonConsole = $('rtu-r-console')?.value?.trim() || 'MicroUSB';
  const commonCertBase = $('rtu-r-cert-id')?.value?.trim() || 'VEN-CERT';
  const commonCertExp = $('rtu-r-cert-exp')?.value || '';
  const commonInstalled = $('rtu-r-installed')?.value || todayStr();
  const commonInspected = $('rtu-r-inspected')?.value || todayStr();
  const commonMeterName = $('rtu-r-meter-name')?.value?.trim() || '';
  const downstreamRaw = $('rtu-r-downstream')?.value || '';
  const commonDownstream = downstreamRaw.split('\n').map(line=>{
    const [type, model] = line.split('·').map(x=>x.trim()).filter(Boolean);
    if(!type) return null;
    return {type, model: model || ''};
  }).filter(Boolean);

  const registered = [];
  checked.forEach(sid => {
    const s = sites.find(x => x.id === sid);
    if(!s || s.rtu) return;
    const kepco = s.kepco || c.kepco || '';
    const rtuId = 'RTU-' + kepco;
    const serial = 'SN' + kepco;
    s.rtu = {
      id: rtuId, serial,
      model: commonModel, manufacturer: commonMfr, firmware: '-',
      ip: commonIp, port: commonPort,
      connType: commonConn, consolePort: commonConsole,
      hzCommStatus: 'UNKNOWN', kpxCommStatus: 'UNKNOWN',
      lastHzSyncMinutesAgo: 999, lastKpxSyncMinutesAgo: 999,
      venCertId: commonCertBase + '-' + (kepco.slice(-4) || '0000'),
      venCertExpires: commonCertExp,
      installedAt: commonInstalled, lastInspectedAt: commonInspected,
      meterName: commonMeterName, meterKepco: kepco,
      downstream: commonDownstream.slice(),
      registeredAt: nowStr(),
    };
    if(s._pendingRtu) delete s._pendingRtu;
    registered.push({sid, siteName: s.siteName, rtuId});
    logAudit?.({
      objectType:'rtu', objectId: rtuId, action:'rtu_registered',
      title:`RTU 신규 등록 — ${c.name} · ${s.siteName}`,
      desc:`${rtuId} · ${commonModel||'-'} · KEPCO ${kepco}`,
      actor:'운영자', tone:'success'
    });
  });

  if(!registered.length){ alert('등록된 사업장이 없습니다.'); return; }

  closeModal('commonModal');
  // 검색어를 사업자명으로 세팅해 등록 결과를 리스트에서 즉시 확인
  if($('rtu-q')){ $('rtu-q').value = c.name; rtuState.filter.q = c.name; }
  rtuRender();
  if(typeof showToast === 'function') showToast(`RTU 등록 완료 — ${c.name} · ${registered.length}개 사업장`);
}

function rtuOpenEditRtu(rtuId){
  const rows = rtuCollectRows();
  const r = rows.find(x => x.rtu.id === rtuId);
  if(!r) return;
  const rtu = r.rtu;
  $('cm-title').textContent = 'RTU 정보 수정';
  $('cm-sub').textContent = `${r.custName} - ${r.siteName}`;
  $('cm-body').innerHTML = `<div class="info-box" style="margin-bottom:12px;">
    RTU 스펙·통신 설정을 수정합니다. 변경 시 감사로그가 기록됩니다.
    <br><span style="font-size:10px;color:var(--text-hint);">※ 펌웨어 버전은 제조사가 OTA로 적용하는 값이라 자동 반영됩니다. 수동 수정은 현장 점검 직후에만 권장.</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">RTU 번호 <span style="color:var(--red);">*</span></label>
      <input id="rtu-e-id" type="text" value="${(rtu.id||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">시리얼 번호</label>
      <input id="rtu-e-serial" type="text" value="${(rtu.serial||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">모델명</label>
      <input id="rtu-e-model" type="text" value="${(rtu.model||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">제조사</label>
      <input id="rtu-e-mfr" type="text" value="${(rtu.manufacturer||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">설치일</label>
      <input id="rtu-e-installed" type="date" value="${rtu.installedAt||''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">최근 점검일</label>
      <input id="rtu-e-inspected" type="date" value="${rtu.lastInspectedAt||''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">장비 IP 주소</label>
      <input id="rtu-e-ip" type="text" value="${(rtu.ip||'').replace(/"/g,'&quot;')}" placeholder="예: 10.20.30.40" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">인터넷 연결 방식</label>
      <select id="rtu-e-conn" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;background:#fff;">
        <option value="유선 이더넷(LAN)" ${rtu.connType==='유선 이더넷(LAN)'?'selected':''}>유선 이더넷(LAN)</option>
        <option value="무선 LTE" ${rtu.connType==='무선 LTE'?'selected':''}>무선 LTE</option>
      </select>
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">OpenADR TCP 포트</label>
      <input id="rtu-e-port" type="number" value="${rtu.port||''}" placeholder="예: 8443" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">현장 콘솔 포트</label>
      <input id="rtu-e-console" type="text" value="${(rtu.consolePort||'').replace(/"/g,'&quot;')}" placeholder="예: MicroUSB" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">VEN 인증서 ID</label>
      <input id="rtu-e-cert-id" type="text" value="${(rtu.venCertId||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">VEN 인증서 만료일</label>
      <input id="rtu-e-cert-exp" type="date" value="${rtu.venCertExpires||''}" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
    </div>
  </div>
  <!-- [v0.7] 하위 연결 설비 편집 -->
  <div style="border-top:1px solid var(--border);margin-top:16px;padding-top:14px;">
    <div style="font-size:12px;color:var(--text-sub);font-weight:700;margin-bottom:10px;">하위 연결 설비</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">연결된 전력량계</label>
        <input id="rtu-e-meter-name" type="text" value="${(rtu.meterName||'').replace(/"/g,'&quot;')}" placeholder="예: 본관 메인 계량기" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;box-sizing:border-box;">
      </div>
      <div>
        <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">계량기 한전 고객번호</label>
        <input id="rtu-e-meter-kepco" type="text" value="${(rtu.meterKepco||'').replace(/"/g,'&quot;')}" placeholder="예: 10011001" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;box-sizing:border-box;">
      </div>
    </div>
    <div style="margin-top:10px;">
      <label style="display:block;font-size:11px;color:var(--text-sub);font-weight:600;margin-bottom:4px;">하위 연동 기기 <span style="font-weight:400;color:var(--text-hint);">(한 줄에 하나: "유형 · 모델명")</span></label>
      <textarea id="rtu-e-downstream" rows="3" placeholder="예)&#10;인버터 · KSTAR KSG1-250K&#10;접속함 · DY-5010" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box;font-family:monospace;resize:vertical;">${(Array.isArray(rtu.downstream)?rtu.downstream.map(d=>`${d.type} · ${d.model}`).join('\n'):'').replace(/"/g,'&quot;')}</textarea>
    </div>
  </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="rtuSubmitEditRtu('${rtuId}')">저장</button>`;
  openModal('commonModal');
}

function rtuSubmitEditRtu(rtuId){
  const rows = rtuCollectRows();
  const r = rows.find(x => x.rtu.id === rtuId);
  if(!r) return;
  const rtu = r.rtu;

  const newId        = $('rtu-e-id')?.value?.trim();
  const newSerial    = $('rtu-e-serial')?.value?.trim();
  const newModel     = $('rtu-e-model')?.value?.trim();
  const newMfr       = $('rtu-e-mfr')?.value?.trim();
  const newInstalled = $('rtu-e-installed')?.value;
  const newInspected = $('rtu-e-inspected')?.value;
  const newIp        = $('rtu-e-ip')?.value?.trim();
  const newConn      = $('rtu-e-conn')?.value;
  const newPort      = parseInt($('rtu-e-port')?.value, 10);
  const newConsole   = $('rtu-e-console')?.value?.trim();
  const newCertId    = $('rtu-e-cert-id')?.value?.trim();
  const newCertExp   = $('rtu-e-cert-exp')?.value;
  // 하위 연결 설비
  const newMeterName  = $('rtu-e-meter-name')?.value?.trim();
  const newMeterKepco = $('rtu-e-meter-kepco')?.value?.trim();
  const newDownstreamRaw = $('rtu-e-downstream')?.value || '';
  const newDownstream = newDownstreamRaw.split('\n').map(line=>{
    const [type, model] = line.split('·').map(s=>s.trim()).filter(Boolean);
    if(!type) return null;
    return {type, model: model || ''};
  }).filter(Boolean);

  if(!newId){ alert('RTU 번호는 필수 입력입니다.'); return; }

  const changes = [];
  const apply = (key, oldVal, newVal, label) => {
    const a = (oldVal == null ? '' : String(oldVal));
    const b = (newVal == null ? '' : String(newVal));
    if(a !== b){ changes.push(`${label}: ${a||'(미입력)'} → ${b||'(미입력)'}`); rtu[key] = newVal; }
  };
  apply('id', rtu.id, newId, 'RTU 번호');
  apply('serial', rtu.serial, newSerial, '시리얼');
  apply('model', rtu.model, newModel, '모델명');
  apply('manufacturer', rtu.manufacturer, newMfr, '제조사');
  apply('installedAt', rtu.installedAt, newInstalled, '설치일');
  apply('lastInspectedAt', rtu.lastInspectedAt, newInspected, '최근 점검일');
  apply('ip', rtu.ip, newIp, 'IP');
  apply('connType', rtu.connType, newConn, '인터넷 연결 방식');
  if(!isNaN(newPort)) apply('port', rtu.port, newPort, 'TCP 포트');
  apply('consolePort', rtu.consolePort, newConsole, '현장 콘솔 포트');
  apply('venCertId', rtu.venCertId, newCertId, 'VEN 인증서 ID');
  apply('venCertExpires', rtu.venCertExpires, newCertExp, 'VEN 인증서 만료일');
  apply('meterName', rtu.meterName, newMeterName, '연결 계량기');
  apply('meterKepco', rtu.meterKepco, newMeterKepco, '계량기 한전 고객번호');
  // 하위 연동 기기 리스트는 문자열 diff로 감지
  const oldDsStr = Array.isArray(rtu.downstream) ? rtu.downstream.map(d=>`${d.type} · ${d.model||''}`).join(' | ') : '';
  const newDsStr = newDownstream.map(d=>`${d.type} · ${d.model||''}`).join(' | ');
  if(oldDsStr !== newDsStr){
    changes.push(`하위 연동 기기: ${oldDsStr||'(없음)'} → ${newDsStr||'(없음)'}`);
    rtu.downstream = newDownstream;
  }

  logAudit?.({
    objectType:'rtu', objectId: rtuId, action:'rtu_info_updated',
    title:`RTU 정보 수정 — ${r.siteName}`,
    desc: changes.length ? changes.join(' · ') : '변경 사항 없음',
    actor:'운영자', tone:'info'
  });
  closeModal('commonModal');
  if(typeof showToast === 'function') showToast(`RTU 정보 저장 — ${changes.length}건 변경`);
  // RTU id가 변경됐을 수 있으므로 새 id로 재오픈
  rtuOpenDetail(newId || rtuId);
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

/* [Phase 17-T] 펌웨어 업데이트 / VEN 인증서 갱신 요청 함수 제거.
   - 펌웨어: 제조사가 OTA로 관리하는 영역, 운영자 트리거 불필요
   - VEN 인증서: 만료일 표기 + 만료 임박 뱃지로 운영자 인지 가능. 갱신은 운영팀이 외부 별도 절차로 진행 */

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
