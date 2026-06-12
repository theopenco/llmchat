"use client";

import { useEffect, useState } from "react";

import { CANONICAL_DASHBOARD_URL, dashboardUrl } from "@/lib/api-url";

/**
 * Link to the dashboard that matches the current deployment (localhost,
 * canonical, or Ploy preview). Starts from the canonical url so server and
 * first client render agree, then corrects itself after mount.
 */
export function DashboardLink() {
	const [href, setHref] = useState(CANONICAL_DASHBOARD_URL);

	useEffect(() => {
		setHref(dashboardUrl());
	}, []);

	return <a href={href}>{href.replace(/^https?:\/\//, "")}</a>;
}
