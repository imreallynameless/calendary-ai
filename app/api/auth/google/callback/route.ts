import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/googleClient";
import { OAUTH_STATE_COOKIE_NAME, secureCookieOptions } from "@/lib/session";

type StatePayload = {
  userId: string;
  state: string;
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

function redirectToError(message: string) {
  return NextResponse.redirect(`${BASE_URL}/auth/error?message=${encodeURIComponent(message)}`);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value;

  if (error) {
    cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
    return redirectToError(error);
  }

  if (!code || !stateParam) {
    return redirectToError("missing code or state");
  }

  if (!storedState) {
    return redirectToError("session expired");
  }

  let state: StatePayload;
  try {
    state = JSON.parse(stateParam) as StatePayload;
  } catch {
    cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
    return redirectToError("invalid state");
  }

  if (state.state !== storedState) {
    cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
    return redirectToError("state mismatch");
  }

  try {
    await exchangeCodeForTokens(code, state.userId);
    cookieStore.delete(OAUTH_STATE_COOKIE_NAME, secureCookieOptions);
  } catch (callbackError) {
    cookieStore.delete(OAUTH_STATE_COOKIE_NAME, secureCookieOptions);
    return redirectToError((callbackError as Error).message ?? "invalid grant");
  }

  return NextResponse.redirect(`${BASE_URL}/`);
}

