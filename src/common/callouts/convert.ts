/**
 * The text transform: GitHub-flavoured alert blocks in, inline-styled HTML out.
 *
 * Three properties matter more than features here, because the rule runs on every edit of every
 * issue and article in an enabled project:
 *
 * - **Code fences are never touched.** Documentation that shows callout syntax in an example must
 *   survive unchanged — including this app's own guides.
 * - **Conversion is idempotent.** An already converted panel is copied through verbatim.
 * - **Conversion is reversible.** The original markdown travels inside the panel's own
 *   `data-callout-src` attribute, which YouTrack strips from the rendered output but keeps in the
 *   stored source.
 *
 * Each converted callout occupies exactly one line. An earlier version stashed the source in a
 * multi-line HTML comment above the panel: the server-side wikifier removed it correctly, but the
 * browser's markdown renderer did not, and the stashed lines appeared as text above the panel.
 */

import type {CalloutType} from './types';
import {CALLOUT_ATTR, SOURCE_ATTR, decodeSource, renderCalloutHtml} from './render';

const FENCE = /^\s{0,3}(```|~~~)/;
const ALERT_START = /^\s{0,3}>\s?\[!([A-Za-z][A-Za-z0-9_]{0,23})\]\s*$/;
const QUOTE_LINE = /^\s{0,3}>\s?(.*)$/;
const SOURCE_VALUE = new RegExp(`${SOURCE_ATTR}="([^"]*)"`);
const LEGACY_OPEN = /^<!--callout:([A-Z][A-Z0-9_]{0,23})$/;
const LEGACY_STASH_END = '-->';
const LEGACY_BLOCK_END = '<!--/callout-->';

export interface ConvertResult {
  text: string;
  changed: boolean;
  count: number;
}

function isConverted(line: string): boolean {
  return line.includes(`${CALLOUT_ATTR}="`);
}

function collectBody(lines: string[], start: number): {body: string[]; next: number} {
  const body: string[] = [];
  let i = start;
  while (i < lines.length) {
    if (ALERT_START.test(lines[i])) {
      break;
    }
    const quoted = QUOTE_LINE.exec(lines[i]);
    if (!quoted) {
      break;
    }
    body.push(quoted[1]);
    i += 1;
  }
  return {body, next: i};
}

/** Copies a panel produced by the superseded comment-based format through untouched. */
function copyLegacyBlock(lines: string[], start: number, out: string[]): number {
  let i = start;
  while (i < lines.length && lines[i] !== LEGACY_BLOCK_END) {
    out.push(lines[i]);
    i += 1;
  }
  if (i < lines.length) {
    out.push(lines[i]);
    i += 1;
  }
  return i;
}

/** Replaces every GFM alert block whose type is enabled for this project. */
export function renderCallouts(text: string, types: Record<string, CalloutType>): ConvertResult {
  const lines = text.split('\n');
  const out: string[] = [];
  let fence: string | null = null;
  let count = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (fence) {
      out.push(line);
      if (line.trimStart().startsWith(fence)) {
        fence = null;
      }
      i += 1;
      continue;
    }

    const fenceStart = FENCE.exec(line);
    if (fenceStart) {
      fence = fenceStart[1];
      out.push(line);
      i += 1;
      continue;
    }

    if (LEGACY_OPEN.test(line)) {
      i = copyLegacyBlock(lines, i, out);
      continue;
    }

    const alert = ALERT_START.exec(line);
    const type = isConverted(line) || !alert ? undefined : types[alert[1].toUpperCase()];
    if (!type) {
      out.push(line);
      i += 1;
      continue;
    }

    const {body, next} = collectBody(lines, i + 1);
    out.push(renderCalloutHtml(type, body.join('\n'), lines.slice(i, next).join('\n')));
    count += 1;
    i = next;
  }

  const result = out.join('\n');
  return {text: result, changed: result !== text, count};
}

/** Restores a panel written in the superseded comment-based format. */
function revertLegacy(
  lines: string[],
  start: number,
  out: string[],
): {next: number; reverted: boolean} {
  const stash: string[] = [];
  let j = start + 1;
  while (j < lines.length && lines[j] !== LEGACY_STASH_END) {
    stash.push(lines[j]);
    j += 1;
  }
  if (j >= lines.length) {
    // Unterminated: leave the text alone rather than guess.
    out.push(lines[start]);
    return {next: start + 1, reverted: false};
  }
  j += 1;
  while (j < lines.length && lines[j] !== LEGACY_BLOCK_END) {
    j += 1;
  }
  const source = stash.join('\n').replace(/--\\!>/g, '--!>').replace(/--\\>/g, '-->');
  out.push(...source.split('\n'));
  return {next: j < lines.length ? j + 1 : j, reverted: true};
}

/** Restores the markdown carried in `data-callout-src`, dropping the generated panel. */
export function revertCallouts(text: string): ConvertResult {
  const lines = text.split('\n');
  const out: string[] = [];
  let count = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const source = SOURCE_VALUE.exec(line);

    if (source) {
      out.push(...decodeSource(source[1]).split('\n'));
      count += 1;
      i += 1;
      continue;
    }
    if (LEGACY_OPEN.test(line)) {
      const outcome = revertLegacy(lines, i, out);
      i = outcome.next;
      count += outcome.reverted ? 1 : 0;
      continue;
    }
    out.push(line);
    i += 1;
  }

  const result = out.join('\n');
  return {text: result, changed: result !== text, count};
}
