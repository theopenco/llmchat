import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
	const url = new URL(request.url);

	if (url.searchParams.get("shop")) {
		throw redirect(`/app?${url.searchParams.toString()}`);
	}

	return { showForm: true };
};

export default function App() {
	const { showForm } = useLoaderData<typeof loader>();

	return (
		<div className={styles.index}>
			<div className={styles.content}>
				<h1 className={styles.heading}>Clanker Support for Shopify</h1>
				<p className={styles.text}>
					A support agent for your storefront — it answers customer questions
					from your own docs and pages, and hands the conversation to your team
					the moment it can&apos;t help.
				</p>
				{showForm && (
					<Form className={styles.form} method="post" action="/auth/login">
						<label className={styles.label}>
							<span>Shop domain</span>
							<input className={styles.input} type="text" name="shop" />
							<span>e.g: my-shop-domain.myshopify.com</span>
						</label>
						<button className={styles.button} type="submit">
							Log in
						</button>
					</Form>
				)}
				<ul className={styles.list}>
					<li>
						<strong>Answers from your knowledge base</strong>. Replies come from
						the docs, pages, and Q&amp;A you connect — not canned scripts.
					</li>
					<li>
						<strong>Escalates to your team</strong>. Unresolved conversations
						land in your inbox with full context, and your replies thread back
						to the shopper by email.
					</li>
					<li>
						<strong>Order help, done safely</strong>. Shoppers can check their
						own order or start a return — verified against the email on the
						order, rate-limited, and every action logged for your team.
					</li>
				</ul>
			</div>
		</div>
	);
}
