Feature: AI-driven functional testing and UAT release governance

  Release rule:
  The platform must not be released unless all in-scope acceptance criteria pass.

  Scenario: Admin configures secure access and AI provider
    Given the platform is available
    And an Admin user is signed in
    When the Admin creates a user and assigns a role
    And the Admin disables that user
    Then the disabled user cannot sign in
    And the user management changes are visible in audit history
    When the Admin selects an organisation AI provider
    And the Admin stores an API key
    And the Admin tests the provider connection
    And the Admin chooses the default model
    Then AI usage and provider configuration changes are audited

  Scenario: Project manager prepares project context
    Given a Project Manager is signed in
    When the Project Manager creates a project with a description
    Then the project appears on the dashboard with Active status
    When the Project Manager connects a valid GitHub repository URL
    Then repository metadata is stored
    And the repository appears in the project view
    When the Project Manager enters an invalid repository URL
    Then a clear repository error is displayed

  Scenario: AI assists requirement refinement and test design
    Given a Project Manager has an active project
    When the Project Manager enters a plain-English requirement
    And requests AI requirement analysis
    Then the AI responds conversationally
    And structured user stories are suggested
    And missing edge cases are identified
    When a Tester requests acceptance criteria for a user story
    Then measurable acceptance criteria are generated
    And the criteria remain editable
    And the criteria are linked to the user story
    When the Tester requests functional and negative test scenarios
    Then generated tests include titles, preconditions, steps, and expected outcomes
    And invalid, security, and permission-based negative scenarios are suggested
    And generated tests can be edited, saved, and traced to their source stories

  Scenario: Tester executes manual UAT with evidence
    Given a Tester has saved tests for a project
    When the Tester marks tests as Pass, Fail, Blocked, and Not Run
    And the Tester enters execution notes
    And the Tester records actual outcomes
    Then each result is saved with timestamp and user identity
    And actual results remain visible beside expected results
    And differences remain visible after reload
    When the Tester uploads a screenshot and a document as evidence
    Then each evidence file is linked to the test run
    And each uploaded file is viewable

  Scenario: Dashboard and release readiness reflect current quality
    Given a project has passed, failed, blocked, and not run test results
    When a Project Manager opens the project dashboard
    Then total, passed, failed, and blocked test counts are displayed
    And dashboard counts update after result changes
    When the Project Manager opens the release readiness summary
    Then pass and fail percentages are displayed
    And critical failures are highlighted
    And unresolved blockers are displayed
    And the release is not approved while critical failures or blockers remain

  Scenario: AI interprets failures for stakeholders
    Given a project has failed tests with actual outcomes and notes
    When a Project Manager requests an AI failure summary
    Then the AI summarises the failures
    And recurring patterns are identified
    And probable causes are suggested in stakeholder-readable language

  Scenario: Project-specific AI provider override is governed
    Given organisation AI provider settings exist
    And a Project Manager has an active project
    When the Project Manager configures no project override
    Then the project inherits organisation AI settings
    When the Project Manager overrides the provider for the project
    Then the project-specific provider is saved
    And the override is visible in audit history
    And project AI prompts use the selected project provider

  Scenario: Completed project is archived without losing traceability
    Given a Project Manager has an active project with audit history
    When the Project Manager archives the project
    Then the project disappears from the active list
    And the archived project remains searchable
    And the audit history is preserved

  Scenario: Release is blocked when acceptance criteria are incomplete
    Given one or more story acceptance checks are Fail, Blocked, or Not Run
    When release readiness is assessed
    Then the QA decision is Do not release
    And the failed, blocked, or not run checks are reported with clear gaps
