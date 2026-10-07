# -*- coding: utf-8 -*-
"""Markdown parser and OOXML writer for Chinese official-document typography."""

from __future__ import annotations

import io
import re
from dataclasses import dataclass

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

FONT_TITLE = "方正小标宋_GBK"
FONT_H1 = "方正黑体_GBK"
FONT_H2 = "方正楷体_GBK"
FONT_BODY = "方正仿宋GBK"


@dataclass
class Block:
    kind: str
    text: str


def parse_markdown(source: str) -> tuple[dict[str, str], list[Block]]:
    metadata: dict[str, str] = {}
    blocks: list[Block] = []
    lines = source.replace("\r\n", "\n").split("\n")
    current: list[str] = []

    def flush() -> None:
        if current and (text := "\n".join(current).strip()):
            blocks.append(Block("body", text))
        current.clear()

    for raw in lines:
        line = raw.strip()
        if not line:
            flush(); continue
        field = re.match(r"^(密级|副标题|日期|落款)\s*[：:](.*)$", line)
        if field:
            flush(); metadata[field.group(1)] = field.group(2).strip(); continue
        heading = re.match(r"^(#{1,4})\s+(.+?)\s*$", line)
        if heading:
            flush(); blocks.append(Block(f"h{len(heading.group(1))}", heading.group(2))); continue
        item = re.match(r"^(?:[-*+]\s+|\d+[.、]\s+)(.+)$", line)
        if item:
            flush(); blocks.append(Block("list", line)); continue
        if line.startswith("附件：") or line.startswith("附件:"):
            flush(); blocks.append(Block("attachment", line)); continue
        current.append(line)
    flush()
    if not blocks or blocks[0].kind != "h1":
        raise ValueError("请以一级 Markdown 标题（# 文件标题）作为文件标题。")
    return metadata, blocks


def set_run_font(run, east_asia: str, size: float, bold: bool = True) -> None:
    run.font.name = "Times New Roman"
    run.font.size = Pt(size)
    run.bold = bold
    run._element.rPr.rFonts.set(qn("w:eastAsia"), east_asia)


def set_para(paragraph, *, align=None, first_line: bool = False, before=0, after=0) -> None:
    if align is not None:
        paragraph.alignment = align
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(before); fmt.space_after = Pt(after)
    # The reference relies on its section grid rather than explicit line spacing.
    fmt.first_line_indent = Pt(32) if first_line else Pt(0)


def add_page_field(paragraph):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar"); begin.set(qn("w:fldCharType"), "begin")
    instruction = OxmlElement("w:instrText"); instruction.set(qn("xml:space"), "preserve")
    instruction.text = " PAGE \\* MERGEFORMAT "
    separate = OxmlElement("w:fldChar"); separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t"); text.text = "1"  # Word refreshes this cached value.
    end = OxmlElement("w:fldChar"); end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instruction, separate, text, end])
    return run


def add_text(paragraph, text: str, font: str = FONT_BODY, size: float = 16) -> None:
    # Keep numeric runs Western-font friendly while applying the correct CJK font elsewhere.
    chunks = re.split(r"(\d+(?:[.,:/%-]\d+)*)", text)
    for chunk in chunks:
        if not chunk:
            continue
        run = paragraph.add_run(chunk)
        set_run_font(run, font, size)


def document_from_markdown(source: str) -> tuple[str, bytes]:
    meta, blocks = parse_markdown(source)
    title = blocks[0].text
    document = Document()
    normal = document.styles["Normal"]
    normal.font.name = FONT_BODY
    normal.font.size = Pt(16)
    normal.font.bold = True
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_BODY)
    normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    normal.paragraph_format.first_line_indent = Pt(32)
    section = document.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    # Measured from the supplied reference document.
    section.top_margin = Cm(2.54); section.bottom_margin = Cm(2.54)
    section.left_margin = Cm(3.175); section.right_margin = Cm(3.175)
    section.header_distance = Cm(1.5); section.footer_distance = Cm(1.75)
    # The reference uses a 312-twip line grid.
    for existing in section._sectPr.findall(qn("w:docGrid")):
        section._sectPr.remove(existing)
    grid = OxmlElement("w:docGrid")
    grid.set(qn("w:type"), "lines")
    grid.set(qn("w:charSpace"), "0")
    grid.set(qn("w:linePitch"), "312")
    section._sectPr.append(grid)

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_run_font(add_page_field(footer), "Times New Roman", 14)

    if meta.get("密级"):
        p = document.add_paragraph()
        set_para(p, before=0, after=0)
        add_text(p, meta["密级"], FONT_BODY)

    for index, block in enumerate(blocks):
        if block.kind == "h1":
            p = document.add_paragraph()
            set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER)
            add_text(p, block.text, FONT_TITLE, 22)
            if meta.get("副标题"):
                p = document.add_paragraph()
                set_para(p, align=WD_ALIGN_PARAGRAPH.CENTER)
                add_text(p, meta["副标题"], FONT_TITLE, 16)
            # The source leaves one blank paragraph between title block and body.
            document.add_paragraph()
        elif block.kind == "h2":
            p = document.add_paragraph(); set_para(p, before=0, after=0)
            add_text(p, block.text, FONT_H1)
        elif block.kind == "h3":
            p = document.add_paragraph(); set_para(p, before=0, after=0)
            add_text(p, block.text, FONT_H2)
        elif block.kind == "h4":
            p = document.add_paragraph(); set_para(p, before=0, after=0)
            add_text(p, block.text, FONT_BODY)
        elif block.kind == "list":
            p = document.add_paragraph(); set_para(p, first_line=True)
            # Preserve the writer's Markdown marker rather than silently renumbering it.
            add_text(p, block.text, FONT_BODY)
        elif block.kind == "attachment":
            p = document.add_paragraph(); set_para(p, before=16)
            p.paragraph_format.left_indent = Pt(32)  # Attachment line: left-indent two characters.
            add_text(p, block.text, FONT_BODY)
        else:
            p = document.add_paragraph(); set_para(p, first_line=True)
            add_text(p, block.text, FONT_BODY)

    if meta.get("落款"):
        p = document.add_paragraph(); set_para(p, align=WD_ALIGN_PARAGRAPH.RIGHT, before=32)
        add_text(p, meta["落款"], FONT_BODY)
    if meta.get("日期"):
        p = document.add_paragraph(); set_para(p, align=WD_ALIGN_PARAGRAPH.RIGHT)
        add_text(p, meta["日期"], FONT_BODY)

    output = io.BytesIO(); document.save(output)
    return title, output.getvalue()
