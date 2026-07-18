import { test } from "node:test";
import assert from "node:assert/strict";

import { htmlToMarkdown } from "../src/extract.ts";

// A page shaped like a real article: <title>/<h1> agree, a nav bar, a main
// article long enough for Readability's default threshold, and a footer that
// must not survive extraction. This is the independent source of truth.
const ARTICLE = `<html><head><title>How to Fetch a URL</title></head><body>
<nav><a href="/">Home</a> | <a href="/about">About</a></nav>
<main>
<h1>How to Fetch a URL</h1>
<p>${"The goal of webfetch is to turn a URL into clean, bounded text the LLM can reason over. ".repeat(12)}</p>
<p>It must strip navigation and footer boilerplate, and keep the article. This sentence is part of the body and should survive extraction.</p>
<h2>Steps</h2>
<ul><li>fetch with a timeout</li><li>extract the main content</li><li>convert to markdown</li></ul>
</main>
<footer>Copyright 2026. Do not reproduce.</footer>
</body></html>`;

test("extracts the article title and body as markdown, dropping nav/footer", () => {
	const { title, markdown } = htmlToMarkdown(ARTICLE, "https://example.com/post");
	assert.equal(title, "How to Fetch a URL");
	assert.match(markdown, /turn a URL into clean/);
	assert.match(markdown, /fetch with a timeout/);
	assert.doesNotMatch(markdown, /Copyright 2026/);
	assert.doesNotMatch(markdown, /Home \| About/);
});

test("falls back to body text when readability cannot find an article", () => {
	const { markdown } = htmlToMarkdown("<html><body><p>just a fragment</p></body></html>", "https://example.com/");
	assert.match(markdown, /just a fragment/);
});

test("never throws on broken html, returns whatever it can", () => {
	const { markdown } = htmlToMarkdown("<<<not html at all", "https://example.com/");
	assert.equal(typeof markdown, "string");
});

test("absolutizes relative links against the base url", () => {
	const body = "Read the next section carefully. ".repeat(40);
	const html = `<html><head><title>Docs</title></head><body><article>
	<h1>Docs</h1>
	<p>${body}</p>
	<p>See <a href="/docs/next">next</a> and <a href="related.html">related</a>.</p>
	</article></body></html>`;
	const { markdown } = htmlToMarkdown(html, "https://example.com/docs/start");
	assert.match(markdown, /\]\(https:\/\/example\.com\/docs\/next\)/);
	assert.match(markdown, /\]\(https:\/\/example\.com\/docs\/related\.html\)/);
});

test("returns text for tagless input served as html (no html structure)", () => {
	const { markdown } = htmlToMarkdown("中文正文", "https://example.com/");
	assert.match(markdown, /中文正文/);
});