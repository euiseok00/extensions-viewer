import { homedir } from 'node:os';
import { startServer } from './server.js';
import { removeState, writeState } from './state.js';

// 런처가 분리해서 띄우는 서버 프로세스. 시작 디렉터리가 곧 대상 프로젝트다.
const cwd = process.cwd();
const { server, port, token } = await startServer({ ctx: { home: homedir(), cwd } });
await writeState({ pid: process.pid, port, token, cwd });

const stop = () => server.close();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
// 유휴 종료든 신호든 서버가 닫히면 상태 파일을 지운다.
server.on('close', () => void removeState(cwd, token));
