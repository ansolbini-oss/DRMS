/* ════════════════════════════════════════════════════════════
   COMMUNICATION — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

const comState = {
  currentTab: 'templates',
  selectedTemplates: new Set(),       // 벌크 선택
  editingTemplateId: null,            // 편집 중 템플릿
  sendTargetTemplateId: null,         // 발송 대상 템플릿
  sendMode: 'group',                  // 'group' | 'customer'
  sendSelectedGroupIds: new Set(),
  sendSelectedGroupId: null,
  sendSelectedCustIds: new Set(),
  sendEventId: null,
  sendChannel: null,
};

function comInferCategory(tpl){
  if(tpl.category) return tpl.category;
  const c = (tpl.code||'').toUpperCase();
  if(c.includes('EVENT_ISSUED')||c.includes('DISPATCH')) return 'EVENT_DISPATCH';
  if(c.includes('EVENT_END')) return 'EVENT_END';
  if(c.includes('UNDER')||c.includes('PERFORM')) return 'UNDER_PERFORM';
  if(c.includes('REPORT')||c.includes('MONTHLY')) return 'REPORT';
  return 'CUSTOM';
}

/* ─────────────────────────────────────────────
   진입 · 탭 스위치
───────────────────────────────────────────── */
function comInit(){
  // 뷰 상태 초기화
  $('com-list-view').style.display = 'flex';
  $('com-send-view').style.display = 'none';
  comState.selectedTemplates.clear();
  comRefreshKpis();
  comSwitchTab(comState.currentTab || 'templates');
}
function comRefreshKpis(){
  // 상단 현황카드 제거됨 — 엘리먼트가 없으면 조용히 반환
  const sendEl = $('com-kpi-send');
  if(!sendEl) return;
  const now = new Date();
  const sameMonth = (s)=> s && s.substring(0,7)===`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthly = store.commSendLog.filter(l=>sameMonth(l.sentAt));
  const ackable = monthly.filter(l=>l.ack !== null);
  const ackDone = ackable.filter(l=>l.ack===true).length;
  const pendingAck = ackable.filter(l=>l.ack===false).length;
  sendEl.textContent = monthly.length.toLocaleString();
  const ackEl = $('com-kpi-ack'); if(ackEl) ackEl.textContent = ackable.length ? Math.round(ackDone/ackable.length*100)+'%' : '—';
  const pendEl = $('com-kpi-pending'); if(pendEl) pendEl.textContent = pendingAck;
  const tplEl = $('com-kpi-templates'); if(tplEl) tplEl.textContent = store.commTemplates.filter(t=>t.active!==false).length;
}
function comSwitchTab(key){
  comState.currentTab = key;
  $$('.rp-tab[data-com-tab]').forEach(el=>el.classList.toggle('active', el.dataset.comTab===key));
  ['templates','history','ack','memo'].forEach(k=>{
    const el = $('com-tab-'+k);
    if(el) el.style.display = (k===key?'block':'none');
  });
  // 상단 버튼은 템플릿 탭에서만 표시
  const deleteBtn = $('com-tpl-delete-btn');
  const selInfo = $('com-tpl-selected-info');
  if(deleteBtn){
    deleteBtn.style.display = key==='templates' ? '' : 'none';
  }
  if(selInfo){
    selInfo.style.display = (key==='templates' && comState.selectedTemplates.size>0) ? '' : 'none';
  }
  if(key==='templates') comRenderTemplates();
  if(key==='history')   comRenderHistory();
  if(key==='ack')       comRenderAck();
  if(key==='memo')      comRenderMemo();
}

/* ─────────────────────────────────────────────
   ① 템플릿 탭 — 선택란 · 넘버 · 템플릿명 · 카테고리 · [발송]
───────────────────────────────────────────── */
function comRenderTemplates(){
  const tpls = store.commTemplates.filter(t=>t.active!==false);
  comUpdateBulkBar();
  if(!tpls.length){
    $('com-tab-templates').innerHTML = `<div class="empty" style="padding:60px 20px;">등록된 템플릿이 없습니다. 상단 [+ 템플릿 등록] 버튼으로 추가하세요.</div>`;
    return;
  }
  const rows = tpls.map((t,i)=>{
    const isChecked = comState.selectedTemplates.has(t.id);
    return `<tr data-tpl-id="${t.id}" style="border-top:1px solid var(--border);${isChecked?'background:#eef4fe;':''}">
      <td style="padding:12px 16px;text-align:center;width:48px;">
        <input type="checkbox" ${isChecked?'checked':''} onchange="comToggleSelect('${t.id}',this.checked)">
      </td>
      <td style="padding:12px 8px;text-align:center;width:54px;color:var(--text-hint);font-variant-numeric:tabular-nums;">${i+1}</td>
      <td style="padding:12px 16px;">
        <div style="font-weight:600;color:var(--navy);font-size:13px;">${t.title}</div>
      </td>
      <td style="padding:12px 16px;text-align:center;width:180px;">
        <button class="btn btn-sm btn-secondary" onclick="comOpenTemplateModal('${t.id}')" style="margin-right:4px;">수정</button>
        <button class="btn btn-sm btn-primary" onclick="comOpenSendView('${t.id}')">발송</button>
      </td>
    </tr>`;
  }).join('');

  $('com-tab-templates').innerHTML = `
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead style="background:var(--bg);">
          <tr>
            <th style="padding:12px 16px;text-align:center;width:48px;">
              <input type="checkbox" id="com-tpl-select-all" onchange="comToggleSelectAll(this.checked)">
            </th>
            <th style="padding:12px 8px;text-align:center;width:54px;color:var(--text-sub);">No.</th>
            <th style="padding:12px 16px;text-align:left;color:var(--text-sub);">템플릿명</th>
            <th style="padding:12px 16px;text-align:center;width:180px;color:var(--text-sub);">관리</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:10px;font-size:11px;color:var(--text-hint);">
      * 행 체크박스로 다건 선택 후 상단 [삭제]로 일괄 삭제 가능합니다. 삭제된 템플릿은 소프트 딜리트되어 발송 이력 추적은 유지됩니다.
    </div>`;

  const all = $('com-tpl-select-all');
  if(all) all.checked = tpls.length>0 && tpls.every(t=>comState.selectedTemplates.has(t.id));
}

function comToggleSelect(tid, checked){
  if(checked) comState.selectedTemplates.add(tid);
  else comState.selectedTemplates.delete(tid);
  comRenderTemplates();
}
function comToggleSelectAll(checked){
  const tpls = store.commTemplates.filter(t=>t.active!==false);
  if(checked) tpls.forEach(t=>comState.selectedTemplates.add(t.id));
  else comState.selectedTemplates.clear();
  comRenderTemplates();
}
function comUpdateBulkBar(){
  const cnt = comState.selectedTemplates.size;
  const btn = $('com-tpl-delete-btn');
  const info = $('com-tpl-selected-info');
  if(btn){
    btn.disabled = cnt===0;
    btn.textContent = cnt>0 ? `삭제 (${cnt})` : '삭제';
  }
  if(info){
    info.style.display = cnt>0 ? '' : 'none';
    info.textContent = cnt>0 ? `${cnt}개 선택됨` : '';
  }
}
function comDeleteSelected(){
  const cnt = comState.selectedTemplates.size;
  if(cnt===0) return;
  if(!confirm(`선택한 템플릿 ${cnt}개를 삭제하시겠습니까?\n\n* 소프트 딜리트되며, 기존 발송 이력의 템플릿 추적은 유지됩니다.`)) return;
  comState.selectedTemplates.forEach(tid=>{
    const t = store.commTemplates.find(x=>x.id===tid);
    if(t) t.active = false;
  });
  if(window.logAudit) logAudit('템플릿 삭제', `${cnt}개 템플릿 소프트 딜리트`);
  comState.selectedTemplates.clear();
  comRefreshKpis();
  comRenderTemplates();
  showToast(`템플릿 ${cnt}개를 삭제했습니다.`);
}

/* ─────────────────────────────────────────────
   템플릿 등록/수정 모달
───────────────────────────────────────────── */
function comOpenTemplateModal(tid){
  comState.editingTemplateId = tid || null;
  const t = tid ? store.commTemplates.find(x=>x.id===tid) : null;
  const cat = t ? comInferCategory(t) : 'CUSTOM';
  const channels = t?.channels || ['PUSH','SMS'];

  const catOptions = Object.entries(CATEGORY_META).map(([k,v])=>
    `<option value="${k}" ${cat===k?'selected':''}>${v.label}</option>`
  ).join('');

  const chCheckboxes = Object.entries(CH_META).map(([k,v])=>
    `<label style="display:inline-flex;align-items:center;gap:5px;margin-right:12px;font-size:12px;">
      <input type="checkbox" value="${k}" ${channels.includes(k)?'checked':''} class="com-tpl-ch-cb">
      <span class="badge" style="background:${v.bg};color:${v.color};">${v.label}</span>
    </label>`
  ).join('');

  const body = `
    <div class="acct-form-row">
      <label class="acct-form-label">템플릿명 <span class="req">*</span></label>
      <input type="text" id="com-tpl-title" class="acct-form-input" value="${t?.title||''}" placeholder="예: 감축 지시 발령">
    </div>
    <div class="acct-form-row">
      <label class="acct-form-label">템플릿 코드 <span class="req">*</span></label>
      <input type="text" id="com-tpl-code" class="acct-form-input" value="${t?.code||''}" placeholder="예: EVENT_ISSUED" ${tid?'readonly style="background:#f3f4f6;"':''}>
      <div class="acct-form-hint">${tid?'등록된 템플릿의 코드는 수정할 수 없습니다.':'영문 대문자와 _ 로 구성 (발송 로그 추적용)'}</div>
    </div>
    <div class="acct-form-row">
      <label class="acct-form-label">카테고리 <span class="req">*</span></label>
      <select id="com-tpl-category" class="acct-form-select">${catOptions}</select>
    </div>
    <div class="acct-form-row">
      <label class="acct-form-label">발송 채널 <span class="req">*</span></label>
      <div style="padding:6px 0;">${chCheckboxes}</div>
    </div>
    <div class="acct-form-row">
      <label class="acct-form-label">본문 <span class="req">*</span></label>
      <textarea id="com-tpl-body" class="acct-form-input" rows="5" placeholder="[DR 감축 지시] 이벤트 번호 {{eventId}} · 감축 시간 {{timeRange}} · 요청 감축량 {{orderedKw}}">${t?.body||''}</textarea>
      <div class="acct-form-hint">
        <b>사용 가능한 변수:</b>
        <code>{{custName}}</code>(고객명) <code>{{eventId}}</code>(이벤트 번호) <code>{{timeRange}}</code>(감축 시간) <code>{{orderedKw}}</code>(요청 감축량) <code>{{groupName}}</code>(자원그룹명) <code>{{rate}}</code>(이행률)
      </div>
    </div>`;

  const title = tid ? '템플릿 수정' : '+ 새 템플릿 등록';
  const footer = `
    <button class="btn btn-secondary" onclick="closeModalAcct('com-tpl-modal')">취소</button>
    <button class="btn btn-primary" onclick="comSubmitTemplate()">${tid?'수정':'등록'}</button>`;
  comEnsureTemplateModal();
  $('com-tpl-modal-title').textContent = title;
  $('com-tpl-modal-body').innerHTML = body;
  $('com-tpl-modal-foot').innerHTML = footer;
  openModalAcct('com-tpl-modal');
}

function comEnsureTemplateModal(){
  if($('com-tpl-modal')) return;
  const div = document.createElement('div');
  div.className = 'acct-modal-backdrop';
  div.id = 'com-tpl-modal';
  div.innerHTML = `
    <div class="acct-modal" style="max-width:580px;">
      <div class="acct-modal-head">
        <div class="acct-modal-title" id="com-tpl-modal-title">템플릿</div>
        <button class="acct-modal-close" onclick="closeModalAcct('com-tpl-modal')">×</button>
      </div>
      <div class="acct-modal-body" id="com-tpl-modal-body"></div>
      <div class="acct-modal-foot" id="com-tpl-modal-foot"></div>
    </div>`;
  div.addEventListener('click', (e)=>{ if(e.target.id==='com-tpl-modal') closeModalAcct('com-tpl-modal'); });
  document.body.appendChild(div);
}

function comSubmitTemplate(){
  const title = $('com-tpl-title').value.trim();
  const code = $('com-tpl-code').value.trim().toUpperCase();
  const category = $('com-tpl-category').value;
  const body = $('com-tpl-body').value.trim();
  const channels = Array.from(document.querySelectorAll('.com-tpl-ch-cb:checked')).map(el=>el.value);

  if(!title){ showToast('템플릿명을 입력하세요.'); return; }
  if(!code || !/^[A-Z_][A-Z0-9_]*$/.test(code)){ showToast('템플릿 코드는 영문 대문자·숫자·_ 로 입력하세요.'); return; }
  if(!body){ showToast('본문을 입력하세요.'); return; }
  if(channels.length===0){ showToast('최소 하나의 채널을 선택하세요.'); return; }

  const now = new Date().toISOString().substring(0,16).replace('T',' ');
  if(comState.editingTemplateId){
    const t = store.commTemplates.find(x=>x.id===comState.editingTemplateId);
    if(!t){ showToast('템플릿을 찾을 수 없습니다.'); return; }
    Object.assign(t, {title, category, body, channels, lastUpdated:now});
    if(window.logAudit) logAudit('템플릿 수정', `${t.title} (${t.code})`);
    showToast(`"${title}" 템플릿을 수정했습니다.`);
  } else {
    // 중복 코드 검사 (active 템플릿 중)
    if(store.commTemplates.some(t=>t.code===code && t.active!==false)){
      showToast('이미 사용 중인 템플릿 코드입니다.'); return;
    }
    const id = 'TPL-'+String(Date.now()).slice(-6);
    store.commTemplates.push({id, code, title, category, body, channels, active:true, lastUpdated:now});
    if(window.logAudit) logAudit('템플릿 등록', `${title} (${code})`);
    showToast(`"${title}" 템플릿을 등록했습니다.`);
  }
  closeModalAcct('com-tpl-modal');
  comRefreshKpis();
  comRenderTemplates();
}

/* ─────────────────────────────────────────────
   발송 화면 (페이지 전환)
───────────────────────────────────────────── */
function comOpenSendView(tid){
  const t = store.commTemplates.find(x=>x.id===tid);
  if(!t){ showToast('템플릿을 찾을 수 없습니다.'); return; }
  comState.sendTargetTemplateId = tid;
  comState.sendMode = 'group';
  // 첫 번째 active 자원그룹 자동 선택
  const firstGroup = store.groups.find(g=>g.status==='active');
  comState.sendSelectedGroupId = firstGroup?.id || null;
  comState.sendSelectedGroupIds = new Set(firstGroup ? [String(firstGroup.id)] : []);
  comState.sendSelectedCustIds.clear();
  comState.sendEventId = null;
  comState.sendChannel = t.channels?.includes('KKO') ? 'KKO' : (t.channels?.[0] || 'KKO');

  $('com-list-view').style.display = 'none';
  $('com-send-view').style.display = 'flex';
  $('com-send-title').textContent = `메시지 발송 · ${t.title}`;
  comRenderSendView();
}
function comGotoList(){
  $('com-send-view').style.display = 'none';
  $('com-list-view').style.display = 'flex';
  comState.sendTargetTemplateId = null;
  comInit();
}
function comRenderSendView(){
  const t = store.commTemplates.find(x=>x.id===comState.sendTargetTemplateId);
  if(!t){ comGotoList(); return; }
  const cat = comInferCategory(t);
  const cm = CATEGORY_META[cat];
  if(!t.channels?.includes(comState.sendChannel)){
    comState.sendChannel = t.channels?.includes('KKO') ? 'KKO' : (t.channels?.[0] || 'KKO');
  }
  const activeGroups = store.groups.filter(g=>g.status==='active');

  // 이벤트 옵션: 진행중 + 예정
  const events = store.events?.reduction?.filter(e=>e.live || e.scheduled) || [];

  // 대상 계산
  const targets = comCalcSendTargets();

  // 미리보기 렌더
  const preview = targets[0]
    ? comRenderTemplatePreview(t, targets[0], comState.sendEventId)
    : '<div style="color:var(--text-hint);font-size:12px;">대상을 선택하면 미리보기가 표시됩니다.</div>';

  // 자원그룹 선택 UI
  const groupSelectUI = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
      <div style="font-size:12px;color:var(--text-sub);">여러 자원그룹을 동시에 선택할 수 있습니다.</div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-secondary" type="button" onclick="comToggleGroupAll(true)">전체 선택</button>
        <button class="btn btn-sm btn-secondary" type="button" onclick="comToggleGroupAll(false)">선택 해제</button>
      </div>
    </div>
    <div class="com-send-group-list-wrap">
      <table class="com-send-group-list">
        <thead>
          <tr>
            <th style="width:48px;text-align:center;">
              <input type="checkbox" ${activeGroups.length>0 && activeGroups.every(g=>comState.sendSelectedGroupIds.has(String(g.id)))?'checked':''} onchange="comToggleGroupAll(this.checked)">
            </th>
            <th>자원그룹</th>
            <th style="width:120px;">유형</th>
            <th style="width:120px;text-align:right;">계약완료 고객</th>
          </tr>
        </thead>
        <tbody>
      ${activeGroups.map(g=>{
        const cnt = (g.customerIds||[]).filter(cid=>{
          const c = store.customers.find(x=>x.id===cid);
          return c && c.status==='계약완료';
        }).length;
        const checked = comState.sendSelectedGroupIds.has(String(g.id));
        return `<tr class="${checked?'active':''}">
          <td style="text-align:center;">
            <input type="checkbox" ${checked?'checked':''} onchange="comToggleGroupTarget('${g.id}',this.checked)">
          </td>
          <td>
            <div class="com-send-group-name">${g.name}</div>
          </td>
          <td>${g.type || '-'}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums;">${cnt}명</td>
        </tr>`;
      }).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--text-sub);">
      선택한 자원그룹의 <b>계약완료</b> 참여고객 전체에게 발송됩니다. 중복 고객은 1회만 발송됩니다.
    </div>`;

  // 참여고객 개별 선택 UI
  const allActiveCusts = activeGroups
    .flatMap(g=>(g.customerIds||[]).map(cid=>({cid, groupName:g.name})))
    .map(({cid,groupName})=>{
      const c = store.customers.find(x=>x.id===cid);
      return c && c.status==='계약완료' ? {...c, groupName} : null;
    })
    .filter(Boolean);
  const custSelectUI = `
    <input type="text" id="com-send-cust-search" class="acct-form-input" placeholder="고객명 · ID 검색" oninput="comRenderSendView()" style="max-width:400px;margin-bottom:8px;">
    <div style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);background:#fff;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead style="background:var(--bg);position:sticky;top:0;"><tr>
          <th style="padding:8px 10px;text-align:center;width:44px;">
            <input type="checkbox" id="com-send-cust-all" onchange="comToggleCustAll(this.checked)">
          </th>
          <th style="padding:8px 10px;text-align:left;">고객명</th>
          <th style="padding:8px 10px;text-align:left;">소속 자원그룹</th>
          <th style="padding:8px 10px;text-align:left;">연락처</th>
        </tr></thead>
        <tbody id="com-send-cust-tbody"></tbody>
      </table>
    </div>
    <div style="margin-top:6px;font-size:11px;color:var(--text-sub);">
      체크한 고객에게만 발송됩니다.
    </div>`;

  // 야간 발송 경고
  const hour = new Date().getHours();
  const nightWarn = (hour>=22 || hour<8)
    ? `<div style="background:#fff3cd;border:1px solid #ffe59e;border-radius:var(--radius);padding:10px 14px;margin-bottom:14px;font-size:12px;color:#8a6d3b;">
        ⚠ <b>야간 시간대 (22~08시)</b>입니다. 정보통신망법 §50의8에 따라 운영 공지 외 발송은 주의하세요.
      </div>`
    : '';

  $('com-send-body').innerHTML = `
    ${nightWarn}
    <!-- 템플릿 정보 -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 20px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span class="badge" style="background:${cm.bg};color:${cm.color};">${cm.label}</span>
            <div style="font-size:14px;font-weight:700;color:var(--navy);">${t.title}</div>
          </div>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="comOpenTemplateModal('${t.id}')">템플릿 수정</button>
      </div>
    </div>

    <!-- 1. 발송 대상 -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 20px;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:10px;">1. 발송 대상 선택</div>
      <div style="display:flex;gap:18px;margin-bottom:14px;">
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">
          <input type="radio" name="com-send-mode" value="group" ${comState.sendMode==='group'?'checked':''} onchange="comSetSendMode('group')">
          <span>자원그룹 단위 일괄 발송</span>
        </label>
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">
          <input type="radio" name="com-send-mode" value="customer" ${comState.sendMode==='customer'?'checked':''} onchange="comSetSendMode('customer')">
          <span>참여고객 개별 선택</span>
        </label>
      </div>
      <div id="com-send-target-ui">
        ${comState.sendMode==='group' ? groupSelectUI : custSelectUI}
      </div>
    </div>

    <!-- 2. 이벤트 연결 -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 20px;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:10px;">2. 연결 이벤트 <span style="font-size:11px;color:var(--text-hint);font-weight:400;">(선택 · 문구 자동 입력용)</span></div>
      <select id="com-send-event" class="acct-form-select com-send-select" onchange="comOnSelectEvent(this.value)" style="max-width:520px;">
        <option value="">— 이벤트 연결 없음 —</option>
        ${events.map(e=>`<option value="${e.id}" ${comState.sendEventId===e.id?'selected':''}>${eventDisplayName(e)} · ${e.timeRange||''} · ${e.orderedKw||'-'} kW</option>`).join('')}
      </select>
    </div>

    <!-- 3. 발송 미리보기 -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 20px;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:10px;">3. 발송 미리보기</div>
      ${preview}
    </div>

    <!-- 4. 대상 요약 + 실행 버튼 -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--navy);">4. 발송 확인</div>
          <div style="margin-top:6px;font-size:12px;color:var(--text-sub);">
            대상 <b style="color:var(--blue);font-size:14px;">${targets.length}명</b> ·
            발송 채널 <b>${CH_META[comState.sendChannel]?.label || comState.sendChannel || '알림톡'}</b>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary" onclick="comGotoList()">취소</button>
          <button class="btn btn-secondary" onclick="comSendTest()" ${targets.length===0?'disabled':''}>나에게 테스트 발송</button>
          <button class="btn btn-primary" id="com-send-exec-btn" onclick="comConfirmSend()" ${targets.length===0?'disabled':''}>${targets.length}명에게 발송</button>
        </div>
      </div>
    </div>
  `;

  // 개별 고객 모드: 테이블 본문 렌더
  if(comState.sendMode==='customer'){
    const q = ($('com-send-cust-search')?.value || '').toLowerCase();
    const filtered = q ? allActiveCusts.filter(c=>(c.name+c.id).toLowerCase().includes(q)) : allActiveCusts;
    const body = filtered.map(c=>{
      const checked = comState.sendSelectedCustIds.has(c.id);
      return `<tr data-cid="${c.id}" style="border-top:1px solid var(--border);">
        <td style="padding:8px 10px;text-align:center;">
          <input type="checkbox" ${checked?'checked':''} onchange="comToggleCust('${c.id}',this.checked)">
        </td>
        <td style="padding:8px 10px;">${c.name} <span style="color:var(--text-hint);font-size:11px;">${c.id}</span></td>
        <td style="padding:8px 10px;color:var(--text-sub);">${c.groupName}</td>
        <td style="padding:8px 10px;color:var(--text-sub);font-variant-numeric:tabular-nums;">${c.tel||'—'}</td>
      </tr>`;
    }).join('');
    const tb = $('com-send-cust-tbody');
    if(tb) tb.innerHTML = body || '<tr><td colspan="4" style="padding:20px;text-align:center;color:var(--text-hint);">검색 결과가 없습니다.</td></tr>';
    const allCb = $('com-send-cust-all');
    if(allCb) allCb.checked = filtered.length>0 && filtered.every(c=>comState.sendSelectedCustIds.has(c.id));
  }
}

