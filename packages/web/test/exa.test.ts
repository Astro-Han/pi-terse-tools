import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeExaResults, searchExa } from "../src/exa.ts";

test("normalize maps results to title/url/snippet, joining highlights", () => {
	const out = normalizeExaResults({
		results: [
			{ title: "A", url: "https://a.com", highlights: ["key point one", "key point two"], text: "long text..." },
			{ title: "B", url: "https://b.com", highlights: [], text: "only text body" },
			{ title: "C", url: "https://c.com" },
		],
	});
	assert.deepEqual(out, [
		{ title: "A", url: "https://a.com", snippet: "key point one key point two" },
		{ title: "B", url: "https://b.com", snippet: "only text body" },
		{ title: "C", url: "https://c.com", snippet: "" },
	]);
});

test("normalize skips results without a url", () => {
	const out = normalizeExaResults({ results: [{ title: "no url" }, { title: "ok", url: "https://ok.com" }] });
	assert.equal(out.length, 1);
	assert.equal(out[0].url, "https://ok.com");
});

test("normalize handles a missing results array", () => {
	assert.deepEqual(normalizeExaResults({}), []);
	assert.deepEqual(normalizeExaResults(null), []);
});

const jsonResponse = (obj: unknown) =>
	new Response(JSON.stringify(obj), { headers: { "content-type": "application/json" } });

test("searchExa posts to /search and returns normalized results", async () => {
	const fetchImpl = async (url: string, init: RequestInit) => {
		assert.equal(url, "https://api.exa.ai/search");
		const body = JSON.parse(init.body as string);
		assert.equal(body.query, "lean web fetch");
		assert.equal(body.numResults, 5);
		return jsonResponse({ results: [{ title: "T", url: "https://t.com", highlights: ["hi"] }] });
	};
	const out = await searchExa("lean web fetch", { apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
	assert.equal(out.error, null);
	assert.equal(out.results.length, 1);
	assert.equal(out.results[0].snippet, "hi");
});

test("searchExa sends the api key header", async () => {
	let seenKey = "";
	const fetchImpl = async (_url: string, init: RequestInit) => {
		seenKey = (init.headers as Record<string, string>)["x-api-key"];
		return jsonResponse({ results: [] });
	};
	await searchExa("q", { apiKey: "secret", fetchImpl: fetchImpl as unknown as typeof fetch });
	assert.equal(seenKey, "secret");
});

test("searchExa reports a non-ok response as an error", async () => {
	const fetchImpl = async () => new Response("bad", { status: 401 });
	const out = await searchExa("q", { apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
	assert.ok(out.error);
	assert.match(out.error!, /401/);
});

test("searchExa treats a broken 200 as an upstream error, not empty results", async () => {
	const fetchImpl = async () => new Response("not json", { status: 200, headers: { "content-type": "application/json" } });
	const out = await searchExa("q", { apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
	assert.ok(out.error, "expected an error for a broken 200");
	assert.equal(out.results.length, 0);
});

test("searchExa treats a 200 without a results array as an error", async () => {
	const fetchImpl = async () => jsonResponse({});
	const out = await searchExa("q", { apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
	assert.ok(out.error, "expected an error when results is missing");
});

test("searchExa treats a valid empty results array as a real zero result", async () => {
	const fetchImpl = async () => jsonResponse({ results: [] });
	const out = await searchExa("q", { apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
	assert.equal(out.error, null);
	assert.equal(out.results.length, 0);
});