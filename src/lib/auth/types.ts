export interface AuthUser {
  id: string;
  name: string;
  email: string;
  provider: "password" | "google";
  emailVerified: boolean;
}

export interface Session {
  user: AuthUser;
  createdAt: string;
}

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_taken"
  | "email_unverified"
  | "invalid_token"
  | "weak_password"
  | "network";

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public field?: "email" | "password" | "name",
  ) {
    super(message);
  }
}

/**
 * Contract for authentication providers. Swap the demo adapter for a real one
 * (Auth.js, Clerk, Supabase, a custom API…) by implementing this interface and
 * returning it from getAuthAdapter().
 */
export interface AuthAdapter {
  readonly isDemo: boolean;
  getSession(): Session | null;
  subscribe(listener: () => void): () => void;
  signIn(input: { email: string; password: string }): Promise<Session>;
  signUp(input: { name: string; email: string; password: string }): Promise<{ email: string; verificationToken?: string }>;
  signInWithGoogle(): Promise<Session>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<{ resetToken?: string }>;
  resetPassword(input: { token: string; password: string }): Promise<void>;
  verifyEmail(token: string): Promise<Session>;
  resendVerification(email: string): Promise<{ verificationToken?: string }>;
}
