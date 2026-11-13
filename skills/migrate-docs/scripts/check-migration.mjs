#!/usr/bin/env node
// check-migration.mjs: validate a folder laid out for DeveloperHub Git Sync before the
// customer imports it. Zero dependencies; Node 18 or newer.
//
//   node check-migration.mjs <folder> [--old-host docs.example.com] [--json] [--all-notes]
//
// Levels: error = breaks or loses content on import (exit code 1); warning = probably
// wrong, needs a decision; note = formatting the sync would rewrite (harmless churn).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------------------
// Arguments

const argv = process.argv.slice(2);
const opts = { root: null, oldHosts: [], json: false, allNotes: false };
const bareHost = (h) => String(h).toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^\/\//, '').split(/[/?#:]/)[0].replace(/^www\./, '');
const isOldHost = (h) => { const b = bareHost(h); return opts.oldHosts.some((o) => b === o || b.endsWith('.' + o)); };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--old-host') opts.oldHosts.push(bareHost(argv[++i] || ''));
  else if (a === '--json') opts.json = true;
  else if (a === '--all-notes') opts.allNotes = true;
  else if (a === '-h' || a === '--help') usage(0);
  else if (!opts.root) opts.root = a;
  else usage(2);
}
if (!opts.root) usage(2);
const ROOT = path.resolve(opts.root);
if (!fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) {
  console.error(`Not a folder: ${ROOT}`);
  process.exit(2);
}

function usage(code) {
  console.log('Usage: node check-migration.mjs <folder> [--old-host docs.example.com] [--json] [--all-notes]');
  process.exit(code);
}

// ---------------------------------------------------------------------------------------
// Findings

const findings = [];
const seenFindings = new Set();
function report(level, file, line, code, message) {
  const findingId = `${file}\u0000${line}\u0000${code}\u0000${message}`;
  if (seenFindings.has(findingId)) return; // the same problem twice on one line is one finding
  seenFindings.add(findingId);
  findings.push({ level, file, line: line || null, code, message });
}
const err = (f, l, c, m) => report('error', f, l, c, m);
const warn = (f, l, c, m) => report('warning', f, l, c, m);
const note = (f, l, c, m) => report('note', f, l, c, m);

// ---------------------------------------------------------------------------------------
// Constants (mirror write-markdoc and organize-docs-repo; update them together)

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tif', 'tiff', 'avif', 'heic', 'heif']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FRONTMATTER_MAX_LINES = 15;
const PAGE_KEYS = new Set(['type', 'title', 'listed', 'description', 'index_title', 'hidden', 'keywords', 'tags', 'audience']);
const VERSION_KEYS = new Set(['name', 'published', 'documentations', 'references']);
const DOC_KEYS = new Set(['title', 'published', 'description', 'collapsed', 'collapsedCategories', 'showLastUpdated', 'showLastUpdateUser', 'locale']);
const PROJECT_KEYS = new Set(['title', 'variables', 'settings', 'navigation']);
const CHANGELOG_KEYS = new Set(['title', 'description', 'published']);
const POST_KEYS = new Set(['title', 'date', 'published']);
const BLOCK_FILE_KEYS = new Set(['title', 'variables']);
const REF_SIDECAR_KEYS = new Set(['title', 'description', 'published', 'downloadable', 'expandable', 'showContentType', 'showAccept', 'showTryItOut', 'indexCollapsible', 'perEndpointLayout', 'showOAuth2', 'showRequestPayloadOnly', 'dontCapitalizeTags']);
const THEME_FILES = new Set(['custom.css', 'head.html', 'footer.html']);
const THEME_IMAGE_STEMS = new Set(['logo', 'logo-dark', 'favicon']);
const THEME_IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);
const LOCALES = ['en_us', 'en_gb', 'fr_fr', 'de', 'es', 'pt_br'];

const S = 'string', B = 'bool', N = 'number', O = 'object';
// form: body = {% x %}…{% /x %} on its own lines; self = {% x /%} on its own line;
// either = image (self-closing or with a caption body); inline = self-closing inside text;
// inline-body = {% u %}…{% /u %} inside text.
const TAGS = {
  'callout': { form: 'body', attrs: { type: ['info', 'warning', 'success', 'error'], title: S } },
  'code': { form: 'body', attrs: { showLineNumbers: B, wrapLine: B } },
  'code-steps': { form: 'body', attrs: { title: S } },
  'step': { form: 'body', parent: 'code-steps', attrs: { title: S, codeId: S, highlightLines: S } },
  'table': { form: 'body', attrs: { layout: ['fixed', 'auto'], stickyHeader: B } },
  'row': { form: 'body', parent: 'table', attrs: {} },
  'cell': { form: 'body', parent: 'row', attrs: { header: B, align: ['left', 'center', 'right'], bg: S, colspan: N, rowspan: N, colwidth: N, searchable: B } },
  'image': { form: 'either', attrs: { url: S, width: N, align: ['left', 'center', 'right'] }, required: ['url'] },
  'video': { form: 'self', attrs: { provider: ['youtube', 'vimeo', 'loom', 'raw'], videoId: S, params: S }, required: ['videoId'] },
  'tabs': { form: 'body', attrs: {} },
  'tab': { form: 'body', parent: 'tabs', attrs: { title: S } },
  'accordion-group': { form: 'body', attrs: {} },
  'accordion': { form: 'body', parent: 'accordion-group', attrs: { title: S, open: B } },
  'cards': { form: 'body', attrs: { view: ['grid', 'list'] } },
  'card': { form: 'self', parent: 'cards', attrs: { title: S, text: S, link: S } },
  'conditional': { form: 'body', attrs: { audience: S } },
  'html': { form: 'body', attrs: {} },
  'github-code': { form: 'self', attrs: { url: S }, required: ['url'] },
  'index-list': { form: 'self', attrs: {} },
  'synced': { form: 'self', attrs: { id: S, variables: O }, required: ['id'] },
  'badge': { form: 'inline', attrs: { text: S, type: ['info', 'success', 'warning', 'error', 'primary', 'custom'] } },
  'key': { form: 'inline', attrs: { key: S } },
  'icon': { form: 'inline', attrs: { classes: S } },
  'glossary': { form: 'inline', attrs: { term: S } },
  'inline-image': { form: 'inline', attrs: { url: S, width: N, mode: ['resizable', 'w100', 'fit'] }, required: ['url'] },
  'variable': { form: 'inline', attrs: { key: S }, required: ['key'] },
  'u': { form: 'inline-body', attrs: {} },
  'link': { form: 'inline-body', attrs: { href: S }, required: ['href'] },
  'p': { form: 'self', attrs: {} },
};
const FENCE_ATTRS = { title: S, showLineNumbers: B, wrapLine: B, highlightLines: S, id: S };
// Only bare children belong directly inside these containers.
const CONTAINER_CHILD = { 'tabs': 'tab', 'accordion-group': 'accordion', 'table': 'row', 'row': 'cell', 'cards': 'card' };

