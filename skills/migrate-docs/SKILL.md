---
name: migrate-docs
metadata:
  version: "1.3"
description: >-
  Migrate existing documentation into a folder DeveloperHub can import: every
  page converted to DeveloperHub Markdoc, the navigation rebuilt as versions,
  documentations, categories and _nav.yaml, images copied and relinked, internal
  links rewritten, plus a redirect list and a migration report. Use whenever
  someone wants to move, migrate, import, port, switch or convert docs to
  DeveloperHub, from any tool: Docusaurus, MkDocs, Sphinx, Read the Docs,
  GitBook, Mintlify, ReadMe, VitePress, Starlight, Nextra, Fumadocs, Hugo,
  Jekyll, Docsify, mdBook, Antora, Fern, Redocly, Writerside, Confluence,
  Notion, Zendesk, a plain Markdown folder, a docs folder inside a monorepo, or
  a live docs site when no source is available. Asks before making structural
  choices the source does not settle. Pair with write-markdoc and
  organize-docs-repo.
---

# Migrating docs to DeveloperHub

The job: take a customer's existing documentation and produce **one folder that
DeveloperHub can import as it is**. The folder uses the Git Sync layout from the
[`organize-docs-repo`](../organize-docs-repo/SKILL.md) skill, and every page body
uses the canonical dialect from the [`write-markdoc`](../write-markdoc/SKILL.md)
skill. Read both of those SKILL.md files before you write any output; this skill
covers the migration itself and assumes them. (If they are not installed next to
this one, install the whole package: `npx skills add developerhub-io/dh-skills`.)

