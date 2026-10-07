# 公文 Markdown 排版

将 Markdown 转换为符合参考公文范本版式的可编辑 Word 文档。可使用 [网页版本](https://seu-peter.github.io/md2word/)，也可在本地部署。

> 请勿在网页上上传或处理涉密文件。涉密文件请下载本仓库并在本地部署后处理。

## 本地使用

下载或克隆本仓库。在 macOS 中双击 `启动公文排版.command`；首次运行会在本目录创建 Python 虚拟环境并安装 `python-docx`，然后打开 `http://127.0.0.1:8766`。其他系统可运行 `python3 -m venv .venv`、`.venv/bin/pip install -r requirements.txt`、`.venv/bin/python app.py`。

网页版本由浏览器直接生成 `.docx`，无需 Python。开发与预览网页版本：运行 `npm ci`、`npm run build`，再用静态文件服务打开 `dist/`。GitHub Actions 会在推送到 `main` 后自动运行测试、构建并部署 GitHub Pages。

## Markdown 约定

- `# 标题`：文件标题，方正小标宋 GBK 二号、居中。
- `副标题：`：标题下方的居中副标题；不需要时删除此行。
- `##`：一级标题，方正黑体 GBK 三号。
- `###`：二级标题，方正楷体 GBK 三号。
- `####` 和普通段落：方正仿宋 GBK 三号。
- `密级：`、`落款：`、`日期：`：专用字段。落款上空两行；落款和日期均位于文末右侧、右对齐。
- `附件：`：附件说明，位于新段落。

全部内容按范本加粗；西文数字使用 Times New Roman。文档为 A4，页边距为上、下 2.54 cm，左、右 3.175 cm；页眉 1.5 cm、页脚 1.75 cm；使用范本的每页行网格。页码居中、Times New Roman 四号加粗且不加横线。

## 说明

仓库只含匿名示例，不含案件材料。生成的 `.docx` 可在 Word/WPS 中继续编辑。要得到方正字体的最终外观，请确保打开文档的电脑已安装方正小标宋 GBK、方正黑体 GBK、方正楷体 GBK 和方正仿宋 GBK。