// Source syntax that DeveloperHub would show as literal text or drop.
const LEFTOVERS = [
  [/^\s*import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]/, 'mdx_import', 'MDX import line: resolve what it imports, then remove it'],
  [/^\s*export\s+(?:const|let|default|function)\b/, 'mdx_export', 'MDX export line: inline its values, then remove it'],
  [/<\/([A-Z][\w.]*)\s*>|<([A-Z][\w.]*)(?:\s[^<>]*)?\/>|<([A-Z][\w.]*)\s+[\w-]+\s*=/, 'jsx_component', 'JSX component <$1>: convert it to Markdoc (see conversion-rules.md); it shows as literal text'],
  [/^\s*:::\s+[A-Za-z_][\w.]*\s*$/, 'api_autodoc', '"::: module" block (mkdocstrings, mkautodoc): generated library reference whose text is not in the source; convert the published page instead'],
  [/^\s*:::(?!\s+[A-Za-z_][\w.]*\s*$)/, 'container_fence', '":::" container (Docusaurus, VitePress, Starlight admonition): convert it to a callout or accordion'],
  [/\{\s*\/\*/, 'mdx_comment', 'MDX comment {/* … */} shows as literal text: remove it'],
  [/^\s*(?:!!!|\?\?\?\+?)\s*[\w-]+/, 'mkdocs_admonition', 'MkDocs admonition: convert it to a callout or accordion'],
  [/^\s*===\s+"/, 'mkdocs_tab', 'MkDocs content tab: convert it to tabs or a code group'],
  [/\{\{[<%]/, 'hugo_shortcode', 'Hugo shortcode: convert what it renders'],
  [/\{\{#(?:include|rustdoc_include|playground|title)\b/, 'mdbook_include', 'mdBook include: inline the file'],
  [/--8<--/, 'mkdocs_snippet', 'MkDocs snippet include: inline the file'],
  [/^\s*\.\.\s+[\w:-]+::/, 'rst_directive', 'reStructuredText directive: convert it'],
  [/^\s*\.\.\s+_[\w-]+:\s*$/, 'rst_label', 'reStructuredText label: remove it and retarget links to the heading anchor'],
  [/\bxref:[^\s\[]+\[|^\s*include::|^\s*image::|^\s*\[(?:source|NOTE|TIP|IMPORTANT|WARNING|CAUTION)\b/, 'asciidoc', 'AsciiDoc syntax: convert it'],
  [/\[block:[\w-]+\]/, 'readme_block', 'ReadMe [block:…] JSON block: convert it'],
  [/<<[\w.:-]+>>/, 'readme_variable', 'ReadMe <<variable>> or <<glossary:…>>: convert it to %VAR% or a glossary tag'],
  [/<!--@include:|^\s*<<<\s+@/, 'vitepress_include', 'VitePress include: inline the file'],
  [/^\s*>\s*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i, 'github_alert', 'GitHub alert: convert it to a callout (it shows as a quote starting with [!NOTE])'],
  [/^\s*[!?]>\s/, 'docsify_tip', 'Docsify !> / ?> tip: convert it to a callout'],
  [/\[\^[^\]]+\]/, 'footnote', 'footnote: DeveloperHub shows [^1] as literal text; see conversion-rules.md'],
  [/^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s/, 'task_list', 'task list item: [ ] shows as literal text; use ☐ / ☑'],
  [/^\s*:\s+\S/, 'definition_list', 'definition list line: DeveloperHub joins it into the previous paragraph'],
  [/\{:\s*[.#][\w-]|\{:\s*\w+=|^\s*\{:/, 'kramdown_ial', 'kramdown attribute list {: …}: remove it (a callout or badge if it styled one)'],
  [/\{\s*(?:\.[\w-]+|#[\w-]+|width=|align=|loading=)[^}]*\}\s*$/, 'attr_list', 'attribute list { … }: carry width/align into the tag, remove the rest'],
  [/\[\[[^\]\n]+\]\]/, 'wiki_link', 'wiki link [[…]]: convert it to a relative .md link'],
  [/^\s*\[\[?toc\]?\]\s*$|^\s*\[TOC\]\s*$|^\s*\*\s+TOC\s*$/i, 'toc_marker', 'table-of-contents marker: remove it (DeveloperHub builds its own)'],
  [/(?:^|[\s(])(:[a-z][a-z0-9_+-]*:)(?=$|[\s.,;!?)])/, 'emoji_shortcode', 'emoji shortcode $1: write the emoji character itself'],
];
const TEMPLATE_EXPR = /\{\{\s*[^{}\n]+\}\}/;
const MDX_EXPR = /(^|[^{])\{\s*[A-Za-z_$][\w$]*(?:\.[\w$]+|\[[^\]]+\])+\s*\}(?!\})/;
// Only real HTML element names: `List<string>` in prose is meant literally and shows correctly.
const HTML_ELEMENTS = new Set(('a abbr address article aside audio b bdi bdo big blockquote body br button canvas caption center cite code col colgroup dd del details dfn dialog div dl dt em embed fieldset figcaption figure font footer form h1 h2 h3 h4 h5 h6 head header hr i iframe img input ins kbd label legend li link main mark meta nav noscript object ol optgroup option p picture pre q s samp script section select small source span strike strong style sub summary sup svg table tbody td template textarea tfoot th thead time tr track tt u ul var video wbr').split(' '));
const HTML_TAG = /<\/?([a-z][a-z0-9-]*)(?:\s[^<>]*)?\/?>|<!--/g;

// ---------------------------------------------------------------------------------------
// FontAwesome names, read from the sibling organize-docs-repo skill when it is installed

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ICONS = loadIcons(path.resolve(HERE, '../../organize-docs-repo/references/fontawesome-icons.md'));

function loadIcons(file) {
  if (!fs.existsSync(file)) return null;
  const sets = { solid: new Set(), regular: new Set(), brands: new Set() };
  let current = null;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const h = line.match(/^##\s+(Solid|Regular|Brands)\b/);
    if (h) { current = sets[h[1].toLowerCase()]; continue; }
    if (/^##\s/.test(line)) { current = null; continue; }
    if (!current || !/^[a-z0-9-]+( [a-z0-9-]+)*$/.test(line.trim())) continue;
    for (const t of line.trim().split(/\s+/)) current.add(t);
  }
  return sets.solid.size ? sets : null;
}

function checkIconToken(file, value, where) {
  if (value === null || value === undefined || value === '') return;
  const v = String(value);
  if (/^https?:\/\//i.test(v)) return;
  if (/^(?:\/\/|\.{0,2}\/)/.test(v)) {
    warn(file, null, 'nav_icon_url', `${where}: icon "${v}" must be a FontAwesome name or a full https:// URL, so it is dropped`);
    return;
  }
  const m = v.match(/^(?:(far|fab):)?([a-z0-9-]+)$/);
  if (!m) {
    warn(file, null, 'nav_icon_invalid', `${where}: icon "${v}" is not a FontAwesome token (write "key", "far:bell" or "fab:github", not CSS classes), so it is dropped`);
    return;
  }
  if (!ICONS) return;
  const set = m[1] === 'far' ? ICONS.regular : m[1] === 'fab' ? ICONS.brands : ICONS.solid;
  if (!set.has(m[2])) warn(file, null, 'icon_unknown', `${where}: icon "${v}" is not a FontAwesome 7 Free name; unless it is an old FA5 alias it renders as blank space (use a name from fontawesome-icons.md)`);
}

function checkIconClasses(file, line, classes) {
  const m = String(classes).trim().match(/^(fas|far|fab)\s+fa-([a-z0-9-]+)(?:\s+[\w-]+)*$/);
  if (!m) {
    err(file, line, 'icon_classes', `{% icon classes="${classes}" /%}: classes must start with "fas", "far" or "fab" and then "fa-<name>"`);
    return;
  }
  if (!ICONS) return;
  const set = m[1] === 'far' ? ICONS.regular : m[1] === 'fab' ? ICONS.brands : ICONS.solid;
  if (!set.has(m[2])) warn(file, line, 'icon_unknown', `icon "${m[1]} fa-${m[2]}" is not a FontAwesome 7 Free name; unless it is an old FA5 alias it renders as blank space (use a name from fontawesome-icons.md)`);
}

// ---------------------------------------------------------------------------------------
// Walk and classify (mirrors DeveloperHub's PathParser)

const allFiles = [];
const strayPages = []; // .md files the sync would read from folders that are not docs
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === '.DS_Store') continue;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    if (entry.isSymbolicLink()) {
      warn(rel, null, 'symlink', 'a symbolic link: the sync imports the link itself (a file holding the target path), not what it points to. Copy the real file in');
      continue;
    }
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') { collectStray(abs); continue; }
      walk(abs);
    } else if (entry.isFile()) allFiles.push(rel);
  }
})(ROOT);
// The sync reads every folder in the repository, hidden ones included, so a .md under
// .github/ or node_modules/ becomes a page in a version named after that folder.
function collectStray(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) collectStray(abs);
    else if (entry.isFile() && entry.name.endsWith('.md')) strayPages.push(path.relative(ROOT, abs).split(path.sep).join('/'));
  }
}
if (strayPages.length) warn(strayPages[0], null, 'stray_pages', `${strayPages.length} .md file(s) in hidden or node_modules folders (e.g. ${strayPages.slice(0, 3).join(', ')}): the sync reads them as pages, so keep such folders out of the synced folder or set a base path`);
const fileSet = new Set(allFiles);

const ext = (p) => (p.includes('.') ? p.slice(p.lastIndexOf('.') + 1).toLowerCase() : '');
const isImage = (p) => IMAGE_EXT.has(ext(p));

const versions = new Map(); // slug -> { settingsFile, docs: Map, refs: Map }
const pages = new Map();    // relpath -> { version, doc, parents, slug }
const posts = new Map();    // relpath -> { changelog, slug }
const changelogs = new Map(); // path -> { settingsFile }
const blocks = new Map();   // id -> relpath
const images = new Set();
const managedAssets = [];
const themeFiles = [];
const themeImages = new Map();
let projectSettingsFile = null;

function versionEntry(v) {
  if (!versions.has(v)) versions.set(v, { settingsFile: null, docs: new Map(), refs: new Map() });
  return versions.get(v);
}
function docEntry(v, d) {
  const ve = versionEntry(v);
  if (!ve.docs.has(d)) ve.docs.set(d, { settingsFile: null, navFile: null, pages: [] });
  return ve.docs.get(d);
}

for (const rel of allFiles) {
  const seg = rel.split('/');
  const n = seg.length;
  const base = seg[n - 1];
  const lower = base.toLowerCase();
  if (n >= 2 && lower.endsWith('.md') && !base.endsWith('.md')) {
    err(rel, null, 'md_extension_case', `"${base}": the sync only reads files ending in lowercase .md, so this page is ignored`);
    continue;
  }
  const isSettings = base === '_settings.yaml' || base === 'settings.yaml';
  const isNav = base === '_nav.yaml' || base === 'nav.yaml';
  const legacyRead = !seg[0].startsWith('_') && seg[1] !== 'refs' && (
    seg[0] === 'changelogs' ? (n === 3 && base === 'settings.yaml') : (n === 3 || (n === 2 && base === 'settings.yaml')));
  if ((base === 'settings.yaml' || base === 'nav.yaml') && legacyRead) note(rel, null, 'legacy_name', `${base} is a legacy name the sync still reads; the current name is _${base}`);

  if (n === 1) {
    if (base === 'developerhub.yaml') projectSettingsFile = rel;
    else if (base === 'developerhub.yml') err(rel, null, 'project_settings_name', 'the project settings file must be named developerhub.yaml');
    continue; // every other root file is ignored by the sync
  }
  if (lower.endsWith('.mdx')) {
    err(rel, null, 'mdx_file', '.mdx files are not read: convert the page to Markdoc and rename it to .md');
    continue;
  }
  if (seg[0] === 'changelogs') {
    if (n === 3 && (base === '_settings.yaml' || base === 'settings.yaml')) changelogs.set(seg[1], { settingsFile: rel });
    else if (n === 3 && lower.endsWith('.md')) posts.set(rel, { changelog: seg[1], slug: base.slice(0, -3) });
    else if (lower.endsWith('.md')) err(rel, null, 'unplaceable', 'a changelog post must sit at changelogs/<changelog>/<post>.md');
    else if (isImage(rel)) images.add(rel);
    else note(rel, null, 'ignored', 'not an image, page or settings file, so the sync ignores it');
    continue;
  }
  if (seg[0] === '_synced-blocks') {
    if (n === 2 && lower.endsWith('.md')) blocks.set(base.slice(0, -3), rel);
    else if (lower.endsWith('.md')) err(rel, null, 'unplaceable', 'a synced block must sit at _synced-blocks/<id>.md');
    else if (isImage(rel)) images.add(rel);
    continue;
  }
  if (seg[0] === '_theme') {
    const stem = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
    if (base.startsWith('.')) continue; // .gitkeep and the like
    if (n === 2 && THEME_FILES.has(base)) { themeFiles.push(rel); continue; }
    if (n === 2 && THEME_IMAGE_STEMS.has(stem)) {
      if (THEME_IMAGE_EXT.has(ext(base))) {
        if (themeImages.has(stem)) warn(rel, null, 'theme_image_duplicate', `${themeImages.get(stem)} is also the ${stem}: keep one file per image, or which one wins is not defined`);
        else themeImages.set(stem, rel);
        const size = fs.statSync(path.join(ROOT, rel)).size;
        if (size > MAX_IMAGE_BYTES) err(rel, null, 'image_too_large', `${(size / 1048576).toFixed(1)} MB; the limit is 10 MB`);
      } else warn(rel, null, 'theme_image_type', `.${ext(base)} is not read as the ${stem}: use png, jpg, gif, webp, svg, bmp, ico or avif`);
      continue;
    }
    if (isImage(rel)) { images.add(rel); warn(rel, null, 'theme_unrecognised', n > 2 ? 'uploaded as an ordinary image, not used: only files directly in _theme/ are read' : 'uploaded as an ordinary image, not used as the logo or favicon: the names are exactly logo, logo-dark and favicon, lowercase'); }
    else warn(rel, null, 'theme_unrecognised', 'ignored: only custom.css, head.html, footer.html and the logo, logo-dark and favicon images are read from _theme/');
    continue;
  }
  if (seg[0] === 'assets') {
    managedAssets.push(rel);
    if (isImage(rel)) images.add(rel);
    continue;
  }
  if (seg[0].startsWith('_')) {
    err(rel, null, 'reserved_dir', `top-level folders starting with "_" are reserved, so "${seg[0]}" cannot be a version`);
    continue;
  }

  const v = seg[0];
  if (n === 2) {
    if (isSettings) versionEntry(v).settingsFile = rel;
    else if (isNav) err(rel, null, 'nav_depth', '_nav.yaml belongs inside a documentation folder ({version}/{doc}/_nav.yaml)');
    else if (lower.endsWith('.md')) err(rel, null, 'unplaceable', 'a page needs at least {version}/{documentation}/{page}.md');
    else if (isImage(rel)) images.add(rel);
    else note(rel, null, 'ignored', 'ignored by the sync');
    continue;
  }
  if (seg[1] === 'refs') {
    versionEntry(v);
    if (n === 3 && base.endsWith('.settings.yaml')) {
      const slug = base.slice(0, -'.settings.yaml'.length);
      refEntry(v, slug).sidecar = rel;
    } else if (n === 3 && /\.(ya?ml|json)$/i.test(base)) {
      refEntry(v, base.replace(/\.(ya?ml|json)$/i, '')).spec = rel;
    } else if (lower.endsWith('.md')) err(rel, null, 'unplaceable', 'refs/ holds API specs only, never pages');
    else if (isImage(rel)) images.add(rel);
    else note(rel, null, 'ignored', 'ignored by the sync');
    continue;
  }
  const d = seg[1];
  if (n === 3 && isSettings) { docEntry(v, d).settingsFile = rel; continue; }
  if (n === 3 && isNav) { docEntry(v, d).navFile = rel; continue; }
  if (lower.endsWith('.md')) {
    const info = { version: v, doc: d, parents: seg.slice(2, n - 1), slug: base.slice(0, -3) };
    pages.set(rel, info);
    docEntry(v, d).pages.push(rel);
    continue;
  }
  if (isImage(rel)) { images.add(rel); continue; }
  if (/\.(ya?ml)$/i.test(base)) warn(rel, null, 'ignored_yaml', 'this YAML file is not one the sync reads, so it is ignored');
  else note(rel, null, 'ignored', `.${ext(rel) || '(no extension)'} files are not uploaded; host downloads elsewhere and link to them`);
}

if (managedAssets.length) warn('assets/', null, 'managed_assets', `${managedAssets.length} file(s) in the top-level assets/ folder, which the sync manages: put migrated images next to their pages instead`);

function refEntry(v, slug) {
  const ve = versionEntry(v);
  if (!ve.refs.has(slug)) ve.refs.set(slug, { spec: null, sidecar: null });
  return ve.refs.get(slug);
}

// ---------------------------------------------------------------------------------------
// Minimal YAML reader: block mappings and sequences, plain and quoted scalars, simple
// flow collections, block scalars. Enough for DeveloperHub's settings and nav files.

function parseYaml(text) {
  const raw = text.replace(/\r\n?/g, '\n').split('\n');
  const lines = [];
  let pending = null; // { line, quote }: a quoted value that continues on the next lines
  // Symfony strips comment lines at the very top, then one leading `---` line.
  let lead = 0;
  while (lead < raw.length && /^#/.test(raw[lead])) lead++;
  const startsWithMarker = /^---(?:\s.*)?$/.test(raw[lead] || '');
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (pending) { // a quoted value wraps: the line is part of it, comments and dashes included
      const segment = ' ' + r.trim();
      pending.line.content += segment;
      if (closesQuote(segment, pending.quote)) {
        pending.line.content = stripComment(pending.line.content); // a comment may follow the closing quote
        pending = null;
      }
      continue;
    }
    if (/^\s*$/.test(r) || /^\s*#/.test(r)) continue;
    if (/^---(?:\s.*)?$/.test(r)) {
      if (i === lead && startsWithMarker) continue;
      throw yamlError(i + 1, 'a --- that is not the first line (after any top comments) starts another YAML document, so DeveloperHub rejects the whole file');
    }
    if (/^\.\.\.\s*$/.test(r) && startsWithMarker && raw.slice(i + 1).every((x) => /^\s*$/.test(x))) break;
    if (/^\.\.\.(\s|$)/.test(r)) throw yamlError(i + 1, 'a ... line here ends the YAML document early, so DeveloperHub rejects the whole file');
    if (/^\t/.test(r)) throw yamlError(i + 1, 'tab indentation is not valid YAML');
    const indent = r.match(/^ */)[0].length;
    let content = stripComment(r.slice(indent));
    // `- key: value` → a `-` line plus a mapping line two columns deeper
    const seq = content.match(/^-(\s+)(.*)$/);
    if (seq && isMapLine(seq[2])) {
      lines.push({ indent, content: '-', no: i + 1 });
      const line = { indent: indent + 1 + seq[1].length, content: seq[2], no: i + 1 };
      lines.push(line);
      const q = openQuote(line.content);
      if (q) pending = { line, quote: q };
      continue;
    }
    // block scalar: gather the more-indented lines verbatim
    const bs = content.match(/^((?:-\s+)?(?:[^:]+:\s*)?)([|>][+-]?)$/);
    if (bs && (bs[1] === '' || bs[1].endsWith(': ') || bs[1].endsWith(':') || bs[1].startsWith('-'))) {
      const body = [];
      let j = i + 1;
      while (j < raw.length && (/^\s*$/.test(raw[j]) || raw[j].match(/^ */)[0].length > indent)) body.push(raw[j++]);
      const minIndent = Math.min(...body.filter((b) => b.trim()).map((b) => b.match(/^ */)[0].length), 1000);
      const joined = body.map((b) => b.slice(minIndent)).join(bs[2][0] === '|' ? '\n' : ' ').trim();
      lines.push({ indent, content: bs[1] + JSON.stringify(joined), no: i + 1 });
      i = j - 1;
      continue;
    }
    const line = { indent, content, no: i + 1 };
    lines.push(line);
    const prev = lines[lines.length - 2];
    const continuesPlain = prev && indent > prev.indent && !isSeqLine(line) && !isMapLine(content) && /:\s+\S/.test(prev.content);
    const q = continuesPlain ? null : openQuote(content);
    if (q) pending = { line, quote: q };
  }
  if (pending) throw yamlError(pending.line.no, 'a quoted value that is never closed');
  if (!lines.length) return null;
  const [value, next] = parseNode(lines, 0, lines[0].indent);
  if (next < lines.length) throw yamlError(lines[next].no, 'unexpected indentation');
  return value;
}

// Does this added text close a value opened with `quote`?
function closesQuote(segment, quote) {
  for (let i = 0; i < segment.length; i++) {
    if (quote === '"') { if (segment[i] === '\\') i++; else if (segment[i] === '"') return true; }
    else if (segment[i] === "'") { if (segment[i + 1] === "'") i++; else return true; }
  }
  return false;
}

// The quote character a line's value opens and leaves unclosed, or null.
function openQuote(content) {
  let v = content.replace(/^-\s+/, '');
  const km = v.match(/^('(?:[^']|'')*'|"(?:[^"\\]|\\.)*"|[^'"\s][^:]*?)\s*:(?:\s+|$)/);
  if (km) v = v.slice(km[0].length);
  if (v.startsWith("'")) {
    for (let i = 1; i < v.length; i++) if (v[i] === "'") { if (v[i + 1] === "'") i++; else return null; }
    return "'";
  }
  if (v.startsWith('"')) {
    for (let i = 1; i < v.length; i++) { if (v[i] === '\\') i++; else if (v[i] === '"') return null; }
    return '"';
  }
  return null;
}

function yamlError(line, message) {
  const e = new Error(message);
  e.yamlLine = line;
  return e;
}

function stripComment(s) {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { if (i === 0 || /[\s:\-\[{,]/.test(s[i - 1])) q = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).trimEnd();
  }
  return s.trimEnd();
}

function isMapLine(s) {
  return /^(?:'(?:[^']|'')*'|"(?:[^"\\]|\\.)*"|[^\s'"\[{#&*!|>%@`-][^:#]*?|-[^\s:][^:#]*?)\s*:(?:\s|$)/.test(s);
}
const isSeqLine = (l) => l.content === '-' || l.content.startsWith('- ');

function parseNode(lines, i, indent) {
  if (isSeqLine(lines[i])) return parseSeq(lines, i, indent);
  if (isMapLine(lines[i].content)) return parseMap(lines, i, indent);
  if (i + 1 < lines.length && lines[i + 1].indent > indent) throw yamlError(lines[i].no, 'a plain value cannot have children');
  return [parseScalar(lines[i].content, lines[i].no), i + 1];
}

function parseSeq(lines, i, indent) {
  const out = [];
  const nos = [];
  seqLineOf.set(out, nos);
  while (i < lines.length && lines[i].indent === indent && isSeqLine(lines[i])) {
    const l = lines[i];
    nos.push(l.no);
    if (l.content === '-') {
      if (i + 1 < lines.length && lines[i + 1].indent > indent) {
        const [v, next] = parseNode(lines, i + 1, lines[i + 1].indent);
        out.push(v);
        i = next;
      } else { out.push(null); i++; }
    } else {
      out.push(parseScalar(l.content.slice(2).trim(), l.no));
      i++;
    }
  }
  return [out, i];
}

function parseMap(lines, i, indent) {
  const out = {};
  lineOf.set(out, lines[i].no);
  while (i < lines.length && lines[i].indent === indent && !isSeqLine(lines[i])) {
    const l = lines[i];
    const m = l.content.match(/^('(?:[^']|'')*'|"(?:[^"\\]|\\.)*"|[^:]+?)\s*:(?:\s+(.*))?$/);
    if (!m) throw yamlError(l.no, `cannot read "${l.content}"`);
    const field = unquote(m[1]);
    if (Object.prototype.hasOwnProperty.call(out, field)) throw yamlError(l.no, `duplicate key "${field}"`);
    const rest = (m[2] || '').trim();
    i++;
    if (rest !== '') {
      // a plain or double-quoted value may continue on more-indented lines
      let value = rest;
      while (i < lines.length && lines[i].indent > indent && !isSeqLine(lines[i]) && !isMapLine(lines[i].content) && !/^['"]/.test(value)) {
        value += ' ' + lines[i].content.trim();
        i++;
      }
      out[field] = parseScalar(value, l.no);
    }
    else if (i < lines.length && lines[i].indent > indent) [out[field], i] = parseNode(lines, i, lines[i].indent);
    else if (i < lines.length && lines[i].indent === indent && isSeqLine(lines[i])) [out[field], i] = parseSeq(lines, i, indent);
    else out[field] = null;
  }
  return [out, i];
}
const lineOf = new WeakMap();
const seqLineOf = new WeakMap(); // list -> the line number of each item

function unquote(s) {
  s = s.trim();
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    try { return JSON.parse(s); } catch { return s.slice(1, -1); }
  }
  return s;
}

function parseScalar(s, no) {
  s = s.trim();
  if (s === '' || s === '~' || /^null$/i.test(s)) return null;
  if (s.startsWith('[') || s.startsWith('{')) return parseFlow(s, no);
  if (s.startsWith("'") || s.startsWith('"')) {
    const q = s[0];
    if (!s.endsWith(q) || s.length < 2) throw yamlError(no, `unterminated quoted value ${s}`);
    return unquote(s);
  }
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === 'true';
  return symfonyPlainScalar(s, no);
}

// How Symfony YAML (Inline::evaluateScalar) types a plain value: `01` and `000000` stay
// text, `5368e7` and `333333` are numbers, `2024-01-15` is a Unix timestamp, `0x1F` and
// `1_000` are numbers.
function symfonyPlainScalar(s, no) {
  if (/^[-+]?\d+$/.test(s)) return String(parseInt(s, 10)) === s.replace(/^\+/, '') ? Number(s) : s;
  if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s.slice(2), 16);
  if (/^0o[0-7]+$/i.test(s)) return parseInt(s.slice(2), 8);
  if (/^[-+]?\d[\d_]*(\.[\d_]+)?$/.test(s) && s.includes('_')) return Number(s.replace(/_/g, ''));
  const dm = s.match(/^(\d{4})-(\d\d?)-(\d\d?)(?:(?:[Tt]|[ \t]+)(\d\d?):(\d\d):(\d\d)(\.\d*)?(?:[ \t]*(?:Z|[-+]\d\d?(?::\d\d)?))?)?$/);
  if (dm) {
    // Symfony rejects the whole file on an impossible month, day, hour or minute
    if (+dm[2] > 12 || +dm[3] > 31 || (dm[4] !== undefined && (+dm[4] > 24 || +dm[5] > 59))) throw yamlError(no, `"${s}" is not a valid date, so DeveloperHub rejects the whole file`);
    const iso = `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}` + s.slice(dm[1].length + dm[2].length + dm[3].length + 2).replace(/^[ \t]+(?=\d)/, 'T');
    const t = Date.parse(iso.length === 10 ? iso + 'T00:00:00Z' : /(Z|[-+]\d\d?(:\d\d)?)$/.test(iso) ? iso.replace(/[ \t]+(?=[-+Z])/, '') : iso + 'Z'); // no zone = UTC, as in PHP
    if (Number.isNaN(t)) return s;
    return dm[7] && /\.\d*[1-9]/.test(dm[7]) ? t / 1000 : Math.floor(t / 1000); // fractional seconds stay a decimal
  }
  if (/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(s)) return Number(s); // PHP is_numeric
  if (/^[\[\]{},&*!|>%@`]/.test(s)) throw yamlError(no, `a value starting with "${s[0]}" must be quoted`);
  if (/:\s/.test(s)) throw yamlError(no, `a value containing ": " must be quoted: ${s}`);
  return s;
}

function parseFlow(s, no) {
  const open = s[0], close = open === '[' ? ']' : '}';
  if (!s.endsWith(close)) throw yamlError(no, `unterminated ${open}…${close}`);
  const inner = s.slice(1, -1).trim();
  if (inner === '') return open === '[' ? [] : {};
  const parts = [];
  let depth = 0, q = null, cur = '';
  for (const c of inner) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  if (open === '[') return parts.map((p) => parseScalar(p, no));
  const obj = {};
  for (const p of parts) {
    const m = p.match(/^('(?:[^']|'')*'|"(?:[^"\\]|\\.)*"|[^:]+?)\s*:\s*(.*)$/);
    if (!m) throw yamlError(no, `cannot read "${p}" in a flow mapping`);
    obj[unquote(m[1])] = parseScalar(m[2], no);
  }
  return obj;
}

function readYaml(rel) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  try {
    return { value: parseYaml(text), text };
  } catch (e) {
    err(rel, e.yamlLine, 'yaml_invalid', `invalid YAML: ${e.message}`);
    return { value: undefined, text };
  }
}

// Canonical spelling check: a value that needs single quotes, written bare (churn only).
function checkYamlQuoting(rel, text) {
  let count = 0, first = null;
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^\s*(?:-\s+)?[\w.-]+:\s+(.+?)\s*$/) || line.match(/^\s*-\s+(.+?)\s*$/);
    if (!m) return;
    const v = m[1];
    if (/^[\w.-]+:(\s|$)/.test(v)) return; // `- key:` opens a mapping
    if (/^['"]/.test(v) || /^(true|false|null|~|\||>|-?\d+(\.\d+)?)$/.test(v) || /^[\[{]/.test(v)) return;
    if (/ |:|[,\[\]{}&*#?"]/.test(v) || /^[-?|<>=!%@`]/.test(v)) { count++; first = first || i + 1; }
  });
  if (count) note(rel, first, 'yaml_quoting', `${count} value(s) with a space, colon or special character are not single-quoted; the sync will rewrite them`);
}

// ---------------------------------------------------------------------------------------
// Markdoc helpers

function parseAttrs(text) {
  const attrs = [];
  const re = /(?<![\w-])([A-Za-z][\w-]*)\s*=\s*("(?:[^"\\]|\\.)*"|\{(?:[^{}]|\{[^{}]*\})*\}|\[[^\]]*\]|[^\s"}%]+)/g;
  let m;
  while ((m = re.exec(text))) attrs.push({ name: m[1], raw: m[2] });
  const rest = text.replace(re, '').trim();
  return { attrs, rest };
}

function attrValue(raw) {
  if (raw.startsWith('"')) { try { return JSON.parse(raw); } catch { return raw.slice(1, -1); } }
  return raw;
}

function checkAttrs(file, line, name, spec, attrText, where) {
  const { attrs, rest } = parseAttrs(attrText);
  if (rest && /"/.test(rest)) err(file, line, 'tag_attr_quote', `${where}: an unescaped " inside an attribute value breaks the whole tag; write it as \\"`);
  else if (rest && !/^#[\w-]+$/.test(rest)) warn(file, line, 'tag_attr_unparsed', `${where}: could not read "${rest}"`);
  const seen = new Set();
  for (const a of attrs) {
    seen.add(a.name);
    const type = spec[a.name];
    if (type === undefined) { warn(file, line, 'tag_attr_unknown', `${where}: "${a.name}" is not an attribute of this tag, so it is dropped`); continue; }
    const quoted = a.raw.startsWith('"');
    const val = attrValue(a.raw);
    if (type === B) {
      if (quoted) err(file, line, 'quoted_boolean', `${where}: ${a.name}=${a.raw} is a string, which reads as true; write ${a.name}=${val} bare`);
      else if (!/^(true|false)$/.test(val)) err(file, line, 'bad_boolean', `${where}: ${a.name} must be true or false`);
    } else if (type === N) {
      if (quoted) note(file, line, 'quoted_number', `${where}: ${a.name}=${a.raw} should be a bare number`);
      else if (!/^\d+$/.test(val) && !(a.name === 'colwidth' && /^\[\s*\d+(\s*,\s*\d+)*\s*\]$/.test(val))) err(file, line, 'bad_number', `${where}: ${a.name} must be a whole number`);
    } else if (type === O) {
      if (!a.raw.startsWith('{')) err(file, line, 'bad_object', `${where}: ${a.name} must be an object like {"name":"value"}`);
    } else {
      if (!quoted) err(file, line, 'unquoted_string', `${where}: ${a.name}=${a.raw} must be a quoted string`);
      if (Array.isArray(type) && !type.includes(val)) err(file, line, 'bad_enum', `${where}: ${a.name}="${val}" must be one of ${type.join(', ')}`);
    }
  }
  return { attrs, seen };
}

// DeveloperHub's heading anchor (TextUtil::renderedHeadingSlug / route.helper).
function headingAnchor(text) {
  let h = text.trim().replace(/\s+#+$/, '');
  h = h.replace(/\{%\s*badge\b[^%]*?text="([^"]*)"[^%]*%\}/g, '$1')
    .replace(/\{%\s*key\b[^%]*?key="([^"]*)"[^%]*%\}/g, '$1')
    .replace(/\{%[^%]*%\}/g, '');
  h = h.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, (_, t) => t.trim());
  h = h.replace(/(`+)([^`]+)\1/g, (_, __, t) => t.trim());
  h = h.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|mdash|ndash|hellip|copy|reg|trade|rsquo|lsquo|rdquo|ldquo);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', copy: '\u00a9', reg: '\u00ae', trade: '\u2122', rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c' })[e]);
  h = h.replace(/(?<!\w)_+(.+?)_+(?!\w)/g, '$1');
  h = h.replace(/[^a-z0-9\-_ ]/gi, '');
  return h.toLowerCase().replace(/[^\w]/g, '-');
}

