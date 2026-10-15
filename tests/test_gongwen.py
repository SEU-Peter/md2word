import io
import unittest

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


if __name__ == "__main__":
    unittest.main()
