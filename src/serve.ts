import { homedir } from 'node:os';
import { startServer } from './server.js';

// 단계 2 수동 확인용. 런처(단계 3)가 이 역할을 대신한다.
const { port, token } = await startServer({ ctx: { home: homedir(), cwd: process.cwd() } });
console.log(`http://127.0.0.1:${port}/?t=${token}`);
