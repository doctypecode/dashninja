import { sleep, uid } from "@/lib/utils";
import { AuthError, type AuthAdapter, type AuthUser, type Session } from "./types";

/**
 * DEMO authentication adapter — not for production.
 *
 * - Accounts live in this browser's localStorage. Passwords are SHA-256 hashed
 *   client-side, which is NOT a secure password store.
 * - No email is sent. Verification and reset links are returned to the UI and
 *   shown as "demo links".
 * - "Continue with Google" simulates an OAuth round trip without contacting Google.
 * - The session is mirrored into a non-HttpOnly `dn_session` cookie so the
 *   Next.js proxy can redirect signed-out visitors. A real adapter should use a
 *   signed, HttpOnly cookie set by the server.
 */

const USERS_KEY = "dashninja:auth:users";
const SESSION_KEY = "dashninja:auth:session";
const COOKIE = "dn_session";

interface StoredUser extends AuthUser {
  passwordHash: string | null;
  verificationToken?: string;
  resetToken?: string;
}

export const DEMO_CREDENTIALS = { email: "demo@example.com", password: "dashninja" };

async function hash(password: string): Promise<string> {
  const data = new TextEncoder().encode(`dashninja:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

const listeners = new Set<() => void>();
let cachedSession: Session | null | undefined;

function emit() {
  cachedSession = undefined;
  listeners.forEach((l) => l());
}

async function loadUsers(): Promise<StoredUser[]> {
  const users = safeGet<StoredUser[]>(USERS_KEY, []);
  if (!users.some((u) => u.email === DEMO_CREDENTIALS.email)) {
    users.push({
      id: "user_demo",
      name: "Demo User",
      email: DEMO_CREDENTIALS.email,
      provider: "password",
      emailVerified: true,
      passwordHash: await hash(DEMO_CREDENTIALS.password),
    });
    safeSet(USERS_KEY, users);
  }
  return users;
}

function saveUsers(users: StoredUser[]) {
  safeSet(USERS_KEY, users);
}

function startSession(user: StoredUser): Session {
  const { passwordHash: _p, verificationToken: _v, resetToken: _r, ...publicUser } = user;
  const session: Session = { user: publicUser, createdAt: new Date().toISOString() };
  safeSet(SESSION_KEY, session);
  document.cookie = `${COOKIE}=${encodeURIComponent(user.id)}; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax`;
  emit();
  return session;
}

function token() {
  return uid("tok").slice(4);
}

export const demoAuthAdapter: AuthAdapter = {
  isDemo: true,

  getSession() {
    if (typeof window === "undefined") return null;
    if (cachedSession === undefined) {
      const s = safeGet<Session | null>(SESSION_KEY, null);
      const hasCookie = document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`));
      cachedSession = s && hasCookie ? s : null;
    }
    return cachedSession;
  },

  subscribe(listener) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => e.key === SESSION_KEY && emit();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },

  async signIn({ email, password }) {
    await sleep(600);
    const users = await loadUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || !user.passwordHash || user.passwordHash !== (await hash(password))) {
      throw new AuthError("invalid_credentials", "Email or password is incorrect.");
    }
    if (!user.emailVerified) {
      throw new AuthError("email_unverified", "Verify your email address before signing in.", "email");
    }
    return startSession(user);
  },

  async signUp({ name, email, password }) {
    await sleep(700);
    const users = await loadUsers();
    const normalized = email.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === normalized)) {
      throw new AuthError("email_taken", "An account with this email already exists.", "email");
    }
    if (password.length < 8) throw new AuthError("weak_password", "Use at least 8 characters.", "password");
    const verificationToken = token();
    users.push({
      id: uid("user"),
      name: name.trim(),
      email: normalized,
      provider: "password",
      emailVerified: false,
      passwordHash: await hash(password),
      verificationToken,
    });
    saveUsers(users);
    return { email: normalized, verificationToken };
  },

  async signInWithGoogle() {
    await sleep(900);
    const users = await loadUsers();
    let user = users.find((u) => u.provider === "google");
    if (!user) {
      user = {
        id: uid("user"),
        name: "Google Demo User",
        email: "google.demo@example.com",
        provider: "google",
        emailVerified: true,
        passwordHash: null,
      };
      users.push(user);
      saveUsers(users);
    }
    return startSession(user);
  },

  async signOut() {
    await sleep(150);
    safeSet(SESSION_KEY, null);
    document.cookie = `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    emit();
  },

  async requestPasswordReset(email) {
    await sleep(600);
    const users = await loadUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    // Respond identically whether or not the account exists (no account enumeration).
    if (!user || user.provider !== "password") return {};
    user.resetToken = token();
    saveUsers(users);
    return { resetToken: `${user.id}.${user.resetToken}` };
  },

  async resetPassword({ token: t, password }) {
    await sleep(600);
    if (password.length < 8) throw new AuthError("weak_password", "Use at least 8 characters.", "password");
    const users = await loadUsers();
    const [id, secret] = t.split(".");
    const user = users.find((u) => u.id === id && u.resetToken && u.resetToken === secret);
    if (!user) throw new AuthError("invalid_token", "This reset link is invalid or has already been used.");
    user.passwordHash = await hash(password);
    user.resetToken = undefined;
    saveUsers(users);
  },

  async verifyEmail(t) {
    await sleep(700);
    const users = await loadUsers();
    const user = users.find((u) => u.verificationToken && u.verificationToken === t);
    if (!user) throw new AuthError("invalid_token", "This verification link is invalid or has expired.");
    user.emailVerified = true;
    user.verificationToken = undefined;
    saveUsers(users);
    return startSession(user);
  },

  async resendVerification(email) {
    await sleep(500);
    const users = await loadUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.emailVerified) return {};
    user.verificationToken = token();
    saveUsers(users);
    return { verificationToken: user.verificationToken };
  },
};
