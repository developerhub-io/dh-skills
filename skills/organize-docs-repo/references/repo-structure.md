# DeveloperHub Git-synced repository: full structure reference

This is the exhaustive reference for the file and folder layout of a DeveloperHub
Git-synced repository. For the essentials and common operations, start with
[`../SKILL.md`](../SKILL.md). For the Markdoc syntax *inside* a page body, see the
[`write-markdoc`](../../write-markdoc/SKILL.md) skill.

The governing idea: **the path is the structure, and the path is the slug.** A
page's location in the tree defines which version and documentation it belongs to,
its parent pages, and its URL slug. There are no ID files and no manifest listing
every page. Structure is read from the folder layout; ordering, grouping, and
labels are read from `_nav.yaml`.

The sync is **two-way**. What you commit is reconciled into the DeveloperHub
database; what an editor changes is committed back in this same canonical shape.
Emit a shape the serializer would not produce and the next save rewrites it.

## The tree

```
developerhub.yaml              # project settings (title, variables)
v1/                            # a version: folder name IS the version slug
  _settings.yaml               # version settings + documentation/reference order
  guide/                       # a documentation: folder name IS the doc slug
    _settings.yaml             # documentation settings
    _nav.yaml                  # navigation: order, categories, labels, links, separators
    getting-started.md         # a page: basename (minus .md) IS the page slug
    installation.md
    setup.md                   # a parent page…
    setup/                     # …whose child pages live in a folder named after it
      advanced.md              # child page (parent chain: setup)
    logo.png                   # a customer-placed image, referenced by relative path
  refs/                        # RESERVED folder: API reference specs
    petstore.yaml              # an OpenAPI/spec file: basename IS the reference slug
    petstore.settings.yaml     # that reference's display-settings sidecar
changelogs/                    # RESERVED folder: changelogs (project-level)
  product-updates/             # a changelog: folder name IS its URL path
    _settings.yaml             # changelog settings
    4-august-2026.md           # a post: basename IS the post slug
assets/                        # content-addressed images the sync materialized
  a1b2c3d4e5f6.png
README.md                      # IGNORED (a root file that is not developerhub.yaml)
.gitignore                     # IGNORED
```

Config files sit at fixed depths; pages nest as deep as their parent chain goes:

| Depth | Example | What it is |
|---|---|---|
| 1 (root) | `developerhub.yaml` | Project settings (the only managed root file) |
| 2 | `v1/` | A version folder |
| 2 | `v1/_settings.yaml` | Version settings |
| 3 | `v1/guide/` | A documentation folder |
| 3 | `v1/guide/_settings.yaml` | Documentation settings |
| 3 | `v1/guide/_nav.yaml` | Documentation navigation |
| 3+ | `v1/guide/intro.md` | A page (3 = top level; each extra folder = one more parent page, unbounded) |
| 3 | `v1/refs/petstore.yaml` | An API reference spec |
| 3 | `v1/refs/petstore.settings.yaml` | A reference sidecar |
| 2 | `changelogs/` | The reserved changelogs folder (project-level, not a version) |
| 3 | `changelogs/product-updates/_settings.yaml` | Changelog settings |
| 3 | `changelogs/product-updates/4-august-2026.md` | A changelog post (exactly depth 3; posts do not nest) |

Page nesting is unbounded, but it never deepens the URL: a page's address stays
`/{version}/{doc}/{slug}` however deep the file sits, because the slug is the
basename alone. The corollary: a page's basename must be unique within its
documentation, even across different parent folders.

## Scope: what DeveloperHub manages, and what it ignores

DeveloperHub manages exactly two things: `developerhub.yaml` at the repo root, and
the version/documentation folders it implies. **Everything else is ignored,
silently.** A real repository is full of files DeveloperHub neither owns nor
understands (Git and tool config, a README, a LICENSE, lockfiles, CI workflows),
and none of them should be mistaken for content.

Classification is by file type, not by folder. Every repo-root-relative path
resolves to one of these:

