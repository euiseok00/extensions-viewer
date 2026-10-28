# 05. 구현 단계와 리스크

> 역할: 어떤 순서로 만들고 어떻게 검증하는지, 아직 모르는 것이 무엇인지를 관리한다.

## 구현 단계

4단계로 나누며, 각 단계는 검증을 통과해야 다음으로 넘어간다.

| 단계 | 내용 | 검증 |
|---|---|---|
| 1 | 수집기 3종 + 마스킹 (CLI로 실행해 JSON 출력) | 샘플 설정 파일 픽스처로 단위 테스트, 비밀값이 출력에 남지 않는지 확인 |
| 2 | 보안 서버 + 화면 | 토큰 없음 403, 잘못된 Host 403, 정상 200, 유휴 종료 (`04-security.md` 검증 항목) |
| 3 | 런처 + `/extensions-viewer` 스킬 | 실제 Claude Code에서 URL이 출력되고, 다시 실행해도 서버가 재사용됨 |
| 4 | 크로스 플랫폼 확인 | macOS, Linux, Windows에서 분리 기동과 경로 처리 확인 |
| 5 | UI 개선: 포함관계, 필터, 상세 패널 (`02-requirements.md` F7~F11, `07-ui-design.md`) | 수집기가 `parent`를 채우는지 단위 테스트, 필터·트리 순수 함수 `node:test`, 브라우저에서 키보드·다크 모드·빈 상태 수동 확인, `innerHTML` 금지 검사 유지 |

1~2단계는 샌드박스에서 실행·테스트할 수 있고, 3~4단계는 사용자 PC에서 직접 확인해야 한다.
MVP가 로컬 테스트를 통과하면 `06-release-plan.md`의 공개 준비로 넘어간다.

## 리스크와 미확인 사항

조사로는 확정하지 못했고, 구현 시작 전에 실험이나 결정이 필요하다.

