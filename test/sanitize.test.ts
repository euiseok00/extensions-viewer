import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyNames, maskArgs, maskCommand, maskUrl } from '../src/sanitize.js';

test('keyNames: 키 이름만 내고 값은 버린다', () => {
  assert.equal(keyNames({ API_KEY: 'FAKE_SECRET', B: 'x' }), 'API_KEY, B');
  assert.equal(keyNames(undefined), '');
});

test('maskArgs: 비밀 플래그의 다음 값과 =값을 가린다', () => {
  assert.deepEqual(maskArgs(['--token', 'FAKE1', '--name', 'ok']), ['--token', '***', '--name', 'ok']);
  assert.deepEqual(maskArgs(['--api-key=FAKE2']), ['--api-key=***']);
  assert.deepEqual(maskArgs(['GITHUB_TOKEN=FAKE3']), ['GITHUB_TOKEN=***']);
});

test('maskArgs: 토큰 모양 값과 URL 쿼리를 가린다', () => {
  assert.deepEqual(maskArgs(['sk-FAKEKEY', 'https://h/x?key=FAKE4&a=1']), ['***', 'https://h/x?key=***&a=***']);
});

test('maskUrl: userinfo와 쿼리 값을 가린다', () => {
  assert.equal(maskUrl('https://user:FAKE5@h.example/p?k=FAKE6'), 'https://***@h.example/p?k=***');
  assert.equal(maskUrl('not a url'), 'not a url');
});

test('maskCommand: 토큰 모양 command를 가린다', () => {
  assert.equal(maskCommand('ghp_FAKE7'), '***');
  assert.equal(maskCommand('npx'), 'npx');
});
