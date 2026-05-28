/* ════════════════════════════════════════════════════════════
   BIDDING — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

function bidInit(){ bidRefreshKpis(); bidRender(); }

function bidEligibleEvents(){
  return store.events.reduction.filter(e=>{
    if(!e.bid) return false;  // bid 필드 있는 이벤트만
    return e.dispatch_type==='VOLUNTARY_REDUCTION' || e.dispatch_type==='VOLUNTARY_INCREASE';
  });
}

/* 이벤트 상태를 입찰 관점으로 변환 */
function bidStatusOf(e){
  // 명시적 입찰 상태가 있으면 우선
  if(e.bidStatus) return e.bidStatus;
  // 낙찰됐는데 이벤트로 발령된 경우: 이벤트 진행 상황 반영
  if(e.bid?.awardedVolume > 0){
    if(e.live) return 'ACTIVE';             // 진행 중
    if(e.scheduled) return 'BID_WON';       // 낙찰·발령 대기
    return 'COMPLETED';                     // 완료
  }
  // 낙찰량 0 = 유찰
  if(e.bid?.awardedVolume === 0) return 'BID_REJECTED';
  // 아직 평가 안 됨
  return 'BID_SUBMITTED';
}

function bidRefreshKpis(){
  const now = new Date();
  const sameMonth = (s)=> s && s.substring(0,7)===`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const all = bidEligibleEvents();
  const monthly = all.filter(e=> sameMonth(e.bid?.submittedAt?.substring(0,10)));
  const won = monthly.filter(e=> e.bid?.awardedVolume > 0);
  const pending = all.filter(e=> bidStatusOf(e)==='BID_SUBMITTED');
  const hitRate = monthly.length ? Math.round(won.length/monthly.length*100) : 0;
  const awardedKwSum = monthly.reduce((s,e)=> s + (e.bid?.awardedVolume||0), 0);
  if($('bid-kpi-total'))    $('bid-kpi-total').textContent = monthly.length;
  if($('bid-kpi-hit'))      $('bid-kpi-hit').textContent   = hitRate+'%';
  if($('bid-kpi-awarded'))  $('bid-kpi-awarded').textContent = awardedKwSum.toLocaleString();
  if($('bid-kpi-pending'))  $('bid-kpi-pending').textContent = pending.length;
}

function bidInRange(e, range){
  if(range==='all') return true;
  const days = range==='7d' ? 7 : range==='30d' ? 30 : range==='90d' ? 90 : 30;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-days);
  return new Date(e.date) >= cutoff;
}

function bidRender(){
  const range = $('bid-range')?.value || '30d';
  const tp = $('bid-type')?.value || 'all';
  const st = $('bid-status')?.value || 'all';
  const q  = ($('bid-q')?.value||'').toLowerCase().trim();

  const rows = bidEligibleEvents().filter(e=>{
    if(!bidInRange(e, range)) return false;
    if(tp!=='all' && e.dispatch_type!==tp) return false;
    if(st!=='all' && bidStatusOf(e)!==st) return false;
    if(q){
      const hitId = e.id.toLowerCase().includes(q) || eventDisplayName(e).toLowerCase().includes(q);
      const hitGrp = (e.resources||[]).some(r=>{
        const g = store.groups.find(x=>x.id===r.groupId);
        return (g?.name||'').toLowerCase().includes(q);
      });
      if(!hitId && !hitGrp) return false;
    }
    return true;
  }).sort((a,b)=>(b.bid?.submittedAt||'').localeCompare(a.bid?.submittedAt||''));

  const grpNames = (e)=> (e.resources||[]).map(r=>{
    const g = store.groups.find(x=>x.id===r.groupId);
    return g?.name || '—';
  }).join(', ');

  $('bid-list-box').innerHTML = `
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-top:12px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead style="background:var(--bg);"><tr>
          <th style="padding:10px 12px;text-align:left;width:170px;">운영 이벤트</th>
          <th style="padding:10px 12px;text-align:left;width:90px;">거래일</th>
          <th style="padding:10px 12px;text-align:left;width:110px;">시간대</th>
          <th style="padding:10px 12px;text-align:left;">자원그룹</th>
          <th style="padding:10px 12px;text-align:left;width:130px;">입찰 유형</th>
          <th style="padding:10px 12px;text-align:right;width:100px;">입찰량 (kW)</th>
          <th style="padding:10px 12px;text-align:right;width:100px;">낙찰량 (kW)</th>
          <th style="padding:10px 12px;text-align:center;width:120px;">상태</th>
        </tr></thead>
        <tbody>${rows.map(e=>{
          const tm = BID_TYPE_META[e.dispatch_type] || {label:e.dispatch_type, badge:'badge-gray'};
          const bs = bidStatusOf(e);
          const sm = BID_STATUS_META[bs] || {label:bs, badge:'badge-gray'};
          const awardedCell = e.bid?.awardedVolume==null ? '—'
                              : e.bid.awardedVolume===0 ? `<span style="color:var(--red);">0</span>`
                              : e.bid.awardedVolume.toLocaleString();
          return `
          <tr style="border-top:1px solid var(--border);cursor:pointer;" onclick="bidOpenDetail('${e.id}')" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
            <td style="padding:10px 12px;color:var(--blue);font-weight:600;">${eventDisplayName(e)}<div style="font-size:10px;color:var(--text-hint);font-variant-numeric:tabular-nums;margin-top:2px;">${e.id}</div></td>
            <td style="padding:10px 12px;color:var(--text-sub);font-variant-numeric:tabular-nums;">${e.date}</td>
            <td style="padding:10px 12px;color:var(--text-sub);font-variant-numeric:tabular-nums;">${e.timeRange}</td>
            <td style="padding:10px 12px;font-weight:500;">${grpNames(e)}</td>
            <td style="padding:10px 12px;"><span class="badge ${tm.badge}">${tm.label}</span></td>
            <td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums;">${(e.bid?.bidVolume||0).toLocaleString()}</td>
            <td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${awardedCell}</td>
            <td style="padding:10px 12px;text-align:center;"><span class="badge ${sm.badge}">${sm.label}</span></td>
          </tr>`;}).join('')}
        </tbody>
      </table>
      ${rows.length===0 ? `<div style="padding:30px;text-align:center;color:var(--text-hint);">조회 조건에 해당하는 입찰이 없습니다.</div>`:''}
    </div>`;
}

function bidOpenDetail(eid){
  const e = store.events.reduction.find(x=>x.id===eid);
  if(!e || !e.bid) return;
  const tm = BID_TYPE_META[e.dispatch_type]||{label:e.dispatch_type};
  const bs = bidStatusOf(e);
  const sm = BID_STATUS_META[bs]||{label:bs};
  const grpNames = (e.resources||[]).map(r=>{
    const g = store.groups.find(x=>x.id===r.groupId);
    return g?.name || '—';
  }).join(', ');
  const awarded = e.bid.awardedVolume;
  const body = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;font-size:12px;">
      <div><span style="color:var(--text-hint);">운영명</span><br><b style="color:var(--blue);">${eventDisplayName(e)}</b><div style="margin-top:4px;color:var(--text-hint);font-variant-numeric:tabular-nums;">${e.id}</div></div>
      <div><span style="color:var(--text-hint);">입찰 유형</span><br><b>${tm.label}</b></div>
      <div><span style="color:var(--text-hint);">거래일 · 시간대</span><br><b style="font-variant-numeric:tabular-nums;">${e.date} · ${e.timeRange}</b></div>
      <div><span style="color:var(--text-hint);">입찰 상태</span><br><span class="badge ${sm.badge}">${sm.label}</span></div>
      <div style="grid-column:1/-1;"><span style="color:var(--text-hint);">자원그룹</span><br><b>${grpNames}</b></div>
      <div><span style="color:var(--text-hint);">입찰량</span><br><b style="font-variant-numeric:tabular-nums;">${(e.bid.bidVolume||0).toLocaleString()} kW</b></div>
      <div><span style="color:var(--text-hint);">낙찰량</span><br><b style="font-variant-numeric:tabular-nums;">${awarded==null ? '— (평가 중)' : awarded.toLocaleString()+' kW'}</b></div>
      <div><span style="color:var(--text-hint);">접수 시각</span><br><b style="font-variant-numeric:tabular-nums;">${e.bid.submittedAt||'—'}</b></div>
      <div><span style="color:var(--text-hint);">결정 시각</span><br><b style="font-variant-numeric:tabular-nums;">${e.bid.awardedAt||'—'}</b></div>
      ${e.bid.rejectionReason ? `<div style="grid-column:1/-1;"><span style="color:var(--text-hint);">유찰 사유</span><br><b style="color:var(--red);">${e.bid.rejectionReason}</b></div>`:''}
      ${bs==='ACTIVE' ? `<div style="grid-column:1/-1;padding:8px 12px;background:var(--blue-light);border-radius:var(--radius);">실시간 이행 중 — <button class="link" onclick="closeCommonModal();navigate('monitoring');">감축 모니터링 →</button></div>`:''}
      ${bs==='COMPLETED' ? `<div style="grid-column:1/-1;padding:8px 12px;background:#f8faff;border-radius:var(--radius);">이행 완료 — <button class="link" onclick="closeCommonModal();navigate('report');setTimeout(()=>rpOpenEvent('${e.id}'),150);">운영리포트 →</button></div>`:''}
    </div>`;
  openCommonModal(`입찰 상세 · ${eventDisplayName(e)}`, '입찰 ~ 이벤트 실행까지 라이프사이클', body, []);
}