| 항목 | 내용 | 확인 방법 |
|---|---|---|
| 현재 프로젝트 경로 | 런처는 `process.cwd()`를 프로젝트로 본다. 공식 문서상 `!` 명령은 세션 셸의 현재 디렉터리에서 실행되며 Claude가 `cd`하면 바뀔 수 있다. 실제 값은 미확인 | 실제 Claude Code에서 스킬 실행 후 URL의 서버가 보는 프로젝트(MCP·스킬 범위)가 맞는지 확인 |
| 빌드 결과 위치 | 스킬 폴더에 빌드 결과를 포함하는 방식으로 구현(`npm run bundle`, `${CLAUDE_SKILL_DIR}` 사용). 샌드박스에서는 동작 확인, 실제 Claude Code에서는 미확인. `npx` 방식은 미시험 | 실제 Claude Code에서 `/extensions-viewer` 실행 |
| `!` 명령 자동 실행 | 실제 Claude Code에서 `/extensions-viewer`를 실행하니 `!` 줄이 실행 결과로 치환되지 않고 "run this first, exactly as written…" 지시문으로 들어왔고, Claude가 명령을 Bash로 대신 실행해 URL이 나왔다. 원인(버전, 설정, 권한 등)은 미확인이며, 이 경로로는 Claude를 거치므로 Bash 권한 허용 여부에 따라 동작이 달라질 수 있다 | 원인 조사. `allowed-tools: Bash(...)` 지정 효과와 다른 버전·설정에서의 동작을 시험하고, SKILL.md 본문이 두 경우 모두 URL 한 줄만 답하는지 확인 |
| `claude mcp list` | JSON 출력 여부 불명, 연결 상태 확인이 느릴 수 있음 | 버전별 `--help` 확인 |
| 스킬 목록 | 공식 목록 CLI를 찾지 못해 폴더 스캔에 의존, 버전 변경에 취약 | 스캔 실패 시 F6로 오류 표시 |
| 실제 로드 상태 | 화면은 설정 기준이라 지금 세션에 로드된 것과 다를 수 있음 | 화면에 "설정 파일 기준" 라벨 표시 |
| macOS·Linux | 확인 완료: CI(ubuntu·macos·windows × Node 22·24) 6개 조합 통과. macOS는 tmpdir이 심볼릭 링크라 테스트에서 실제 경로를 써야 했음 | 해당 없음 |
| Windows | 확인 완료: 분리 기동 후 부모 종료·재사용 동작, `claude` CLI는 호출하지 않아 `.cmd` 문제 없음 | 해당 없음 |
| Node 최소 버전 | 22 이상으로 결정(Node 20은 EOL 시점이 2026-04로 알려져 제외, 공식 일정은 미확인). Node 22·24는 CI에서 통과. `node --test` glob 처리가 버전마다 달라 `scripts/run-tests.mjs`가 파일 목록을 직접 넘김 | nodejs.org 일정 확인 |
| 마스킹 한계 | 알려진 접두사·이름 규칙 밖의 임의 문자열 비밀은 `args`·`command`에서 걸러지지 않음 (규칙은 `04-security.md`) | 실제 MCP 설정으로 사례를 모아 규칙 보강 |
| 수집 범위 (단계 1 구현) | `claude plugin list --json`은 쓰지 않고 `installed_plugins.json`과 `enabledPlugins`만 읽음. `~/.claude.json`의 프로젝트 키는 Windows에서 슬래시 구분이고 드라이브 문자 대소문자가 섞여 있음을 확인(정규화해 비교) | 버전별 CLI `--help`와 실제 파일로 확인 |
| 상태 파일 권한 (Windows) | 0600이 Windows에서 적용되지 않음 | 해결: 프로필 폴더 상속 ACL 확인 후 검증 항목을 플랫폼별로 분리 (`04-security.md`) |
| 서버 재사용 판별 | pid만으로는 오래된 pid를 구분 못 함 | 구현 완료: 토큰 접속 헬스체크로 판별 (`04-security.md`) |
| MCP 활성 여부 | 구현함. 규칙은 공식 문서(MCP 설정 페이지, 앞 10만 자만 읽음) 기준이다. 사용자·로컬 서버는 `~/.claude.json` 프로젝트 항목의 `disabledMcpServers`에 없으면 활성, `.mcp.json` 서버는 `disabledMcpjsonServers`면 비활성·`enableAllProjectMcpServers` 또는 `enabledMcpjsonServers`면 활성·그 외 승인 대기(알 수 없음), 플러그인 서버는 플러그인 상태를 따르고 `disabledMcpServers`에 있으면 비활성. 한계: 플러그인 서버가 그 목록에 어떤 이름으로 적히는지 미확인(서버 이름만 비교), 신뢰하지 않는 폴더에서는 프로젝트 설정의 승인이 무시된다는 규칙은 미반영, 실제 연결 상태는 아님, 이 PC에는 비활성 사례가 없어 실데이터로는 활성 경로만 확인 | `/mcp`에서 서버를 끈 뒤 실제 파일의 목록 이름 확인 |
| Claude CLI 보강 (구현함) | `claude plugin list --json`의 켜짐 여부로 파일 값을 덮어쓰고, `claude plugin details <id>`의 구성 목록(스킬·에이전트·훅·MCP·LSP 개수)과 상시 토큰 비용을 상세에 더한다. MCP는 화면의 "연결 상태 확인" 버튼을 눌렀을 때만 `claude mcp list`를 실행해(수 초, 켜진 서버를 실제로 띄움) 연결 상태를 합치고, 설정 파일에 없는 서버(claude.ai 커넥터)는 범위를 알 수 없는 항목으로 더한다. CLI가 없거나 실패하면 파일 값만 쓴다. 한계: `plugin details`는 JSON이 없어 글자를 파싱하므로 형식이 바뀌면 그 항목이 비고, `claude mcp list`의 상태 글자(`✔ Connected` 외)는 형식을 일부만 봤다. 결과는 30초간 기억한다 | 다른 Claude Code 버전에서 출력 형식 확인 |
| 플러그인 `commands/` | CLI의 스킬 개수와 대조해, 플러그인의 `commands/*.md`도 스킬로 세야 함을 확인해 반영했다(`caveman-init`, 23개로 일치). 사용자·프로젝트의 `.claude/commands/`도 같은지는 확인하지 못해 아직 스캔하지 않는다 | 사용자 `.claude/commands/`에 파일을 두고 `/skills` 결과와 대조 |
| 다른 에이전트 지원 (설계만) | Codex 등은 설정 위치·형식이 달라 명령 출력 방식은 이식되지 않는다. 방향: 에이전트를 코드가 아니라 데이터로 두고, 수집기를 형식별로 나눈다(스킬 폴더 스캐너, MCP JSON·TOML 읽기, 플러그인 매니페스트 읽기). 각 에이전트는 "어느 경로를 어느 형식으로"를 적은 설정 항목이며, 공통 모델 `Extension`에 `agent` 필드를 더한다. CLI 출력은 에이전트별 보강으로만 쓴다. 공통으로 뽑을 수 없는 것은 지금 로드된 상태다. 미확인: Codex의 실제 경로·형식(`taste-skill` 저장소의 `.codex-plugin/`, `.agents/plugins/`로 플러그인 형식이 있다는 정황만 봄), 스킬 형식의 에이전트 간 호환 범위, 의존성 0 원칙에서 TOML 파서를 어디까지 직접 만들지. 현재 확정 범위(Claude Code)를 벗어나므로 MVP 이후 | Codex 설치본의 설정 파일을 직접 열어 확인 |
| `claude` CLI 지연·실패 | 2초 목표 대비 느리거나 JSON 출력이 없을 수 있음. Windows에서 `.cmd` 래퍼면 셸 없는 `execFile`이 실패할 수 있음(미확인) | 타임아웃과 `settings.json` 대체는 `04-security.md` 참고. Windows 실행은 단계 4에서 시험 |
| 명령 이름 충돌 | 내장 명령과 이름이 겹치면 한쪽이 가려질 수 있음. `extensions-viewer`는 충돌 가능성이 낮다고 판단하나 확인 필요 | 내 버전의 `/help`와 `/` 자동완성에서 확인 |
