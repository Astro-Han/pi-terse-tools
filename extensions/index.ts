import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	createBashToolDefinition,
	createEditToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Container, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { RESET, SEP, buildBlock, resultLines, strip } from "./render.ts";

const truncate = (text: string, width: number): string =>
	truncateToWidth(text, width, "…").replace(/\x1b\[0m/g, RESET);

// Preserve the trusted separator tail, not user-supplied →.
function fitLine(line: string, width: number): string {
	if (visibleWidth(line) <= width) return line;
	const i = line.indexOf(SEP);
	if (i < 0) return truncate(line, width);
	const tail = line.slice(i);
	const tw = visibleWidth(tail);
	if (tw >= width) return truncate(tail, width);
	return `${truncate(line.slice(0, i).trimEnd(), width - tw - 1)} ${tail}`;
}

class TidyBlock {
	private readonly source: string[];
	constructor(source: string[]) { this.source = source; }
	invalidate(): void {}
	render(width: number): string[] {
		const w = Math.max(1, width);
		// pi-tui counts tabs as three columns.
		return this.source.map((line) => fitLine(line.replace(/\t/g, "   "), w));
	}
}

// Put reasoning first for earlier streaming.
function withReasoning(p: any): any {
	const r = {
		type: "string",
		description: "State the call's purpose in one sentence, using the user's language. Use an empty string for obvious calls; don't repeat other arguments.",
	};
	const required = (p?.required ?? []).filter((name: string) => name !== "reasoning");
	return { ...p, properties: { reasoning: r, ...(p?.properties ?? {}) }, required: ["reasoning", ...required] };
}

export default function (pi: ExtensionAPI) {
	const factories: Record<string, (cwd: string) => any> = {
		read: createReadToolDefinition, write: createWriteToolDefinition, edit: createEditToolDefinition,
		bash: createBashToolDefinition, grep: createGrepToolDefinition, find: createFindToolDefinition, ls: createLsToolDefinition,
	};

	for (const [name, factory] of Object.entries(factories)) {
		// Preserve native metadata and prepareArguments.
		const tool = factory(process.cwd());
		pi.registerTool({
			...tool,
			parameters: withReasoning(tool.parameters),
			renderShell: "default",
			execute: async (id: string, p: any, sig: any, up: any, ctx: any) =>
				factory(ctx?.cwd ?? process.cwd()).execute(id, strip(p).rest, sig, up, ctx),
			// The call slot owns the running header while partial.
			renderCall: (args: any, theme: any, ctx: any) => {
				if (!ctx?.isPartial) return new Container();
				return new TidyBlock(buildBlock(name, args ?? {}, {}, { partial: true }));
			},
			// The result slot owns the summary when done, and the expanded body
			// (including streamed partial output) when expanded.
			renderResult: (result: any, opts: any, theme: any, ctx: any) => {
				if (opts?.isPartial && !opts?.expanded) return new Container();
				const lines = resultLines(name, ctx?.args ?? {}, result, {
					isPartial: opts?.isPartial ?? false,
					expanded: opts?.expanded ?? false,
					isError: ctx?.isError ?? false,
				});
				return new TidyBlock(lines);
			},
		});
	}
}