/**
 * Callout type definitions and the per-project registry that stores them.
 *
 * Colours are emitted verbatim into an inline `style` attribute, which is the only attribute
 * YouTrack's HTML filter keeps. Accents therefore use a Ring UI variable with a hex fallback so
 * they follow the instance palette, while backgrounds are alpha tints of the same hue so they
 * stay legible in both the light and the dark theme without needing a media query.
 *
 * Icons are stored as the symbol itself rather than as an HTML entity: it is what an author would
 * paste, and it keeps `&` out of the accepted alphabet entirely.
 */

export interface CalloutType {
  /** Token used in the `> [!KEY]` syntax. Uppercase A-Z only, unique within a project. */
  key: string;
  /** Heading rendered inside the panel. */
  title: string;
  /** Border and heading colour. Any CSS colour value. */
  accent: string;
  /** Panel background. Any CSS colour value. */
  background: string;
  /** Leading glyph: a single symbol, for example ℹ or 💡. */
  icon: string;
  enabled: boolean;
}

export const BUILTIN_TYPES: readonly CalloutType[] = [
  {
    key: 'NOTE',
    title: 'Note',
    accent: 'var(--ring-main-color, #3c8ee9)',
    background: 'rgba(60, 142, 233, 0.10)',
    icon: 'ℹ',
    enabled: true,
  },
  {
    key: 'TIP',
    title: 'Tip',
    accent: 'var(--ring-success-color, #57a64a)',
    background: 'rgba(87, 166, 74, 0.10)',
    icon: '💡',
    enabled: true,
  },
  {
    key: 'IMPORTANT',
    title: 'Important',
    accent: 'var(--ring-hint-color, #8c65d4)',
    background: 'rgba(140, 101, 212, 0.10)',
    icon: '❗',
    enabled: true,
  },
  {
    key: 'WARNING',
    title: 'Warning',
    accent: 'var(--ring-warning-color, #d98a00)',
    background: 'rgba(217, 138, 0, 0.10)',
    icon: '⚠',
    enabled: true,
  },
  {
    key: 'CAUTION',
    title: 'Caution',
    accent: 'var(--ring-error-color, #db5860)',
    background: 'rgba(219, 88, 96, 0.10)',
    icon: '⛔',
    enabled: true,
  },
];

const MAX_TYPES = 40;
export const MAX_TITLE = 60;
/** An icon is one symbol. The allowance covers emoji built from several code units. */
export const MAX_ICON = 8;
const MAX_STYLE = 200;

/**
 * The fields below are deliberately narrow rather than merely escaped.
 *
 * Each of them ends up inside generated HTML — the key in a `data-` attribute, the title and icon as
 * element content, the colours inside a `style` attribute. Keeping the accepted alphabet tiny means
 * there is nothing to escape in the first place, which is a much shorter thing to verify than a
 * sanitiser. Colours are the exception: they need brackets and dashes to be valid CSS, so they get
 * an allow-list of shapes instead.
 *
 * These run in the renderer, not only when storing, because the renderer is also fed by a widget's
 * own saved configuration — which anyone who can edit an issue is able to write.
 */
