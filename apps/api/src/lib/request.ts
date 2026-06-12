/** Best-effort client IP for rate-limit keys (workerd sits behind a proxy). */
export function clientIp(c: {
	req: { header(name: string): string | undefined };
}): string {
	return (
		c.req.header("cf-connecting-ip") ??
		c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
		"unknown"
	);
}
