# Acceptance Test Plan

## Scope

This plan covers acceptance testing for the README-defined AI-Driven Functional Testing and UAT Platform backlog. It maps to the GitHub issue user stories for the README epics and is limited to QA acceptance materials.

## Release Rule

Release is approved only when every in-scope acceptance criterion passes, or when an explicitly approved exception is recorded with owner, risk, and target fix date.

Current QA status: **Conditional release candidate - automated engineering gates pass, but full manual UAT signoff is not complete.**

## Test Levels

- Story acceptance: each user story acceptance criterion is verified directly.
- End-to-end UAT workflow: project setup, AI-assisted requirement refinement, test generation, manual execution, evidence capture, reporting, and release readiness.
- Governance verification: audit trail, user identity, timestamps, role controls, and AI provider traceability.

## Entry Criteria

- Runnable frontend and API are available.
- Test environment and base URL are documented.
- Test users exist for Admin, Project Manager, Tester, and Viewer roles.
- AI provider test credentials or a deterministic AI stub are configured.
- File upload storage is configured for evidence tests.
- Database can be reset or seeded for repeatable acceptance runs.

## Exit Criteria

- All critical and high priority acceptance checks pass.
- No unresolved blocker prevents the primary UAT workflow.
- Failed, blocked, or not-run checks are documented with impact and owner.
- Release readiness report reflects the final acceptance result set.
- Audit records exist for user, project, test, evidence, result, and AI provider changes.

## Story Coverage Matrix

| Issue | Epic | User story | Acceptance focus | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| #1 | Authentication and User Management | User Login | Secure login, invalid credential handling, dashboard redirect, session creation and persistence, role loading | Critical | Not run |
| #2 | Authentication and User Management | Admin User Management | Create users, disable users, assign roles, prevent disabled login, audit changes | Critical | Not run |
| #3 | Project Management | Create Project | Create project with description, show on dashboard, default to Active | Critical | Not run |
| #4 | Project Management | Archive Project | Archive project, hide from active list, keep searchable, preserve audit history | High | Not run |
| #5 | GitHub Integration | Connect Repository | Save valid repository metadata, reject invalid repository, show repository in project view | High | Not run |
| #6 | AI Requirement Collaboration | Conversational Requirement Analysis | Plain-English input, conversational AI response, structured stories, missing edge cases | High | Not run |
| #7 | AI Requirement Collaboration | AI Acceptance Criteria Generation | Generate measurable criteria, keep editable, link to stories, store output | High | Not run |
| #8 | Functional Test Generation | Generate Functional Tests | Generate title, preconditions, steps, expected outcomes; allow edit/save; link to stories | Critical | Not run |
| #9 | Functional Test Generation | Generate Negative Test Scenarios | Generate invalid, security, and permission-based scenarios | High | Not run |
| #10 | Manual Test Execution | Execute Tests | Mark Pass, Fail, Blocked, Not Run; add notes; record timestamp and user identity | Critical | Not run |
| #11 | Manual Test Execution | Record Actual Results | Capture actual outcome beside expected outcome and keep differences visible | Critical | Not run |
| #12 | Evidence Capture | Upload Evidence | Upload screenshots and documents, link to test run, view uploaded files | High | Not run |
| #13 | Reporting and Dashboards | Project Dashboard | Show total, passed, failed, and blocked tests; update dynamically | Critical | Not run |
| #14 | Reporting and Dashboards | Release Readiness Summary | Show pass/fail percentage, critical failures, and unresolved blockers | Critical | Not run |
| #15 | AI Failure Interpretation | AI Failure Summaries | Summarise failures, identify recurring patterns, suggest probable causes | High | Not run |
| #16 | Audit and Governance | Audit Trail | Timestamp actions, log test edits and result changes, prevent audit deletion | Critical | Not run |
| #17 | Bring Your Own AI | Configure AI Provider | Select provider, enter secure API key, test connection, choose model, log usage | Critical | Not run |
| #18 | Bring Your Own AI | Project AI Provider Override | Inherit org settings, override per project, audit override, route prompts to selected provider | High | Not run |

## End-to-End Acceptance Scenarios

### UAT-001: Governed Release Workflow

1. Admin configures an AI provider and creates users for each role.
2. Project Manager creates a project and connects a GitHub repository.
3. Project Manager enters plain-English requirements and requests AI refinement.
4. Tester reviews generated stories, acceptance criteria, functional tests, and negative scenarios.
5. Tester edits and approves generated content.
6. Tester executes manual tests, records actual results, marks outcomes, and uploads evidence.
7. Project Manager reviews dashboard and release readiness summary.
8. Project Manager requests AI failure interpretation for failed tests.
9. Admin verifies audit trail for all key actions.

Expected result: the release can only be marked ready when all acceptance criteria pass and unresolved blockers are absent.

### UAT-002: Blocked Release Workflow

1. Tester executes at least one critical test as Fail or Blocked.
2. Project Manager opens release readiness summary.
3. Stakeholder reviews highlighted failures and blockers.

Expected result: release readiness clearly indicates the release is not approved, with visible failed or blocked criteria and supporting detail.

## Automation Approach

High-level acceptance scenarios are captured in `tests/acceptance/platform-acceptance.feature`. Playwright browser tests were not added because the application scaffold is incomplete and changed during QA preparation. When a stable runnable React/Vite app or equivalent appears, create Playwright coverage for:

- Authentication and role-aware navigation.
- Project creation, archive, and search.
- Repository connection validation.
- AI-assisted requirement and test generation using a deterministic AI stub.
- Manual test execution state changes.
- Evidence upload and retrieval.
- Dashboard and release readiness updates.
- Audit trail immutability.

## Current Gaps

- Full manual UAT evidence has not yet been recorded for every story acceptance check.
- High-level Gherkin scenarios are specifications, not executed browser acceptance tests.
- AI behavior is represented by deterministic MVP stubs; production provider validation still requires real customer credentials.
- Evidence capture now supports MVP upload, view, and download flows using in-memory storage; durable production object storage still needs hardening before final production release approval.
- Release status remains conditional until the checklist in `tests/acceptance/acceptance-checklist.md` is executed and signed off.

## Validation Log

| Date | Command | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-27 | `npm test` | Fail | Test collection fails because referenced API and web implementation files are missing. No acceptance checks could be executed. |
| 2026-05-27 | `npm test` | Pass | API MVP tests and React interaction tests pass after implementation files were restored. |
| 2026-05-27 | `npm run build` | Pass | Fastify syntax checks and Vite production build pass. |
| 2026-05-27 | HTTP smoke checks | Pass | Frontend returned HTTP 200 on `http://127.0.0.1:5173/`; API health returned `{"status":"ok"}` on `http://127.0.0.1:3001/health`. |
| 2026-05-27 | `npm audit --omit=dev` | Pass | Production dependency audit reported zero vulnerabilities after framework dependency upgrades. |
| 2026-05-27 | HTTP smoke checks after dependency upgrades | Pass | Frontend returned HTTP 200 on `http://127.0.0.1:5174/` because `5173` was already occupied; API health returned `{"status":"ok"}` on `http://127.0.0.1:3001/health`. |
| 2026-05-27 | `npm test` | Pass | Evidence upload, list, view, and download behaviour is covered by API tests; frontend tests cover screenshot view and document download links. |
