// Compact TUI rendering for webfetch/websearch, in the pi-terse-tools style:
// a 2-line header (tool name + arg, then a one-line summary) when collapsed,
// and the full content indented underneath when expanded. This only changes
// what the user sees — the LLM still receives the full content[].text from
// execute, untouched.
//
// The shape mirrors packages/terse/src/index.ts (TidyBlock, safeText, the ANSI
// palette) so webfetch/websearch read like the compressed built-in tools.

import { Container, truncateToWidth } from "@earendil-works/pi-tui";

const DIM = "\x1b[2m", BOLD = "\x1b[1m", GREEN = "\x1b[32m", RED = "\x1b[31m", RESET = "\x1b[22;39m";
const INDENT = "  ";

// Strip untrusted control/escape sequences before mixing dynamic text with our
// own trusted ANSI — same sanitizer as the terse package.
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
const plural = (n: number, s: string, p: string): string => (n === 1 ? s : p);
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

const textOf = (r: { content?: { type?: string; text?: string }[] }): string =>
	r?.content?.find((x) => x?.type === "text")?.text ?? "";
const firstLine = (s: string): string => s.split("\n").find((l) => l.trim()) ?? "";

function expandedBody(result: unknown): string[] {
	const text = safeText(textOf(result as never)).replace(/\n$/, "");
	return text ? text.split("\n").map((l) => `${INDENT}${l}`) : [];
}

// --- webfetch ---

export function renderFetchCall(args: { url?: string }, _theme: unknown, ctx: { isPartial?: boolean }): unknown {
	if (!ctx?.isPartial) return new Container();
	const url = oneLine(safeText(args?.url ?? ""));
	return new TidyBlock([`${BOLD}webfetch${RESET} ${url}`, `${INDENT}${DIM}fetching${RESET}`]);
}

export function renderFetchResult(
	result: { content?: { type?: string; text?: string }[]; details?: { title?: string; truncated?: boolean; error?: string | null } },
	opts: { expanded?: boolean; isPartial?: boolean },
	_theme: unknown,
	ctx: { args?: { url?: string }; isError?: boolean },
): unknown {
	if (opts?.isPartial) {
		if (!opts?.expanded) return new Container();
		return new TidyBlock(expandedBody(result));
	}
	const url = oneLine(safeText(ctx?.args?.url ?? ""));
	const d = result?.details ?? {};
	const err = ctx?.isError || d.error;
	const lines = [`${BOLD}webfetch${RESET} ${url}`];
	if (err) {
		lines.push(`${INDENT}${RED}✗${RESET} ${firstLine(safeText(String(d.error ?? textOf(result))))}`);
	} else {
		const title = oneLine(safeText(d.title ?? ""));
		const n = nonEmpty(textOf(result));
		const head = title ? `${GREEN}✓${RESET} ${title}` : `${GREEN}✓${RESET}${DIM}(no title)${RESET}`;
		let sum = `${head} ${DIM}· ${n} ${plural(n, "line", "lines")}${RESET}`;
		if (d.truncated) sum += ` ${DIM}truncated${RESET}`;
		lines.push(`${INDENT}${sum}`);
	}
	if (opts?.expanded) lines.push(...expandedBody(result));
	return new TidyBlock(lines);
}

// --- websearch ---

export function renderSearchCall(args: { query?: string }, _theme: unknown, ctx: { isPartial?: boolean }): unknown {
	if (!ctx?.isPartial) return new Container();
	const q = oneLine(safeText(args?.query ?? ""));
	return new TidyBlock([`${BOLD}websearch${RESET} ${q}`, `${INDENT}${DIM}searching${RESET}`]);
}

export function renderSearchResult(
	result: { content?: { type?: string; text?: string }[]; details?: { resultCount?: number; error?: string | null } },
	opts: { expanded?: boolean; isPartial?: boolean },
	_theme: unknown,
	ctx: { args?: { query?: string }; isError?: boolean },
): unknown {
	if (opts?.isPartial) {
		if (!opts?.expanded) return new Container();
		return new TidyBlock(expandedBody(result));
	}
	const q = oneLine(safeText(ctx?.args?.query ?? ""));
	const d = result?.details ?? {};
	const err = ctx?.isError || d.error;
	const lines = [`${BOLD}websearch${RESET} ${q}`];
	if (err) {
		lines.push(`${INDENT}${RED}✗${RESET} ${firstLine(safeText(String(d.error ?? textOf(result))))}`);
	} else {
		const n = typeof d.resultCount === "number" ? d.resultCount : 0;
		lines.push(n > 0
			? `${INDENT}${GREEN}${n}${RESET} ${plural(n, "result", "results")}`
			: `${INDENT}${DIM}0 results${RESET}`);
	}
	if (opts?.expanded) lines.push(...expandedBody(result));
	return new TidyBlock(lines);
}

export { DIM, BOLD, GREEN, RED, RESET, INDENT };