| Path shape | Classified as | Synced? |
|---|---|---|
| `developerhub.yaml` (root only) | Project settings | Yes |
| `{version}/_settings.yaml` | Version settings | Yes |
| `{version}/{doc}/_settings.yaml` | Documentation settings | Yes |
| `{version}/{doc}/_nav.yaml` | Navigation | Yes |
| `{version}/{doc}/[{parent}/…]{page}.md` | A page (needs at least 3 segments) | Yes |
| `{version}/refs/{slug}.{yaml\|yml\|json}` | API reference spec | Yes |
| `{version}/refs/{slug}.settings.yaml` | Reference sidecar | Yes |
| `changelogs/{changelog}/{slug}.md` | A changelog post | Yes |
| `changelogs/{changelog}/_settings.yaml` | Changelog settings | Yes |
| Any image file, anywhere (`.png .jpg .jpeg .gif .webp .svg .bmp .ico .tif .tiff .avif .heic .heif`) | An asset | Yes |
| A `.md` too shallow to place (e.g. `v1/intro.md`, any `.md` under `refs/`, or a `.md` at the wrong depth under `changelogs/`) | Unplaceable content | No, but **warns** so you can move it |
| Any other root file; any non-image file anywhere else | Ignored | No, silently |

The one warned case is a **misplaced `.md`**: a Markdown file inside the tree but
above page depth is probably content in the wrong place, so the sync surfaces it
by name rather than dropping it in silence. Everything non-`.md` that is not an
image or a recognized config file is simply left alone.

Edges worth knowing:

- A `_settings.yaml` or `_nav.yaml` at any *other* depth is ignored **silently**
  (only a misplaced `.md` warns). If a settings edit seems to do nothing,
  check the depth first.
- Dotfiles are never assets, whatever their extension.
- The sidecar suffix is exactly `.settings.yaml`: a `{slug}.settings.json` under
  `refs/` classifies as a *spec* named `{slug}.settings`.
- `changelogs/` is matched at the repo root **before** the version rules, so a
  `_settings.yaml` under it is always changelog settings, never a documentation's
  (they sit at the same depth). A version therefore cannot be named `changelogs`;
  DeveloperHub refuses the name when the version is created or renamed.

### Basepath

A project may be rooted at a configured subdirectory of a larger repository
(docs living inside a monorepo). With a basepath set, every path in this
reference, `developerhub.yaml` included, is relative to that folder ("root"
throughout this reference then means the basepath folder, and the managed
`assets/` folder sits directly under it), and files outside it are out of scope
entirely. Moving a file across the basepath boundary is not a move: a file
arriving into the basepath is a plain add (a brand-new page), and a file leaving
it is not registered as a delete by that push (a later full resync reconciles
the removal).

## Versions

A version is a top-level folder. **The folder name is the version slug** and is
authoritative: renaming the folder renames the version. `name` inside
`_settings.yaml` is the human title only; if it implies a different slug, the
folder name still wins.

`{version}/_settings.yaml`:

```yaml
name: Version 1
published: true
documentations:
  - guide
  - api
references:
  - petstore
```

| Key | Type | Meaning |
|---|---|---|
| `name` | string | The version's display name. |
| `published` | bool | Whether the version is live. |
| `documentations` | list of slugs | The order documentations appear in. Any doc folder not listed is appended. |
| `references` | list of slugs | The order references appear in. |

`documentations` and `references` are the ordering lists for everything at the
version level (folders alone are an unordered set, so order lives here). A key
other than these four is ignored with a `settings_keys_ignored` warning. `slug` is
never written here (the folder owns it).

A version comes into existence only once it holds at least one page or ref spec
(the settings file alone creates nothing), and a repo-created version stays
**unpublished** until this file says `published: true`. Text values apply only
when non-empty: an empty `name:` is ignored, so a text setting cannot be cleared
from the file.

## Documentations

A documentation is a folder inside a version. **The folder name is the
documentation slug.**

