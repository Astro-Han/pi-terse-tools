// Exa /search client for the lean web tools.
//
// One POST, one normalize. We use /search (not /answer) on purpose: /answer
// synthesizes an answer server-side, coupling search to Exa's model. /search
// returns raw results, and the chat model synthesizes in-context — so search
// stays model-independent. Each result becomes {title, url, snippet}; the
// snippet is joined highlights (Exa's key passages) with a text fallback.

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_NUM_RESULTS = 5;
const SNIPPET_MAX = 500;

export interface SearchHit {
	title: string;
	url: string;
	snippet: string;
}

export interface NormalizedSearch {
	query: string;
	results: SearchHit[];
}

export interface SearchOptions {
	apiKey: string;
	fetchImpl?: typeof fetch;
	signal?: AbortSignal;
	numResults?: number;
	timeoutMs?: number;
}

export interface SearchResult {
	query: string;
	results: SearchHit[];
	error: string | null;
}

export function normalizeExaResults(json: unknown, query: string): NormalizedSearch {
	const raw = (json as { results?: unknown[] } | null)?.results;
	const hits: SearchHit[] = [];
	if (Array.isArray(raw)) {
		for (let i = 0; i < raw.length; i++) {
			const r = raw[i] as Record<string, unknown> | null;
			if (!r || typeof r.url !== "string" || !r.url) continue;
			const highlights = Array.isArray(r.highlights)
				? r.highlights.filter((h): h is string => typeof h === "string" && h.trim().length > 0)
				: [];
			let snippet = highlights.join(" ");
			if (!snippet && typeof r.text === "string") snippet = r.text.trim();
			snippet = snippet.replace(/\s+/g, " ").trim().slice(0, SNIPPET_MAX);
			const title = typeof r.title === "string" && r.title ? r.title : `Source ${i + 1}`;
			hits.push({ title, url: r.url, snippet });
		}
	}
	return { query, results: hits };
}

export async function searchExa(query: string, opts: SearchOptions): Promise<SearchResult> {
	const {
		apiKey,
		fetchImpl = fetch,
		numResults = DEFAULT_NUM_RESULTS,
		timeoutMs = DEFAULT_TIMEOUT_MS,
	} = opts;
	const signal = opts.signal
		? AbortSignal.any([opts.signal, AbortSignal.timeout(timeoutMs)])
		: AbortSignal.timeout(timeoutMs);

	let response: Response;
	try {
		response = await fetchImpl(EXA_SEARCH_URL, {
			method: "POST",
			headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
			body: JSON.stringify({
				query,
				type: "auto",
				numResults,
				contents: { highlights: true, text: { maxCharacters: 1000 } },
			}),
			signal,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (/timeout|abort/i.test(msg)) {
			return { query, results: [], error: `search timed out after ${timeoutMs}ms` };
		}
		return { query, results: [], error: msg };
	}

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		const detail = text ? `: ${text.slice(0, 200)}` : "";
		return { query, results: [], error: `Exa API error ${response.status}${detail}` };
	}

	const json = await response.json().catch(() => null);
	const normalized = normalizeExaResults(json, query);
	return { query, results: normalized.results, error: null };
}