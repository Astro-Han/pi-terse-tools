# pi-terse-web

Lean web fetch + web search for the [Pi coding agent](https://github.com/earendil-works/pi-coding-agent). Two tools, each one network call:

- **`webfetch`** — URL → clean markdown (HTML pages) or raw text, byte- and char-capped.
- **`websearch`** — query → Exa `/search` results as `{title, url, snippet}`.

The chat model synthesizes from what these return. Neither tool curates, summarizes, opens a browser, or runs a fallback cascade.

## Why

`pi-web-access` is powerful but heavy: seven search providers, a headless curator, a YouTube/PDF/video/GitHub extractor chain, and a DNS-resolving SSRF guard that breaks under fake-IP proxies (Clash/Mihomo TUN). `pi-terse-web` is the lean opposite for people whose web access is mostly docs, articles, and search results:

- **No SSRF DNS gymnastics.** `guardUrl` checks a literal-IP denylist (`localhost`, `127.0.0.0/8`, `::1`, `169.254.0.0/16`, `0.0.0.0`) and never resolves DNS, so the fake-IP-proxy class of failures can't happen by construction.
- **One fetch, one timeout.** No Jina → Parallel → Gemini cascade that takes 30s+ and bills multiple API calls.
- **Proxy is free.** Node 22+ follows `http(s)_proxy` / `NODE_USE_ENV_PROXY` automatically — zero proxy code.
- **Bounded output.** A byte-capped stream read prevents huge pages exhausting memory; output is char-capped with a truncation marker, so a fetch can't overflow the context window.

## Install

```bash
pi install npm:pi-terse-web
```

Or try it for one run:

```bash
pi -e npm:pi-terse-web
```

## Configure

`websearch` needs an Exa API key:

```bash
export EXA_API_KEY=...
```

`webfetch` needs no configuration.

## Coexisting with pi-web-access

Both register web tools, so disable `pi-web-access`'s tools (or uninstall it) to avoid the model seeing duplicates. `pi-terse-web` uses distinct tool names (`webfetch`, `websearch`) vs `pi-web-access` (`fetch_content`, `web_search`).

## License

MIT.