`{version}/{doc}/_settings.yaml`:

```yaml
title: Guide
published: true
description: Everything you need to get started.
collapsed: false
collapsedCategories: false
showLastUpdated: true
showLastUpdateUser: false
locale: en
```

| Key | Type | Meaning |
|---|---|---|
| `title` | string | Documentation title. |
| `published` | bool | Whether the documentation is live. |
| `description` | string | Short description. |
| `collapsed` | bool | Sidebar starts collapsed. |
| `collapsedCategories` | bool | Categories are expandable/collapsible. |
| `showLastUpdated` | bool | Show each page's last-updated date. |
| `showLastUpdateUser` | bool | Show who last updated each page. |
| `locale` | string | Language/locale code. |

`slug` is never written (the folder owns it). Page **order and grouping** are not
here: they live in `_nav.yaml`.

A documentation exists only once it holds at least one page; a bare folder with
just `_settings.yaml` does not sync (its settings surface as warnings until a
page arrives). As at the version level, empty text values (`title:`,
`description:`) are ignored, not applied.

## Pages

A page is a `.md` file at depth 3 or deeper inside a documentation folder.

- **The basename (minus `.md`) is the page slug.** `v1/guide/getting-started.md`
  has slug `getting-started`.
- **Parent pages are folders.** A page nested under another page lives in a folder
  named after the parent page's slug. Parent chain `setup → advanced` for a page
  `tls` is the file `v1/guide/setup/advanced/tls.md`. The parent pages themselves
  are their own `.md` files sitting *next to* the folder: `v1/guide/setup.md` and
  `v1/guide/setup/advanced.md`.
- **Categories are NOT folders.** A category is a grouping that exists only in
  `_nav.yaml`; it never appears as a directory. Pages grouped under a category
  still sit directly in the documentation folder (or under their parent *page*).
- **The parent's own `.md` must exist.** A child committed without its parent
  file lands at the documentation root with a `parent_page_not_found` warning.
- **Deletes are soft.** A deleted page enters a 30-day grace window; committing
  the same path back within it revives the same page, history and comments
  intact.

### Page frontmatter (Git form)

Every page opens with a YAML frontmatter block, then a blank line, then the Markdoc
body. In a Git repo the emitted keys are:

```yaml
---
type: page
title: Getting started
listed: true
description:
index_title: Getting started
hidden: false
keywords:
tags:
---
```

| Key | Meaning |
|---|---|
| `type` | Always `page` for a content page. |
| `title` | The page title (its `#` H1). |
| `listed` | `true`/`false`: appears in navigation. |
| `description` | Meta/SEO description. |
| `index_title` | Title shown in the sidebar/index; falls back to `title`. |
| `hidden` | `true`/`false`: hide from the auto-generated index. |
| `keywords` | Comma-separated search keywords. |
| `tags` | Comma-separated page tags. |
| `audience` | **Only present when the page is audience-gated.** The audience id; the page shows only to that audience. Omit for public pages. |

Note the differences from a zip/editor export: a Git page has **no `slug:` key**
(the file path is the slug), and it gains an **`audience:` key** when gated. Keep
the block intact and edit values in place. The Markdoc body syntax is the
[`write-markdoc`](../../write-markdoc/SKILL.md) skill's domain.

Ingest details:

- `audience:` and `tags:` are **present-only** on the way in: an absent key
  leaves the current value untouched, an empty value clears it. To un-gate a
  page, write an empty `audience:` line; deleting the line changes nothing.
- An `audience:` id matching no project audience is applied as written (with an
  `unknown_audience` warning) and hides the page from every reader.
- Sync reads at most **15 lines** of frontmatter; keys past that are ignored
  (`frontmatter_truncated`).

## Navigation: `_nav.yaml`

One `_nav.yaml` per documentation (`{version}/{doc}/_nav.yaml`) defines the order
of entries in the sidebar and adds the structural pieces that are not pages
(categories, labels, links, separators). It is a single `items:` list.

