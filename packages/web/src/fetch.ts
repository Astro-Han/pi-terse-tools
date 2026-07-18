// URL → clean, bounded text. The fetch pipeline for the lean web tools.
//
// One fetch, one timeout, one result, and the timeout covers the WHOLE
// lifecycle (headers + body), not just the headers. No SSRF DNS pre-resolution
// (guardUrl only checks scheme), no fallback cascade, no headless browser. The
// HTTP client is injected so the pipeline is deterministic under test. Proxy
// needs no code here: under TUN/fake-IP proxies interception is at the network
// layer, and under HTTP_PROXY setups Node 24+ follows the env vars when
// NODE_USE_ENV_PROXY is set.

import { guardUrl } from "./guard.ts";
import { htmlToMarkdown } from "./extract.ts";

export interface FetchResult {
	url: string;
	title: string;
	contentType: string;
	content: string;
	truncated: boolean;
	error: string | null;
}

export interface FetchOptions {
	fetchImpl?: typeof fetch;
	signal?: AbortSignal;
	maxBytes?: number;
	maxChars?: number;
	timeoutMs?: number;
}

const DEFAULT_MAX_BYTES = 5_000_000;
const DEFAULT_MAX_CHARS = 20_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TITLE = 200;
const TRUNCATION_MARKER = "\n\n[content truncated]";

/** Read at most maxBytes from the stream, so a huge page can't exhaust memory.
 *  Releases the socket when the cap is hit. */
async function readCapped(response: Response, maxBytes: number, charset?: string): Promise<{ text: string; truncated: boolean }> {
	const reader = response.body?.getReader();
	if (!reader) {
		const text = await response.text();
		return { text, truncated: false };
	}
	const decoder = safeDecoder(charset);
	let text = "";
	let bytes = 0;
	let truncated = false;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (bytes + value.byteLength > maxBytes) {
			const take = maxBytes - bytes;
			if (take > 0) text += decoder.decode(value.subarray(0, take), { stream: true });
			truncated = true;
			break;
		}
		bytes += value.byteLength;
		text += decoder.decode(value, { stream: true });
	}
	text += decoder.decode();
	if (truncated) await reader.cancel().catch(() => {});
	return { text, truncated };
}

function parseCharset(contentType: string): string | undefined {
	const m = /charset=([^;]+)/i.exec(contentType);
	return m?.[1]?.trim() || undefined;
}

function safeDecoder(charset?: string): TextDecoder {
	if (charset) {
		try { return new TextDecoder(charset); } catch { /* unsupported label, fall back */ }
	}
	return new TextDecoder("utf-8");
}

function isTextish(contentType: string): boolean {
	if (/^text\//i.test(contentType)) return true;
	if (/application\/(json|xml|javascript)/i.test(contentType)) return true;
	if (/\+(json|xml)\b/i.test(contentType)) return true;
	return false;
}

function isHtml(contentType: string, text: string): boolean {
	if (/html/i.test(contentType)) return true;
	if (contentType === "" || /text\/plain/i.test(contentType)) {
		// Sniff: a bare DOCTYPE/html tag means HTML even when the server lied.
		return /^\s*(<!doctype html|<html)/i.test(text);
	}
	return false;
}

export async function fetchPage(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
	const {
		fetchImpl = fetch,
		maxBytes = DEFAULT_MAX_BYTES,
		maxChars = DEFAULT_MAX_CHARS,
		timeoutMs = DEFAULT_TIMEOUT_MS,
	} = opts;

	const err = (reason: string): FetchResult =>
		({ url, title: "", contentType: "", content: "", truncated: false, error: reason });

	const guard = guardUrl(url);
	if (!guard.ok) return err(guard.reason);

	const controller = new AbortController();
	const signal = opts.signal ? AbortSignal.any([opts.signal, controller.signal]) : controller.signal;
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => { controller.abort(); reject(new Error("timeout")); }, timeoutMs);
	});

	async function work(): Promise<FetchResult> {
		const response = await fetchImpl(url, { signal, redirect: "follow" });
		if (!response.ok) {
			await response.body?.cancel().catch(() => {});
			return err(`HTTP ${response.status}`);
		}
		const contentType = response.headers.get("content-type") ?? "";
		const { text, truncated: byteTruncated } = await readCapped(response, maxBytes, parseCharset(contentType));

		let title = "";
		let content: string;
		if (isHtml(contentType, text)) {
			const extracted = htmlToMarkdown(text, response.url || url);
			title = extracted.title;
			content = extracted.markdown;
		} else if (contentType === "" || isTextish(contentType)) {
			content = text;
		} else {
			return {
				url,
				title: "",
				contentType,
				content: `[binary content (${contentType || "unknown type"}), not extracted]`,
				truncated: byteTruncated,
				error: null,
			};
		}

		let truncated = byteTruncated;
		if (title.length > MAX_TITLE) {
			title = title.slice(0, MAX_TITLE);
			truncated = true;
		}
		if (content.length > maxChars) {
			content = content.slice(0, maxChars) + TRUNCATION_MARKER;
			truncated = true;
		}
		return { url, title, contentType, content, truncated, error: null };
	}

	const workPromise = work();
	workPromise.catch(() => {}); // if the timeout wins the race, swallow work's late rejection
	try {
		return await Promise.race([workPromise, timeoutPromise]);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (opts.signal?.aborted) return err("aborted");
		if (controller.signal.aborted || /timeout|abort/i.test(msg)) {
			return err(`request timed out after ${timeoutMs}ms`);
		}
		return err(msg);
	} finally {
		clearTimeout(timeoutId);
	}
}