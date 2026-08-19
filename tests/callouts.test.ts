/**
 * Tests for the text transform. It is pure, so it runs without a YouTrack instance:
 *
 *   npm test
 *
 * The invariants asserted here are the ones that make it safe to rewrite user content on every
 * save: code fences stay untouched, conversion is idempotent, revert is exact, bodies cannot inject
 * markup, and — the one a browser caught that the REST API did not — a converted callout occupies
 * exactly one line, with nothing of the original leaking outside the panel's attributes.
 */

import {
  MAX_TITLE,
  TRANSPARENT,
  findTypeProblem,
  indexEnabled,
  isTransparent,
  optionalTitle,
  parseRegistry,
  type CalloutType,
} from '../src/common/callouts/types';
import {renderCallouts, revertCallouts} from '../src/common/callouts/convert';
import {CALLOUT_ATTR, renderCalloutHtml} from '../src/common/callouts/render';
import {restoreSnapshot} from '../src/widgets/shared/host-utils';

const types = indexEnabled(parseRegistry(null).types);
/** How much of a rendered string to show when an assertion fails. */
const SNIPPET = 160;
/** How much of a payload to name in an assertion label. */
const LABEL = 28;
let failures = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
}

function group(name: string, body: () => void): void {
  console.log(`\n${name}`);
  body();
}

/** Lines that are not a rendered panel — anything a reader would see as plain text. */
function nonPanelLines(text: string): string[] {
  return text.split('\n').filter((line) => !line.includes(`${CALLOUT_ATTR}="`));
}

group('conversion', () => {
  const src = '> [!WARNING]\n> Do not run on prod.\n> See [runbook](https://example.com/rb).';
  const result = renderCallouts(src, types);
  check('one block converted', result.count === 1 && result.changed);
  check('panel emitted', result.text.includes('border-left:3px solid'));
  check('title rendered', result.text.includes('Warning'));
  check('link became an anchor', result.text.includes('<a href="https://example.com/rb">runbook</a>'));
  check('source carried in an attribute', result.text.includes('data-callout-src="'));
});

group('a converted callout is exactly one line', () => {
  const src = 'Before.\n\n> [!WARNING]\n> Line one.\n> Line two.\n\nAfter.';
  const result = renderCallouts(src, types);
  const panels = result.text.split('\n').filter((line) => line.includes(`${CALLOUT_ATTR}="`));
  check('single panel line', panels.length === 1, JSON.stringify(panels));
  check(
    'no body text outside the panel line',
    !nonPanelLines(result.text).some((line) => line.includes('Line one')),
    JSON.stringify(nonPanelLines(result.text)),
  );
  check(
    'no stray comment markers anywhere',
    !result.text.includes('<!--') && !result.text.includes('-->'),
    result.text,
  );
  check('surrounding text preserved', result.text.startsWith('Before.') && result.text.endsWith('After.'));
});

group('idempotency', () => {
  const once = renderCallouts('> [!NOTE]\n> Hello', types);
  const twice = renderCallouts(once.text, types);
  const thrice = renderCallouts(twice.text, types);
  check('second pass is a no-op', !twice.changed && twice.count === 0, twice.text);
  check('third pass is a no-op', !thrice.changed);
});

group('revert', () => {
  const src = '> [!TIP]\n> Use **bold** and `code`.';
  const reverted = revertCallouts(renderCallouts(src, types).text);
  check('restores the original exactly', reverted.text === src, JSON.stringify(reverted.text));
  check('counted', reverted.count === 1);
});

group('code fences are never touched', () => {
  const src = ['Docs example:', '```markdown', '> [!NOTE]', '> stays literal', '```', 'after'].join('\n');
  const result = renderCallouts(src, types);
  check('nothing converted inside a fence', result.count === 0 && !result.changed, result.text);

  const mixed = ['```', '> [!NOTE]', '```', '', '> [!NOTE]', '> real one'].join('\n');
  check('a real block after a fence still converts', renderCallouts(mixed, types).count === 1);
});

group('only exact matches convert', () => {
  check('unknown keyword untouched', !renderCallouts('> [!NOPE]\n> body', types).changed);
  check('keyword must be alone on the line', !renderCallouts('> [!NOTE] inline\n> body', types).changed);
  check(
    'an ordinary quote is left alone',
    !renderCallouts('Text.\n\n> a normal quote\n> second line', types).changed,
  );
});