```yaml
items:
  - getting-started            # a page (leaf): path relative to the doc, no .md
  - page: setup                # a page WITH child pages
    items:
      - setup/advanced         # child path includes the parent-page folder
  - category: Guides           # a category: a collapsible grouping
    items:
      - installation
  - label: Resources           # a bare heading (no page, no children rendered under it as a group)
  - separator                  # a divider line
  - link:                      # an external link in the sidebar
      title: API status
      url: https://status.example.com
  - page: authentication       # an entry with a sidebar icon
    icon: key
  - category: Guides
    icon: https://assets.example.com/guides.svg
```

Entry forms (the writer emits exactly one form per node; the parser accepts these):

| Form | Node |
|---|---|
| `- getting-started` | A page with no children (bare doc-relative path, no `.md`). |
| `- page: setup` + nested `items:` | A page that has child pages. |
| `- category: Title` (+ optional `items:`) | A category (grouping). |
| `- label: Text` | A label (a plain heading in the sidebar). |
| `- link:` + `title:` + `url:` | An external link. |
| `- separator` | A divider. |

### Icons

Any entry except a separator may carry an optional `icon:`, written as a **sibling of
the type key** (not inside the `link:` mapping):

```yaml
items:
  - introduction                       # no icon
  - page: authentication
    icon: key                          # a bare name is the SOLID style
  - category: Guides
    icon: far:folder-open              # far: = regular
  - label: Resources
    icon: tag
  - link:
      title: Source on GitHub
      url: https://github.com/acme/docs
    icon: fab:github                    # fab: = brands
```

- The value is either a **FontAwesome icon token** or the **absolute `http(s)` URL of
  an image** (an uploaded SVG/PNG, or any image URL). A value starting `http://` or
  `https://` is read as an image; anything else must be a valid token.
- A token is `[style:]name`. **A bare name is the solid style** (`rocket`,
  `book-open`); the other styles carry a prefix:

  | Token | Style |
  |---|---|
  | `rocket` | Solid (`fas`) |
  | `far:bell` | Regular (`far`) |
  | `fab:github` | Brands (`fab`) |

- **Solid is bare and only bare.** There is no `fas:` prefix, so one icon has exactly
  one spelling and `_nav.yaml` diffs stay stable.
- **Anything else is rejected**, with a `nav_icon_invalid` warning, and the entry
  syncs with no icon. Relative image paths, protocol-relative `//host/x.svg`, raw
  FontAwesome classes (`fas fa-key`), `fas:rocket`, and unknown styles (`fal:bell`,
  `lucide:rocket`) are all invalid.
- **A name that does not exist is *not* rejected.** Only the token's shape is checked,
  never the name, so `icon: rocket-launch` (a FontAwesome Pro icon) or a typo passes
  the sync, draws nothing, and leaves a blank slot in the reserved icon column with no
  warning anywhere. DeveloperHub ships **FontAwesome 7 Free**, classic family only:
  1422 solid, 169 regular, 566 brands. The full name list is
  [`fontawesome-icons.md`](fontawesome-icons.md); pick from it instead of recalling a
  name, and note that `far:` covers a small set, so most icons only exist bare (solid).
  Legacy FA5 spellings (`search`, `save`) still render, but write the canonical name
  (`magnifying-glass`, `floppy-disk`).
- **A page leaf must expand to carry one.** `- introduction` has no room for a
  sibling key, so an iconed page is written `- page: introduction` + `icon:`. Entries
  without an icon keep the short form, so adding icons to a few pages does not
  rewrite the rest of the file.
- **Icons are meant to be sparse.** As soon as any one entry in a documentation has
  an icon, the sidebar reserves the icon column on *every* row so labels stay on a
  single straight edge; rows without an icon leave it empty. Nothing is drawn in the
  empty slots.
- **Delete the line to remove an icon.** The repo is authoritative: an entry with no
  `icon:` key clears one that was set in the editor.
