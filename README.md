# @developerhub/dh-skills

Agent Skills that teach AI coding agents how to author
**[DeveloperHub](https://developerhub.io) Markdoc**: the exact, round-trip-safe
syntax for every content block.

DeveloperHub pages are stored as Markdoc. When an agent edits a page from an IDE,
a Git-synced repo, or a docs-as-code pipeline, it needs to emit the *canonical*
dialect DeveloperHub round-trips, not generic Markdown or a look-alike. Emit the
wrong shape and the edit churns on the first save or silently drops content. These
skills give the agent that ground truth: the Markdoc syntax inside a page, and the
repository layout around it (folders, navigation, settings, assets, and refs).

## What's inside

| Skill | Teaches |
|---|---|
| [`write-markdoc`](skills/write-markdoc/SKILL.md) | Every DeveloperHub Markdoc block and inline mark, with the exact syntax, attributes, and the dialect rules that keep an edit round-trip-safe. |
| [`organize-docs-repo`](skills/organize-docs-repo/SKILL.md) | The file and folder layout of a Git-synced DeveloperHub repo: where a page goes, the version/documentation/page structure, `_nav.yaml` navigation, settings files, images and assets, API reference specs, changelogs, synced block files, and the pull request sync check. |

Detailed references:
[`skills/write-markdoc/references/blocks.md`](skills/write-markdoc/references/blocks.md)
(per-block),
[`skills/organize-docs-repo/references/repo-structure.md`](skills/organize-docs-repo/references/repo-structure.md)
(per-file), and
[`skills/organize-docs-repo/references/fontawesome-icons.md`](skills/organize-docs-repo/references/fontawesome-icons.md)
(every icon name a sidebar entry or an `{% icon %}` tag can use).

## Install

### Claude Code

This repo is also a Claude Code plugin marketplace, which is the install that keeps
itself current as the DeveloperHub format changes:

```
/plugin marketplace add developerhub-io/dh-skills
/plugin install dh-skills@developerhub
```

The skills arrive namespaced, as `dh-skills:write-markdoc` and
`dh-skills:organize-docs-repo`. To pick up new releases without reinstalling, enable
auto-update once: run `/plugin`, open the **Marketplaces** tab, select
**developerhub**, and choose **Enable auto-update**. Claude Code then refreshes the
plugin in the background shortly after a session starts.

### Any agent

Install straight from this repo with the [`skills` CLI](https://www.npmjs.com/package/skills):

```bash
npx skills add developerhub-io/dh-skills
```

This copies the files in, so re-run `npx skills update` to pick up a new release.

Or copy the `skills/write-markdoc` folder into your agent's skills directory
(`.claude/skills/`, `.cursor/skills/`, …). `SKILL.md` uses the portable Agent
Skills format (Markdown with YAML frontmatter), so it works across Claude Code,
Cursor, Codex, and other compatible agents.

It is also published to npm as `@developerhub/dh-skills`, for anyone who prefers to
vendor the files as a dependency (`npm install @developerhub/dh-skills`).

## Contributing

This package is published and maintained by DeveloperHub. Spotted an error, or
want a block documented differently? Please [open an issue](https://github.com/developerhub-io/dh-skills/issues).

## License

MIT. See [LICENSE](LICENSE).
