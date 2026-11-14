# 텔레그램 브리지 (세계관 인터뷰)

텔레그램으로 질문을 받고 답하면, 답이 `world/data.js`(세계관 노트)에 반영되는 방식.
Claude Code의 Channels 기능이 이 계정/환경에서 꺼져 있어서(`channels feature is not currently available`) 직접 연결하는 브리지를 쓴다.

```
텔레그램 ──▶ scripts/telegram-bridge.py ──▶ claude -p (--resume, dontAsk) ──▶ 노트 수정·검사·커밋·푸시
   ▲                                                                              │
   └──────────────────────────── 마지막 출력 텍스트가 답장 ◀───────────────────────┘
```

## 실행
```
tmux new -s bridge -c /home/jovyan/work/i_can_do_it_game 'python3 scripts/telegram-bridge.py'
```
- 필요한 것: 토큰(`~/.claude/channels/telegram/.env`), 허용 사용자 ID(`~/.claude/channels/telegram/access.json`의 `allowFrom`), 권한 규칙(`.claude/settings.local.json`).
- **같은 봇을 다른 곳이 동시에 받으면 안 된다.** 텔레그램 플러그인은 꺼 둔다 (`claude plugin disable telegram@claude-plugins-official`). 채널 세션(`claude --channels …`)도 종료한다.
- 로그: `~/.claude/channels/telegram/bridge.log` (메시지 내용은 기록하지 않음)
- 중지: tmux 안에서 Ctrl+C, 또는 `kill $(cat ~/.claude/channels/telegram/bridge.pid)`

## 텔레그램 명령
| 보내는 말 | 동작 |
|---|---|
| 인터뷰 시작 / 다음 | 질문 묶음(3~4개, 여러 파트 섞음, 새 제안 1~2개 포함)을 시작·계속 |
| `A2 B1 C직접문장` 처럼 | 묶음의 질문별 답 (노트에 반영하고 다음 묶음). 번호 없이 문장도 가능 |
| 패스 / `D패스` | 묶음 전체 또는 한 질문만 건너뜀 |
| /status | 브리지 상태 |
| /reset (초기화) | 대화 맥락을 새로 시작 |
| /help | 사용법 |

## 안전장치
- **허용된 사용자 ID의 개인 대화만** 처리한다. 그 외(낯선 사람, 그룹)는 응답 없이 무시한다.
- `claude -p --permission-mode dontAsk`: `.claude/settings.local.json`의 **허용 목록에 없는 도구는 묻지 않고 거부**한다. (자동 모드에서는 허용 목록이 울타리가 아니라서 이 옵션이 필요하다.)
  - 허용: 노트 검사, git 조회·add·commit·push(origin main), `world/data.js`·`docs/interview-log.md`·`docs/idea.md` 수정
  - 거부: 강제 푸시, `git reset --hard`, `rm`, 권한 설정 파일 수정, 그 밖의 모든 쓰기/실행
- 토큰은 로그와 오류 메시지에서 가려진다.

## 문제 해결
- 봇이 응답이 없다: `bridge.log` 확인. `409 충돌` 문구가 있으면 다른 곳이 같은 봇을 받고 있는 것 (채널 세션·플러그인 종료).
- 응답이 느리다: Claude가 노트 수정·검사·푸시까지 하므로 10~60초 걸린다. 처리 중에는 '입력 중…'이 표시된다.
- 맥락이 꼬였다: `/reset`
- 토큰을 바꿨다: `.env`를 고치고 브리지를 재시작

## 사이트 편집 파일 보내기 (#WE 조각)
노트 사이트에서 편집 모드로 고친 내용을 텔레그램으로 보낼 수 있다. Claude 를 거치지 않고 브리지가 직접 처리한다 (긴 JSON 을 베껴 쓰다 틀리는 것을 막기 위해).
1. 사이트 › 변경 내용 내보내기 › **텔레그램용 나눠 복사**. 3,200자 안팎으로 나뉜 조각(`#WE 1/3` …)이 만들어진다.
2. 조각을 **번호 순서대로** 텔레그램에 보낸다 (순서가 바뀌어도 번호로 조립한다). 한 조각마다 "n/전체 받았어요"가 온다.
3. 다 모이면 `edits/` 에 파일로 저장하고 **미리보기**(무엇이 바뀌는지)를 보여 준다.
4. **`반영`** 이라고 보내면 `scripts/apply-world-edits.js` 로 반영 → `check-world.js` 검사 → 커밋 → 푸시한다. **`취소`** 면 파일을 버린다.
- 겹치는 수정은 기본(`BRIDGE_WE_PREFER=hold`)으로 반영하지 않고 목록으로 알려 준다. 검사에 실패하면 되돌린다.
- 조각이 1시간 넘게 이어지지 않으면 처음부터 다시 보내야 한다.
- 이 기능은 허용된 본인의 개인 대화에서 온 메시지만 처리한다 (다른 메시지처럼).

