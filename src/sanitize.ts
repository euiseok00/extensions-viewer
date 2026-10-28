// 비밀값 마스킹. 규칙은 docs/04-security.md 참고.
export const MASK = '***';

// 이름에 이 단어가 들어 있으면 값을 비밀로 본다.
const SECRET_NAME = /(token|secret|passw(or)?d|api[-_]?key|apikey|auth|credential|bearer|private[-_]?key|session|cookie)/i;

// 값 모양만 보고 비밀로 판단하는 접두사.
// shortcut: 알려진 접두사만 잡는다. 임의 문자열 키는 이름 기준으로만 걸러진다.
const SECRET_VALUE = /^(sk-|ghp_|gho_|ghs_|github_pat_|xox[abprs]-|AKIA|eyJ|Bearer\s)/;

export function looksSecret(value: string): boolean {
  return SECRET_VALUE.test(value);
}

// env·headers는 값을 절대 내보내지 않고 키 이름만 낸다.
export function keyNames(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return '';
  return Object.keys(obj).join(', ');
}

// args: --token X, --token=X, KEY=VALUE, 토큰 모양 값을 가린다.
export function maskArgs(args: string[]): string[] {
  const out: string[] = [];
  let maskNext = false;
  for (const a of args) {
    if (maskNext) {
      out.push(MASK);
      maskNext = false;
      continue;
    }
    const eq = a.indexOf('=');
    if (a.startsWith('-') && eq === -1) {
      out.push(a);
      maskNext = SECRET_NAME.test(a);
    } else if (eq > 0 && (SECRET_NAME.test(a.slice(0, eq)) || looksSecret(a.slice(eq + 1)))) {
      out.push(`${a.slice(0, eq + 1)}${MASK}`);
    } else {
      out.push(looksSecret(a) ? MASK : maskUrl(a));
    }
  }
  return out;
}

// URL: userinfo와 쿼리·프래그먼트 값을 모두 가린다. URL이 아니면 그대로 둔다.
export function maskUrl(s: string): string {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s;
  return s
    .replace(/\/\/[^/@\s]*@/, `//${MASK}@`)
    .replace(/([?&#][^=&#]*=)[^&#]*/g, `$1${MASK}`);
}

// command 문자열 하나를 가린다.
export function maskCommand(s: string): string {
  return looksSecret(s) ? MASK : maskUrl(s);
}