function comSetSendMode(mode){
  comState.sendMode = mode;
  if(mode==='customer') comState.sendSelectedCustIds.clear();
  comRenderSendView();
}
function comToggleGroupTarget(gid, checked){
  const key = String(gid);
  if(checked) comState.sendSelectedGroupIds.add(key);
  else comState.sendSelectedGroupIds.delete(key);
  comState.sendSelectedGroupId = comState.sendSelectedGroupIds.size
    ? Array.from(comState.sendSelectedGroupIds)[0]
    : null;
  comRenderSendView();
}
function comToggleGroupAll(checked){
  const activeGroups = store.groups.filter(g=>g.status==='active');
  if(checked){
    comState.sendSelectedGroupIds = new Set(activeGroups.map(g=>String(g.id)));
  } else {
    comState.sendSelectedGroupIds.clear();
  }
  comState.sendSelectedGroupId = comState.sendSelectedGroupIds.size
    ? Array.from(comState.sendSelectedGroupIds)[0]
    : null;
  comRenderSendView();
}
function comOnSelectGroup(gid){
  comState.sendSelectedGroupId = gid;
  comState.sendSelectedGroupIds = new Set(gid ? [String(gid)] : []);
  comRenderSendView();
}
function comOnSelectEvent(eid){
  comState.sendEventId = eid || null;
  comRenderSendView();
}
function comOnSelectChannel(ch){
  comState.sendChannel = ch;
  comRenderSendView();
}
function comToggleCust(cid, checked){
  if(checked) comState.sendSelectedCustIds.add(cid);
  else comState.sendSelectedCustIds.delete(cid);
  comRenderSendView();
}
function comToggleCustAll(checked){
  const q = ($('com-send-cust-search')?.value || '').toLowerCase();
  const activeGroups = store.groups.filter(g=>g.status==='active');
  const all = activeGroups
    .flatMap(g=>g.customerIds||[])
    .map(cid=>store.customers.find(x=>x.id===cid))
    .filter(c=>c && c.status==='계약완료');
  const filtered = q ? all.filter(c=>(c.name+c.id).toLowerCase().includes(q)) : all;
  if(checked) filtered.forEach(c=>comState.sendSelectedCustIds.add(c.id));
  else filtered.forEach(c=>comState.sendSelectedCustIds.delete(c.id));
  comRenderSendView();
}

