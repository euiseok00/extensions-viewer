import { homedir } from 'node:os';
import { collectAll } from './collect.js';

console.log(JSON.stringify(await collectAll({ home: homedir(), cwd: process.cwd() }), null, 2));
