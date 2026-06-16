import { z } from "zod";

// Mirrors the API's Better Auth rules (min 8 / max 128, no composition rules)
// so the client surfaces the same errors inline before the request.
export const signUpSchema = z.object({
	name: z.string().trim().max(200).optional(),
	email: z.email("Enter a valid email address"),
	password: z
		.string()
		.min(8, "Use at least 8 characters")
		.max(128, "Password is too long"),
});

export const signInSchema = z.object({
	email: z.email("Enter a valid email address"),
	password: z.string().min(1, "Enter your password"),
});

export type SignUpValues = z.infer<typeof signUpSchema>;
export type SignInValues = z.infer<typeof signInSchema>;

/** First error message per field, for inline display under inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
	const out: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path[0]?.toString() ?? "form";
		out[key] ??= issue.message;
	}
	return out;
}