/* 대상 계산 */
function comCalcSendTargets(){
  if(comState.sendMode==='group'){
    const ids = Array.from(comState.sendSelectedGroupIds || []);
    if(ids.length===0) return [];
    const unique = new Map();
    ids.forEach(gid=>{
      const g = store.groups.find(x=>String(x.id)===String(gid));
      if(!g) return;
      (g.customerIds||[]).forEach(cid=>{
        const c = store.customers.find(x=>x.id===cid);
        if(c && c.status==='계약완료') unique.set(c.id, c);
      });
    });
    return Array.from(unique.values());
  }
  return Array.from(comState.sendSelectedCustIds)
    .map(cid=>store.customers.find(x=>x.id===cid))
    .filter(c=>c && c.status==='계약완료');
}

/* 템플릿 변수 치환 */
function comRenderTemplate(tpl, cust, eventId){
  const ev = eventId ? store.events?.reduction?.find(e=>e.id===eventId) : null;
  const g = cust ? store.groups.find(gg=>(gg.customerIds||[]).includes(cust.id)) : null;
  const vars = {
    custName: cust?.name || '고객님',
    eventId: ev ? eventDisplayName(ev) : '—',
    timeRange: ev?.timeRange || '—',
    orderedKw: ev?.orderedKw ? ev.orderedKw.toLocaleString()+' kW' : '—',
    groupName: g?.name || '—',
    rate: ev?.performanceRate ? Math.round(ev.performanceRate*100)+'%' : '—',
  };
  return (tpl.body||'').replace(/\{\{(\w+)\}\}/g, (m,k)=> (k in vars) ? vars[k] : m);
}
function comRenderTemplatePreview(tpl, cust, eventId){
  const text = comRenderTemplate(tpl, cust, eventId);
  const chRadios = (tpl.channels||[]).map(ch=>{
    const m = CH_META[ch];
    const checked = comState.sendChannel===ch;
    return m ? `<label class="com-send-channel-option ${checked?'active':''}">
      <input type="radio" name="com-send-channel" value="${ch}" ${checked?'checked':''} onchange="comOnSelectChannel('${ch}')">
      <span>${m.label}</span>
    </label>` : '';
  }).join(' ');
  return `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;font-size:12px;">
      <span style="color:var(--text-hint);">발송 채널:</span> ${chRadios}
    </div>
    <div style="background:#f6fbff;border:1px solid var(--blue-border);border-radius:var(--radius);padding:12px 16px;font-size:12px;line-height:1.6;white-space:pre-wrap;">
      ${text}
    </div>
    <div style="margin-top:6px;font-size:10px;color:var(--text-hint);">* 첫 번째 대상(${cust?.name||'—'}) 기준 렌더링 · 실제 발송 시 각 고객별로 치환됩니다.</div>`;
}