const KEY_PATTERN = /^[A-Z]{1,24}$/;
/** Letters of any script, digits, spaces and hyphens. Deliberately no punctuation or markup. */
const TITLE_ALLOWED = /[^\p{L}\p{N} -]/gu;
/** Anything that could start markup or an entity is not a symbol. */
const ICON_HAS_FORBIDDEN = /[<>&"'`]/;

const COLOUR_LITERAL = String.raw`#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%/]{1,60}\)|hsla?\([\d\s.,%/a-z]{1,60}\)|[a-zA-Z]{3,20}`;
const CSS_COLOUR = new RegExp(
  `^(?:${COLOUR_LITERAL}|var\\(\\s*--[a-zA-Z0-9-]{1,60}\\s*(?:,\\s*(?:${COLOUR_LITERAL})\\s*)?\\))$`,
);

export function safeKey(value: unknown, fallback: string): string {
  const key = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return KEY_PATTERN.test(key) ? key : fallback;
}

export function safeColour(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length <= MAX_STYLE && CSS_COLOUR.test(value.trim())
    ? value.trim()
    : fallback;
}

/**
 * Turns `&#9888;` / `&#x26A0;` into the character it denotes.
 *
 * Numeric entities are accepted as *input* only, because plenty of people know an icon by its code.
 * They are decoded here and never stored, so `&` stays out of the value: keeping it would mean the
 * output carried a second decoding layer, and `&#60;script&#62;` would become markup at render time.
 * Decoding first also means a smuggled `<` is caught by the character filter below.
 */
export function decodeNumericEntities(value: string): string {
  const MAX_CODE_POINT = 0x10ffff;
  return value.replace(/&#(x[0-9a-fA-F]{1,6}|\d{1,7});/g, (match, digits: string) => {
    const code = digits[0].toLowerCase() === 'x'
      ? parseInt(digits.slice(1), 16)
      : parseInt(digits, 10);
    return Number.isFinite(code) && code > 0 && code <= MAX_CODE_POINT
      ? String.fromCodePoint(code)
      : match;
  });
}

/**
 * An icon is a single symbol — ℹ, ⚠, 💡 — stored as the character itself. Images and links are not
 * accepted: they would make every reader's browser fetch a third-party URL, and the feature does
 * not need them.
 */
export function safeIcon(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const decoded = decodeNumericEntities(value).trim();
  // Unlike a title, a symbol is atomic: stripping the markup out of `<img src=x>` would leave the
  // reader looking at "img srcx". Anything that is not already a symbol falls back to the default.
  if (decoded.length === 0 || ICON_HAS_FORBIDDEN.test(decoded)) {
    return fallback;
  }
  return decoded.slice(0, MAX_ICON);
}

/**
 * Disallowed characters are stripped rather than rejected, and an over-long title is trimmed rather
 * than thrown away: silently swapping in a different title after the user pressed Save is more
 * surprising than quietly shortening theirs.
 */
export function safeTitle(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const cleaned = value.replace(TITLE_ALLOWED, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);
  return cleaned.length > 0 ? cleaned.trimEnd() : fallback;
}

/**
 * Strict validation for the write path.
 *
 * Reading and rendering repair whatever they are given, because a panel cannot show an error and a
 * safe default beats refusing to draw. Writing is the opposite: silently storing something other
 * than what the caller sent hides both mistakes and attacks, so the endpoint rejects instead.
 *
 * @returns the first problem found, or null when everything is acceptable.
 */
export function findTypeProblem(types: unknown): string | null {
  if (!Array.isArray(types)) {
    return 'types must be an array';
  }
  if (types.length > MAX_TYPES) {
    return `at most ${MAX_TYPES} types are allowed`;
  }
  const seen = new Set<string>();
  for (let i = 0; i < types.length; i += 1) {
    const problem = findFieldProblem(types[i], i, seen);
    if (problem) {
      return problem;
    }
  }
  return null;
}