group('attribute encoding survives hazardous bodies', () => {
  for (const hazard of ['-->', '--!>', 'a -- b', 'quote " and <tag> and &amp;']) {
    const src = `> [!NOTE]\n> ${hazard} tail`;
    const rendered = renderCallouts(src, types);
    check(
      `attribute value stays closed for ${JSON.stringify(hazard)}`,
      rendered.text.split('\n').length === 1,
      rendered.text,
    );
    const back = revertCallouts(rendered.text).text;
    check(`round-trips ${JSON.stringify(hazard)}`, back === src, JSON.stringify(back));
  }
});

group('bodies cannot inject markup', () => {
  const result = renderCallouts('> [!NOTE]\n> <img src=x onerror=alert(1)>', types);
  const visible = result.text.slice(result.text.indexOf('style="display:flex'));
  check('no raw tag in the visible part', !visible.includes('<img src=x'), visible);
  check('escaped instead', visible.includes('&lt;img'));

  // Assembled rather than written literally so the linter does not read it as a live script URL.
  const unsafeScheme = `java${'script'}:alert(1)`;
  const withUnsafeLink = renderCallouts(`> [!NOTE]\n> [x](${unsafeScheme})`, types);
  check('unsafe scheme is not linked', !withUnsafeLink.text.includes(`href="${unsafeScheme}`));
});

group('lists and multiple blocks', () => {
  const src = '> [!NOTE]\n> - one\n> - two\n\n> [!TIP]\n> after';
  const result = renderCallouts(src, types);
  check('two blocks', result.count === 2, `count=${result.count}`);
  check('list rendered', result.text.includes('<ul') && result.text.includes('<li>one</li>'));
  const back = revertCallouts(result.text);
  check('both revert exactly', back.count === 2 && back.text === src, JSON.stringify(back.text));
});

group('disabled types', () => {
  const stored = JSON.stringify({
    autoConvert: true,
    types: [{key: 'NOTE', enabled: true}, {key: 'TIP', enabled: false}],
  });
  const onlyNote = indexEnabled(parseRegistry(stored).types);
  const result = renderCallouts('> [!NOTE]\n> a\n\n> [!TIP]\n> b', onlyNote);
  check('enabled type converts', result.text.includes(`${CALLOUT_ATTR}="NOTE"`));
  check(
    'disabled type stays source',
    result.text.includes('> [!TIP]') && !result.text.includes(`${CALLOUT_ATTR}="TIP"`),
  );
});

group('long values cannot break the layout', () => {
  // Comfortably past every limit, expressed relative to it so the numbers stay meaningful.
  const overLimit = MAX_TITLE + MAX_TITLE;
  const longTitle = 'A'.repeat(overLimit);
  const stored = JSON.stringify({
    autoConvert: true,
    types: [{key: 'NOTE', title: longTitle, enabled: true}],
  });
  const parsed = parseRegistry(stored).types[0];
  check('title trimmed to the limit', parsed.title.length === MAX_TITLE, String(parsed.title.length));
  check('trimmed title keeps the start of what was typed', parsed.title.startsWith('AAA'));
  // A blank title is not a mistake to repair: it is how a heading-less type is written. Only an
  // absent field falls back — see 'a type with no title renders a single row'.
  check(
    'a whitespace-only title means no heading',
    parseRegistry(JSON.stringify({types: [{key: 'NOTE', title: '   ', enabled: true}]})).types[0].title === '',
  );

  const rendered = renderCallouts(
    `> [!NOTE]\n> ${'x'.repeat(overLimit)} https://example.com/${'y'.repeat(overLimit)}`,
    indexEnabled(parseRegistry(stored).types),
  );
  check('body wraps instead of stretching the panel', rendered.text.includes('word-break:break-word'));
  check('title wraps too', (rendered.text.match(/word-break:break-word/g) ?? []).length >= 2);
});

