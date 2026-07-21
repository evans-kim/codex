import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const files = [
  'index.html',
  '404.html',
  'styles',
  'manifest.webmanifest',
  'sw.js',
  '.nojekyll',
  'js',
  'assets'
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of files) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}

console.log(`Prepared GitHub Pages artifact at ${output}`);
