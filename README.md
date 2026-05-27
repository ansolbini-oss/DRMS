# DRMS — 수요반응자원 운영시스템 목업

60hz 수요반응자원(DR) 운영시스템의 화면 목업 프로토타입.

## 구조

```
DRMS/
├── index.html        # 메인 진입점 (shell + 페이지 컨테이너)
├── css/
│   └── styles.css    # 전체 스타일
├── data/             # (예정) 페이지간 공유 데이터
│   ├── customers.js  # 고객/리드
│   ├── groups.js     # 자원그룹
│   ├── events.js     # 감축 이벤트
│   ├── settlements.js
│   └── tips.js       # 도움말
└── js/               # (예정) 페이지별 로직
    ├── core.js       # 라우팅 + 공통 유틸
    ├── precheck.js   # 사전검증 (pc-*)
    ├── resource.js   # 자원관리 (rm-*)
    ├── monitor.js    # 감축 모니터링 (mon-*)
    └── datamgmt.js   # 데이터 관리 (dm-*)
```

## 로컬에서 보기

GitHub Pages 호스팅 후 URL로 바로 열거나, 로컬에서는:

```bash
cd ~/projects/DRMS
python3 -m http.server 8000
# http://localhost:8000
```

> **주의:** 외부 JS/CSS 파일을 fetch하므로 `file://` 직접 열기는 동작 안 함. 반드시 서버를 통해 열 것.

## 분리 작업 이력

- **Phase 0:** 원본 단일 HTML(14,220줄, 759KB) 스냅샷
- **Phase 1:** CSS 분리 → `css/styles.css`
- **Phase 2:** 데이터 분리 → `data/*.js`
- **Phase 3:** 페이지별 JS 분리 → `js/*.js`
- **Phase 4:** GitHub Pages 배포
