import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MENUS } from '../js/menus.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function exists(relativePath) {
  await access(path.join(root, relativePath.replace(/^\.\//, '')));
}

test('메뉴 ID와 이미지 경로가 모두 고유하고 파일이 존재한다', async () => {
  assert.equal(MENUS.length, 30);
  assert.equal(new Set(MENUS.map((menu) => menu.id)).size, MENUS.length);
  assert.equal(new Set(MENUS.map((menu) => menu.image)).size, MENUS.length);
  await Promise.all(MENUS.map((menu) => exists(menu.image)));
});

test('HTML의 주요 정적 자산과 PWA 아이콘이 존재한다', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /lang="ko"/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /type="module"/);

  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  await Promise.all(manifest.icons.map((icon) => exists(icon.src)));
});

test('Service Worker 앱 셸에 모든 메뉴 이미지가 포함된다', async () => {
  const worker = await readFile(path.join(root, 'sw.js'), 'utf8');
  for (const menu of MENUS) {
    assert.ok(worker.includes(menu.image), `${menu.image} is not precached`);
  }
  assert.match(worker, /caches\.open/);
  assert.match(worker, /event\.request\.mode === 'navigate'/);
});

test('브라우저 런타임 파일은 외부 URL을 요청하지 않는다', async () => {
  const runtimeFiles = [
    'index.html', 'manifest.webmanifest', 'sw.js',
    'styles/base.css', 'styles/content.css', 'styles/overlays.css', 'styles/responsive.css',
    'js/app.js', 'js/app-context.js', 'js/app-view.js', 'js/app-actions.js',
    'js/menu-options.js', 'js/menu-catalog-a.js', 'js/menu-catalog-b.js',
    'js/menus.js', 'js/recommendation.js', 'js/storage.js'
  ];
  for (const file of runtimeFiles) {
    const content = await readFile(path.join(root, file), 'utf8');
    assert.doesNotMatch(content, /(?:src|href)=["']https?:\/\//i, `${file} contains an external asset`);
    assert.doesNotMatch(content, /(?:fetch|importScripts)\s*\(\s*["']https?:\/\//i, `${file} performs an external request`);
    assert.doesNotMatch(content, /url\(\s*["']?https?:\/\//i, `${file} contains an external CSS URL`);
  }
});
