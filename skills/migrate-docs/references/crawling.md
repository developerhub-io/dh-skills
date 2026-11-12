# Migrating from a published site

The last resort, for when the customer has no repository and no export. A crawl
recovers what the site shows, not how it was written: includes arrive duplicated,
variables arrive as their values, generated pages arrive as HTML, and some structure is
only visible in the rendered sidebar. Tell the customer this before starting, and ask
once more whether an export exists.

## Before fetching anything

- **Only the customer's own docs.** Confirm the site is theirs and agree the scope: a
  host and a path prefix (`https://docs.acme.com/` or `https://acme.com/docs/`). Do not
  follow links off that scope except to download the docs' own images.
- **Public pages only.** If the docs sit behind a login, do not crawl with someone's
  session. Ask for an export or an API token from the docs tool instead.
- **Be gentle.** Read `robots.txt` and respect it. One request at a time, about one per
  second, a clear user agent naming the migration (not a browser's, and not anyone's
  email address). Stop and report on 403, 429 or a CAPTCHA page; never work around one.
- **Fetch each URL once.** Save every response in a scratch cache keyed by URL, so
  re-running a conversion never re-fetches.

## 1. Get the page list and the structure

1. **The navigation**: fetch one docs page and read its sidebar. It gives the order,
   the groups and the nesting, and is the structure source. Top navigation tabs or a
   product switcher show the documentations; a version picker shows the versions.
2. **The full list**: `sitemap.xml` (follow sitemap indexes), `/llms.txt`, and the
   links in the sidebar. Pages in the sitemap but not the sidebar are orphans: ask, as
   for a repository.
3. Record every page URL in the path map: it is also the redirect source.

## 2. Get each page in the best form available

Try these in order and use the first that works for the site:

1. **The tool's Markdown.** Many docs tools serve the source of a page as Markdown:
   try the page URL with `.md` appended (Mintlify, GitBook, Fern, ReadMe and
   DeveloperHub sites do this, among others), the same URL with an
   `Accept: text/markdown` header, and `/llms-full.txt` for the whole site in one file.
   Check that what comes back is really Markdown for that page, not an HTML error page.
2. **Sphinx sources.** Sphinx sites usually publish each page's source at
   `_sources/<page>.rst.txt` or `_sources/<page>.md.txt` (the "View page source"
   link). Convert that as RST or MyST.
3. **The tool's API.** Public help centres often have a public read API (Zendesk,
   below). APIs that need a token (GitBook, ReadMe, Confluence, Notion, Intercom) are
   worth it only if the customer provides the token themselves through their own
   environment; never ask for it in the chat.
4. **The HTML.** Extract only the page's content container (`article`, `main`,
   `[role=main]`, `.theme-doc-markdown`, `.md-content`, `.markdown-body`,
   `#main-content`). Drop the site chrome: header, sidebars, table of contents,
   breadcrumbs, previous and next links, "Was this helpful?", "Edit this page", copy
   buttons, heading anchor links (`#`, `¶`, `🔗`) and line-number gutters. Convert the
   rest to Markdown with `pandoc -f html -t gfm-raw_html --wrap=none` or turndown,
   then apply [`conversion-rules.md`](conversion-rules.md).

## 3. Rendered HTML patterns

What the common tools' components look like once rendered:

| Rendered | DeveloperHub |
|---|---|
| `div.admonition.<type>` (Sphinx, MkDocs), `.theme-admonition-<type>` (Docusaurus), `.custom-block.<type>` (VitePress), `aside.starlight-aside--<type>`, `[class*=callout]`, `.hint-<style>` | callout, type from the class |
| `details` / `summary` | accordion |
| `[role=tablist]` + `[role=tabpanel]` | tabs, labels from the tab buttons, one panel each |
| `pre > code.language-<x>` (or `class="highlight-<x>"`, `data-language`) | fence with that language; a code header or `figcaption` above it as the title |
| a tab group whose panels each hold one code block | code group |
| `figure` + `figcaption` | image with caption |
| `table` | pipe table or `{% table %}` |
| `iframe` to YouTube, Vimeo, Loom | video |
| an `ol` styled as steps | ordered list steps |
| a grid of link boxes | cards |

## 4. Images and files

Download every image in the content area that the docs host or its asset CDN serves,
dedupe them by content hash, give them readable names, and reference them by relative
path from each page. Images on third-party hosts can stay as URLs. List other
downloads (PDF, ZIP) for the customer to host.

## 5. API pages

**HTTP API reference** generated from a spec is not worth converting from HTML: look
for the spec instead (a "Download OpenAPI" link, `openapi.json` / `openapi.yaml` /
`swagger.json` next to the reference, or a link in the page source) and migrate it as
an API reference.

**Library reference** generated from source code (Sphinx autodoc, mkdocstrings,
mkautodoc, TypeDoc, Javadoc, rustdoc) has no spec, so the published pages are the
source. Even with a repository, convert just these pages from the site: each
signature becomes a code block in the language, each docstring becomes Markdown,
and each documented object a heading so its anchor survives. Keep the order the site
shows. Text the browser hid because it looked like a tag (an object repr such as
`<pkg.Thing object at 0x…>` in a default value) was invisible on the old site:
keep it inside the code block, where it reads correctly, and log it.

## Zendesk Help Center

A public Zendesk help centre has a read API that needs no login. Page through each
endpoint with `?per_page=100`, following `next_page` until it is null:

```
https://<subdomain>.zendesk.com/api/v2/help_center/<locale>/categories.json
https://<subdomain>.zendesk.com/api/v2/help_center/<locale>/sections.json
https://<subdomain>.zendesk.com/api/v2/help_center/<locale>/articles.json
```

(A help centre on its own domain answers on that domain too.) Each article has
`title`, `body` (HTML), `section_id`, `position`, `draft`, `html_url`, `label_names`
and `updated_at`; each section has `category_id`, `parent_section_id` (nested
sections), `position` and `description`. Skip drafts. Map categories → documentations
(or categories when there are only a few articles), sections → categories, articles →
pages ordered by `position`, `label_names` → `tags`, and `html_url` → the redirect map.
Article images are attachments on the help centre's own host: download them.
