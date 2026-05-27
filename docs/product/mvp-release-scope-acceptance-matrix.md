# MVP Release Scope and Acceptance Matrix

Source: README epics and GitHub issues #1-#18.

## MVP Release Goal

Ship a lightweight, business-readable UAT platform that lets a project team log in, create a project, connect context, collaborate with AI to structure requirements, generate editable functional tests, manually execute those tests, attach evidence, and produce a basic release readiness view.

The MVP is release-ready when a project manager and tester can complete one governed end-to-end UAT cycle without developer intervention:

1. Configure an organisation AI provider.
2. Log in with the correct role.
3. Create a project.
4. Add repository context.
5. Capture plain-English requirements.
6. Generate and edit acceptance criteria and functional tests.
7. Execute tests with pass, fail, blocked, or not run outcomes.
8. Record actual results and evidence.
9. View project progress and release readiness.
10. Verify core activity is auditable.

## MVP Scope Rules

- **P0**: Required for a credible first release and must have automated tests before shipping.
- **P1**: Important fast-follow for the first production hardening cycle, but not required to prove the core MVP workflow.
- **Out of scope for MVP**: Azure DevOps, Jira, automated browser testing, regression packs, release confidence scoring, Power BI/Fabric, Entra ID SSO, enterprise RBAC, multi-tenant SaaS, executive report generation, coverage analysis, and release trend analysis.

## Release-Ready Gates

- All P0 acceptance checks pass in CI.
- Each P0 story has unit or component tests for business logic and API contract tests where applicable.
- End-to-end smoke coverage proves the full MVP UAT workflow from login through release summary.
- AI-generated content is always editable, saveable, traceable to the source story, and clearly human-reviewed before use.
- P0 audit records capture actor, action, target, timestamp, and before/after result where relevant.
- No P0 flow depends on a seeded-only or developer-only workaround, except for initial bootstrap admin creation if explicitly documented.
- P1 stories may be partially built only if they do not block, obscure, or destabilise P0 flows.

## Acceptance Matrix

| Issue | Epic | User Story | Priority | MVP Acceptance Checks for TDD |
| --- | --- | --- | --- | --- |
| #1 | Authentication and User Management | User login | P0 | Valid email/password returns a session token; invalid credentials return a clear error and no token; successful login redirects/lands on dashboard; session survives page refresh; logged-in user role is loaded and available for authorization checks. |
| #2 | Authentication and User Management | Admin user management | P1 | Admin can create a user; admin can disable a user; admin can assign one of Admin, Project Manager, Tester, Viewer; disabled users cannot log in; user-management changes create audit records. |
| #3 | Project Management | Create project | P0 | Project manager can create a project with name and description; new project appears on dashboard/project list; new project defaults to Active; created project records creator and timestamp. |
| #4 | Project Management | Archive project | P1 | User can archive an active project; archived projects are removed from the active list; archived projects remain searchable/filterable; audit history remains accessible after archive. |
| #5 | GitHub Integration | Connect repository | P0 | User can save a valid GitHub repository URL against a project; invalid or unreachable repository URL shows an actionable error and is not saved; repository owner/name/default metadata is stored; repository appears in the project view. |
| #6 | AI Requirement Collaboration | Conversational requirement analysis | P0 | User can submit a plain-English requirement inside a project; AI returns a conversational response; AI suggests at least one structured user story; AI flags missing edge cases or unclear assumptions; user can persist the AI output for review. |
| #7 | AI Requirement Collaboration | AI acceptance criteria generation | P0 | AI generates measurable acceptance criteria from a selected story; generated criteria remain editable before approval/save; saved criteria link to the source user story; generated output is stored with actor, timestamp, provider, and model metadata. |
| #8 | Functional Test Generation | Generate functional tests | P0 | AI generates test title, preconditions, ordered test steps, and expected outcomes; generated tests are editable; edited tests can be saved; saved tests link to the relevant user story and acceptance criteria. |
| #9 | Functional Test Generation | Generate negative test scenarios | P1 | AI generates invalid-input scenarios; AI suggests security edge cases; AI suggests permission-based tests; user can edit and save accepted negative scenarios. |
| #10 | Manual Test Execution | Execute tests | P0 | Tester can set result to Pass, Fail, Blocked, or Not Run; tester can add execution notes; result change stores timestamp; result change stores tester identity; latest result is reflected in project reporting. |
| #11 | Manual Test Execution | Record actual results | P0 | Tester can enter actual outcome text; actual outcome is stored beside expected outcome; expected vs actual remains visible after save; failed or blocked tests require an actual outcome or note before submission. |
| #12 | Evidence Capture | Upload evidence | P0 | Tester can upload screenshot evidence; tester can upload document evidence; uploaded evidence is linked to a specific test run; uploaded files can be viewed or downloaded by authorized project users. |
| #13 | Reporting and Dashboards | Project dashboard | P0 | Dashboard displays total, passed, failed, blocked, and not-run test counts; dashboard values update after test execution changes; dashboard handles empty projects with zero counts; dashboard is scoped to the selected project and authorized user. |
| #14 | Reporting and Dashboards | Release readiness summary | P0 | Summary shows pass/fail percentages; summary highlights failed tests marked critical or blocking; summary displays unresolved blockers; summary clearly indicates whether release readiness is blocked by failed or blocked tests. |
| #15 | AI Failure Interpretation | AI failure summaries | P1 | AI summarises selected failed tests in business-readable language; AI identifies recurring patterns across failures; AI suggests probable causes without auto-changing test results; summary can be reviewed before sharing. |
| #16 | Audit and Governance | Audit trail | P0 | User actions on P0 workflows are timestamped; test edits are logged; result changes are logged with previous and new status; audit history cannot be deleted through the application; authorized users can view audit history for a project/test. |
| #17 | Bring Your Own AI | Configure AI provider | P0 | Admin can select OpenAI, Claude, Gemini, Azure OpenAI, or AWS Bedrock; admin can enter provider credentials; credentials are not exposed back in plaintext; admin can test provider connection; admin can choose a default model; AI usage is logged per request. |
| #18 | Bring Your Own AI | Project AI provider override | P1 | Project can inherit organisation AI settings; project manager can override provider/model for a project; override action is auditable; AI prompts for that project use the selected override. |

## MVP Scenario Tests

The following scenario tests should exist before MVP release:

| Scenario | Stories Covered | Expected Result |
| --- | --- | --- |
| Admin configures AI and user logs in | #1, #17 | Provider is usable, login succeeds, role is loaded. |
| Project manager creates a governed UAT project | #1, #3, #5, #16 | Active project appears with repository context and audit records. |
| Project team turns requirements into executable tests | #6, #7, #8, #16, #17 | AI output is generated, editable, saved, linked, and audited. |
| Tester executes a manual test run | #10, #11, #12, #13, #16 | Result, notes, actual outcome, evidence, dashboard counts, and audit records are correct. |
| Stakeholder reviews release readiness | #13, #14 | Summary shows accurate pass/fail percentages, blockers, and release risk. |

## P1 Fast-Follow Release Candidates

- Admin user management hardening beyond the minimum bootstrap path.
- Project archive/reopen lifecycle.
- Negative scenario generation.
- AI failure summaries.
- Project-level AI provider overrides.

These should be scheduled immediately after the P0 MVP unless customer onboarding, compliance review, or pilot feedback changes priority.
