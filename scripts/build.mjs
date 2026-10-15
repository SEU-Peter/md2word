import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
await mkdir(dist, { recursive: true });
await build({
  entryPoints: [path.join(root, 'web/main.mjs')],
  outfile: path.join(dist, 'app.js'),
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2020'],
});
const app = await readFile(path.join(dist, 'app.js'));
const version = createHash('sha256').update(app).digest('hex').slice(0, 12);
const [template, source] = await Promise.all([
  readFile(path.join(root, 'templates/page.html'), 'utf8'),
  readFile(path.join(root, 'templates/example.md'), 'utf8'),
]);
const escaped = source.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const html = template
  .replace('__NOTICE__', '')
  .replace('__SOURCE__', escaped)
  .replace('__STATIC_SCRIPT__', `<script src="./app.js?v=${version}" defer></script>`)
  .replace('action="/generate"', 'action="#"');
await writeFile(path.join(dist, 'index.html'), html);
await writeFile(path.join(dist, '.nojekyll'), '');
