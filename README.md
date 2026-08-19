# <img src="/public/icon.svg" alt="" width="35" /> Callouts

Highlighted **Note**, **Tip**, **Important**, **Warning** and **Caution** panels for YouTrack issue
descriptions and knowledge base articles.

Authors write the standard GitHub-flavoured alert syntax:

```markdown
> [!WARNING]
> Do not run the migration on production without a backup.
> See the [runbook](https://example.com/runbook) and use `--dry-run` first.
```

…and the app turns it into a coloured panel when the text is saved.

## Why the panel is plain HTML, not an embedded frame

The rendered panel is inline-styled HTML that lives in the issue description or the article body.
That choice has consequences worth knowing about:

- the text inside a callout is **found by YouTrack search**;
- it appears in **PDF exports** and in **e-mail notifications**;
- colours use Ring UI variables with a hex fallback, so the panels follow the **light and dark
  theme** without any per-theme configuration;
- if the app is ever uninstalled, the panels **keep rendering** — nothing breaks and no placeholders
  are left behind.

## Two ways to write a callout

**As text.** Type the alert syntax anywhere in an issue description or an article. When the text is
saved, the app replaces the block with a panel that carries your original markdown along in its own
`data-callout-src` attribute, so the change stays reversible. YouTrack strips that attribute when it
renders the page, so readers never see it.

**Through the editor UI.** In the editor toolbar open **Images and embedded content** and insert the
**Callout** widget. Pick a type, type the text, save. Every inserted instance keeps its own settings.
Both routes share one set of types, and both are rendered by the same code, so they look identical.

> [!IMPORTANT]
> This widget needs a YouTrack instance that supports **borderless markdown widgets**. Where that is
> supported, the panel blends into the surrounding text. Where it is not supported yet, the widget
> still works but YouTrack draws its own bordered card with a header around it — write callouts as
> text there instead.

## Commands

The **Callouts** entry in an issue's or article's **⋯** menu offers:

- **Render callouts** — convert the syntax now, and opt this issue or article back into automatic
  conversion.
- **Revert to source** — restore the original markdown and stop converting this issue or article.
  Reverting has to switch automatic conversion off, otherwise the next save would undo it. Use
  **Render callouts** to turn it back on.

Reverting restores what the panel carries in `data-callout-src`. If someone edited the generated
HTML by hand, that edit is lost — the carried source is the source of truth.

## Configuration

**Project settings → Callouts** lets a project administrator:

- switch automatic conversion on or off for the project;
- enable or disable individual types;
- rename a type, or change its accent colour, background and icon;
- tick **Transparent** to drop the fill, leaving the coloured bar on the left and the panel sitting
  directly on the page background;
- add custom types with their own syntax keyword, for example `> [!SECURITY]`.

Field rules are deliberately narrow: a **syntax key** is letters only, a **title** takes letters
(any alphabet), digits, spaces and hyphens, and an **icon** is a single symbol — paste `⚠` or type
its code `&#9888;` and it is converted for you. Images and links are not accepted as icons.

Colours take a hex value, `rgb()` / `rgba()`, `hsl()` / `hsla()`, a CSS colour name, or a Ring UI
variable with a fallback such as `var(--ring-warning-color, #d98a00)`. The **Transparent** checkbox
is the background field spelled `transparent`, so typing a colour over it clears the checkbox again.

Each row shows a live preview rendered with the same code that produces the real panels. Changing
these settings requires the **Update project** permission.

## What is left alone

- **Fenced code blocks are never touched**, so documentation that shows callout syntax in an example
  keeps working.
- A block whose keyword is unknown or disabled stays as ordinary markdown.
- The keyword must be alone on the first line of the quote, exactly as in the GitHub syntax.
- Conversion is idempotent: re-saving already converted text changes nothing.

## Formatting inside a callout

YouTrack does not process markdown inside an HTML block, so the app converts the callout body
itself. Supported: `**bold**`, `*italic*`, `` `code` ``, `~~strikethrough~~`, `[links](url)`,
bulleted and numbered lists, and line breaks. Not supported inside a callout: images, tables and
nested blocks. Any HTML in the body is escaped and shown literally.

## Requirements

Callouts written as text need nothing special — that mode works on any instance where the app can be
installed.

The **Callout** widget additionally needs an instance that supports **borderless markdown widgets**.
Where that support is not there yet, the widget still works, but appears inside a bordered card with
a header instead of blending into the text; use the text mode until it arrives.

## Installation

### Manually

1. `npm install`
2. `npm run build`
3. Archive "dist" folder into a single ZIP file
4. Go to `/admin/apps` and import app from ZIP archive
5. Select desired projects on projects tab in the app sidebar

### With CLI

1. `npm install`
2. `npm run build && npm run upload -- --host %YOUTRACK_URL% --token %PERMANENT_USER_TOKEN%`
3. Select desired projects on the apps page
