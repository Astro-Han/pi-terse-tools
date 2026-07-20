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
import { Container, truncateToWidth } from "@earendil-works/pi-tui";

const DIM = "\x1b[2m", BOLD = "\x1b[1m", GREEN = "\x1b[32m", RED = "\x1b[31m", RESET = "\x1b[22;39m";
const INDENT = "  ";
const HOME = process.env.HOME ?? "";

// Sanitize dynamic text before adding trusted ANSI.
function safeText(s: unknown): string {
	if (typeof s !== "string") return "";
	return s.toWellFormed()
		.replace(/(?:\x1b\]|\x9d)[^\x07\x1b\x9c]*(\x07|\x1b\\|\x9c)/g, "")
		.replace(/\x1b[=>]/g, "")
		.replace(/(?:\x1b\[|\x9b)[0-;:?>]*[ -/]*[@-~]/g, "")
		.replace(/[\x00-\x08\x0b-\x1f\x7f\x80-\x9f]/g, "")
		.replace(/[\ufff9-\ufffb\p{Bidi_Control}]/gu, "");
}

const oneLine = (s: string): string => s.replace(/\s+/g, " ").trim();
const plural = (n: number, s: string, p: string): string => n === 1 ? s : p;
const shortPath = (p: string): string =>
	p && HOME && (p === HOME || p.startsWith(`${HOME}/`)) ? `~${p.slice(HOME.length)}` : p;
const nonEmpty = (s: string): number => s.trim().split("\n").filter(Boolean).length;

const truncate = (text: string, width: number): string =>
	truncateToWidth(text, width, "…").replace(/\x1b\[0m/g, RESET);

class TidyBlock {
	private readonly source: string[];
	constructor(source: string[]) { this.source = source; }
	invalidate(): void {}
	render(width: number): string[] {
		const w = Math.max(1, width);
		// pi-tui counts tabs as three columns.
		return this.source.map((line) => truncate(line.replace(/\t/g, "   "), w));
	}
}

const textOf = (r: any): string => r?.content?.find((x: any) => x?.type === "text")?.text ?? "";

const truncated = (r: any): boolean =>
	!!(r?.details?.truncation?.truncated || r?.details?.linesTruncated ||
		r?.details?.matchLimitReached !== undefined || r?.details?.resultLimitReached !== undefined ||
		r?.details?.entryLimitReached !== undefined);

function detailOf(name: string, a: Record<string, unknown>): string {
	if (name === "bash" && typeof a.command === "string") return oneLine(safeText(a.command));
	if ((name === "grep" || name === "find") && typeof a.pattern === "string")
		return oneLine(`${safeText(a.pattern)} in ${shortPath(safeText(a.path) || ".")}`);
	if (typeof a.path === "string") return oneLine(shortPath(safeText(a.path || ".")));
	return name === "ls" ? "." : "";
}

function summarize(name: string, r: any, err: boolean, a: Record<string, unknown>): string {
	const t = safeText(textOf(r));
	if (err) {
		if (name === "bash") {
			const lines = t.split("\n").filter(Boolean);
			const last = lines[lines.length - 1] ?? "";
			const m = last.match(/^Command exited with code (\d+)$/);
			const preview = oneLine(m ? lines.slice(0, -1).join(" ") : t);
			const status = m ? `${RED}✗ exit ${m[1]}${RESET}` : `${RED}✗${RESET}`;
			if (preview) return `${status} ${DIM}${preview}${RESET}`;
			return m ? status : `${status} ${DIM}error${RESET}`;
		}
		return `${RED}✗ ${t.split("\n").find(Boolean) || "error"}${RESET}`;
	}
	if (name === "read") {
		if (r?.content?.some((c: any) => c?.type === "image")) return `${GREEN}image${RESET}`;
		const trunc = r?.details?.truncation;
		if (trunc && typeof trunc.outputLines === "number") return `${GREEN}${trunc.outputLines} ${plural(trunc.outputLines, "line", "lines")}${RESET}`;
		const body = t.replace(/\n\n\[\d+ more lines in file[^\]]*\]$/, "");
		const n = body === "" ? 0 : body.replace(/\n$/, "").split("\n").length;
		return `${GREEN}${n} ${plural(n, "line", "lines")}${RESET}`;
	}
	if (name === "write") {
		const c = (a.content as string) ?? "";
		const n = c === "" ? 0 : c.replace(/\n$/, "").split("\n").length;
		return `${GREEN}${n}${RESET} ${DIM}${plural(n, "line", "lines")}${RESET}`;
	}
	if (name === "edit") {
		const d = r?.details?.diff as string | undefined;
		let add = 0, del = 0;
		for (const l of d?.split("\n") ?? []) {
			if (l.startsWith("+")) add++;
			else if (l.startsWith("-")) del++;
		}
		return `${GREEN}+${add}${RESET}${DIM}/${RESET}${RED}-${del}${RESET}`;
	}
	if (name === "bash") {
		const preview = oneLine(t);
		return `${GREEN}✓${RESET}` + (preview ? ` ${DIM}${preview}${RESET}` : "");
	}
	if (name === "grep") {
		if (t.trim() === "No matches found") return `${DIM}0 ${plural(0, "match", "matches")} / 0 ${plural(0, "file", "files")}${RESET}`;
		const rows = t.split("\n").map((l) => l.match(/^([^:]+):(\d+):/)).filter(Boolean) as RegExpMatchArray[];
		const count = rows.length;
		const files = new Set(rows.map((m) => m[1])).size;
		return `${GREEN}${count} ${plural(count, "match", "matches")}${RESET} ${DIM}/${RESET} ${DIM}${files} ${plural(files, "file", "files")}${RESET}`;
	}
	if (t === "No files found matching pattern" || t === "(empty directory)") {
		const noun = name === "find" ? plural(0, "file", "files") : plural(0, "entry", "entries");
		return `${DIM}0 ${noun}${RESET}`;
	}
	const n = nonEmpty(t.split("\n\n[")[0]);
	const noun = name === "find" ? plural(n, "file", "files") : plural(n, "entry", "entries");
	return `${DIM}${n} ${noun}${RESET}`;
}

