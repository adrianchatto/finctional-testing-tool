# Acceptance Checklist

Use this checklist for manual UAT execution until an automated scaffold is available. Result values: Pass, Fail, Blocked, Not Run.

## Environment

| Check | Expected result | Result |
| --- | --- | --- |
| Application URL is available | Frontend loads without error | Pass |
| API health is available | API responds successfully | Pass |
| Test users exist | Admin, Project Manager, Tester, and Viewer can be used | Pass |
| AI test provider or stub is configured | AI-dependent tests are deterministic enough to assess | Pass |
| Evidence upload storage is configured | Screenshot and document uploads can be retained and viewed | Blocked |

## Story Acceptance Checks

### #1 User Login

| Check | Expected result | Result |
| --- | --- | --- |
| Enter valid email and password | User is authenticated | Not Run |
| Enter invalid credentials | Clear error is displayed and user remains unauthenticated | Not Run |
| Complete login | User is redirected to dashboard | Not Run |
| Refresh after login | Session persists | Not Run |
| Inspect authenticated user context | User role is loaded | Not Run |

### #2 Admin User Management

| Check | Expected result | Result |
| --- | --- | --- |
| Admin creates a user | User can be created successfully | Not Run |
| Admin assigns a role | Role is saved and affects access | Not Run |
| Admin disables a user | User is disabled | Not Run |
| Disabled user attempts login | Login is rejected | Not Run |
| Review audit history | User management changes are recorded | Not Run |

### #3 Create Project

| Check | Expected result | Result |
| --- | --- | --- |
| Project Manager creates a project | Project is saved | Not Run |
| Add project description | Description is retained | Not Run |
| Open dashboard | Project appears on dashboard | Not Run |
| Review project status | New project defaults to Active | Not Run |

### #4 Archive Project

| Check | Expected result | Result |
| --- | --- | --- |
| Archive an active project | Project status changes to archived | Not Run |
| Open active list | Archived project is hidden | Not Run |
| Search archived projects | Archived project remains findable | Not Run |
| Review audit history | Previous audit records are preserved | Not Run |

### #5 Connect Repository

| Check | Expected result | Result |
| --- | --- | --- |
| Enter valid repository URL | Repository is connected | Not Run |
| Enter invalid repository URL | Error is displayed | Not Run |
| Review stored repository detail | Metadata is saved | Not Run |
| Open project view | Repository appears in project context | Not Run |

### #6 Conversational Requirement Analysis

| Check | Expected result | Result |
| --- | --- | --- |
| Enter plain-English requirement | Requirement is submitted | Not Run |
| Request AI analysis | AI responds conversationally | Not Run |
| Review AI output | Structured user stories are suggested | Not Run |
| Review edge case prompts | Missing edge cases are identified | Not Run |

### #7 AI Acceptance Criteria Generation

| Check | Expected result | Result |
| --- | --- | --- |
| Generate acceptance criteria | Criteria are measurable and testable | Not Run |
| Edit generated criteria | Edited criteria are retained | Not Run |
| Link criteria to story | Criteria remain associated with story | Not Run |
| Reload generated output | Stored output is available | Not Run |

### #8 Generate Functional Tests

| Check | Expected result | Result |
| --- | --- | --- |
| Generate tests from story | Test title, preconditions, steps, and expected outcomes are produced | Not Run |
| Edit generated test | Changes are retained | Not Run |
| Save generated test | Test is persisted | Not Run |
| Review story traceability | Test links to source story | Not Run |

### #9 Generate Negative Test Scenarios

| Check | Expected result | Result |
| --- | --- | --- |
| Generate negative scenarios | Invalid scenarios are produced | Not Run |
| Review security coverage | Security edge cases are suggested | Not Run |
| Review permission coverage | Permission-based tests are suggested | Not Run |

### #10 Execute Tests

| Check | Expected result | Result |
| --- | --- | --- |
| Mark test as Pass | Pass result is saved | Not Run |
| Mark test as Fail | Fail result is saved | Not Run |
| Mark test as Blocked | Blocked result is saved | Not Run |
| Mark test as Not Run | Not Run result is saved | Not Run |
| Add execution notes | Notes are retained | Not Run |
| Review execution metadata | Timestamp and user identity are recorded | Not Run |

### #11 Record Actual Results

| Check | Expected result | Result |
| --- | --- | --- |
| Enter actual outcome | Actual result is saved | Not Run |
| Compare expected and actual | Both values are visible together | Not Run |
| Record mismatch | Difference remains visible after reload | Not Run |

### #12 Upload Evidence

| Check | Expected result | Result |
| --- | --- | --- |
| Upload screenshot | Screenshot is accepted | Not Run |
| Upload document | Document is accepted | Not Run |
| Open test run | Evidence is linked to test run | Not Run |
| View uploaded file | Uploaded evidence is accessible | Not Run |

### #13 Project Dashboard

| Check | Expected result | Result |
| --- | --- | --- |
| Open dashboard | Total, passed, failed, and blocked test counts are displayed | Not Run |
| Change test result | Dashboard counts update dynamically | Not Run |

### #14 Release Readiness Summary

| Check | Expected result | Result |
| --- | --- | --- |
| Open release summary | Pass/fail percentage is displayed | Not Run |
| Create critical failure | Critical failure is highlighted | Not Run |
| Create unresolved blocker | Blocker is displayed | Not Run |
| Review release recommendation | Release is not approved while blockers or critical failures remain | Not Run |

### #15 AI Failure Summaries

| Check | Expected result | Result |
| --- | --- | --- |
| Request summary for failed tests | AI summarises failures | Not Run |
| Include repeated failures | AI identifies recurring patterns | Not Run |
| Review suggested causes | Probable causes are suggested | Not Run |

### #16 Audit Trail

| Check | Expected result | Result |
| --- | --- | --- |
| Perform user, project, test, and result changes | Actions are timestamped | Not Run |
| Edit a test | Test edit is logged | Not Run |
| Change a result | Result change is logged | Not Run |
| Attempt to delete audit history | Audit history cannot be deleted | Not Run |

### #17 Configure AI Provider

| Check | Expected result | Result |
| --- | --- | --- |
| Select OpenAI, Claude, Gemini, Azure OpenAI, or AWS Bedrock | Provider can be selected | Not Run |
| Enter API key | Key is accepted and not exposed in plain text after save | Not Run |
| Test provider connection | Connection result is displayed | Not Run |
| Choose default model | Model selection is saved | Not Run |
| Trigger AI usage | Usage is logged | Not Run |

### #18 Project AI Provider Override

| Check | Expected result | Result |
| --- | --- | --- |
| Create project without override | Project inherits organisation AI settings | Not Run |
| Override provider for project | Project-specific provider is saved | Not Run |
| Review audit history | Override is auditable | Not Run |
| Trigger project AI prompt | Selected project provider is used | Not Run |

## Release Decision

Current decision: **Conditional release candidate only. Do not mark as final QA-approved release.**

Reason: automated API, frontend, build, and HTTP smoke checks pass, but full manual UAT evidence has not been recorded for all 18 user stories. Evidence file storage/viewing remains a release hardening gap beyond MVP metadata capture.
