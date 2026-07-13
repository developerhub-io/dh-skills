# @developerhub/dh-skills

[Agent Skills](https://agent-skills.com) that teach AI coding agents how to author
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

With the [`skills` CLI](https://github.com/agent-skills/skills):

```bash
npx skills add @developerhub/dh-skills
```

Or drop the `skills/write-markdoc` folder into your agent's skills directory
(`.claude/skills/`, `.cursor/skills/`, etc.). The `SKILL.md` file follows the
portable [Agent Skills](https://agent-skills.com) format, so it works across
Claude Code, Cursor, Codex, and other compatible agents.

## Contributing

This package is published and maintained by DeveloperHub. Spotted an error, or
want a block documented differently? Please [open an issue](https://github.com/developerhub-io/dh-skills/issues).

## License

MIT — see [LICENSE](LICENSE).
