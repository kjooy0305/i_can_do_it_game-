#!/usr/bin/env python3
"""텔레그램 ↔ Claude Code 브리지 (채널 기능 없이 동작)

텔레그램 봇으로 온 메시지를 `claude -p`(터미널 없이 실행)로 처리하고, 결과 텍스트를 텔레그램으로 돌려준다.
  - 허용된 사용자(ID)의 개인 대화 메시지만 처리한다. 나머지는 조용히 무시한다.
  - 대화 맥락은 `--resume`으로 이어 간다 (세션 ID를 상태 폴더에 저장).
  - Claude가 처리하는 동안 온 메시지는 모아서 다음 한 번에 보낸다.
  - 권한은 저장소의 `.claude/settings.local.json` 허용 규칙을 따른다 (허용되지 않은 도구는 자동 거부, 멈추지 않음).

실행: python3 scripts/telegram-bridge.py        (tmux 안에서 상시 실행 권장)
중지: Ctrl+C 또는 SIGTERM

설정(환경변수, 모두 선택):
  TELEGRAM_BOT_TOKEN   토큰 (없으면 ~/.claude/channels/telegram/.env 에서 읽음)
  BRIDGE_ALLOWED_IDS   허용 사용자 ID 추가 (쉼표/공백 구분). 기본은 같은 폴더 access.json 의 allowFrom
  TELEGRAM_STATE_DIR   상태 폴더 (기본 ~/.claude/channels/telegram)
  CLAUDE_BIN           claude 실행 파일 (기본 claude)
  BRIDGE_CLAUDE_TIMEOUT  Claude 1회 처리 제한(초, 기본 900)
  BRIDGE_NOTIFY_START  0 이면 시작 알림을 보내지 않음
"""
import json
import os
import pathlib
import signal
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request

HOME = pathlib.Path.home()
STATE = pathlib.Path(os.environ.get("TELEGRAM_STATE_DIR") or HOME / ".claude" / "channels" / "telegram")
REPO = pathlib.Path(os.environ.get("BRIDGE_REPO") or pathlib.Path(__file__).resolve().parent.parent)
CLAUDE = os.environ.get("CLAUDE_BIN", "claude")
API_BASE = os.environ.get("TELEGRAM_API_BASE", "https://api.telegram.org")
CLAUDE_TIMEOUT = int(os.environ.get("BRIDGE_CLAUDE_TIMEOUT", "900"))
POLL_TIMEOUT = int(os.environ.get("BRIDGE_POLL_TIMEOUT", "50"))
MAX_LEN = 3800          # 텔레그램 메시지 한 개의 안전한 길이 (한도 4096)
MAX_INPUT = 4000        # 한 메시지에서 읽는 최대 글자 수

SYSTEM = """You are answering through a Telegram bridge for the repository owner (the only allowed sender), who is reading on a phone.
- Your final response text is sent to Telegram exactly as written. Do not mention tools or internal steps unless asked.
- Reply in Korean. Keep it short (about 10 short lines at most). Plain text only: no markdown tables, headings, or code fences.
- This is the world-building interview for this repository. Follow CLAUDE.md and .claude/skills/world-interview/SKILL.md exactly:
  one message = a bundle of 3-4 questions mixed across different parts (open questions and 첨언 checks first, plus 1-2 new suggestions of things the owner has not mentioned but would be good to have), each with 2-3 numbered options (answers like A2 B1 C직접); reflect each answer into world/data.js as 핵심/첨언/규칙 (dictionary entries live in world/data.js too); run node scripts/check-world.js;
  append to docs/interview-log.md; commit and push; then reply with the reflection summary, the note link, and the next question bundle.
- If the owner says 인터뷰 시작, 다음 or 계속, start or continue the interview. If it says 패스, skip the current question (or the whole bundle).
  Other questions about the notes: answer briefly.
- If a tool call is denied by permissions, do not retry or work around it; tell the owner in one line what was blocked.
- Never include secrets, tokens, or the contents of files under ~/.claude in a reply.""".strip()