// Replace inline code spans with spaces (same length) so nothing inside them is scanned.
function maskInlineCode(line) {
  return line.replace(/(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g, (m) => ' '.repeat(m.length));
}

const pageCache = new Map();
const tabbedAnchors = new Set();

// Page frontmatter: DeveloperHub accepts any first line starting with --- and closes at
// the next line starting with --- (TextUtil::startsWith). Returns the closing index or -1.
function frontmatterClose(lines) {
  if (!lines[0] || !lines[0].startsWith('---')) return -1;
  for (let i = 1; i < lines.length; i++) if (lines[i].startsWith('---')) return i;
  return -1;
}
function loadPage(rel) {
  if (pageCache.has(rel)) return pageCache.get(rel);
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  let bodyStart = 0;
  let frontmatter = null;
  const close = frontmatterClose(lines);
  if (close > 0) { frontmatter = { lines: lines.slice(1, close), close }; bodyStart = close + 1; }
  const anchors = new Set();
  const tabStack = [];
  let fence = null;
  for (let i = bodyStart; i < lines.length; i++) {
    const l = lines[i];
    const f = l.match(/^\s*(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1][0] === fence[0] && f[1].length >= fence.length && /^\s*[`~]+\s*$/.test(l)) fence = null;
      continue;
    }
    if (fence) continue;
    const tab = l.match(/^\s*\{%\s*tab\s+[^%]*?title="((?:[^"\\]|\\.)*)"/);
    if (tab) tabStack.push(tab[1]);
    else if (/^\s*\{%\s*\/tab\s*%\}/.test(l)) tabStack.pop();
    const acc = l.match(/^\s*\{%\s*accordion\s+[^%]*?title="((?:[^"\\]|\\.)*)"/);
    if (acc) anchors.add(headingAnchor(acc[1]));
    const h = l.match(/^ {0,3}(#{1,6})\s+(.*)$/);
    if (h) {
      const own = headingAnchor(h[2]);
      // a heading inside a tab is anchored `tab-<tab title slug>:<heading slug>`
      anchors.add(tabStack.length ? `tab-${headingAnchor(tabStack[tabStack.length - 1])}:${own}` : own);
      if (tabStack.length) tabbedAnchors.add(`${rel}#${own}`);
    }
  }
  const info = { text, lines, bodyStart, frontmatter, anchors };
  pageCache.set(rel, info);
  return info;
}

// ---------------------------------------------------------------------------------------
// Project settings and variables

let projectVars = new Set();
let projectNavigation = null;

// developerhub.yaml `settings:` (ThemeSettings.php): a value DeveloperHub cannot use is reset
// to its default with a warning, so report it before the import does.
function checkThemeSettings(file, st) {
  if (!st || typeof st !== 'object' || Array.isArray(st)) return;
  const at = (k) => `settings.${k}`;
  const bad = (k, why) => warn(file, null, 'setting_reset', `${at(k)}: ${why}, so it is reset to its default`);
  for (const k of ['mainColour', 'linkColour', 'navLinkColour', 'inlineCodeColour']) {
    if (!(k in st) || st[k] === null || st[k] === '') continue;
    if (typeof st[k] !== 'string') bad(k, 'unquoted, YAML reads this colour as a number: single-quote it');
    else if (!/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(st[k].trim())) bad(k, `"${st[k]}" is not a hex colour`);
  }
  if ('uiVersion' in st && st.uiVersion !== null && ![1, 2, 3].includes(Number(st.uiVersion))) bad('uiVersion', `${st.uiVersion} is not a layout (1, 2 or 3)`);
  if ('darkMode' in st && st.darkMode !== null && typeof st.darkMode !== 'boolean' && !['auto', 'system', 'dark', 'light', 'on', 'off', 'yes', 'no', 'true', 'false', '1', '0', ''].includes(String(st.darkMode).toLowerCase())) bad('darkMode', `"${st.darkMode}" is not true, false or auto`);
  for (const k of ['lightCodeTheme', 'showThemeToggle', 'stickyTopnav', 'transparentTopnav', 'fullWidthFooter']) {
    if (k in st && st[k] !== null && typeof st[k] !== 'boolean') {
      if (/^(yes|no|on|off|1|0|true|false)$/i.test(String(st[k]))) note(file, null, 'setting_bool', `${at(k)}: read as ${/^(yes|on|1|true)$/i.test(String(st[k]))}, but written back as true or false`);
      else warn(file, null, 'setting_bool', `${at(k)}: "${st[k]}" reads as false; write true or false`);
    }
  }
  if ('fontFamily' in st && st.fontFamily !== null && typeof st.fontFamily !== 'string') bad('fontFamily', 'it must be a font name');
}
if (!projectSettingsFile) {
  warn('developerhub.yaml', null, 'project_settings_missing', 'no developerhub.yaml at the root: the project title and variables will not be set from the folder');
} else {
  const { value, text } = readYaml(projectSettingsFile);
  if (value !== undefined) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) err(projectSettingsFile, 1, 'project_settings_shape', 'developerhub.yaml must be a mapping');
    else {
      for (const k of Object.keys(value)) if (!PROJECT_KEYS.has(k)) warn(projectSettingsFile, null, 'settings_keys_ignored', `"${k}" is not read from developerhub.yaml`);
      const SETTINGS_KEYS = ['uiVersion', 'darkMode', 'lightCodeTheme', 'showThemeToggle', 'stickyTopnav', 'transparentTopnav', 'fullWidthFooter', 'mainColour', 'linkColour', 'navLinkColour', 'inlineCodeColour', 'fontFamily'];
      const NAVIGATION_KEYS = ['openLinksNewTab', 'logoUrl', 'links', 'groups'];
      for (const [block, keys] of [['settings', SETTINGS_KEYS], ['navigation', NAVIGATION_KEYS]]) {
        if (value[block] === undefined || value[block] === null) continue;
        if (typeof value[block] !== 'object' || Array.isArray(value[block])) { warn(projectSettingsFile, null, 'settings_block', `${block}: must be a mapping, so it is ignored`); continue; }
        for (const k of Object.keys(value[block])) if (!keys.includes(k)) warn(projectSettingsFile, null, 'settings_keys_ignored', `"${block}.${k}" is not read`);
      }
      checkThemeSettings(projectSettingsFile, value.settings);
      projectNavigation = value.navigation && typeof value.navigation === 'object' && !Array.isArray(value.navigation) ? value.navigation : null;
      if (value.variables && typeof value.variables === 'object') {
        const flat = (obj, prefix) => {
          for (const [k, v] of Object.entries(obj)) {
            const varName = prefix ? `${prefix}.${k}` : k;
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) warn(projectSettingsFile, null, 'variable_name', `variable "${varName}": a name may use only letters, digits and _ (no dashes), or %${varName}% shows as plain text`);
            if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, varName);
            else projectVars.add(varName);
            if (/(secret|token|password|passwd|api[_-]?key|private)/i.test(k)) warn(projectSettingsFile, null, 'variable_secret', `variable "${varName}" looks like a secret; variables render into public docs`);
          }
        };
        flat(value.variables, '');
      }
    }
    checkYamlQuoting(projectSettingsFile, text);
    if (value && typeof value === 'object' && value.variables && typeof value.variables === 'object') {
      // A number or boolean is printed as typed, so only a value YAML changes needs quoting.
      const writtenAsShown = (k, v) => {
        const m = text.match(new RegExp(`^\\s*${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*([^\\s#][^#]*?)\\s*(?:#.*)?$`, 'm'));
        return !!m && m[1] === String(v);
      };
      const scan = (obj, prefix) => {
        for (const [k, v] of Object.entries(obj)) {
          const varName = prefix ? `${prefix}.${k}` : k;
          if (v && typeof v === 'object' && !Array.isArray(v)) scan(v, varName);
          else if ((typeof v === 'number' || typeof v === 'boolean') && !writtenAsShown(k, v)) warn(projectSettingsFile, null, 'variable_not_text', `variables.${varName} is not text to YAML (it reads as ${v}), so %${varName}% shows ${v}: quote the value`);
        }
      };
      scan(value.variables, '');
    }
    text.split('\n').forEach((ln, i) => {
      const cm = ln.match(/^\s+(mainColour|linkColour|navLinkColour|inlineCodeColour):\s+#/);
      if (cm) warn(projectSettingsFile, i + 1, 'setting_reset', `settings.${cm[1]}: a bare # starts a YAML comment, so the colour is empty and silently goes back to the default: write the hex without # (single-quoted if YAML would read it as a number, like '5368e7')`);
    });
  }
}

