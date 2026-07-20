# pi-terse-tools

Lean extensions for the [Pi coding agent](https://github.com/earendil-works/pi-coding-agent). A monorepo of two npm packages, each independently installable. Both stay close to pi's native TUI — same colors, backgrounds, and success/error states — just compressed to what matters.

## `pi-terse-tools` — every tool call in two lines

Pi's default tool output floods the transcript. This extension re-renders the built-in tools (read, write, edit, bash, grep, find, ls) as compact two-line blocks: readable tool input on line 1, a colored result summary (✓ / ✗, diff stats, line counts) on line 2. It leaves the model-facing tool schemas and execution arguments unchanged. Press `C-o` on a block to expand the full output.

Install with pi's package manager (requires [pi](https://pi.dev) >= 0.80):

```bash
pi install npm:pi-terse-tools
```

Or try it for a single run without installing: `pi -e npm:pi-terse-tools`.

No configuration. Details in [`packages/terse`](packages/terse).

## `pi-terse-web` — lean webfetch + websearch

![pi-terse-web rendering websearch and webfetch results](assets/screenshot-web.png)

Two tools, each one network call: `webfetch` turns a URL into clean markdown, `websearch` returns Exa results as `{title, url, snippet}`. No fallback cascades, no SSRF DNS gymnastics — the lean opposite of heavier web-access extensions.

Install with pi's package manager:

```bash
pi install npm:pi-terse-web
```

Or try it for a single run: `pi -e npm:pi-terse-web`. `webfetch` works out of the box; `websearch` needs an Exa API key:

```bash
export EXA_API_KEY=...
```

Design rationale and coexistence with `pi-web-access`: [`packages/web`](packages/web).

## Develop

```bash
npm install
npm test
```

Node >= 22.19.0. Test files are plain `.ts` run directly via `node --test` (no build step). `docs/` holds shared decision records.

## License

MIT.