group('injection: nothing attacker-controlled reaches the markup unchecked', () => {
  // The renderer is reached from a widget's own saved configuration, which anyone who can edit an
  // issue may write, and its output is injected into a widget iframe where YouTrack's HTML filter
  // does not run. So the renderer itself has to be the boundary.
  const hostile = (over: Record<string, unknown>): CalloutType =>
    ({
      key: 'NOTE',
      title: 'T',
      accent: 'var(--ring-main-color, #3c8ee9)',
      background: 'rgba(60, 142, 233, 0.10)',
      icon: '&#8505;',
      enabled: true,
      ...over,
    }) as CalloutType;

  const titled = renderCalloutHtml(hostile({title: '<img src=x onerror=alert(1)>'}), 'body');
  // The title alphabet has no angle brackets at all, so markup characters are gone rather than
  // merely escaped. escapeHtml still runs behind that as a second line of defence.
  const afterTitleTag = titled.slice(titled.indexOf('font-weight:600'));
  const titleText = afterTitleTag.slice(afterTitleTag.indexOf('">') + 2, afterTitleTag.indexOf('</div>'));
  check('title keeps no markup characters', !/[<>&]/.test(titleText), JSON.stringify(titleText));

  for (const accent of ['red" onmouseover="alert(1)', 'url(javascript:alert(1))', 'expression(alert(1))']) {
    const out = renderCalloutHtml(hostile({accent}), 'body');
    check(`accent rejected: ${JSON.stringify(accent)}`, !out.includes(accent), out.slice(0, SNIPPET));
  }
  for (const background of ['white" onload="alert(1)', 'url(//evil.example/x)']) {
    const out = renderCalloutHtml(hostile({background}), 'body');
    check(`background rejected: ${JSON.stringify(background)}`, !out.includes(background));
  }
  for (const icon of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<svg onload=alert(1)>']) {
    const out = renderCalloutHtml(hostile({icon}), 'body');
    // Escaped output legitimately still contains the characters as text; what must be gone is any
    // live tag, i.e. an unescaped '<'.
    check(`icon neutralised: ${JSON.stringify(icon)}`, !out.includes(icon) && !/<(?:img|svg|script)/i.test(out), out.slice(0, SNIPPET));
  }
  const keyed = renderCalloutHtml(hostile({key: 'X" onmouseover="alert(1)'}), 'body', 'src');
  check('key cannot break the data attribute', !keyed.includes('onmouseover='), keyed.slice(0, SNIPPET));

  check(
    'an image icon is refused outright',
    !renderCalloutHtml(
      hostile({icon: '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" width="16">'}),
      'b',
    ).includes('data:image'),
  );
  check(
    'legitimate colours still pass',
    renderCalloutHtml(hostile({}), 'b').includes('var(--ring-main-color, #3c8ee9)'),
  );
});

group('injection: the body cannot escape into markup', () => {
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(1)>',
    '[x](javascript:alert(1))',
    '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '`<b>code</b>`',
  ];
  for (const payload of payloads) {
    const out = renderCallouts(`> [!NOTE]\n> ${payload}`, types).text;
    const visible = out.slice(out.indexOf('style="display:flex'));
    check(
      `no live markup from ${JSON.stringify(payload.slice(0, LABEL))}`,
      !/<(?:script|img|svg|iframe|object)/i.test(visible) && !/href="(?:java|data)/i.test(visible),
      visible.slice(0, SNIPPET),
    );
  }
});

group('injection: the carried source cannot break its attribute', () => {
  for (const payload of ['" onmouseover="alert(1)', '"><script>alert(1)</script>', "'><b>x</b>"]) {
    const out = renderCallouts(`> [!NOTE]\n> ${payload}`, types).text;
    const attr = out.slice(out.indexOf('data-callout-src="') + 'data-callout-src="'.length);
    const value = attr.slice(0, attr.indexOf('"'));
    check(`attribute value stays intact for ${JSON.stringify(payload.slice(0, LABEL))}`,
      !value.includes('<') && !value.includes('>'), value);
    check(`round-trips ${JSON.stringify(payload.slice(0, LABEL))}`,
      revertCallouts(out).text === `> [!NOTE]\n> ${payload}`);
  }
});

group('injection: registry keys cannot pollute the lookup', () => {
  const stored = JSON.stringify({
    types: [
      {key: '__proto__', title: 'p', enabled: true},
      {key: 'constructor', title: 'c', enabled: true},
      {key: 'NOTE', title: 'Note', enabled: true},
    ],
  });
  const parsed = parseRegistry(stored).types.map((t) => t.key);
  // '__proto__' uppercases to '__PROTO__', which fails the key pattern. 'CONSTRUCTOR' passes and is
  // simply an unusual but legitimate keyword — uppercase can never collide with a prototype member.
  check('__proto__ is dropped', !parsed.includes('__PROTO__') && !parsed.includes('__proto__'),
    JSON.stringify(parsed));
  const index = indexEnabled(parseRegistry(stored).types);
  const inherited = ['TOSTRING', 'VALUEOF', 'HASOWNPROPERTY', 'CONSTRUCTOR_'];
  check('index answers nothing it was not given', inherited.every((k) => index[k] === undefined));
  check('index has no prototype at all', Object.getPrototypeOf(index) === null);
});

