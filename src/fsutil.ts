import { readFile, readdir } from 'node:fs/promises';

// 파일이 없으면 undefined, JSON이 깨졌으면 예외를 던진다(수집기가 error로 보고).
export async function readJson(file: string): Promise<any | undefined> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw e;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON 파싱 실패: ${file}`);
  }
}

// 디렉터리가 없으면 빈 배열.
export async function listDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}
