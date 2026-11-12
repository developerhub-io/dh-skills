# Conversion rules for any source

How each construct found in other docs tools becomes DeveloperHub Markdoc. The exact
syntax of every target tag is in
[`write-markdoc/references/blocks.md`](../../write-markdoc/references/blocks.md); this
file decides **which** target to use and lists the traps that lose content. The
per-tool spellings (which marker means "note" in MkDocs, what a Mintlify `<Steps>`
looks like) are in [`source-platforms.md`](source-platforms.md).

## Contents

- [What DeveloperHub does with unknown input](#what-developerhub-does-with-unknown-input)
- [Frontmatter](#frontmatter)
- [Headings](#headings)
- [Admonitions and callouts](#admonitions-and-callouts)
- [Collapsible sections](#collapsible-sections)
- [Tabs](#tabs)
- [Code](#code)
- [Steps](#steps)
- [Cards, grids and columns](#cards-grids-and-columns)
- [Tables](#tables)
- [Field and parameter lists](#field-and-parameter-lists)
- [Images, figures and videos](#images-figures-and-videos)
- [Links](#links)
- [Raw HTML](#raw-html)
- [Includes, partials and snippets](#includes-partials-and-snippets)
- [Variables and templating](#variables-and-templating)
- [Math](#math)
- [Diagrams](#diagrams)
- [Small inline constructs](#small-inline-constructs)
- [Text that looks like syntax](#text-that-looks-like-syntax)

## What DeveloperHub does with unknown input

Test results from DeveloperHub's own converter. None of these raise an error on
import: the page imports and looks wrong. Fix every one before handing over.

| Input | What the reader sees |
|---|---|
| Raw HTML outside `{% html %}` (`<div>`, `<br>`, `<kbd>`, `<details>`, `<img>`) | The tags as literal text. |
| An unknown `{% tag %}` (GitBook's `{% hint %}`, Liquid's `{% raw %}`) | Nothing. An unclosed one also swallows the rest of the page. |
| A JSX component (`<Note>`, `<Tabs>`) | Literal text. |
| `import` / `export` lines | Literal text. |
| A setext heading underlined with `---` | A paragraph followed by a horizontal rule. Use `##` headings. |
| A setext heading underlined with `===` | One paragraph, with the `===` as text. |
| An indented (4-space) code block | Its lines joined into one paragraph of prose. Use a fence. |
| A custom heading id `## Title {#id}` | The `{#id}` as part of the heading text. |
| An HTML comment `<!-- … -->` | The comment as literal text. |
| A GitHub alert `> [!NOTE]` | A quote that starts with the text `[!NOTE]`. |
| A footnote `[^1]` and its definition | Literal text. |
| A task list `- [ ] item` | A bullet that starts with `[ ]`. |
| A definition list (`Term` / `: Definition`) | One paragraph, `Term : Definition`. |
| Emoji shortcodes `:tada:` | Literal text. |
| `~sub~`, `^sup^`, `==mark==` | Literal text. |
| A pipe inside inline code in a pipe table, unescaped | The cell is cut at the pipe and the rest is lost. |
| `![alt](image.png)` on its own line | An **inline** image, not a block image, and the alt text is gone. |
| `%NAME%` in prose (Windows `%PATH%`) | A variable: empty on the published page unless defined. |

| A reference-style link or image to a file in the folder (`[text][ref]` + `[ref]: ./install.md`) | A link or image that keeps the repository path and is broken: the sync rewrites only inline links and images. |
| Link text that wraps onto the next line, around a relative target | The same broken link: the sync rewrites one line at a time. |
| A `"` inside a tag attribute (`title="The "new" API"`) | The tag breaks and the box is lost. Write `\"` inside the value. |

These are kept correctly, so no work is needed: reference-style links to external
URLs, autolinks `<https://…>`, HTML entities (`&copy;`), trailing two-space line breaks
(they become a trailing `\`), Markdoc tags indented inside list items, and fenced
code inside list items.

## Frontmatter

Pages use the fixed Git frontmatter from `organize-docs-repo`: `type`, `title`,
`listed`, `description`, `index_title`, `hidden`, `keywords`, `tags` (plus
`audience` for gated pages), values bare, at most 15 lines, no `slug`. Map the
source's keys:

| DeveloperHub | Source keys |
|---|---|
| `title` | `title`; else the page's leading `#` heading (or HTML `<h1>`); else the nav label; else the filename in title case |
| `index_title` | `sidebar_label`, `sidebarTitle`, `nav_title`, `linkTitle`, `navigation.title`, `short_title`, the nav entry's own title; else the same value as `title` (DeveloperHub always writes it) |
| `description` | `description`, `excerpt` (ReadMe), `summary`, `subtitle`, `meta_description`, `seo.description` |
| `keywords` | `keywords` (join a list with commas) |
| `tags` | `tags` (join a list with commas) |
| `listed: false` | `unlisted: true`, `sidebar: false`, `sidebar.hidden: true`, `nav_exclude: true`, `hidden: true` in a sidebar sense, `display: hidden` (Nextra), pages outside the navigation the customer chose to keep |
| `hidden: true` | the page should not appear in an `{% index-list %}` of its parent. Rarely needed in a migration; write `hidden: false` otherwise |
| (not migrated) | `draft: true` pages, unless the customer asked for them |

Everything else is dropped from frontmatter, but act on what it meant:
`sidebar_position`, `weight`, `nav_order`, `order`, `position` feed the order in
`_nav.yaml`; `slug`, `id`, `permalink` feed the slug and the redirect map; `icon`
goes to the nav entry's `icon:` if a FontAwesome Free name matches; `hide_title`,
`toc_max_heading_level`, `layout`, `template`, `mode`, `wide` are presentation only.
A `layout: home` or `template: splash` hero page is a landing page: convert its
content into a normal page (cards for its feature grid) and note that the customer
can build a custom landing page in the app.

## Headings

- **ATX only.** `## Heading`. Convert setext headings.
- **No title heading in the body.** Remove a leading `# Title` that repeats the
  frontmatter title. If the page uses `#` for its sections, shift every heading
  down one level so the body starts at `##`. Never skip a level while shifting.
- **No custom ids.** Remove `{#id}`, `{: #id}`, `<a name="id"></a>`,
  `<span id="id"></span>` and Sphinx labels (`.. _label:`). Record what each id
  pointed to, then retarget links to the heading's own anchor (see
  [Links](#links)).
- Headings carrying HTML or components keep only their text.
- A heading that is only a link: keep the text as the heading and move the link into
  the next paragraph if it matters.

## Admonitions and callouts

Every note, tip, warning, aside, hint, panel or alert becomes a `{% callout %}`.
DeveloperHub has four types:

| `type=` | Source types |
|---|---|
| `info` | note, info, information, abstract, summary, tldr, question, help, faq, example, quote, cite, seealso, see-also, todo, important, default, secondary, primary, neutral, 📘 |
| `success` | tip, hint, success, check, done, tick, positive, best-practice, 👍 |
| `warning` | warning, warn, caution, attention, deprecated, versionchanged, 🚧 |
| `error` | danger, error, failure, fail, failed, bug, missing, critical, alert, negative, ❗ |

- An explicit title goes into `title=`. A default title that only repeats the type
  (Docusaurus's "NOTE", MkDocs's "Note") is left out.
- The body keeps all its blocks: lists, code, tables and nested callouts are
  allowed inside a callout.
- An admonition that is collapsible becomes an accordion, not a callout (next
  section).
- Admonitions inside list items stay inside the list item, with the tag lines
  indented to the item's content.

## Collapsible sections

`<details>`, MkDocs `???`, VitePress `::: details`, Mintlify and Fern `<Accordion>`
and `<Expandable>`, Sphinx `.. dropdown::`, Confluence "expand", GitBook expandable
blocks → `{% accordion-group %}` with one `{% accordion title="…" %}` per section.
Consecutive collapsibles go into one group. Expanded by default (`???+`,
`<details open>`, `defaultOpen`) → `open=true`. The summary text becomes the title;
formatting in it is dropped.

## Tabs

- **Tabs that hold only code**, one fence per tab (code groups, `::: code-group`,
  `<CodeGroup>`, MkDocs tabs whose only content is a fence) → `{% code %}` wrapping
  bare fences, each fence with `{% title="Tab label" %}`. No `{% tab %}` inside
  `{% code %}`.
- **Any other tabs** → `{% tabs %}` with `{% tab title="…" %}` children.
- Tab sync across a page (`groupId`, `syncKey`, `persist`) does not exist; drop it.
- A tab label that is an icon or a component keeps its text only.
- Nested tabs inside tabs are allowed but read badly; leave them, mention it.

## Code

- **Fences keep their content byte for byte**, including `{% %}` and `{{ }}` inside
  them (DeveloperHub protects fence bodies).
- **Language** stays as written, lowercase (`bash`, `json`, `tsx`). Strip anything
  after the language that is not a DeveloperHub annotation (Docusaurus
  `title="x"`, VitePress `[label]` and `{1,3}`, Starlight meta) and carry what it
  meant into the annotation: `` ```js {% title="app.js" showLineNumbers=true highlightLines="1,3-5" %} ``.
- **Title** from `title=`, `[label]`, `:caption:`, a filename comment, GitBook's
  `{% code title %}`.
- **Line numbers** from `showLineNumbers`, `linenums`, `:linenos:`,
  `lineNumbers="true"` → `showLineNumbers=true`. Booleans are bare.
- **Highlighted lines** from `{1,3-5}`, `hl_lines="1 3"`, `:emphasize-lines:`, and
  magic comments (`// highlight-next-line`, `// [!code highlight]`,
  `# highlight-start` / `-end`) → `highlightLines="1,3-5"`, counted on the final
  code, with the magic comments removed.
- **Diff markers** (`ins=`, `del=`, `// [!code ++]`): use the `diff` language
  with `+` / `-` line prefixes when the diff is the point, otherwise drop the
  markers and keep the final code.
- **Code annotations** (MkDocs Material `# (1)!` with a numbered list after the
  block): remove the markers from the code and keep the list after the block as an
  ordered list.
- **Code pulled from files** (`literalinclude`, `<<< @/file`, `--8<--`,
  `{{#include file}}`, `include::example$`) → read the file from the source and
  inline it in the fence, honouring line ranges and anchors. If the file lives on
  GitHub and the customer wants it to stay live, use
  `{% github-code url="…#L10-L20" /%}` instead.
- **Prompts and output**: keep `$` prompts and output lines as the source had them.
- Indented (4-space) code blocks → fenced blocks, with a language when it is obvious.
  DeveloperHub has no indented code: it joins the lines into a paragraph. Converters
  (pandoc, turndown) can emit indented blocks for code that had no language, so
  check their output for them.

## Steps

Mintlify, Starlight, Fumadocs and Fern `<Steps>`, Writerside `<procedure>`, GitBook
`{% stepper %}`, Hextra `{{% steps %}}` → **an ordered list**, each step's title as
a bold lead-in and its body indented under the item:

````markdoc
1. **Install the CLI**

   ```bash
   npm install -g acme
   ```

2. **Log in**

   Run `acme login` and follow the prompt.
````

Do not use `{% code-steps %}` for these: it is a two-pane code walkthrough that takes
over the page. Use it only when the source itself is a code walkthrough with one
code sample per step.

## Cards, grids and columns

Card groups, link cards, tiles, `grid cards`, Docusaurus `DocCardList`, Starlight
`<CardGrid>` and `<LinkCard>`, column layouts whose cells are each a title, a line
and a link → `{% cards %}` with self-closing `{% card title="…" text="…" link="…" /%}`.

- `text` is one line of plain text: flatten the card body, drop its formatting.
- `link` is a relative `.md` path to a migrated page (the sync rewrites it), or a
  full URL.
- Card icons and images have no place in the card; drop them and note it.
- `view="list"` for a vertical list of cards, the default grid otherwise.
- A Docusaurus `<DocCardList />` or any "list the child pages" component →
  `{% index-list /%}`.
- Columns that hold rich content (code next to prose) have no layout equivalent:
  stack the columns one after the other.

## Tables

- **Simple tables stay GFM pipe tables.** Escape a literal `|` inside a cell as
  `\|`, including inside inline code (`` `a\|b` ``), or the cell is cut.
- **HTML tables**, RST grid and list tables, Confluence tables: a pipe table when
  every cell holds a single line, otherwise `{% table %}` / `{% row %}` /
  `{% cell %}` (needed for spans, lists or code in cells, or several paragraphs).
- A `<br>` inside a cell → `{% table %}` with separate paragraphs in the cell.
- First row as headers: `header=true` on its cells.
- Very wide reference tables where readers look things up: offer `searchable=true`
  on the key column's header cell.

## Field and parameter lists

`<ParamField>`, `<ResponseField>`, `<TypeTable>`, ReadMe `[block:parameters]`, Sphinx
`:param:` field lists, Writerside `<deflist>` used for parameters → **one table**
per run of fields: Name, Type, Required, Description (and Default when any field has
one). Nested `<Expandable>` properties → rows named `parent.child`. Prose that is not
a parameter list stays prose.

Definition lists of ordinary terms → a bullet list of `**Term**: definition`, or a
two-column table when there are many.

## Images, figures and videos

- **Block image**: `{% image url="./images/x.png" /%}`; with a caption, the body
  form with the caption inside. From `![alt](x.png)` on its own line, `<img>`,
  `<Frame>`, `<figure>` + `<figcaption>`, `.. image::`, `.. figure::`,
  `{{< figure >}}`, `image::x.png[]`, Docusaurus `<img src={require('./x.png').default} />`
  and `useBaseUrl('/img/x.png')`.
- **Inline image** (an icon inside a sentence): `{% inline-image url="./x.png" width=16 /%}`.
- `width=` in pixels when the source sets one (a percentage has no equivalent:
  drop it). `align="left"` or `"right"` when the source floats it.
- Alt text is not kept by DeveloperHub. If an alt text carries information the page
  needs, put it in the caption.
- A linked image (`[![alt](x.png)](url)`): when the image only decorates the link
  (badges, buttons, "Run in Postman"), keep the link and drop the image, using the
  alt text as the link text; otherwise keep the image and put the link in the next
  line of text.
- Paths: site-root paths (`/img/x.png`, `@site/static/x.png`, `/.gitbook/assets/x.png`)
  must be resolved against the source's static folder, copied, and rewritten as a
  relative path from the page.
- **Videos**: YouTube, Vimeo and Loom embeds (`<iframe>`, `{% embed %}`,
  `{{< youtube >}}`, `<Video>`) → `{% video provider="youtube" videoId="…" /%}` with
  the id from the URL (and `params="start=30"` for a start time). A self-hosted
  `.mp4` / `.webm` → `provider="raw"` with its public URL; videos are not uploaded,
  so it needs a public home first.
- Other embeds (Figma, CodePen, Arcade, Storylane, forms, maps) →
  `{% html %}` with the `<iframe>` on one line.

## Links

- Same version: a relative `.md` path from this file to the target file
  (`[text](../setup/auth.md#tokens)`). Also in `{% link href %}` and card `link=`.
- Another version: the site path `/{version}/{doc}/{slug}`.
- From a changelog post: the site path `/{doc}/{slug}`.
- To an API reference: its site path `/{ref-slug}` (or `/{version}/{ref-slug}`).
- To the old site's absolute URL of a migrated page: the relative `.md` path.
- To an anchor: DeveloperHub's heading slug. Lowercase the visible heading text
  (link text, not the link URL; code without backticks), delete every character
  that is not an ASCII letter `a`-`z`, a digit, a space, `-` or `_` (accented and
  non-Latin letters go too), then turn each space into `-`.
  `## Rate limits & quotas` → `#rate-limits--quotas`; `## Über uns` → `#ber-uns`;
  ``## The `init` command`` → `#the-init-command`.
- Doc-tool link forms to resolve through the path map: Docusaurus `[x](./file.mdx)`
  and `@site/...`; MkDocs `[x](../file.md)`; Sphinx `:doc:` and `:ref:`; Hugo
  `{{< ref "x" >}}` and `relref`; Jekyll `{% link %}` and `{{ site.baseurl }}`;
  Antora `xref:`; GitBook `{% content-ref %}`; wiki `[[Page]]`; ReadMe `doc:slug`;
  Mintlify root-relative `/path`.
- A link must have visible text: `[](url)` becomes `[url](url)` or gets real words.
- Relative links and images inline and on one line: no reference-style
  definitions, no link text wrapped over two lines (the sync would not rewrite
  them).
- Inside any tag attribute (a callout or card title, a tab label, card text), write a
  double quote as `\"`.
- A URL with spaces or parentheses: `{% link href="…" %}text{% /link %}`.

## Raw HTML

Raw HTML outside `{% html %}` shows up as literal text, so every tag needs a
decision:

| HTML | Becomes |
|---|---|
| `<b>`, `<strong>`, `<i>`, `<em>`, `<code>`, `<s>`, `<del>` | `**`, `*`, `` ` ``, `~~` |
| `<u>`, `<ins>` | `{% u %}…{% /u %}` |
| `<a href>` | a Markdown link (relative `.md` when internal) |
| `<br>` | a trailing `\` at the end of the line, or a new paragraph |
| `<kbd>Ctrl</kbd>+<kbd>C</kbd>` | `{% key key="Ctrl+C" /%}` |
| `<img>` | `{% image %}` or `{% inline-image %}` |
| `<details>` | an accordion |
| `<table>` | a pipe table or `{% table %}` |
| `<p>`, `<div>`, `<span>`, `<section>`, `<center>` used for layout | removed, content kept |
| `<sup>`, `<sub>`, `<mark>`, `<small>`, `<abbr>` | plain text (log it if it changes meaning, like `x<sup>2</sup>`) |
| `<iframe>`, `<video>`, forms, styled boxes, widgets, `<script>`, `<style>` | `{% html %}` on one line, or a `{% video %}` |
| `<!-- comments -->`, MDX `{/* comments */}` | removed (a TODO in one goes in the report) |

Keep `{% html %}` for things that genuinely are custom HTML. Put its content on a
single line where practical: multi-line indented HTML can lose its indentation. A
`<script>` or `<style>` needed on every page belongs in `_theme/head.html` or
`_theme/custom.css`, not in pages: write it there only if the customer agreed
(see the branding question in SKILL.md), otherwise list it in the report.

## Includes, partials and snippets

Resolve every include before converting the page (Docusaurus and Mintlify imported
partials, MkDocs `--8<--`, Sphinx `.. include::`, Hugo and Jekyll `include`, GitBook
reusable content, Antora `include::partial$`, Writerside `<include>`, VitePress
`<!--@include-->`, mdBook `{{#include}}`). Then, per the customer's choice:

- **Inline**: paste the converted content in place on every page that uses it.
- **Synced block**: links inside it are site paths (`/guides/install`), not relative
  `.md` paths, because the sync leaves a block's links as written. Write the converted
  content once as `_synced-blocks/{id}.md`
  (id: lowercase letters, digits and dashes, starting with a letter; frontmatter
  `title` only, or `title` plus `variables`), and place it with
  `{% synced id="…" /%}` on its own line. A partial that takes parameters (MDX
  props, Hugo shortcode params, Jinja arguments) maps to the block's `variables:`
  (names: 2 to 128 characters, a letter first, then letters, digits or `_`), used as `{% $name %}` in
  its text and `%name%` inside its code, and each placement passes values with
  `variables={"name":"value"}` (one line each, at most 500 characters).

A snippet that is only code belongs inside a fence on each page, not in a synced
block.

## Variables and templating

- **Static values** (`{{ product_name }}` in mkdocs-macros, Sphinx `|product|`
  substitutions, Jekyll `site.*` values, Writerside `%var%`, Antora `{attribute}`,
  Hugo site params, Mintlify or Docusaurus constants imported into MDX) →
  `%KEY%` in the page and the value under `variables:` in `developerhub.yaml`. A key
  uses only letters, digits and `_` (dotted for nested values); a dash makes
  `%my-key%` plain text, so rename `my-key` to `my_key`.
- **Reader-specific values** (ReadMe `<<apiKey>>`, `<<user>>`): ask. DeveloperHub
  can personalise variables per reader (URL parameters or JWT login); if the
  customer will not set that up, write a visible placeholder like `YOUR_API_KEY`.
- **Logic** (`{% if %}`, Jinja loops, MDX expressions computed from props): render
  it the way the published site showed it, as static content. Audience-specific
  content becomes `{% conditional audience="…" %}` once the customer has created
  that audience in the app; until then, keep it unconditional and list it.
- Inside code fences, a `%KEY%` that is defined in `developerhub.yaml` is replaced
  on the published page, and an undefined one stays as typed. So code that used the
  old tool's substitution can use `%KEY%` too. Inline code is never substituted.

## Math

DeveloperHub has no math block. Offer, per site:

1. **Keep the TeX as code** (default): inline `` `\frac{a}{b}` ``, display math as a
   fence with language `latex`. Nothing breaks; readers see the source.
2. **Images**: render each formula to SVG offline (if a tool such as MathJax's CLI is
   available) and place it as an image. Looks right, no longer editable as text.
3. **Custom HTML with a math library**: an `{% html %}` block that loads KaTeX (or
   LaTeX.js) and renders the formula, as in
   <https://docs.developerhub.io/support-center/latex>. No project setup is needed,
   but each formula becomes a small script that is harder to edit.

## Diagrams

Mermaid, PlantUML, Graphviz and similar fences. Offer:

1. **Mermaid in custom HTML** (default for Mermaid): an `{% html %}` block holding
   the Mermaid script tag, the diagram source inside `<div class="mermaid">…</div>`,
   and `<script>mermaid.init(); window.postMessage('resize', '*');</script>`, as in
   <https://docs.developerhub.io/support-center/graphs-charts>. The diagram source
   needs its line breaks, so this is the one `{% html %}` body that stays multi-line;
   keep its lines unindented where the diagram type allows. Stays editable.
2. **Images**: render to SVG (Mermaid CLI, PlantUML, Kroki), place as images, and
   keep the diagram source in a collapsed accordion below if the customer wants it
   editable later.
3. **Keep as code**: the fence stays, readers see the source.

Embedded draw.io, Excalidraw or Lucid diagrams: export to SVG or PNG if the source
has the file, otherwise `{% html %}` with the embed iframe.

## Small inline constructs

| Source | DeveloperHub |
|---|---|
| Keyboard keys (`<kbd>`, `:kbd:`, `++ctrl+c++`) | `{% key key="Ctrl+C" /%}` |
| Badges, pills, status lozenges, `<Badge>` | `{% badge text="Beta" type="warning" /%}` (types: `info`, `success`, `warning`, `error`, `primary`) |
| Icons (FontAwesome names, `:fontawesome-solid-x:`, `<Icon icon="x">`) | `{% icon classes="fas fa-x" /%}` when the name is in `fontawesome-icons.md`; otherwise drop it |
| Material, Lucide, Octicons icon shortcodes | the nearest FontAwesome Free icon if one is obvious, otherwise drop it |
| Emoji shortcodes `:tada:` | the emoji character itself (🎉) |
| Tooltips, abbreviations (`*[HTML]: …`, `<Tooltip>`, `<abbr>`) | the visible text only |
| Glossary references (ReadMe `<<glossary:term>>`) | `{% glossary term="term" /%}`, and list the terms: the glossary lives in the app, not the folder |
| Footnotes | the note text in brackets at the reference, or a `## Notes` ordered list at the end with plain `[1]` markers; say which in the report |
| Task lists | a plain list with ☐ and ☑ at the start of each item |
| `~sub~`, `^sup^`, `==mark==` | plain text, or `**bold**` for marked text |
| Underline | `{% u %}text{% /u %}` |

## Text that looks like syntax

Prose that documents other templating languages needs escaping, or DeveloperHub
reads it as its own syntax:

- A literal `{%` or `%}` in prose (Jinja, Liquid, Nunjucks, Django docs) → write
  `\{%` and `%\}`, or put the snippet in inline code. Inside fences it is safe.
- A literal `%NAME%` in prose (Windows `%APPDATA%`, batch files) → put it in inline
  code, where variables stay literal.
- A literal `{{ }}` is safe in DeveloperHub; it only needed escaping in the source
  tool (`{% raw %}` in Jekyll, `{{'{{'}}` in Vue): remove that escaping.
- A literal `<Component>` or `<tag>` in prose that was meant as text → inline code.
