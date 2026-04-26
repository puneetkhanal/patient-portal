# Calendar Refactor Summary

## Goal
Support both Gregorian (AD) and Nepali (BS) calendars in the UI while keeping backend storage in AD.

## What Changed
- Added calendar mode to system settings (`AD`/`BS`) and persisted it via settings API.
- Introduced a global calendar context to propagate the selected mode across the UI.
- Replaced native date inputs with a shared `DateInput` component that switches between AD input and Nepali date picker.
- Centralized date display formatting so all visible dates follow the selected calendar mode.
- Updated tests to cover the new settings field.

## New/Updated Frontend Files
- `client/src/contexts/CalendarContext.tsx` – global calendar mode state.
- `client/src/components/DateInput.tsx` – date input wrapper (AD native / BS picker).
- `client/src/utils/nepaliDate.ts` – AD ⇄ BS conversion helpers.
- `client/src/utils/dateFormat.ts` – consistent date display formatting.
- `client/src/components/SettingsForm.tsx` – added Calendar Type select.
- Updated date usage in:
  - `client/src/components/PatientRegistrationForm.tsx`
  - `client/src/components/FridayRequests.tsx`
  - `client/src/components/WeeklyPlan.tsx`
  - `client/src/components/WeeklySummary.tsx`
  - `client/src/components/PatientsList.tsx`
  - `client/src/components/PatientDetail.tsx`
  - `client/src/components/ReportsDashboard.tsx`
  - `client/src/components/TransfusionConfirmation.tsx`

## Backend Changes
- `server/src/models/Settings.ts` – added `calendarMode` with defaults and validation.
- `server/src/routes/settings.routes.ts` – validate `calendarMode` updates.

## Tests Updated
- `server/tests/models/Settings.test.ts`
- `server/tests/api/settings.api.integration.test.ts`
- `e2e/settings.spec.ts`

## Dependencies Added
- `nepali-date-converter`
- `nepali-datepicker-reactjs`
- CSS import: `nepali-datepicker-reactjs/dist/index.css` in `client/src/index.css`

## Behavior Summary
- UI displays dates in the selected calendar mode (AD or BS).
- All date inputs convert BS → AD before submitting.
- Backend continues to store and process AD dates only.

## Notes
- If you want per-user preference instead of a global setting, we can move `calendarMode` to the user profile and keep the same UI components.

---

# BS-Only Refactor Summary

## Goal
Move to BS-only dates in both UI and database. No UI conversion to AD.

## What Changed
- All patient and planning date fields now store **BS strings** (`YYYY-MM-DD`) in MongoDB.
- UI date pickers send BS values directly; no conversion logic in UI.
- Backend derives week ranges/weekday calculations by converting BS → AD for computation only.
- Added date normalization to models to safely accept legacy Date/ISO inputs and store BS.

## Backend Updates
- `server/src/utils/bsDate.ts` – conversion/normalization helpers and safe fallbacks.
- Models now store date fields as **string**:
  - `server/src/models/Patient.ts`
  - `server/src/models/WeeklyRequest.ts`
  - `server/src/models/WeeklyPlan.ts`
  - `server/src/models/WeeklyPlanItem.ts`
  - `server/src/models/TransfusionRecord.ts`
- Routes adjusted to treat inputs as BS strings and only convert to AD for calculations:
  - `server/src/routes/weeklyRequest.routes.ts`
  - `server/src/routes/weeklyPlan.routes.ts`
  - `server/src/routes/planItem.routes.ts`
  - `server/src/routes/report.routes.ts`
  - `server/src/routes/patient.routes.ts` (age calculation)

## Frontend Updates
- `client/src/components/DateInput.tsx` now emits/stores BS strings.
- `client/src/utils/dateFormat.ts` shows BS dates as-is.
- `client/src/components/PatientRegistrationForm.tsx` continues to bind to `dob` (BS string).

## Tests Updated
- Updated test data to use BS strings across API/model tests:
  - `server/tests/api/*.test.ts`
  - `server/tests/models/*.test.ts`
  - `server/tests/services/*.test.ts`
  - `server/tests/db/setup.ts`

## Behavior Summary
- UI: BS only; values are `YYYY-MM-DD` and persisted as-is.
- Backend: stores BS strings; converts to AD only for week range calculations and reports.
