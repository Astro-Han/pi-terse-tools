// Exa /search client for the lean web tools.
//
// One POST, one normalize. We use /search (not /answer) on purpose: /answer
// synthesizes an answer server-side, coupling search to Exa's model. /search
// returns raw results, and the chat model synthesizes in-context — so search
// stays model-independent. Each result becomes {title, url, snippet}; the
// snippet is joined highlights (Exa's key passages) with a text fallback.

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_NUM_RESULTS = 5;
const SNIPPET_MAX = 500;
const MAX_TITLE = 200;

export interface SearchHit {
	title: string;
	url: string;
	snippet: string;
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

export function normalizeExaResults(json: unknown): SearchHit[] {
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
			const title = (typeof r.title === "string" && r.title ? r.title : `Source ${i + 1}`).slice(0, MAX_TITLE);
			hits.push({ title, url: r.url, snippet });
		}
	}
	return hits;
}

export async function searchExa(query: string, opts: SearchOptions): Promise<SearchResult> {
	const {
		apiKey,
		fetchImpl = fetch,
		numResults = DEFAULT_NUM_RESULTS,
		timeoutMs = DEFAULT_TIMEOUT_MS,
	} = opts;
	const callerSignal = opts.signal;
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
		if (callerSignal?.aborted) return { query, results: [], error: "aborted" };
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
	if (json === null || typeof json !== "object") {
		if (callerSignal?.aborted) return { query, results: [], error: "aborted" };
		if (signal.aborted) return { query, results: [], error: `search timed out after ${timeoutMs}ms` };
		return { query, results: [], error: "Exa returned a non-JSON or invalid response" };
	}
	if (!Array.isArray((json as { results?: unknown }).results)) {
		return { query, results: [], error: "Exa response missing a results array" };
	}
	const hits = normalizeExaResults(json);
	const rawResults = (json as { results: unknown[] }).results;
	if (rawResults.length > 0 && hits.length === 0) {
		return { query, results: [], error: "Exa returned results but none had a usable url" };
	}
	return { query, results: hits, error: null };
}