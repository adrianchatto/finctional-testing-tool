# AI-Driven Functional Testing and UAT Platform

A lightweight AI-assisted functional testing and UAT management platform for project teams, testers, project managers, analysts, and senior stakeholders.

The platform helps teams create and manage projects, connect GitHub repositories, collaborate with AI in plain English, generate business-readable testing assets, execute manual tests, capture evidence, and produce stakeholder-ready release reports.

## Product Vision

The platform enables teams to generate and manage:

- user stories
- acceptance criteria
- functional test scripts
- negative test scenarios
- manual test execution records
- actual outcomes
- pass, fail, blocked, and not run results
- supporting evidence
- release readiness reports

It is intentionally:

- business-readable
- governance-focused
- AI-assisted
- lightweight
- delivery-centric

It is not intended to replace Playwright, Selenium, or low-level browser automation frameworks. The focus is UAT, governance, release confidence, business workflows, and AI-assisted test management.

## Product Principles

### Business First

The platform must be understandable by project managers, business analysts, delivery managers, stakeholders, and testers without requiring deep technical knowledge.

### AI-Assisted

AI should help generate stories, tests, acceptance criteria, failure summaries, and edge cases while keeping all generated content human-reviewed and editable.

### Human In The Loop

Users remain responsible for approval, execution, governance, and release decisions. AI augments testers and project teams rather than replacing them.

### Governance Focused

The platform prioritises traceability, auditability, evidence capture, reporting, and release visibility.

## High-Level Architecture

```text
Users
  |
React Web Application
  |
Fastify API Layer
  |
AI Orchestration Layer
  |
PostgreSQL Database
  |
GitHub Integration
```

## Suggested Technology Stack

### Frontend

- React
- Vite
- Tailwind CSS

### Backend

- Fastify
- Node.js

### Database

- PostgreSQL
- Supabase

### Hosting

- Azure Container Apps

### Authentication

- JWT
- Future Entra ID support

### AI Providers

The platform follows a Bring Your Own AI model. Supported providers include:

- OpenAI
- Anthropic Claude
- Google Gemini
- Azure OpenAI
- AWS Bedrock

## Core Functional Areas

### Authentication and User Management

The platform supports login, logout, password reset, user management, and role-based access control.

Initial roles:

- Admin
- Project Manager
- Tester
- Viewer

### Project Management

Users can create, archive, reopen, and manage projects, assign users, and maintain project metadata.

### GitHub Repository Integration

Users can connect GitHub repositories, associate repositories with projects, and store repository metadata.

Future enhancements may include pull request analysis, README parsing, and commit analysis.

### AI Requirement Collaboration

Users can discuss requirements conversationally, provide plain-English user stories, and refine requirements with AI assistance.

AI should help structure stories, identify gaps, and suggest missing scenarios.

### AI Test Generation

AI can generate functional test scripts, acceptance criteria, expected outcomes, and negative test cases. Generated output remains editable and subject to human approval.

### Manual Test Execution

Users can execute tests manually, record actual outcomes, and mark tests as pass, fail, blocked, or not run.

### Evidence Capture

Users can upload screenshots, documents, notes, and other evidence against test runs.

### Reporting and Dashboards

The platform provides pass/fail dashboards, release readiness summaries, defect visibility, and project-level reporting.

### AI Result Interpretation

AI can summarise failures, identify recurring patterns, suggest probable causes, and produce stakeholder-ready summaries.

### Audit and Governance

The platform tracks who created, modified, and executed tests, including timestamps and historical changes.

### Bring Your Own AI

Customers supply their own AI provider, API keys, and model selection. This reduces platform AI cost, supports enterprise compliance requirements, and addresses security concerns.

```text
Customer AI Provider
        |
AI Provider Adapter Layer
        |
Prompt Orchestration
        |
Generated Testing Content
```

## Initial Backlog

The initial product backlog is organised into the following epics:

- Authentication and User Management
- Project Management
- GitHub Integration
- AI Requirement Collaboration
- Functional Test Generation
- Manual Test Execution
- Evidence Capture
- Reporting and Dashboards
- AI Failure Interpretation
- Audit and Governance
- Bring Your Own AI

Each user story is tracked as a GitHub issue in this repository.

## Future Enhancements

Potential roadmap items include:

- Azure DevOps integration
- Jira integration
- automated browser testing
- AI-generated regression packs
- release confidence scoring
- defect clustering
- Power BI or Microsoft Fabric integration
- enterprise RBAC
- Entra ID SSO
- Conditional Access
- multi-tenant SaaS architecture
- AI-generated executive reports
- test coverage analysis
- release trend analysis

## Product Positioning

This product is not a Selenium replacement, Playwright replacement, low-level automation framework, or developer-only QA tool.

It is an AI-assisted functional testing, UAT governance, release confidence, and business-readable testing platform for project managers, testers, delivery managers, business analysts, and enterprise stakeholders.
