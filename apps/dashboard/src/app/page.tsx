"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/lib/auth-client";

export default function Home() {
	const router = useRouter();
	const { data, isPending } = useSession();
	useEffect(() => {
		if (isPending) {
			return;
		}
		router.replace(data?.user ? "/inbox" : "/sign-in");
	}, [data, isPending, router]);
	return null;
}
