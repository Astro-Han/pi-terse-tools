# pi-terse-tools

A monorepo of lean, focused extensions for the [Pi coding agent](https://github.com/earendil-works/pi-coding-agent). Each package under `packages/` is independently installable and publishable.

## Packages

| Package | npm name | What it does |
|---|---|---|
| [`packages/terse`](packages/terse) | `pi-terse-tools` | Compress every pi tool call into a tight two-line block: intent on line 1, result summary on line 2. |
| [`packages/web`](packages/web) | `pi-terse-web` | Lean web fetch + web search: URL → clean markdown, query → results. One fetch, one timeout, no SSRF DNS gymnastics. |

## Layout

- `packages/*` — publishable pi packages, each with its own `package.json`, `src/`, and `test/`.
- `docs/` — shared decision records (e.g. abandoned explorations and why).

## Develop

```bash
npm install
npm test
```

Node >= 22.19.0. Test files are plain `.ts` run directly via `node --test` (no build step).

## License

MIT.