import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
await mkdir(dist, { recursive: true });
const [template, source] = await Promise.all([
  readFile(path.join(root, 'templates/page.html'), 'utf8'),
  readFile(path.join(root, 'templates/example.md'), 'utf8'),
]);
const escaped = source.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const html = template
  .replace('__NOTICE__', '')
  .replace('__SOURCE__', escaped)
  .replace('__STATIC_SCRIPT__', '<script src="./app.js" defer></script>')
  .replace('action="/generate"', 'action="#"');
await writeFile(path.join(dist, 'index.html'), html);
await writeFile(path.join(dist, '.nojekyll'), '');
await build({
  entryPoints: [path.join(root, 'web/main.mjs')],
  outfile: path.join(dist, 'app.js'),
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2020'],
});
