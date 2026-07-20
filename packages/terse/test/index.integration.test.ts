import { test } from "node:test";
import assert from "node:assert/strict";

import piTerse from "../src/index.ts";
import {
	createBashToolDefinition,
	createEditToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
} from "@earendil-works/pi-coding-agent";

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

const bashArgs = { command: "echo hi" };
const bashResult = (text: string) => ({ content: [{ type: "text", text }] });

test("registered tools preserve the native parameter schemas", () => {
	const tools = register();
	const factories = {
		read: createReadToolDefinition,
		write: createWriteToolDefinition,
		edit: createEditToolDefinition,
		bash: createBashToolDefinition,
		grep: createGrepToolDefinition,
		find: createFindToolDefinition,
		ls: createLsToolDefinition,
	};
	for (const [name, factory] of Object.entries(factories)) {
		assert.deepEqual(tools[name].parameters, factory(process.cwd()).parameters, name);
	}
});

test("execution does not inspect removed UI metadata", async () => {
	const args = new Proxy({ path: "package.json" }, {
		get(target, property, receiver) {
			if (property === "reasoning") throw new Error("reasoning must not be inspected");
			return Reflect.get(target, property, receiver);
		},
	});
	const result = await register().read.execute("call", args, undefined, undefined, { cwd: process.cwd() });
	assert.match(result.content[0].text, /"name": "pi-terse-/);
});

test("completed bash: input is on line1 and result is on line2", () => {
	const lines = render(register()["bash"], bashArgs, bashResult("hello\nworld"), { isPartial: false, expanded: false });
	assert.deepEqual(lines, ["bash echo hi", "  ✓ hello world"]);
});

test("completed bash without output: success does not invent a preview", () => {
	const lines = render(register()["bash"], bashArgs, bashResult(""), { isPartial: false, expanded: false });
	assert.deepEqual(lines, ["bash echo hi", "  ✓"]);
});

test("completed bash error: input is on line1 and failure is on line2", () => {
	const lines = render(register()["bash"], bashArgs, bashResult("boom\nCommand exited with code 2"), { isPartial: false, expanded: false, isError: true });
	assert.deepEqual(lines, ["bash echo hi", "  ✗ exit 2 boom"]);
});

test("completed bash error without output: failure does not invent a preview", () => {
	const lines = render(register()["bash"], bashArgs, bashResult("Command exited with code 2"), { isPartial: false, expanded: false, isError: true });
	assert.deepEqual(lines, ["bash echo hi", "  ✗ exit 2"]);
});

test("partial bash: input is on line1 and running is on line2", () => {
	const lines = render(register()["bash"], bashArgs, bashResult("hello\nworld"), { isPartial: true, expanded: false });
	assert.deepEqual(lines, ["bash echo hi", "  running hello world"]);
});

test("partial + expanded bash: running header then streamed body", () => {
	const lines = render(register()["bash"], bashArgs, bashResult("hello\nworld"), { isPartial: true, expanded: true });
	assert.deepEqual(lines, ["bash echo hi", "  running hello world", "  hello", "  world"]);
});

test("completed + expanded bash: status header then body", () => {
	const lines = render(register()["bash"], bashArgs, bashResult("hello\nworld"), { isPartial: false, expanded: true });
	assert.deepEqual(lines, ["bash echo hi", "  ✓ hello world", "  hello", "  world"]);
});

test("bash preview sanitizes terminal controls and bidi markers", () => {
	const lines = render(register()["bash"], bashArgs, bashResult("\x1b[31mred\x1b[0m\nsafe\u202e"), { isPartial: false, expanded: false });
	assert.deepEqual(lines, ["bash echo hi", "  ✓ red safe"]);
});

test("completed read: path is on line1 and size is on line2", () => {
	const result = { content: [{ type: "text", text: "x\n".repeat(24) }] };
	const lines = render(register()["read"], { path: "docs/models.md" }, result, { isPartial: false, expanded: false });
	assert.deepEqual(lines, ["read docs/models.md", "  24 lines"]);
});

test("partial non-bash tools retain their specialized two-line layout", () => {
	const result = { content: [{ type: "text", text: "streamed content" }] };
	const lines = render(register()["read"], { path: "docs/models.md" }, result, { isPartial: true, expanded: false });
	assert.deepEqual(lines, ["read docs/models.md", "  running"]);
});

test("completed grep: query is on line1 and match summary is on line2", () => {
	const result = { content: [{ type: "text", text: "src/a.ts:3:foo\nsrc/b.ts:7:foo\nsrc/b.ts:9:foo" }] };
	const lines = render(register()["grep"], { pattern: "foo", path: "src" }, result, { isPartial: false, expanded: false });
	assert.deepEqual(lines, ["grep foo in src", "  3 matches / 2 files"]);
});

test("narrow width: line2 truncation keeps the leading status", () => {
	const bash = register()["bash"];
	const block = bash.renderResult(
		bashResult("hello world from command"),
		{ isPartial: false, expanded: false },
		{},
		{ args: { command: "echo hi --long-flag" }, isPartial: false, expanded: false },
	);
	const lines = block.render(12).map(stripAnsi);
	assert.ok(
		lines[1].trimStart().startsWith("✓"),
		`expected leading ✓ preserved when truncated, got: ${lines[1]}`,
	);
	assert.ok(lines[1].endsWith("…"), `expected preview to truncate to width, got: ${lines[1]}`);
});
