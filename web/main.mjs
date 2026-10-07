import { blobFromMarkdown } from './convert.mjs';

const form = document.querySelector('form.workspace');
const editor = document.getElementById('markdown');
const state = document.getElementById('state');
const button = form.querySelector('button[type="submit"]');

form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  state.textContent = '生成中…';
  try {
    const { title, blob } = await blobFromMarkdown(editor.value);
    const safe = title.replace(/[\\/:*?"<>|]+/g, '_').trim() || '公文';
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safe}.docx`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    state.textContent = '已生成';
  } catch (error) {
    state.textContent = '生成失败';
    let notice = document.querySelector('.notice');
    if (!notice) {
      notice = document.createElement('p');
      notice.className = 'notice';
      notice.setAttribute('role', 'alert');
      form.before(notice);
    }
    notice.textContent = error.message || '生成失败，请检查 Markdown 内容。';
  } finally {
    button.disabled = false;
  }
});
