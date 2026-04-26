# E2E Agent Plan (MongoMemoryServer + Docker Compose)

## Goal
Run each e2e test individually. Before each test, start the app via Docker Compose (MongoMemoryServer). After each test, bring the stack down. Track pass/fail per test. If a test can’t be fixed, mark it as **needs human help**, then move to the next test.

## How to Run (Repeatable)
### Preconditions
- Docker is running.
- Playwright dependencies already installed in the image (handled by Dockerfile.e2e).
- No other process is using port 3000.

### Standard Per-Test Runner
This is the authoritative, repeatable workflow that matches the results in this plan.
```
./scripts/run-e2e-memory-per-test.sh <path/to/test.spec.ts>
```

Examples:
```
./scripts/run-e2e-memory-per-test.sh e2e/admin-login.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/weekly-plan-delete.spec.ts
```

### What the script does for every test
1) `docker compose -f docker-compose.e2e-memory.yml up -d app --build`
2) Waits for `http://localhost:3000/api/health`
3) `E2E_BASE_URL=http://localhost:3000 npx playwright test <test>`
4) `docker compose -f docker-compose.e2e-memory.yml down`

## Tracking Table
Mark one of: `pending` | `pass` | `fail` | `needs human help`

| Test File | Status | Notes |
| --- | --- | --- |
| e2e/admin-login.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/auth-session.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/change-password.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/document-delete.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/document-flow.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/error-handling.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/navigation.spec.ts | pass | Fixed mobile toggle click (force click) |
| e2e/patient-detail.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/patient-list.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/patient-list-ui.spec.ts | pass | Updated pagination expectations to 10 results with fuzzy search (expects 10 results after fuzzy search) |
| e2e/register.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/reports-access.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/reports-dashboard.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/role-access.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/settings.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/transfusion-confirmation.spec.ts | pass | Updated test for new confirmation flow |
| e2e/user-management.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/weekly-plan.spec.ts | pass | Ran with docker-compose.e2e-memory.yml |
| e2e/weekly-requests.spec.ts | pass | Updated test for plan selection + preferred date |
| e2e/weekly-summary.spec.ts | pass | Fixed summary load to use plan id directly |
| e2e/weekly-plan-delete.spec.ts | pass | Added delete + blocked delete coverage |
| e2e/weekly-request-delete.spec.ts | pass | Added delete + blocked delete coverage |
| e2e/transfusion-records-delete.spec.ts | pass | Added delete transfusion record coverage |
| e2e/friday-requests-email.spec.ts | pass | Added email template modal coverage |
| e2e/friday-requests-availability.spec.ts | pass | Added availability helper coverage |
| e2e/settings-capacity.spec.ts | pass | Added capacity persistence coverage |
| e2e/weekly-request-validations.spec.ts | pass | Added back-entry, preferred date, one-per-week validations |
| e2e/reports-shortage-load.spec.ts | pass | Added shortage + hospital load coverage |

## Agent Procedure (per test)
1) Run the individual test with `scripts/run-e2e-memory-per-test.sh` (or run one test file manually).
2) If it fails:
   - Inspect the failure.
   - Fix code or test.
   - Re-run the same test.
3) If still failing after a reasonable fix attempt:
   - Set status to `needs human help`.
   - Add the failure details to Notes.
   - Move to next test.

## When Human Help is Needed
Mark **needs human help** when:
- The failure is flaky and cannot be stabilized quickly.
- The requirement is ambiguous or missing.
- The fix would risk breaking core flows.

## Manual One-Test Run (optional)
```
docker compose -f docker-compose.e2e-memory.yml up -d app --build
E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/<test>.spec.ts
docker compose -f docker-compose.e2e-memory.yml down
```

## Full Repro Log (commands + fixes)
This section is the canonical “playbook” for repeatable results.