// ---------------------------------------------------------------------------------------
// Versions, documentations, references

const sitePaths = new Set();
const SLUG_PAGE = /^[A-Za-z0-9-]+$/;
const SLUG_DOC = /^[A-Za-z0-9.-]+$/;

for (const [v, ve] of versions) {
  const vfile = ve.settingsFile || `${v}/_settings.yaml`;
  if (v === 'changelogs') err(v, null, 'reserved_version', '"changelogs" is reserved and cannot be a version');
  if (v.length > 64) err(v, null, 'slug_too_long', `version folder "${v}" is ${v.length} characters; a slug holds at most 64`);
  if (!SLUG_DOC.test(v)) err(v, null, 'version_slug', `version folder "${v}" may use only letters, digits, dots and dashes`);
  else if (/[A-Z]/.test(v)) warn(v, null, 'version_slug_case', `version folder "${v}" has capitals; DeveloperHub slugs are lowercase`);

  const hasContent = [...ve.docs.values()].some((d) => d.pages.length) || [...ve.refs.values()].some((r) => r.spec);
  if (!hasContent) warn(v, null, 'version_empty', 'this version holds no page or API spec, so it is not created');

  let vs = null;
  if (!ve.settingsFile) warn(vfile, null, 'version_settings_missing', 'no _settings.yaml: the version has no name and stays unpublished, and its documentations have no order');
  else {
    const { value, text } = readYaml(ve.settingsFile);
    vs = value;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const k of Object.keys(value)) if (!VERSION_KEYS.has(k)) warn(vfile, null, 'settings_keys_ignored', `"${k}" is not a version setting`);
      if (value.published !== true) note(vfile, null, 'unpublished', 'published is not true: this version stays unpublished after import');
      checkOrderList(vfile, value.documentations, [...ve.docs.keys()].filter((d) => ve.docs.get(d).pages.length), 'documentations');
      checkOrderList(vfile, value.references, [...ve.refs.keys()].filter((r) => ve.refs.get(r).spec), 'references');
    } else if (value !== undefined) err(vfile, 1, 'settings_shape', '_settings.yaml must be a mapping');
    checkYamlQuoting(ve.settingsFile, text);
  }

  for (const [slug, r] of ve.refs) {
    const where = `${v}/refs/${slug}`;
    if (!r.spec) { warn(r.sidecar, null, 'ref_sidecar_orphan', 'a reference sidecar with no spec file next to it'); continue; }
    if (ve.docs.has(slug)) err(r.spec, null, 'slug_conflict', `the reference "${slug}" has the same slug as a documentation in this version`);
    if (!SLUG_DOC.test(slug)) err(r.spec, null, 'ref_slug', `reference slug "${slug}" may use only letters, digits, dots and dashes`);
    checkSpec(r.spec);
    if (!r.sidecar) warn(r.spec, null, 'ref_sidecar_missing', `no ${slug}.settings.yaml: the reference has no title and stays unpublished`);
    else {
      const { value } = readYaml(r.sidecar);
      if (value && typeof value === 'object') {
        for (const k of Object.keys(value)) if (!REF_SIDECAR_KEYS.has(k)) warn(r.sidecar, null, 'settings_keys_ignored', `"${k}" is not a reference setting`);
        if (value.published !== true) note(r.sidecar, null, 'unpublished', `${where} stays unpublished after import`);
      }
    }
    sitePaths.add(`/${slug}`).add(`/${v}/${slug}`);
  }

  for (const [d, de] of ve.docs) {
    const where = `${v}/${d}`;
    if (d.length > 64) err(where, null, 'slug_too_long', `documentation folder "${d}" is ${d.length} characters; a slug holds at most 64`);
    if (!SLUG_DOC.test(d)) err(where, null, 'doc_slug', `documentation folder "${d}" may use only letters, digits, dots and dashes`);
    else if (/[A-Z]/.test(d)) warn(where, null, 'doc_slug_case', `documentation folder "${d}" has capitals; DeveloperHub slugs are lowercase`);
    if (!de.pages.length) { warn(where, null, 'doc_empty', 'this documentation holds no page, so it is not created'); continue; }
    sitePaths.add(`/${d}`).add(`/${v}/${d}`);
    if (!de.settingsFile) warn(`${where}/_settings.yaml`, null, 'doc_settings_missing', 'no _settings.yaml: the documentation title defaults to its folder name');
    else {
      const { value, text } = readYaml(de.settingsFile);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const k of Object.keys(value)) if (!DOC_KEYS.has(k)) warn(de.settingsFile, null, 'settings_keys_ignored', `"${k}" is not a documentation setting`);
        if (value.locale !== undefined && value.locale !== null && !LOCALES.includes(String(value.locale))) warn(de.settingsFile, null, 'locale_unknown', `locale "${value.locale}" is not one DeveloperHub has: ${LOCALES.join(', ')}`);
        if (value.published !== true) note(de.settingsFile, null, 'unpublished', 'published is not true: this documentation stays unpublished after import');
      }
      checkYamlQuoting(de.settingsFile, text);
    }

    // pages: slugs, uniqueness, parents
    const bySlug = new Map();
    for (const rel of de.pages) {
      const p = pages.get(rel);
      for (const part of [...p.parents, p.slug]) {
        if (part.length > 64) err(rel, null, 'slug_too_long', `"${part}" is ${part.length} characters; a slug holds at most 64`);
        if (!SLUG_PAGE.test(part)) err(rel, null, 'page_slug', `"${part}" is not a valid page slug: letters, digits and dashes only (no dots, underscores or spaces)`);
        else if (/[A-Z]/.test(part)) warn(rel, null, 'page_slug_case', `"${part}" has capitals; DeveloperHub slugs are lowercase`);
      }
      if (bySlug.has(p.slug)) err(rel, null, 'duplicate_slug', `slug "${p.slug}" is also used by ${bySlug.get(p.slug)}: slugs must be unique within a documentation, at any depth`);
      else bySlug.set(p.slug, rel);
      for (let k = 1; k <= p.parents.length; k++) {
        const parentFile = `${v}/${d}/${p.parents.slice(0, k).join('/')}.md`;
        if (!fileSet.has(parentFile)) { err(rel, null, 'parent_page_not_found', `its parent page ${parentFile} does not exist, so it lands at the documentation root`); break; }
      }
      sitePaths.add(`/${d}/${p.slug}`).add(`/${v}/${d}/${p.slug}`);
    }

    // navigation
    if (!de.navFile) warn(`${where}/_nav.yaml`, null, 'nav_missing', 'no _nav.yaml: pages are added in no particular order');
    else checkNav(de.navFile, v, d, de.pages);
  }
}

