// Pure rendering logic with no pi dependencies, so it can be unit-tested in
// isolation. The pi integration layer (index.ts) composes these into TidyBlocks.

const DIM = "\x1b[2m", BOLD = "\x1b[1m", GREEN = "\x1b[32m", RED = "\x1b[31m", RESET = "\x1b[22;39m";
const SEP = `${DIM}→${RESET}`;
const INDENT = "  ";
const HOME = process.env.HOME ?? "";

export { DIM, BOLD, GREEN, RED, RESET, SEP, INDENT, HOME };

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

export { safeText, oneLine, plural, shortPath, nonEmpty, textOf, truncated, detailOf };

function summarize(name: string, r: any, err: boolean, a: Record<string, unknown>): string {
	const t = safeText(textOf(r));
	if (err) {
		if (name === "bash") {
			const lines = t.split("\n").filter(Boolean);
			const last = lines[lines.length - 1] ?? "";
			const m = last.match(/^Command exited with code (\d+)$/);
			if (m) return `${RED}exit ${m[1]}${RESET}`;
			return `${RED}${last || "error"}${RESET}`;
		}
		return `${RED}${t.split("\n").find(Boolean) || "error"}${RESET}`;
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
	if (name === "bash") return `${GREEN}✓${RESET}`;
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

export { summarize };

export function expandedLines(name: string, args: Record<string, unknown>, r: any, err: boolean): string[] {
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

export function strip(p: any): { reasoning?: string; rest: any } {
	const { reasoning, ...rest } = p ?? {};
	return { reasoning: typeof reasoning === "string" ? reasoning : undefined, rest };
}

export function buildBlock(
	name: string, a: Record<string, unknown>, r: any,
	o: { err?: boolean; partial?: boolean; expanded?: boolean } = {},
): string[] {
	const { err = false, partial = false, expanded = false } = o;
	const { reasoning, rest } = strip(a);
	const headText = oneLine(safeText(reasoning));
	const summary = partial
		? `${DIM}running${RESET}`
		: summarize(name, r, err, rest) + (truncated(r) ? ` ${DIM}truncated${RESET}` : "");
	const detail = detailOf(name, rest);
	const line1 = `${BOLD}${name}${RESET} ${headText || detail}`;
	const line2 = headText ? `${INDENT}${DIM}${detail}${RESET} ${SEP} ${summary}` : `${INDENT}${SEP} ${summary}`;
	const lines = [line1, line2];
	if (expanded) lines.push(...expandedLines(name, rest, r, err));
	return lines;
}

export interface ResultLinesOptions {
	isPartial?: boolean;
	expanded?: boolean;
	isError?: boolean;
}

// Lines the result slot should render for a given tool state. The call slot
// owns the "running" header while partial; the result slot only contributes the
// expanded body in that case, to avoid duplicating the header.
export function resultLines(
	name: string, args: Record<string, unknown>, result: any,
	opts: ResultLinesOptions = {},
): string[] {
	const { isPartial = false, expanded = false, isError = false } = opts;
	// While partial and collapsed, the call slot already shows the running
	// header, so the result slot contributes nothing.
	if (isPartial && !expanded) return [];
	// While partial and expanded, show only the streamed body — the call slot
	// still owns the running header, so we must not duplicate it.
	if (isPartial) {
		const { rest } = strip(args);
		return expandedLines(name, rest, result, isError);
	}
	return buildBlock(name, args, result, { err: isError, expanded });
}