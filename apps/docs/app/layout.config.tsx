import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

const dashboardUrl =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

export const baseOptions: BaseLayoutProps = {
	nav: {
		url: "/",
		title: (
			<>
				<svg
					viewBox="0 0 24 24"
					fill="currentColor"
					xmlns="http://www.w3.org/2000/svg"
					className="h-5 w-5 text-indigo-500"
					aria-hidden
				>
					<path d="M12 3c-4.97 0-9 3.582-9 8 0 2.208 1.008 4.207 2.639 5.654L5 21l4.174-1.61c.895.237 1.844.36 2.826.36 4.97 0 9-3.582 9-8s-4.03-8-9-8Zm-4 9.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm4 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm4 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z" />
				</svg>
				Clanker Support
			</>
		),
	},
	githubUrl: "https://github.com/theopenco/llmchat",
	links: [
		{
			text: "Dashboard",
			url: dashboardUrl,
			active: "none",
		},
	],
};