function checkOrderList(file, list, actual, listName) {
  if (list === undefined || list === null) {
    if (actual.length > 1) warn(file, null, 'order_missing', `no ${listName}: list, so their order is not set`);
    return;
  }
  if (!Array.isArray(list)) { err(file, null, 'order_shape', `${listName} must be a list of slugs`); return; }
  const set = new Set(list.map(String));
  for (const s of set) if (!actual.includes(s)) warn(file, null, 'order_unknown', `${listName} lists "${s}", which has no folder with content here`);
  for (const a of actual) if (!set.has(a)) warn(file, null, 'order_unlisted', `${listName} does not list "${a}"; it is appended at the end`);
}

function checkSpec(rel) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (rel.endsWith('.json')) {
    try { JSON.parse(text); } catch (e) { err(rel, null, 'spec_invalid', `invalid JSON: ${e.message}`); return; }
  }
  if (!/^\s*["']?(openapi|swagger|asyncapi)["']?\s*:/m.test(text)) warn(rel, null, 'spec_unknown', 'no top-level openapi:, swagger: or asyncapi: key found');
  const ext = text.match(/["']?\$ref["']?\s*:\s*["']?(?!#)([^"'\s,}]+)/);
  if (ext) err(rel, null, 'spec_external_ref', `$ref to another file (${ext[1]}): bundle the spec into one self-contained file`);
}

function checkNav(rel, v, d, docPages) {
  let { value, text } = readYaml(rel);
  if (value === undefined) return;
  if (value && typeof value === 'object' && !Array.isArray(value) && value.items && typeof value.items === 'object' && !Array.isArray(value.items) && !Object.keys(value.items).length) value.items = null; // `items: {}` is an empty list to Symfony
  if (value === null || (value && typeof value === 'object' && !Array.isArray(value) && value.items === null)) {
    warn(rel, 1, 'nav_empty', '_nav.yaml lists nothing, so every page is added in no particular order');
    value = { items: [] };
  }
  if (!value || typeof value !== 'object' || !Array.isArray(value.items)) {
    err(rel, 1, 'nav_shape', '_nav.yaml must hold one items: list (this blocks the whole navigation)');
    return;
  }
  for (const k of Object.keys(value)) if (k !== 'items') warn(rel, null, 'nav_key', `"${k}" is not read; only items: is`);
  checkYamlQuoting(rel, text);
  if (/^( {1}| {3})\S/m.test(text)) note(rel, null, 'nav_indent', '_nav.yaml nests by two spaces; the sync will rewrite other indentation');

  const prefix = `${v}/${d}/`;
  const docPagePaths = new Set(docPages.map((p) => p.slice(prefix.length, -3)));
  const listed = new Map();

  const walk = (items, parent, where) => {
    if (items && typeof items === 'object' && !Array.isArray(items) && !Object.keys(items).length) return; // `items: {}` is an empty list to Symfony
    if (!Array.isArray(items)) { err(rel, null, 'nav_shape', `${where}: items must be a list`); return; }
    const itemLines = seqLineOf.get(items) || [];
    for (const [idx, item] of items.entries()) {
      if (typeof item === 'string') {
        if (item === 'separator') continue;
        leaf(item, null, parent, where);
        continue;
      }
      if (!item || typeof item !== 'object' || Array.isArray(item)) { err(rel, itemLines[idx], 'nav_entry', `${where}: ${typeof item === 'number' || typeof item === 'boolean' ? `this entry is not text to YAML (it reads as ${item}): quote it` : `${JSON.stringify(item)} is not a page path or a mapping`} (this blocks the whole navigation)`); continue; }
      const line = lineOf.get(item);
      const types = ['page', 'category', 'label', 'link', 'separator'].filter((k) => k in item);
      if (types.length !== 1) { err(rel, line, 'nav_entry_types', `${where}: an entry needs exactly one of page, category, label, link or separator, not ${types.join(' + ') || 'none'} (this blocks the whole navigation)`); continue; }
      if ('icon' in item && item.icon !== null && typeof item.icon !== 'string') err(rel, line, 'nav_icon_type', `${where}: icon must be text (this blocks the whole navigation)`);
      for (const t of ['page', 'category', 'label']) {
        if (t in item && (typeof item[t] !== 'string' || !item[t].trim())) {
          err(rel, line, 'nav_title_type', `${where}: ${t}: ${JSON.stringify(item[t])} must be ${t === 'page' ? 'a path' : 'a title'} written as text${typeof item[t] === 'number' ? ' (quote it, or YAML reads a number)' : ''} (this blocks the whole navigation)`);
        }
      }
      if ('separator' in item && item.separator !== null && item.separator !== true) err(rel, line, 'nav_separator_value', `${where}: separator takes no value (this blocks the whole navigation)`);
      if (['page', 'category', 'label'].includes(types[0]) && typeof item[types[0]] !== 'string') continue;
      if ('page' in item) {
        leaf(String(item.page), item, parent, where, line);
        checkIconToken(rel, item.icon, `page ${item.page}`);
        if (item.items !== undefined && item.items !== null) walk(item.items, normalisePath(String(item.page)), `page ${item.page}`);
      } else if ('category' in item) {
        if (!item.category) err(rel, line, 'nav_category_title', `${where}: a category needs a title`);
        checkIconToken(rel, item.icon, `category ${item.category}`);
        if (item.items !== undefined && item.items !== null) walk(item.items, parent, `category ${item.category}`);
      } else if ('label' in item) {
        if ('items' in item) err(rel, line, 'nav_label_items', `label "${item.label}" cannot hold items (this blocks the whole navigation)`);
        checkIconToken(rel, item.icon, `label ${item.label}`);
      } else if ('link' in item) {
        if ('items' in item) err(rel, line, 'nav_link_items', 'a link cannot hold items (this blocks the whole navigation)');
        const l = item.link;
        if (l && typeof l === 'object' && ((l.title !== null && l.title !== undefined && typeof l.title !== 'string') || (l.url !== null && l.url !== undefined && typeof l.url !== 'string'))) err(rel, line, 'nav_link', 'quote the link\'s title and url: YAML reads one of them as a number or date (this blocks the whole navigation)');
        else if (!l || typeof l !== 'object' || typeof l.title !== 'string' || !l.title.trim() || typeof l.url !== 'string' || !l.url.trim()) err(rel, line, 'nav_link', 'a link needs title: and url: indented under link: (this blocks the whole navigation)');
        else if (!/^(https?:\/\/|\/)/.test(String(l.url))) warn(rel, line, 'nav_link_url', `link url "${l.url}" should be a full URL, or a site path starting with /`);
        checkIconToken(rel, item.icon, `link ${l && l.title}`);
      } else if ('separator' in item) {
        // `- separator:` written as a mapping
      } else err(rel, line, 'nav_entry', `${where}: unknown entry ${JSON.stringify(item)}`);
    }
  };

  const normalisePath = (p) => p.replace(/\.md$/, '');
  const leaf = (raw, item, parent, where, line) => {
    if (raw.startsWith('/') || raw.includes('\\') || raw.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) {
      err(rel, line, 'nav_path_invalid', `"${raw}": page paths are documentation-relative, with no leading /, ./ or ../ and no trailing / (this blocks the whole navigation)`);
      return;
    }
    if (raw.endsWith('.md')) note(rel, line, 'nav_md_suffix', `"${raw}": write page paths without .md`);
    const p = normalisePath(raw);
    if (p === '') { err(rel, line, 'nav_path_invalid', `"${raw}" is an empty page path (this blocks the whole navigation)`); return; }
    if (!docPagePaths.has(p)) { warn(rel, line, 'nav_no_file', `"${p}" has no ${prefix}${p}.md, so the entry is skipped`); return; }
    const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    if (dir !== parent) warn(rel, line, 'nav_misplaced_entry', `"${p}" is listed under ${parent ? `page ${parent}` : 'the documentation root'}${where.startsWith('category') ? ` (in ${where})` : ''}, but its folder makes it a child of ${dir || 'the root'}: it is skipped there. Move the file to change its parent.`);
    if (listed.has(p)) warn(rel, line, 'nav_duplicate', `"${p}" is listed twice`);
    listed.set(p, true);
    const hasChildren = [...docPagePaths].some((x) => x.startsWith(p + '/') && !x.slice(p.length + 1).includes('/'));
    if (hasChildren && !(item && Array.isArray(item.items))) warn(rel, line, 'nav_children_unlisted', `"${p}" has child pages in ${p}/ but no items: under it; write it as "- page: ${p}" with its children listed`);
  };

  walk(value.items, '', 'the root');
  for (const p of docPagePaths) if (!listed.has(p)) warn(rel, null, 'nav_drift_unlisted', `${prefix}${p}.md is not in _nav.yaml, so it is appended at the end of its section`);
}

// ---------------------------------------------------------------------------------------
// developerhub.yaml `navigation:` (NavigationSettings.php)

if (projectNavigation) {
  const f = projectSettingsFile;
  const nav = projectNavigation;
  if ('openLinksNewTab' in nav && nav.openLinksNewTab !== null && typeof nav.openLinksNewTab !== 'boolean') warn(f, null, 'setting_bool', 'navigation.openLinksNewTab: write true or false');
  if ('links' in nav && nav.links !== null) {
    if (!Array.isArray(nav.links)) warn(f, null, 'navigation_invalid', 'navigation.links must be a list of title + url, so it is ignored');
    else {
      if (nav.links.length > 4) warn(f, null, 'navigation_links_truncated', `navigation.links has ${nav.links.length} entries; only the first four are shown`);
      nav.links.forEach((l, i) => {
        if (!l || typeof l !== 'object' || Array.isArray(l)) warn(f, null, 'navigation_invalid', `navigation.links entry ${i + 1} must be a title and a url`);
        else if (!l.title || !l.url) warn(f, lineOf.get(l), 'navigation_invalid', `navigation.links entry ${i + 1} needs both title and url`);
        else if (typeof l.url !== 'string') warn(f, lineOf.get(l), 'navigation_invalid', `navigation.links entry ${i + 1}: quote the url`);
      });
    }
  }
  if ('groups' in nav && nav.groups !== null) {
    if (!Array.isArray(nav.groups)) warn(f, null, 'navigation_invalid', 'navigation.groups must be a list, so it is ignored');
    else {
      const sections = new Set([...changelogs.keys()]);
      for (const ve of versions.values()) { for (const d of ve.docs.keys()) sections.add(d); for (const r of ve.refs.keys()) sections.add(r); }
      const titles = new Set();
      nav.groups.forEach((g, i) => {
        if (!g || typeof g !== 'object' || Array.isArray(g) || !g.title) { warn(f, null, 'navigation_invalid', `navigation.groups entry ${i + 1} needs a title, so it is skipped`); return; }
        if (titles.has(g.title)) warn(f, lineOf.get(g), 'navigation_group_duplicate', `two groups are titled "${g.title}"; groups are matched by title`);
        titles.add(g.title);
        checkIconToken(f, g.icon, `group ${g.title}`);
        if (g.sections !== undefined && g.sections !== null && !Array.isArray(g.sections)) warn(f, lineOf.get(g), 'navigation_invalid', `group "${g.title}": sections must be a list like [guide, api], or the group is emptied`);
        for (const sec of Array.isArray(g.sections) ? g.sections : []) if (!sections.has(String(sec))) warn(f, lineOf.get(g), 'navigation_group_section', `group "${g.title}" lists "${sec}", which is no documentation, API reference or changelog in this folder`);
      });
    }
  }
}

// ---------------------------------------------------------------------------------------
// Changelogs and synced blocks

for (const [cp, c] of changelogs) {
  sitePaths.add(`/${cp}`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(cp)) warn(`changelogs/${cp}`, null, 'changelog_path', `changelog folder "${cp}" is its URL path: use lowercase letters, digits and dashes`);
  const { value } = readYaml(c.settingsFile);
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) if (!CHANGELOG_KEYS.has(k)) warn(c.settingsFile, null, 'settings_keys_ignored', `"${k}" is not a changelog setting`);
    if (!value.title) warn(c.settingsFile, null, 'changelog_title', 'the changelog has no title');
  }
}
for (const [rel, p] of posts) {
  if (!changelogs.has(p.changelog)) warn(rel, null, 'changelog_settings_missing', `changelogs/${p.changelog}/_settings.yaml is missing`);
  sitePaths.add(`/${p.changelog}/${p.slug}`);
}

const blockVars = new Map();
for (const [id, rel] of blocks) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) err(rel, null, 'synced_block_id', `"${id}" is not a valid block id (lowercase letters, digits and dashes, starting with a letter), so the file is skipped`);
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  const vars = new Set();
  if (!m) warn(rel, 1, 'synced_block_frontmatter', 'no frontmatter: give the block a title');
  else {
    try {
      const fm = parseYaml(m[1]) || {};
      for (const k of Object.keys(fm)) if (!BLOCK_FILE_KEYS.has(k)) warn(rel, null, 'synced_block_keys', `"${k}" is not read from a synced block; only title and variables are`);
      if (fm.variables && typeof fm.variables === 'object') {
        for (const [k, val] of Object.entries(fm.variables)) {
          vars.add(k);
          if (!/^[A-Za-z][A-Za-z0-9_]{1,127}$/.test(k)) err(rel, null, 'synced_block_variable', `variable name "${k}" must start with a letter and use 2 to 128 letters, digits or underscores`);
          if (typeof val !== 'string' && val !== null) warn(rel, null, 'synced_block_variable_value', `default for "${k}" is not quoted text; quote it`);
        }
      }
    } catch (e) {
      err(rel, e.yamlLine ? e.yamlLine + 1 : 1, 'yaml_invalid', `invalid frontmatter YAML: ${e.message}`);
    }
  }
  blockVars.set(id, vars);
}

