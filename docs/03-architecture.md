# 03. 기술환경과 아키텍처

> 역할: 무엇으로 어떻게 만들지, 구성 요소가 어떻게 연결되는지를 정의한다.

## 기술환경

Node.js + TypeScript로 구현하되, 런타임에는 내장 모듈만 써서 공급망 위험을 줄인다.

| 영역 | 선택 | 사유 |
|---|---|---|
| 언어 | TypeScript (strict) | 타입 안정성 |
| 런타임 | Node.js 20 LTS 이상 (확정 전) | `node:test` 등 내장 기능 |
| 서버 | `node:http` | 외부 프레임워크 없이 라우트 2개만 필요 |
| 토큰 | `node:crypto` `randomBytes(32)` | 예측 불가능한 난수 |
| 외부 CLI 호출 | `node:child_process` `execFile` | 셸을 거치지 않아 명령 주입 차단 |
| 파일 읽기 | `node:fs/promises` | 설정 파일과 스킬 폴더 스캔 |
| 프런트엔드 | 순수 HTML + JS | CDN 없이 외부 요청 0건 |
| 빌드 | `tsc` (개발 전용) | 배포물은 컴파일된 JS |
| 테스트 | `node:test` | 추가 의존성 없음 |
| frontmatter 파싱 | 직접 구현(`name`, `description` 두 키만) | YAML 라이브러리를 피하되 복잡한 YAML은 미지원 |
| 배포 형태 | MVP는 스킬 폴더, 공개 시 npm·마켓플레이스 검토 | `06-release-plan.md` 참고 |

## 구성 요소

1. **스킬 `/extensions-viewer`**: `SKILL.md`에서 `!` 실행으로 런처를 호출한다.
2. **런처**: 상태 파일(pid, 포트, 토큰, 권한 0600)을 확인해 서버가 있으면 재사용하고, 없으면 분리(detach)해 기동한 뒤 URL만 출력하고 종료한다.
3. **로컬 서버**: `127.0.0.1` 랜덤 포트. 라우트는 `GET /`(화면)과 `GET /api/extensions`(JSON) 두 개다. 모든 요청이 보안 미들웨어를 거친다.
4. **수집기 3종**: 플러그인, MCP, 스킬을 병렬로 읽고 공통 형식으로 정규화한다.
5. **마스킹**: 정규화 결과에서 비밀값을 가린 뒤 응답한다.
6. **화면**: 순수 HTML+JS가 JSON을 받아 탭 3개로 그린다.

## 요청 흐름

1. 브라우저가 `GET /?t=토큰`을 요청한다.
2. 서버가 Host와 토큰을 검증하고, 통과하면 쿠키(HttpOnly, SameSite=Strict)를 설정해 URL의 토큰을 제거한다.
3. 화면이 `GET /api/extensions`를 호출한다.
4. 수집기 3종이 병렬 실행되고, 정규화·마스킹된 JSON이 반환된다.
5. 화면이 `textContent`로만 렌더링한다.

## DB를 쓰지 않는 이유

진실의 원천이 이미 설정 파일이라, 별도 저장소를 두면 복제본과의 동기화 문제만 생긴다.
데이터가 작아 요청마다 파일을 읽어도 충분하다. 저장하는 상태는 pid·포트·토큰을 담은 상태 파일 하나뿐이다.

## 데이터 모델

3종을 하나의 공통 형식으로 정규화해 화면과 API가 종류를 구분하지 않고 다룬다.

```ts
// 확장 기능 공통 모델 (수집기 3종이 모두 이 형식으로 반환)
type Extension = {
  kind: 'plugin' | 'mcp' | 'skill';
  name: string;
  scope: 'user' | 'project' | 'local' | 'plugin' | 'unknown';
  source: string;            // 읽은 위치(파일 경로 또는 CLI 명령)
  enabled: boolean | null;   // 설정 파일 기준 활성 여부, 알 수 없으면 null
  detail: Record<string, string>; // 버전, 전송 방식, 설명 등 (마스킹 후)
};

// 수집기 결과: 실패해도 전체를 막지 않도록 오류를 함께 담는다
type CollectResult = {
  items: Extension[];
  error?: string;
};
```

## 디렉터리 구조

```text
extensions-viewer/
  CLAUDE.md
  docs/                  # 이 문서들
  src/
    launcher.ts          # 상태 파일 확인, 서버 기동/재사용, URL 출력
    server.ts            # node:http 서버, 라우트 2개, 유휴 종료
    security.ts          # Host·토큰 검증, 보안 헤더
    sanitize.ts          # 비밀값 마스킹
    collectors/
      plugins.ts
      mcp.ts
      skills.ts
    ui/
      index.html
      app.js             # textContent만 사용
  test/                  # node:test 단위 테스트
  skill/extensions-viewer/SKILL.md   # 설치 시 .claude/skills/extensions-viewer/ 로 복사
  package.json
  tsconfig.json
```
