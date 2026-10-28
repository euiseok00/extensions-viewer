// 컴파일된 테스트 파일을 명시적으로 넘겨 실행한다.
// node --test의 glob·디렉터리 인자 처리가 Node 버전과 셸마다 달라서 파일 목록을 직접 만든다.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const files = readdirSync('dist/test').filter((f) => f.endsWith('.test.js')).map((f) => `dist/test/${f}`);
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
