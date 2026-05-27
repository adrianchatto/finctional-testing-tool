import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

async function request(app, token, options) {
  return app.inject({
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  });
}

describe('functional testing API MVP', () => {
  it('covers auth, RBAC, projects, repositories, AI assets, manual results, dashboards, and audit', async () => {
    const app = await buildApp();

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@example.com', password: 'password' }
    });

    expect(login.statusCode).toBe(200);
    const adminToken = login.json().token;
    expect(login.json().user.roles).toContain('Admin');

    const viewerLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'viewer@example.com', password: 'password' }
    });
    const viewerToken = viewerLogin.json().token;

    const deniedProject = await request(app, viewerToken, {
      method: 'POST',
      url: '/projects',
      payload: { name: 'Portal Release' }
    });
    expect(deniedProject.statusCode).toBe(403);

    const userCreated = await request(app, adminToken, {
      method: 'POST',
      url: '/users',
      payload: { name: 'Priya Tester', email: 'priya@example.com', roles: ['Tester'] }
    });
    expect(userCreated.statusCode).toBe(201);
    expect(userCreated.json().user.roles).toEqual(['Tester']);

    const projectCreated = await request(app, adminToken, {
      method: 'POST',
      url: '/projects',
      payload: {
        name: 'Portal Release',
        description: 'UAT for customer portal',
        metadata: { release: 'R1' },
        assignedUserIds: [userCreated.json().user.id]
      }
    });
    expect(projectCreated.statusCode).toBe(201);
    const project = projectCreated.json().project;
    expect(project.status).toBe('active');

    const archived = await request(app, adminToken, {
      method: 'POST',
      url: `/projects/${project.id}/archive`
    });
    expect(archived.json().project.status).toBe('archived');

    const reopened = await request(app, adminToken, {
      method: 'POST',
      url: `/projects/${project.id}/reopen`
    });
    expect(reopened.json().project.status).toBe('active');

    const repository = await request(app, adminToken, {
      method: 'POST',
      url: '/repositories',
      payload: {
        projectId: project.id,
        provider: 'github',
        owner: 'example-org',
        name: 'customer-portal',
        url: 'https://github.com/example-org/customer-portal',
        defaultBranch: 'main'
      }
    });
    expect(repository.statusCode).toBe(201);
    expect(repository.json().repository.projectId).toBe(project.id);

    const providerConfig = await request(app, adminToken, {
      method: 'POST',
      url: '/ai/provider-config',
      payload: {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        apiKey: 'sk-test-secret'
      }
    });
    expect(providerConfig.statusCode).toBe(201);
    expect(providerConfig.json().config.apiKey).toBeUndefined();
    expect(providerConfig.json().config.hasApiKey).toBe(true);

    const projectOverride = await request(app, adminToken, {
      method: 'PUT',
      url: `/projects/${project.id}/ai-provider`,
      payload: { provider: 'anthropic', model: 'claude-sonnet-4' }
    });
    expect(projectOverride.statusCode).toBe(200);
    expect(projectOverride.json().project.aiProviderOverride.provider).toBe('anthropic');

    const requirementCreated = await request(app, adminToken, {
      method: 'POST',
      url: `/projects/${project.id}/requirements`,
      payload: {
        title: 'Password reset',
        prompt: 'As a customer I need to reset my forgotten password using email verification.'
      }
    });
    expect(requirementCreated.statusCode).toBe(201);
    const requirement = requirementCreated.json().requirement;
    expect(requirement.aiSuggestions.missingScenarios).toContain('Negative and exception paths');

    const storyCreated = await request(app, adminToken, {
      method: 'POST',
      url: `/requirements/${requirement.id}/stories`,
      payload: {
        title: 'Customer requests password reset',
        narrative: 'As a customer, I want a password reset email so that I can regain access.'
      }
    });
    expect(storyCreated.statusCode).toBe(201);
    const story = storyCreated.json().story;

    const criteriaCreated = await request(app, adminToken, {
      method: 'POST',
      url: `/stories/${story.id}/acceptance-criteria`,
      payload: {}
    });
    expect(criteriaCreated.statusCode).toBe(201);
    expect(criteriaCreated.json().acceptanceCriteria).toHaveLength(3);

    const testsGenerated = await request(app, adminToken, {
      method: 'POST',
      url: `/stories/${story.id}/generate-tests`,
      payload: { includeNegative: true }
    });
    expect(testsGenerated.statusCode).toBe(201);
    expect(testsGenerated.json().testCases.some((testCase) => testCase.type === 'negative')).toBe(true);
    const testCase = testsGenerated.json().testCases[0];

    const execution = await request(app, adminToken, {
      method: 'POST',
      url: `/test-cases/${testCase.id}/executions`,
      payload: {
        status: 'fail',
        actualOutcome: 'No email arrived after 10 minutes.',
        notes: 'Retested twice.',
        evidence: [
          {
            fileName: 'reset-email-missing.png',
            mimeType: 'image/png',
            sizeBytes: 42000,
            url: 'https://evidence.example/reset-email-missing.png'
          }
        ]
      }
    });
    expect(execution.statusCode).toBe(201);
    expect(execution.json().execution.evidence[0].fileName).toBe('reset-email-missing.png');

    const dashboard = await request(app, adminToken, {
      method: 'GET',
      url: `/projects/${project.id}/dashboard`
    });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json().summary.results.fail).toBe(1);
    expect(dashboard.json().summary.releaseReadiness).toBe('not-ready');

    const failureSummary = await request(app, adminToken, {
      method: 'POST',
      url: `/projects/${project.id}/failure-summary`
    });
    expect(failureSummary.statusCode).toBe(200);
    expect(failureSummary.json().summary).toContain('Password reset');
    expect(failureSummary.json().probableCauses.length).toBeGreaterThan(0);

    const audit = await request(app, adminToken, {
      method: 'GET',
      url: `/audit?projectId=${project.id}`
    });
    expect(audit.statusCode).toBe(200);
    expect(audit.json().events.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        'project.created',
        'project.archived',
        'project.reopened',
        'repository.connected',
        'requirement.created',
        'testExecution.created'
      ])
    );
  });
});
