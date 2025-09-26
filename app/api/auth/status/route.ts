import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readToken } from "@/lib/tokenStore";
import { GEMINI_CONSENT_COOKIE_NAME, USER_COOKIE_NAME } from "@/lib/session";
import { isGeminiEnabled } from "@/lib/geminiClient";

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_COOKIE_NAME)?.value;
  const consent = cookieStore.get(GEMINI_CONSENT_COOKIE_NAME)?.value === "true";

  if (!userId) {
    return NextResponse.json({
      authenticated: false,
      gemini: { available: isGeminiEnabled(), consent },
    });
  }

  const token = await readToken(userId);
  return NextResponse.json({
    authenticated: Boolean(token),
    gemini: { available: isGeminiEnabled(), consent },
  });
}