group('every render surface is clean under hostile input', () => {
  // There are exactly four places markup is produced, and all four go through renderCalloutHtml.
  // Rather than matching substrings, scan the output for the tags and attribute names it actually
  // emits: the guarantee is "no tag outside the allow-list and no event handler at all".
  const ALLOWED_TAGS = ['div', 'a', 'code', 'ul', 'ol', 'li', 'strong', 'em', 's', 'br', 'img'];

  /**
   * Walks tags and their attributes while respecting quoted values. A naive regex reports a false
   * positive here: `data-callout-src` legitimately carries the characters `onerror=` *inside* its
   * quoted value, which is inert, and a scanner that cannot see quotes would flag it as a handler.
   */
  const scan = (html: string): {tags: string[]; handlers: string[]; unsafeUrls: string[]} => {
    const tagRe = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?)*)\s*\/?>/g;
    const attrRe = /\s+([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]*))?/g;
    const tags: string[] = [];
    const handlers: string[] = [];
    const unsafeUrls: string[] = [];

    for (const tag of html.matchAll(tagRe)) {
      tags.push(tag[1].toLowerCase());
      for (const attr of (tag[2] ?? '').matchAll(attrRe)) {
        const name = attr[1].toLowerCase();
        const value = (attr[2] ?? '').replace(/^["']|["']$/g, '').trim().toLowerCase();
        if (name.startsWith('on')) {
          handlers.push(name);
        }
        if ((name === 'src' || name === 'href') && /^(javascript|data:text|vbscript)/.test(value)) {
          unsafeUrls.push(value.slice(0, LABEL));
        }
      }
    }
    return {tags: [...new Set(tags)], handlers, unsafeUrls};
  };

  const evilBody = '<img src=x onerror=alert(1)> "><svg onload=alert(1)> [a](javascript:alert(1))';
  const evilType = {
    key: 'X" onmouseover="alert(1)',
    title: '<img src=x onerror=alert(document.domain)>',
    accent: 'red" onmouseover="alert(1)',
    background: 'url(javascript:alert(1))',
    icon: '<script>alert(1)</script>',
    enabled: true,
  } as unknown as CalloutType;
  const evilRegistry = JSON.stringify({autoConvert: true, types: [{...evilType, key: 'EVIL'}]});

  const surfaces: Array<[string, string]> = [
    ['text in markdown (workflow rule)',
      renderCallouts(`> [!EVIL]\n> ${evilBody}`, indexEnabled(parseRegistry(evilRegistry).types)).text],
    ['markdown widget panel (stored config)', renderCalloutHtml(evilType, evilBody)],
    ['markdown widget config preview', renderCalloutHtml(evilType, evilBody)],
    ['project settings row preview', renderCalloutHtml(evilType, 'Body **b** [l](https://x.test).')],
  ];

  for (const [name, html] of surfaces) {
    const {tags, handlers, unsafeUrls} = scan(html);
    const stray = tags.filter((t) => !ALLOWED_TAGS.includes(t));
    check(`${name}: no unexpected tags`, stray.length === 0, JSON.stringify(stray));
    check(`${name}: no event handlers`, handlers.length === 0, JSON.stringify(handlers));
    check(`${name}: no unsafe urls`, unsafeUrls.length === 0, JSON.stringify(unsafeUrls));
  }
});

group('narrowed input alphabets', () => {
  const parse1 = (raw: Record<string, unknown>): CalloutType =>
    parseRegistry(JSON.stringify({types: [{key: 'NOTE', ...raw}]})).types[0];

  check('key accepts letters only',
    parseRegistry(JSON.stringify({types: [{key: 'SEC_1', title: 'x', enabled: true}]})).types.length === 0);
  check('key still accepts plain letters',
    parseRegistry(JSON.stringify({types: [{key: 'security', title: 'x', enabled: true}]})).types[0].key === 'SECURITY');

  check('title keeps letters, digits, spaces and hyphens',
    parse1({title: 'Best practice-2'}).title === 'Best practice-2');
  check('title keeps Cyrillic', parse1({title: 'Важно'}).title === 'Важно');
  check('title strips markup characters', parse1({title: '<b>Note</b>'}).title === 'bNoteb',
    parse1({title: '<b>Note</b>'}).title);

  check('icon accepts a pasted symbol', parse1({icon: '🔒'}).icon === '🔒');
  check('icon decodes a numeric entity', parse1({icon: '&#9888;'}).icon === '⚠', parse1({icon: '&#9888;'}).icon);
  check('icon decodes a hex entity', parse1({icon: '&#x1F512;'}).icon === '🔒', parse1({icon: '&#x1F512;'}).icon);
  check('a smuggled entity cannot become markup',
    !/[<>]/.test(parse1({icon: '&#60;script&#62;'}).icon), parse1({icon: '&#60;script&#62;'}).icon);
  check('an image icon falls back', parse1({icon: '<img src=x>'}).icon === 'ℹ');
});

