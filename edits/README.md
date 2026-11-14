# edits — 사이트에서 내보낸 수정 파일

세계관 노트 사이트에서 **✎ 편집 모드**로 고친 뒤 **변경 내용 내보내기 › 파일로 저장**으로 받은 `world-edits-*.json` 을 여기에 올린다.
(GitHub 웹에서 이 폴더로 들어가 "Add file › Upload files")

반영은 Claude가 한다:
```
node scripts/apply-world-edits.js edits/<파일> --dry-run     # 미리보기 (아무것도 바꾸지 않음)
node scripts/apply-world-edits.js edits/<파일>               # 반영. 겹치는 것은 보류하고 알려 줌 (기본)
node scripts/apply-world-edits.js edits/<파일> --prefer mine # 겹치면 수정 파일 우선
node scripts/apply-world-edits.js edits/<파일> --prefer data # 겹치면 data.js 현재 내용 우선
```
처리한 파일은 `edits/applied/` 로 옮겨지고 `docs/edit-log.md` 에 기록된다.

## 전달 방법 (세 가지 모두 쓸 수 있다)
- **A. 이 폴더에 올리기**: 사이트에서 "파일로 저장" → GitHub 웹에서 이 폴더에 업로드. Claude 가 가져와 반영한다.
- **B. 텔레그램**: "텔레그램용 나눠 복사"한 `#WE` 조각을 순서대로 보내고 미리보기 뒤에 `반영`. (브리지가 직접 처리)
- **C. 작업 대화창**: JSON 을 붙여 넣거나 파일 경로를 알려 준다.

