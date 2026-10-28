# extensions-viewer — 작업 지침

Claude Code의 스킬·MCP·플러그인 3종을 **읽기 전용 로컬 웹 화면**으로 한눈에 보여주는 도구다.
이 파일은 구현을 맡은 Claude Code가 먼저 읽는 규칙 요약이며, 자세한 내용은 `docs/`에 있다.

## 확정 사항

- 레포·명령 이름: `extensions-viewer` / `/extensions-viewer`
- 스킬 폴더: `.claude/skills/extensions-viewer/`
- 스택: Node.js + TypeScript(strict). 런타임 외부 패키지 0개, 내장 모듈만 사용한다.
- 개발 의존성은 `typescript`, `@types/node`만 허용한다.
- MVP는 읽기 전용이다. 사용자의 설정 파일을 절대 수정하지 않는다.
- DB를 쓰지 않는다. 설정 파일이 진실의 원천이다.
- 진행 순서: 로컬 MVP 테스트 → 공개 준비 → GitHub 공개

## 반드시 지킬 규칙

1. 코드 주석은 한국어로 쓴다.
2. 서버는 `127.0.0.1`에만 바인딩하고, 모든 요청에서 토큰과 Host를 검증한다. (`docs/04-security.md`)
3. MCP `env`·`headers` 값 같은 비밀값은 응답에 담기 전에 반드시 마스킹한다.
4. 화면은 `textContent`만 쓰고 `innerHTML`은 쓰지 않는다. 플러그인·스킬 메타데이터는 신뢰할 수 없는 입력이다.
5. 외부 CLI는 `execFile`로만 호출한다. 셸을 거치지 않는다.
6. 수집기 하나가 실패해도 나머지는 표시한다.
7. 확인하지 못한 사실을 단정하지 않는다. 불확실한 내용은 `docs/05-roadmap.md`의 미확인 표에 추가한다.

## 작업 순서

`docs/05-roadmap.md`의 단계 1→4를 따르고, 이후 UI 개선(단계 5)은 `docs/07-ui-design.md`를 따른다. 각 단계의 검증을 통과해야 다음 단계로 넘어간다.

## 문서 지도

| 파일 | 역할 | 언제 읽나 |
|---|---|---|
| `docs/01-overview.md` | 목표, 결정 사항, MVP 범위, 성공 기준 | 처음 시작할 때 |
| `docs/02-requirements.md` | 기능·비기능 요구사항과 수용 기준 | 기능을 구현할 때 |
| `docs/03-architecture.md` | 기술환경, 구성 요소, 요청 흐름, 데이터 모델, 디렉터리 | 구조를 잡을 때 |
| `docs/04-security.md` | 위협별 대응과 보안 검증 항목 | 서버·수집기를 만들 때 |
| `docs/05-roadmap.md` | 구현 단계, 검증 기준, 리스크·미확인 사항 | 작업 계획을 세울 때 |
| `docs/06-release-plan.md` | 유사 도구 비교, 공개 체크리스트, 출처 | 공개를 준비할 때 |
| `docs/07-ui-design.md` | 화면 구성, 상호작용, 시각 규칙, 구현 영향 | UI를 만들거나 바꿀 때 |
