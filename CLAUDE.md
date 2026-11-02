# 끝에 도달하는 이야기 (i_can_do_it_game-)

텍스트 기반 선택형 인생 시뮬레이션 기획 저장소. GitHub Pages로 공개: https://kjooy0305.github.io/i_can_do_it_game-/

## 구성
- `mock/index.html` — 폰 화면 시안 (흑백 + 예외색 1개, dayclean 시안 규칙)
- `world/` — 세계관 노트 (`data.js` 데이터 + `index.html` 뷰어)
- `docs/idea.md` — 아이디어 설정 요약, `docs/interview-log.md` — 세계관 인터뷰 기록
- `scripts/check-world.js` — 노트 데이터 검사

## 규칙
- 세계관 노트의 **핵심**은 사용자가 정한 것(바꾸지 않음), **첨언**은 Claude가 덧붙인 초안. 용어를 "살"이라 부르지 않는다.
- 수정이 끝나면 검증 → 커밋 → 푸시까지 한 번에 한다 (사용자 승인). 푸시 후 Pages 배포는 빌드 기록이 없으면 `gh api -X POST repos/kjooy0305/i_can_do_it_game-/pages/builds`로 요청.
- 성기 등 민감 부위는 화면·노트 어디에도 표시하지 않는다 (숨김).
- 세계관 인터뷰는 `.claude/skills/world-interview/SKILL.md`를 따른다. 텔레그램은 `scripts/telegram-bridge.py`(브리지)로 연결한다: 브리지 세션에서는 **마지막 출력 텍스트가 곧 답장**이다. 채널 이벤트(`<channel source="telegram">`)로 받은 경우에만 채널의 reply 도구로 답한다.
- 비밀값은 저장소에 쓰지 않는다.