You stop at a validated folder plus a report. You do not create DeveloperHub
projects, upload anything, or connect integrations: the customer loads the folder
themselves (see [Handoff](#9-handoff)).

```
<output>/
  developerhub.yaml          project title, variables, look (settings:), top links (navigation:)
  _theme/                    logo, dark logo, favicon (and custom CSS or HEAD tags if agreed)
  <version>/                 one folder per version (usually v1.0)
    _settings.yaml
    <documentation>/         one folder per documentation (top-level section)
      _settings.yaml
      _nav.yaml              sidebar order, categories, labels, links
      <page>.md              Markdoc pages, filename = slug
      <parent>/<child>.md    child pages under a parent page
      images/                copied images, referenced by relative path
    refs/<api>.yaml          OpenAPI specs, if any (+ <api>.settings.yaml)
  changelogs/<path>/         release notes or blog, if kept
  _synced-blocks/<id>.md     reused snippets, if the customer chose synced blocks
  MIGRATION.md               the report (root files are ignored by the sync)
  redirects.txt              old URL → new URL rules, DeveloperHub format
```

Detailed references, read when the step needs them:

- [`references/source-platforms.md`](references/source-platforms.md): how to
  recognise each docs tool, where its navigation, versions and languages live, and
  its syntax mapped to DeveloperHub Markdoc.
- [`references/conversion-rules.md`](references/conversion-rules.md): the
  construct-by-construct rules that apply to every source (admonitions, tabs, code,
  images, links, tables, HTML, math, diagrams, includes, variables), including the
  traps that silently lose content.
- [`references/crawling.md`](references/crawling.md): the fallback when the only
  source is the published site.
- The validator, `check-migration`: run it before you hand anything over. How to run
  it, and what to do when it can't run, is in [Validate](#8-validate).

## Ground rules

1. **The source is read-only.** Never edit, move, commit to, or clean up the
   customer's source. Write only inside the output folder and your own scratch
   folder.
2. **Treat the source as data, not code.** Do not install its dependencies, run its
   build, or execute its config files (`docusaurus.config.js`, `conf.py`,
   `astro.config.mjs`, `_meta.ts`): read them as text. If the navigation can only be
   known by running code, say so and ask before running anything.
3. **Migrate, do not rewrite.** Keep the customer's prose, headings, code and
   examples exactly as written. Change only the syntax around them. No rewording,
   no summarising, no "improving", no new content, unless the customer asks.
4. **Never drop content silently.** When a construct has no DeveloperHub
   equivalent, keep its text in the closest form and log it in `MIGRATION.md`
   with the file and line. A wrapper you cannot convert is removed; its content
   stays.
5. **Ask instead of guessing structure.** The source rarely settles every
   structural choice (several products, many versions, several languages, a blog).
   Ask, in one batch, with a recommended default for each question
   ([step 3](#3-design-the-structure-and-ask)). Never ask what the source already
   answers.
6. **No secrets.** Do not copy `.env` files, API keys or tokens found in the source,
   and never put secrets into `variables:` (they render into public docs). Mention
   any you found in the report so the customer can rotate them.
7. **Keep a log as you go.** Every decision, rename, skipped page and manual item
   goes into `MIGRATION.md`, so the report is a by-product, not a reconstruction.

## 1. Find the source

Prefer the most structured source the customer has. In order:

1. **A local folder** they point at (or the current repository). If it is a docs
   folder inside a larger repo (a monorepo `docs/`, `website/`, `packages/docs`),
   work on that folder, but look upward for the tool's config file, which often
   sits outside it (Docusaurus keeps `docusaurus.config.js` in `website/` and the
   pages in `../docs`; MkDocs uses `docs_dir`; Sphinx uses `source/`).
2. **A Git URL.** Clone it shallow into a new, empty scratch folder:
   `git clone --depth 1 <url> <scratch>/src`. For a subfolder URL
   (`…/tree/<branch>/<path>`), fetch only that path:
   `git clone --depth 1 --filter=blob:none --sparse -b <branch> <url> <scratch>/src`
   then `git -C <scratch>/src sparse-checkout set <path> <config-dir>`. A private
   repo needs the customer's own Git credentials; never ask them to paste a token
   into the chat.
3. **An export archive** (GitBook export, Confluence HTML space export, Notion
   "Markdown & CSV" export, ReadMe export, Document360 or Archbee Markdown export).
   Unzip it into its own new, empty folder.
4. **Only the published site.** Before crawling, ask whether a repository or an
   export exists, and look for one yourself: an "Edit this page" link, a GitHub
   link in the footer, a `<meta name="generator">` tag. A crawl loses includes,
   variables and some structure. If there really is no source, follow
   [`references/crawling.md`](references/crawling.md).

Ask the customer where to write the output if they have not said. Default: a new
folder next to the source named `<name>-developerhub`. If they want the docs to
live inside their own repository (docs as code), use a new, empty subfolder the
source does not occupy (such as `developerhub/`, not the existing `docs/`): the sync
reads every file under the base path, so leftover source pages there would import as
stray versions and pages. They give that folder as the **Base path** when they
connect the sync, and retire the old docs folder themselves once they are happy.

## 2. Inventory

Identify the tool with the detection table in
[`references/source-platforms.md`](references/source-platforms.md), then measure
before deciding anything. Record the results at the top of `MIGRATION.md`:

- Tool and version; the content root(s); where the navigation is defined.
- Pages: count by extension (`.md`, `.mdx`, `.rst`, `.adoc`, `.ipynb`, `.html`),
  plus pages that exist on disk but are not in the navigation, and drafts or
  hidden pages. Leave out what the tool itself ignores (`.mintignore`, MkDocs
  `exclude_docs`, Docusaurus `exclude`, files outside GitBook's `root`) and
  repository housekeeping that is not documentation (`README.md`, `CONTRIBUTING.md`,
  `LICENSE`, `CHANGELOG.md`, `AGENTS.md`, `CLAUDE.md`, `CODE_OF_CONDUCT.md`) unless
  the old site published it as a page.
- Versions and languages (folders such as `versioned_docs/`, `i18n/`, `docs/fr/`,
  or version and language keys in the config).
- API reference: OpenAPI or AsyncAPI files, and pages generated from them; and
  library reference generated from source code (Sphinx autodoc, mkdocstrings and
  mkautodoc `::: module` blocks, TypeDoc, JSDoc, Javadoc, rustdoc), which the
  source folder does not contain as text.
- Blog, changelog or release notes.
- Reused content: partials, snippets, includes, and how many pages use each.
- Components and directives in use, with counts. A quick census finds them:
  `grep -rhoE '<[A-Z][A-Za-z0-9.]*' <root> | sort | uniq -c | sort -rn` for MDX,
  and the tool's own markers (`:::`, `!!!`, `{% hint`, `{{<`, `.. directive::`).
- Images: count, total size, where they live, how pages reference them; any
  non-image downloads (PDF, ZIP, video) pages link to.
- Math, diagrams (Mermaid, PlantUML), embedded videos, iframes, custom HTML,
  custom React or Vue components.
- Variables and substitutions; existing redirects (`_redirects`, `vercel.json`,
  `netlify.toml`, `docs.json`, `.gitbook.yaml`, redirect plugins).
- The site's public base URL and path (for redirects), and its branding: logo,
  favicon, main colour, top navigation links, custom CSS, theme overrides
  (`custom_dir`, swizzled components, `layouts/`), analytics and chat scripts.
  [`references/source-platforms.md`](references/source-platforms.md#branding) lists
  where each tool keeps these.

## 3. Design the structure, and ask

Map the source onto DeveloperHub's model:

| DeveloperHub | In the folder | Usually comes from |
|---|---|---|
| **Project** | the whole output folder | the whole docs site (own domain, search, branding, access) |
| **Version** | `{version}/` | versioned docs (Docusaurus versions, `mike`, Mintlify or ReadMe versions) |
| **Documentation** | `{version}/{doc}/` | a top-level section the old site showed as its own tab or sidebar: a navbar tab, product, Mintlify tab, VitePress or Docusaurus sidebar, MkDocs top-level section with `navigation.tabs`, GitBook space |
| **Category** | `- category:` in `_nav.yaml` only | a sidebar group that has no page of its own |
| **Parent page** | `{parent}.md` + `{parent}/` folder | a group that does have its own page (Docusaurus category with a doc link, `_index.md`, `index.md` or `README.md` of a section, GitBook page with sub-pages) |
| **Page** | `{slug}.md` | a page |
| **Label, separator, link** | `_nav.yaml` entries | sidebar headings, dividers, external sidebar links |
| **API reference** | `{version}/refs/{slug}.yaml` | an OpenAPI spec |
| **Changelog** | `changelogs/{path}/` | blog, release notes, changelog page |
| **Synced block** | `_synced-blocks/{id}.md` | a partial or snippet reused on several pages |
| **Variables** | `developerhub.yaml` → `%name%` | substitutions and static template variables |

Then work out which choices the source does not settle and **ask them together, in
one round**, before converting anything. For each question give what you found
(with numbers), the options, and a recommended default, and offer "go with the
defaults". If your agent has a structured question tool, use it. Typical questions:

1. **One project or several?** Several products with their own audiences,
   branding or domains → separate projects (separate output folders). One product
   with several areas → one project with several documentations. Default: one
   project.
2. **Documentations or categories?** Which top-level groups become documentations
   (separate sections, shown in the top navigation) and which stay categories in
   one sidebar. Default: the source's top-level tabs or navbar sections become
   documentations; sidebar groups become categories. More than about eight
   documentations usually means some should be categories. **Name each
   documentation**: its slug is in every page URL (`/{doc}/{slug}`), so it should be
   short. A site with one sidebar becomes one documentation; default slug `docs`
   and title `Documentation`, unless the site already uses a path such as `/guides/`.
3. **Versions.** All of them, the latest only, or the latest few; their names; the
   folder slugs. Default: every maintained version; old unmaintained ones only if
   asked. Ask which version readers land on: it gets the short URLs
   (`/{doc}/{slug}`), and the others are prefixed (`/{version}/{doc}/{slug}`).
   Nothing in the folder sets version order, so the customer arranges it in the app
   after the import (the default is the first published version). A single
   unversioned site goes in `v1.0` (with `name: v1.0`), which is the version a new
   DeveloperHub project already has, so the import fills it instead of adding a
   second one.
4. **Languages.** Migrate the source language only and use DeveloperHub's
   Translation feature later, or one documentation per language (`Guides (EN)`,
   `Guides (FR)`, each with its `locale`). Default: source language only, unless
   the translations are maintained by hand and must be kept.
5. **API reference.** Migrate OpenAPI specs as API references (default). Pages
   the old tool generated from a spec are not migrated as pages; hand-written API
   guides are. Library reference generated from source code has no spec: default
   to converting the published pages into normal pages (signatures as code blocks,
   docstrings as text; see [`references/crawling.md`](references/crawling.md)), or
   leave it out if the customer will keep publishing it elsewhere.
6. **Blog or release notes.** A changelog (default for release notes), or leave
   out (common for marketing blogs).
7. **Reused snippets.** Synced blocks (one copy, edited once) or inline copies on
   each page. Default: synced blocks for a snippet used on three or more pages,
   inline otherwise.
8. **Content DeveloperHub has no block for**, per kind found: math, diagrams,
   interactive components, custom widgets. Offer the options listed in
   [`references/conversion-rules.md`](references/conversion-rules.md).
9. **Pages outside the navigation, drafts and hidden pages.** Migrate them hidden
   (`listed: false`), or leave them out. Default: migrate orphans that are real
   documentation as `listed: false`, leave drafts and housekeeping files out.
10. **Publishing.** Content goes live on the project's DeveloperHub address as
    soon as it is imported, if versions, documentations, API reference sidecars,
    changelogs and their posts say `published: true` (everything created from the
    folder arrives unpublished otherwise). Default: `published: true`; offer `false` for a quiet
    import that they publish later. Publishing `v1.0` also publishes the sample
    content a new project starts with (see [the handoff](#9-handoff)).
11. **Branding.** The folder can carry the logo, dark logo, favicon, colours, font,
    light/dark mode and up to four top navigation links. Default: carry them. Two
    parts need a yes first: the old **custom CSS** (it styles the old tool's own
    classes, so it rarely applies to DeveloperHub; default: leave it out and note
    it) and **HEAD scripts** such as analytics or chat widgets (they run on every
    page, and DeveloperHub has built-in integrations for the common ones; default:
    leave them out and list them).

Then show the plan and **wait for approval** before writing pages: the tree of
versions → documentations → top-level sidebar entries, the decisions above, page
counts per documentation, and every slug you had to change. Save the approved plan
in `MIGRATION.md`.

## 4. Scaffold and build the path map

Write the skeleton exactly as `organize-docs-repo` specifies:

- `developerhub.yaml`: `title`, and `variables` if the source has static values to
  carry over. With the branding carried over, add `settings:` (`mainColour` from the
  source's primary colour, `linkColour` from its link or accent colour, else the
  primary again; `darkMode`, `showThemeToggle`, `fontFamily` when the source sets
  them; colours as lowercase hex without `#`, quoted when all digits or digits with
  an `e`)
  and `navigation:` (`links` for the source's top-bar links
  that leave the docs, such as the product site, GitHub or sign-up, at most four in
  the source's order; `logoUrl` if the logo linked to another site). Leave
  `uiVersion` and the other settings out unless the customer asks: absent keys keep
  the project's defaults.
- `_theme/`: the logo as `_theme/logo.{ext}`, a dark-background logo as
  `_theme/logo-dark.{ext}`, the favicon as `_theme/favicon.{ext}`, copied from the
  source with their own extension; `custom.css` and `head.html` only if the customer
  said yes. New projects use a top bar in the page's own colour (white in light
  mode), so a white logo made for a coloured header disappears there: use it as
  `logo-dark`, ask for a logo that works on white, or keep a brand-coloured bar with
  `transparentTopnav: false` in `settings:`.
- `{version}/_settings.yaml`: `name`, `published`, and the `documentations:` (and
  `references:`) order lists.
- `{version}/{doc}/_settings.yaml`: `title`, `published`, and `locale` when the
  documentation is not in American English (`en_gb`, `fr_fr`, `de`, `es`, `pt_br`).
- `changelogs/{path}/_settings.yaml` with `title` and `published`, and one
  `changelogs/{path}/{slug}.md` per post with quoted `title`, `date` and
  `published` (the post format is in `organize-docs-repo`). A post's date comes from
  its frontmatter `date`, else from a date in its filename (Docusaurus and Jekyll
  name posts `YYYY-MM-DD-slug.md`); its slug is the filename without that date. Ask
  if neither exists.
- `{version}/refs/{slug}.settings.yaml` beside each spec: at least `title` and
  `published` (a reference created from the folder stays unpublished without it).
- `{version}/{doc}/_nav.yaml`: the sidebar, rebuilt from the source navigation
  (order, categories, labels, separators, external links). Every page file must
  appear in it once. Icons are optional; take names only from
  [`fontawesome-icons.md`](../organize-docs-repo/references/fontawesome-icons.md).
  When the source's icon is not there (a Pro or another set's icon), use the
  nearest Free one if it clearly means the same thing, otherwise leave it out.

Before converting any body, build the **path map**: one row per source page with
its source path, old public URL, new file path, and new site path
(`/{doc}/{slug}` in the default version, `/{version}/{doc}/{slug}` in others). Do
the same for images, and record each page's heading anchors under both the old
tool's slug and DeveloperHub's. Every link and image rewrite later reads this map,
and `redirects.txt` is generated from it. Keep it as a JSON or CSV file in your scratch
folder.

**Slugs.** A page slug is its filename: letters, digits and dashes only (use
lowercase), at most 64 characters (version and documentation slugs too). Slugs made
from long titles (Zendesk, Notion, Confluence) need shortening. Keep the source's slug wherever it is valid, because unchanged URLs
need no redirect. Two traps:

- **A slug must be unique within its documentation, at any depth.** Nesting never
  adds to the URL, so `guides/install.md` and `cli/install.md` in one documentation
  collide. Rename one (`cli-install`) and record it.
- **Index files have no name of their own.** `index.md`, `README.md`, `_index.md`,
  or a file named after its folder, usually become that section's parent page, named
  after the section (`authentication.md` with its children in `authentication/`),
  or a page with an explicit name when the section is only a category.

## 5. Convert pages

**Pilot first.** Convert three to five representative pages (the most
component-heavy one, one with tables and images, one with code tabs, the home page),
run the validator on them, and show them to the customer before converting the rest.
Fix the rules, not just the pages, then continue.

**Script the regular part, hand-fix the rest.** For more than a few dozen pages,
write a one-off conversion script (Node or Python, in your scratch folder, never in
the source or output) for the mechanical transforms: frontmatter, admonitions, tabs,
code fences, link and image rewriting from the path map. Then go through what the
script flagged by hand. Re-run the script from scratch rather than patching its
output.

For each page:

1. **Place it** at the path from the path map.
2. **Write the frontmatter** in the fixed Git form from `organize-docs-repo`, the
   way DeveloperHub writes it back: `type: page`, `title`, `listed: true` (or
   `false`), `description`, `index_title` (the sidebar label, else the title),
   `hidden: false`, `keywords`, `tags`. Never leave `listed:` empty: that reads as
   false and hides the page from the sidebar. Values bare and never quoted, no `slug:` key
   (the `slug` in write-markdoc's example is the zip-export form), at most 15
   lines. Map the source's keys with the table in
   [`references/conversion-rules.md`](references/conversion-rules.md).
3. **Remove the title heading.** DeveloperHub renders the frontmatter title, so a
   leading `# Title` (or HTML `<h1>`) that repeats it goes. If the body uses `#` for its own
   sections, shift every heading down one level so the body starts at `##`,
   without skipping levels.
4. **Convert the body** with the general rules and the source tool's section in
   [`references/source-platforms.md`](references/source-platforms.md). Resolve
   includes, remove imports and exports, and keep the prose as it is.
5. **Copy its images** and rewrite their paths (step 6) and **rewrite its links**
   (step 7) from the path map.

Large sites: work one documentation at a time and run the validator after each.
If your agent can run parallel workers, give each one a documentation, the path
map, and the conversion rules, and validate their output centrally.

## 6. Images and files

- **Copy every image a page references** into the output, next to the page or in an
  `images/` folder inside its documentation, keeping the original file names
  (lowercase, no spaces). Reference it by relative path from the page:
  `{% image url="./images/setup.png" /%}`. Never write into a top-level `assets/`
  folder: that one belongs to the sync.
- **A standalone image is an `{% image %}` tag**, not `![alt](…)`: Markdown image
  syntax always becomes an inline image, and its alt text is not kept. Use
  `{% inline-image %}` (or `![](…)`) only for small images inside a line of text.
  Carry a width from the source (`width=` attributes, `{ width="300" }`) into
  `width=`, and a figure caption into the tag body.
- **Only images are uploaded**, up to 10 MB each, with extensions `.png .jpg .jpeg
  .gif .webp .svg .bmp .ico .tif .tiff .avif .heic .heif`. PDFs, archives, videos
  and other downloads are not: list them in the report so the customer can host
  them and you can link to their new URLs.
- **Images hotlinked from the old docs site**, or from the customer's own repository
  (`raw.githubusercontent.com/<their-org>/…`), will break when the old site or
  path goes away. Use the local file if the source has it, otherwise download it
  into the output (with the customer's agreement). Images on third-party hosts can
  stay as URLs.
- Light and dark variants of one image (`<ThemedImage>`, `<picture>`,
  `#gh-dark-mode-only`, `dark:hidden`) → keep the light one and note it.

## 7. Links

- **Page to page in the same version: a relative `.md` path** from the current
  file to the target file, with the anchor if there was one:
  `[Install](./install.md)`, `[Tokens](../authentication.md#api-tokens)`. The same
  form works in `{% link href %}` and in a card's `link=`. The sync turns it into
  the site URL.
- **Anchors** are DeveloperHub's own heading slugs: the heading text in lowercase,
  with everything except letters, digits, spaces, `-` and `_` removed, and spaces
  turned into `-` (`## Rate limits & quotas` → `#rate-limits--quotas`). Custom
  heading ids (`{#id}`, `<a name>`) do not exist in DeveloperHub: remove them and
  retarget the links that used them. Repeated headings are not numbered: every
  `## Example` on a page gets `#example` and a link reaches the first one, so a link
  to a later one (`#example-1` in other tools) goes to the first and is logged.
  Only ASCII letters, digits, `-` and `_` survive: `## Über uns` → `#ber-uns`, and a heading
  in Chinese or Japanese gets an empty anchor, so links to those headings cannot be
  kept (log them). A heading inside a tab is anchored as `tab-<tab slug>:<heading
  slug>` (`#tab-macos:install`), so converting source tabs changes the anchors of
  the headings in them. Anchors that were already broken in the source: retarget
  when the intended heading is obvious, otherwise keep them and log them.
- **Across versions**, a relative link cannot work: use the site path
  `/{version}/{doc}/{slug}`. Links from **changelog posts** and **synced blocks**
  always use site paths (`/guides/installation`): the sync leaves links in those
  files as written.
- **Absolute links to the old docs site** that land on a migrated page become
  relative `.md` links too. The validator's `--old-host` option finds the ones you
  missed.
- Links to pages you did not migrate, or to downloads with no new home yet: keep
  the link and list it in the report.
- Every link needs visible text.
- **Every relative link and image must be inline and on one line.** The sync
  rewrites relative paths line by line before anything else reads the page, so a
  reference-style link or image (`[text][ref]` with `[ref]: ./install.md`) and link
  text that wraps onto the next line keep their repository path and break. Turn
  reference definitions into inline links and unwrap the link text (an exception to
  keeping prose exactly as written).
- Write link and image targets bare: the sync does not rewrite or resolve a
  relative target in `<…>`, with a `?query`, or with a single-quoted title, nor a
  link wrapped around an image. Keep `[text](./page.md#anchor "Title")`.

## 8. Validate

Run the validator on the output and fix every error. It is a Node script with no
dependencies (Node 18 or newer), published in the `@developerhub/dh-skills` npm
package:

```bash
npx -y -p @developerhub/dh-skills@1.8.0 check-migration <output> --old-host docs.example.com
```

If this skill's folder has `scripts/check-migration.mjs` (installed from npm, or a
copied folder), run that copy instead, with the same arguments:
`node <this-skill>/scripts/check-migration.mjs <output> --old-host docs.example.com`.
It is the same script and needs no download.

If `node --version` fails, or the download fails (no network, or a sandbox that
blocks the npm registry), do not install Node or change the customer's machine
without asking. Tell the customer the validator could not run and why, then check
the output by hand: every page is listed once in its `_nav.yaml` and every entry
there points at a real file; page frontmatter uses only the keys
[`write-markdoc`](../write-markdoc/SKILL.md) lists; no source syntax is left (MDX
components, `:::`, `!!!`, shortcodes, raw HTML that would show as text); every image
exists and is under 10 MB; every relative link and anchor resolves. Say in
`MIGRATION.md` that the folder was checked by hand, not by the validator.

The validator checks the layout (depths, slugs, parent pages, reserved names), settings and
`_nav.yaml` (every page listed once, entries that point at real files, icon names),
page frontmatter, the body dialect (unknown tags, unclosed tags, block tags on their
own lines, quoted booleans), leftover source syntax (MDX components, `:::`, `!!!`,
shortcodes, directives, raw HTML that would show as text), images (exist, are
images, under 10 MB), links and anchors, synced blocks, changelog posts and API
specs. Errors are what breaks or loses content on import; warnings need a decision;
notes are formatting the sync would rewrite. Exit code 1 means errors remain.

Then check fidelity, which no validator can do for you:

- Page counts per documentation match the plan.
- For each page, compare the source and output word counts, code block counts,
  image counts and heading counts (a one-off script over the path map). Read any
  page that lost more than about 10% of its words, or any code block, image or
  heading: something was dropped.
- Read the pilot pages and a random sample of the rest side by side with the
  source.

If the customer uses VS Code or a JetBrains IDE, the **DeveloperHub Preview**
extension shows each page as it will render and lists problems as they edit.

## 9. Handoff

Write `redirects.txt` from the path map, one rule per line for every URL that
changed, in DeveloperHub's format: `pattern >> destination`, regex, no blank lines,
no comments, no origin and no base path, first match wins. Write one exact rule per
page rather than a broad pattern (a rule replaces whatever it matches anywhere in
the path). Anchor each match and accept the old site's trailing slash or `.html`;
add the old site's root if the docs home moved, and the old tool's raw-Markdown
URLs (`<path>.md`) only if they were published. The Redirects field holds about
60,000 bytes; past that, replace per-page rules with one anchored rule per section
whose old paths map one to one (`^/guides/(.*)$ >> /docs/$1`), after checking that
no new page path matches it. The validator checks the file's format:

```
^/getting-started/installation/?$ >> /guides/installation
^/reference/cli\.html$ >> /cli/commands
```

Finish `MIGRATION.md` with: what was migrated (counts per version and
documentation), the structure decisions, every slug change, everything that needs a
human (with file and line: unsupported content, components unwrapped, links to pages
not migrated, downloads to host), the branding the folder carries and what it left
out (custom CSS, scripts and integrations to set up in the app), what else to set up
in the app (audiences and glossary terms the pages use, the custom domain), and the
validator's remaining warnings. Custom CSS, HEAD tags and a custom footer are plan
features.

Then tell the customer, briefly, how to load the folder, and link the guide
(<https://docs.developerhub.io/support-center/github-sync>):

1. Put the folder in a GitHub repository, at its root or in a subfolder (then that
   subfolder is the **Base path**). No GitHub yet: a new private repository works.
2. In DeveloperHub, connect GitHub under Project Settings → Integrations, then in
   Project Settings → Developers → Docs Sync pick the repository, the branch and the
   base path, set **First sync** to **Import**, and start the sync.
3. Check the Docs Sync **Activity** tab for warnings. An import never deletes, so the
   sample content a new project starts with stays: a documentation named after the
   project with a "Getting Started" page, and a sample API reference. Both are
   already published, so once `v1.0` is published they are live next to the
   migrated docs, so remove them in the app right after the import, but check two
   things first, because the import merges by slug:
   - The sample documentation's slug is the project name in lowercase with dashes.
     If a migrated documentation has the same slug (a project called "Docs" and a
     `docs` folder), the import filled the sample documentation with the migrated
     pages: never delete that documentation.
   - The sample page's slug is `getting-started`. If the folder has a
     `getting-started.md` (at any depth) in that same documentation, the import
     wrote it onto the sample page, so that page is now the customer's: keep it.
     Decide from the folder, not the Activity tab, which does not report this.
     Otherwise delete the sample page.
   Simplest: choose a documentation slug that differs from the project name's, and
   the sample documentation can then be deleted whole.
4. With several versions, put the one readers should land on first in the app's
   version order, since `redirects.txt` assumes it is the default.
5. When they point their domain at DeveloperHub, paste `redirects.txt` into Project
   Settings → Hosting & Domain → Redirects
   (<https://docs.developerhub.io/support-center/url-redirects>).

## Checklist

- [ ] Source located and read without running it; output folder agreed.
- [ ] Inventory recorded; structural questions asked once, with defaults.
- [ ] Plan approved; path map built before any body was converted.
- [ ] Pilot pages reviewed by the customer.
- [ ] Every page converted; nothing dropped silently; manual items logged.
- [ ] Images copied, standalone images as `{% image %}`, nothing in `assets/`.
- [ ] Branding carried into `_theme/` and `developerhub.yaml` (CSS and scripts only if agreed).
- [ ] Links relative `.md` within a version; anchors retargeted.
- [ ] Validator clean of errors; fidelity spot-checks done.
- [ ] `redirects.txt` and `MIGRATION.md` written; handoff steps given.
