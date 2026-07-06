// Configure the seeded demo project's integrations THROUGH the real API
// (sign in as the seeded admin, then PUT both integration configs with
// apiBase pointed at the local mock upstream).
const API = "http://localhost:8787";
const MOCK = "http://127.0.0.1:9099";

async function main() {
	// Better Auth email+password sign-in → session cookie.
	const signIn = await fetch(`${API}/api/auth/sign-in/email`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "http://localhost:3001",
		},
		body: JSON.stringify({
			email: "admin@example.com",
			password: "admin@example.com",
		}),
	});
	if (!signIn.ok) throw new Error(`sign-in failed: ${signIn.status}`);
	const cookie = signIn.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");

	const authed = (path, init = {}) =>
		fetch(`${API}${path}`, {
			...init,
			headers: {
				cookie,
				origin: "http://localhost:3001",
				"content-type": "application/json",
				...init.headers,
			},
		});

	const { workspaces } = await (await authed("/api/workspaces")).json();
	const ws = workspaces[0].workspace ?? workspaces[0];
	const { projects } = await (
		await authed("/api/projects", { headers: { "x-workspace-id": ws.id } })
	).json();
	const project = projects.find((p) => p.publicKey === "local-dev-key");
	if (!project) throw new Error("seeded demo project not found");
	console.log(`workspace=${ws.id} project=${project.id}`);

	const putIntegration = async (kind, config) => {
		const res = await authed(
			`/api/projects/${project.id}/integrations/${kind}`,
			{
				method: "PUT",
				headers: { "x-workspace-id": ws.id },
				body: JSON.stringify({ enabled: true, config }),
			},
		);
		console.log(kind, res.status, await res.text());
		if (!res.ok) throw new Error(`${kind} PUT failed`);
	};

	await putIntegration("calcom", {
		apiKey: "cal_demo_key",
		eventTypeId: 42,
		timeZone: "UTC",
		apiBase: MOCK,
	});
	await putIntegration("shopify", {
		shopDomain: "acme-tools.myshopify.com",
		accessToken: "shpat_demo_token",
		apiBase: MOCK,
	});

	const list = await (
		await authed(`/api/projects/${project.id}/integrations`, {
			headers: { "x-workspace-id": ws.id },
		})
	).json();
	console.log("configured:", JSON.stringify(list, null, 1));
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