function expandedLines(name: string, args: Record<string, unknown>, r: any, err: boolean): string[] {
	if (!err && name === "write" && typeof args.content === "string") {
		if (args.content === "") return [`${INDENT}(empty file)`];
		return args.content.replace(/\n$/, "").split("\n").map((l) => `${INDENT}${safeText(l)}`);
	}
	if (!err && name === "edit") {
		const d = r?.details?.diff as string | undefined;
		if (d) return safeText(d).replace(/\n$/, "").split("\n").map((l) => `${INDENT}${l}`);
	}
	const text = safeText(textOf(r)).replace(/\n$/, "");
	return text ? text.split("\n").map((l) => `${INDENT}${l}`) : [];
}

function buildBlock(
	name: string, a: Record<string, unknown>, r: any,
	o: { err?: boolean; partial?: boolean; expanded?: boolean } = {},
): string[] {
	const { err = false, partial = false, expanded = false } = o;
	const lines = [inputLine(name, a), resultLine(name, a, r, err, partial)];
	if (expanded) lines.push(...expandedLines(name, a, r, err));
	return lines;
}

function inputLine(name: string, args: Record<string, unknown>): string {
	return `${BOLD}${name}${RESET} ${detailOf(name, args)}`;
}

function resultLine(name: string, args: Record<string, unknown>, result: any, err: boolean, partial: boolean): string {
	if (partial) {
		const preview = name === "bash" ? oneLine(safeText(textOf(result))) : "";
		return `${INDENT}${DIM}running${RESET}` + (preview ? ` ${DIM}${preview}${RESET}` : "");
	}
	const summary = summarize(name, result, err, args) + (truncated(result) ? ` ${DIM}truncated${RESET}` : "");
	return `${INDENT}${summary}`;
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
			renderShell: "default",
			execute: async (id: string, p: any, sig: any, up: any, ctx: any) =>
				factory(ctx?.cwd ?? process.cwd()).execute(id, p, sig, up, ctx),
			// While partial, Pi composes the input from the call slot with the
			// live status and output preview from the result slot.
			renderCall: (args: any, theme: any, ctx: any) => {
				if (!ctx?.isPartial) return new Container();
				return new TidyBlock([inputLine(name, args ?? {})]);
			},
			// The result slot owns the status and the expanded body.
			renderResult: (result: any, opts: any, theme: any, ctx: any) => {
				if (opts?.isPartial) {
					const args = ctx?.args ?? {};
					const err = ctx?.isError ?? false;
					const lines = [resultLine(name, args, result, err, true)];
					if (opts?.expanded) lines.push(...expandedLines(name, args, result, err));
					return new TidyBlock(lines);
				}
				const err = ctx?.isError ?? false;
				const lines = buildBlock(name, ctx?.args ?? {}, result, { err, expanded: opts?.expanded ?? false });
				return new TidyBlock(lines);
			},
		});
	}
}
