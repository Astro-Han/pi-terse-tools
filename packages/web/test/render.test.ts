import { test } from "node:test";
import assert from "node:assert/strict";

import {
	renderFetchCall, renderFetchResult,
	renderSearchCall, renderSearchResult,
	DIM, BOLD, GREEN, RED, RESET, INDENT,
} from "../src/render.ts";

const render = (comp: unknown, width = 80): string[] =>
	comp && typeof (comp as { render?: (w: number) => string[] }).render === "function"
		? (comp as { render: (w: number) => string[] }).render(width)
		: [];

const fetchResult = (over: { title?: string; text?: string; truncated?: boolean; error?: string | null } = {}) => ({
	content: [{ type: "text", text: over.text ?? "" }],
	details: { url: "https://example.com", title: over.title ?? "", contentType: "text/html", truncated: over.truncated ?? false, error: over.error ?? null },
});
const searchResult = (over: { resultCount?: number; text?: string; error?: string | null } = {}) => ({
	content: [{ type: "text", text: over.text ?? "" }],
	details: { query: "q", resultCount: over.resultCount ?? 0, error: over.error ?? null },
});

test("websearch collapsed shows a green result count", () => {
	const c = renderSearchResult(searchResult({ resultCount: 2, text: 'Results for "q":\n\n1. A\n   https://a.com' }), { expanded: false, isPartial: false }, {}, { args: { query: "rust async runtime" }, isError: false });
	const lines = render(c);
	assert.equal(lines[0], `${BOLD}websearch${RESET} rust async runtime`);
	assert.equal(lines[1], `${INDENT}${GREEN}2${RESET} results`);
});

test("websearch collapsed zero results is dim", () => {
	const c = renderSearchResult(searchResult({ resultCount: 0, text: 'No results for "q".' }), { expanded: false, isPartial: false }, {}, { args: { query: "nothing" }, isError: false });
	const lines = render(c);
	assert.equal(lines[1], `${INDENT}${DIM}0 results${RESET}`);
});

test("websearch error shows a red cross and the error", () => {
	const c = renderSearchResult(searchResult({ error: "search timed out after 30000ms" }), { expanded: false, isPartial: false }, {}, { args: { query: "q" }, isError: true });
	const lines = render(c);
	assert.equal(lines[1], `${INDENT}${RED}✗${RESET} search timed out after 30000ms`);
});

test("websearch expanded appends the indented body", () => {
	const c = renderSearchResult(searchResult({ resultCount: 1, text: 'Results for "q":\n\n1. A\n   https://a.com' }), { expanded: true, isPartial: false }, {}, { args: { query: "q" }, isError: false });
	const lines = render(c);
	assert.ok(lines.length > 2, "expected body lines after the header");
	assert.equal(lines[2], `${INDENT}Results for "q":`);
});

test("webfetch collapsed shows title and line count", () => {
	const c = renderFetchResult(fetchResult({ title: "Example Domain", text: "# Example Domain\n\nThis domain is for use in examples." }), { expanded: false, isPartial: false }, {}, { args: { url: "https://example.com" }, isError: false });
	const lines = render(c);
	assert.equal(lines[0], `${BOLD}webfetch${RESET} https://example.com`);
	assert.equal(lines[1], `${INDENT}${GREEN}✓${RESET} Example Domain ${DIM}· 2 lines${RESET}`);
});

test("webfetch collapsed marks truncated", () => {
	const c = renderFetchResult(fetchResult({ title: "Big", text: "x\n".repeat(1000), truncated: true }), { expanded: false, isPartial: false }, {}, { args: { url: "https://x.com" }, isError: false });
	const lines = render(c);
	assert.match(lines[1], /truncated/);
});

test("webfetch error shows a red cross and the error", () => {
	const c = renderFetchResult(fetchResult({ error: "HTTP 404" }), { expanded: false, isPartial: false }, {}, { args: { url: "https://x.com/y" }, isError: true });
	const lines = render(c);
	assert.equal(lines[1], `${INDENT}${RED}✗${RESET} HTTP 404`);
});

test("webfetch expanded appends the indented markdown", () => {
	const c = renderFetchResult(fetchResult({ title: "T", text: "# T\n\nbody" }), { expanded: true, isPartial: false }, {}, { args: { url: "https://x.com" }, isError: false });
	const lines = render(c);
	assert.equal(lines[2], `${INDENT}# T`);
});

test("partial + not expanded returns empty (the call slot owns the header)", () => {
	const c = renderFetchResult(fetchResult({ text: "partial" }), { expanded: false, isPartial: true }, {}, { args: { url: "https://x.com" }, isError: false });
	assert.deepEqual(render(c), []);
});

test("renderCall shows a running header while partial, empty when done", () => {
	const partial = renderFetchCall({ url: "https://x.com" }, {}, { isPartial: true });
	assert.deepEqual(render(partial), [`${BOLD}webfetch${RESET} https://x.com`, `${INDENT}${DIM}fetching${RESET}`]);
	const done = renderFetchCall({ url: "https://x.com" }, {}, { isPartial: false });
	assert.deepEqual(render(done), []);
});