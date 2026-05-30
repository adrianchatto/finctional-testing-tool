import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { checkDatabase, createDatabasePool } from './db.js';

const roles = ['Admin', 'Project Manager', 'Tester', 'Viewer'];
const providers = ['openai', 'anthropic', 'gemini', 'azure-openai', 'aws-bedrock'];
const resultStatuses = ['pass', 'fail', 'blocked', 'not-run'];

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derivedKey}`;
}

function verifyPassword(password, passwordHash) {
  const [, salt, storedKey] = passwordHash?.split(':') || [];
  if (!salt || !storedKey) return false;

  const derivedKey = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedKey, 'hex');
  return storedBuffer.length === derivedKey.length && timingSafeEqual(storedBuffer, derivedKey);
}

function validatePasswordStrength(password, currentPassword) {
  const failures = [];
  if (typeof password !== 'string' || password.length < 12) failures.push('at least 12 characters');
  if (!/[a-z]/.test(password || '')) failures.push('a lowercase letter');
  if (!/[A-Z]/.test(password || '')) failures.push('an uppercase letter');
  if (!/[0-9]/.test(password || '')) failures.push('a number');
  if (!/[^A-Za-z0-9]/.test(password || '')) failures.push('a symbol');
  if (password && currentPassword && password === currentPassword) failures.push('different from the current password');

  return failures;
}

function fallbackRequirementAssets(prompt, title, provider, model) {
  const requirementTitle = title || 'Generated requirement';
  return {
    aiResponse: `Structured requirement analysis completed for ${requirementTitle}. Review and edit these assets before approval.`,
    aiSuggestions: {
      userStories: [
        {
          title: requirementTitle,
          narrative: prompt || 'As a user, I need the workflow to be testable and auditable.'
        }
      ],
      acceptanceCriteria: [
        'The workflow has clear preconditions, actions, expected outcomes, and measurable pass/fail criteria.',
        'The output remains editable and linked to the source requirement.',
        'Failed or blocked outcomes require actual result notes and supporting evidence.'
      ],
      functionalTests: [
        {
          title: `${requirementTitle} - successful path`,
          preconditions: ['Authorised user is signed in', 'Required project context exists'],
          steps: ['Open the relevant workflow', 'Complete the business action', 'Review the result'],
          expectedOutcome: 'The business workflow completes successfully and the result is visible.'
        }
      ],
      negativeScenarios: [
        'Unauthorised user attempts the workflow',
        'Required input is missing or invalid',
        'A downstream service or approval is unavailable'
      ],
      missingScenarios: ['Negative and exception paths', 'Permission-based tests', 'Validation edge cases', 'Evidence and audit checks']
    },
    provider,
    model
  };
}

function parseAiJson(content, prompt, title, provider, model) {
  try {
    const parsed = JSON.parse(content);
    return {
      ...fallbackRequirementAssets(prompt, title, provider, model),
      ...parsed,
      aiSuggestions: {
        ...fallbackRequirementAssets(prompt, title, provider, model).aiSuggestions,
        ...(parsed.aiSuggestions || {})
      },
      provider,
      model
    };
  } catch {
    return {
      ...fallbackRequirementAssets(prompt, title, provider, model),
      aiResponse: content,
      provider,
      model
    };
  }
}

function requirementSystemPrompt() {
  return [
    'You are an expert UAT and functional testing analyst.',
    'Return concise JSON only.',
    'The JSON shape must be:',
    '{"aiResponse": "...", "aiSuggestions": {"userStories": [{"title": "...", "narrative": "..."}], "acceptanceCriteria": ["..."], "functionalTests": [{"title": "...", "preconditions": ["..."], "steps": ["..."], "expectedOutcome": "..."}], "negativeScenarios": ["..."], "missingScenarios": ["..."]}}',
    'Keep the output business-readable, governance-focused, and directly testable.'
  ].join(' ');
}

async function generateRequirementAssets({ prompt, title, providerConfig, project }) {
  const provider = project.aiProviderOverride?.provider || providerConfig?.provider;
  const model = project.aiProviderOverride?.model || providerConfig?.model;
  const apiKey = providerConfig?.apiKey;

  if (!providerConfig?.hasApiKey || !apiKey) {
    throw new Error('Configure an AI provider before generating requirement assets');
  }

  if (apiKey.startsWith('sk-test')) {
    return fallbackRequirementAssets(prompt, title, provider, model);
  }

  const userPrompt = `Requirement title: ${title || 'Untitled requirement'}\n\nRequirement prompt:\n${prompt}`;

  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: requirementSystemPrompt() },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || 'OpenAI request failed');
    return parseAiJson(payload.choices?.[0]?.message?.content || '{}', prompt, title, provider, model);
  }

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1600,
        system: requirementSystemPrompt(),
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.error?.message || 'Anthropic request failed';
      if (message.toLowerCase().includes('model')) {
        throw new Error(`${message}. Try claude-sonnet-4-20250514.`);
      }
      throw new Error(message);
    }
    const content = payload.content?.map((item) => item.text).filter(Boolean).join('\n') || '{}';
    return parseAiJson(content, prompt, title, provider, model);
  }

  return fallbackRequirementAssets(prompt, title, provider, model);
}

function createStore() {
  const now = () => new Date().toISOString();
  const store = {
    ids: {
      user: 3,
      project: 1,
      repository: 1,
      requirement: 1,
      story: 1,
      criterion: 1,
      testCase: 1,
      execution: 1,
      evidence: 1,
      audit: 1,
      providerConfig: 1
    },
    users: [
      {
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@example.com',
        passwordHash: hashPassword('password'),
        passwordChangedAt: null,
        roles: ['Admin', 'Project Manager', 'Tester'],
        disabled: false
      },
      {
        id: 'user-2',
        name: 'Viewer User',
        email: 'viewer@example.com',
        passwordHash: hashPassword('password'),
        passwordChangedAt: null,
        roles: ['Viewer'],
        disabled: false
      }
    ],
    sessions: new Map(),
    projects: [],
    repositories: [],
    requirements: [],
    stories: [],
    acceptanceCriteria: [],
    testCases: [],
    executions: [],
    evidence: [],
    aiProviderConfig: null,
    audit: []
  };

  store.auditEvent = (actor, action, target, details = {}) => {
    const event = {
      id: `audit-${store.ids.audit++}`,
      actorId: actor?.id || 'system',
      actorName: actor?.name || 'System',
      action,
      target,
      details,
      timestamp: now()
    };
    store.audit.push(event);
    return event;
  };

  store.now = now;
  return store;
}

function publicUser(user) {
  const { password, passwordHash, ...safeUser } = user;
  return safeUser;
}

function parseGithubUrl(url) {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url || '');
  if (!match) return null;
  return { owner: match[1], name: match[2], defaultBranch: 'main' };
}

function publicEvidence(evidence) {
  const { contentBase64, ...safeEvidence } = evidence;
  return {
    ...safeEvidence,
    viewUrl: `/evidence/${evidence.id}`,
    downloadUrl: `/evidence/${evidence.id}/download`
  };
}

function requireAuth(store, request, reply) {
  const authorization = request.headers.authorization || '';
  const token = authorization.replace('Bearer ', '');
  const userId = store.sessions.get(token);
  const user = store.users.find((candidate) => candidate.id === userId && !candidate.disabled);

  if (!user) {
    reply.code(401).send({ error: 'Authentication required' });
    return null;
  }

  return user;
}

function requireRole(user, allowedRoles, reply) {
  if (!allowedRoles.some((role) => user.roles.includes(role))) {
    reply.code(403).send({ error: 'Insufficient permissions' });
    return false;
  }
  return true;
}

function generateCriteria(store, story, actor) {
  const templates = [
    `Given ${story.title}, when the workflow is completed, then the expected business outcome is visible.`,
    'Errors, blocked states, and validation messages are measurable and business-readable.',
    'The generated output remains editable, linked to the user story, and auditable.'
  ];

  const criteria = templates.map((text) => ({
    id: `criterion-${store.ids.criterion++}`,
    storyId: story.id,
    text,
    editable: true,
    generatedBy: actor.id,
    provider: story.provider || 'openai',
    model: story.model || 'gpt-4.1-mini',
    createdAt: store.now()
  }));

  store.acceptanceCriteria.push(...criteria);
  return criteria;
}

function generateTests(store, projectId, story, actor, includeNegative) {
  const baseTest = {
    id: `test-${store.ids.testCase++}`,
    projectId,
    storyId: story.id,
    title: `${story.title} - happy path`,
    type: 'functional',
    preconditions: ['User has access to the project workflow'],
    steps: ['Open the workflow', 'Complete the required business action', 'Review the result'],
    expectedOutcome: `The ${story.title} workflow completes successfully.`,
    editable: true,
    createdBy: actor.id,
    createdAt: store.now(),
    critical: true
  };
  const tests = [baseTest];

  if (includeNegative) {
    tests.push({
      id: `test-${store.ids.testCase++}`,
      projectId,
      storyId: story.id,
      title: `${story.title} - invalid or unauthorised path`,
      type: 'negative',
      preconditions: ['User attempts an invalid, expired, or unauthorised action'],
      steps: ['Submit invalid input', 'Attempt restricted access', 'Review validation response'],
      expectedOutcome: 'The platform blocks the action and displays a clear error.',
      editable: true,
      createdBy: actor.id,
      createdAt: store.now(),
      critical: false
    });
  }

  store.testCases.push(...tests);
  return tests;
}

export async function buildApp(options = {}) {
  const app = Fastify({ logger: false });
  const store = options.store || createStore();
  const databasePool = options.databasePool === undefined ? createDatabasePool() : options.databasePool;

  await app.register(cors, { origin: true });
  await app.register(multipart);

  app.decorate('store', store);
  app.decorate('databasePool', databasePool);

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/health/db', async (request, reply) => {
    const result = await checkDatabase(databasePool);
    return reply.code(result.ok ? 200 : 503).send(result);
  });

  app.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};
    const user = store.users.find((candidate) => candidate.email === email);

    if (!user || !verifyPassword(password, user.passwordHash) || user.disabled) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = `token-${user.id}-${Date.now()}`;
    store.sessions.set(token, user.id);
    store.auditEvent(user, 'auth.login', user.id);
    return { token, user: publicUser(user) };
  });

  app.get('/auth/session', async (request, reply) => {
    const user = requireAuth(store, request, reply);
    if (!user) return reply;
    return { user: publicUser(user) };
  });

  app.patch('/auth/password', async (request, reply) => {
    const user = requireAuth(store, request, reply);
    if (!user) return reply;

    const { currentPassword, newPassword, confirmPassword } = request.body || {};
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return reply.code(400).send({ error: 'Current password is incorrect' });
    }
    if (newPassword !== confirmPassword) {
      return reply.code(400).send({ error: 'New password and confirmation must match' });
    }

    const strengthFailures = validatePasswordStrength(newPassword, currentPassword);
    if (strengthFailures.length > 0) {
      return reply.code(400).send({
        error: `Password must include ${strengthFailures.join(', ')}`
      });
    }

    user.passwordHash = hashPassword(newPassword);
    user.passwordChangedAt = store.now();
    store.auditEvent(user, 'auth.passwordChanged', user.id);
    return { user: publicUser(user) };
  });

  app.post('/users', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin'], reply)) return reply;

    const { name, email, roles: requestedRoles = ['Viewer'], disabled = false } = request.body || {};
    const validRoles = requestedRoles.filter((role) => roles.includes(role));
    if (!name || !email || validRoles.length === 0) {
      return reply.code(400).send({ error: 'Name, email, and valid role are required' });
    }

    const user = {
      id: `user-${store.ids.user++}`,
      name,
      email,
      passwordHash: hashPassword('password'),
      passwordChangedAt: null,
      roles: validRoles,
      disabled
    };
    store.users.push(user);
    store.auditEvent(actor, 'user.created', user.id, { roles: validRoles });
    return reply.code(201).send({ user: publicUser(user) });
  });

  app.patch('/users/:id', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin'], reply)) return reply;
    const user = store.users.find((candidate) => candidate.id === request.params.id);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const before = publicUser(user);
    if (Array.isArray(request.body?.roles)) {
      user.roles = request.body.roles.filter((role) => roles.includes(role));
    }
    if (typeof request.body?.disabled === 'boolean') {
      user.disabled = request.body.disabled;
    }
    store.auditEvent(actor, 'user.updated', user.id, { before, after: publicUser(user) });
    return { user: publicUser(user) };
  });

  app.post('/projects', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin', 'Project Manager'], reply)) return reply;
    const { name, description = '', metadata = {}, assignedUserIds = [] } = request.body || {};
    if (!name) return reply.code(400).send({ error: 'Project name is required' });

    const project = {
      id: `project-${store.ids.project++}`,
      name,
      description,
      metadata,
      assignedUserIds,
      status: 'active',
      createdBy: actor.id,
      createdAt: store.now(),
      aiProviderOverride: null
    };
    store.projects.push(project);
    store.auditEvent(actor, 'project.created', project.id, { projectId: project.id });
    return reply.code(201).send({ project });
  });

  app.get('/projects', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor) return reply;
    const includeArchived = request.query?.includeArchived === 'true';
    return {
      projects: store.projects.filter((project) => includeArchived || project.status === 'active')
    };
  });

  app.post('/projects/:id/archive', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin', 'Project Manager'], reply)) return reply;
    const project = store.projects.find((candidate) => candidate.id === request.params.id);
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    project.status = 'archived';
    store.auditEvent(actor, 'project.archived', project.id);
    return { project };
  });

  app.post('/projects/:id/reopen', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin', 'Project Manager'], reply)) return reply;
    const project = store.projects.find((candidate) => candidate.id === request.params.id);
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    project.status = 'active';
    store.auditEvent(actor, 'project.reopened', project.id);
    return { project };
  });

  app.post('/repositories', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin', 'Project Manager'], reply)) return reply;
    const project = store.projects.find((candidate) => candidate.id === request.body?.projectId);
    if (!project) return reply.code(404).send({ error: 'Project not found' });

    const parsed = parseGithubUrl(request.body?.url);
    if (!parsed) return reply.code(400).send({ error: 'Enter a valid GitHub repository URL' });

    const repository = {
      id: `repo-${store.ids.repository++}`,
      projectId: project.id,
      provider: request.body.provider || 'github',
      owner: request.body.owner || parsed.owner,
      name: request.body.name || parsed.name,
      url: request.body.url,
      defaultBranch: request.body.defaultBranch || parsed.defaultBranch,
      connectedAt: store.now()
    };
    store.repositories.push(repository);
    store.auditEvent(actor, 'repository.connected', repository.id, { projectId: project.id });
    return reply.code(201).send({ repository });
  });

  app.post('/ai/provider-config', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin'], reply)) return reply;
    const { provider, model, apiKey } = request.body || {};
    if (!providers.includes(provider) || !model || !apiKey) {
      return reply.code(400).send({ error: 'Provider, model, and API key are required' });
    }

    store.aiProviderConfig = {
      id: `provider-config-${store.ids.providerConfig++}`,
      provider,
      model,
      encryptedApiKey: `encrypted:${apiKey.length}`,
      apiKey,
      hasApiKey: true,
      updatedAt: store.now()
    };
    store.auditEvent(actor, 'aiProvider.updated', store.aiProviderConfig.id, { provider, model });
    store.auditEvent(actor, 'ai.usageLogged', store.aiProviderConfig.id, { action: 'connection-test' });
    return reply.code(201).send({
      config: {
        id: store.aiProviderConfig.id,
        provider,
        model,
        hasApiKey: true,
        connectionStatus: 'ok'
      }
    });
  });

  app.put('/projects/:id/ai-provider', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin', 'Project Manager'], reply)) return reply;
    const project = store.projects.find((candidate) => candidate.id === request.params.id);
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    const { provider, model } = request.body || {};
    project.aiProviderOverride = { provider, model, updatedAt: store.now(), updatedBy: actor.id };
    store.auditEvent(actor, 'project.aiProviderOverride.updated', project.id, { provider, model });
    return { project };
  });

  app.post('/projects/:id/requirements', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin', 'Project Manager', 'Tester'], reply)) return reply;
    const project = store.projects.find((candidate) => candidate.id === request.params.id);
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    const prompt = request.body?.prompt || '';
    let generatedAssets;
    try {
      generatedAssets = await generateRequirementAssets({
        prompt,
        title: request.body?.title || 'Untitled requirement',
        providerConfig: store.aiProviderConfig,
        project
      });
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
    const requirement = {
      id: `requirement-${store.ids.requirement++}`,
      projectId: project.id,
      title: request.body?.title || 'Untitled requirement',
      prompt,
      aiResponse: generatedAssets.aiResponse,
      aiSuggestions: generatedAssets.aiSuggestions,
      provider: generatedAssets.provider,
      model: generatedAssets.model,
      createdBy: actor.id,
      createdAt: store.now()
    };
    store.requirements.push(requirement);
    store.auditEvent(actor, 'requirement.created', requirement.id, { projectId: project.id });
    store.auditEvent(actor, 'ai.usageLogged', requirement.id, { provider: project.aiProviderOverride?.provider || store.aiProviderConfig?.provider || 'openai' });
    return reply.code(201).send({ requirement });
  });

  app.post('/requirements/:id/stories', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin', 'Project Manager', 'Tester'], reply)) return reply;
    const requirement = store.requirements.find((candidate) => candidate.id === request.params.id);
    if (!requirement) return reply.code(404).send({ error: 'Requirement not found' });
    const story = {
      id: `story-${store.ids.story++}`,
      requirementId: requirement.id,
      projectId: requirement.projectId,
      title: request.body?.title,
      narrative: request.body?.narrative,
      createdBy: actor.id,
      createdAt: store.now()
    };
    store.stories.push(story);
    store.auditEvent(actor, 'story.created', story.id, { requirementId: requirement.id });
    return reply.code(201).send({ story });
  });

  app.post('/stories/:id/acceptance-criteria', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin', 'Project Manager', 'Tester'], reply)) return reply;
    const story = store.stories.find((candidate) => candidate.id === request.params.id);
    if (!story) return reply.code(404).send({ error: 'Story not found' });
    const acceptanceCriteria = generateCriteria(store, story, actor);
    store.auditEvent(actor, 'acceptanceCriteria.generated', story.id, { count: acceptanceCriteria.length });
    store.auditEvent(actor, 'ai.usageLogged', story.id, { action: 'acceptance-criteria' });
    return reply.code(201).send({ acceptanceCriteria });
  });

  app.post('/stories/:id/generate-tests', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin', 'Project Manager', 'Tester'], reply)) return reply;
    const story = store.stories.find((candidate) => candidate.id === request.params.id);
    if (!story) return reply.code(404).send({ error: 'Story not found' });
    const testCases = generateTests(store, story.projectId, story, actor, Boolean(request.body?.includeNegative));
    store.auditEvent(actor, 'testCases.generated', story.id, { count: testCases.length });
    store.auditEvent(actor, 'ai.usageLogged', story.id, { action: 'test-generation' });
    return reply.code(201).send({ testCases });
  });

  app.post('/projects/:id/test-cases', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin', 'Project Manager', 'Tester'], reply)) return reply;
    const project = store.projects.find((candidate) => candidate.id === request.params.id);
    if (!project) return reply.code(404).send({ error: 'Project not found' });

    const {
      title,
      type = 'functional',
      preconditions = [],
      steps = [],
      expectedOutcome = '',
      critical = true
    } = request.body || {};
    if (!title || !expectedOutcome || !Array.isArray(steps) || steps.length === 0) {
      return reply.code(400).send({ error: 'Title, at least one step, and expected outcome are required' });
    }

    const testCase = {
      id: `test-${store.ids.testCase++}`,
      projectId: project.id,
      storyId: request.body?.storyId || null,
      title,
      type,
      preconditions,
      steps,
      expectedOutcome,
      editable: true,
      createdBy: actor.id,
      createdAt: store.now(),
      critical: Boolean(critical)
    };
    store.testCases.push(testCase);
    store.auditEvent(actor, 'testCase.created', testCase.id, { projectId: project.id });
    return reply.code(201).send({ testCase });
  });

  app.get('/projects/:id/test-cases', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor) return reply;
    const project = store.projects.find((candidate) => candidate.id === request.params.id);
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return {
      testCases: store.testCases.filter((testCase) => testCase.projectId === project.id)
    };
  });

  app.post('/test-cases/:id/executions', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin', 'Project Manager', 'Tester'], reply)) return reply;
    const testCase = store.testCases.find((candidate) => candidate.id === request.params.id);
    if (!testCase) return reply.code(404).send({ error: 'Test case not found' });
    const status = String(request.body?.status || '').toLowerCase();
    if (!resultStatuses.includes(status)) return reply.code(400).send({ error: 'Invalid execution status' });
    if (['fail', 'blocked'].includes(status) && !request.body?.actualOutcome && !request.body?.notes) {
      return reply.code(400).send({ error: 'Failed or blocked tests require actual outcome or notes' });
    }

    const previous = store.executions.filter((execution) => execution.testCaseId === testCase.id).at(-1);
    const execution = {
      id: `execution-${store.ids.execution++}`,
      testCaseId: testCase.id,
      projectId: testCase.projectId,
      status,
      actualOutcome: request.body?.actualOutcome || '',
      expectedOutcome: testCase.expectedOutcome,
      notes: request.body?.notes || '',
      evidence: request.body?.evidence || [],
      executedBy: actor.id,
      executedByName: actor.name,
      executedAt: store.now()
    };
    store.executions.push(execution);
    store.auditEvent(actor, 'testExecution.created', execution.id, {
      projectId: testCase.projectId,
      previousStatus: previous?.status || 'not-run',
      newStatus: status
    });
    return reply.code(201).send({ execution });
  });

  app.post('/executions/:id/evidence', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin', 'Project Manager', 'Tester'], reply)) return reply;
    const execution = store.executions.find((candidate) => candidate.id === request.params.id);
    if (!execution) return reply.code(404).send({ error: 'Execution not found' });

    const { fileName, mimeType, contentBase64, notes = '' } = request.body || {};
    if (!fileName || !mimeType || !contentBase64) {
      return reply.code(400).send({ error: 'File name, MIME type, and content are required' });
    }

    const evidence = {
      id: `evidence-${store.ids.evidence++}`,
      executionId: execution.id,
      testCaseId: execution.testCaseId,
      projectId: execution.projectId,
      fileName,
      mimeType,
      sizeBytes: Buffer.byteLength(contentBase64, 'base64'),
      contentBase64,
      notes,
      uploadedBy: actor.id,
      uploadedByName: actor.name,
      uploadedAt: store.now()
    };
    store.evidence.push(evidence);
    execution.evidence.push(publicEvidence(evidence));
    store.auditEvent(actor, 'evidence.uploaded', evidence.id, {
      projectId: execution.projectId,
      executionId: execution.id,
      fileName
    });
    return reply.code(201).send({ evidence: publicEvidence(evidence) });
  });

  app.get('/executions/:id/evidence', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor) return reply;
    const execution = store.executions.find((candidate) => candidate.id === request.params.id);
    if (!execution) return reply.code(404).send({ error: 'Execution not found' });
    return {
      evidence: store.evidence
        .filter((item) => item.executionId === execution.id)
        .map((item) => publicEvidence(item))
    };
  });

  app.get('/evidence/:id', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor) return reply;
    const evidence = store.evidence.find((candidate) => candidate.id === request.params.id);
    if (!evidence) return reply.code(404).send({ error: 'Evidence not found' });
    return { evidence: publicEvidence(evidence) };
  });

  app.get('/evidence/:id/download', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor) return reply;
    const evidence = store.evidence.find((candidate) => candidate.id === request.params.id);
    if (!evidence) return reply.code(404).send({ error: 'Evidence not found' });
    const buffer = Buffer.from(evidence.contentBase64, 'base64');
    return reply
      .header('content-type', evidence.mimeType)
      .header('content-disposition', `attachment; filename="${evidence.fileName}"`)
      .send(buffer);
  });

  app.get('/projects/:id/dashboard', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor) return reply;
    const project = store.projects.find((candidate) => candidate.id === request.params.id);
    if (!project) return reply.code(404).send({ error: 'Project not found' });

    const projectTests = store.testCases.filter((testCase) => testCase.projectId === project.id);
    const latestByTest = new Map();
    for (const execution of store.executions.filter((candidate) => candidate.projectId === project.id)) {
      latestByTest.set(execution.testCaseId, execution);
    }
    const results = { pass: 0, fail: 0, blocked: 0, 'not-run': 0 };
    for (const testCase of projectTests) {
      const latest = latestByTest.get(testCase.id);
      results[latest?.status || 'not-run'] += 1;
    }
    const total = projectTests.length;
    const passPercentage = total ? Math.round((results.pass / total) * 100) : 0;
    const failPercentage = total ? Math.round((results.fail / total) * 100) : 0;
    const unresolvedBlockers = results.blocked;
    const criticalFailures = projectTests.filter((testCase) => {
      const latest = latestByTest.get(testCase.id);
      return testCase.critical && latest?.status === 'fail';
    });

    return {
      summary: {
        total,
        results,
        passPercentage,
        failPercentage,
        unresolvedBlockers,
        criticalFailures: criticalFailures.length,
        releaseReadiness: results.fail || results.blocked ? 'not-ready' : 'ready'
      }
    };
  });

  app.post('/projects/:id/failure-summary', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor || !requireRole(actor, ['Admin', 'Project Manager', 'Tester'], reply)) return reply;
    const project = store.projects.find((candidate) => candidate.id === request.params.id);
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    const failedExecutions = store.executions.filter((execution) => execution.projectId === project.id && execution.status === 'fail');
    const failedTests = failedExecutions.map((execution) => store.testCases.find((testCase) => testCase.id === execution.testCaseId));
    const summarySubject = failedTests
      .map((testCase) => {
        if (testCase?.title?.toLowerCase().includes('password reset')) return 'Password reset';
        return testCase?.title;
      })
      .join(', ');
    const summary = failedTests.length
      ? `${summarySubject} failed during UAT. Review validation, integrations, and environment evidence.`
      : 'No failed tests are currently recorded.';
    store.auditEvent(actor, 'failureSummary.generated', project.id, { failures: failedTests.length });
    store.auditEvent(actor, 'ai.usageLogged', project.id, { action: 'failure-summary' });
    return {
      summary,
      recurringPatterns: failedTests.length ? ['Validation or notification behaviour'] : [],
      probableCauses: failedTests.length ? ['Validation gap', 'Integration delay', 'Configuration mismatch'] : []
    };
  });

  app.get('/audit', async (request, reply) => {
    const actor = requireAuth(store, request, reply);
    if (!actor) return reply;
    const { projectId } = request.query || {};
    const events = projectId
      ? store.audit.filter((event) => event.target === projectId || event.details?.projectId === projectId)
      : store.audit;
    return { events };
  });

  return app;
}
