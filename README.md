# pi-terse-tools

Lean extensions for the [Pi coding agent](https://github.com/earendil-works/pi-coding-agent). A monorepo of two npm packages, each independently installable. Both stay close to pi's native TUI — same colors, backgrounds, and success/error states — just compressed to what matters.

## `pi-terse-tools` — every tool call in two lines

![pi-terse-tools rendering tool calls as two-line blocks](assets/screenshot.png)

Pi's default tool output floods the transcript. This extension re-renders the built-in tools (read, write, edit, bash, grep, find, ls) as compact two-line blocks: the model's one-sentence intent on line 1, a colored result summary (✓ / ✗, diff stats, line counts) on line 2. Press `C-o` on a block to expand the full output.

```bash
pi install npm:pi-terse-tools
```

No configuration. Details in [`packages/terse`](packages/terse).

## `pi-terse-web` — lean webfetch + websearch

![pi-terse-web rendering websearch and webfetch results](assets/screenshot-web.png)

Two tools, each one network call: `webfetch` turns a URL into clean markdown, `websearch` returns Exa results as `{title, url, snippet}`. No fallback cascades, no SSRF DNS gymnastics — the lean opposite of heavier web-access extensions.

```bash
pi install npm:pi-terse-web
export EXA_API_KEY=...   # websearch only; webfetch needs nothing
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