group('the write path rejects instead of quietly cleaning', () => {
  check('valid input is accepted', findTypeProblem([
    {key: 'NOTE', title: 'Note', accent: '#3369d6', background: 'rgba(1,2,3,0.1)', icon: 'ℹ', enabled: true},
  ]) === null);

  const bad: Array<[string, Record<string, unknown>]> = [
    ['key with a digit', {key: 'NOTE1'}],
    ['key with punctuation', {key: 'NO-TE'}],
    ['title with markup', {title: '<b>x</b>'}],
    ['title with punctuation', {title: 'Note!'}],
    ['accent that is not a colour', {accent: 'red" onmouseover="x'}],
    ['background with url()', {background: 'url(javascript:1)'}],
    ['icon that is a tag', {icon: '<img src=x>'}],
    ['icon that is too long', {icon: 'aaaaaaaaaaaaaaaa'}],
  ];
  for (const [name, over] of bad) {
    const problem = findTypeProblem([
      {key: 'NOTE', title: 'Note', accent: '#3369d6', background: '#eeeeee', icon: 'i', enabled: true, ...over},
    ]);
    check(`rejected: ${name}`, problem !== null, 'accepted when it should not be');
  }
  check('duplicate keys are rejected', findTypeProblem([
    {key: 'NOTE', title: 'A', accent: '#111111', background: '#eeeeee', icon: 'i', enabled: true},
    {key: 'NOTE', title: 'B', accent: '#111111', background: '#eeeeee', icon: 'i', enabled: true},
  ]) !== null);
  check('a numeric entity icon is accepted on write', findTypeProblem([
    {key: 'NOTE', title: 'Note', accent: '#111111', background: '#eeeeee', icon: '&#9888;', enabled: true},
  ]) === null);
});

group('a transparent background is an omitted declaration', () => {
  const opaque: CalloutType =
    {key: 'NOTE', title: 'Note', accent: '#3369d6', background: '#eef4ff', icon: 'i', enabled: true};
  const clear: CalloutType = {...opaque, background: TRANSPARENT};

  check('an opaque type still paints a fill', renderCalloutHtml(opaque, 'body').includes('background:#eef4ff'));
  check('a transparent type paints none', !renderCalloutHtml(clear, 'body').includes('background'),
    renderCalloutHtml(clear, 'body').slice(0, SNIPPET));
  check('the accent bar survives, so the panel is still identifiable',
    renderCalloutHtml(clear, 'body').includes('border-left:3px solid #3369d6'));
  check('nothing else about the panel changes',
    renderCalloutHtml(opaque, 'body').replace('background:#eef4ff;', '') === renderCalloutHtml(clear, 'body'));

  for (const spelling of ['transparent', 'Transparent', '  TRANSPARENT  ']) {
    check(`recognised: ${JSON.stringify(spelling)}`,
      isTransparent(spelling) && !renderCalloutHtml({...opaque, background: spelling}, 'b').includes('background'));
  }
  check('a colour named like it is not mistaken for it', !isTransparent('transparentblue'));

  check('accepted by the write path', findTypeProblem([{...clear}]) === null);
  check('stored and read back verbatim',
    parseRegistry(JSON.stringify({types: [clear]})).types[0].background === TRANSPARENT);

  const clearIndex = indexEnabled([clear]);
  const converted = renderCallouts('> [!NOTE]\n> Body text.', clearIndex);
  check('conversion emits a transparent panel',
    converted.count === 1 && !converted.text.includes('background') && converted.text.split('\n').length === 1,
    converted.text.slice(0, SNIPPET));
  check('and it still reverts exactly',
    revertCallouts(converted.text).text === '> [!NOTE]\n> Body text.');
});

