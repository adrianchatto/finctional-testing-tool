import { cleanup, render, screen, within } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.jsx';

expect.extend(matchers);

let projects;
let activePassword;

function jsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload
  };
}

beforeEach(() => {
  projects = [];
  activePassword = 'password';
  global.fetch = vi.fn(async (url, options = {}) => {
    const requestUrl = new URL(url, 'http://localhost');
    const rawPathname = requestUrl.pathname;
    const pathname = rawPathname.startsWith('/api/') ? rawPathname.replace('/api', '') : rawPathname;
    const body = options.body ? JSON.parse(options.body) : {};

    if (pathname === '/auth/login') {
      if (body.email !== 'admin@example.com' || body.password !== activePassword) {
        return jsonResponse({ error: 'Invalid credentials' }, false, 401);
      }
      return jsonResponse({
        token: 'test-token',
        user: {
          id: 'user-1',
          name: 'Admin User',
          email: 'admin@example.com',
          roles: ['Admin', 'Project Manager', 'Tester', 'Viewer'],
          disabled: false
        }
      });
    }

    if (pathname === '/auth/password') {
      if (body.currentPassword !== activePassword) {
        return jsonResponse({ error: 'Current password is incorrect' }, false, 400);
      }
      if (body.newPassword.length < 12) {
        return jsonResponse({ error: 'Password must include at least 12 characters' }, false, 400);
      }
      activePassword = body.newPassword;
      return jsonResponse({
        user: {
          id: 'user-1',
          name: 'Admin User',
          email: 'admin@example.com',
          roles: ['Admin', 'Project Manager', 'Tester', 'Viewer'],
          passwordChangedAt: new Date().toISOString()
        }
      });
    }

    if (pathname === '/projects' && options.method === 'POST') {
      const project = {
        id: `project-${projects.length + 1}`,
        name: body.name,
        description: body.description,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      projects = [project, ...projects];
      return jsonResponse({ project }, true, 201);
    }

    if (pathname === '/projects') {
      const includeArchived = requestUrl.searchParams.get('includeArchived') === 'true';
      return jsonResponse({
        projects: includeArchived ? projects : projects.filter((project) => project.status === 'active')
      });
    }

    if (pathname === '/repositories') {
      return jsonResponse({
        repository: {
          id: 'repo-1',
          projectId: body.projectId,
          owner: 'acme',
          name: 'checkout-uplift',
          url: body.url
        }
      }, true, 201);
    }

    if (pathname === '/ai/provider-config') {
      return jsonResponse({
        config: {
          id: 'provider-config-1',
          provider: body.provider,
          model: body.model,
          hasApiKey: true,
          connectionStatus: 'ok'
        }
      }, true, 201);
    }

    const requirementMatch = pathname.match(/^\/projects\/([^/]+)\/requirements$/);
    if (requirementMatch) {
      return jsonResponse({
        requirement: {
          id: 'requirement-1',
          projectId: requirementMatch[1],
          title: body.title,
          prompt: body.prompt,
          aiResponse: 'Structured requirement analysis completed.',
          aiSuggestions: {
            userStories: [{ title: 'Password reset', narrative: 'As a user, I can reset my password.' }],
            acceptanceCriteria: ['Reset request sends a verification email.'],
            functionalTests: [{ title: 'Password reset happy path', expectedOutcome: 'A reset email is sent.' }],
            negativeScenarios: ['Expired reset token is rejected.']
          }
        }
      }, true, 201);
    }

    const archiveMatch = pathname.match(/^\/projects\/([^/]+)\/archive$/);
    if (archiveMatch) {
      const project = projects.find((candidate) => candidate.id === archiveMatch[1]);
      project.status = 'archived';
      return jsonResponse({ project });
    }

    const reopenMatch = pathname.match(/^\/projects\/([^/]+)\/reopen$/);
    if (reopenMatch) {
      const project = projects.find((candidate) => candidate.id === reopenMatch[1]);
      project.status = 'active';
      return jsonResponse({ project });
    }

    return jsonResponse({ error: 'Not found' }, false, 404);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function signIn(user) {
  await user.click(screen.getByRole('button', { name: /^Sign in$/i }));
}

async function createProject(user) {
  await user.type(screen.getByLabelText(/Project name/i), 'Claims Portal UAT');
  await user.type(screen.getByLabelText(/Project description/i), 'Regression coverage for release one.');
  await user.click(screen.getByRole('button', { name: /Create project/i }));
}

describe('Functional testing platform', () => {
  it('gates the workspace behind login and shows section navigation after sign in', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: /AI-Driven Functional Testing and UAT Platform/i })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /Workspace sections/i })).not.toBeInTheDocument();

    await signIn(user);

    expect(screen.getByText(/Signed in as Admin User/i)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Workspace sections/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Account security/i })).not.toBeInTheDocument();
  });

  it('creates, selects, archives, and reopens projects in the Projects section', async () => {
    const user = userEvent.setup();
    render(<App />);

    await signIn(user);
    await createProject(user);

    const projectManagement = screen.getByRole('region', { name: /Project management/i });
    expect(within(projectManagement).getByText(/Claims Portal UAT/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Claims Portal UAT/i })).toBeInTheDocument();

    await user.click(within(projectManagement).getByRole('button', { name: /Archive/i }));
    expect(within(projectManagement).queryByText(/Claims Portal UAT/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Show archived projects/i }));
    expect(within(projectManagement).getAllByText(/^archived$/i).length).toBeGreaterThan(0);
    await user.click(within(projectManagement).getByRole('button', { name: /Reopen/i }));
    expect(within(projectManagement).getByText(/^active$/i)).toBeInTheDocument();
  });

  it('connects a GitHub repository to the selected project', async () => {
    const user = userEvent.setup();
    render(<App />);

    await signIn(user);
    await createProject(user);
    await user.type(screen.getByLabelText(/Repository URL/i), 'https://github.com/acme/checkout-uplift');
    await user.click(screen.getByRole('button', { name: /Connect repository/i }));

    expect(screen.getByText(/acme\/checkout-uplift connected/i)).toBeInTheDocument();
  });

  it('configures BYOAI and generates requirement assets from the Requirements section', async () => {
    const user = userEvent.setup();
    render(<App />);

    await signIn(user);
    await createProject(user);
    await user.click(screen.getByRole('button', { name: /Requirements & AI/i }));

    await user.selectOptions(screen.getByLabelText(/^Provider$/i), 'anthropic');
    await user.clear(screen.getByLabelText(/^Model$/i));
    await user.type(screen.getByLabelText(/^Model$/i), 'claude-3-5-sonnet-latest');
    await user.type(screen.getByLabelText(/API key/i), 'sk-test-secret');
    await user.click(screen.getByRole('button', { name: /Save AI settings/i }));
    expect(screen.getByText(/configured with claude-3-5-sonnet-latest/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Requirement title/i), 'Password reset');
    await user.type(screen.getByLabelText(/Requirement prompt/i), 'As a user, I can reset my password.');
    await user.click(screen.getByRole('button', { name: /Generate test assets/i }));

    expect(screen.getByText(/Structured requirement analysis completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Reset request sends a verification email/i)).toBeInTheDocument();
    expect(screen.getByText(/Expired reset token is rejected/i)).toBeInTheDocument();
  });

  it('keeps account security out of the project workspace and updates password only in Account', async () => {
    const user = userEvent.setup();
    render(<App />);

    await signIn(user);
    expect(screen.queryByRole('region', { name: /Account security/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Account$/i }));
    const security = screen.getByRole('region', { name: /Account security/i });

    await user.type(within(security).getByLabelText(/Current password/i), 'password');
    await user.type(within(security).getByLabelText(/^New password$/i), 'weak');
    await user.type(within(security).getByLabelText(/Confirm new password/i), 'weak');
    await user.click(within(security).getByRole('button', { name: /Update password/i }));
    expect(within(security).getByText(/at least 12 characters/i)).toBeInTheDocument();

    await user.clear(within(security).getByLabelText(/^New password$/i));
    await user.type(within(security).getByLabelText(/^New password$/i), 'Better-Password-123!');
    await user.clear(within(security).getByLabelText(/Confirm new password/i));
    await user.type(within(security).getByLabelText(/Confirm new password/i), 'Better-Password-123!');
    await user.click(within(security).getByRole('button', { name: /Update password/i }));
    expect(within(security).getByText(/Password updated successfully/i)).toBeInTheDocument();
  });

  it('records manual execution in the UAT Execution section', async () => {
    const user = userEvent.setup();
    render(<App />);

    await signIn(user);
    await user.click(screen.getByRole('button', { name: /UAT Execution/i }));
    await user.selectOptions(screen.getByLabelText(/Execution result/i), 'Fail');
    await user.type(screen.getByLabelText(/Actual outcome/i), 'Wallet token expired but checkout still completed.');
    await user.type(screen.getByLabelText(/Evidence notes/i), 'Screenshot captured in UAT.');
    await user.click(screen.getByRole('button', { name: /Save execution result/i }));

    const execution = screen.getByRole('region', { name: /Manual execution and evidence/i });
    expect(within(execution).getAllByText(/^Fail$/i).length).toBeGreaterThan(0);
    expect(within(execution).getAllByText(/Wallet token expired/i).length).toBeGreaterThan(0);
  });
});
