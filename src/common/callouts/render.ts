/**
 * Renders a callout as inline-styled HTML on a single line.
 *
 * Only the `style` attribute survives YouTrack's HTML filter — `class`, `data-*`, `id` and `title`
 * are stripped, and inline `<svg>` is removed outright — so every visual decision has to live in
 * `style`, and an icon has to be an entity, plain text, or an `<img>`.
 *
 * That stripping is also what makes `data-*` the right home for the app's own bookkeeping: the
 * attributes stay in the stored source, where the converter reads them, and never reach the reader.
 * They replaced an HTML comment, which the server-side wikifier removed correctly but the browser's
 * markdown renderer did not when it spanned several lines — there it leaked the stashed lines as
 * visible text above the panel.
 */

import type {CalloutType} from './types';
import {BUILTIN_TYPES, isTransparent, safeColour, safeIcon, safeKey, safeTitle} from './types';
import {escapeHtml, renderBody} from './inline-md';

const RADIUS = 'var(--ring-border-radius, 4px)';

export const CALLOUT_ATTR = 'data-callout';
export const SOURCE_ATTR = 'data-callout-src';

/**
 * Encodes the original markdown for an attribute value. Newlines become `&#10;` so the whole block
 * stays on one line — the shape both markdown renderers agree on.
 */
export function encodeSource(source: string): string {
  return source
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, '&#10;');
}

export function decodeSource(value: string): string {
  return value
    .replace(/&#10;/g, '\n')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

/**
 * @param source When given, the original markdown is carried along in `data-callout-src` so the
 *   conversion stays reversible. Omit it for previews, which need no bookkeeping.
 */
/**
 * Every interpolated value is re-validated here rather than trusted from the caller. This function
 * is the single place markup is produced, and it is reached from three directions: the workflow
 * rule (stored registry), the settings widget (unsaved admin input) and the markdown widget (its own
 * saved configuration, writable by anyone who can edit the entity). Inside a widget iframe the
 * result is injected with `dangerouslySetInnerHTML`, where YouTrack's HTML filter does not run — so
 * this validation, not the platform's, is what has to hold.
 */
export function renderCalloutHtml(type: CalloutType, bodyMarkdown: string, source?: string): string {
  const fallback = BUILTIN_TYPES[0];
  const accent = safeColour(type.accent, fallback.accent);
  const background = safeColour(type.background, fallback.background);
  const key = safeKey(type.key, 'CALLOUT');

  // Only a narrow set of CSS properties survives YouTrack's *client-side* markdown renderer, which
  // is stricter than the server-side one: `gap`, `align-items`, `flex`, `line-height` and
  // `overflow-wrap` are all dropped, while `display`, `width`, `margin`, `padding`, `text-align`,
  // `word-break` and the colour properties survive. So the spacing is built from a fixed-width icon
  // column plus `margin-right` instead of flex `gap`, and long words are broken with `word-break`.
  // A transparent background is written as no declaration at all rather than
  // `background:transparent`. The two are equivalent — `background` is not inherited and its initial
  // value is already transparent — but omitting it keeps the result independent of how each of the
  // two markdown renderers treats a bare keyword in a colour position.
  const panel = [
    'display:flex',
    `border-left:3px solid ${accent}`,
    ...(isTransparent(background) ? [] : [`background:${background}`]),
    'padding:10px 14px',
    `border-radius:${RADIUS}`,
    'margin:8px 0',
  ].join(';');

  // A fixed column keeps every callout aligned no matter how wide the glyph is: an emoji and a
  // narrow symbol like the info sign otherwise produce visibly different gaps.
  const iconStyle = `width:20px;margin-right:8px;text-align:center;color:${accent}`;
  const icon = `<div style="${iconStyle}">${safeIcon(type.icon, fallback.icon)}</div>`;
  const title =
    `<div style="font-weight:600;color:${accent};word-break:break-word">${escapeHtml(safeTitle(type.title, fallback.title))}</div>`;
  const body = renderBody(bodyMarkdown);
  const bookkeeping =
    source === undefined ? '' : ` ${CALLOUT_ATTR}="${key}" ${SOURCE_ATTR}="${encodeSource(source)}"`;

  return (
    `<div${bookkeeping} style="${panel}">${icon}` +
    `<div style="min-width:0;word-break:break-word">${title}${body}</div></div>`
  );
}
