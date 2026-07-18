// HTML → markdown extraction for the lean web tools.
//
// Stack is the proven one (also used by pi-web-access, lobehub, deer-flow):
// linkedom parses the HTML, @mozilla/readability extracts the main article,
// turndown converts that to markdown. The only divergence from pi-web-access
// is the fallback: when Readability finds no article (short pages, fragments),
// we convert the whole body instead of erroring, so a fetch still returns text.

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

const turndown = new TurndownService({
	headingStyle: "atx",
	codeBlockStyle: "fenced",
});

export interface Extracted {
	title: string;
	markdown: string;
}

export function htmlToMarkdown(html: string, _url: string): Extracted {
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

	let markdown = "";
	try {
		markdown = contentHtml ? turndown.turndown(contentHtml) : "";
	} catch {
		markdown = "";
	}

	return { title: title ?? "", markdown };
}