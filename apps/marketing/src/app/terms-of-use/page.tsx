import { LegalPage } from "@/components/LegalPage";
import { pageMeta } from "@/lib/seo";

const LAST_UPDATED = "June 19, 2026";

export const metadata = pageMeta({
	title: "Terms of Use — Clanker Support",
	description:
		"The terms that govern your access to and use of Clanker Support's website, dashboard, and AI support product.",
	path: "/terms-of-use",
});

export default function TermsOfUsePage() {
	return (
		<LegalPage
			title="Terms of Use"
			lastUpdated={LAST_UPDATED}
			intro="These terms govern your access to and use of Clanker Support. By using the Service, you agree to them. Please read them carefully."
		>
			<h2>1. Agreement to these terms</h2>
			<p>
				These Terms of Use (&ldquo;Terms&rdquo;) form a binding agreement
				between you and Clanker Support (&ldquo;Clanker Support,&rdquo;
				&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) regarding your
				use of <strong>clankersupport.com</strong>, our dashboard, and the
				support widget and APIs we provide (together, the
				&ldquo;Service&rdquo;). If you use the Service on behalf of an
				organization, you represent that you are authorized to accept these
				Terms for that organization.
			</p>

			<h2>2. Definitions</h2>
			<ul>
				<li>
					<strong>Customer</strong> — a person or organization with an account
					that uses the Service.
				</li>
				<li>
					<strong>End User</strong> — a visitor who interacts with a
					Customer&rsquo;s support widget.
				</li>
				<li>
					<strong>Customer Content</strong> — the knowledge-base text, system
					prompts, configuration, and other material a Customer provides to the
					Service.
				</li>
			</ul>

			<h2>3. Eligibility and accounts</h2>
			<p>
				You must be at least 16 years old to use the Service. You are
				responsible for the accuracy of your account information, for keeping
				your credentials secure, and for all activity under your account. Notify
				us promptly of any unauthorized use.
			</p>

			<h2>4. The Service</h2>
			<p>
				The Service lets Customers deploy an AI support agent that answers from
				Customer Content, escalates conversations to a human inbox, threads
				replies over email, and runs on a model the Customer selects. We may
				add, change, or remove features over time.
			</p>

			<h2>5. Acceptable use</h2>
			<p>You agree not to:</p>
			<ul>
				<li>Use the Service to violate any law or the rights of others.</li>
				<li>
					Upload or transmit unlawful, harmful, infringing, or deceptive
					content.
				</li>
				<li>
					Attempt to disrupt, reverse engineer, or gain unauthorized access to
					the Service or its infrastructure.
				</li>
				<li>
					Use the Service to send spam or to collect personal information
					without a lawful basis and proper notice.
				</li>
				<li>
					Resell or provide the Service to third parties except as expressly
					permitted.
				</li>
			</ul>

			<h2>6. Customer Content and responsibilities</h2>
			<p>
				You retain ownership of your Customer Content. You grant us a limited
				license to host, process, and use it solely to operate and improve the
				Service for you. You are responsible for your Customer Content and your
				End User data, including having any required notices and consents in
				place and providing your own privacy notice to your End Users. You
				determine what content your support agent draws on and how it is
				configured.
			</p>

			<h2>7. AI output</h2>
			<p>
				The Service uses AI models to generate responses. AI output can be
				inaccurate or incomplete and should not be treated as professional
				advice. While the agent is designed to answer from your content and to
				defer when it is unsure, we do not warrant that responses will be
				correct or suitable for any purpose. You are responsible for reviewing
				AI behavior and configuring escalation appropriately for your use case.
			</p>

			<h2>8. Third-party services</h2>
			<p>
				The Service relies on third-party providers, including model providers
				accessed through LLM Gateway, email delivery, analytics, payment
				processing, and hosting. Your use of the Service may be subject to those
				providers&rsquo; terms, and we are not responsible for their acts or
				omissions.
			</p>

			<h2>9. Fees and billing</h2>
			<p>
				Paid plans are billed through our payment processor according to the
				pricing presented at sign-up, which may include usage-based charges.
				Unless stated otherwise, fees are non-refundable, exclusive of taxes,
				and may change with notice. Failure to pay may result in suspension or
				termination of paid features.
			</p>

			<h2>10. Intellectual property</h2>
			<p>
				The Service, including its software, design, and content (excluding
				Customer Content), is owned by Clanker Support and its licensors and is
				protected by intellectual-property laws. These Terms do not grant you
				any rights in our trademarks or branding.
			</p>

			<h2>11. Privacy</h2>
			<p>
				Our <a href="/privacy-policy">Privacy Policy</a> explains how we handle
				personal information and is incorporated into these Terms by reference.
			</p>

			<h2>12. Disclaimers</h2>
			<p>
				The Service is provided &ldquo;as is&rdquo; and &ldquo;as
				available,&rdquo; without warranties of any kind, whether express or
				implied, including warranties of merchantability, fitness for a
				particular purpose, and non-infringement. We do not warrant that the
				Service will be uninterrupted, secure, or error-free.
			</p>

			<h2>13. Limitation of liability</h2>
			<p>
				To the fullest extent permitted by law, Clanker Support will not be
				liable for any indirect, incidental, special, consequential, or punitive
				damages, or for any loss of profits, revenue, data, or goodwill. Our
				total liability for any claim relating to the Service will not exceed
				the amount you paid us for the Service in the twelve months before the
				event giving rise to the claim.
			</p>

			<h2>14. Indemnification</h2>
			<p>
				You agree to indemnify and hold harmless Clanker Support from claims,
				damages, and expenses arising out of your Customer Content, your End
				User data, or your use of the Service in violation of these Terms or
				applicable law.
			</p>

			<h2>15. Termination</h2>
			<p>
				You may stop using the Service at any time. We may suspend or terminate
				your access if you violate these Terms or to protect the Service. On
				termination, your right to use the Service ends; sections that by their
				nature should survive will survive.
			</p>

			<h2>16. Changes to these terms</h2>
			<p>
				We may update these Terms from time to time. When we do, we will revise
				the &ldquo;last updated&rdquo; date above, and for material changes we
				will provide additional notice where appropriate. Continued use of the
				Service after changes take effect means you accept the revised Terms.
			</p>

			<h2>17. Governing law</h2>
			<p>
				These Terms are governed by the laws of the State of California, without
				regard to its conflict-of-laws rules. You agree to the exclusive
				jurisdiction of the state and federal courts located in California for
				any dispute that is not otherwise subject to an alternative resolution
				process.
			</p>

			<h2>18. Contact us</h2>
			<p>
				Questions about these Terms? Email us at{" "}
				<a href="mailto:support@clankersupport.com">
					support@clankersupport.com
				</a>
				.
			</p>
		</LegalPage>
	);
}
