# 끝에 도달하는 이야기 (i_can_do_it_game-)

텍스트 기반 선택형 인생 시뮬레이션 기획 저장소. GitHub Pages로 공개: https://kjooy0305.github.io/i_can_do_it_game-/

## 구성
- `mock/index.html` — 폰 화면 시안 (흑백 + 예외색 1개, dayclean 시안 규칙)
- `world/` — 세계관 노트 (`data.js` 데이터 + `index.html` 뷰어). **주제 노트(groups)** + **사전(types, entries: 제국›국가›도시›마을, 신·무기·변이·몬스터 …)**. 이야기는 사전을 기준으로 만든다
- `docs/idea.md` — 아이디어 설정 요약, `docs/interview-log.md` — 세계관 인터뷰 기록
- `scripts/check-world.js` — 노트·사전 데이터 검사, `scripts/world-context.js <id>` — 사전 항목과 위 계층에서 물려받는 핵심·규칙 보기

## 규칙
- 사전은 `world/data.js`의 `entries` 맨 아래에 객체 한 개를 덧붙이면 반영된다. 새 종류는 `types`에 한 줄. 순서·번호에 의존하지 않고 id로만 연결한다. 이야기가 어기면 안 되는 단정문은 항목의 `rules`에 둔다.
- 세계관 인터뷰는 **여러 파트를 섞은 질문 묶음(3~4개)** 으로, 열린 질문과 첨언 확인 위주로 진행한다.
- 세계관 노트의 **핵심**은 사용자가 정한 것(바꾸지 않음), **첨언**은 Claude가 덧붙인 초안. 용어를 "살"이라 부르지 않는다.
- 수정이 끝나면 검증 → 커밋 → 푸시까지 한 번에 한다 (사용자 승인). 푸시 후 Pages 배포는 빌드 기록이 없으면 `gh api -X POST repos/kjooy0305/i_can_do_it_game-/pages/builds`로 요청.
- 성기 등 민감 부위는 화면·노트 어디에도 표시하지 않는다 (숨김).
- 세계관 인터뷰는 `.claude/skills/world-interview/SKILL.md`를 따른다. 텔레그램은 `scripts/telegram-bridge.py`(브리지)로 연결한다: 브리지 세션에서는 **마지막 출력 텍스트가 곧 답장**이다. 채널 이벤트(`<channel source="telegram">`)로 받은 경우에만 채널의 reply 도구로 답한다.
- 비밀값은 저장소에 쓰지 않는다.
