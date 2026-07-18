// URL guard for the lean web tools.
//
// Scope: scheme + validity only. There is NO SSRF protection here by design.
// A literal-IP denylist can't be complete without DNS resolution (which is
// exactly the failure class we removed), and a local single-user agent's
// threat model doesn't require it. Network access policy is the runtime or
// sandbox's job, not the content adapter's. This guard only stops non-http
// schemes and garbage input from reaching the network.

export type GuardResult = { ok: true } | { ok: false; reason: string };

export function guardUrl(raw: string): GuardResult {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return { ok: false, reason: "invalid URL" };
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return { ok: false, reason: "only http and https URLs are allowed" };
	}
	return { ok: true };
}