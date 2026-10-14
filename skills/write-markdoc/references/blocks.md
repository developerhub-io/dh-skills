# DeveloperHub Markdoc: full block & tag reference

Every DeveloperHub Markdoc tag, its form, attributes, defaults, and allowed
values. Read [`../SKILL.md`](../SKILL.md) first for the core dialect rules.

**Conventions used below**

- **Form**: `block` (`{% x %}…{% /x %}`), `inline` (`{% x /%}`, self-closing), or
  `fence` (a fenced code block with `{% … %}` annotations).
- **Default**: omit the attribute when its value equals this; the serialiser does.
- Booleans are **bare** (`open=true`); numbers are bare (`width=357`); strings are
  quoted (`title="Note"`).

---

## Text & inline marks

Prefer plain Markdown for all of these.

| Construct | Syntax |
|---|---|
| Bold | `**bold**` |
| Italic | `*italic*` |
| Strikethrough | `~~struck~~` |
| Inline code | `` `code` `` |
| Underline | `{% u %}underlined{% /u %}` (no Markdown equivalent) |
| Link | `[text](/support-center/slug)` |
| Link with spaces, parens, or `<` `>` in URL | `{% link href="https://x.com/a (b)" %}text{% /link %}` |
| Heading | `##` … `######` (reserve `#` for the page title) |
| Bullet list | `- item` (nest by indenting) |
| Ordered list | `1. item` (a non-1 start is honoured) |
| Blockquote | `> quoted` |
| Horizontal rule | `---` |
| Hard line break | a trailing `\` at the end of the line |
| Empty paragraph | `{% p /%}` (rarely authored by hand) |

Links must carry real text: a text-less link round-trips to nothing. The
serialiser backslash-escapes literal specials (`` ` `` `*` `_` `~` `[` `]` `{`
`}` `<` `>` `&`) in plain text, so hand-written unescaped ones are rewritten on
the next save (churn, not loss).

---

## Blocks

### `callout`

Coloured note / warning box. Body holds arbitrary block content.

```markdoc
{% callout type="warning" title="Changing hosting settings" %}
Redirect any external links if you change hosting after publishing.
{% /callout %}
```

| Attr | Type | Default | Values |
|---|---|---|---|
| `type` | enum | `info` | `info`, `warning`, `success`, `error` |
| `title` | string | `""` | rendered as a header row when set |

> The type for a red/error box is **`error`**, not "danger".

### `code` (multi-language tabs)

Wraps one or more **bare fenced blocks**, each a language tab. There is **no**
`{% tab %}` inside `{% code %}`. Line-number and wrap settings ride on the open
tag, once, shared by every tab.

````markdoc
{% code showLineNumbers=true %}
```javascript {% title="JavaScript" %}
console.log("hi");
```

```python {% title="Python" %}
print("hi")
```
{% /code %}
````

| Attr | Type | Default | Notes |
|---|---|---|---|
| `showLineNumbers` | boolean | `false` | shared by all tabs |
| `wrapLine` | boolean | `true` | shared by all tabs |

Content model: **only** bare code fences.

### Fenced code block (single)

A single code block. Language on the info string; annotations in `{% … %}` after
it.

````markdoc
```javascript {% title="fibonacci.js" showLineNumbers=true highlightLines="2,4-6" %}
function fibonacci(num) {
  return num <= 1 ? 1 : fibonacci(num - 1) + fibonacci(num - 2);
}
```
````

| Annotation | Type | Default | Notes |
|---|---|---|---|
| `title` | string | `Code` | shown in the block header |
| `showLineNumbers` | boolean | `false` | omit inside `{% code %}` (set it there) |
| `wrapLine` | boolean | `true` | omit inside `{% code %}` |
| `highlightLines` | string | `""` | e.g. `"1,3-5"` |
| `id` | string | none | only inside `code-steps` (see below) |

