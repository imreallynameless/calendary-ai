import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getOAuthConsentUrl } from "@/lib/googleClient";
import {
  createStateToken,
  createUserId,
  secureCookieOptions,
  USER_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
} from "@/lib/session";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

export async function GET() {
  const cookieStore = await cookies();

  let userId = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!userId) {
    userId = createUserId();
    cookieStore.set(USER_COOKIE_NAME, userId, secureCookieOptions);
  }

  const state = createStateToken();
  cookieStore.set(OAUTH_STATE_COOKIE_NAME, state, secureCookieOptions);

  const url = await getOAuthConsentUrl(SCOPES, JSON.stringify({ userId, state }));
  return NextResponse.redirect(url);
}