HELP = (
    "세계관 인터뷰 브리지예요.\n"
    "• 인터뷰 시작 — 질문 묶음(3~4개, 여러 파트, 새 제안 포함)을 보내요\n"
    "• 답은 A2 B1 C직접문장 처럼 보내요. 노트에 반영하고 다음 묶음을 보내요\n"
    "• 패스 / 다음 — 이 묶음(또는 D패스처럼 한 질문)은 건너뛰어요\n"
    "• /status — 상태 보기\n"
    "• /reset — 대화 맥락을 새로 시작"
)

TOKEN = None
_stop = threading.Event()
_busy = threading.Event()
_pending = []
_cond = threading.Condition()
_log_lock = threading.Lock()


# ---------- 유틸 ----------
def scrub(text):
    s = str(text)
    return s.replace(TOKEN, "<토큰>") if TOKEN else s


def log(msg):
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {scrub(msg)}"
    with _log_lock:
        print(line, flush=True)
        try:
            STATE.mkdir(parents=True, exist_ok=True)
            with open(STATE / "bridge.log", "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except OSError:
            pass


def load_token():
    t = os.environ.get("TELEGRAM_BOT_TOKEN")
    if t:
        return t.strip()
    try:
        for line in (STATE / ".env").read_text(encoding="utf-8").splitlines():
            if line.startswith("TELEGRAM_BOT_TOKEN="):
                return line.split("=", 1)[1].strip()
    except OSError:
        pass
    return None


def allowed_ids():
    ids = {x for x in os.environ.get("BRIDGE_ALLOWED_IDS", "").replace(",", " ").split() if x}
    try:
        data = json.loads((STATE / "access.json").read_text(encoding="utf-8"))
        ids |= {str(x) for x in data.get("allowFrom", [])}
    except (OSError, ValueError):
        pass
    return ids


def split_text(text, limit=MAX_LEN):
    text = text.strip() or "(빈 응답)"
    chunks, cur = [], ""
    for line in text.split("\n"):
        while len(line) > limit:                 # 한 줄이 너무 길면 강제로 자른다
            if cur:
                chunks.append(cur)
                cur = ""
            chunks.append(line[:limit])
            line = line[limit:]
        if len(cur) + len(line) + 1 > limit and cur:
            chunks.append(cur)
            cur = line
        else:
            cur = f"{cur}\n{line}" if cur else line
    if cur:
        chunks.append(cur)
    return chunks


def parse_json_output(stdout):
    stdout = (stdout or "").strip()
    if not stdout:
        return None
    try:
        return json.loads(stdout)
    except ValueError:
        pass
    for line in reversed(stdout.splitlines()):
        line = line.strip()
        if line.startswith("{"):
            try:
                return json.loads(line)
            except ValueError:
                continue
    return None


# ---------- 텔레그램 API ----------
def api(method, params=None, timeout=30):
    req = urllib.request.Request(
        f"{API_BASE}/bot{TOKEN}/{method}",
        json.dumps(params or {}).encode(),
        {"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        try:
            j = json.loads(body)
        except ValueError:
            j = {"ok": False, "description": body[:200]}
        j["_http"] = e.code
        return j


def send(chat_id, text):
    for chunk in split_text(text):
        for attempt in range(3):
            r = api("sendMessage", {"chat_id": chat_id, "text": chunk, "disable_web_page_preview": True})
            if r.get("ok"):
                break
            if r.get("_http") == 429:
                time.sleep(int((r.get("parameters") or {}).get("retry_after", 2)) + 1)
                continue
            log(f"sendMessage 실패: {r.get('description')}")
            break


class Typing(threading.Thread):
    """Claude가 일하는 동안 '입력 중…' 표시를 유지한다."""

    def __init__(self, chat_id):
        super().__init__(daemon=True)
        self.chat_id, self.stop_ev = chat_id, threading.Event()

    def run(self):
        while not self.stop_ev.is_set():
            try:
                api("sendChatAction", {"chat_id": self.chat_id, "action": "typing"}, timeout=10)
            except Exception:
                pass
            self.stop_ev.wait(4)


# ---------- Claude 호출 ----------
def session_get():
    try:
        return json.loads((STATE / "bridge-session.json").read_text(encoding="utf-8")).get("session_id")
    except (OSError, ValueError):
        return None


def session_set(sid):
    STATE.mkdir(parents=True, exist_ok=True)
    p = STATE / "bridge-session.json"
    if sid:
        p.write_text(json.dumps({"session_id": sid}), encoding="utf-8")
        os.chmod(p, 0o600)
    elif p.exists():
        p.unlink()


def run_claude(prompt):
    """(답장 텍스트, 성공 여부)"""
    for attempt in range(2):
        sid = session_get()
        # dontAsk: 허용 목록(.claude/settings.local.json)에 없는 도구는 묻지 않고 거부한다 (허용 목록이 곧 울타리)
        cmd = [CLAUDE, "-p", "--permission-mode", "dontAsk", "--output-format", "json", "--append-system-prompt", SYSTEM]
        if sid:
            cmd += ["--resume", sid]
        try:
            proc = subprocess.run(cmd, input=prompt, cwd=REPO, capture_output=True, text=True, timeout=CLAUDE_TIMEOUT)
        except subprocess.TimeoutExpired:
            return ("시간이 너무 오래 걸려서 멈췄어요. 같은 내용을 다시 보내 주세요.", False)
        except OSError as e:
            return (f"Claude를 실행하지 못했어요: {scrub(e)}", False)
        out = parse_json_output(proc.stdout)
        if out and not out.get("is_error") and proc.returncode == 0:
            if out.get("session_id"):
                session_set(out["session_id"])
            return ((out.get("result") or "").strip() or "(빈 응답)", True)
        blob = scrub(f"{proc.stdout}\n{proc.stderr}")
        if sid and attempt == 0 and "No conversation found" in blob:
            log("이전 세션을 이어갈 수 없어 새 세션으로 다시 시도")
            session_set(None)
            continue
        log(f"claude 오류 code={proc.returncode}: {blob[:300]}")
        return ("처리 중 오류가 났어요. 잠시 뒤에 다시 보내 주세요.", False)
    return ("처리 중 오류가 났어요.", False)


# ---------- 작업 스레드 ----------
def worker():
    while not _stop.is_set():
        with _cond:
            while not _pending and not _stop.is_set():
                _cond.wait(1)
            if _stop.is_set():
                return
            batch = _pending[:]
            _pending.clear()
        chat_id = batch[-1]["chat"]
        text = "\n\n".join(b["text"] for b in batch)
        if len(batch) > 1:
            text = f"(연속으로 {len(batch)}개의 메시지가 왔어요. 순서대로 읽어 주세요)\n\n{text}"
        _busy.set()
        typing = Typing(chat_id)
        typing.start()
        started = time.time()
        try:
            reply, ok = run_claude(text)
        finally:
            typing.stop_ev.set()
            _busy.clear()
        log(f"처리 완료 ok={ok} 입력={len(text)}자 답장={len(reply)}자 {time.time() - started:.1f}초")
        send(chat_id, reply)


# ---------- 메시지 수신 ----------
def handle_message(msg, counters):
    sender = str((msg.get("from") or {}).get("id", ""))
    chat = msg.get("chat") or {}
    if chat.get("type") != "private" or sender not in allowed_ids():
        counters["dropped"] += 1
        return
    text = msg.get("text")
    if not text:
        send(chat["id"], "텍스트 메시지만 읽을 수 있어요.")
        return
    text = text.strip()[:MAX_INPUT]
    low = text.lower()
    if low in ("/start", "/help"):
        send(chat["id"], HELP)
    elif low in ("/reset", "초기화"):
        session_set(None)
        send(chat["id"], "대화 맥락을 새로 시작했어요. '인터뷰 시작'이라고 보내 주세요.")
    elif low == "/status":
        sid = session_get()
        with _cond:
            n = len(_pending)
        send(chat["id"], f"브리지 동작 중\n처리 중: {'예' if _busy.is_set() else '아니오'}\n대기: {n}개\n세션: {(sid or '없음')[:8]}")
    else:
        with _cond:
            _pending.append({"chat": chat["id"], "text": text})
            _cond.notify()


def poll_loop():
    off_file = STATE / "bridge-offset"
    try:
        offset = int(off_file.read_text().strip())
    except (OSError, ValueError):
        offset = None
    counters = {"dropped": 0}
    warned_conflict = False
    while not _stop.is_set():
        params = {"timeout": POLL_TIMEOUT, "allowed_updates": ["message"]}
        if offset is not None:
            params["offset"] = offset
        try:
            r = api("getUpdates", params, timeout=POLL_TIMEOUT + 15)
        except Exception as e:
            log(f"getUpdates 네트워크 오류: {scrub(e)}")
            _stop.wait(5)
            continue
        if not r.get("ok"):
            if r.get("_http") == 409:
                if not warned_conflict:
                    log("409 충돌: 같은 봇을 다른 곳(예: 채널 세션·텔레그램 플러그인)이 받고 있어요. 그쪽을 끄면 자동으로 이어져요.")
                    warned_conflict = True
                _stop.wait(15)
            else:
                log(f"getUpdates 실패: {r.get('description')}")
                _stop.wait(5)
            continue
        warned_conflict = False
        for u in r.get("result", []):
            offset = u["update_id"] + 1
            try:
                off_file.write_text(str(offset))
            except OSError:
                pass
            if u.get("message"):
                try:
                    handle_message(u["message"], counters)
                except Exception as e:  # 한 메시지 때문에 전체가 죽지 않게
                    log(f"메시지 처리 오류: {scrub(e)}")
        if counters["dropped"]:
            log(f"허용되지 않은 발신자/대화의 메시지 {counters['dropped']}건 무시")
            counters["dropped"] = 0


# ---------- 시작 ----------
def main():
    global TOKEN
    TOKEN = load_token()
    if not TOKEN:
        sys.exit("토큰이 없어요. ~/.claude/channels/telegram/.env 에 TELEGRAM_BOT_TOKEN=... 을 넣어 주세요.")
    ids = allowed_ids()
    if not ids:
        sys.exit("허용된 사용자 ID가 없어요. access.json 의 allowFrom 또는 BRIDGE_ALLOWED_IDS 를 설정해 주세요.")
    STATE.mkdir(parents=True, exist_ok=True)
    pid_file = STATE / "bridge.pid"
    try:
        old = int(pid_file.read_text().strip())
        if old != os.getpid():
            os.kill(old, 0)
            sys.exit(f"이미 브리지가 실행 중이에요 (pid {old}).")
    except (OSError, ValueError):
        pass
    pid_file.write_text(str(os.getpid()))

    me = api("getMe")
    if not me.get("ok"):
        sys.exit(f"토큰 확인 실패: {me.get('description')}")
    log(f"브리지 시작: @{me['result'].get('username')} · 허용 사용자 {len(ids)}명 · 작업 폴더 {REPO}")

    def stop(*_):
        _stop.set()
        with _cond:
            _cond.notify_all()
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    threading.Thread(target=worker, daemon=True).start()
    if os.environ.get("BRIDGE_NOTIFY_START", "1") != "0":
        for uid in ids:
            send(uid, "브리지가 켜졌어요. '인터뷰 시작'이라고 보내 주세요.\n(/help 로 사용법)")
    try:
        poll_loop()
    finally:
        try:
            if pid_file.read_text().strip() == str(os.getpid()):
                pid_file.unlink()
        except OSError:
            pass
        log("브리지 종료")


if __name__ == "__main__":
    main()
