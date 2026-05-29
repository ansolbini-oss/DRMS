/* ════════════════════════════════════════════════════════════
   ★ GLOBAL STORE — 모든 페이지가 참조하는 단일 데이터 원천
   흐름: 사전검증 → (계약완료 시 자원풀 등록) → 자원관리 자원그룹 매핑
        → 활성 자원그룹 → 감축모니터링 이벤트 대상
════════════════════════════════════════════════════════════ */
const store = {
  /* 사전검증 대상 리드(고객)
     status 흐름: 검증대기 → 검증중 → 검증완료 → 계약완료 | 반려
     steps[i]: 1=대기, 3=진행중, 2=완료, 0=실패 (6단계)
  */
  customers: [
    // 계약완료 상태 (자원 풀에 이미 등록되어 자원관리에서 매핑 가능)
    {id:'C011',name:'삼성전자',         ceo:'이재용',tel:'02-2255-0114',addr:'경기 수원시',recno:'DR-2024-0101',date:'2024-07-05',power:1000,kepco:'10011001',drType:'표준DR',       status:'계약완료',dataStatus:'수집완료',inflow:'영업',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'950kW',reduction:500,rrmseVal:'7%',infraS:'완료',
     sites:[
       {id:'C011-S1', siteName:'수원사업장',     kepco:'10011001', addr:'경기 수원시 영통구',  power:400, steps:[2,2,2,2,2,2], dataStatus:'수집완료', verifyStatus:'검증완료', date:'2024-07-05'},
       {id:'C011-S2', siteName:'평택공장',       kepco:'10011002', addr:'경기 평택시',         power:350, steps:[2,2,2,2,2,2], dataStatus:'수집완료', verifyStatus:'검증완료', date:'2024-07-06'},
       {id:'C011-S3', siteName:'화성반도체',     kepco:'10011003', addr:'경기 화성시',         power:250, steps:[2,2,2,2,2,2], dataStatus:'수집완료', verifyStatus:'검증완료', date:'2024-07-07'}
     ]},
    {id:'C012',name:'LG전자',           ceo:'조주완',tel:'02-3777-1114',addr:'서울 영등포구',recno:'DR-2024-0102',date:'2024-07-08',power:900, kepco:'10012002',drType:'표준DR',       status:'계약완료',dataStatus:'수집완료',inflow:'영업',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'860kW',reduction:450,rrmseVal:'6%',infraS:'완료',
     sites:[
       {id:'C012-S1', siteName:'영등포 본사',    kepco:'10012002', addr:'서울 영등포구',       power:500, steps:[2,2,2,2,2,2], dataStatus:'수집완료', verifyStatus:'검증완료', date:'2024-07-08'},
       {id:'C012-S2', siteName:'평택 LG공장',    kepco:'10012003', addr:'경기 평택시',         power:400, steps:[2,2,2,2,2,2], dataStatus:'수집완료', verifyStatus:'검증완료', date:'2024-07-09'}
     ]},
    {id:'C013',name:'현대제철',         ceo:'안동일',tel:'031-230-6114',addr:'경기 당진시',  recno:'DR-2024-0103',date:'2024-07-12',power:800, kepco:'10013003',drType:'표준DR',       status:'계약완료',dataStatus:'수집완료',inflow:'영업',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'동일요일 평균',cblAvg:'760kW',reduction:380,rrmseVal:'9%',infraS:'완료',
     sites:[
       {id:'C013-S1', siteName:'당진제철소',     kepco:'10013003', addr:'경기 당진시',         power:800, steps:[2,2,2,2,2,2], dataStatus:'수집완료', verifyStatus:'검증완료', date:'2024-07-12'},
       {id:'C013-S2', siteName:'인천공장',       kepco:'10013004', addr:'인천 남동구',         power:650, steps:[2,2,2,2,2,2], dataStatus:'수집완료', verifyStatus:'검증완료', date:'2024-07-13'},
       {id:'C013-S3', siteName:'포항공장',       kepco:'10013005', addr:'경북 포항시',         power:720, steps:[2,2,2,2,2,2], dataStatus:'수집완료', verifyStatus:'검증완료', date:'2024-07-14'},
       {id:'C013-S4', siteName:'광양공장',       kepco:'10013006', addr:'전남 광양시',         power:580, steps:[2,2,2,2,2,2], dataStatus:'수집완료', verifyStatus:'검증완료', date:'2024-07-15'}
     ]},
    {id:'C015',name:'SK하이닉스',       ceo:'곽노정',tel:'031-630-4114',addr:'경기 이천시',  recno:'DR-2024-0104',date:'2024-07-18',power:750, kepco:'10015005',drType:'표준DR',       status:'계약완료',dataStatus:'수집완료',inflow:'영업',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'710kW',reduction:370,rrmseVal:'8%',infraS:'완료',
     sites:[
       {id:'C015-S1', siteName:'이천공장',       kepco:'10015005', addr:'경기 이천시',         power:400, steps:[2,2,2,2,2,2], dataStatus:'수집완료', verifyStatus:'검증완료', date:'2024-07-18'},
       {id:'C015-S2', siteName:'청주공장',       kepco:'10015006', addr:'충북 청주시',         power:350, steps:[2,2,2,2,2,2], dataStatus:'수집완료', verifyStatus:'검증완료', date:'2024-07-19'}
     ]},
    {id:'C016',name:'롯데백화점',       ceo:'정준호',tel:'02-2118-2114',addr:'서울 중구',    recno:'DR-2024-0105',date:'2024-09-25',power:500, kepco:'10016006',drType:'중소형DR',     status:'계약완료',dataStatus:'수집완료',inflow:'사이트',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'480kW',reduction:260,rrmseVal:'10%',infraS:'완료'},
    {id:'C017',name:'신세계',           ceo:'손영식',tel:'02-1588-1234',addr:'서울 중구',    recno:'DR-2024-0106',date:'2024-09-28',power:450, kepco:'10017007',drType:'중소형DR',     status:'계약완료',dataStatus:'수집완료',inflow:'사이트',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'동일요일 평균',cblAvg:'430kW',reduction:240,rrmseVal:'11%',infraS:'완료'},
    {id:'C041',name:'(주)충남지식산업',  ceo:'박진호',tel:'041-555-7890',addr:'충남 천안시',  recno:'DR-2026-0041',date:'2026-03-20',power:420, kepco:'41041041',drType:'중소형DR',     status:'계약완료',dataStatus:'수집완료',inflow:'영업',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'400kW',reduction:220,rrmseVal:'9%',infraS:'완료'},
    {id:'C042',name:'서산물류허브',      ceo:'정수민',tel:'041-666-4321',addr:'충남 서산시',  recno:'DR-2026-0042',date:'2026-03-22',power:380, kepco:'42042042',drType:'중소형DR',     status:'계약완료',dataStatus:'수집완료',inflow:'사이트',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'동일요일 평균',cblAvg:'360kW',reduction:200,rrmseVal:'10%',infraS:'완료'},
    {id:'C051',name:'경기정밀공업',      ceo:'장태섭',tel:'031-771-8800',addr:'경기 화성시',  recno:'DR-2026-0051',date:'2026-04-02',power:700, kepco:'51051051',drType:'표준DR',       status:'계약완료',dataStatus:'수집완료',inflow:'영업',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'660kW',reduction:400,rrmseVal:'8%',infraS:'완료'},
    {id:'C052',name:'안양반도체',        ceo:'김혜린',tel:'031-459-2233',addr:'경기 안양시',  recno:'DR-2026-0052',date:'2026-04-04',power:620, kepco:'52052052',drType:'표준DR',       status:'계약완료',dataStatus:'수집완료',inflow:'사이트',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'동일요일 평균',cblAvg:'590kW',reduction:350,rrmseVal:'9%',infraS:'완료'},
    {id:'C053',name:'수원전자',          ceo:'오재영',tel:'031-225-5544',addr:'경기 수원시',  recno:'DR-2026-0053',date:'2026-04-06',power:750, kepco:'53053053',drType:'표준DR',       status:'계약완료',dataStatus:'수집완료',inflow:'영업',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'710kW',reduction:450,rrmseVal:'7%',infraS:'완료'},
    {id:'C001',name:'(주)그린에너지',   ceo:'김녹색',tel:'02-561-3434',addr:'서울 강남구',  recno:'DR-2024-0201',date:'2024-08-01',power:400, kepco:'20001001',drType:'국민DR',       status:'계약완료',dataStatus:'수집완료',inflow:'사이트',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'380kW',reduction:200,rrmseVal:'9%',infraS:'완료'},
    {id:'C002',name:'서울시설공단',     ceo:'이공단',tel:'02-2290-6000',addr:'서울 중구',    recno:'DR-2024-0202',date:'2024-08-05',power:350, kepco:'20002002',drType:'국민DR',       status:'계약완료',dataStatus:'수집완료',inflow:'영업',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'동일요일 평균',cblAvg:'340kW',reduction:180,rrmseVal:'8%',infraS:'완료'},
    {id:'C005',name:'롯데자산개발',     ceo:'오규식',tel:'02-3213-5114',addr:'서울 송파구',  recno:'DR-2024-0203',date:'2024-08-07',power:500, kepco:'20005005',drType:'국민DR',       status:'계약완료',dataStatus:'수집완료',inflow:'사이트',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'475kW',reduction:250,rrmseVal:'7%',infraS:'완료'},
    {id:'C006',name:'스타벅스코리아',   ceo:'손정현',tel:'02-3015-1100',addr:'서울 강남구',  recno:'DR-2024-0204',date:'2024-08-10',power:400, kepco:'20006006',drType:'국민DR',       status:'계약완료',dataStatus:'수집완료',inflow:'사이트',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'동일요일 평균',cblAvg:'380kW',reduction:200,rrmseVal:'10%',infraS:'완료'},
    {id:'C019',name:'제주개발공사',     ceo:'김정학',tel:'064-780-3114',addr:'제주 제주시',  recno:'DR-2024-0301',date:'2024-06-10',power:250, kepco:'30019019',drType:'제주DR',       status:'계약완료',dataStatus:'수집완료',inflow:'사이트',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'238kW',reduction:120,rrmseVal:'8%',infraS:'완료'},
    {id:'C020',name:'한라산소주',       ceo:'고성석',tel:'064-729-1500',addr:'제주 제주시',  recno:'DR-2024-0302',date:'2024-06-12',power:200, kepco:'30020020',drType:'제주DR',       status:'계약완료',dataStatus:'수집완료',inflow:'영업',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'동일요일 평균',cblAvg:'190kW',reduction:100,rrmseVal:'9%',infraS:'완료'},
    {id:'C022',name:'포스코에너지',     ceo:'정기섭',tel:'02-3457-1114',addr:'인천 연수구',  recno:'DR-2024-0401',date:'2024-11-01',power:700, kepco:'40022022',drType:'주파수DR',     status:'계약완료',dataStatus:'수집완료',inflow:'영업',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'680kW',reduction:350,rrmseVal:'7%',infraS:'완료'},
    {id:'C023',name:'GS파워',           ceo:'허연수',tel:'031-400-1114',addr:'경기 안산시',  recno:'DR-2024-0402',date:'2024-11-03',power:500, kepco:'40023023',drType:'주파수DR',     status:'계약완료',dataStatus:'수집완료',inflow:'영업',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'동일요일 평균',cblAvg:'485kW',reduction:250,rrmseVal:'8%',infraS:'완료'},
    {id:'C024',name:'카카오모빌리티',   ceo:'류긍선',tel:'1544-5005',addr:'경기 성남시',  recno:'DR-2024-0501',date:'2024-11-25',power:1200, kepco:'50024024',drType:'플러스DR',     status:'계약완료',dataStatus:'수집완료',inflow:'사이트',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'1150kW',reduction:800,rrmseVal:'6%',infraS:'완료'},
    {id:'C025',name:'쏘카',             ceo:'박재욱',tel:'1588-0000',addr:'서울 성동구',  recno:'DR-2024-0502',date:'2024-11-27',power:1100, kepco:'50025025',drType:'플러스DR',     status:'계약완료',dataStatus:'수집완료',inflow:'사이트',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'1050kW',reduction:700,rrmseVal:'7%',infraS:'완료'},
    // 검증완료 - 계약전환 대기
    {id:'C100',name:'(주)태양광에너텍', ceo:'윤서연',tel:'061-567-8901',addr:'전남 여수시',  recno:'DR-2026-0011',date:'2026-04-10',power:380, kepco:'11223344',drType:'국민DR',       status:'검증완료',dataStatus:'수집완료',inflow:'사이트',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'동일요일 평균',cblAvg:'352kW',reduction:76,rrmseVal:'7%',infraS:'완료'},
    {id:'C101',name:'(주)동성산업',     ceo:'강민호',tel:'054-678-9012',addr:'경북 포항시',  recno:'DR-2026-0012',date:'2026-04-12',power:560, kepco:'22334455',drType:'중소형DR',     status:'검증완료',dataStatus:'수집완료',inflow:'영업',steps:[2,2,2,2,2,2],extS:'통과',rrmseS:'완료',cblS:'완료',cblType:'High 5 of 10',cblAvg:'521kW',reduction:112,rrmseVal:'9%',infraS:'완료'},
    // 검증중
    {id:'C102',name:'(주)한국에너지솔루션',ceo:'김철수',tel:'02-1234-5678',addr:'서울 강남구', recno:'DR-2026-0013',date:'2026-04-14',power:500, kepco:'12345678',drType:'표준DR', status:'검증중',dataStatus:'수집완료',inflow:'사이트',steps:[2,2,2,2,2,3],extS:'통과',rrmseS:'완료',cblS:'진행중',cblType:'-',cblAvg:'-',reduction:null,rrmseVal:'8%',infraS:'완료'},
    {id:'C103',name:'(주)미래서비스코리아',ceo:'최지수',tel:'051-345-6789',addr:'부산 해운대구',recno:'DR-2026-0014',date:'2026-04-15',power:150, kepco:'45678901',drType:'중소형DR',status:'검증중',dataStatus:'수집중',inflow:'영업',steps:[2,2,2,3,1,1],extS:'통과',rrmseS:'진행중',cblS:'미실행',cblType:'-',cblAvg:'-',reduction:null,rrmseVal:'-',infraS:'완료'},
    {id:'C104',name:'(주)케이파워솔루션',ceo:'임태현',tel:'043-456-7890',addr:'충북 청주시',  recno:'DR-2026-0015',date:'2026-04-16',power:750, kepco:'90123456',drType:'국민DR',   status:'검증중',dataStatus:'수집완료',inflow:'사이트',steps:[2,2,2,2,2,1],extS:'통과',rrmseS:'완료',cblS:'미실행',cblType:'-',cblAvg:'-',reduction:null,rrmseVal:'11%',infraS:'완료'},
    // 검증대기
    {id:'C105',name:'㈜대한물류네트웍스',ceo:'이영희',tel:'031-234-5678',addr:'경기 수원시',  recno:'DR-2026-0016',date:'2026-04-17',power:800, kepco:'23456789',drType:'표준DR',   status:'검증대기',dataStatus:'수집완료',inflow:'영업',steps:[1,1,1,1,1,1],extS:'미실행',rrmseS:'미실행',cblS:'미실행',cblType:'-',cblAvg:'-',reduction:null,rrmseVal:'-',infraS:'-'},
    {id:'C106',name:'(주)스마트팩토리', ceo:'한소희',tel:'053-567-8901',addr:'대구 달서구',  recno:'DR-2026-0017',date:'2026-04-18',power:650, kepco:'67890123',drType:'중소형DR',status:'검증대기',dataStatus:'미수집',inflow:'사이트',steps:[1,1,1,1,1,1],extS:'미실행',rrmseS:'미실행',cblS:'미실행',cblType:'-',cblAvg:'-',reduction:null,rrmseVal:'-',infraS:'-'},
    {id:'C107',name:'(주)그린파워텍',   ceo:'오민석',tel:'042-789-1234',addr:'대전 유성구',  recno:'DR-2026-0018',date:'2026-04-18',power:420, kepco:'78901234',drType:'국민DR',  status:'검증대기',dataStatus:'수집완료',inflow:'사이트',steps:[1,1,1,1,1,1],extS:'미실행',rrmseS:'미실행',cblS:'미실행',cblType:'-',cblAvg:'-',reduction:null,rrmseVal:'-',infraS:'-'},
    // 반려
    // C108: 외부데이터 조회 실패 → steps[0]=0 (extS:실패와 일치)
    {id:'C108',name:'(주)현대제조공업', ceo:'정우성',tel:'032-456-7890',addr:'인천 남동구',  recno:'DR-2026-0019',date:'2026-04-19',power:1200,kepco:'56789012',drType:'표준DR',   status:'반려',    dataStatus:'미수집',inflow:'영업',steps:[0,1,1,1,1,1],extS:'실패',rrmseS:'미실행',cblS:'미실행',cblType:'-',cblAvg:'-',reduction:null,rrmseVal:'-',infraS:'-'},
    // C109: RRMSE 실패(32%) → steps[0~3] 완료, steps[4]=0 (rrmseS:실패와 일치)
    {id:'C109',name:'(주)서진물류센터', ceo:'박지훈',tel:'032-789-0123',addr:'인천 연수구',  recno:'DR-2026-0020',date:'2026-04-19',power:670, kepco:'33445566',drType:'중소형DR',status:'반려',    dataStatus:'수집완료',inflow:'영업',steps:[2,2,2,2,0,1],extS:'통과',rrmseS:'실패',cblS:'미실행',cblType:'-',cblAvg:'-',reduction:null,rrmseVal:'32%',infraS:'완료'},
  ],

  /* 자원그룹 (자원관리)
     status: waiting(승인대기) / active(활성) / suspended(일시중지)
     customerIds: 연결된 customer.id 배열 (계약완료 상태여야 함)
  */
  /* 자원그룹 (자원관리)
     status: waiting(승인대기) / active(활성) / suspended(일시중지)
     customerIds: 연결된 customer.id 배열 (계약완료 상태여야 함)
     trial: {
       required: boolean       // 등록시험 대상 여부 (국민DR은 false, 표준·중소형·제주DR은 기본 true)
       status:   // NOT_REQUIRED | WAITING | PASSED | FAILED
       history: [{ testDate, attemptNo, result:'PASS'|'FAIL', performanceRate, testEventId, note, decidedAt, decidedBy }]
       currentTestEventId:     // 진행/예정 중인 시험 이벤트 ID (있을 때만)
     }
  */
  groups: [
    { id:1, name:'표준DR 제조A', type:'표준DR', typeKey:'standard', status:'active', date:'2024-07-22',
      reg:{region:'수도권', mandatoryCapacity:2500},
      file:{name:'수요반응자원_등록신청서_표준DR_제조A.pdf', size:523412, uploadedAt:'2024-07-22 14:30'},
      customerIds:['C011','C012','C013','C015'],
      trial:{required:true, status:'PASSED',
        history:[{testDate:'2024-07-20', attemptNo:1, result:'PASS', performanceRate:0.89, testEventId:'EVT20240720-01', note:'이행률 80% 이상 97% 미만 — 평균 감축이행률로 의무감축용량 조정 후 등록 (제12.3.1.4조 제1항)', decidedAt:'2024-07-20 16:30', decidedBy:'KPX'}]}},
    { id:2, name:'중소형DR 상업A', type:'중소형DR', typeKey:'standard', status:'active', date:'2024-10-01',
      reg:{region:'비수도권', mandatoryCapacity:900},
      file:{name:'수요반응자원_등록신청서_중소형DR_상업A.pdf', size:486521, uploadedAt:'2024-10-01 09:15'},
      customerIds:['C016','C017'],
      trial:{required:true, status:'PASSED',
        history:[
          {testDate:'2024-09-25', attemptNo:1, result:'FAIL', performanceRate:0.58, testEventId:'EVT20240925-01', note:'이행률 80% 미만 — 참여 제한 대상 (제12.3.1.4조 제2항). 수요반응참여고객 재구성 후 차기 등록 신청기간 재신청', decidedAt:'2024-09-25 17:10', decidedBy:'KPX'},
          {testDate:'2024-09-30', attemptNo:2, result:'PASS', performanceRate:0.82, testEventId:'EVT20240930-01', note:'이행률 80% 이상 97% 미만 — 평균 감축이행률로 의무감축용량 조정 후 등록', decidedAt:'2024-09-30 16:45', decidedBy:'KPX'},
        ]}},
    { id:3, name:'표준DR 경기A', type:'표준DR', typeKey:'standard', status:'waiting', date:'2026-04-15',
      reg:{region:'수도권', mandatoryCapacity:1200},
      file:{name:'수요반응자원_등록신청서_표준DR_경기A.pdf', size:486521, uploadedAt:'2026-04-15 10:00'},
      customerIds:['C051','C052','C053'],
      trial:{required:true, status:'WAITING', history:[], currentTestEventId:'EVT20260428-01', autoOptedInAt:'2026-04-25 14:03:12'}},
    { id:4, name:'중소형DR 충남B', type:'중소형DR', typeKey:'standard', status:'waiting', date:'2026-03-28',
      reg:{region:'비수도권', mandatoryCapacity:420},
      file:{name:'수요반응자원_등록신청서_중소형DR_충남B.pdf', size:465120, uploadedAt:'2026-03-28 11:30'},
      customerIds:['C041','C042'],
      trial:{required:true, status:'FAILED',
        history:[{testDate:'2026-04-05', attemptNo:1, result:'FAIL', performanceRate:0.42, testEventId:'EVT20260405-01', note:'이행률 80% 미만 — 참여 제한 대상 (제12.3.1.4조 제2항). 기본정산금·실적정산금 미지급. 운영자 판단 필요', decidedAt:'2026-04-05 16:40', decidedBy:'KPX'}]}},
    { id:6, name:'표준DR 부산A', type:'표준DR', typeKey:'standard', status:'waiting', date:'2026-04-18',
      reg:{region:'비수도권', mandatoryCapacity:1500},
      file:{name:'수요반응자원_등록신청서_표준DR_부산A.pdf', size:512840, uploadedAt:'2026-04-18 09:20'},
      customerIds:[],
      trial:{required:true, status:'WAITING', history:[]}},
    { id:5, name:'국민DR 서울A', type:'국민DR', typeKey:'national', status:'active', date:'2024-08-12',
      reg:{region:'수도권'},
      file:{name:'수요반응자원_등록신청서_국민DR_서울A.pdf', size:612034, uploadedAt:'2024-08-12 10:15'},
      customerIds:['C001','C002','C005','C006'],
      trial:{required:false, status:'NOT_REQUIRED', history:[]}},
    { id:8, name:'제주DR A', type:'제주DR', typeKey:'jeju', status:'active', date:'2024-06-15',
      reg:{region:'제주권', mandatoryCapacity:400},
      file:{name:'수요반응자원_등록신청서_제주DR_A.pdf', size:412850, uploadedAt:'2024-06-15 11:20'},
      customerIds:['C019','C020'],
      trial:{required:true, status:'PASSED',
        history:[{testDate:'2024-06-13', attemptNo:1, result:'PASS', performanceRate:0.98, testEventId:'EVT20240613-01', note:'이행률 97% 이상 — 등록신청용량 그대로 정상 등록 (제12.3.1.4조)', decidedAt:'2024-06-13 18:00', decidedBy:'KPX'}]}},
    { id:10, name:'주파수DR A', type:'주파수DR', typeKey:'freq', status:'active', date:'2024-11-05',
      reg:{region:'육지권', freqStep1:'1단계', freqStep2:'4단계', meterType:'개별부하', estimatedCapacity:800},
      file:{name:'수요반응자원_등록신청서_주파수DR_A.pdf', size:587213, uploadedAt:'2024-11-05 16:20'},
      customerIds:['C022','C023'],
      trial:{required:false, status:'NOT_REQUIRED', history:[]}},
    { id:12, name:'플러스DR 서울', type:'플러스DR', typeKey:'plus', status:'active', date:'2024-12-01',
      reg:{region:'육지권', landSubRegion:['서울','인천','경기'], increaseCapacity:1800},
      file:{name:'수요반응자원_등록신청서_플러스DR_서울.pdf', size:678234, uploadedAt:'2024-12-01 11:00'},
      customerIds:['C024','C025'],
      trial:{required:false, status:'NOT_REQUIRED', history:[]}},
  ],

  /* 감축 이벤트 (groupId 기반으로 정규화) */
  /* 감축 이벤트 (reduction): MANDATORY_REDUCTION + VOLUNTARY_REDUCTION 통합
     플러스DR 이벤트 (plus):   VOLUNTARY_INCREASE + REALTIME_INCREASE_REQUEST
     등록시험 이벤트 (trial):   REGISTRATION_TEST — 자원 신규 등록 시 KPX가 발령하는 시험
     각 이벤트에 dispatch_type + category 필드 명시
       category: 'operation' | 'test'
     주파수DR은 초 단위 응동 체계라 본 이벤트 구조와 무관 → 시드에서 제외 */
  events: {
    reduction: [
      // 현재 진행중인 의무감축 (LIVE)
      {
        id:'EVM20260420-01',
        dispatch_type:'MANDATORY_REDUCTION',
        category:'operation',
        date:'2026-04-20', timeRange:'14:00~15:00',
        label:'2026-04-20 14:00~15:00 · 의무감축',
        source:'KPX', live:true, remainingMinutes:38,
        resources:[
          {groupId:1,  ordered:2500, actual:2420, status:'NORMAL'},
          {groupId:2,  ordered:900,  actual:820,  status:'NORMAL'},
          {groupId:5,  ordered:1050, actual:1005, status:'NORMAL'},
          {groupId:8,  ordered:400,  actual:260,  status:'FAILED'},
        ]
      },
      // 같은 시간대 병행 자발적DR (KPX 공식 확인 - 설계서 §8.1)
      {
        id:'EVV20260420-01',
        dispatch_type:'VOLUNTARY_REDUCTION',
        category:'operation',
        date:'2026-04-20', timeRange:'14:00~15:00',
        label:'2026-04-20 14:00~15:00 · 자발적감축',
        source:'KPX', live:true, remainingMinutes:38,
        parallelWith:'EVM20260420-01',
        bid:{
          submittedAt:'2026-04-20 08:30', submittedBy:'현진영',
          bidVolume:800,                 // 500 + 300 합계
          bidProgram:'ECONOMIC',
          awardedAt:'2026-04-20 11:00',
          awardedVolume:800,
          rejectionReason:''
        },
        resources:[
          {groupId:1,  ordered:500,  actual:485, status:'NORMAL'},
          {groupId:5,  ordered:300,  actual:295, status:'NORMAL'},
        ]
      },
      // 완료된 의무감축
      {
        id:'EVM20260410-01',
        dispatch_type:'MANDATORY_REDUCTION',
        category:'operation',
        date:'2026-04-10', timeRange:'15:00~16:00',
        label:'2026-04-10 15:00~16:00 · 의무감축',
        source:'KPX', live:false,
        resources:[
          {groupId:1,  ordered:2500, actual:2375, status:'NORMAL'},
          {groupId:5,  ordered:1050, actual:1020, status:'NORMAL'},
          {groupId:2,  ordered:900,  actual:820,  status:'NORMAL'},
        ]
      },
      // 예정된 자발적감축
      {
        id:'EVV20260422-01',
        dispatch_type:'VOLUNTARY_REDUCTION',
        category:'operation',
        date:'2026-04-22', timeRange:'13:00~14:00',
        label:'2026-04-22 13:00~14:00 · 자발적감축 (예정)',
        source:'KPX', live:false, scheduled:true,
        bid:{
          submittedAt:'2026-04-21 16:30', submittedBy:'현진영',
          bidVolume:2300,                // 2000 + 300 합계
          bidProgram:'ECONOMIC',
          awardedAt:null,
          awardedVolume:null,
          rejectionReason:''
        },
        bidStatus:'BID_SUBMITTED',       // 입찰 접수 중 (낙찰 전)
        resources:[
          {groupId:1,  ordered:2000, actual:null, status:'SCHEDULED'},
          {groupId:8,  ordered:300,  actual:null, status:'SCHEDULED'},
        ]
      },
      // 등록시험 이력 — 완료된 시험 (중소형DR 상업A 2차 재시험 통과)
      {
        id:'EVT20240930-01',
        dispatch_type:'REGISTRATION_TEST',
        category:'test',
        date:'2024-09-30', timeRange:'14:00~15:00',
        label:'2024-09-30 14:00~15:00 · 등록시험 (중소형DR 상업A 재시험)',
        source:'KPX', live:false,
        trialTargetGroupId:2, trialAttemptNo:2,
        resources:[
          {groupId:2, ordered:900, actual:738, status:'NORMAL'},
        ]
      },
      // 등록시험 이력 — 실패
      {
        id:'EVT20240925-01',
        dispatch_type:'REGISTRATION_TEST',
        category:'test',
        date:'2024-09-25', timeRange:'14:00~15:00',
        label:'2024-09-25 14:00~15:00 · 등록시험 (중소형DR 상업A 최초)',
        source:'KPX', live:false,
        trialTargetGroupId:2, trialAttemptNo:1,
        resources:[
          {groupId:2, ordered:900, actual:522, status:'NORMAL'},
        ]
      },
      // 최근 실패 시험 — 중소형DR 충남B (운영자 판단 대기)
      {
        id:'EVT20260405-01',
        dispatch_type:'REGISTRATION_TEST',
        category:'test',
        date:'2026-04-05', timeRange:'14:00~15:00',
        label:'2026-04-05 14:00~15:00 · 등록시험 (중소형DR 충남B 최초)',
        source:'KPX', live:false,
        trialTargetGroupId:4, trialAttemptNo:1,
        resources:[
          {groupId:4, ordered:420, actual:176, status:'NORMAL'},
        ]
      },
      // 예정된 시험 — 표준DR 경기A (자동 optIn 완료, SCHEDULED 상태)
      {
        id:'EVT20260428-01',
        dispatch_type:'REGISTRATION_TEST',
        category:'test',
        date:'2026-04-28', timeRange:'14:00~15:00',
        label:'2026-04-28 14:00~15:00 · 등록시험 (표준DR 경기A 최초)',
        source:'KPX', live:false, scheduled:true,
        trialTargetGroupId:3, trialAttemptNo:1,
        autoOptedInAt:'2026-04-25 14:03:12',
        resources:[
          {groupId:3, ordered:1200, actual:null, status:'SCHEDULED'},
        ]
      },
    ],
    plus: [
      // 플러스DR 계획 이벤트 (VOLUNTARY_INCREASE)
      {
        id:'EVP-PLAN-20260421-01',
        dispatch_type:'VOLUNTARY_INCREASE',
        category:'operation',
        date:'2026-04-21', timeRange:'13:00~15:00',
        label:'2026-04-21 13:00~15:00 · 플러스DR 계획',
        source:'KPX', live:false, scheduled:true,
        resources:[
          {groupId:12, ordered:1500, actual:null, status:'SCHEDULED'},
        ]
      },
    ],
  },

  verifyLogs: [],
  memos: {},

  /* 매핑 가능 DR유형 (자원그룹 typeKey → 고객 drType 허용) */
  custTypeMap: {
    standard: ['표준DR','H-표준DR','중소형DR','H-중소형DR','중소형DR(EV)','H-중소형DR(EV)'],
    national: ['국민DR'],
    jeju:     ['제주DR','H-제주DR','제주DR(EV)','H-제주DR(EV)'],
    freq:     ['주파수DR'],
    plus:     ['플러스DR'],
  },
};
