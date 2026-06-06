"use client";

import { useEffect } from "react";
import { track, type AnalyticsProps } from "@/lib/analytics";

/** Fires an analytics event once when the page mounts. */
export function TrackView({
	event,
	props,
}: {
	event: string;
	props?: AnalyticsProps;
}) {
	useEffect(() => {
		track(event, props);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [event]);

	return null;
}
