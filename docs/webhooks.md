# Webhook Design Notes

This document sketches how Calendary AI can react to calendar or email changes in near real-time while preserving privacy guarantees.

## Goals

- Reflect calendar updates (new holds, cancellations, attendee responses) so proposed time slots stay accurate.
- Detect new inbound meeting requests without manual copy/paste in future iterations.
- Keep sensitive content local or redacted, and validate webhook authenticity.

## Calendar Webhooks (Google Calendar)

### Registration

- Use Google Calendar push notifications via the `watch` endpoint on `calendar.events` (event-level detail needed for adds/updates).
- Each user session registers a **channel** specifying:
  - `id`: random UUID (stored alongside token).
  - `type`: `web_hook`.
  - `address`: webhook URL (e.g., `https://your-domain.com/api/webhooks/google/calendar`).
  - `token`: signed secret (HMAC) to validate authenticity.
  - `params`: `ttl` if desired (default is ~1 day).
- Persist channel metadata with the user’s refresh token so we can renew or stop the channel later.

### Endpoint Handling

1. Receive POST from Google containing `X-Goog-Channel-ID`, `X-Goog-Resource-ID`, `X-Goog-Resource-State`, etc. (body is empty).
2. Validate headers:
   - Channel ID/token matches stored values.
   - Resource state within allowed set (`exists`, `sync`, `not_exists`).
3. Enqueue a background job to fetch updates using the Calendar API:
   - Use stored `syncToken` with `events.list` for incremental changes.
   - Minimize fields: `start`, `end`, `status`.
4. Update local cache of busy intervals and invalidate conflicting proposed slots.
5. Optionally notify frontend via WebSocket/SSE that availability changed.

### Renewal & Cleanup

- Channels expire after ~24 hours; schedule renewal using stored expiration.
- When user revokes access or signs out, call `channels.stop` to clean up.

### Privacy Considerations

- Avoid storing event summaries/attendees; free/busy data is sufficient.
- Encrypt channel metadata and sync tokens at rest.
- Enforce HTTPS and validate HMAC token for webhook endpoint.

## Email Webhooks

### Options

1. **Gmail Push Notifications (Pub/Sub)**
   - Requires Google Cloud Pub/Sub topic & subscription per user.
   - Notification contains label IDs; follow-up Gmail API call needed to read content.
2. **Microsoft Graph** (for Outlook)
   - Subscribe to `/me/messages` with webhook endpoint; similar validation required.
3. **Fallback**
   - IMAP IDLE or polling (less real-time, more resource-heavy).

Given privacy constraints, prefer processing within user-controlled infrastructure. For a hosted demo, we can:

- Subscribe to a “meeting requests” label/folder.
- On notification, fetch the email (metadata or minimal format).
- Parse locally to extract constraints and discard body afterward.

### Gmail Webhook Flow Example

1. Receive Pub/Sub push with JWT envelope.
2. Validate JWT signature & topic.
3. Decode base64 `message.data` to obtain Gmail `historyId`.
4. Call Gmail API `users.history.list` to fetch new messages with the target label.
5. Parse each message, derive meeting constraints, and optionally notify the UI.

### Privacy Strategies

- Request minimal payload (`format=metadata` or selective headers).
- Redact or hash participant emails when storing derived data.
- Implement retention policy (e.g., auto-delete derived notes after 24 hours).

## Failure Handling & Retries

- Implement exponential backoff; Google retries for limited time.
- Log metadata only (channel ID, resource state) with no personal content.
- Surface errors in UI so user can re-authenticate or re-enable webhooks.

## Next Steps

- Implement `app/api/webhooks/google/calendar/route.ts` with validation and job dispatch.
- Extend token storage schema to track channel ID, resource ID, expiration, and sync token.
- Explore a lightweight job queue (`bull`, `piscina`, or serverless cron) for webhook processing.
- Document user-facing controls for enabling/disabling webhooks and revoking access.
