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

const jsonResponse = (obj: unknown) =>
	new Response(JSON.stringify(obj), { headers: { "content-type": "application/json" } });

const withFetchStub = async <T>(stub: typeof fetch, fn: () => Promise<T>): Promise<T> => {
	const orig = globalThis.fetch;
	globalThis.fetch = stub;
	try { return await fn(); } finally { globalThis.fetch = orig; }
};

const withApiKey = async <T>(key: string | undefined, fn: () => Promise<T>): Promise<T> => {
	const orig = process.env.EXA_API_KEY;
	if (key === undefined) delete process.env.EXA_API_KEY; else process.env.EXA_API_KEY = key;
	try { return await fn(); } finally {
		if (orig === undefined) delete process.env.EXA_API_KEY; else process.env.EXA_API_KEY = orig;
	}
};

test("websearch execute clamps numResults to 1..20", async () => {
	const bodies: number[] = [];
	const stub = (async (_u: string, init: RequestInit) => {
		bodies.push(JSON.parse(init.body as string).numResults);
		return jsonResponse({ results: [] });
	}) as unknown as typeof fetch;
	await withApiKey("test", () => withFetchStub(stub, async () => {
		const tools = register();
		await tools.websearch.execute("c", { query: "q", numResults: 0 }, undefined);
		await tools.websearch.execute("c", { query: "q", numResults: 25 }, undefined);
		await tools.websearch.execute("c", { query: "q", numResults: 3.7 }, undefined);
	}));
	assert.deepEqual(bodies, [1, 20, 3]);
});

test("websearch execute errors without EXA_API_KEY", async () => {
	await withApiKey(undefined, async () => {
		const out = await register().websearch.execute("c", { query: "q" }, undefined);
		assert.match(out.content[0].text, /EXA_API_KEY/i);
		assert.ok(out.details.error);
	});
});

test("websearch execute formats a no-results message", async () => {
	const stub = (async () => jsonResponse({ results: [] })) as unknown as typeof fetch;
	await withApiKey("test", () => withFetchStub(stub, async () => {
		const out = await register().websearch.execute("c", { query: "nothing" }, undefined);
		assert.match(out.content[0].text, /No results for "nothing"/);
	}));
});

test("webfetch execute prefixes the title as a markdown heading", async () => {
	const stub = (async () => new Response(
		"<html><head><title>Hi</title></head><body><article><p>body words here</p></article></body></html>",
		{ headers: { "content-type": "text/html" } },
	)) as unknown as typeof fetch;
	await withFetchStub(stub, async () => {
		const out = await register().webfetch.execute("c", { url: "https://example.com/x" }, undefined);
		assert.match(out.content[0].text, /^# Hi/);
		assert.equal(out.details.error, null);
	});
});

test("webfetch execute flags isError on missing url", async () => {
	const out = await register().webfetch.execute("c", { url: "" }, undefined);
	assert.equal(out.isError, true);
});

test("webfetch execute flags isError on fetch failure", async () => {
	const stub = (async () => new Response("nope", { status: 404 })) as unknown as typeof fetch;
	await withFetchStub(stub, async () => {
		const out = await register().webfetch.execute("c", { url: "https://example.com/x" }, undefined);
		assert.equal(out.isError, true);
	});
});

test("websearch execute flags isError on missing query", async () => {
	const out = await register().websearch.execute("c", { query: "" }, undefined);
	assert.equal(out.isError, true);
});

test("websearch execute flags isError on missing EXA_API_KEY", async () => {
	await withApiKey(undefined, async () => {
		const out = await register().websearch.execute("c", { query: "q" }, undefined);
		assert.equal(out.isError, true);
	});
});

test("websearch execute flags isError on Exa failure", async () => {
	const stub = (async () => new Response("oops", { status: 500 })) as unknown as typeof fetch;
	await withApiKey("test", () => withFetchStub(stub, async () => {
		const out = await register().websearch.execute("c", { query: "q" }, undefined);
		assert.equal(out.isError, true);
	}));
});

test("webfetch execute does not flag isError on success", async () => {
	const stub = (async () => new Response(
		"<html><head><title>Hi</title></head><body><article><p>body words here</p></article></body></html>",
		{ headers: { "content-type": "text/html" } },
	)) as unknown as typeof fetch;
	await withFetchStub(stub, async () => {
		const out = await register().webfetch.execute("c", { url: "https://example.com/x" }, undefined);
		assert.notEqual(out.isError, true);
	});
});

test("websearch execute does not flag isError on success", async () => {
	const stub = (async () => jsonResponse({ results: [] })) as unknown as typeof fetch;
	await withApiKey("test", () => withFetchStub(stub, async () => {
		const out = await register().websearch.execute("c", { query: "nothing" }, undefined);
		assert.notEqual(out.isError, true);
	}));
});