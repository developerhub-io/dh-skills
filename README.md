# @developerhub/dh-skills

Agent Skills that teach AI coding agents how to author
**[DeveloperHub](https://developerhub.io) Markdoc**: the exact, round-trip-safe
syntax for every content block, and how to migrate existing docs into it.

DeveloperHub pages are stored as Markdoc. When an agent edits a page from an IDE,
a Git-synced repo, or a docs-as-code pipeline, it needs to emit the *canonical*
dialect DeveloperHub round-trips, not generic Markdown or a look-alike. Emit the
wrong shape and the edit churns on the first save or silently drops content. These
skills give the agent that ground truth: the Markdoc syntax inside a page, and the
repository layout around it (folders, navigation, settings, assets, and refs).

As a Claude Code plugin, it also connects Claude to the
[DeveloperHub Editor MCP server](https://docs.developerhub.io/support-center/editor-mcp-server),
so Claude can find, write, publish and check pages in your DeveloperHub projects
directly.

## What's inside

| Skill | Teaches |
|---|---|
| [`write-markdoc`](skills/write-markdoc/SKILL.md) | Every DeveloperHub Markdoc block and inline mark, with the exact syntax, attributes, and the dialect rules that keep an edit round-trip-safe. |
| [`organize-docs-repo`](skills/organize-docs-repo/SKILL.md) | The file and folder layout of a Git-synced DeveloperHub repo: where a page goes, the version/documentation/page structure, `_nav.yaml` navigation, settings files, the reader's look and top navigation (`_theme/`, `settings:`, `navigation:`), images and assets, API reference specs, changelogs, synced block files, and the pull request sync check. |
| [`migrate-docs`](skills/migrate-docs/SKILL.md) | Migrating existing docs to DeveloperHub from any tool (Docusaurus, MkDocs, Sphinx, GitBook, Mintlify, ReadMe, VitePress, Starlight, Hugo and more), a docs folder inside a monorepo, an export, or a live site: structure, pages, images, links and redirects, asking before structural choices, and a validator for the result. Builds on the two skills above. |

Detailed references:
[`skills/write-markdoc/references/blocks.md`](skills/write-markdoc/references/blocks.md)
(per-block),
[`skills/organize-docs-repo/references/repo-structure.md`](skills/organize-docs-repo/references/repo-structure.md)
(per-file), and
[`skills/organize-docs-repo/references/fontawesome-icons.md`](skills/organize-docs-repo/references/fontawesome-icons.md)
(every icon name a sidebar entry or an `{% icon %}` tag can use). The migration skill
carries [`source-platforms.md`](skills/migrate-docs/references/source-platforms.md)
(each docs tool's structure and syntax),
[`conversion-rules.md`](skills/migrate-docs/references/conversion-rules.md) (construct by
construct, including what silently loses content),
[`crawling.md`](skills/migrate-docs/references/crawling.md) (when the only source is the
published site), and `check-migration`, a validator with no dependencies for the folder
it produces. The validator ships in the npm package, and the skill runs it with
`npx -y -p @developerhub/dh-skills@<version> check-migration <folder>` (Node 18+).

## Install

### Claude Code

This repo is also a Claude Code plugin marketplace, which is the install that keeps
itself current as the DeveloperHub format changes:

```
/plugin marketplace add developerhub-io/dh-skills
/plugin install dh-skills@developerhub
```

The skills arrive namespaced, as `dh-skills:write-markdoc`,
`dh-skills:organize-docs-repo` and `dh-skills:migrate-docs`, together with the
DeveloperHub Editor MCP server. The first time Claude uses the server, it asks you to
sign in to DeveloperHub and approve access. A project admin turns the server on per
project, in Project Settings → **AI** → **AI Agents & MCP** → **Editor**. To pick up new releases
without reinstalling, enable
auto-update once: run `/plugin`, open the **Marketplaces** tab, select
**developerhub**, and choose **Enable auto-update**. Claude Code then refreshes the
plugin in the background shortly after a session starts.

### Any agent

Install straight from this repo with the [`skills` CLI](https://www.npmjs.com/package/skills):

```bash
npx skills add developerhub-io/dh-skills
```

This copies the files in, so re-run `npx skills update` to pick up a new release.

Or copy the folders under `skills/` into your agent's skills directory
(`.claude/skills/`, `.cursor/skills/`, …). Copy all three together: `migrate-docs`
relies on the other two. `SKILL.md` uses the portable Agent
Skills format (Markdown with YAML frontmatter), so it works across Claude Code,
Cursor, Codex, and other compatible agents.

It is also published to npm as `@developerhub/dh-skills`, for anyone who prefers to
vendor the files as a dependency (`npm install @developerhub/dh-skills`).

## What the plugin runs and sends

The skills are instructions and reference files. The plugin adds no hooks and no
background processes.

- The plugin adds one MCP server, the DeveloperHub Editor MCP server at
  `https://ai.developerhub.io/mcp`. It does nothing until you sign in to DeveloperHub
  and approve access. After that, Claude reads and changes the docs in your projects
  through it, with your account's role in each project, so the content Claude works
  on passes between DeveloperHub and Claude. See the
  [DeveloperHub privacy policy](https://developerhub.io/privacy).
- The migration validator runs only when the agent validates a migrated folder.
  `npx` downloads it from the npm registry as `@developerhub/dh-skills` at a fixed
  version, unless a copy is already in the skill's folder. It reads the folder you
  pass it, prints a report, writes no files and makes no network requests itself.
- `migrate-docs` reads the docs you point it at: a local folder, a Git repository it
  clones with `git clone`, or an export archive. When the only source is a published
  docs site, it first asks whether a repository or export exists, and only then fetches
  that site's pages. The result is a local folder; nothing is uploaded to DeveloperHub
  until you import it yourself with GitHub Sync.

## Contributing

This package is published and maintained by DeveloperHub. Spotted an error, or
want a block documented differently? Please [open an issue](https://github.com/developerhub-io/dh-skills/issues).

## License

MIT. See [LICENSE](LICENSE).
