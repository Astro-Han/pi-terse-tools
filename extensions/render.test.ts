import { test } from "node:test";
import assert from "node:assert/strict";

import { resultLines, buildBlock } from "./render.ts";

// Strip ANSI escapes so assertions read against the visible text.
const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

const bashResult = (text: string) => ({ content: [{ type: "text", text }] });
const bashArgs = { command: "echo hi", reasoning: "greet" };

test("resultLines: partial + expanded shows the streamed body", () => {
	// While bash is still running, pi streams partial results; expanding the
	// block should reveal the streamed output rather than nothing.
	const lines = resultLines("bash", bashArgs, bashResult("hello\nworld"), {
		isPartial: true,
		expanded: true,
	});
	assert.deepEqual(lines, ["  hello", "  world"]);
});

test("resultLines: partial + collapsed shows nothing (call slot owns the header)", () => {
	const lines = resultLines("bash", bashArgs, bashResult("hello\nworld"), {
		isPartial: true,
		expanded: false,
	});
	assert.deepEqual(lines, []);
});

test("resultLines: completed + expanded shows header then body", () => {
	const lines = resultLines("bash", bashArgs, bashResult("hello\nworld"), {
		isPartial: false,
		expanded: true,
	});
	assert.equal(lines.length, 4);
	assert.deepEqual(lines.slice(2), ["  hello", "  world"]);
	const [l1, l2] = lines.map(stripAnsi);
	assert.equal(l1, "bash greet");
	assert.ok(l2.includes("✓"), `expected a checkmark summary, got: ${l2}`);
});

test("resultLines: completed + collapsed shows only the two-line header", () => {
	const lines = resultLines("bash", bashArgs, bashResult("hello\nworld"), {
		isPartial: false,
		expanded: false,
	});
	assert.equal(lines.length, 2);
});

test("buildBlock: call-slot usage renders a two-line running header", () => {
	// renderCall invokes buildBlock(name, args, {}, { partial: true }) without
	// an expanded flag, so the call slot is always a two-line running header
	// while the result slot surfaces the partial body when expanded.
	const lines = buildBlock("bash", bashArgs, {}, { partial: true });
	assert.equal(lines.length, 2);
	assert.ok(stripAnsi(lines[1]).includes("running"));
});