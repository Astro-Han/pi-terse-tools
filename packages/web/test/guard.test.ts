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

test("rejects localhost and 127.0.0.0/8", () => {
	assert.equal(guardUrl("http://localhost/").ok, false);
	assert.equal(guardUrl("http://127.0.0.1/").ok, false);
	assert.equal(guardUrl("http://127.255.255.254/").ok, false);
});

test("rejects ipv6 loopback, link-local metadata, and unspecified", () => {
	assert.equal(guardUrl("http://[::1]/").ok, false);
	assert.equal(guardUrl("http://169.254.169.254/").ok, false);
	assert.equal(guardUrl("http://0.0.0.0/").ok, false);
});

test("allows public domains and public literal IPs (no DNS resolution)", () => {
	assert.deepEqual(guardUrl("https://example.com/"), { ok: true });
	assert.deepEqual(guardUrl("https://example.com/path?q=1"), { ok: true });
	assert.deepEqual(guardUrl("http://1.2.3.4/"), { ok: true });
	// A domain that resolves to a private IP is still allowed: guardUrl never resolves DNS.
	assert.deepEqual(guardUrl("http://localtest.me/"), { ok: true });
});