function findFieldProblem(raw: unknown, index: number, seen: Set<string>): string | null {
  const at = `type #${index + 1}`;
  if (!raw || typeof raw !== 'object') {
    return `${at}: not an object`;
  }
  const input = raw as Record<string, unknown>;
  const key = typeof input.key === 'string' ? input.key.trim().toUpperCase() : '';
  if (!KEY_PATTERN.test(key)) {
    return `${at}: key must be 1-24 letters, got ${JSON.stringify(input.key)}`;
  }
  if (seen.has(key)) {
    return `${at}: duplicate key ${key}`;
  }
  seen.add(key);
  if (typeof input.title !== 'string' || safeTitle(input.title, '') !== input.title.trim()) {
    return `${at}: title may contain only letters, digits, spaces and hyphens (max ${MAX_TITLE})`;
  }
  if (safeColour(input.accent, '') === '') {
    return `${at}: accent must be a colour, e.g. #3369d6, rgba(...) or var(--ring-main-color, #3369d6)`;
  }
  if (safeColour(input.background, '') === '') {
    return `${at}: background must be a colour, e.g. rgba(51, 105, 214, 0.10)`;
  }
  // A numeric entity is legitimate input, so compare against the decoded form rather than the raw
  // one; what must not survive decoding is any character that could start markup.
  if (typeof input.icon !== 'string') {
    return `${at}: icon must be a single symbol such as ℹ or 💡`;
  }
  const decoded = decodeNumericEntities(input.icon).trim();
  if (decoded.length === 0 || decoded.length > MAX_ICON || ICON_HAS_FORBIDDEN.test(decoded)) {
    return `${at}: icon must be a single symbol such as ℹ or 💡, with no markup or links`;
  }
  return null;
}

/**
 * Coerces one untrusted record into a CalloutType, or returns null when the key is unusable.
 * Everything else falls back to the matching built-in, or to the NOTE styling.
 */
function sanitizeType(raw: unknown): CalloutType | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const input = raw as Record<string, unknown>;
  const key = safeKey(input.key, '');
  if (key === '') {
    return null;
  }
  const builtin = BUILTIN_TYPES.find((type) => type.key === key) ?? BUILTIN_TYPES[0];
  return {
    key,
    title: safeTitle(input.title, builtin.key === key ? builtin.title : key),
    accent: safeColour(input.accent, builtin.accent),
    background: safeColour(input.background, builtin.background),
    icon: safeIcon(input.icon, builtin.icon),
    enabled: input.enabled !== false,
  };
}

/**
 * Per-project configuration. `autoConvert` lets an admin stop the rule from rewriting content
 * while keeping the manual commands, without having to uninstall the app.
 */
export interface CalloutRegistry {
  autoConvert: boolean;
  types: CalloutType[];
}

function defaults(): CalloutRegistry {
  return {autoConvert: true, types: BUILTIN_TYPES.map((type) => ({...type}))};
}

function sanitizeList(raw: unknown[]): CalloutType[] {
  const seen = new Set<string>();
  const types: CalloutType[] = [];
  for (const entry of raw) {
    if (types.length >= MAX_TYPES) {
      break;
    }
    const type = sanitizeType(entry);
    if (type && !seen.has(type.key)) {
      seen.add(type.key);
      types.push(type);
    }
  }
  return types;
}

/**
 * Parses stored configuration, dropping anything malformed and falling back to the built-ins.
 * A bare array is accepted as well as the wrapped object, so data written by an earlier version
 * keeps working.
 */
export function parseRegistry(json: string | undefined | null): CalloutRegistry {
  if (!json) {
    return defaults();
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return defaults();
  }

  const list = Array.isArray(raw) ? raw : (raw as {types?: unknown})?.types;
  const autoConvert = Array.isArray(raw) ? true : (raw as {autoConvert?: unknown})?.autoConvert !== false;
  if (!Array.isArray(list)) {
    return defaults();
  }
  // A stored-but-empty list is a deliberate "no types here" and is honoured. Only a missing or
  // unparseable value falls back to the built-ins.
  return {autoConvert, types: sanitizeList(list)};
}

export function serializeRegistry(registry: CalloutRegistry): string {
  return JSON.stringify({autoConvert: registry.autoConvert, types: registry.types});
}

/**
 * Only enabled types participate in conversion, indexed by their syntax token.
 *
 * The index has a null prototype. Keys are uppercase so they cannot collide with `constructor` or
 * `__proto__` today, but a lookup table built from stored data should not be able to answer for
 * inherited members at all.
 */
export function indexEnabled(types: CalloutType[]): Record<string, CalloutType> {
  const index = Object.create(null) as Record<string, CalloutType>;
  types.filter((type) => type.enabled).forEach((type) => {
    index[type.key] = type;
  });
  return index;
}
