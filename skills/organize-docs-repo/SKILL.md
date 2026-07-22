---
name: organize-docs-repo
metadata:
  version: "1.1"
description: >-
  Understand and produce the file and folder layout of a DeveloperHub Git-synced
  documentation repository. Use whenever a task involves where a page file goes;
  the version / documentation / page folder structure; navigation in _nav.yaml;
  version, documentation, or project settings (_settings.yaml, developerhub.yaml);
  images and assets in a synced repo; API reference specs (the refs folder);
  adding, moving, renaming, nesting, grouping, reordering, or hiding pages,
  categories, versions, or documentations in a Git-synced repo; or interpreting
  and fixing findings from the DeveloperHub pull request sync check. Pair with
  write-markdoc, which covers the Markdoc syntax inside a page body.
---

# Organizing a DeveloperHub docs repository

DeveloperHub can sync a documentation project to a Git repository, two ways: what
you commit is reconciled into DeveloperHub, and what an editor changes is committed
back. This skill is the ground truth for the **repository layout**: where files go,
what each one means, and how to change structure correctly. For the Markdoc syntax
*inside* a page body, use the [`write-markdoc`](../write-markdoc/SKILL.md) skill.

The single idea to hold onto: **the path is the structure, and the path is the
slug.** A page's folder location defines its version, its documentation, and its
parent pages; its filename is its URL slug. There is no manifest of pages and no ID
files. Ordering, grouping, and non-page entries live in `_nav.yaml`.

Because the sync is two-way and canonical, emit a shape the serializer would not
produce and the next save rewrites it or drops it. The rules below keep an edit
round-trip-safe.

## The tree at a glance

```
developerhub.yaml              # project settings (title, variables)
v1/                            # a version: folder name IS the version slug
  _settings.yaml               # version settings + doc/reference order
  guide/                       # a documentation: folder name IS the doc slug
    _settings.yaml             # documentation settings
    _nav.yaml                  # sidebar order + categories/labels/links/separators
    getting-started.md         # a page: filename (minus .md) IS the slug
    setup.md                   # a parent page…
    setup/                     # …its child pages live in a folder named after it
      advanced.md              # child page (parent chain: setup)
    logo.png                   # a customer image, referenced by relative path
  refs/                        # RESERVED: API reference specs (not pages)
    petstore.yaml              # a spec file: filename IS the reference slug
    petstore.settings.yaml     # that reference's display sidecar
assets/                        # content-addressed images the sync materialized
README.md   .gitignore         # IGNORED: not ours, left untouched
```

## Core layout rules

1. **A page needs at least three path segments:** `{version}/{doc}/{page}.md`. A
   `.md` shallower than that cannot be placed (it is warned, not synced).
2. **Filenames and folder names are slugs.** Renaming a folder renames the version
   or documentation; renaming a `.md` renames (and re-URLs) the page. Never put a
   `slug:` key in a settings file; it is ignored (the path owns the slug). The
   slug is the basename alone, so nesting never deepens a page URL (always
   `/{version}/{doc}/{slug}`) and a basename must be unique within its
   documentation, even across different parent folders.
3. **Parent pages are folders; categories are not.** A page nested under another
   *page* lives in a folder named after that parent page. A *category* is a nav-only
   grouping and never appears as a directory. The parent's own `{parent}.md` must
   exist; without it a child file lands at the doc root with a warning.
4. **Structure comes from the layout; order and grouping come from `_nav.yaml`.**
   Folders alone are an unordered set.
5. **`developerhub.yaml` is the only managed file at the repo root.** Everything
   else at the root is yours and is ignored.
6. **Folders become real through content, and arrive unpublished.** A
   documentation exists once it holds a page; a version needs a page or a ref
   spec (settings for an empty folder just warn). A repo-created version or
   reference stays unpublished until its settings file says `published: true`.

## Scope: what is managed vs ignored

DeveloperHub manages `developerhub.yaml` and the version/documentation folders it
implies. A real repo also has a README, a LICENSE, `.gitignore`, lockfiles, CI
config: **all ignored, silently.** Classification is by file type:

- A `.md` at valid depth is a **page**; a `.md` too shallow (or under `refs/`) is
  **unplaceable** and warned so you can move it.
