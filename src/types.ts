import type { Cli } from './claudeCli.js';

// 확장 기능 공통 모델 (수집기 3종이 모두 이 형식으로 반환)
export type Extension = {
  kind: 'plugin' | 'mcp' | 'skill';
  name: string;
  scope: 'user' | 'project' | 'local' | 'plugin' | 'unknown';
  source: string; // 읽은 위치(파일 경로)
  enabled: boolean | null; // 설정 파일 기준 활성 여부, 알 수 없으면 null
  detail: Record<string, string>; // 마스킹이 끝난 값만 담는다
  parent?: string; // 플러그인 유래 스킬·MCP의 플러그인 id
};

// 수집기 결과: 실패해도 전체를 막지 않도록 오류를 함께 담는다
export type CollectResult = {
  items: Extension[];
  error?: string;
};

// 수집기가 읽을 위치. 테스트에서 임시 디렉터리를 주입할 수 있게 분리한다.
export type Context = {
  home: string;
  cwd: string;
  cli?: Cli; // 테스트에서 가짜 claude CLI를 주입한다
};
