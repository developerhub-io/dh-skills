# @developerhub/dh-skills

Agent Skills that teach AI coding agents how to author
**[DeveloperHub](https://developerhub.io) Markdoc** — the exact, round-trip-safe
syntax for every content block.

DeveloperHub pages are stored as Markdoc. When an agent edits a page from an IDE,
a Git-synced repo, or a docs-as-code pipeline, it needs to emit the *canonical*
dialect DeveloperHub round-trips — not generic Markdown or a look-alike. Emit the
wrong shape and the edit churns on the first save or silently drops content. This
skill gives the agent that ground truth.

## What's inside

| Skill | Teaches |
|---|---|
| [`write-markdoc`](skills/write-markdoc/SKILL.md) | Every DeveloperHub Markdoc block and inline mark, with the exact syntax, attributes, and the dialect rules that keep an edit round-trip-safe. |

Detailed per-block reference: [`skills/write-markdoc/references/blocks.md`](skills/write-markdoc/references/blocks.md).

## Install

Install straight from this repo with the [`skills` CLI](https://www.npmjs.com/package/skills):

```bash
npx skills add developerhub-io/dh-skills
```

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

MIT — see [LICENSE](LICENSE).
