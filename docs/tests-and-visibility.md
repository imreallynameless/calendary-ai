# Optional Enhancements: Visibility Panel & Tests

## “What I Can See and Why” Panel

### Goal

Increase user trust by surfacing exactly what data the assistant ingests, how long it is retained, and why it is needed.

### Concept

- Add a sidebar or modal accessible from the chat interface (e.g., “Privacy & Access”).
- Display a checklist of data categories with brief rationale:
  - Email contents (only when pasted, discarded after response generation).
  - Google Calendar busy intervals (fetched via `freebusy.query`, not stored).
  - OAuth tokens (encrypted locally for refresh).
- Provide quick actions:
  - Revoke calendar access (link to Google security settings).
  - Clear conversation history (reset local state).
  - Download audit of last generated reply (optional future feature).

### Implementation Notes

- Use Mantine/MUI Drawer or Dialog component triggered from the header.
- Content derived from README/Privacy model; ensure UI stays in sync with documentation.
- Consider adding session-level analytics (locally) so the panel can confirm “No data sent to third parties.”

## Unit Tests for Time Proposal Logic

### Scope

- Validate `timePlanner` utility against business rules:
  - Avoid overlapping busy slots.
  - Respect requested duration and working hours.
  - Handle timezone offsets consistently.
  - Skip slots outside preferred date range extracted from email.

### Testing Strategy

- Create `lib/timePlanner.test.ts` using Vitest or Jest (Next.js supports both).
- Mock calendar busy data and email-derived constraints.
- Include edge cases:
  - All-day events blocking scheduling window.
  - Meetings crossing midnight/timezone boundaries.
  - Request specifying multiple preferred days.
- Ensure deterministic outputs (sort candidate slots, use fixed reference date).

### Tooling

- Add testing library (e.g., `vitest`, `@testing-library/react`, `@testing-library/jest-dom`) if not already present.
- Update `package.json` scripts (`"test": "vitest run"`, `"test:watch": "vitest"`).

## Recommendation

- **Panel**: Medium effort, high UX value; implement once core flows are stable.
- **Tests**: High importance for reliability; prioritize once `timePlanner` module is drafted. Consider TDD for parsing logic.
