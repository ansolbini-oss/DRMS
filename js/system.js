/* ════════════════════════════════════════════════════════════
   SYSTEM — Phase 3에서 메인 <script>에서 분리
   원본 index.html의 해당 prefix 함수/상수를 모음
════════════════════════════════════════════════════════════ */

function sysInit(){
  $('sys-last-sync').textContent = '최종 시스템 점검 · ' + (new Date()).toLocaleString('ko-KR');
  sysRenderAudit();
}
function sysSwitchTab(key){ /* v3: 감사로그 단일뷰 — 탭 스위처 호환용 */ sysRenderAudit(); }
function sysRenderAudit(){
  $('sys-tab-audit').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <div style="font-size:13px;font-weight:600;color:var(--navy);">감사로그 (최근 ${store.auditLog.length}건)</div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-secondary" onclick="sysExportAudit()">CSV 내보내기</button>
      </div>
    </div>
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead style="background:var(--bg);"><tr>
          <th style="padding:10px 12px;text-align:left;width:150px;">일시</th>
          <th style="padding:10px 12px;text-align:left;width:90px;">사용자</th>
          <th style="padding:10px 12px;text-align:left;width:100px;">역할</th>
          <th style="padding:10px 12px;text-align:left;">액션</th>
          <th style="padding:10px 12px;text-align:left;">대상</th>
          <th style="padding:10px 12px;text-align:left;width:120px;">접속 IP</th>
          <th style="padding:10px 12px;text-align:center;width:70px;">결과</th>
        </tr></thead>
        <tbody>${store.auditLog.map(a=>`
          <tr style="border-top:1px solid var(--border);">
            <td style="padding:10px 12px;color:var(--text-sub);font-variant-numeric:tabular-nums;">${a.at}</td>
            <td style="padding:10px 12px;font-weight:500;">${a.user}</td>
            <td style="padding:10px 12px;color:var(--text-sub);font-variant-numeric:tabular-nums;font-size:11px;">${a.role}</td>
            <td style="padding:10px 12px;">${a.action}</td>
            <td style="padding:10px 12px;color:var(--text-sub);">${a.target}</td>
            <td style="padding:10px 12px;color:var(--text-hint);font-variant-numeric:tabular-nums;font-size:11px;">${a.ip}</td>
            <td style="padding:10px 12px;text-align:center;"><span class="badge badge-done">${a.result}</span></td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;
}
function sysExportAudit(){
  const rows = [['at','user','role','action','target','ip','result']];
  store.auditLog.forEach(a=>rows.push([a.at,a.user,a.role,a.action,a.target,a.ip,a.result]));
  const csv = rows.map(r=>r.map(v=>{
    const s = String(v??'');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit_log_${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`감사로그 ${store.auditLog.length}건 CSV 다운로드 완료`);
}

/* 공통 모달 헬퍼 */
