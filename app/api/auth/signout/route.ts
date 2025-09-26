import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteToken } from "@/lib/tokenStore";
import { USER_COOKIE_NAME, OAUTH_STATE_COOKIE_NAME } from "@/lib/session";

export async function POST() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (userId) {
    await deleteToken(userId);
  }

  cookieStore.delete(USER_COOKIE_NAME);
  cookieStore.delete(OAUTH_STATE_COOKIE_NAME);

  return NextResponse.json({ ok: true });
}

