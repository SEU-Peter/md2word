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
  if (blocks[0]?.kind !== 'h1') throw new Error('请以一级 Markdown 标题（# 文件标题）作为文件标题。');
  return { metadata, blocks };
}

function runs(text, font = FONT.body, size = 32) {
  return text.split(/(\d+(?:[.,:/%-]\d+)*)/).filter(Boolean).map(chunk => new TextRun({
    text: chunk,
    bold: true,
    size,
    font: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: font },
  }));
}

function paragraph(text = '', { font = FONT.body, size = 32, alignment = AlignmentType.JUSTIFIED, firstLine = 0, left = 0, before = 0 } = {}) {
  return new Paragraph({
    alignment,
    indent: { firstLine, left },
    spacing: { before, after: 0 },
    children: runs(text, font, size),
  });
}

export function documentFromMarkdown(source) {
  const { metadata, blocks } = parseMarkdown(source);
  const title = blocks[0].text;
  const children = [];
  if (metadata['密级']) children.push(paragraph(metadata['密级']));
  for (const block of blocks) {
    switch (block.kind) {
      case 'h1':
        children.push(paragraph(block.text, { font: FONT.title, size: 44, alignment: AlignmentType.CENTER }));
        if (metadata['副标题']) children.push(paragraph(metadata['副标题'], { font: FONT.title, alignment: AlignmentType.CENTER }));
        children.push(new Paragraph({ children: [] }));
        break;
      case 'h2': children.push(paragraph(block.text, { font: FONT.h2 })); break;
      case 'h3': children.push(paragraph(block.text, { font: FONT.h3 })); break;
      case 'h4': children.push(paragraph(block.text)); break;
      case 'list': children.push(paragraph(block.text, { firstLine: 640 })); break;
      case 'attachment': children.push(paragraph(block.text, { left: 640, before: 320 })); break;
      default: children.push(paragraph(block.text, { firstLine: 640 }));
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