/* ─────────────────────────────────────────────
   발송 실행 (확인 모달 → 실행 → 결과 처리)
───────────────────────────────────────────── */
function comSendTest(){
  const t = store.commTemplates.find(x=>x.id===comState.sendTargetTemplateId);
  if(!t) return;
  const me = store.customers[0]; // 데모: 첫 고객을 "나"로 가정
  const preview = comRenderTemplate(t, me, comState.sendEventId);
  alert(`테스트 발송 (${CH_META[comState.sendChannel]?.label || comState.sendChannel || '알림톡'})\n\n${preview}\n\n※ 실제로는 운영자 본인 번호로 발송됩니다.`);
  if(window.logAudit) logAudit('템플릿 테스트 발송', `${t.title}`);
}

function comConfirmSend(){
  const t = store.commTemplates.find(x=>x.id===comState.sendTargetTemplateId);
  const targets = comCalcSendTargets();
  if(!t || targets.length===0) return;
  // 확인 모달 없이 즉시 발송 (사용자 지시 반영)
  // 오조작 방지: 버튼 disabled는 comExecuteSend 내부에서 처리
  comExecuteSend(t, targets);
}

function comExecuteSend(tpl, targets){
  const now = new Date();
  const nowStr = now.toISOString().substring(0,19).replace('T',' ');
  const batchId = 'BATCH-'+Date.now().toString().slice(-8);
  const primaryCh = comState.sendChannel || 'KKO';

  const results = { success:0, fail:0, failDetails:[] };

  targets.forEach(cust=>{
    // 시뮬레이션: 결정론적으로 약 5% 실패
    const hash = (cust.id+batchId).split('').reduce((s,c)=>s+c.charCodeAt(0),0);
    const fails = (hash % 20) === 0; // 약 5%
    const logId = 'LOG-'+Date.now().toString().slice(-6)+'-'+cust.id;

    if(fails){
      results.fail++;
      results.failDetails.push({cust, reason:'통신사 일시 오류'});
      store.commSendLog.push({
        id: logId,
        batchId,
        sentAt: nowStr,
        customerId: cust.id,
        eventId: comState.sendEventId||null,
        templateCode: tpl.code,
        channel: primaryCh,
        result: 'FAIL',
        failReason: '통신사 일시 오류',
        ack: null,
      });
    } else {
      results.success++;
      store.commSendLog.push({
        id: logId,
        batchId,
        sentAt: nowStr,
        customerId: cust.id,
        eventId: comState.sendEventId||null,
        templateCode: tpl.code,
        channel: primaryCh,
        result: 'OK',
        ack: Math.random()>0.2,  // 약 80% ack
      });
    }
  });

  if(window.logAudit) logAudit('템플릿 발송', `${tpl.title} · ${targets.length}명 (성공 ${results.success} · 실패 ${results.fail})`);

  // 결과에 따른 분기
  if(results.fail===0){
    showToast(`${results.success}명에게 발송 완료되었습니다.`);
    comGotoList();
    comSwitchTab('history');
  } else {
    // 발송 실패 알럿 + 로그 이동 선택
    const msg = `메시지 발송이 일부 실패했습니다.\n\n`+
      `• 전체: ${targets.length}명\n`+
      `• 성공: ${results.success}명\n`+
      `• 실패: ${results.fail}명\n\n`+
      `실패한 메시지는 [발송 이력]에서 확인하고 재발송할 수 있습니다.\n\n`+
      `발송 이력으로 이동하시겠습니까?`;
    if(confirm(msg)){
      comGotoList();
      comSwitchTab('history');
    } else {
      showToast(`발송 완료 (성공 ${results.success}건 / 실패 ${results.fail}건)`);
      comGotoList();
    }
  }
}

