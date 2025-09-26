# Optional Enhancements: Visibility Panel & Tests

## “What I Can See and Why” Panel

### Status

✅ Implemented in `app/page.tsx` as the “Privacy First” tab. The accordion outlines local-only processing for the standard draft and highlights data sent when choosing Gemini.

### Notes

- Uses MUI `Accordion` inside a dedicated view toggle.
- Surfaces components with icons, copy describing what data stays local versus what gets uploaded to Gemini.
- Consent reminder appears via modal when users opt into Gemini drafting.

## Unit Tests for Time Proposal Logic

### Status

✅ Implemented with Vitest in `lib/timePlanner.test.ts`.

### Coverage

- Ensures generated slots snap to 15-minute increments within work hours.
- Enforces morning-only time-of-day preferences.
- Confirms busy intervals are excluded.

### Tooling

- Vitest configured via `vitest.config.ts`.
- `npm run test` executes the suite; `npm run test:watch` for development.

## Remaining Ideas

- Expand tests to cover preference windows with overlaps and multiple busy blocks.
- Add UI integration tests ( Playwright/Cypress ) if we wire up CI.
- Consider storing user consent state beyond cookies for multi-device sync.
