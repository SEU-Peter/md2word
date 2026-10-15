import { AlignmentType, Document, DocumentGridType, Footer, Packer, PageNumber, Paragraph, TextRun } from 'docx';

const FONT = {
  title: '方正小标宋_GBK',
  h2: '方正黑体_GBK',
  h3: '方正楷体_GBK',
  body: '方正仿宋GBK',
};

export function parseMarkdown(source) {
  const metadata = {};
  const blocks = [];
  let current = [];
  const flush = () => {
    const text = current.join('\n').trim();
    if (text) blocks.push({ kind: 'body', text });
    current = [];
  };
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const field = line.match(/^(密级|副标题|日期|落款)\s*[：:](.*)$/);
    if (field) { flush(); metadata[field[1]] = field[2].trim(); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (heading) { flush(); blocks.push({ kind: `h${heading[1].length}`, text: heading[2] }); continue; }
    if (/^(?:[-*+]\s+|\d+[.、]\s+)(.+)$/.test(line)) {
      flush(); blocks.push({ kind: 'list', text: line }); continue;
    }
    if (/^附件[：:]/.test(line)) { flush(); blocks.push({ kind: 'attachment', text: line }); continue; }
    current.push(line);
  }
  flush();
  if (!blocks.length) throw new Error('请输入 Markdown 正文内容。');
  return { metadata, blocks };
}

function todayFilename() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function inlineSegments(text) {
  const segments = [];
  let plain = '';
  for (let index = 0; index < text.length;) {
    if (text[index] === '\\' && index + 1 < text.length && '*_\\'.includes(text[index + 1])) {
      plain += text[index + 1]; index += 2; continue;
    }
    const marker = text.slice(index, index + 2);
    if ((marker === '**' || marker === '__') && index + 2 < text.length && !/\s/.test(text[index + 2])) {
      let end = index + 2;
      while (end < text.length - 1) {
        if (text[end] === '\\' && end + 1 < text.length) { end += 2; continue; }
        if (text.slice(end, end + 2) === marker && end > index + 2 && !/\s/.test(text[end - 1])) break;
        end += 1;
      }
      if (end < text.length - 1 && text.slice(end, end + 2) === marker && !/\s/.test(text[end - 1])) {
        if (plain) { segments.push({ text: plain, bold: false }); plain = ''; }
        segments.push({ text: text.slice(index + 2, end).replace(/\\([*_\\])/g, '$1'), bold: true });
        index = end + 2;
        continue;
      }
    }
    plain += text[index]; index += 1;
  }
  if (plain) segments.push({ text: plain, bold: false });
  return segments;
}

function runs(text, font = FONT.body, size = 32, bold = true) {
  return inlineSegments(text).flatMap(segment => segment.text.split(/(\d+(?:[.,:/%-]\d+)*)/).filter(Boolean).map(chunk => new TextRun({
    text: chunk,
    bold: bold || segment.bold,
    size,
    font: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: font },
  })));
}

function paragraph(text = '', { font = FONT.body, size = 32, bold = true, alignment = AlignmentType.JUSTIFIED, firstLine = 0, left = 0, before = 0 } = {}) {
  return new Paragraph({
    alignment,
    indent: { firstLine, left },
    spacing: { before, after: 0 },
    children: runs(text, font, size, bold),
  });
}

export function documentFromMarkdown(source) {
  const { metadata, blocks } = parseMarkdown(source);
  const title = blocks[0].kind === 'h1'
    ? inlineSegments(blocks[0].text).map(segment => segment.text).join('')
    : todayFilename();
  const children = [];
  if (metadata['密级']) children.push(paragraph(metadata['密级']));
  for (const block of blocks) {
    switch (block.kind) {
      case 'h1':
        children.push(paragraph(block.text, { font: FONT.title, size: 44, alignment: AlignmentType.CENTER }));
        if (metadata['副标题']) children.push(paragraph(metadata['副标题'], { font: FONT.title, alignment: AlignmentType.CENTER }));
        children.push(new Paragraph({ children: [] }));
        break;
      case 'h2': children.push(paragraph(block.text, { font: FONT.h2, firstLine: 640 })); break;
      case 'h3': children.push(paragraph(block.text, { font: FONT.h3, firstLine: 640 })); break;
      case 'h4': children.push(paragraph(block.text, { firstLine: 640 })); break;
      case 'list': children.push(paragraph(block.text, { bold: false, firstLine: 640 })); break;
      case 'attachment': children.push(paragraph(block.text, { bold: false, left: 640, before: 320 })); break;
      default: children.push(paragraph(block.text, { bold: false, firstLine: 640 }));
    }
  }
  if (metadata['落款']) children.push(paragraph(metadata['落款'], { alignment: AlignmentType.RIGHT, before: 640 }));
  if (metadata['日期']) children.push(paragraph(metadata['日期'], { alignment: AlignmentType.RIGHT }));

  const footer = new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], bold: true, size: 28, font: 'Times New Roman' })],
  })] });
  return { title, document: new Document({
    title,
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1800, right: 1800, header: 851, footer: 992 },
        },
        grid: { type: DocumentGridType.LINES, linePitch: 312, charSpace: 0 },
      },
      footers: { default: footer },
      children,
    }],
  }) };
}

export async function blobFromMarkdown(source) {
  const { title, document } = documentFromMarkdown(source);
  return { title, blob: await Packer.toBlob(document) };
}