The language comes from the fence token itself (` ```js `); default `plaintext`.

### `code-steps`

A stepped walkthrough: a lead description, then `{% step %}` tags, then one fenced
language block per step. Each fence carries an `id` that a step's `codeId` points
at.

````markdoc
{% code-steps title="Set up the client" %}
Intro prose describing the walkthrough.

{% step title="Install" codeId="install" %}
Install the package.
{% /step %}

```bash {% id="install" title="Terminal" %}
npm install @acme/sdk
```
{% /code-steps %}
````

`code-steps` attrs:

| Attr | Type | Default |
|---|---|---|
| `title` | string | `Code Steps` |

`step` attrs:

| Attr | Type | Default | Notes |
|---|---|---|---|
| `title` | string | `""` | |
| `codeId` | string | `""` | matches a fence `id` in this block |
| `highlightLines` | string | `""` | |

Inside `code-steps`, a language fence's `showLineNumbers` defaults to `true`.

### `table` / `row` / `cell`

An explicit `row` / `cell` tree. Each cell body is itself block content. A plain
table serialises as a normal GFM pipe table; this tag form is used when the table
needs cell spans, backgrounds, column widths, mixed (non-uniform) alignment,
multi-paragraph cells, a headerless shape, the fluid `auto` layout, or a pinned
header row.

```markdoc
{% table layout="auto" %}
{% row %}
{% cell header=true %}
Parameter
{% /cell %}
{% cell header=true align="right" %}
Type
{% /cell %}
{% /row %}
{% row %}
{% cell %}
user_id
{% /cell %}
{% cell %}
int
{% /cell %}
{% /row %}
{% /table %}
```

`table` attrs:

| Attr | Type | Default | Values |
|---|---|---|---|
| `layout` | enum | `fixed` | `fixed`, `auto` (last column fluid) |
| `stickyHeader` | boolean | `false` | `true` pins the header row while the table body scrolls |

`row`: no attributes; contains `cell` children only.

`cell` attrs:

| Attr | Type | Default | Values |
|---|---|---|---|
| `header` | boolean | `false` | `true` renders as a header cell |
| `align` | enum | (none) | `left`, `center`, `right` |
| `bg` | string | (none) | CSS colour, e.g. `#f6f6f6` |
| `colspan` | number | `1` | |
| `rowspan` | number | `1` | |
| `colwidth` | number | (none) | column width in px |

> A plain pipe table is canonical and round-trips as a pipe table, uniform
> per-column alignment included. It is only rewritten into this `{% table %}`
> form when it uses something pipes cannot express.

### `image`

Block image. Self-closing when there is no caption; body form when there is one
(the body is the caption, inline content only).

```markdoc
{% image url="asset:zvlxyph4f37t" width=357 /%}
```

```markdoc
{% image url="https://uploads.developerhub.io/prod/02/example.png" %}
A caption sits in the body.
{% /image %}
```

| Attr | Type | Default | Values |
|---|---|---|---|
| `url` | string | `""` | `asset:<id>` (kept verbatim) or a full upload URL |
| `width` | number | `0` | px; `0` = natural/full width |
| `align` | enum | `center` | `left`, `center`, `right` |

### `video`

Embedded or raw video. Self-closing.

```markdoc
{% video provider="loom" videoId="e5b8c04bca094dd8a5507925ab887002" /%}
{% video provider="raw" videoId="https://uploads.developerhub.io/example.mp4" /%}
```

| Attr | Type | Default | Values |
|---|---|---|---|
| `provider` | enum | `youtube` | `youtube`, `vimeo`, `loom`, `raw` |
| `videoId` | string | `""` | the id for embeds; the full URL for `raw` (mp4/webm/ogg) |
| `params` | string | `""` | e.g. `start=30` |

### `tabs` / `tab`

Generic tabbed content the reader switches between. Distinct from `{% code %}`.

```markdoc
{% tabs %}
{% tab title="Android" %}
Android content.
{% /tab %}
{% tab title="iOS" %}
iOS content.
{% /tab %}
{% /tabs %}
```

`tabs`: no attributes; contains `tab` children only.

`tab` attrs:

| Attr | Type | Default |
|---|---|---|
| `title` | string | `Tab` |

### `accordion-group` / `accordion`

Collapsible sections. Each section is **collapsed on load** by default; add a bare
`open=true` to expand it initially.

```markdoc
{% accordion-group %}
{% accordion title="Getting started" open=true %}
Any block content can go inside an accordion.
{% /accordion %}
{% accordion title="Advanced features" %}
Second section.
{% /accordion %}
{% /accordion-group %}
```

`accordion-group`: no attributes; contains `accordion` children only.

`accordion` attrs:

| Attr | Type | Default | Notes |
|---|---|---|---|
| `title` | string | `Accordion` | |
| `open` | boolean | `false` | `open=true` = expanded on page load |

### `cards` / `card`

A grid (default) or list of link cards. Each card is a self-closing `{% card /%}`.

```markdoc
{% cards view="grid" %}
{% card title="Getting Started" text="Set up your first project." link="/support-center/getting-started" /%}
{% card title="Hosting" text="Custom domains and SSL." link="/support-center/hosting" /%}
{% /cards %}
```

`cards` attrs:

| Attr | Type | Default | Values |
|---|---|---|---|
| `view` | enum | `grid` | `grid`, `list` |

`card` attrs:

| Attr | Type | Default |
|---|---|---|
| `title` | string | `""` |
| `text` | string | `""` |
| `link` | string | `/` |

### `conditional`

Wraps content shown only to a given audience (personalised / private docs).
Resolved server-side.

```markdoc
{% conditional audience="beta-users" %}
Content only beta users see.
{% /conditional %}
```

| Attr | Type | Default | Notes |
|---|---|---|---|
| `audience` | string | `""` | a real project audience id; omit for public content |

### `html`

Raw custom HTML. The HTML is the body, not an attribute. Keep it to a single
logical line where practical; multi-line indented HTML can lose indentation on
round-trip.

```markdoc
{% html %}
<div class="promo">Custom widget</div>
{% /html %}
```

No attributes.

### `github-code`

Embeds code straight from a GitHub file URL (optionally a line range in the
fragment). Self-closing.

```markdoc
{% github-code url="https://github.com/torvalds/linux/blob/master/kernel/signal.c#L152-L170" /%}
```

| Attr | Type | Default |
|---|---|---|
| `url` | string | `""` |

### `index-list`

Auto-generates an index of the current page's children. Self-closing, no
attributes.

```markdoc
{% index-list /%}
```

### `synced`

Inserts a reusable synced block by its id (managed in the project, not in the
file). Self-closing.

```markdoc
{% synced id="open-block-menu" /%}
```

A block can declare variables, and each placement of it can set its own values
for them with `variables=`, an object of name to string, so the same block
placed twice on one page can read differently. A name left out, set to `""`, or
set to only spaces shows the block's default. A name the block does not declare
is ignored. A value is one line of text of at most 500 characters; a longer one
is cut, and spaces at either end are dropped. Always quote a value: an unquoted
number is read as a number first, so `2.10` is stored as `2.1`.

```markdoc
{% synced id="install-steps" variables={"tool":"Acme Cloud","version":"3.0"} /%}
```

| Attr | Type | Default |
|---|---|---|
| `id` | string | `welcome` |
| `variables` | object (name → string) | none, so every variable shows its default |

Keep `variables=` exactly as you found it unless you are asked to change a
value: it is this placement's own values, and dropping it puts the placement
back on the block's defaults.

In a Git-synced repo the block itself is `_synced-blocks/<id>.md`. Its
frontmatter declares the variables and their defaults under `variables:`, and
its body uses them as `{% $name %}` in text and `%name%` inside code. Write
every value in quotes, as below. (The sync quotes a value with a space in it or
one YAML would read as something other than text, and leaves a plain word like
`Acme` bare, so a quoted plain word loses its quotes on the next write back,
which is harmless.) An unquoted value on its
name's own line is read as written (`version: 2.10` stays `2.10`) and quoted on
the next write back. Anywhere else (`variables: {version: 2.10}` on one line or
several, or the list form `- name: version` with `default: 2.10`) YAML has
already made a number, boolean or date of an unquoted value, and the file is
refused until it is quoted:

````markdoc
---
title: 'Install steps'
variables:
  tool: 'Acme CLI'
  version: '2.1'
---

Install {% $tool %} version {% $version %}:

```bash
npm install acme-cli@%version%
```
````

`{% $name %}` means something only inside a block file: written in a page, it
renders nothing. A name starts with a letter, has 2 to 128 characters, and
uses only letters, numbers and underscores. A default is one line of text of at
most 500 characters.

---

## Inline tags

All self-closing, all sit inside a line of text.

### `badge`

Small coloured label.

```markdoc
{% badge text="Done" type="success" /%}
```

| Attr | Type | Default | Values |
|---|---|---|---|
| `text` | string | `OK` | the label |
| `type` | enum | `info` | `info`, `success`, `warning`, `error`, `primary`, `custom` |

### `key`

A keyboard key. Multi-key strings like `cmd shift k` are prettified to glyphs
(`⌘ ⇧ k`) on render.

```markdoc
{% key key="F1" /%}  {% key key="⌘" /%}
```

| Attr | Type | Default |
|---|---|---|
| `key` | string | `Esc` |

### `icon`

A Font Awesome icon.

```markdoc
{% icon classes="fas fa-adjust" /%}
```

| Attr | Type | Default |
|---|---|---|
| `classes` | string | `fas fa-star` |

`classes` is a style plus a name: `fas fa-{name}` (solid), `far fa-{name}` (regular),
or `fab fa-{name}` (brands). DeveloperHub ships **FontAwesome 7 Free**, and the name is
never validated, so an icon that is not in that set renders as blank space with no
error. Take the name from the companion `organize-docs-repo` skill's
[`fontawesome-icons.md`](../../organize-docs-repo/references/fontawesome-icons.md),
which lists every icon that can be drawn.

### `glossary`

Links a word to its glossary entry (the definition is resolved live from the
project glossary).

```markdoc
{% glossary term="coding" /%}
```

| Attr | Type | Default |
|---|---|---|
| `term` | string | `term` |

### `inline-image`

An image sized to sit inline with text.

```markdoc
{% inline-image url="asset:02grc2jqacve" width=14 /%}
```

| Attr | Type | Default | Values |
|---|---|---|---|
| `url` | string | `""` | `asset:<id>` (verbatim) or a full URL |
| `width` | number | `0` | px; applies in `resizable` mode |
| `mode` | enum | `resizable` | `resizable`, `w100` (fit width), `fit` |

---

## Variables

Variables are written in **percent form**, not as a tag:

```markdoc
%product%      renders the project product name (e.g. "DeveloperHub")
%user.name%    dotted keys resolve into nested values
```

- Keys are dotted identifiers (`api.base`). A key segment never starts with a
  digit (`%2fa%` stays literal text).
- Never echo `%product%` back to a user as literal text, and never replace it in
  source.
- A `%…%` inside inline code or a code fence stays literal.
- An undefined key shows as `{{key}}` in the editor and renders as empty text on
  the published page.

---

## Nesting rules

- `accordion-group` → `accordion` only; `accordion` → any block.
- `tabs` → `tab` only; `tab` → any block.
- `code` → bare code fences only (no `{% tab %}`).
- `code-steps` → lead blocks, then `step` tags, then language fences.
- `table` → `row` → `cell`; a `cell` holds any block content.
- `callout`, `conditional` → any block (they can nest tabs, callouts, etc.).
- `image` body → caption (inline content only).
- `video`, `cards`, `github-code`, `index-list`, `synced`, `html` → no children.
- Inline tags (`badge`, `glossary`, `icon`, `key`, `inline-image`) and `%KEY%`
  variables live inside a line of text.
