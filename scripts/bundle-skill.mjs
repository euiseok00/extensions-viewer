// 빌드 결과와 SKILL.md를 스킬 폴더 하나로 묶는다. 사용법: node scripts/bundle-skill.mjs [대상 폴더]
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const target = resolve(process.argv[2] ?? '.claude/skills/extensions-viewer');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp('skill/extensions-viewer/SKILL.md', `${target}/SKILL.md`);
await cp('dist/src', `${target}/dist/src`, { recursive: true });
await cp('src/ui', `${target}/src/ui`, { recursive: true });
// 스킬 폴더에는 상위 package.json이 없어서, ESM으로 읽히도록 직접 둔다.
await writeFile(`${target}/package.json`, '{"type":"module"}\n');
console.log(`bundled: ${target}`);
