import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { getCalendarClient } from "@/lib/googleClient";
import { GEMINI_CONSENT_COOKIE_NAME, USER_COOKIE_NAME, secureCookieOptions } from "@/lib/session";
import { parseMeetingRequest } from "@/lib/emailParser";
import { proposeMeetingSlots } from "@/lib/timePlanner";
import { generateGeminiReply, isGeminiEnabled } from "@/lib/geminiClient";

type AvailabilityRequestBody = {
  emailBody: string;
  durationMinutes: number;
};

type AvailabilityResponse = {
  summary: string;
  proposedSlots: { start: string | undefined; end: string | undefined; label: string }[];
  replyDraft: string;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_COOKIE_NAME)?.value;

  if (!userId) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  let body: AvailabilityRequestBody & { useGemini?: boolean };
  try {
    body = (await request.json()) as AvailabilityRequestBody & { useGemini?: boolean };
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  if (!body.emailBody || !body.durationMinutes) {
    return NextResponse.json({ message: "Missing emailBody or duration" }, { status: 400 });
  }

  try {
    const calendar = await getCalendarClient(userId);
    const profile = await calendar.calendarList.get({ calendarId: "primary" });
    const timeZone = profile.data.timeZone ?? "UTC";

    const now = DateTime.now().setZone(timeZone);
    const windowStart = now.toISO();
    const windowEnd = now.plus({ days: 14 }).toISO();

    const freebusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: windowStart,
        timeMax: windowEnd,
        timeZone,
        items: [{ id: "primary" }],
      },
    });

    const busy = freebusy.data.calendars?.primary?.busy ?? [];

    const requestDetails = parseMeetingRequest(body.emailBody, body.durationMinutes, timeZone);

    const proposedSlots = proposeMeetingSlots(busy, {
      timeZone,
      durationMinutes: requestDetails.durationMinutes,
      windowStart,
      windowEnd,
      preferenceWindows: requestDetails.preferredDateRanges,
      timeOfDayPreferences: requestDetails.timeOfDayPreferences,
    });

    const summary = buildSummary(proposedSlots.length);
    const replyDraft = await buildReplyDraft({
      emailBody: requestDetails.notes ?? body.emailBody,
      slots: proposedSlots,
      useGemini: Boolean(body.useGemini),
      timeZone,
      durationMinutes: requestDetails.durationMinutes,
      preferenceWindows: requestDetails.preferredDateRanges,
      timeOfDayPreferences: requestDetails.timeOfDayPreferences,
    });

    if (body.useGemini) {
      // Removed cookie setting as per edit hint
    }

    const responseBody: AvailabilityResponse = {
      summary,
      proposedSlots,
      replyDraft,
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("Failed to fetch availability", error);
    return NextResponse.json({ message: "Failed to query calendar" }, { status: 500 });
  }
}

async function buildReplyDraft(params: {
  emailBody: string;
  slots: { label: string; start?: string; end?: string }[];
  useGemini: boolean;
  timeZone: string;
  durationMinutes: number;
  preferenceWindows?: { start: string; end: string }[];
  timeOfDayPreferences?: ("morning" | "afternoon" | "evening")[];
}) {
  const { emailBody, slots, useGemini } = params;

  if (!useGemini || !isGeminiEnabled()) {
    return buildFallbackReply({ emailBody, slots });
  }

  try {
    const aiReply = await generateGeminiContent(params);
    if (aiReply) {
      const cookieStore = await cookies();
      cookieStore.set(GEMINI_CONSENT_COOKIE_NAME, "true", secureCookieOptions);
      return aiReply;
    }
  } catch (error) {
    console.error("Gemini request failed", error);
  }

  return buildFallbackReply({ emailBody, slots });
}

function buildFallbackReply({
  emailBody,
  slots,
}: {
  emailBody: string;
  slots: { label: string }[];
}) {
  const bulletList = slots.map((slot) => `• ${slot.label}`).join("\n");
  return `Thanks for reaching out!\n\nHere are a few times that work well for me:\n${bulletList}\n\nLet me know if any of these work or if you need other options.\n\n${truncateOriginal(emailBody)}`;
}

async function generateGeminiContent(params: {
  emailBody: string;
  timeZone: string;
  durationMinutes: number;
  slots: { label: string; start?: string; end?: string }[];
  preferenceWindows?: { start: string; end: string }[];
  timeOfDayPreferences?: ("morning" | "afternoon" | "evening")[];
}) {
  const { emailBody, timeZone, durationMinutes, slots } = params;

  const bulletList = slots
    .map((slot, index) => `Option ${index + 1}: ${slot.label}`)
    .join("\n");

  const prompt = `Draft a short, professional meeting reply. Mention appreciation, present these options, and ask the recipient to confirm or suggest alternatives.

Meeting duration: ${durationMinutes} minutes
Timezone: ${timeZone}
Options:
${bulletList}

Original email:
"""
${emailBody}
"""`;

  const aiReply = await generateGeminiReply(prompt);
  return aiReply?.trim();
}

function truncateOriginal(text: string) {
  const trimmed = text.trim();
  if (trimmed.length <= 400) {
    return trimmed;
  }
  return `${trimmed.slice(0, 400)}…`;
}

function buildSummary(slotCount: number) {
  if (slotCount === 0) {
    return "I could not find any open slots over the next two weeks.";
  }
  if (slotCount === 1) {
    return "I found one available time option.";
  }
  return `I found ${slotCount} available time options over the next two weeks.`;
}

