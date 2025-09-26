import { randomUUID } from "crypto";

export const USER_COOKIE_NAME = "calendary_user_id";
export const OAUTH_STATE_COOKIE_NAME = "calendary_oauth_state";
export const GEMINI_CONSENT_COOKIE_NAME = "calendary_gemini_consent";

export const secureCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
};

export function createUserId() {
  return randomUUID();
}

export function createStateToken() {
  return randomUUID();
}

