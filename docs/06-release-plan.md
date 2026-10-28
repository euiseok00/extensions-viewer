# 06. 공개 계획

> 역할: GitHub 오픈소스로 공개하기 전에 확인할 현실 점검, 차별화, 체크리스트, 출처를 모은다.
> 로컬 MVP가 성공 기준 4개(`01-overview.md`)를 통과한 뒤에 이 문서를 따른다.

## 공개 전 현실 점검: 유사 도구

Claude Code 관리 도구가 이미 여럿 있어서, 3종을 한 화면에 보여주는 것만으로는 차별점이 약하다.

| 도구 | 형태 | 특징 |
|---|---|---|
| claude-code-organizer | 웹 대시보드 | 메모리·스킬·MCP·훅·설정·플러그인을 범위별로 표시·관리 |
| CLACOROO | 데스크톱 앱 (AGPL-3.0) | 플러그인·스킬·에이전트·MCP·훅을 GUI로 관리 |
| claude-panel | 로컬 대시보드 (npm) | 설정·플러그인·MCP 관리, 토큰 분석 |
| claude-code-marketplace | 웹 대시보드 (`npx`, MIT) | 여러 마켓플레이스의 플러그인 탐색·설치 |
| mcp-manager 플러그인 | 웹 대시보드 | MCP 서버 ON/OFF, 도구 보기 |
| claude-code-config-manager | 웹 UI (npm) | 프로젝트·서브에이전트·명령·스킬·훅·MCP 조회 |

위 표는 검색 결과의 소개 문구 기준이며 원문을 직접 열어 확인하지 못했다.
공개 전에 2~3개를 직접 설치해 겹치는 기능과 빈틈을 비교한다.

### 차별화 후보 (제안, 미검증)

1. **읽기 전용 + 보안 우선**: 설정을 건드리지 않고 토큰·Host 검증·비밀값 마스킹을 갖췄다는 점이 신뢰 포인트가 될 수 있다.
2. **가벼움**: 런타임 의존성 0, `npx` 한 줄 실행.
3. **범위별 한눈에 보기**: 스킬·MCP·플러그인을 user/project/plugin 범위별로 보여준다. 위 도구와 겹칠 가능성이 커서 UI 품질이 관건이다.

## 공개 준비 체크리스트

README 항목은 다른 프로젝트 사례에서 공통으로 정리된 조언이다.

**README**

- [ ] 첫 2줄: "무엇인지 + 왜 필요한지"
- [ ] 데모 GIF(15~30초)와 스크린샷
- [ ] 복사해서 바로 실행되는 빠른 시작 1~2줄
- [ ] "읽기 전용, 로컬 전용, 비밀값 마스킹" 설명
- [ ] 영문 README 기본 + 한국어 README 병행 (제안)

**저장소**

- [ ] LICENSE (MIT 같은 허용적 라이선스, 선택 전 재검토)
- [ ] "Anthropic과 무관한 비공식 프로젝트이며 Claude는 Anthropic의 상표"라는 고지 (유사 도구들이 쓰는 방식)
- [ ] SECURITY.md, 이슈·PR 템플릿, CHANGELOG
- [ ] GitHub Topics, 릴리스 태그(`v0.1.0`)
- [ ] CI: `tsc` 빌드 + `node:test`
- [ ] 호환 Claude Code 버전과 OS 명시 (업데이트로 깨질 수 있음)

**공개 직전 보안 점검**

- [ ] 커밋 이력 전체에서 API 키·토큰·개인 경로 제거 (시크릿 스캔 도구 사용 권장)
- [ ] 테스트 픽스처에 실제 설정 파일을 복사하지 않기

**배포 채널**

- [ ] GitHub 저장소 (필수)
- [ ] npm 패키지: `npx extensions-viewer`로 설치 마찰 줄이기 (경쟁 도구들도 `npx` 실행을 쓴다)
- [ ] 자체 마켓플레이스: 저장소에 `.claude-plugin/marketplace.json`을 추가하면 별도 제출 없이 공개된다. 사용자는 `claude plugin marketplace add owner/repo` 뒤 설치한다. 배포 전 `claude plugin validate --strict`로 검증하고.
- [ ] Anthropic 디렉터리 제출은 유료 claude.ai 플랜이 필요하므로 후순위

**홍보**

- [ ] 출시를 한 번의 글이 아니라 순서로 계획(출시 글 → 후속 글), 출시 후에도 꾸준히 업데이트
- [ ] 스타 수 자체보다 작품이 눈에 띄게 하는 일에 집중, 스타 구매·교환은 제외

## 이름 메모

- 나중에 플러그인으로 감싸면 플러그인 스킬은 `플러그인이름:스킬이름` 형태로 호출된다. 플러그인 이름과 스킬 이름이 같으면 `/extensions-viewer:extensions-viewer`처럼 겹쳐 보이므로, 그때 스킬 이름을 따로 정한다.
- 플러그인 이름은 공개 후 바꾸면 기존 설치가 끊기므로 처음부터 영구 이름으로 정한다.

## 출처

조사 기준일은 2026-10-28이다.

**직접 열어 확인**

- [Publish and distribute a plugin](https://code.claude.com/docs/en/plugins/publish): 마켓플레이스 공개, 검증, 이름·버전 규칙, 디렉터리 제출 조건

**검색 결과 기준 (원문 미열람)**

- README·스타: [GitHub README Best Practices](https://dev.to/iris1031/github-readme-best-practices-how-to-write-a-readme-that-gets-stars-2gb2), [How I grew my open-source project to 1k stars](https://dev.to/m4xshen/how-i-grew-my-open-source-project-to-1k-stars-3mk2), [GitHub Star Growth: 7 Tactics](https://gingiris.github.io/growth-tools/blog/2026/04/22/github-star-growth-2026/), [Presenting open-sourced projects](https://newscatcherapi.com/blog/how-to-present-showcase-open-source-projects-practical-guide)
- 유사 도구: [claude-code-organizer](https://openskillindex.com/skills/mcpware-claude-code-organizer-organize), [CLACOROO](https://clacoroo-website.pages.dev/), [claude-panel](https://www.pkgstats.com/pkg:claude-panel), [claude-code-marketplace](https://nikiforovall.blog/claude-code-marketplace/), [mcp-manager 플러그인](https://sharedcontext.ai/plugins/external/sanjibdevnathlabs/claude-plugins-2), [claude-code-config-manager](https://www.pkgstats.com/pkg:claude-code-config-manager)
- 명령 이름 충돌·네임스페이스: [Claude Code skills 문서](https://code.claude.com/docs/en/skills?aff=86jEAz)