- An **image** file (`.png .jpg .jpeg .gif .webp .svg .bmp .ico .tif .tiff .avif
  .heic .heif`) anywhere is an **asset**.
- Recognized config files (`_settings.yaml`, `_nav.yaml`, `developerhub.yaml`, ref
  specs and sidecars) are handled by name and depth.
- Anything else (any other root file, any non-image file elsewhere) is **ignored**.

So a stray `.gitignore` or `data.csv` is never treated as content or force-uploaded
as an image; it is left alone.

A project can also be rooted at a configured subdirectory of a larger repository
(a *basepath*, for docs living inside a monorepo). Every path in this skill is
then relative to that folder, `developerhub.yaml` included; anything outside it
is out of scope entirely.

## Navigation: `_nav.yaml`

One per documentation. A single `items:` list that sets sidebar order and adds the
non-page entries:

```yaml
items:
  - getting-started            # a page leaf: doc-relative path, no .md
  - page: setup                # a page that has child pages
    items:
      - setup/advanced         # child path includes the parent-page folder
  - category: Guides           # a collapsible grouping (nav-only, not a folder)
    items:
      - installation
  - label: Resources           # a plain sidebar heading
  - separator                  # a divider
  - link:                      # an external link
      title: API status
      url: https://status.example.com
```