// ---------------------------------------------------------------------------------------
// Bodies

const stats = { pages: pages.size, posts: posts.size, blocks: blocks.size, images: images.size, imageBytes: 0, externalImages: 0, links: 0, relLinks: 0 };
for (const img of images) stats.imageBytes += fs.statSync(path.join(ROOT, img)).size;
const syncedUsed = new Map();
const externalImageFiles = new Map();

for (const rel of pages.keys()) checkPageFrontmatter(rel);
for (const rel of posts.keys()) checkPostFrontmatter(rel);
for (const rel of pages.keys()) scanBody(rel, 'page');
for (const rel of posts.keys()) scanBody(rel, 'post');
for (const [id, rel] of blocks) scanBody(rel, 'block', id);

for (const [id, users] of syncedUsed) if (!blocks.has(id)) err(users[0].file, users[0].line, 'synced_block_missing', `{% synced id="${id}" %} has no _synced-blocks/${id}.md (used ${users.length} time(s))`);
for (const [file, count] of externalImageFiles) note(file, null, 'external_images', `${count} image(s) load from another site; they break if that site goes away`);

function checkPageFrontmatter(rel) {
  const pg = loadPage(rel);
  if (pg.text.startsWith('\uFEFF')) { err(rel, 1, 'byte_order_mark', 'the file starts with a byte-order mark, so its frontmatter is not read: save it as UTF-8 without a BOM'); return; }
  if (pg.text.includes('\uFFFD')) warn(rel, null, 'not_utf8', 'the file is not valid UTF-8, so some characters will be replaced: re-save it as UTF-8');
  if (!pg.frontmatter) { err(rel, 1, 'frontmatter_missing', 'no frontmatter block: a page starts with --- , its fixed keys, and ---'); return; }
  const fm = pg.frontmatter;
  if (fm.close > FRONTMATTER_MAX_LINES - 1) { err(rel, fm.close + 1, 'frontmatter_too_long', `the closing --- is on line ${fm.close + 1}; it must be within the first ${FRONTMATTER_MAX_LINES} lines, or the whole file, frontmatter included, becomes the page body`); return; }
  const keys = new Map();
  fm.lines.forEach((l, i) => {
    const no = i + 2;
    if (!l.trim()) return;
    const m = l.match(/^([A-Za-z_][\w-]*):(.*)$/);
    if (!m) { warn(rel, no, 'frontmatter_line', `cannot read "${l}" (page frontmatter is one key: value per line)`); return; }
    const field = m[1], val = m[2].trim();
    keys.set(field, { val, no });
    if (field === 'slug') warn(rel, no, 'frontmatter_slug', 'slug: is ignored in a synced repo (the filename is the slug): remove it');
    else if (!PAGE_KEYS.has(field)) warn(rel, no, 'frontmatter_key', `"${field}" is not a page frontmatter key, so it is ignored`);
    if (/^'.*'$/.test(val) && val.length >= 2) err(rel, no, 'frontmatter_quoted', `${field}: page frontmatter is not YAML, so single quotes become part of the value; write it bare`);
    else if (/^"[^"]*"$/.test(val) && val.length >= 2) note(rel, no, 'frontmatter_double_quoted', `${field}: the double quotes are dropped on import and the value is written back bare`);
    else if (/^"|"$/.test(val) && PAGE_KEYS.has(field)) err(rel, no, 'frontmatter_edge_quote', `${field}: every " at the start and end of a value is stripped on import (${val} becomes ${val.replace(/^"+|"+$/g, '')}); reword it so it does not start or end with a quote`);
    if ((field === 'listed' || field === 'hidden') && !/^(true|false)?$/.test(val)) warn(rel, no, 'frontmatter_bool', `${field} must be true or false; anything but true, yes or 1 reads as false`);
    if (field === 'listed' && val === '') warn(rel, no, 'frontmatter_listed_empty', 'an empty listed: reads as false, which hides the page from the sidebar: write listed: true');
    if (field === 'hidden' && val === '') note(rel, no, 'frontmatter_bool_empty', 'hidden: is empty; DeveloperHub writes it back as false');
    if (/^\s*[\[{]/.test(val) || /^\s*-\s/.test(val)) warn(rel, no, 'frontmatter_list', `${field}: lists are not read here; write comma-separated values`);
  });
  if (!keys.has('title') || !keys.get('title').val) err(rel, 2, 'frontmatter_title', 'the page has no title');
  if (keys.has('type') && keys.get('type').val !== 'page') warn(rel, keys.get('type').no, 'frontmatter_type', `type: ${keys.get('type').val}: a page file is type: page; another type can change its sidebar entry`);
  if (!keys.has('type')) note(rel, 2, 'frontmatter_type_missing', 'type: page is missing; the sync writes it back');
  if (keys.has('audience') && keys.get('audience').val) note(rel, keys.get('audience').no, 'audience', `gated to audience "${keys.get('audience').val}": it must exist in the project, or no reader sees the page`);
}

function checkPostFrontmatter(rel) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!m) { err(rel, 1, 'post_frontmatter_missing', 'a changelog post needs title, date and published frontmatter'); return; }
  try {
    const fm = parseYaml(m[1]) || {};
    for (const k of Object.keys(fm)) if (!POST_KEYS.has(k)) warn(rel, null, 'post_key', `"${k}" is not read from a changelog post`);
    if (!fm.title) err(rel, 2, 'post_title', 'the post has no title');
    if (fm.date === undefined) warn(rel, null, 'post_date', 'no date: the post is dated whenever the sync runs');
    else if (typeof fm.date === 'number') {
      const rawDate = ((m[1].match(/^date:[ \t]*(.*)$/m) || [])[1] || '').replace(/\s+#.*$/, '').trim();
      if (!Number.isInteger(fm.date)) warn(rel, null, 'post_date_format', `date ${rawDate}: unquoted with fractional seconds YAML reads a decimal, which is not read as a date; quote it`);
      else if (/^\d+$/.test(rawDate)) warn(rel, null, 'post_date_format', `date ${rawDate}: a bare number is read as seconds since 1970, so the post is dated ${Number.isFinite(new Date(fm.date * 1000).getTime()) ? new Date(fm.date * 1000).toISOString().slice(0, 10) : 'far in the future'}; write 'YYYY-MM-DD'`);
      else note(rel, null, 'post_date_format', 'the date is unquoted, so YAML reads it as a timestamp; it works, but the canonical form is a quoted YYYY-MM-DD');
    }
    else if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(String(fm.date))) {
      if (Number.isNaN(Date.parse(String(fm.date)))) warn(rel, null, 'post_date_format', `date "${fm.date}" may not read as a date; write YYYY-MM-DD, quoted`);
      else note(rel, null, 'post_date_format', `date "${fm.date}" is read, but the canonical form is YYYY-MM-DD (or YYYY-MM-DD HH:MM:SS), quoted`);
    }
    if (fm.published !== true && fm.published !== false) warn(rel, null, 'post_published', 'published: true or false is missing');
  } catch (e) {
    err(rel, e.yamlLine ? e.yamlLine + 1 : 1, 'yaml_invalid', `invalid frontmatter YAML: ${e.message}`);
  }
}

