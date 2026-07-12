import { test } from "node:test";
import assert from "node:assert/strict";

import piTerse from "./index.ts";

const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

const register = (): Record<string, any> => {
	const tools: Record<string, any> = {};
	piTerse({ registerTool: (def: any) => { tools[def.name] = def; } } as any);
	return tools;
};

// Pi renders a tool row by composing the call slot and the result slot. This
// helper mirrors that composition so tests assert the real on-screen output.
const render = (tool: any, args: any, result: any, opts: { isPartial: boolean; expanded: boolean; isError?: boolean }): string[] => {
	const ctx = { args, isPartial: opts.isPartial, expanded: opts.expanded, isError: opts.isError ?? false };
	const call = tool.renderCall(args, {}, ctx).render(80);
	const body = tool.renderResult(result, opts, {}, ctx).render(80);
	return [...call, ...body].map(stripAnsi);
};

const bashArgs = { command: "echo hi", reasoning: "greet" };
const bashResult = (text: string) => ({ content: [{ type: "text", text }] });

test("completed bash: status leads line2, detail follows, no arrow", () => {
	const lines = render(register()["bash"], bashArgs, bashResult("hello\nworld"), { isPartial: false, expanded: false });
	assert.deepEqual(lines, ["bash greet", "  ✓ echo hi"]);
});

test("completed bash error: ✗ leads, exit code and detail follow", () => {
	const lines = render(register()["bash"], bashArgs, bashResult("boom\nCommand exited with code 2"), { isPartial: false, expanded: false, isError: true });
	assert.deepEqual(lines, ["bash greet", "  ✗ exit 2 echo hi"]);
});

test("completed bash without reasoning: line1 carries detail, line2 is status only", () => {
	const lines = render(register()["bash"], { command: "echo hi" }, bashResult("hello"), { isPartial: false, expanded: false });
	assert.deepEqual(lines, ["bash echo hi", "  ✓"]);
});

test("partial bash: running leads line2, detail follows", () => {
	const lines = render(register()["bash"], bashArgs, bashResult("hello\nworld"), { isPartial: true, expanded: false });
	assert.deepEqual(lines, ["bash greet", "  running echo hi"]);
});

test("partial + expanded bash: running header then streamed body", () => {
	const lines = render(register()["bash"], bashArgs, bashResult("hello\nworld"), { isPartial: true, expanded: true });
	assert.deepEqual(lines, ["bash greet", "  running echo hi", "  hello", "  world"]);
});

test("completed + expanded bash: status header then body", () => {
	const lines = render(register()["bash"], bashArgs, bashResult("hello\nworld"), { isPartial: false, expanded: true });
	assert.deepEqual(lines, ["bash greet", "  ✓ echo hi", "  hello", "  world"]);
});

test("completed read: size summary leads line2, path follows, no arrow", () => {
	const result = { content: [{ type: "text", text: "x\n".repeat(24) }] };
	const lines = render(register()["read"], { path: "docs/models.md", reasoning: "check models" }, result, { isPartial: false, expanded: false });
	assert.deepEqual(lines, ["read check models", "  24 lines docs/models.md"]);
});

test("completed grep: match summary leads line2, pattern follows", () => {
	const result = { content: [{ type: "text", text: "src/a.ts:3:foo\nsrc/b.ts:7:foo\nsrc/b.ts:9:foo" }] };
	const lines = render(register()["grep"], { pattern: "foo", path: "src", reasoning: "find usage" }, result, { isPartial: false, expanded: false });
	assert.deepEqual(lines, ["grep find usage", "  3 matches / 2 files foo in src"]);
});

test("narrow width: line2 truncation keeps the leading status", () => {
	const bash = register()["bash"];
	const block = bash.renderResult(
		bashResult("hi"),
		{ isPartial: false, expanded: false },
		{},
		{ args: { command: "echo hi --long-flag", reasoning: "greet" }, isPartial: false, expanded: false },
	);
	const lines = block.render(12).map(stripAnsi);
	assert.ok(
		lines[1].trimStart().startsWith("✓"),
		`expected leading ✓ preserved when truncated, got: ${lines[1]}`,
	);
});