- Icons do **not** live in page frontmatter in a synced repo (unlike a zip export,
  where there is no `_nav.yaml` to hold them).

Rules:

- **Page paths are documentation-relative and carry parent-page folders**, e.g.
  `setup/advanced`, not `v1/guide/setup/advanced` and not `advanced`. They are
  written **without the `.md` extension** (entries are typed by structure, not by
  suffix).
- **Categories are transparent to page paths.** Grouping a page under a category
  does not change its path or its file location; it only nests the nav entry.
- **Hidden pages are still listed.** `hidden:` (frontmatter) controls the
  auto-index, not the nav. Absence from `_nav.yaml` is never how you hide a page.
- **A file-less entry is never written.** A page with no published `.md` behind it
  is skipped, *unless* a descendant has a file (then the parent stays so the chain
  remains addressable).
- **A page missing from the list is appended**, not dropped: it lands at the end
  of its section (the `nav_drift_unlisted` finding tells you to place it).
- **An entry cannot re-parent a page.** Entries are only valid inside their
  directory chain; one placed elsewhere is skipped with a `nav_misplaced_entry`
  warning. Move the file to change the parent.
- **A malformed `_nav.yaml` blocks the whole nav apply**, it is not a per-entry
  warning: invalid YAML, a `label:` or `link:` carrying `items:`, and an
  absolute or `..` page path are all parse errors.
- **Editing `_nav.yaml` on a draft branch has no effect on the live index.**
  Navigation is a published-branch concern; see the draft note below.
- **The bot rewrites `_nav.yaml` in canonical form.** Comments and hand-formatting
  are not preserved across a sync. Mappings hug the dash (`- page: x`). On input
  a `.md` suffix on a page path is tolerated; the writer never emits it.

## Project settings: `developerhub.yaml`

The repo-root `developerhub.yaml` carries project-level, content-shaped config.
The file-owned key list is deliberately small; every key here is a permanent
round-trip promise.

```yaml
title: My Product Docs
variables:
  PRODUCT: DeveloperHub
  VERSION: '2.0'
```

| Key | Type | Meaning |
|---|---|---|
| `title` | string | Project title. A blank/non-string value is ignored. |
| `variables` | map | The `%VAR%` substitution map used in page bodies. A map sets it as declared; a bare `variables:` (or empty map) clears it; absent leaves it untouched. Never put secrets here (variables render into public docs). |

Any other key is **app-owned** (security and operational config, secrets, and
everything not in the list above). Unknown keys are returned as a
`settings_keys_ignored` warning, never half-applied. Do not add keys hoping they
take effect: only `title` and `variables` are honored.

## Images and assets

**In the repo, images are referenced by relative path, not by `asset:` token.** (The
`asset:<id>` form is the editor/database interchange form; the sync converts
between the two so a clone is self-contained.) Three image forms are rewritten in
both directions:

- Markdown: `![alt](./logo.png)`
- Block tag: `{% image url="../assets/a1b2c3d4e5f6.png" %}`
- Inline tag: `{% inline-image url="./icon.png" /%}`

Where the bytes live:

- **A customer-placed image** committed next to its page (e.g.
  `v1/guide/logo.png`) is used in place and never moved or duplicated.
- **Otherwise the sync materializes** the binary content-addressed at a top-level
  `assets/{blobSha}.{ext}` path and points the reference there. This folder is
  managed by the sync; the same bytes are never committed twice.

On the way in, a relative image path resolves back to a project asset; the same
bytes (matched by content hash) map straight back to the same asset, so pushes and
pulls do not duplicate images. Only image extensions are treated as assets; any
other file is ignored (a `.pdf`, a `.zip`, a `.csv` next to a page is left alone,
not uploaded). An external URL (`https://…`) or a data URI in an image is left
exactly as written.

Ingest accepts real images up to **10MB**. An oversized file, or non-image bytes
behind an image extension, is skipped with an `asset_rejected` warning and the
reference stays unresolved.

