// URL guard for the lean web tools.
//
// Design: a literal-IP denylist only. We never resolve DNS, so the whole class
// of "domain resolves to a private IP" / fake-IP-proxy failures can't happen.
// This is the deliberate opposite of pi-web-access's validateRemoteUrl, which
// resolves DNS and blocks fake-IP ranges — the source of the bug that started
// this package. Local single-user agents don't need DNS-based SSRF protection;
// they need a small guard against the model poking its own host.

export type GuardResult = { ok: true } | { ok: false; reason: string };

const BLOCKED_HOSTS = new Set(["localhost", "0.0.0.0"]);
const isIpv4Literal = (h: string): boolean => /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
const isLoopbackIpv4 = (ip: string): boolean => ip.startsWith("127.");
const isLinkLocalIpv4 = (ip: string): boolean => ip.startsWith("169.254.");

/** Strip the brackets URL may keep on an IPv6 literal, so "::1" and "[::1]" match. */
const ipv6Host = (h: string): string => h.replace(/^\[|\]$/g, "");

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

	const host = url.hostname.toLowerCase();
	if (BLOCKED_HOSTS.has(host)) return { ok: false, reason: "host is blocked" };

	const v6 = ipv6Host(host);
	if (v6 === "::1") return { ok: false, reason: "host is blocked" };

	if (isIpv4Literal(host)) {
		if (isLoopbackIpv4(host) || isLinkLocalIpv4(host)) {
			return { ok: false, reason: "host is blocked" };
		}
	}

	return { ok: true };
}