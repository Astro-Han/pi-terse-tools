// pi-terse-web: lean web fetch + web search for the Pi coding agent.
//
// Two tools, each one network call:
//   webfetch  — URL → clean markdown / raw text, byte- and char-capped.
//   websearch — query → Exa /search results ({title, url, snippet}).
//
// The chat model synthesizes from what these return; neither tool curates,
// summarizes, or renders. No SSRF DNS pre-resolution, no fallback cascade,
// no curator. Proxy needs no code here: under TUN it's the network layer;
// under HTTP_PROXY, Node 24+ with NODE_USE_ENV_PROXY=1.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { fetchPage, type FetchResult } from "./fetch.ts";
import { searchExa, DEFAULT_NUM_RESULTS, type SearchResult } from "./exa.ts";
import { renderFetchCall, renderFetchResult, renderSearchCall, renderSearchResult } from "./render.ts";

function getExaApiKey(): string | null {
	const v = process.env.EXA_API_KEY;
	return typeof v === "string" && v.trim() ? v.trim() : null;
}

function formatFetchOutput(r: FetchResult): string {
	const head = r.title ? `# ${r.title}\n\n` : "";
	return `${head}${r.content}`;
}

function formatSearchOutput(r: SearchResult): string {
	if (r.results.length === 0) return `No results for "${r.query}".`;
	const lines = r.results.map((hit, i) => {
		const snip = hit.snippet ? `\n   ${hit.snippet}` : "";
		return `${i + 1}. ${hit.title}\n   ${hit.url}${snip}`;
	});
	return `Results for "${r.query}":\n\n${lines.join("\n\n")}`;
}

export default function (pi: ExtensionAPI): void {
	pi.registerTool({
		name: "webfetch",
		label: "Web Fetch",
		description:
			"Fetch a URL and return its content as clean markdown for HTML pages, or raw text otherwise. Output is bounded (byte-capped read, char-capped output). Use to read a specific URL the model or user already has — not to search.",
		promptSnippet: "Use to read a specific URL the model or user already has.",
		parameters: Type.Object({
			url: Type.String({ description: "The URL to fetch (http or https)" }),
		}),
		renderCall: renderFetchCall,
		renderResult: renderFetchResult,
		async execute(_callId, params, signal) {
			const url = params?.url;
			if (typeof url !== "string" || !url.trim()) {
				return {
					content: [{ type: "text", text: "Error: url is required" }],
					details: { error: "url is required" },
					isError: true,
				};
			}
			const result = await fetchPage(url.trim(), { signal });
			const text = result.error
				? `Error fetching ${url}: ${result.error}`
				: formatFetchOutput(result);
			return { content: [{ type: "text", text }], details: { url: result.url, title: result.title, contentType: result.contentType, truncated: result.truncated, error: result.error }, isError: !!result.error };
		},
	});

	pi.registerTool({
		name: "websearch",
		label: "Web Search",
		description:
			"Search the web via Exa and return a list of {title, url, snippet} results. Synthesize an answer from them yourself — this tool does not summarize. Requires the EXA_API_KEY environment variable.",
		promptSnippet: "Use to find URLs for a query. Returns raw results; synthesize yourself.",
		parameters: Type.Object({
			query: Type.String({ description: "The search query" }),
			numResults: Type.Optional(Type.Number({ description: "Number of results (default 5, max 20)" })),
		}),
		renderCall: renderSearchCall,
		renderResult: renderSearchResult,
		async execute(_callId, params, signal) {
			const query = params?.query;
			if (typeof query !== "string" || !query.trim()) {
				return {
					content: [{ type: "text", text: "Error: query is required" }],
					details: { error: "query is required" },
					isError: true,
				};
			}
			const apiKey = getExaApiKey();
			if (!apiKey) {
				return {
					content: [{ type: "text", text: "Error: EXA_API_KEY is not set. Export it to enable web search." }],
					details: { error: "missing api key" },
					isError: true,
				};
			}
			let numResults = DEFAULT_NUM_RESULTS;
			if (typeof params.numResults === "number" && Number.isFinite(params.numResults)) {
				numResults = Math.min(20, Math.max(1, Math.floor(params.numResults)));
			}
			const result = await searchExa(query.trim(), { apiKey, signal, numResults });
			const text = result.error
				? `Error searching: ${result.error}`
				: formatSearchOutput(result);
			return {
				content: [{ type: "text", text }],
				details: { query: result.query, resultCount: result.results.length, error: result.error },
				isError: !!result.error,
			};
		},
	});
}