function scanBody(rel, kind, blockId) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  let start = 0;
  const c = frontmatterClose(lines);
  if (c > 0) start = c + 1;
  const dir = path.posix.dirname(rel);
  const myVersion = rel.split('/')[0];
  const stack = [];
  let fence = null;
  let inHtml = null;
  let lastHeadingLevel = 1;
  let prevLine = '';
  let rwFence = false; // the sync's link/image rewriters flip in and out of code on every ``` or ~~~ line
  let listContext = false;

  for (let i = start; i < lines.length; i++) {
    const no = i + 1;
    const line = lines[i];

    // fenced code
    if (/^\s*(```|~~~)/.test(line)) rwFence = !rwFence;
    const fm = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (fm && fm[2][0] === fence.ch && fm[2].length >= fence.len && fm[3].trim() === '') fence = null;
      prevLine = '';
      continue;
    }
    if (inHtml) {
      if (/^\s*\{%\s*\/html\s*%\}\s*$/.test(line)) { inHtml = null; if (stack.length && stack[stack.length - 1].name === 'html') stack.pop(); }
      prevLine = '';
      continue;
    }
    if (fm && !(fm[2][0] === '`' && fm[3].includes('`'))) {
      fence = { ch: fm[2][0], len: fm[2].length, no };
      checkFenceInfo(rel, no, fm[3]);
      if (stack.length && CONTAINER_CHILD[stack[stack.length - 1].name]) warn(rel, no, 'container_content', `a code block directly inside {% ${stack[stack.length - 1].name} %} belongs inside a {% ${CONTAINER_CHILD[stack[stack.length - 1].name]} %}`);
      continue;
    }

    const masked = maskInlineCode(line.replace(/\\[{}%[\]<>`*_~]/g, '  '));
    const top = stack.length ? stack[stack.length - 1].name : null;

    // tags
    const tagsOnLine = scanTags(masked);
    let residue = masked;
    for (const t of tagsOnLine) residue = residue.slice(0, t.start) + ' '.repeat(t.text.length) + residue.slice(t.start + t.text.length);
    if (/\{%/.test(residue)) err(rel, no, 'stray_tag_open', 'a "{%" that never closes with "%}": escape a literal one as \\{%');

    for (const t of tagsOnLine) {
      if (!t.name) {
        if (/^\s*#[\w-]+\s*$/.test(t.attrText) || /=/.test(t.attrText)) warn(rel, no, 'annotation', `${t.text}: an annotation outside a code fence is not part of the DeveloperHub dialect`);
        else err(rel, no, 'tag_invalid', `${t.text} is not a valid tag`);
        continue;
      }
      if (t.name.startsWith('$')) {
        if (kind !== 'block') warn(rel, no, 'block_variable_in_page', `${t.text} renders nothing outside a synced block file`);
        else if (!blockVars.get(blockId)?.has(t.name.slice(1))) warn(rel, no, 'block_variable_undeclared', `${t.text}: "${t.name.slice(1)}" is not declared under variables:`);
        continue;
      }
      const spec = TAGS[t.name];
      if (!spec) {
        err(rel, no, 'unknown_tag', `{% ${t.closing ? '/' : ''}${t.name} %} is not a DeveloperHub tag: it renders as nothing${t.closing ? '' : ' and, unclosed, can swallow the rest of the page'}`);
        continue;
      }
      const where = `{% ${t.name} %}`;
      if (t.closing) {
        if (!stack.length) err(rel, no, 'stray_close', `{% /${t.name} %} closes nothing`);
        else if (stack[stack.length - 1].name !== t.name) err(rel, no, 'mismatched_close', `{% /${t.name} %} closes {% ${stack[stack.length - 1].name} %} opened on line ${stack[stack.length - 1].no}`);
        else stack.pop();
        if (spec.form !== 'inline-body' && masked.trim() !== t.text) err(rel, no, 'tag_not_own_line', `${t.text} must be on a line of its own`);
        continue;
      }
      const { attrs, seen } = checkAttrs(rel, no, t.name, spec.attrs, t.attrText, where);
      for (const r of spec.required || []) if (!seen.has(r)) err(rel, no, 'tag_attr_missing', `${where} needs ${r}=`);
      if (spec.parent && (stack.length ? stack[stack.length - 1].name : null) !== spec.parent) err(rel, no, 'tag_parent', `${where} must sit directly inside {% ${spec.parent} %}`);
      if (t.self) {
        if (spec.form === 'body') err(rel, no, 'tag_self_closed', `${where} needs a body and a {% /${t.name} %} closing tag`);
        if ((spec.form === 'self' || spec.form === 'either') && masked.trim() !== t.text) warn(rel, no, 'tag_not_own_line', `${t.text} belongs on a line of its own`);
      } else {
        if (spec.form === 'self' || spec.form === 'inline') err(rel, no, 'tag_not_self_closed', `${where} must be self-closing: end it with /%}`);
        else {
          if ((spec.form === 'body' || spec.form === 'either') && masked.trim() !== t.text) err(rel, no, 'tag_not_own_line', `${t.text} must be on a line of its own, or it becomes a plain paragraph`);
          stack.push({ name: t.name, no });
          if (t.name === 'html' && !tagsOnLine.some((x) => x.closing && x.name === 'html')) inHtml = no;
        }
      }
      // attribute-level checks
      const get = (n) => { const a = attrs.find((x) => x.name === n); return a ? attrValue(a.raw) : null; };
      if (t.name === 'icon' && get('classes') !== null) checkIconClasses(rel, no, get('classes'));
      const tagTarget = get('url') ?? get('link') ?? get('href');
      if (rwFence && tagTarget && ['image', 'inline-image', 'card', 'link'].includes(t.name) && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(tagTarget)) err(rel, no, 'rewriter_in_code', `the sync thinks this line is inside a code block (a \`\`\` line inside a longer fence above), so it does not resolve this ${t.name} target`);
      if ((t.name === 'image' || t.name === 'inline-image') && get('url') !== null) checkImageTarget(rel, no, dir, get('url'));
      if (t.name === 'card') for (const k of ['title', 'text']) if (get(k) && /<\/?[a-z][a-z0-9]*[\s>/]/i.test(get(k))) warn(rel, no, 'card_html', `{% card %} ${k} holds HTML, which shows as literal text: flatten it to plain text`);
      if (t.name === 'card' && get('link') !== null) checkLinkTarget(rel, no, dir, myVersion, get('link'), kind, 'card link');
      if (t.name === 'link' && get('href') !== null) checkLinkTarget(rel, no, dir, myVersion, get('href'), kind, 'link');
      if (t.name === 'synced' && get('id') !== null) {
        const id = get('id');
        if (!syncedUsed.has(id)) syncedUsed.set(id, []);
        syncedUsed.get(id).push({ file: rel, line: no });
      }
      if (t.name === 'video' && get('provider') === 'raw' && get('videoId')) {
        if (!/^https?:\/\//.test(get('videoId'))) err(rel, no, 'video_url', 'a raw video needs the full public URL of the file; videos are not uploaded');
        else if (/^http:/.test(get('videoId'))) warn(rel, no, 'video_http', 'an http:// video is blocked on an https:// docs site: use https://');
      }
    }
    if (inHtml) { prevLine = ''; continue; }

    const prose = residue;
    const trimmed = prose.trim();

    // content directly inside containers that only take specific children
    if (trimmed && !tagsOnLine.length && top) {
      if (top === 'code') warn(rel, no, 'code_content', '{% code %} holds only fenced code blocks; this text becomes an extra, untitled code tab');
      else if (top === 'cards') err(rel, no, 'container_content', 'text directly inside {% cards %} is dropped: only {% card /%} tags belong there');
      else if (top === 'table' && /^\s*\|/.test(line)) { /* a pipe table inside {% table %} is read as that table */ }
      else if (CONTAINER_CHILD[top]) warn(rel, no, 'container_content', `text directly inside {% ${top} %} belongs inside a {% ${CONTAINER_CHILD[top]} %}`);
    }

    // indented code blocks become paragraphs
    if (/^\s*([-*+]|\d+[.)])\s/.test(line)) listContext = true;
    else if (/^\S/.test(line) && !/^\{%/.test(line)) listContext = false;
    if (/^( {4,}|\t)\S/.test(line) && !prevLine.trim() && !listContext && !tagsOnLine.length && !stack.length) err(rel, no, 'indented_code', 'an indented code block: DeveloperHub joins its lines into a paragraph. Use a fenced block');

    // headings
    const h = line.match(/^ {0,3}(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      if (level === 1 && kind !== 'block') warn(rel, no, 'body_h1', 'a # heading in the body: the title comes from frontmatter, so start sections at ##');
      if (level > lastHeadingLevel + 1 && lastHeadingLevel >= 2) note(rel, no, 'heading_skip', `heading jumps from level ${lastHeadingLevel} to ${level}`);
      lastHeadingLevel = level;
      if (/^\[[^\]]+\]\([^)]*\)\s*$/.test(h[2].trim())) warn(rel, no, 'heading_link', 'a heading that is only a link: keep the text as the heading and move the link into the next paragraph');
      if (/\{#[\w-]+\}\s*$/.test(h[2])) err(rel, no, 'heading_custom_id', 'custom heading id {#…} shows as text: remove it and retarget links to the heading\'s own anchor');
    }
    if (/^\s*=+\s*$/.test(line) && prevLine.trim()) err(rel, no, 'setext_heading', 'a heading underlined with ===: write it as ## Heading');
    if (/^\s*-{2,}\s*$/.test(line) && prevLine.trim() && !/^\s*([-*+>|#]|\d+[.)]|\{%)/.test(prevLine)) warn(rel, no, 'setext_heading', 'a line of dashes right under text is a setext heading in other tools; DeveloperHub reads a rule. Write ## Heading, or add a blank line above the rule');

    // leftover source syntax
    const rstRole = /:(?:ref|doc|term|class|func|meth|mod|attr|obj|data|exc|py:\w+|math|kbd|guilabel|menuselection|download|abbr|numref):`/.test(line);
    if (rstRole) err(rel, no, 'rst_role', 'Sphinx role (:ref:`…`): convert it to a link or text');
    for (const [re, code, msg] of LEFTOVERS) {
      if (h && code === 'attr_list') continue;
      if (code === 'emoji_shortcode' && (rstRole || /^\s*:[\w+-]+:\s*$/.test(prose))) continue;
      const mm = prose.match(re);
      if (mm) {
        const level = ['definition_list', 'emoji_shortcode', 'wiki_link', 'attr_list', 'kramdown_ial', 'toc_marker'].includes(code) ? 'warning' : 'error';
        report(level, rel, no, code, msg.replace('$1', mm.slice(1).find(Boolean) || ''));
      }
    }
    if (TEMPLATE_EXPR.test(prose)) warn(rel, no, 'template_expression', 'a {{ … }} template expression: replace it with its value or a %VARIABLE% (fine if it is meant literally)');
    if (MDX_EXPR.test(prose)) warn(rel, no, 'mdx_expression', 'an MDX expression like {props.x} shows as literal text: write its value');

    // raw HTML (shows as literal text)
    HTML_TAG.lastIndex = 0;
    let hm;
    const htmlSeen = new Set();
    while ((hm = HTML_TAG.exec(prose))) {
      const tag = hm[1] ? hm[1].toLowerCase() : '!--';
      if (tag !== '!--' && !HTML_ELEMENTS.has(tag)) continue;
      if (htmlSeen.has(tag)) continue;
      htmlSeen.add(tag);
      err(rel, no, 'raw_html', tag === '!--' ? 'an HTML comment shows as literal text: remove it' : `raw HTML <${tag}> outside {% html %} shows as literal text: convert it (see conversion-rules.md) or wrap a real widget in {% html %}`);
    }

    // variables
    const varRe = /%([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)%/g;
    const proseNoUrls = prose.replace(/\]\([^)]*\)/g, ']()').replace(/(?<![a-z0-9+.-])[a-z][a-z0-9+.-]*:\/\/\S+/gi, ' ');
    let vm;
    while ((vm = varRe.exec(proseNoUrls))) {
      if (kind === 'block' && blockVars.get(blockId)?.has(vm[1])) continue;
      if (!projectVars.has(vm[1]) && kind !== 'block') warn(rel, no, 'variable_undefined', `%${vm[1]}% is not defined in developerhub.yaml, so it renders empty (put literal text like a Windows %PATH% in inline code)`);
    }

    const dashed = proseNoUrls.match(/%([A-Za-z_][\w]*-[\w-]*)%/);
    if (dashed) warn(rel, no, 'variable_dash', `%${dashed[1]}% shows as plain text: variable names cannot contain dashes`);

    // pipe tables: an unescaped | inside inline code cuts the cell
    if (/^\s*\|/.test(line)) {
      const codeSpans = line.match(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g) || [];
      if (codeSpans.some((c) => /(^|[^\\])\|/.test(c))) err(rel, no, 'table_code_pipe', 'a | inside inline code in a table cell cuts the cell: escape it as \\|');
    }

    // images
    const imgRe = /!\[([^\]]*)\]\(\s*([^)\s]*)((?:\s+(?:"[^"]*"|'[^']*'))?)\s*\)/g;
    let im;
    while ((im = imgRe.exec(prose))) {
      const target = im[2];
      const relativeImg = target && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(target);
      checkImageTarget(rel, no, dir, target);
      if (relativeImg && /^\s+'/.test(im[3])) err(rel, no, 'image_single_quoted_title', `${target}: the sync only reads an image title in double quotes, so this image is not uploaded`);
      if (rwFence && !fence && relativeImg) err(rel, no, 'rewriter_in_code', 'the sync thinks this line is inside a code block (a ``` line inside a longer fence above), so it does not resolve this image');
      if (trimmed === im[0].trim()) warn(rel, no, 'markdown_image_block', 'an image on its own line written as ![…](…) becomes an inline image and loses its alt text: use {% image url="…" /%}');
    }

    // links
    const linkRe = /(?<!!)\[((?:[^\[\]]|\[[^\[\]]*\])*)\]\(\s*([^)\s]*)((?:\s+(?:"[^"]*"|'[^']*'))?)\s*\)/g;
    let lm;
    while ((lm = linkRe.exec(prose))) {
      const linkText = line.slice(lm.index + 1, lm.index + 1 + lm[1].length);
      const target = lm[2];
      const relativeMd = !!target && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(target) && /\.md(?:[?#>]|$)/i.test(target);
      if (!linkText.trim()) err(rel, no, 'link_no_text', `a link to "${target}" has no text, so it disappears`);
      if (relativeMd && kind !== 'post') {
        if (/^</.test(target)) { err(rel, no, 'link_angle_brackets', `${target}: the sync does not rewrite a link written with <…>; write the path bare`); continue; }
        if (/\.md\?/i.test(target)) { err(rel, no, 'link_query', `${target}: the sync only rewrites a link ending in .md (or .md#anchor), so this one breaks`); continue; }
        if (/^\s+'/.test(lm[3])) { err(rel, no, 'link_single_quoted_title', `${target}: the sync does not rewrite a link with a single-quoted title; use double quotes`); continue; }
        if (/\]/.test(linkText) && !/!\[/.test(linkText)) { err(rel, no, 'link_brackets_in_text', `a link to ${target} whose text holds a ] is not rewritten by the sync: take the ] out of the text`); continue; }
        if (/!\[/.test(lm[1])) { err(rel, no, 'link_around_image', `a link to ${target} around an image is not rewritten by the sync: put the link next to the image, or use the site path`); continue; }
        if (rwFence && !fence) { err(rel, no, 'rewriter_in_code', 'the sync thinks this line is inside a code block (a ``` line inside a longer fence above), so it does not rewrite this link'); continue; }
      }
      checkLinkTarget(rel, no, dir, myVersion, target, kind, 'link');
    }
    const refDef = prose.match(/^\s{0,3}\[[^\]]+\]:\s+<?([^\s>]+)/);
    if (refDef) {
      if (!/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(refDef[1])) err(rel, no, 'reference_link_relative', `reference-style definition to ${refDef[1]}: the sync only rewrites inline links and images, so every link using it breaks. Write the links inline`);
      else note(rel, no, 'reference_definition', 'reference-style link definition: the converter inlines these links');
    }
    const wrapped = prose.match(/^[^\[]*?\]\(\s*([^)\s]+)/);
    if (wrapped && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(wrapped[1]) && /\[[^\]]*$/.test(prevLine)) err(rel, no, 'link_wrapped', `the text of a link to ${wrapped[1]} starts on the line above: the sync rewrites one line at a time, so this link breaks. Put the whole link on one line`);

    prevLine = line;
  }
  if (fence) err(rel, fence.no, 'fence_unclosed', 'this code fence is never closed, so the rest of the page is code');
  for (const s of stack) err(rel, s.no, 'unclosed_tag', `{% ${s.name} %} is never closed, so it swallows the rest of the page`);
}

// Find {% … %} spans with plain string search (quotes and {…} objects respected), so a
// stray "{%" followed by a long line cannot make a regex backtrack.
function scanTags(text) {
  const out = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf('{%', from);
    if (start < 0) break;
    let i = start + 2, q = null, depth = 0, end = -1;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
      if (ch === '"') { q = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}' && depth > 0) depth--;
      else if (ch === '%' && text[i + 1] === '}' && depth === 0) { end = i + 2; break; }
    }
    if (end < 0) break;
    const raw = text.slice(start, end);
    let inner = raw.slice(2, -2).trim();
    const closing = inner.startsWith('/');
    if (closing) inner = inner.slice(1).trim();
    const self = inner.endsWith('/');
    if (self) inner = inner.slice(0, -1).trim();
    const nm = inner.match(/^[A-Za-z$][\w.$-]*/);
    out.push({ text: raw, start, closing, self, name: nm ? nm[0] : '', attrText: nm ? inner.slice(nm[0].length) : inner });
    from = end;
  }
  return out;
}

function checkFenceInfo(rel, no, info) {
  const s = info.trim();
  if (!s) return;
  const m = s.match(/^([^\s{]*)\s*(.*)$/);
  const lang = m[1];
  let rest = m[2];
  if (lang && !/^[\w+#.-]+$/.test(lang)) warn(rel, no, 'fence_language', `fence language "${lang}" has extra characters (line ranges, labels): move them into {% … %}`);
  const ann = rest.match(/^\{%\s*([\s\S]*?)\s*%\}\s*$/);
  if (ann) { checkAttrs(rel, no, 'fence', FENCE_ATTRS, ann[1], 'code fence'); return; }
  if (rest) warn(rel, no, 'fence_meta', `"${rest}" after the fence language is dropped: write it as {% title="…" showLineNumbers=true highlightLines="…" %}`);
}

function resolveRel(dir, target) {
  let t = target.split('#')[0].split('?')[0];
  try { t = decodeURIComponent(t); } catch { /* keep as written */ }
  const joined = path.posix.normalize(path.posix.join(dir, t));
  return joined.startsWith('../') || joined === '..' ? null : joined;
}

function checkImageTarget(rel, no, dir, url) {
  if (!url) { err(rel, no, 'image_empty', 'an image with no URL'); return; }
  if (!/^([a-z][a-z0-9+.-]*:|\/)/i.test(url)) {
    if (/^</.test(url)) { err(rel, no, 'image_angle_brackets', `${url}: the sync does not read <…> around an image path; write the path bare`); return; }
    if (/[?#]/.test(url)) { err(rel, no, 'image_query', `${url}: the sync does not strip ?… or #… from an image path, so the image is not found`); return; }
  }
  if (url.startsWith('asset:')) { err(rel, no, 'image_asset_token', `${url} refers to another project's asset: copy the image into the folder and use a relative path`); return; }
  if (/^data:/.test(url)) return;
  if (/^https?:\/\//i.test(url)) {
    stats.externalImages++;
    if (isOldHost(url)) warn(rel, no, 'image_old_site', `${url} is on the old docs site: download it into the folder`);
    else externalImageFiles.set(rel, (externalImageFiles.get(rel) || 0) + 1);
    return;
  }
  if (url.startsWith('//')) { err(rel, no, isOldHost(url) ? 'image_old_site' : 'image_protocol_relative', isOldHost(url) ? `${url} is on the old docs site: download it into the folder` : `${url}: write the full https:// URL`); return; }
  if (url.startsWith('/')) { err(rel, no, 'image_site_root', `${url} is a path on the old site: copy the image into the folder and use a path relative to this page`); return; }
  const target = resolveRel(dir, url);
  if (!target) { err(rel, no, 'image_outside', `${url} points outside the folder`); return; }
  if (!fileSet.has(target)) { err(rel, no, 'image_missing', `${url} does not exist (${target})`); return; }
  if (!isImage(target)) { err(rel, no, 'image_not_image', `${url} is not an image type the sync uploads`); return; }
  const size = fs.statSync(path.join(ROOT, target)).size;
  if (size > MAX_IMAGE_BYTES) err(rel, no, 'image_too_large', `${url} is ${(size / 1048576).toFixed(1)} MB; the limit is 10 MB`);
  if (target.startsWith('assets/')) note(rel, no, 'image_in_managed_assets', `${url} is in the sync-managed assets/ folder`);
}

function checkLinkTarget(rel, no, dir, myVersion, href, kind, what) {
  stats.links++;
  if (!href) { err(rel, no, 'link_empty', `a ${what} with no target`); return; }
  if (/^(mailto|tel):/i.test(href)) return;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    if (/^https?:/i.test(href)) {
      const host = bareHost(href);
      if (isOldHost(href)) warn(rel, no, 'link_old_site', `${href} points at the old docs site: link the migrated page with a relative .md path`);
      if (/^app\.developerhub\.io$/.test(host)) warn(rel, no, 'link_editor', `${href} is the DeveloperHub editor, which readers cannot open`);
    } else if (!/^(ftp|sftp|ssh|git|file|slack|zoommtg|vscode|jetbrains):/i.test(href)) warn(rel, no, 'link_scheme', `${href}: unusual link scheme`);
    return;
  }
  if (href.startsWith('//')) {
    if (isOldHost(href)) warn(rel, no, 'link_old_site', `${href} points at the old docs site: link the migrated page with a relative .md path`);
    else warn(rel, no, 'link_protocol_relative', `${href}: write the full https:// URL`);
    return;
  }
  if (href.startsWith('#')) {
    if (kind === 'page' && href.length > 1 && !loadPage(rel).anchors.has(href.slice(1))) warn(rel, no, 'anchor_missing', `${href} matches no heading on this page${tabbedAnchors.has(`${rel}${href}`) ? ' (that heading is inside a tab, so its anchor is #tab-<tab>:' + href.slice(1) + ')' : ''}`);
    return;
  }
  if (href.startsWith('/')) {
    const p = href.split('#')[0].split('?')[0].replace(/\/$/, '') || '/';
    if (p === '/') return;
    const known = sitePaths.has(p) || sitePaths.has(p.replace(/\/ref$/, '')) || [...changelogs.keys()].some((c) => p === `/${c}` || p.startsWith(`/${c}/`));
    if (!known) warn(rel, no, 'site_path_unknown', `${href} matches no page, documentation, reference or changelog in this folder: a broken link, unless it is a custom page the project has or will have`);
    else if (kind === 'page' && pages.size && /^\/[^/]+\/[^/]+$/.test(p)) note(rel, no, 'site_path_in_page', `${href}: inside one version, a relative .md link survives renames better`);
    return;
  }
  stats.relLinks++;
  const clean = href.split('#')[0].split('?')[0];
  const frag = href.includes('#') ? href.slice(href.indexOf('#') + 1) : '';
  if (kind === 'block') { err(rel, no, 'block_relative_link', `${href}: links in a synced block must be site paths like /guide/installation (the sync leaves them as written)`); return; }
  if (kind === 'post') { err(rel, no, 'post_relative_link', `${href}: links in changelog posts must be site paths like /guide/installation`); return; }
  if (!clean.toLowerCase().endsWith('.md')) {
    const target = resolveRel(dir, clean);
    if (target && fileSet.has(target) && isImage(target)) return; // a link to an image file
    if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/|$)/i.test(clean) && !/\.(md|html?|png|jpe?g|gif|svg)$/i.test(clean)) err(rel, no, 'link_no_scheme', `${href} looks like a website without https://, so it is read as a path inside the docs`);
    else err(rel, no, 'link_not_md', `${href}: a link inside the folder must point at the target page's .md file`);
    return;
  }
  const target = resolveRel(dir, clean);
  if (!target) { err(rel, no, 'link_outside', `${href} points outside the folder`); return; }
  if (!fileSet.has(target)) { err(rel, no, 'link_broken', `${href} does not exist (${target})`); return; }
  if (!pages.has(target)) { err(rel, no, 'link_not_page', `${href} is not a page`); return; }
  if (pages.get(target).version !== myVersion) { err(rel, no, 'link_cross_version', `${href} is in another version: use the site path /${pages.get(target).version}/${pages.get(target).doc}/${pages.get(target).slug}`); return; }
  if (frag && !loadPage(target).anchors.has(frag)) warn(rel, no, 'anchor_missing', `#${frag} matches no heading in ${target}${tabbedAnchors.has(`${target}#${frag}`) ? ' (that heading is inside a tab, so its anchor is #tab-<tab>:' + frag + ')' : ''}`);
}

// ---------------------------------------------------------------------------------------
// redirects.txt (pasted into Project Settings → Hosting & Domain → Redirects)

const pagePaths = [...pages.values()].flatMap((p) => [`/${p.doc}/${p.slug}`, `/${p.version}/${p.doc}/${p.slug}`]);
if (fileSet.has('redirects.txt')) {
  const rel = 'redirects.txt';
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  const seen = new Map();
  lines.forEach((line, i) => {
    const no = i + 1;
    if (!line.trim()) { err(rel, no, 'redirect_blank', 'blank line: the Redirects box allows none'); return; }
    if (/^\s*(#|\/\/)/.test(line)) { err(rel, no, 'redirect_comment', 'comment line: the Redirects box allows none'); return; }
    const parts = line.split(' >> ');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) { err(rel, no, 'redirect_format', 'each rule is "pattern >> destination", with exactly one " >> "'); return; }
    const [pattern, dest] = parts.map((x) => x.trim());
    if (/^[a-z]+:\/\//i.test(pattern)) err(rel, no, 'redirect_origin', 'the pattern must not include the origin (https://host): start it at the path');
    let re = null;
    try { re = new RegExp(pattern); } catch (e) { err(rel, no, 'redirect_regex', `the pattern is not a valid regex: ${e.message}`); }
    if (!/^\^/.test(pattern) || !/\$$/.test(pattern)) note(rel, no, 'redirect_unanchored', 'the pattern is not anchored with ^ … $, so it also rewrites matching text inside longer paths');
    if (seen.has(pattern)) warn(rel, no, 'redirect_duplicate', `same pattern as line ${seen.get(pattern)}; only one rule per pattern is kept (this later one)`);
    seen.set(pattern, no);
    if (!/^(\/|https?:\/\/)/.test(dest)) err(rel, no, 'redirect_destination', `destination "${dest}" must be a site path starting with / (or a full URL)`);
    else if (dest.startsWith('/') && !/\$\d/.test(dest)) {
      const d = dest.split('#')[0].split('?')[0].replace(/\/$/, '') || '/';
      if (d !== '/' && !sitePaths.has(d) && !sitePaths.has(d.replace(/\/ref$/, '')) && ![...changelogs.keys()].some((c) => d === `/${c}` || d.startsWith(`/${c}/`))) err(rel, no, 'redirect_destination_unknown', `destination ${dest} matches no page in this folder`);
    }
    if (re) {
      const hit = pagePaths.find((pp) => re.test(pp) && pp !== dest.split('#')[0]);
      if (hit) warn(rel, no, 'redirect_catches_page', `this pattern also matches the new page ${hit}, which would be redirected away`);
    }
  });
}

// ---------------------------------------------------------------------------------------
// Report

const order = { error: 0, warning: 1, note: 2 };
findings.sort((a, b) => order[a.level] - order[b.level] || a.file.localeCompare(b.file) || (a.line || 0) - (b.line || 0));
const counts = { error: 0, warning: 0, note: 0 };
for (const f of findings) counts[f.level]++;

if (opts.json) {
  console.log(JSON.stringify({ root: ROOT, counts, stats: { ...stats, versions: versions.size }, findings }, null, 2));
} else {
  const docCount = [...versions.values()].reduce((n, v) => n + [...v.docs.values()].filter((d) => d.pages.length).length, 0);
  const refCount = [...versions.values()].reduce((n, v) => n + [...v.refs.values()].filter((r) => r.spec).length, 0);
  console.log(`DeveloperHub migration check: ${ROOT}`);
  console.log(`  ${versions.size} version(s), ${docCount} documentation(s), ${pages.size} page(s), ${refCount} API reference(s), ${changelogs.size} changelog(s) with ${posts.size} post(s), ${blocks.size} synced block(s)`);
  console.log(`  ${images.size} image file(s), ${(stats.imageBytes / 1048576).toFixed(1)} MB; ${stats.externalImages} external image reference(s); ${stats.links} link(s) checked`);
  if (!ICONS) console.log('  (icon names not checked: organize-docs-repo is not installed next to this skill)');
  console.log('');
  const byLevel = (lvl) => findings.filter((f) => f.level === lvl);
  for (const lvl of ['error', 'warning', 'note']) {
    const list = byLevel(lvl);
    if (!list.length) continue;
    console.log(`${lvl.toUpperCase()}S (${list.length})`);
    if (lvl === 'note' && !opts.allNotes) {
      const byCode = new Map();
      for (const f of list) byCode.set(f.code, [...(byCode.get(f.code) || []), f]);
      for (const [code, fs2] of byCode) console.log(`  ${code}: ${fs2.length} (e.g. ${fs2[0].file}${fs2[0].line ? ':' + fs2[0].line : ''}: ${fs2[0].message})`);
      console.log('  (run with --all-notes to list every note)');
    } else {
      for (const f of list) console.log(`  ${f.file}${f.line ? ':' + f.line : ''}  [${f.code}] ${f.message}`);
    }
    console.log('');
  }
  console.log(counts.error ? `${counts.error} error(s) to fix before import.` : 'No errors.');
}
process.exit(counts.error ? 1 : 0);
