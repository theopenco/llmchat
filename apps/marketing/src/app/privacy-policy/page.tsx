import { LegalPage } from "@/components/LegalPage";
import { pageMeta } from "@/lib/seo";

const LAST_UPDATED = "June 19, 2026";

export const metadata = pageMeta({
	title: "Privacy Policy — Clanker Support",
	description:
		"How Clanker Support collects, uses, and protects personal information across our website and AI support product.",
	path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
	return (
		<LegalPage
			title="Privacy Policy"
			lastUpdated={LAST_UPDATED}
			intro="This policy explains what information Clanker Support collects, how we use it, and the choices you have. It covers our website and the AI support product we provide."
		>
			<h2>Who we are</h2>
			<p>
				Clanker Support (&ldquo;Clanker Support,&rdquo; &ldquo;we,&rdquo;
				&ldquo;us,&rdquo; or &ldquo;our&rdquo;) provides an AI-powered customer
				support agent that businesses embed on their own websites with a single
				script tag. This policy applies to <strong>clankersupport.com</strong>,
				our dashboard, and the support widget and APIs that make up the service
				(together, the &ldquo;Service&rdquo;).
			</p>

			<h2>Two roles: controller and processor</h2>
			<p>
				We handle personal information in two distinct roles, and this matters
				for your rights:
			</p>
			<ul>
				<li>
					<strong>As a controller</strong> — for information about our own
					account holders and website visitors (for example, when you sign up,
					contact us, or browse the marketing site).
				</li>
				<li>
					<strong>As a processor</strong> — for the end-user conversations that
					flow through a customer&rsquo;s support widget. Here, our business
					customer is the controller; we process that data on their behalf and
					under their instructions. If you chatted with a widget on another
					company&rsquo;s site, please refer to that company&rsquo;s privacy
					notice and contact them to exercise your rights.
				</li>
			</ul>

			<h2>Information we collect</h2>
			<p>Depending on how you use the Service, we may collect:</p>
			<ul>
				<li>
					<strong>Account information</strong> — your name and email address
					when you create an account, plus authentication data needed to keep
					your account secure.
				</li>
				<li>
					<strong>Support content</strong> — the messages, knowledge-base text,
					and system prompts you provide, and the conversations handled by your
					support agent, including any information end users choose to share in
					a chat.
				</li>
				<li>
					<strong>Email content</strong> — when a conversation escalates, we
					process the email addresses and message content needed to deliver
					replies and thread responses back into the same conversation.
				</li>
				<li>
					<strong>Billing information</strong> — if you subscribe to a paid
					plan, payment is handled by our payment processor; we receive limited
					details such as your plan, billing status, and the last digits of your
					card. We do not store full card numbers.
				</li>
				<li>
					<strong>Usage and analytics data</strong> — pages viewed, features
					used, and similar product-analytics events, collected through our
					analytics provider (see Cookies and analytics below).
				</li>
				<li>
					<strong>Technical data</strong> — IP address, browser and device type,
					and log data generated when you use the Service, used for security and
					reliability.
				</li>
			</ul>

			<h2>How we use information</h2>
			<ul>
				<li>To provide, operate, and maintain the Service.</li>
				<li>
					To generate AI responses, route escalations, and deliver email
					replies.
				</li>
				<li>To process payments and manage subscriptions.</li>
				<li>
					To understand product usage and improve features, performance, and
					reliability.
				</li>
				<li>
					To secure the Service, prevent abuse, and troubleshoot problems.
				</li>
				<li>To communicate with you about your account or the Service.</li>
				<li>To comply with legal obligations and enforce our terms.</li>
			</ul>

			<h2>Cookies and analytics</h2>
			<p>
				We use <strong>PostHog</strong> for privacy-conscious product analytics,
				hosted in the European Union. Analytics help us understand how the
				Service is used so we can improve it. On our marketing site, visitors in
				the EU, EEA, and UK are shown a consent banner, and{" "}
				<strong>no analytics cookies are set until you accept</strong>.
				Elsewhere, analytics load on the basis of implied consent. You can
				change your choice at any time by clearing the consent stored in your
				browser.
			</p>
			<p>
				We do not use third-party advertising cookies, and we do not sell your
				personal information.
			</p>

			<h2>How we share information</h2>
			<p>
				We do not sell personal information. We share it only as needed to run
				the Service:
			</p>
			<ul>
				<li>
					<strong>Model providers via LLM Gateway</strong> — conversation
					content is sent to the AI model you select (such as OpenAI or
					Anthropic models) to generate responses.
				</li>
				<li>
					<strong>PostHog</strong> — product analytics (EU-hosted).
				</li>
				<li>
					<strong>Resend</strong> — delivery of transactional and support email.
				</li>
				<li>
					<strong>Stripe</strong> — payment processing for paid plans.
				</li>
				<li>
					<strong>Hosting and infrastructure providers</strong> — to run the
					Service on serverless edge infrastructure.
				</li>
				<li>
					<strong>Legal and safety</strong> — when required by law, or to
					protect the rights, safety, and security of users and the public.
				</li>
				<li>
					<strong>Business transfers</strong> — in connection with a merger,
					acquisition, or sale of assets, subject to this policy.
				</li>
			</ul>
			<p>
				If you self-host the Service on your own infrastructure, you control
				these data flows and choose your own providers.
			</p>

			<h2>Data retention</h2>
			<p>
				We keep personal information for as long as your account is active or as
				needed to provide the Service, and afterward only as required to comply
				with legal obligations, resolve disputes, and enforce our agreements.
				Data we process on behalf of a customer is retained according to that
				customer&rsquo;s instructions.
			</p>

			<h2>Security</h2>
			<p>
				We use reasonable technical and organizational measures to protect
				personal information, including encryption in transit and access
				controls. No method of transmission or storage is completely secure, so
				we cannot guarantee absolute security.
			</p>

			<h2>International transfers</h2>
			<p>
				We operate globally and may process information in the United States and
				other countries. Where required, we rely on appropriate safeguards for
				cross-border transfers. Product analytics are hosted in the European
				Union.
			</p>

			<h2>Your rights and choices</h2>
			<p>
				Depending on where you live, you may have the right to access, correct,
				delete, or port your personal information, and to object to or restrict
				certain processing.
			</p>
			<ul>
				<li>
					<strong>California residents</strong> — under the CCPA/CPRA you have
					the right to know what personal information we collect, to request
					deletion or correction, and to not be discriminated against for
					exercising your rights. We do not sell or share your personal
					information for cross-context behavioral advertising.
				</li>
				<li>
					<strong>EU, EEA, and UK residents</strong> — you have rights under the
					GDPR and UK GDPR, including the rights of access, rectification,
					erasure, restriction, portability, and objection, and the right to
					withdraw consent at any time.
				</li>
			</ul>
			<p>
				To exercise any of these rights, contact us at{" "}
				<a href="mailto:support@clankersupport.com">
					support@clankersupport.com
				</a>
				. If your request concerns a conversation on another company&rsquo;s
				website, please contact that company, as they control that data.
			</p>

			<h2>Children&rsquo;s privacy</h2>
			<p>
				The Service is not directed to children, and we do not knowingly collect
				personal information from children under 16. If you believe a child has
				provided us personal information, contact us and we will delete it.
			</p>

			<h2>Third-party links</h2>
			<p>
				Our site may link to third-party websites and services we do not
				control. This policy does not apply to them; please review their privacy
				notices.
			</p>

			<h2>Changes to this policy</h2>
			<p>
				We may update this policy from time to time. When we do, we will revise
				the &ldquo;last updated&rdquo; date above, and for material changes we
				will provide additional notice where appropriate.
			</p>

			<h2>Contact us</h2>
			<p>
				Questions about this policy or your personal information? Email us at{" "}
				<a href="mailto:support@clankersupport.com">
					support@clankersupport.com
				</a>
				.
			</p>
		</LegalPage>
	);
}