## API reference specs: `refs/`

`{version}/refs/` is a **reserved** folder. It holds API reference specifications
(OpenAPI and similar), not pages. A `.md` file placed under `refs/` is *unplaceable*
(warned, not synced).

Each reference is two files at exactly depth 3:

- **The spec:** `{version}/refs/{slug}.{yaml|yml|json}`. The basename is the
  reference slug. The extension follows the uploaded format (a JSON body becomes
  `.json`, otherwise `.yaml`). It must be a **single self-contained file**:
  multi-file specs split with `$ref` across files do not validate; bundle them
  into one document first.
- **The sidecar:** `{version}/refs/{slug}.settings.yaml`. Display settings and a
  title that a raw spec file cannot carry.

```yaml
# petstore.settings.yaml
title: Petstore API
description: The Petstore reference.
published: true
downloadable: true
expandable: true
showContentType: true
showAccept: true
showTryItOut: true
indexCollapsible: false
showOAuth2: true
showRequestPayloadOnly: false
dontCapitalizeTags: false
```

| Key | Type | Meaning |
|---|---|---|
| `title` | string | Reference title. |
| `description` | string | Reference description. |
| `published` | bool | Whether the reference is live. |
| `downloadable` | bool | Reader can download the spec. |
| `expandable` | bool | Sections expandable. |
| `showContentType` | bool | Show the content-type control. |
| `showAccept` | bool | Show the Accept control. |
| `showTryItOut` | bool | Show the "try it out" control. |
| `indexCollapsible` | bool | Sidebar index is collapsible. |
| `showOAuth2` | bool | Show OAuth2 controls. |
| `showRequestPayloadOnly` | bool | Show request payload only. |
| `dontCapitalizeTags` | bool | Do not auto-capitalize tag names. |

`slug` is filename-owned (a rename arrives as a spec-file rename, never through the
sidecar). Keys are present-only on the way in: an absent key never clears state; an
explicit value is applied as written (including `published: false`). The order of
references in a version is the `references:` list in the version `_settings.yaml`.

References and documentations share one slug namespace per version (both live at
`/{version}/{slug}`), so a spec cannot take a documentation's slug or vice versa;
the collision is refused with a `slug_conflict` warning. A repo-created reference
stays unpublished until its sidecar says `published: true`.

## Changelogs: `changelogs/`

`changelogs/` at the repo root is a **reserved** folder holding changelogs (release
notes, product updates). A changelog belongs to the **project**, not to a version,
which is why it sits beside the version folders instead of inside one.

```
changelogs/
  product-updates/
    _settings.yaml
    4-august-2026.md
    1-august-2026.md
```

- **The folder name is the changelog's path** — its URL is `/{path}` — and it is
  directory-owned: rename the folder to change it, never write a `path:` key.
- **Each post is one `.md` file directly inside that folder**, and its basename is
  the post slug (`/{path}/{slug}`). Posts do **not** nest: a `.md` deeper than
  `changelogs/{changelog}/{slug}.md` is unplaceable and warned. A post basename must
  be unique within its changelog.
- **Images** anywhere under `changelogs/` follow the ordinary asset rules; any other
  non-image file is ignored.
- **A changelog exists on its `_settings.yaml` alone.** Unlike a version or a
  documentation, it needs no content: an empty changelog is representable (Git
  cannot store an empty folder, so the settings file is what makes it exist).
- **Deleting the folder deletes the changelog**; deleting a post's `.md` soft-deletes
  the post with the same 30-day grace window a page gets.

### Post frontmatter

A post opens with a YAML block, then a blank line, then the Markdoc body — but the
key set is **not** a page's, and it is parsed as real YAML (so a `title` containing
a colon is safe when quoted):

```markdown
---
title: '4 August 2026'
date: '2026-08-04 13:06:23'
published: true
---

Markdoc body, identical in syntax to a page body.
```

