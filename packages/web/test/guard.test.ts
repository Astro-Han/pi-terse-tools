import { test } from "node:test";
import assert from "node:assert/strict";

import { guardUrl } from "../src/guard.ts";

test("rejects non-http(s) schemes", () => {
	assert.deepEqual(guardUrl("file:///etc/passwd"), { ok: false, reason: "only http and https URLs are allowed" });
	assert.deepEqual(guardUrl("ftp://example.com/"), { ok: false, reason: "only http and https URLs are allowed" });
});

test("rejects malformed urls", () => {
	assert.equal(guardUrl("not a url").ok, false);
});

test("allows any host, including localhost (no SSRF protection by design)", () => {
	assert.deepEqual(guardUrl("https://example.com/"), { ok: true });
	assert.deepEqual(guardUrl("http://127.0.0.1/"), { ok: true });
	assert.deepEqual(guardUrl("http://localhost/"), { ok: true });
	assert.deepEqual(guardUrl("http://169.254.169.254/"), { ok: true });
});