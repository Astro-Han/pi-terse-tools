# pi-terse-web

Lean web fetch + web search for the [Pi coding agent](https://github.com/earendil-works/pi-coding-agent). Two tools, each one network call:

- **`webfetch`** — URL → clean markdown (HTML pages) or raw text, byte- and char-capped.
- **`websearch`** — query → Exa `/search` results as `{title, url, snippet}`.

The chat model synthesizes from what these return. Neither tool curates, summarizes, opens a browser, or runs a fallback cascade.

## Why

`pi-web-access` is powerful but heavy: seven search providers, a headless curator, a YouTube/PDF/video/GitHub extractor chain, and a DNS-resolving SSRF guard that breaks under fake-IP proxies (Clash/Mihomo TUN). `pi-terse-web` is the lean opposite for people whose web access is mostly docs, articles, and search results:

- **No SSRF DNS gymnastics.** `guardUrl` only checks the URL scheme and validity — it does not resolve DNS and keeps no host/IP denylist, so the fake-IP-proxy class of failures can't happen by construction. This is deliberate for a local single-user agent: the process already owns the network, and an incomplete denylist is worse than none. Network-policy isolation is the sandbox/runtime's job, not this tool's.
- **One fetch, one timeout.** No Jina → Parallel → Gemini cascade that takes 30s+ and bills multiple API calls.
- **Proxy is free under TUN.** Clash/Mihomo TUN intercepts at the network layer, so no proxy configuration is needed — the fake-IP SSRF bug class can't happen because there's no DNS guard to begin with. For `HTTP_PROXY`/`HTTPS_PROXY` setups, run Node 24+ with `NODE_USE_ENV_PROXY=1` (Node's global `fetch` then follows the env vars). Either way, zero proxy code in the tool.
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

The two can coexist — `pi-terse-web` uses distinct tool names (`webfetch`, `websearch`) vs `pi-web-access` (`fetch_content`, `web_search`), so there is no registration conflict. But the model will see overlapping capabilities; if you want a single lean set, disable `pi-web-access`'s tools or uninstall it.

## License

MIT.