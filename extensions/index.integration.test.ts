import { test } from "node:test";
import assert from "node:assert/strict";

import piTerse from "./index.ts";

const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

const register = (): Record<string, any> => {
	const tools: Record<string, any> = {};
	piTerse({ registerTool: (def: any) => { tools[def.name] = def; } } as any);
	return tools;
};

test("index: partial + expanded bash reveals streamed output", () => {
	const bash = register()["bash"];
	const block = bash.renderResult(
		{ content: [{ type: "text", text: "hello\nworld" }] },
		{ isPartial: true, expanded: true },
		{},
		{ args: { command: "echo hi", reasoning: "greet" }, isPartial: true, expanded: true },
	);
	assert.deepEqual(block.render(80), ["  hello", "  world"]);
});

test("index: partial + collapsed result slot renders nothing", () => {
	const bash = register()["bash"];
	const block = bash.renderResult(
		{ content: [{ type: "text", text: "hello" }] },
		{ isPartial: true, expanded: false },
		{},
		{ args: { command: "echo hi" }, isPartial: true, expanded: false },
	);
	assert.deepEqual(block.render(80), []);
});

test("index: completed + expanded shows header then body", () => {
	const bash = register()["bash"];
	const block = bash.renderResult(
		{ content: [{ type: "text", text: "hello\nworld" }] },
		{ isPartial: false, expanded: true },
		{},
		{ args: { command: "echo hi", reasoning: "greet" }, isPartial: false, expanded: true },
	);
	const lines = block.render(80);
	assert.equal(lines.length, 4);
	assert.deepEqual(lines.slice(2), ["  hello", "  world"]);
});

test("index: call slot shows a two-line running header while partial", () => {
	const bash = register()["bash"];
	const block = bash.renderCall(
		{ command: "echo hi", reasoning: "greet" },
		{},
		{ isPartial: true, expanded: true },
	);
	const lines = block.render(80).map(stripAnsi);
	assert.equal(lines.length, 2);
	assert.equal(lines[0], "bash greet");
	assert.ok(lines[1].includes("running"), `expected running summary, got: ${lines[1]}`);
});