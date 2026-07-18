import { test } from "node:test";
import assert from "node:assert/strict";

import piWeb from "../src/index.ts";

const register = (): Record<string, any> => {
	const tools: Record<string, any> = {};
	piWeb({ registerTool: (def: any) => { tools[def.name] = def; } } as any);
	return tools;
};

test("registers webfetch and websearch tools", () => {
	const tools = register();
	assert.ok(tools.webfetch, "webfetch registered");
	assert.ok(tools.websearch, "websearch registered");
});

test("webfetch parameters require url", () => {
	const props = register().webfetch.parameters;
	assert.equal(typeof props.properties.url, "object");
	assert.ok(props.required.includes("url"));
});

test("websearch parameters require query", () => {
	const props = register().websearch.parameters;
	assert.equal(typeof props.properties.query, "object");
	assert.ok(props.required.includes("query"));
});