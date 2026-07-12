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

test("partial + expanded: running header followed by streamed body", () => {
	// Regression for the original bug: expanding while running showed nothing.
	const bash = register()["bash"];
	const lines = render(bash, bashArgs, bashResult("hello\nworld"), { isPartial: true, expanded: true });
	assert.equal(lines.length, 4);
	assert.equal(lines[0], "bash greet");
	assert.ok(lines[1].includes("running"), `expected running summary, got: ${lines[1]}`);
	assert.deepEqual(lines.slice(2), ["  hello", "  world"]);
});

test("partial + collapsed: only the running header", () => {
	const bash = register()["bash"];
	const lines = render(bash, bashArgs, bashResult("hello\nworld"), { isPartial: true, expanded: false });
	assert.equal(lines.length, 2);
	assert.ok(lines[1].includes("running"));
});

test("completed + expanded: summary header followed by body", () => {
	const bash = register()["bash"];
	const lines = render(bash, bashArgs, bashResult("hello\nworld"), { isPartial: false, expanded: true });
	assert.equal(lines.length, 4);
	assert.equal(lines[0], "bash greet");
	assert.ok(lines[1].includes("✓"), `expected checkmark summary, got: ${lines[1]}`);
	assert.deepEqual(lines.slice(2), ["  hello", "  world"]);
});

test("completed + collapsed: only the two-line summary header", () => {
	const bash = register()["bash"];
	const lines = render(bash, bashArgs, bashResult("hello\nworld"), { isPartial: false, expanded: false });
	assert.equal(lines.length, 2);
	assert.ok(lines[1].includes("✓"));
});

test("completed error: exit code shown in the summary", () => {
	const bash = register()["bash"];
	const lines = render(
		bash,
		bashArgs,
		bashResult("boom\nCommand exited with code 2"),
		{ isPartial: false, expanded: false, isError: true },
	);
	assert.equal(lines.length, 2);
	assert.ok(lines[1].includes("exit 2"), `expected exit code, got: ${lines[1]}`);
});