group('a type with no title renders a single row', () => {
  const titled: CalloutType =
    {key: 'NOTE', title: 'Note', accent: '#3369d6', background: '#eef4ff', icon: 'i', enabled: true};
  const bare: CalloutType = {...titled, title: ''};

  const html = renderCalloutHtml(bare, 'Short remark.');
  check('no heading element is emitted', !html.includes('font-weight:600'), html.slice(0, SNIPPET));
  check('an empty one is not emitted either — it would still take a line box',
    !html.includes('><\/div>') || !/font-weight/.test(html));
  check('the body sits directly in the text column',
    html.includes('word-break:break-word">Short remark.</div>'), html.slice(0, SNIPPET));
  check('the icon and the accent bar are untouched',
    html.includes('border-left:3px solid #3369d6') && html.includes('>i</div>'));
  check('exactly one element is dropped versus the titled panel',
    (html.match(/<div/g) ?? []).length === (renderCalloutHtml(titled, 'Short remark.').match(/<div/g) ?? []).length - 1);

  check('a list body still works', renderCalloutHtml(bare, '- one\n- two').includes('<li>'));

  check('empty means empty, it is not replaced by the built-in name',
    parseRegistry(JSON.stringify({types: [bare]})).types[0].title === '');
  check('a missing title still falls back to the built-in name',
    parseRegistry(JSON.stringify({types: [{key: 'NOTE', accent: '#111111', background: '#eee'}]})).types[0].title === 'Note');
  check('a missing title on a custom key falls back to the key',
    parseRegistry(JSON.stringify({types: [{key: 'SECURITY', accent: '#111111', background: '#eee'}]})).types[0].title === 'SECURITY');
  check('optionalTitle keeps a supplied empty string', optionalTitle('', 'Note') === '');
  check('optionalTitle falls back for a non-string', optionalTitle(undefined, 'Note') === 'Note');
  check('a title of pure punctuation cleans down to no heading', optionalTitle('!!!', 'Note') === '');

  check('accepted by the write path', findTypeProblem([bare]) === null);
  check('a non-string title is still rejected',
    findTypeProblem([{...bare, title: 42}]) !== null);

  const converted = renderCallouts('> [!NOTE]\n> Short remark.', indexEnabled([bare]));
  check('conversion emits one line with no heading',
    converted.count === 1 && converted.text.split('\n').length === 1 && !converted.text.includes('font-weight:600'),
    converted.text.slice(0, SNIPPET));
  check('and it still reverts exactly',
    revertCallouts(converted.text).text === '> [!NOTE]\n> Short remark.');
});

group('a widget snapshot survives the host storage round trip', () => {
  const bare = {key: 'PLAIN', title: '', accent: '#3369d6', background: '#eef4ff', icon: 'i'};
  // What the host hands back: the empty title is gone, everything else is intact.
  const {title: _dropped, ...afterStorage} = bare;
  const restored = restoreSnapshot(afterStorage as typeof bare);

  check('a dropped title is read as empty, not as absent', restored.title === '');
  check('so the panel keeps no heading',
    !renderCalloutHtml({...restored, enabled: true}, 'text').includes('font-weight:600'),
    renderCalloutHtml({...restored, enabled: true}, 'text').slice(0, SNIPPET));
  check('without the repair it would grow the built-in name',
    renderCalloutHtml({...(afterStorage as typeof bare), enabled: true}, 'text').includes('>Note</div>'));
  check('an empty title that did survive stays empty', restoreSnapshot(bare).title === '');
  check('a non-empty title is left alone', restoreSnapshot({...bare, title: 'Heads up'}).title === 'Heads up');
  check('the other fields are untouched',
    JSON.stringify({...restored, title: undefined}) === JSON.stringify({...bare, title: undefined}));
});

group('panels from the superseded comment format', () => {
  const legacy = [
    '<!--callout:WARNING',
    '> [!WARNING]',
    '> old body',
    '-->',
    '<div style="padding:4px">rendered</div>',
    '<!--/callout-->',
  ].join('\n');
  check('left alone by conversion', !renderCallouts(legacy, types).changed);
  const back = revertCallouts(legacy);
  check('still revertible', back.count === 1 && back.text === '> [!WARNING]\n> old body', JSON.stringify(back.text));
});

console.log(failures === 0 ? '\nALL PASSED\n' : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
