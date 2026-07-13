---
name: write-markdoc
metadata:
  version: "1.0"
description: >-
  Write, author, edit, and format DeveloperHub documentation pages in the correct
  Markdoc syntax. Use whenever a task involves creating or editing a DeveloperHub
  docs page; inserting or formatting a callout, code block, table, image, tabs,
  accordion, cards, video, badge, icon, or any other Markdoc block or inline tag;
  or when you need the exact syntax, attributes, defaults, or allowed values for a
  DeveloperHub Markdoc tag.
---

# Writing DeveloperHub Markdoc

DeveloperHub pages are authored in **Markdoc** — a superset of Markdown with a set
of typed custom tags. The same format is used when editing a page through the
editor, an API/AI edit, or a Git-synced repository: what you write is parsed into
the editor's document model, and what the editor produces is serialised back to
this exact syntax. Getting the shape right keeps that round-trip **lossless** —
emit a non-canonical shape and the edit churns on the first save or silently drops
content.

This skill is the ground truth for the syntax. For the full per-tag reference
(every attribute, default, and allowed value), read
[`references/blocks.md`](references/blocks.md).

## Core dialect rules

These hold for every tag. Break one and the round-trip breaks.

1. **Block tags sit on their own lines.** The open tag, the body, and the close
   tag are each on separate lines. Content on the same line as `{% tag %}`
   silently downgrades the tag to a plain paragraph.
   ```markdoc
   {% callout title="Note" %}
   Body goes here.
   {% /callout %}
   ```
2. **Inline tags are self-closing:** `{% icon classes="fas fa-star" /%}`.
3. **Booleans are bare, never quoted.** `open=true`, `showLineNumbers=false`. A
   quoted boolean (`open="false"`) becomes the truthy *string* `"false"` and
   silently inverts the setting.
4. **Numbers are bare too:** `width=357`, `colspan=2`. Strings are quoted:
   `title="Warning"`.
5. **Omit any attribute that equals its default.** The serialiser drops them, so
   adding them back only makes diffs noisier. The defaults are listed per tag in
   `references/blocks.md`. It is never *wrong* to include one; just match the
   surrounding page.
6. **Internal links carry real text:** `[Getting started](/support-center/start)`.
   A text-less link round-trips to nothing.
7. **Asset references stay verbatim.** An image `url="asset:zvlxyph4f37t"` is kept
   as-is; never resolve it to a URL. (Full `https://uploads.developerhub.io/…`
   URLs are also valid — use whichever the surrounding pages use.)
8. **Reserve `#` (H1) for the page title.** Body headings start at `##`.

## Standard Markdown

Plain Markdown works and is preferred wherever a custom tag is not needed:

- Headings `##` … `######`
- `**bold**`, `*italic*`, `~~strikethrough~~`, `` `inline code` ``
- `[links](/support-center/slug)` — root-relative for internal links
- Bullet (`-`) and ordered (`1.`) lists, including nested
- `> blockquote`
- `---` horizontal rule
- Fenced code blocks (see the reference)

Two things have no Markdown equivalent, so they are tags:

- **Underline:** `{% u %}underlined{% /u %}`
- **A link whose URL contains spaces or parentheses:**
  `{% link href="https://x.com/a (b)" %}text{% /link %}`

## The blocks at a glance