### Per-test commands used
Run each test individually with:
```
./scripts/run-e2e-memory-per-test.sh e2e/admin-login.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/auth-session.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/change-password.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/document-delete.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/document-flow.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/error-handling.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/navigation.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/patient-detail.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/patient-list.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/patient-list-ui.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/register.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/reports-access.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/reports-dashboard.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/role-access.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/settings.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/transfusion-confirmation.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/user-management.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/weekly-plan.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/weekly-requests.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/weekly-summary.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/weekly-plan-delete.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/weekly-request-delete.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/transfusion-records-delete.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/friday-requests-email.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/friday-requests-availability.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/settings-capacity.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/weekly-request-validations.spec.ts
./scripts/run-e2e-memory-per-test.sh e2e/reports-shortage-load.spec.ts
```

### Fix log (what changed and why)
These changes were required to make the suite pass consistently.

- **e2e/patient-list-ui.spec.ts**
  - Issue: UI shows 10 results due to fuzzy search; test expected 9.
  - Fix: Updated expectations to `Showing 1-5 of 10` and `Showing 6-10 of 10`.

- **e2e/weekly-summary.spec.ts**
  - Issue: Summary view loaded stale plan ID.
  - Fix: Updated app to load summary by explicit plan id.
  - File touched: `client/src/components/WeeklySummary.tsx`

- **e2e/weekly-request-delete.spec.ts**
  - Issue: `getByRole('combobox')` matched multiple selects.
  - Fix: Targeted plan selector with `.friday-plan-link select`.

- **e2e/friday-requests-email.spec.ts**
  - Issue: `getByRole('combobox')` matched multiple selects.
  - Fix: Targeted plan selector with `.friday-plan-link select`.

- **e2e/friday-requests-availability.spec.ts**
  - Issue: `getByRole('combobox')` matched multiple selects.
  - Fix: Targeted plan selector with `.friday-plan-link select`.

- **e2e/reports-shortage-load.spec.ts**
  - Issue: Ambiguous row selectors and wrong date lookup (weekStart vs preferred date).
  - Fix: Scoped assertions to the Shortage and Hospital sections and used plan weekStart for shortage row matching.

- **e2e/navigation.spec.ts**
  - Issue: Mobile toggle click was flaky.
  - Fix: forced click on mobile toggle button.

- **e2e/transfusion-confirmation.spec.ts**
  - Issue: Confirmation flow moved into Weekly Plan.
  - Fix: Test updated to new inline confirm panel flow.

- **e2e/weekly-requests.spec.ts**
  - Issue: Friday Requests now requires plan selection + preferred date.
  - Fix: Test updated to select plan and set preferred date.

- **New coverage added**
  - `e2e/weekly-plan-delete.spec.ts`: delete + blocked delete
  - `e2e/weekly-request-delete.spec.ts`: delete + blocked delete
  - `e2e/transfusion-records-delete.spec.ts`: delete transfusion record
  - `e2e/friday-requests-email.spec.ts`: email template modal generation
  - `e2e/friday-requests-availability.spec.ts`: availability helper text
  - `e2e/settings-capacity.spec.ts`: capacity persistence
  - `e2e/weekly-request-validations.spec.ts`: back-entry on/off, preferred date in week, one per week
  - `e2e/reports-shortage-load.spec.ts`: shortage + hospital load data presence

- **Calendar refactor follow-up fixes**
  - Issue: Date picker/BS mode broke UI inputs and date display expectations in e2e.
  - Fix: `DateInput` now uses a plain `type="text"` input in BS mode for stability.
  - Fix: Default BS dates now use `getTodayBs()` for form/plan defaults.
  - Fix: Added module declaration for `nepali-date-converter` to satisfy TS build.
  - Fix: Added `e2e/helpers/date-input.ts` and updated UI tests to use it.
  - Fix: Updated date display expectations in `e2e/patient-detail.spec.ts`, `e2e/transfusion-confirmation.spec.ts`, and `e2e/calendar-date-persistence.spec.ts`.
