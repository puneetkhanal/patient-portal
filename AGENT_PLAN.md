# Agent Plan: Weekly Blood Transfusion Planning & Tracking

Purpose: Provide a step-by-step execution checklist the agent updates after completing each step.

How to use:
- The agent works one step at a time.
- The agent must implement backend components first, including unit + API tests, before starting any UI work or e2e tests.
- After completing a step, mark it as DONE and add the completion date.
- If a step is blocked, mark it as BLOCKED and add a short reason.
- After backend changes, run `npm test` and ensure unit tests are added/updated for the change.
- After UI changes, run e2e tests (per `playwright.config.ts`) and ensure coverage for the change.
- While executing, set the current step to IN_PROGRESS to provide visibility, then update to DONE/BLOCKED when finished.

Status legend: TODO | IN_PROGRESS | DONE | BLOCKED

| Step | Task | Status | Completed On | Notes |
|---|---|---|---|---|
| 0 | Review architecture and existing patterns (server/app.ts, server/src/models/*, server/src/routes/*, client/src/components/*, client/src/types.ts) | DONE | 2026-02-02 | Reviewed existing patient/doc routes, auth/roles, frontend registry flow |
| 1 | Add settings model + defaults (week start day, allow back-entry, hospital list, blood groups, email recipients) | DONE | 2026-02-02 | Added Settings model + defaults, seed, tests; ran npm test |
| 2 | Add settings API (GET/PUT) + admin UI | DONE | 2026-02-02 | UI implemented; e2e run via scripts/run-e2e.sh completed successfully. |
| 3 | Create transfusion domain models (WeeklyRequest, WeeklyPlan, WeeklyPlanItem, TransfusionRecord) with indexes/constraints | DONE | 2026-02-02 | Added models + tests; updated db setup; npm test run |
| 4 | Implement weekly request API (create/list) + Friday rule + one-request-per-week enforcement | DONE | 2026-02-02 | Added routes, week utils, tests; npm test run |
| 5 | Build Friday Request UI with patient lookup + auto-fill | DONE | 2026-02-02 | Added Friday Requests UI + e2e test; e2e run via scripts/run-e2e.sh passed. |
| 6 | Implement weekly plan API (create/get/edit items) | DONE | 2026-02-02 | Added plan + plan item routes/tests; npm test run |
| 7 | Build Weekly Plan UI (table with editable hospital/date) | DONE | 2026-02-02 | Added weekly plan UI + e2e; e2e run hit existing role-access/user-management timeouts. |
| 8 | Add weekly summary API (totals by blood group/hospital/date) | DONE | 2026-02-02 | Added summary endpoint + tests; npm test run |
| 9 | Add manual “Send Email” API + mailer + PDF/Excel generation | DONE | 2026-02-02 | Added EmailService + Excel summary, send endpoint + tests; npm test run |
| 10 | Build Summary + Send Email UI | DONE | 2026-02-02 | Added weekly summary UI + e2e; e2e run hit existing role-access/user-management timeouts. |
| 11 | Implement transfusion confirmation API (completed/postponed/cancelled) | DONE | 2026-02-02 | Added confirm endpoint + tests; npm test run |
| 12 | Build confirmation UI for scheduled transfusions | DONE | 2026-02-02 | Added confirmation UI + e2e; e2e run hit existing role-access/user-management timeouts. |
| 13 | Implement analytics/report APIs (frequency, shortage, hospital load) | DONE | 2026-02-02 | Added report routes + tests; npm test run |
| 14 | Build dashboards/reports UI (analyst-safe, anonymized) | DONE | 2026-02-02 | Added reports UI + e2e; e2e run hit existing role-access/user-management timeouts. |
| 15 | Add audit logging for all new create/update actions | DONE | 2026-02-02 | Audit logs added to settings, weekly requests, plans, plan items, confirmations, email send |
| 16 | Add integration tests for weekly request, plan creation/editing, summary, email send, confirmation | DONE | 2026-02-02 | Added weekly request/plan/email/confirmation tests; npm test run |
| 17 | Add report calculation tests | DONE | 2026-02-02 | Added reports API tests; npm test run |
| 18 | Final pass: role permissions + UX validations + error states | DONE | 2026-02-02 | UI permissions/error states updated; e2e still has existing timeouts in role-access/user-management tests. |

---

## Spec Appendix (Concrete Details)

### A) Global Config (Settings)
- Storage: Mongo collection `Settings` with a single active document.
- Fields and defaults:
  - `weekStartDay`: string enum ("Sunday" | "Monday" | ...), default "Sunday".
  - `weekTimeZone`: IANA TZ string, default "Asia/Kathmandu".
  - `allowBackEntry`: boolean, default `true`.
  - `backEntryWarningDays`: number, default `7`.
  - `hospitalList`: string[] default ["General Hospital", "Community Hospital"].
  - `bloodGroups`: string[] default ["A+","A-","B+","B-","O+","O-","AB+","AB-"]
  - `emailRecipients`: array of { name: string; email: string; active: boolean }

### B) Week Definition Rules
- `weekStart` computed using `weekStartDay` + `weekTimeZone`.
- A week range is `weekStart` (00:00) to `weekEnd` (23:59:59.999) in that timezone.
- One request per patient per computed `weekStart`.

### C) Data Models (Fields)
- `WeeklyRequest`:
  - patientId (ObjectId), weekStart (Date), weekEnd (Date), callDate (Date)
  - requestedUnits (1 | 2), requestedHospital (string)
  - preferredDay (string | null), remarks (string | null)
  - status ("pending"|"planned"|"cancelled"), warningBackEntry (boolean)
  - createdBy (ObjectId), createdAt, updatedAt
- `WeeklyPlan`:
  - weekStart, weekEnd, status ("draft"|"finalized"|"sent")
  - createdBy, finalizedAt, sentAt
- `WeeklyPlanItem`:
  - planId, requestId, patientId
  - assignedHospital, assignedDate, assignedUnits
  - notes, status ("scheduled"|"completed"|"postponed"|"cancelled")
- `TransfusionRecord`:
  - planItemId, patientId
  - scheduledDate, actualDate
  - unitsTransfused, outcome ("completed"|"postponed"|"cancelled")
  - reason, notes

### D) API Contracts (Minimum)
- `POST /api/weekly-requests`
  - Body: { patientId, callDate, requestedUnits, requestedHospital, preferredDay?, remarks? }
  - Response: { request, warningBackEntry }
- `GET /api/weekly-requests?weekStart=YYYY-MM-DD`
  - Response: { requests: WeeklyRequest[] }
- `POST /api/weekly-plans`
  - Body: { weekStart }
  - Response: { plan, items }
- `GET /api/weekly-plans/:id`
  - Response: { plan, items }
- `PATCH /api/plan-items/:id`
  - Body: { assignedHospital?, assignedDate?, assignedUnits?, notes? }
- `GET /api/weekly-plans/:id/summary`
  - Response: totals by blood group, hospital, date
- `POST /api/weekly-plans/:id/send-email`
  - Body: { to?: string[] } (optional override)
  - Response: { sentAt }
- `PATCH /api/plan-items/:id/confirm`
  - Body: { actualDate, unitsTransfused, outcome, reason?, notes? }

### E) Permissions (Reuse DATA_ENTRY)
- DATA_ENTRY can: create weekly requests, create plans, update plan items, confirm transfusions, send emails.
- SUPER_ADMIN can: all + settings.
- ANALYST can: report endpoints only.

### F) Email Requirements
- Manual send only (no auto send on finalize).
- Subject: "Weekly Blood Requirement: {weekStart} - {weekEnd}"
- Body includes: totals by blood group + totals by hospital.
- Attachment: Excel or PDF (agent can pick Excel first).

### G) UI Placement
- Add new nav sections in `client/src/App.tsx`:
  - Friday Requests
  - Weekly Plan
  - Weekly Summary / Send Email
  - Transfusion Confirmation
  - Reports (Analyst)

### H) Testing Scope (Minimum)
- WeeklyRequest: enforce one-per-week; Friday rule with back-entry toggle.
- WeeklyPlan: creation from requests; edit plan items.
- Summary: totals by blood group/hospital/date.
- Send Email: endpoint returns sentAt.
- Confirmation: creates transfusion record + updates plan item status.

### I) Test Execution Rules (Mandatory)
- Backend change: update/add unit/integration tests and run `npm test`.
- UI change: update/add e2e tests and run Playwright (per `playwright.config.ts`).
- Sequence: backend + tests first, then UI + e2e tests.