function bidOpenCreate(){
  const groups = store.groups
    .filter(g=>g.status==='active')
    .map(g=>`<option value="${g.id}">${g.name} · ${g.type}</option>`)
    .join('');
  $('cm-title').textContent = '신규 입찰 등록';
  $('cm-sub').textContent = '자발적감축 또는 플러스DR 계획 입찰을 접수 상태로 등록합니다.';
  $('cm-body').innerHTML = `
    <div class="form-row">
      <label class="form-label">입찰 유형</label>
      <select class="form-select" id="bid-create-type">
        <option value="VOLUNTARY_REDUCTION">자발적감축</option>
        <option value="VOLUNTARY_INCREASE">플러스DR (계획)</option>
      </select>
    </div>
    <div class="form-row">
      <label class="form-label">거래일</label>
      <input class="form-input" id="bid-create-date" type="date" value="${todayStr()}">
    </div>
    <div class="form-row">
      <label class="form-label">시간대</label>
      <input class="form-input" id="bid-create-time" value="14:00~15:00" placeholder="14:00~15:00">
    </div>
    <div class="form-row">
      <label class="form-label">자원그룹</label>
      <select class="form-select" id="bid-create-group">${groups}</select>
    </div>
    <div class="form-row">
      <label class="form-label">입찰량 (kW)</label>
      <input class="form-input" id="bid-create-volume" type="number" min="10" step="10" value="300">
    </div>
    <div class="form-row">
      <label class="form-label">입찰 프로그램</label>
      <select class="form-select" id="bid-create-program">
        <option value="ECONOMIC">ECONOMIC</option>
        <option value="PLUS_PLANNED">PLUS_PLANNED</option>
      </select>
    </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="bidSubmitCreate()">등록</button>`;
  openModal('commonModal');
}
function bidSubmitCreate(){
  const dispatchType = $('bid-create-type')?.value || 'VOLUNTARY_REDUCTION';
  const date = $('bid-create-date')?.value || todayStr();
  const timeRange = ($('bid-create-time')?.value || '').trim();
  const groupId = parseInt($('bid-create-group')?.value, 10);
  const bidVolume = parseInt($('bid-create-volume')?.value, 10);
  const bidProgram = $('bid-create-program')?.value || 'ECONOMIC';
  const g = groupById(groupId);
  if(!date || !timeRange || !g || !bidVolume){ showToast('필수 항목을 모두 입력하세요.'); return; }
  const prefix = dispatchType==='VOLUNTARY_INCREASE' ? 'EVP' : 'EVV';
  const ymd = date.replaceAll('-','');
  const sameDayCount = store.events.reduction.filter(e=>e.id.startsWith(prefix+ymd)).length + 1;
  const id = `${prefix}${ymd}-${String(sameDayCount).padStart(2,'0')}`;
  const labelType = dispatchType==='VOLUNTARY_INCREASE' ? '플러스DR (계획)' : '자발적감축';
  store.events.reduction.unshift({
    id,
    dispatch_type: dispatchType,
    category:'operation',
    date,
    timeRange,
    label:`${date} ${timeRange} · ${labelType} (접수)`,
    source:'KPX',
    live:false,
    scheduled:true,
    bid:{
      submittedAt: nowStr(),
      submittedBy:'현진영',
      bidVolume,
      bidProgram,
      awardedAt:null,
      awardedVolume:null,
      rejectionReason:''
    },
    bidStatus:'BID_SUBMITTED',
    resources:[{groupId:g.id, ordered:bidVolume, actual:null, status:'SCHEDULED'}]
  });
  closeModal('commonModal');
  bidInit();
  refreshSidebarBadges();
  if(window.logAudit) window.logAudit('입찰 등록', id);
  showToast(`${id} 입찰이 접수 상태로 등록되었습니다.`);
  setTimeout(()=>bidOpenDetail(id), 120);
}


/* ─────────────────────────────────────────────
   SYS · 시드 데이터 — 시스템 관리
───────────────────────────────────────────── */
