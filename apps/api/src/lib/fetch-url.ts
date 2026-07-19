// Fetch a URL and extract plain text content for the LLM to use as a source.
// Strips scripts/styles, decodes basic entities, collapses whitespace, caps length.

const MAX_BYTES = 200_000;
const MAX_CHARS = 20_000;
const TIMEOUT_MS = 10_000;

export interface FetchedSource {
	title: string;
	content: string;
}

export async function fetchUrlContent(url: string): Promise<FetchedSource> {
	assertSafeUrl(url);

	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
	try {
		const res = await fetchFresh(url, ctrl.signal);
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}

		// Reject content the LLM can't read (PDF, images, binaries).
		const ctype = (res.headers.get("content-type") ?? "").toLowerCase();
		if (ctype && !isTextLike(ctype)) {
			throw new Error(`unsupported content-type: ${ctype.split(";")[0]}`);
		}

		// Reject oversized payloads up front when the server advertises length.
		const clen = Number(res.headers.get("content-length") ?? "0");
		if (clen > MAX_BYTES * 4) {
			throw new Error(`content too large: ${clen} bytes`);
		}

		// workerd streams the body as Uint8Array chunks; the platform types
		// only promise ReadableStream<unknown>, so narrow it here.
		const reader = (res.body as ReadableStream<Uint8Array> | null)?.getReader();
		if (!reader) {
			return { title: url, content: "" };
		}
		const chunks: Uint8Array[] = [];
		let total = 0;
		while (total < MAX_BYTES) {
			const { value, done } = await reader.read();
			if (done) break;
			if (value) {
				chunks.push(value);
				total += value.byteLength;
			}
		}
		try {
			await reader.cancel();
		} catch {
			// ignore — best-effort cleanup
		}
		const buf = new Uint8Array(total);
		let offset = 0;
		for (const c of chunks) {
			buf.set(c, offset);
			offset += c.byteLength;
		}
		const raw = new TextDecoder("utf-8", { fatal: false }).decode(buf);

		if (ctype.includes("text/html") || /<html|<body/i.test(raw)) {
			return extractHtml(raw, url);
		}
		const trimmed = raw.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
		return { title: url, content: trimmed };
	} finally {
		clearTimeout(timer);
	}
}

// A crawl exists to refresh a snapshot, so a cached response defeats it: our
// own llms.txt serves `max-age=3600`, and a Recrawl clicked within an hour of
// a deploy would silently re-store the pre-deploy copy. Defenses, strongest
// first: (1) a unique query param — CDNs key their caches on the full URL, so
// this forces a miss on any of them; (2) `cache: "no-store"`, the
// requester-side bypass; (3) `cache-control: no-cache` request headers for
// caches that honor them. If the busted URL fails (e.g. a signed URL the extra
// param breaks), retry the original so no previously-working source regresses
// — that path can still be served stale by an edge cache, which is no worse
// than before.
async function fetchFresh(url: string, signal: AbortSignal) {
	let busted: string;
	try {
		const u = new URL(url);
		u.searchParams.set("__recrawl", crypto.randomUUID().slice(0, 8));
		busted = u.toString();
	} catch {
		return fetchBypassingCache(url, signal);
	}
	try {
		const res = await fetchBypassingCache(busted, signal);
		if (res.ok) return res;
	} catch (e) {
		if (signal.aborted) throw e;
	}
	return fetchBypassingCache(url, signal);
}

// workerd rejects the `cache` option on pre-2024-11-11 compatibility dates
// ("The 'cache' field on 'RequestInitializerDict' is not implemented") and
// rejects modes it doesn't support ("Unsupported cache mode: …") — both throw
// before any network I/O, so falling back to a plain fetch never duplicates an
// in-flight request.
async function fetchBypassingCache(url: string, signal: AbortSignal) {
	const init: RequestInit = {
		signal,
		redirect: "follow",
		headers: {
			"user-agent": "llmchat-source-fetcher/1.0",
			accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
			"cache-control": "no-cache",
			pragma: "no-cache",
		},
	};
	try {
		return await fetch(url, { ...init, cache: "no-store" });
	} catch (e) {
		if (
			e instanceof Error &&
			/the 'cache' field|unsupported cache mode/i.test(e.message)
		) {
			console.warn("[fetch-url] runtime rejected the cache option", {
				error: e.message,
			});
			return fetch(url, init);
		}
		throw e;
	}
}

function isTextLike(ctype: string): boolean {
	return (
		ctype.startsWith("text/") ||
		ctype.includes("xml") ||
		ctype.includes("json") ||
		ctype.includes("application/xhtml")
	);
}

// Block SSRF: only allow http(s) + reject loopback, link-local, RFC1918, and
// cloud metadata IPs. Hostname-only check — DNS rebinding is out of scope here.
function assertSafeUrl(input: string): void {
	let u: URL;
	try {
		u = new URL(input);
	} catch {
		throw new Error("invalid URL");
	}
	if (u.protocol !== "http:" && u.protocol !== "https:") {
		throw new Error(`unsupported protocol: ${u.protocol}`);
	}
	const host = u.hostname.toLowerCase();
	if (
		host === "localhost" ||
		host === "0.0.0.0" ||
		host.endsWith(".localhost") ||
		host.endsWith(".internal")
	) {
		throw new Error("blocked host");
	}
	// IPv4 literals — block private + loopback + link-local + metadata.
	const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (v4) {
		const [a, b] = v4.slice(1).map(Number) as [number, number, number, number];
		if (
			a === 10 ||
			a === 127 ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			a === 0
		) {
			throw new Error("blocked IP");
		}
	}
	// IPv6 loopback / link-local / unique-local.
	if (host.startsWith("[")) {
		const h = host.slice(1, -1);
		if (
			h === "::1" ||
			h.startsWith("fe80:") ||
			h.startsWith("fc") ||
			h.startsWith("fd")
		) {
			throw new Error("blocked IP");
		}
	}
}

function extractHtml(html: string, url: string): FetchedSource {
	const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	const title = decodeEntities(titleMatch?.[1]?.trim() ?? "") || url;

	const stripped = html
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/<[^>]+>/g, " ");

	const text = decodeEntities(stripped)
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_CHARS);

	return { title, content: text };
}

function decodeEntities(s: string): string {
	return s
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}