| Key | Type | Meaning |
|---|---|---|
| `title` | string | The post's heading in the changelog feed. |
| `date` | date | `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS`. Owns the post's displayed date **and its position in the feed** (newest first); use the time to order two posts made on the same day. |
| `published` | bool | Whether readers see the post. `false` keeps the file in the repo but hides the post. |

Keys are present-only: an absent key leaves the current value untouched, so an
edit that only touches the body is safe. An unrecognised key is reported
(`changelog_key_ignored`) and dropped — the slug in particular comes from the
filename, never from frontmatter. A post committed with **no `date:`** is dated when
the sync runs (`changelog_date_missing` warns), which is rarely what you want for a
backdated entry. On the way out DeveloperHub writes `YYYY-MM-DD` when the time is
midnight and `YYYY-MM-DD HH:MM:SS` otherwise, so a hand-written plain date stays as
you wrote it.

There is **no ordering file** for a changelog: no `_nav.yaml`, and no list in any
settings file. Dates are the whole ordering model.

### `changelogs/{changelog}/_settings.yaml`

```yaml
title: Product updates
description: What shipped, and when.
published: true
```

| Key | Type | Meaning |
|---|---|---|
| `title` | string | The changelog's title. |
| `description` | string | Short description shown with the feed. |
| `published` | bool | Whether the changelog is live. |

`path` is directory-owned and reported as ignored if written here. A repo-created
changelog stays unpublished until this file says `published: true`.

### Links inside a post

A post body keeps **site paths**, not relative `.md` paths:

```markdown
See [installation](/guide/installation).
```

The relative-`.md` rewriting described in the next section applies to pages only —
a relative link written in a post is left exactly as typed and will not resolve for
readers. Images are the exception and behave normally (relative paths, rewritten in
both directions).

### Draft branches

Changelogs are **published-branch only**. A post has no draft form in DeveloperHub
(publishing is the `published` flag), so nothing under `changelogs/` applies from a
draft branch; commit changelog work to the published branch.

## Internal links between pages

In the repo, link to another page by a **relative path to its `.md` file**:

```markdown
See [installation](./installation.md) and [TLS setup](../guide/setup/advanced/tls.md).
```

On the way in, a same-version relative `.md` link is rewritten to the canonical
site href the database stores; on the way out it becomes a relative `.md` path
again. This is what round-trips cleanly.

Left exactly as written (not rewritten): links with a scheme (`https://…`),
protocol-relative (`//…`), site-absolute (`/…`), anchor-only (`#section`), links to
a non-`.md` target, links that escape the repo root, and links to a page in a
*different* version (a canonical page href is version-scoped, so it cannot be
expressed; the broken-link report surfaces it). A fragment on a relative link
(`./installation.md#requirements`) is preserved.

The same rewriting covers `{% link href="…" %}` tags and card `link="…"`
attributes, not just Markdown links. Links to an API reference stay in their
site-absolute `/…/ref` form; they are never rewritten to a `.md` path.

## Draft branch (optional)

A project may configure an opt-in **draft branch** in addition to its published
branch. It is a body-only lane: it mirrors "the published branch's tree plus
pending edits," so a change on the draft branch updates only page bodies.

- **Structure is not draftable.** Navigation (`_nav.yaml`), settings, page
  renames/moves, new pages, categories: none of these take effect from the draft
  branch. They flow through the published branch. Editing `_nav.yaml` on the draft
  branch changes the file but has no effect on the live index.
- **Frontmatter counts as structure.** A frontmatter edit on the draft branch is
  deferred; only the body applies.
- A new page committed to the draft branch does not auto-publish; it stays a draft
  until the change lands on the published branch, and it joins the navigation at
  the bottom of its section when it does.
- Changes on the published branch merge one-way into the draft branch (draft-wins
  on conflicts) so the draft stays "main plus pending edits."

If you are authoring structure, versions, documentations, navigation, settings, or
new pages, do it on the **published branch**.

## The pull request check

