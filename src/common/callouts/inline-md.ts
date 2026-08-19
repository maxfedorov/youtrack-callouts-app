/**
 * A deliberately small markdown-to-HTML converter for callout bodies.
 *
 * It exists because YouTrack does not process markdown inside an HTML block: text placed in a
 * `<div>` is emitted verbatim, so `**bold**` would reach the reader as literal asterisks. Only the
 * inline constructs that make sense inside a short callout are supported.
 *
 * User-supplied HTML is escaped rather than passed through. The app must not widen the injection
 * surface beyond what YouTrack's own filter already allows.
 */

/**
 * Sentinel wrapped around extracted code spans while the other inline rules run. U+0000 cannot
 * survive `escapeHtml` on user text, so a placeholder can never collide with the body itself, and
 * unlike a word-shaped marker it consumes no surrounding whitespace.
 */
const SENTINEL = '\u0000';
const SAFE_URL = /^(https?:\/\/|mailto:|\/|#|\?)/i;
const CODE_STYLE = 'padding:0 3px;border-radius:3px;background:rgba(127,127,127,0.18)';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Anything not recognisably safe is rendered as plain text instead of a link. */
function renderLink(label: string, url: string): string {
  const trimmed = url.trim();
  if (!SAFE_URL.test(trimmed)) {
    return `${label} (${trimmed})`;
  }
  return `<a href="${trimmed}">${label}</a>`;
}

function applyInline(text: string): string {
  const codeSpans: string[] = [];
  let out = text.replace(/`([^`]+)`/g, (_match, code: string) => {
    codeSpans.push(code);
    return `${SENTINEL}${codeSpans.length - 1}${SENTINEL}`;
  });

  out = out.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_match, label: string, url: string) =>
    renderLink(label, url),
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  out = out.replace(/(^|[\s(])_([^_\s][^_]*)_/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~]+)~~/g, '<s>$1</s>');

  return out.replace(
    new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, 'g'),
    (_match, index: string) => `<code style="${CODE_STYLE}">${codeSpans[Number(index)]}</code>`,
  );
}

interface ListItem {
  ordered: boolean;
  text: string;
}

function matchListItem(line: string): ListItem | null {
  const unordered = /^\s{0,3}[-*+]\s+(.*)$/.exec(line);
  if (unordered) {
    return {ordered: false, text: unordered[1]};
  }
  const ordered = /^\s{0,3}\d+[.)]\s+(.*)$/.exec(line);
  if (ordered) {
    return {ordered: true, text: ordered[1]};
  }
  return null;
}

function renderList(items: ListItem[]): string {
  const tag = items[0].ordered ? 'ol' : 'ul';
  const body = items.map((item) => `<li>${applyInline(item.text)}</li>`).join('');
  return `<${tag} style="margin:4px 0;padding-left:20px">${body}</${tag}>`;
}

/**
 * Converts a callout body. Consecutive list markers become one list; every other run of lines
 * becomes a paragraph with `<br>` between the lines, which is how a reader expects a short block
 * of text inside a panel to wrap.
 */
export function renderBody(markdown: string): string {
  const lines = markdown.split('\n');
  const parts: string[] = [];
  let paragraph: string[] = [];
  let list: ListItem[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      parts.push(paragraph.map((line) => applyInline(line)).join('<br>'));
      paragraph = [];
    }
  };
  const flushList = (): void => {
    if (list.length > 0) {
      parts.push(renderList(list));
      list = [];
    }
  };

  for (const rawLine of lines) {
    const line = escapeHtml(rawLine);
    const item = matchListItem(line);
    if (item) {
      flushParagraph();
      if (list.length > 0 && list[0].ordered !== item.ordered) {
        flushList();
      }
      list.push(item);
    } else if (line.trim() === '') {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();

  return parts.join('');
}