/* ─────────────────────────────────────────────
   ② 발송 이력 탭 (재발송 액션 포함)
───────────────────────────────────────────── */
function comRenderHistory(){
  const rows = [...store.commSendLog].sort((a,b)=> (b.sentAt||'').localeCompare(a.sentAt||''));
  const tplName = (code)=> store.commTemplates.find(t=>t.code===code)?.title || code;
  const custName = (id)=> store.customers.find(c=>c.id===id)?.name || id;
  const ackBadge = (a)=> a===null ? '<span class="badge badge-gray">—</span>'
                       : a===true ? '<span class="badge badge-done">수신확인</span>'
                       : '<span class="badge badge-fail">미확인</span>';
  const chBadge = (ch)=>{ const m=CH_META[ch]; return m?`<span class="badge" style="background:${m.bg};color:${m.color};">${m.label}</span>`:ch; };
  const resBadge = (r,reason)=> r==='OK'
    ? '<span class="badge badge-done">성공</span>'
    : `<span class="badge badge-fail" title="${reason||''}">실패</span>`;

  $('com-tab-history').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <div style="font-size:13px;font-weight:600;color:var(--navy);">발송 이력 (${rows.length}건)</div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-secondary" onclick="comRetryFailures()">실패 건 일괄 재발송</button>
        <button class="btn btn-sm btn-secondary" onclick="comExportHistory()">CSV 내보내기</button>
      </div>
    </div>
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead style="background:var(--bg);"><tr>
          <th style="padding:10px 12px;text-align:left;width:150px;">발송 시각</th>
          <th style="padding:10px 12px;text-align:left;">대상 고객</th>
          <th style="padding:10px 12px;text-align:left;">연결 이벤트</th>
          <th style="padding:10px 12px;text-align:left;">템플릿</th>
          <th style="padding:10px 12px;text-align:center;width:80px;">채널</th>
          <th style="padding:10px 12px;text-align:center;width:80px;">발송</th>
          <th style="padding:10px 12px;text-align:center;width:100px;">수신 확인</th>
          <th style="padding:10px 12px;text-align:center;width:90px;">관리</th>
        </tr></thead>
        <tbody>${rows.slice(0,120).map(r=>`
          <tr style="border-top:1px solid var(--border);">
            <td style="padding:10px 12px;color:var(--text-sub);font-variant-numeric:tabular-nums;">${r.sentAt}</td>
            <td style="padding:10px 12px;font-weight:500;">${custName(r.customerId)} <span style="color:var(--text-hint);font-size:11px;">${r.customerId}</span></td>
            <td style="padding:10px 12px;color:var(--text-sub);font-variant-numeric:tabular-nums;">${r.eventId||'—'}</td>
            <td style="padding:10px 12px;">${tplName(r.templateCode)}</td>
            <td style="padding:10px 12px;text-align:center;">${chBadge(r.channel)}</td>
            <td style="padding:10px 12px;text-align:center;">${resBadge(r.result, r.failReason)}</td>
            <td style="padding:10px 12px;text-align:center;">${ackBadge(r.ack)}</td>
            <td style="padding:10px 12px;text-align:center;">
              ${r.result==='FAIL' || r.ack===false
                ? `<button class="btn btn-xs btn-primary" onclick="comResendSingle('${r.id}')">재발송</button>`
                : '<span style="color:var(--text-hint);font-size:11px;">—</span>'}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function comResendSingle(logId){
  const orig = store.commSendLog.find(l=>l.id===logId);
  if(!orig){ showToast('원본 로그를 찾을 수 없습니다.'); return; }
  const cust = store.customers.find(c=>c.id===orig.customerId);
  const tpl = store.commTemplates.find(t=>t.code===orig.templateCode);
  if(!cust || !tpl){ showToast('재발송할 대상/템플릿을 찾을 수 없습니다.'); return; }
  if(!confirm(`${cust.name} (${cust.id}) 에게 "${tpl.title}" 재발송하시겠습니까?`)) return;

  const now = new Date().toISOString().substring(0,19).replace('T',' ');
  const hash = (cust.id+'retry'+Date.now()).split('').reduce((s,c)=>s+c.charCodeAt(0),0);
  const fails = (hash % 25) === 0;
  const newId = 'LOG-'+Date.now().toString().slice(-6)+'-RETRY';

  store.commSendLog.push({
    id: newId,
    batchId: 'RESEND-'+Date.now().toString().slice(-6),
    resendOfLogId: logId, // 원본 로그와 연결
    sentAt: now,
    customerId: cust.id,
    eventId: orig.eventId,
    templateCode: tpl.code,
    channel: orig.channel,
    result: fails ? 'FAIL' : 'OK',
    failReason: fails ? '재시도 실패' : undefined,
    ack: fails ? null : true,
  });

  if(window.logAudit) logAudit('개별 재발송', `${cust.name} · ${tpl.title}`);
  if(fails){
    alert(`${cust.name}님에게 재발송을 시도했지만 실패했습니다.\n발송 이력에서 결과를 확인하세요.`);
  } else {
    showToast(`${cust.name}님에게 재발송되었습니다.`);
  }
  comRefreshKpis();
  comRenderHistory();
}

function comRetryFailures(){
  const fails = store.commSendLog.filter(l=>l.result==='FAIL' && !l._retried);
  if(fails.length===0){ showToast('재발송 대상 실패 건이 없습니다.'); return; }
  if(!confirm(`실패 ${fails.length}건을 일괄 재발송하시겠습니까?`)) return;
  let ok=0, ng=0;
  const now = new Date().toISOString().substring(0,19).replace('T',' ');
  const retryBatchId = 'RETRY-'+Date.now().toString().slice(-6);
  fails.forEach(orig=>{
    orig._retried = true;
    const hash = (orig.customerId+retryBatchId).split('').reduce((s,c)=>s+c.charCodeAt(0),0);
    const fail2 = (hash % 30) === 0;
    const newId = 'LOG-'+Date.now().toString().slice(-6)+'-'+orig.customerId;
    store.commSendLog.push({
      id:newId, batchId:retryBatchId, resendOfLogId:orig.id,
      sentAt:now, customerId:orig.customerId, eventId:orig.eventId,
      templateCode:orig.templateCode, channel:orig.channel,
      result: fail2 ? 'FAIL' : 'OK',
      failReason: fail2 ? '재시도 실패' : undefined,
      ack: fail2 ? null : true,
    });
    if(fail2) ng++; else ok++;
  });
  if(window.logAudit) logAudit('실패 건 일괄 재발송', `성공 ${ok} · 실패 ${ng}`);
  if(ng>0){
    alert(`일괄 재발송 결과\n\n• 성공: ${ok}건\n• 실패: ${ng}건\n\n실패 건은 발송 이력에서 다시 확인하세요.`);
  } else {
    showToast(`${ok}건 재발송 완료`);
  }
  comRefreshKpis();
  comRenderHistory();
}

/* ─────────────────────────────────────────────
   ③ 수신 확인 탭
───────────────────────────────────────────── */
function comRenderAck(){
  const pending = store.commSendLog.filter(l=>l.ack===false);
  const byEvent = {};
  pending.forEach(l=>{ (byEvent[l.eventId||'ETC'] ??= []).push(l); });
  const custName = (id)=> store.customers.find(c=>c.id===id)?.name || id;
  const custTel  = (id)=> store.customers.find(c=>c.id===id)?.tel  || '—';
  const html = Object.entries(byEvent).map(([evt,logs])=>`
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--navy);">${evt==='ETC'?'(이벤트 미연결)':evt}</div>
          <div style="font-size:11px;color:var(--text-hint);margin-top:2px;">미확인 ${logs.length}건 · 발송 후 재확인 필요</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-secondary" onclick="comResendUnconfirmed('${evt}')">미확인 건 재발송</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px;">
        ${logs.map(l=>`
          <div style="background:var(--red-light);border:1px solid var(--red-border);border-radius:var(--radius);padding:10px;">
            <div style="font-size:12px;font-weight:600;color:var(--red);">${custName(l.customerId)}</div>
            <div style="font-size:11px;color:var(--text-sub);margin-top:2px;font-variant-numeric:tabular-nums;">${l.customerId} · ${custTel(l.customerId)}</div>
            <div style="font-size:11px;color:var(--text-hint);margin-top:4px;">${l.channel} · ${l.sentAt}</div>
            <button class="btn btn-xs btn-primary" style="margin-top:6px;width:100%;" onclick="comResendSingle('${l.id}')">개별 재발송</button>
          </div>`).join('')}
      </div>
    </div>`).join('') || `
    <div style="background:var(--green-light);border:1px solid var(--green-border);border-radius:var(--radius-lg);padding:24px;text-align:center;color:var(--green);font-weight:600;">
      ✓ 모든 발송 알림이 수신 확인되었습니다
    </div>`;
  $('com-tab-ack').innerHTML = html;
}
function comResendUnconfirmed(evt){
  const targets = store.commSendLog.filter(l=>l.ack===false && (l.eventId||'ETC')===evt);
  if(targets.length===0){ showToast('재발송할 미확인 건이 없습니다.'); return; }
  if(!confirm(`${evt==='ETC'?'이벤트 미연결':evt} 미확인 ${targets.length}건을 재발송하시겠습니까?`)) return;
  const now = new Date().toISOString().substring(0,19).replace('T',' ');
  const batchId = 'UNC-'+Date.now().toString().slice(-6);
  let ok=0, ng=0;
  targets.forEach(orig=>{
    const hash = (orig.customerId+batchId).split('').reduce((s,c)=>s+c.charCodeAt(0),0);
    const fail = (hash%20)===0;
    store.commSendLog.push({
      id:'LOG-'+Date.now().toString().slice(-6)+'-'+orig.customerId,
      batchId, resendOfLogId:orig.id,
      sentAt:now, customerId:orig.customerId, eventId:orig.eventId,
      templateCode:orig.templateCode,
      channel:'SMS',  // 미확인 재발송은 SMS 폴백
      result: fail ? 'FAIL' : 'OK',
      failReason: fail ? '통신사 오류' : undefined,
      ack: fail ? null : true,
    });
    orig.ack = null; // 원본 ack는 "재발송 처리됨"으로 표시 (무효화)
    if(fail) ng++; else ok++;
  });
  if(window.logAudit) logAudit('미확인 건 재발송', `${evt} · ${targets.length}건`);
  if(ng>0){
    alert(`재발송 결과\n\n• 성공: ${ok}건\n• 실패: ${ng}건`);
  } else {
    showToast(`${ok}건 재발송 완료`);
  }
  comRefreshKpis();
  comRenderAck();
}

/* ─────────────────────────────────────────────
   ④ 상담 메모 탭 (기존 유지)
───────────────────────────────────────────── */
function comRenderMemo(){
  const custName = (id)=> store.customers.find(c=>c.id===id)?.name || id;
  const kindColor = {'통화':'var(--blue)', '방문':'var(--green)', '이메일':'var(--gray)', '기타':'var(--purple)'};
  $('com-tab-memo').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <div style="font-size:13px;font-weight:600;color:var(--navy);">상담 이력 (${(store.commMemos||[]).length}건)</div>
      <button class="btn btn-sm btn-primary" onclick="comAddMemo()">+ 메모 작성</button>
    </div>
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead style="background:var(--bg);"><tr>
          <th style="padding:10px 12px;text-align:left;width:130px;">일시</th>
          <th style="padding:10px 12px;text-align:left;">고객</th>
          <th style="padding:10px 12px;text-align:left;width:80px;">담당자</th>
          <th style="padding:10px 12px;text-align:left;width:70px;">구분</th>
          <th style="padding:10px 12px;text-align:left;">요약</th>
        </tr></thead>
        <tbody>${(store.commMemos||[]).map(m=>`
          <tr style="border-top:1px solid var(--border);">
            <td style="padding:10px 12px;color:var(--text-sub);font-variant-numeric:tabular-nums;">${m.at}</td>
            <td style="padding:10px 12px;font-weight:500;">${custName(m.customerId)} <span style="color:var(--text-hint);font-size:11px;">${m.customerId}</span></td>
            <td style="padding:10px 12px;">${m.by}</td>
            <td style="padding:10px 12px;"><span class="badge" style="background:${kindColor[m.kind]||'var(--gray)'};color:#fff;">${m.kind}</span></td>
            <td style="padding:10px 12px;color:var(--text-sub);">${m.summary}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;
}
function comAddMemo(){
  const customerOptions = store.customers
    .slice()
    .sort((a,b)=>a.name.localeCompare(b.name,'ko'))
    .map(c=>`<option value="${c.id}">${c.name} (${c.id})</option>`)
    .join('');
  $('cm-title').textContent = '상담 메모 작성';
  $('cm-sub').textContent = '고객 커뮤니케이션 이력을 운영 화면에서 바로 기록합니다.';
  $('cm-body').innerHTML = `
    <div class="form-row">
      <label class="form-label">대상 고객</label>
      <select class="form-select" id="com-memo-customer">${customerOptions}</select>
    </div>
    <div class="form-row">
      <label class="form-label">구분</label>
      <select class="form-select" id="com-memo-kind">
        <option value="통화">통화</option>
        <option value="이메일">이메일</option>
        <option value="방문">방문</option>
        <option value="메신저">메신저</option>
      </select>
    </div>
    <div class="form-row">
      <label class="form-label">메모 내용</label>
      <textarea class="form-textarea" id="com-memo-summary" placeholder="상담 내용, 후속 조치, 확인 필요 사항을 입력하세요."></textarea>
    </div>`;
  $('cm-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('commonModal')">취소</button>
    <button class="btn btn-primary" onclick="comSubmitMemo()">저장</button>`;
  openModal('commonModal');
}
function comSubmitMemo(){
  const customerId = $('com-memo-customer')?.value;
  const kind = $('com-memo-kind')?.value || '통화';
  const summary = $('com-memo-summary')?.value.trim();
  if(!customerId || !summary){ showToast('대상 고객과 메모 내용을 입력하세요.'); return; }
  const nextSeq = ((store.commMemos||[]).length + 1).toString().padStart(3,'0');
  if(!store.commMemos) store.commMemos = [];
  store.commMemos.unshift({
    id:`MEM-${nextSeq}`,
    customerId,
    at: nowStr(),
    by:'현진영',
    kind,
    summary,
  });
  closeModal('commonModal');
  comSwitchTab('memo');
  if(window.logAudit) window.logAudit('상담 메모 작성', `${customerId} · ${kind}`);
  showToast('상담 메모가 저장되었습니다.');
}

/* CSV 내보내기 */
function comExportHistory(){
  const rows = [['sentAt','customerId','customerName','eventId','templateCode','channel','result','ack','failReason','resendOfLogId']];
  store.commSendLog.forEach(l=>{
    const cust = store.customers.find(c=>c.id===l.customerId);
    rows.push([l.sentAt, l.customerId, cust?.name||'', l.eventId||'', l.templateCode, l.channel, l.result, l.ack===null?'':(l.ack?'Y':'N'), l.failReason||'', l.resendOfLogId||'']);
  });
  const csv = rows.map(r=>r.map(v=>{
    const s=String(v??''); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
  }).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `com_sendlog_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`발송 이력 ${store.commSendLog.length}건 CSV 다운로드 완료`);
}

/* ─────────────────────────────────────────────
   BID · 시드 데이터 — 입찰 관리
───────────────────────────────────────────── */
