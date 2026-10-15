import io
import unittest
from datetime import date

from docx import Document

from gongwen import document_from_markdown, inline_segments


class MarkdownBoldTests(unittest.TestCase):
    def test_inline_segments(self):
        self.assertEqual(
            inline_segments(r"普通**重点**和__另一处__，\**原样\**"),
            [
                ("普通", False),
                ("重点", True),
                ("和", False),
                ("另一处", True),
                ("，**原样**", False),
            ],
        )

    def test_document_runs(self):
        title, data = document_from_markdown("# 标题\n\n普通**重点**和__另一处__。")
        self.assertEqual(title, "标题")
        paragraph = next(p for p in Document(io.BytesIO(data)).paragraphs if "重点" in p.text)
        self.assertEqual(paragraph.text, "普通重点和另一处。")
        self.assertEqual([(r.text, r.bold) for r in paragraph.runs], [
            ("普通", False),
            ("重点", True),
            ("和", False),
            ("另一处", True),
            ("。", False),
        ])

    def test_all_section_headings_have_two_character_indent(self):
        source = "# 标题\n\n## 一级标题\n### 二级标题\n#### 三级标题\n"
        _, data = document_from_markdown(source)
        paragraphs = {p.text: p for p in Document(io.BytesIO(data)).paragraphs if p.text}
        for heading in ("一级标题", "二级标题", "三级标题"):
            with self.subTest(heading=heading):
                self.assertEqual(paragraphs[heading].paragraph_format.first_line_indent.pt, 32)
                self.assertFalse(paragraphs[heading].text.startswith((" ", "　")))

    def test_untitled_document_uses_current_date_without_adding_title(self):
        source = "## 一、情况\n正文**重点**。"
        today = date.today().isoformat()
        title, data = document_from_markdown(source)
        self.assertEqual(title, today)
        paragraphs = [p.text for p in Document(io.BytesIO(data)).paragraphs if p.text]
        self.assertEqual(paragraphs, ["一、情况", "正文重点。"])
        with self.assertRaisesRegex(ValueError, "请输入 Markdown 正文内容"):
            document_from_markdown("  \n\n")


if __name__ == "__main__":
    unittest.main()