On repositories synced through the GitHub App, every pull request whose base is
the published branch gets a DeveloperHub check run: a read-only dry run of the
sync against the merge result. It never writes anything. The conclusion is
**failure** when any blocking finding exists, **neutral** when there are only
warnings, and **success** when clean; it blocks merging only where the repo
makes it a required check. The scan covers **changed files only**: deleting a
page does not flag links pointing at it from unchanged pages.

Blocking findings (failure):

| Finding | Meaning / fix |
|---|---|
| `broken_link` | A relative `.md` link target does not exist at the PR head. Fix the path. |
| `broken_image` | A relative image path resolves to no file. Fix the path or commit the image. |
| `nav_invalid` | `_nav.yaml` could not be parsed; its ordering would not apply. |
| `settings_invalid` | A settings file is not valid YAML, or not a mapping. |
| `spec_invalid` | The API reference spec failed validation (remember: single self-contained file). |
| `changelog_frontmatter_invalid` | A changelog post's frontmatter is not readable YAML (or its `date:` cannot be parsed); its title, date and published state would be left unchanged. |

Non-blocking findings (warning / notice):

| Finding | Meaning / fix |
|---|---|
| `untracked_move_source` | A move plus rewrite could not be paired: it would become a delete plus a new page (history and comments would not follow). Split the move and the edit into separate commits. |
| `unplaceable_file` | A `.md` too shallow to place, or under `refs/`. Move it to `{version}/{doc}/…`. |
| `frontmatter_truncated` | Frontmatter longer than 15 lines; keys past that are ignored. |
| `unknown_audience` | `audience:` names no audience in the project; the page would be hidden from every reader. |
| `unknown_tag` | A `{% tag %}` the renderer does not know; it renders as nothing. |
| `app_link` | A link to `app.developerhub.io` (the editor); readers cannot follow it. |
| `link_to_unpublished_page` / `link_to_unlisted_page` / `link_to_unpublished_reference` | The target exists but readers will not see it. |
| `nav_unknown_entry` | `_nav.yaml` lists a page with no file behind it; the entry is skipped. |
| `nav_drift_unlisted` | A page is not listed in `_nav.yaml`; it is appended to the end of its section. |
| `nav_duplicate_entry` | A page is listed more than once. |
| `nav_icon_invalid` | An entry's `icon:` is neither a FontAwesome solid name nor an `http(s)` image URL; the icon is ignored and the entry keeps no icon. |
| `settings_key_ignored` | An unrecognised or app-owned settings key; it will not apply. |
| `version_deleted` / `documentation_deleted` | The PR empties a whole version or documentation: a confirmation, not an error. |
| `changelog_date_missing` | A changelog post has no `date:`; a new post would be dated when it syncs rather than when it was written. |
| `changelog_key_ignored` | A frontmatter key a post does not own (the slug comes from the filename); it will not apply. |
| `changelog_deleted` | The PR removes a whole changelog and its posts: a confirmation, not an error. |

## Ownership model (why some keys are ignored)

Every piece of config is either **file-owned** (the repo is the source of truth,
and the key round-trips forever) or **app-owned** (managed in the DeveloperHub UI,
never read from the repo). Security and operational config and secrets are
app-owned by policy. Writing an app-owned key into a settings file does nothing but
produce a `settings_keys_ignored` warning: it is never half-applied.

A special third case is **directory-owned**: the `slug` of a version, documentation,
or reference is owned by the folder or filename, never by a `slug:` key. Renames
therefore happen by renaming the folder/file, and any `slug:` key written into a
settings file is ignored.

## Legacy file names

Older repositories (created before the `_`-prefixed names) used `settings.yaml` and
`nav.yaml` without the underscore. Those are still **read** correctly on the way in,
so an un-migrated repo keeps working. The writer only ever emits the current
`_settings.yaml` / `_nav.yaml` names; the next full sync adds the new file and the
old one is swept. The reference sidecar suffix (`{slug}.settings.yaml`) has no
underscore by design: it sorts next to its spec file.