| Tag | Form | Purpose |
|---|---|---|
| `callout` | block | Coloured note / warning box |
| `code` + fences | block | Multi-language code tabs |
| ` ```lang ` fence | fence | A single code block |
| `code-steps` | block | Stepped code walkthrough |
| `table` / `row` / `cell` | block | Rich table (spans, alignment, backgrounds) |
| `image` | block | Image, with optional caption |
| `video` | block | Embedded / raw video |
| `tabs` / `tab` | block | Tabbed content |
| `accordion-group` / `accordion` | block | Collapsible sections |
| `cards` / `card` | block | Card grid or list |
| `conditional` | block | Audience-gated content |
| `html` | block | Raw custom HTML |
| `github-code` | block | Code pulled live from a GitHub URL |
| `index-list` | block | Auto index of child pages |
| `synced` | block | Reusable synced block, by id |
| `badge` | inline | Small coloured label |
| `key` | inline | Keyboard key |
| `icon` | inline | Font Awesome icon |
| `glossary` | inline | Glossary term |
| `inline-image` | inline | Inline image |
| `%KEY%` | inline | Variable placeholder |

## Cheat sheet

One of (almost) every block. Full attribute lists in
[`references/blocks.md`](references/blocks.md).

````markdoc
## A heading

A paragraph with **bold**, *italic*, and a [link](/support-center/blocks).

{% callout type="warning" title="Heads up" %}
A coloured note box. `type` is one of info, warning, success, error.
{% /callout %}

{% code %}
```php {% title="PHP" %}
echo 'first tab';
```

```javascript {% title="JS" %}
console.log('second tab');
```
{% /code %}

```js {% showLineNumbers=true title="Example" %}
const ready = true;
```

{% table layout="auto" %}
{% row %}
{% cell header=true %}
Header
{% /cell %}
{% cell header=true %}
Header
{% /cell %}
{% /row %}
{% row %}
{% cell %}
Cell
{% /cell %}
{% cell %}
Cell
{% /cell %}
{% /row %}
{% /table %}

{% image url="asset:zvlxyph4f37t" width=357 %}
Optional caption.
{% /image %}

{% video provider="raw" videoId="https://uploads.developerhub.io/example.mp4" /%}

{% tabs %}
{% tab title="Android" %}
Android content.
{% /tab %}
{% tab title="iOS" %}
iOS content.
{% /tab %}
{% /tabs %}

{% accordion-group %}
{% accordion title="Getting started" open=true %}
Collapsible content. Add `open=true` to expand it on load.
{% /accordion %}
{% accordion title="Advanced" %}
Second section.
{% /accordion %}
{% /accordion-group %}

{% cards %}
{% card title="Card 1" text="Description" link="/support-center/videos" /%}
{% card title="Card 2" text="Description" link="/support-center/callouts" /%}
{% /cards %}

{% conditional audience="enterprise" %}
Shown only to the enterprise audience.
{% /conditional %}

{% github-code url="https://github.com/acme/repo/blob/main/Makefile" /%}

{% index-list /%}

{% synced id="open-block-menu" /%}

{% html %}
<div style="background:red; height:50px">Custom widget</div>
{% /html %}

---

Inline: %product% and {% glossary term="coding" /%} and
{% badge text="Done" type="success" /%} and {% icon classes="fas fa-adjust" /%}
and {% key key="F1" /%} and {% inline-image url="asset:02grc2jqacve" width=14 /%}.
````

## When to use which block

| You want to… | Use | Not |
|---|---|---|
| Highlight a note, tip, or warning | `callout` (`type=`) | bold text |
| Show the same code in several languages | `code` with fenced tabs | one fence with mixed code |
| Walk through code step by step | `code-steps` | a numbered list of fences |
| A table with spans, alignment, or cell colours | `table` / `row` / `cell` | a GFM pipe table (it is rewritten) |
| Group alternative content the reader switches between | `tabs` / `tab` | headings |
| Collapse optional / long detail | `accordion-group` / `accordion` | `tabs` |
| A grid of navigation links | `cards` / `card` | a bullet list of links |
| Content for one audience only | `conditional` (`audience=`) | duplicating the page |
| A reusable snippet shared across pages | `synced` (`id=`) | copy-paste |

## Round-trip gotchas

These follow from the two-way sync. Ignoring them drops or mangles content on the
next save.

- **Keep block open/close tags on their own lines** (rule 1). This is the most
  common mistake.
- **Tables are `row` / `cell` trees**, not Markdown pipes. A pipe table is
  accepted on input but rewritten into the `{% table %}` form on the next save,
  so don't be surprised when your pipe grid comes back expanded.
- **Multi-language code is `{% code %}` wrapping bare fences**, each annotated with
  `{% title="…" %}`. There is **no** `{% tab %}` inside `{% code %}` — that tag is
  only for generic content tabs.
- **Line-number / wrap settings ride on the `{% code %}` open tag**, once, shared
  by every tab — not per fence.
- **Accordions collapse by default.** Add a bare `open=true` to expand one on load.
- **An intentionally empty paragraph** serialises as `{% p /%}`. You rarely write
  this by hand.
- **Custom HTML is best kept to a single logical line.** Multi-line *indented* HTML
  in `{% html %}` can lose its indentation on round-trip.
- **`conditional audience="…"` must name a real project audience.** Omit the
  attribute for public / all-audiences content.

## A note on page frontmatter

When editing a real `.md` file (Git-synced repos), the page may open with a YAML
`--- … ---` frontmatter block (`title`, `slug`, and similar). **Preserve it** and
put the Markdoc body after it. This skill covers the body; frontmatter fields are
project-specific, so mirror the sibling pages in the same folder.
