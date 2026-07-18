// HTML → markdown extraction for the lean web tools.
//
// Stack is the proven one (also used by pi-web-access, lobehub, deer-flow):
// linkedom parses the HTML, @mozilla/readability extracts the main article,
// turndown converts that to markdown. Two divergences from pi-web-access:
//   - fallback: when Readability finds no article, convert the whole body
//     instead of erroring, so a fetch still returns text;
//   - links: relative href/src are absolutized against the page's final URL,
//     so the model gets links it can actually fetch again.

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

export interface Extracted {
	title: string;
	markdown: string;
}

type AttrNode = { getAttribute(name: string): string | null };

/** Resolve a possibly-relative URL against the page base; pass through on failure. */
function resolveUrl(rel: string | null, base: URL | null): string {
	if (!rel || !base) return rel ?? "";
	try {
		return new URL(rel, base).href;
	} catch {
		return rel;
	}
}

export function htmlToMarkdown(html: string, url: string): Extracted {
	let document: ReturnType<typeof parseHTML>["document"];
	try {
		document = parseHTML(html).document;
	} catch {
		return { title: "", markdown: "" };
	}

	// Capture the pristine title and body before Readability mutates the document.
	let title = "";
	let fallbackHtml = "";
	try {
		title = document.title ?? "";
		fallbackHtml = document.body?.innerHTML ?? "";
	} catch {}

	let contentHtml = "";
	try {
		const article = new Readability(document as unknown as Document).parse();
		if (article && article.content) {
			title = article.title || title;
			contentHtml = article.content;
		} else {
			contentHtml = fallbackHtml;
		}
	} catch {
		contentHtml = fallbackHtml;
	}

	let base: URL | null = null;
	try {
		base = url ? new URL(url) : null;
	} catch {}

	const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
	turndown.addRule("absoluteLinks", {
		filter: ["a"],
		replacement: (content, node) => {
			const href = (node as AttrNode).getAttribute("href");
			if (!href) return content;
			return `[${content}](${resolveUrl(href, base)})`;
		},
	});
	turndown.addRule("absoluteImages", {
		filter: ["img"],
		replacement: (_content, node) => {
			const el = node as AttrNode;
			const src = el.getAttribute("src");
			const alt = el.getAttribute("alt") ?? "";
			if (!src) return alt;
			return `![${alt}](${resolveUrl(src, base)})`;
		},
	});

	let markdown = "";
	try {
		markdown = contentHtml ? turndown.turndown(contentHtml) : "";
	} catch {
		markdown = "";
	}

	return { title: title ?? "", markdown };
}