Key rules: page entries are **doc-relative and drop `.md`**; parent-page folders
*are* part of the path (`setup/advanced`) but categories are **not**; **hidden
pages are still listed** (hiding is frontmatter `hidden:`, never nav absence); a
page missing from the list is appended to the end of its section, not dropped; an
entry with no page file behind it is not written; entries cannot re-parent a page
(a child listed outside its parent's block is skipped; move the file instead);
and the bot rewrites the file in canonical form, so **comments and
hand-formatting are lost** on sync.

## Settings files

Three kinds, each authoritative for its level. Full key tables in the reference.

- **`developerhub.yaml`** (root): only `title` and `variables` (the `%VAR%` map) are
  file-owned. Never put secrets in `variables` (they render into public docs). Any
  other key is app-owned and ignored.
- **`{version}/_settings.yaml`**: `name`, `published`, plus the order lists
  `documentations:` and `references:`.
- **`{version}/{doc}/_settings.yaml`**: `title`, `published`, `description`,
  `collapsed`, `collapsedCategories`, `showLastUpdated`, `showLastUpdateUser`,
  `locale`.

Ownership: a key is **file-owned** (round-trips), **app-owned** (managed in the UI,
ignored if written here, with a `settings_keys_ignored` warning), or
**directory-owned** (`slug`, owned by the folder/filename). Writing an app-owned
key does nothing.

## Images

In the repo, reference an image by **relative path**, not an `asset:` token:
`![alt](./logo.png)`, `{% image url="../assets/abc123.png" %}`, or `{% inline-image
url="./icon.png" /%}`. Commit an image next to its page and it is used in place;
otherwise the sync stores it content-addressed under top-level `assets/`. External
URLs and data URIs are left as written. Non-image files are never uploaded.

## API reference specs: `refs/`

`{version}/refs/` is reserved for API specs, not pages. Each reference is two files
at depth 3: the spec `{version}/refs/{slug}.{yaml|yml|json}` and its sidecar
`{version}/refs/{slug}.settings.yaml` (title + display toggles). A `.md` under
`refs/` is unplaceable. A spec must be a single self-contained file; multi-file
specs split with `$ref` across files do not validate.

## Internal links

Link page-to-page with a **relative `.md` path**: `[install](./installation.md)`.
Same-version relative `.md` links round-trip to the site's canonical URL and back.
Scheme'd, site-absolute (`/…`), anchor-only, non-`.md`, and cross-version links are
left exactly as written (a cross-version link cannot be expressed and is reported as
broken). Fragments (`#section`) are preserved.

## Operations cheat sheet

| To… | Do |
|---|---|
| Add a top-level page | Create `{version}/{doc}/{slug}.md` with frontmatter + body; add `- {slug}` to that doc's `_nav.yaml`. |
| Nest a page under a parent page | Put it at `{version}/{doc}/{parent}/{slug}.md`; in `_nav.yaml` make the parent `- page: {parent}` with `items:` listing `{parent}/{slug}`. |
| Group pages under a category | Leave the files where they are; in `_nav.yaml` add `- category: Title` with the pages as its `items:`. |
| Add a label / separator / external link | Add `- label: Text`, `- separator`, or a `- link:` block to `_nav.yaml`. |
| Reorder pages | Reorder the entries in `_nav.yaml` (the folder order is not significant). |
| Reorder docs / references | Reorder `documentations:` / `references:` in the version `_settings.yaml`. |
| Hide a page from the index | Set `hidden: true` in its frontmatter (keep it in `_nav.yaml`). |
| Remove a page from the sidebar | Set `listed: false` in its frontmatter. |
| Rename / move a page | Rename or move the `.md` file (the filename is the slug); update its `_nav.yaml` entry. |
| Move a page AND rewrite it | Two commits: the move first, the content edit second (one commit can defeat move pairing, turning it into delete + create). |
| Delete a page | Delete the `.md` and its `_nav.yaml` entry. Deletes are soft for 30 days; re-adding the same path revives the same page. |
| Un-gate an audience page | Set `audience:` to empty in its frontmatter (deleting the line changes nothing). |
| Add a version | Create `{version}/` with a `_settings.yaml` plus at least one page or ref spec; it stays unpublished until `published: true`. |
| Add a documentation | Create `{version}/{doc}/` with `_settings.yaml`, `_nav.yaml`, and its first page (an empty folder does not sync); list it in the version's `documentations:`. |
| Add an image | Commit it next to the page (or anywhere) and reference it by relative path. |
| Add an API reference | Commit the spec at `{version}/refs/{slug}.{yaml\|json}` and a `{slug}.settings.yaml`; list `{slug}` in the version's `references:`. |

Do structural work (nav, settings, renames, new pages, new versions) on the
**published branch**. An optional draft branch is body-only; changes to structure
there do not take effect, and frontmatter counts as structure (a frontmatter edit
on the draft branch is deferred too).

## Pull requests: the sync check

On repositories synced through the GitHub App, DeveloperHub checks every pull
request whose base is the published branch: a read-only dry run of the sync that
reports findings and never writes anything. Broken relative links or images and
invalid settings, nav, or spec files **fail** the check; everything else is a
warning on a neutral run (it blocks merging only where the repo makes it a
required check). Three rules keep it green:

- **Keep a move and a content rewrite in separate commits.** Both at once can
  defeat rename pairing, and the page would be treated as a delete plus a new
  page (history and comments would not follow).
- **The link scan covers changed files only.** Deleting or moving a page does
  not flag links pointing at it from unchanged pages; check those yourself.
- **References and documentations share one slug namespace per version**, so a
  spec cannot take a documentation's slug (or vice versa).

The finding codes and their meanings are tabled in the reference.

## Round-trip gotchas

- **The path is the slug.** Do not add a `slug:` key anywhere; rename the file or
  folder instead.
- **Nav page entries are doc-relative and have no `.md`** (`setup/advanced`, not
  `v1/guide/setup/advanced.md`).
- **Categories never become folders**; parent pages always do.
- **Hidden ≠ unlisted.** `hidden:` controls the auto-index; `listed:` controls the
  sidebar; nav absence is not how you hide a page.
- **Only `title` and `variables` are honored in `developerhub.yaml`.** Other keys
  are ignored.
- **Comments in `_nav.yaml` and settings files are not preserved** across a sync.
- **A Git page has no `slug:` in frontmatter** and gains `audience:` only when
  gated. See [`write-markdoc`](../write-markdoc/SKILL.md) for the frontmatter block
  and the body syntax.
- **Un-gating is explicit.** `audience:` (and `tags:`) apply only when present:
  an empty value clears, a deleted line leaves the old value in place.
- **You cannot clear a text setting from a file.** An empty `title:`, `name:`,
  or `description:` in a settings file is ignored, not applied.

## Full reference

Exhaustive per-file key tables, edge cases, the ownership model, and legacy file
names: [`references/repo-structure.md`](references/repo-structure.md).
