import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import JSZip from 'jszip';
import { blobFromMarkdown, inlineSegments, parseMarkdown } from '../web/convert.mjs';

test('static page loads the exact version of the bundled converter', async () => {
  const [page, bundle] = await Promise.all([
    readFile(new URL('../dist/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../dist/app.js', import.meta.url)),
  ]);
  const version = createHash('sha256').update(bundle).digest('hex').slice(0, 12);
  assert.ok(page.includes(`src="./app.js?v=${version}"`));
});

test('anonymous example parses into expected blocks and metadata', async () => {
  const source = await readFile(new URL('../templates/example.md', import.meta.url), 'utf8');
  const { metadata, blocks } = parseMarkdown(source);
  assert.equal(blocks[0].kind, 'h1');
  assert.ok(blocks.some(block => block.kind === 'h2'));
  assert.ok(metadata['落款']);
  assert.ok(metadata['日期']);
  assert.throws(() => parseMarkdown('正文没有标题'), /一级 Markdown 标题/);
});

test('browser-generated Word includes reference layout, right-aligned signature and date', async () => {
  const source = '# 测试标题\n\n## 一、情况\n正文。\n\n落款：测试单位\n日期：2026年10月7日';
  const { title, blob } = await blobFromMarkdown(source);
  assert.equal(title, '测试标题');
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml').async('string');
  const footer = await zip.file('word/footer1.xml').async('string');
  assert.match(xml, /w:pgSz[^>]*w:w="11906"[^>]*w:h="16838"/);
  assert.match(xml, /w:docGrid[^>]*w:type="lines"[^>]*w:linePitch="312"/);
  assert.match(xml, /w:eastAsia="方正小标宋_GBK"/);
  assert.match(xml, /w:eastAsia="方正黑体_GBK"/);
  assert.match(xml, /w:eastAsia="方正仿宋GBK"/);
  assert.equal((xml.match(/w:jc w:val="right"/g) || []).length, 2);
  assert.match(footer, /PAGE/);
});

test('Markdown strong markers become bold Word runs while plain body stays regular', async () => {
  assert.deepEqual(inlineSegments('普通**重点**和__另一处__，\\**原样\\**'), [
    { text: '普通', bold: false },
    { text: '重点', bold: true },
    { text: '和', bold: false },
    { text: '另一处', bold: true },
    { text: '，**原样**', bold: false },
  ]);
  const { blob } = await blobFromMarkdown('# 标题\n\n普通**重点**和__另一处__。');
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml').async('string');
  assert.doesNotMatch(xml, /<w:t>\*\*|<w:t>__/);
  assert.match(xml, /<w:b w:val="false"\/>[^]*?<w:t[^>]*>普通<\/w:t>/);
  assert.match(xml, /<w:b\/>[^]*?<w:t[^>]*>重点<\/w:t>/);
  assert.match(xml, /<w:b\/>[^]*?<w:t[^>]*>另一处<\/w:t>/);
});
