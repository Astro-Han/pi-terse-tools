import { test } from "node:test";
import assert from "node:assert/strict";

import { fetchPage } from "../src/fetch.ts";

const article = (title: string, body: string) =>
	`<html><head><title>${title}</title></head><body><article><h1>${title}</h1>` +
	`<p>${body.repeat(20)}</p></article></body></html>`;

const respond = (
	body: string,
	{ status = 200, type = "text/html" }: { status?: number; type?: string } = {},
) =>
	(_url: string, _init?: unknown) =>
		Promise.resolve(new Response(body, { status, headers: { "content-type": type } }));

test("blocks non-http schemes without calling fetch", async () => {
	let called = false;
	const r = await fetchPage("file:///etc/passwd", {
		fetchImpl: () => { called = true; return Promise.resolve(new Response()); },
	});
	assert.equal(called, false);
	assert.equal(r.error, "only http and https URLs are allowed");
});

test("converts an html page to markdown with title", async () => {
	const r = await fetchPage("https://example.com/post", {
		fetchImpl: respond(article("Real Title", "body text here ")),
	});
	assert.equal(r.error, null);
	assert.equal(r.title, "Real Title");
	assert.match(r.contentType, /text\/html/);
	assert.match(r.content, /body text here/);
	assert.equal(r.truncated, false);
});

test("returns raw text for non-html content types", async () => {
	const r = await fetchPage("https://example.com/data.txt", {
		fetchImpl: respond("plain text body", { type: "text/plain" }),
	});
	assert.equal(r.error, null);
	assert.equal(r.content, "plain text body");
	assert.equal(r.title, "");
});

test("truncates output to maxChars and marks truncated", async () => {
	const long = "x".repeat(5000);
	const r = await fetchPage("https://example.com/big", {
		fetchImpl: respond(article("Big", long)),
		maxChars: 200,
	});
	assert.equal(r.truncated, true);
	assert.ok(r.content.length < long.length);
	assert.match(r.content, /truncat/i);
});

test("reports non-2xx status as an error", async () => {
	const r = await fetchPage("https://example.com/missing", {
		fetchImpl: respond("nope", { status: 404 }),
	});
	assert.ok(r.error);
	assert.match(r.error!, /404/);
});

test("aborts with a timeout error when the fetch hangs", async () => {
	const r = await fetchPage("https://example.com/slow", {
		fetchImpl: () => new Promise<Response>(() => {}),
		timeoutMs: 30,
	});
	assert.ok(r.error);
	assert.match(r.error!, /timed out|abort/i);
});

test("returns FetchResult.error (not a throw) when the body stream errors mid-read", async () => {
	const stream = new ReadableStream<Uint8Array>({
		start(c) { c.enqueue(new TextEncoder().encode("part one ")); },
		pull(c) { c.error(new Error("socket reset")); },
	});
	const r = await fetchPage("https://example.com/broken", {
		fetchImpl: async () => new Response(stream, { headers: { "content-type": "text/plain" } }),
	});
	assert.ok(r.error);
	assert.match(r.error!, /socket reset|abort|timed out/i);
});

test("cancels the reader when the byte cap is hit", async () => {
	let cancelled = false;
	const stream = new ReadableStream<Uint8Array>({
		start(c) { c.enqueue(new TextEncoder().encode("x".repeat(10000))); },
		cancel() { cancelled = true; },
	});
	await fetchPage("https://example.com/big", {
		fetchImpl: async () => new Response(stream, { headers: { "content-type": "text/plain" } }),
		maxBytes: 100,
	});
	assert.equal(cancelled, true);
});

test("times out when the body stream stalls after headers", async () => {
	const stream = new ReadableStream<Uint8Array>({
		start(c) { c.enqueue(new TextEncoder().encode("partial")); },
	});
	const r = await fetchPage("https://example.com/stall", {
		fetchImpl: async () => new Response(stream, { headers: { "content-type": "text/plain" } }),
		timeoutMs: 30,
	});
	assert.ok(r.error);
	assert.match(r.error!, /timed out|abort/i);
});