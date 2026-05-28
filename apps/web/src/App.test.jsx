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
    const rawPathname = new URL(url, 'http://localhost').pathname;
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
      if (body.newPassword !== body.confirmPassword) {
        return jsonResponse({ error: 'New password and confirmation must match' }, false, 400);
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
          disabled: false,
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
      const includeArchived = new URL(url, 'http://localhost').searchParams.get('includeArchived') === 'true';
      return jsonResponse({
        projects: includeArchived ? projects : projects.filter((project) => project.status === 'active')
      });
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

describe('Functional testing platform MVP', () => {
  it('supports login, role-aware user admin, and project dashboard visibility', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole('heading', {
        name: /AI-Driven Functional Testing and UAT Platform/i
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Signed out/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /User administration/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Project dashboard/i })).not.toBeInTheDocument();

    await signIn(user);

    expect(screen.getByText(/Signed in as Admin User/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign out/i })).toBeEnabled();

    const userAdmin = screen.getByRole('region', { name: /User administration/i });
    expect(within(userAdmin).getByText(/^Admin$/i)).toBeInTheDocument();
    expect(within(userAdmin).getByText(/^Project Manager$/i)).toBeInTheDocument();
    expect(within(userAdmin).getByText(/^Tester$/i)).toBeInTheDocument();
    expect(within(userAdmin).getByText(/^Viewer$/i)).toBeInTheDocument();

    const projectManagement = screen.getByRole('region', { name: /Project management/i });
    expect(within(projectManagement).getByText(/No projects yet/i)).toBeInTheDocument();
  });

  it('creates, selects, archives, and reopens projects through the API-backed project workflow', async () => {
    const user = userEvent.setup();
    render(<App />);

    await signIn(user);
    await user.type(screen.getByLabelText(/Project name/i), 'Claims Portal UAT');
    await user.type(screen.getByLabelText(/Project description/i), 'Regression coverage for release one.');
    await user.click(screen.getByRole('button', { name: /Create project/i }));

    const projectManagement = screen.getByRole('region', { name: /Project management/i });
    expect(within(projectManagement).getByText(/Claims Portal UAT/i)).toBeInTheDocument();
    expect(within(projectManagement).getByText(/Regression coverage for release one/i)).toBeInTheDocument();

    const dashboard = screen.getByRole('region', { name: /Project dashboard/i });
    expect(within(dashboard).getByText(/Claims Portal UAT/i)).toBeInTheDocument();
    expect(within(dashboard).getByText(/Release readiness/i)).toBeInTheDocument();
    expect(within(dashboard).getByText(/72%/i)).toBeInTheDocument();

    await user.click(within(projectManagement).getByRole('button', { name: /Archive/i }));
    expect(within(projectManagement).queryByText(/Claims Portal UAT/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Show archived projects/i }));
    expect(within(projectManagement).getAllByText(/^archived$/i).length).toBeGreaterThan(0);
    await user.click(within(projectManagement).getByRole('button', { name: /Reopen/i }));
    expect(within(projectManagement).getByText(/active/i)).toBeInTheDocument();
  });

  it('rejects weak passwords and lets a signed-in user update their password', async () => {
    const user = userEvent.setup();
    render(<App />);

    await signIn(user);
    const security = screen.getByRole('region', { name: /Account security/i });

    await user.type(within(security).getByLabelText(/Current password/i), 'password');
    await user.type(within(security).getByLabelText(/^New password$/i), 'weak');
    await user.type(within(security).getByLabelText(/Confirm new password/i), 'weak');
    await user.click(within(security).getByRole('button', { name: /Update password/i }));
    expect(within(security).getByText(/at least 12 characters/i)).toBeInTheDocument();

    await user.clear(within(security).getByLabelText(/Current password/i));
    await user.type(within(security).getByLabelText(/Current password/i), 'password');
    await user.clear(within(security).getByLabelText(/^New password$/i));
    await user.type(within(security).getByLabelText(/^New password$/i), 'Better-Password-123!');
    await user.clear(within(security).getByLabelText(/Confirm new password/i));
    await user.type(within(security).getByLabelText(/Confirm new password/i), 'Better-Password-123!');
    await user.click(within(security).getByRole('button', { name: /Update password/i }));

    expect(within(security).getByText(/Password updated successfully/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/password',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('connects a GitHub repository to the active project and records audit metadata', async () => {
    const user = userEvent.setup();
    render(<App />);

    await signIn(user);
    await user.clear(screen.getByLabelText(/Repository URL/i));
    await user.type(screen.getByLabelText(/Repository URL/i), 'https://github.com/acme/checkout-uplift');
    await user.click(screen.getByRole('button', { name: /Connect repository/i }));

    const integration = screen.getByRole('region', { name: /GitHub repository connection/i });
    expect(within(integration).getByText(/acme\/checkout-uplift/i)).toBeInTheDocument();
    expect(within(integration).getByText(/Connected/i)).toBeInTheDocument();

    const auditLog = screen.getByRole('region', { name: /Audit log/i });
    expect(within(auditLog).getByText(/Repository connected by Admin User/i)).toBeInTheDocument();
  });

  it('generates editable acceptance criteria, tests, and negative scenarios from AI collaboration', async () => {
    const user = userEvent.setup();
    render(<App />);

    await signIn(user);
    await user.clear(screen.getByLabelText(/Requirement prompt/i));
    await user.type(
      screen.getByLabelText(/Requirement prompt/i),
      'As a shopper, I need wallet payments to be validated before checkout completion.'
    );
    await user.click(screen.getByRole('button', { name: /Generate testing assets/i }));

    const generated = screen.getByRole('region', { name: /Generated testing assets/i });
    expect(
      within(generated).getByRole('heading', { name: /^Acceptance criteria$/i })
    ).toBeInTheDocument();
    expect(within(generated).getByRole('heading', { name: /^Functional tests$/i })).toBeInTheDocument();
    expect(
      within(generated).getByRole('heading', { name: /^Negative scenarios$/i })
    ).toBeInTheDocument();
    expect(within(generated).getAllByText(/wallet payments/i).length).toBeGreaterThan(0);

    const editableCriterion = screen.getByLabelText(/Editable acceptance criterion 1/i);
    await user.clear(editableCriterion);
    await user.type(editableCriterion, 'Wallet payments require valid token, billing country, and fraud checks.');

    expect(editableCriterion).toHaveValue(
      'Wallet payments require valid token, billing country, and fraud checks.'
    );
  });

  it('records manual execution, evidence metadata, failure summary, reports, and audit entries', async () => {
    const user = userEvent.setup();
    render(<App />);

    await signIn(user);
    await user.selectOptions(screen.getByLabelText(/Execution result/i), 'Fail');
    await user.clear(screen.getByLabelText(/Actual outcome/i));
    await user.type(screen.getByLabelText(/Actual outcome/i), 'Wallet token expired but checkout still completed.');
    await user.clear(screen.getByLabelText(/Screenshot evidence filename/i));
    await user.type(screen.getByLabelText(/Screenshot evidence filename/i), 'checkout-wallet-fail.png');
    await user.clear(screen.getByLabelText(/Evidence notes/i));
    await user.type(screen.getByLabelText(/Evidence notes/i), 'Screenshot captured in UAT at 10:42.');
    await user.clear(screen.getByLabelText(/Document evidence filename/i));
    await user.type(screen.getByLabelText(/Document evidence filename/i), 'wallet-uat-notes.pdf');
    await user.click(screen.getByRole('button', { name: /Save execution result/i }));

    const execution = screen.getByRole('region', { name: /Manual execution and evidence/i });
    expect(within(execution).getAllByText(/^Fail$/i).length).toBeGreaterThan(0);
    expect(within(execution).getByText(/checkout-wallet-fail.png/i)).toBeInTheDocument();
    expect(within(execution).getByText(/wallet-uat-notes.pdf/i)).toBeInTheDocument();
    expect(within(execution).getByRole('link', { name: /View screenshot evidence/i })).toHaveAttribute(
      'href',
      expect.stringContaining('data:image/png')
    );
    expect(within(execution).getByRole('link', { name: /Download document evidence/i })).toHaveAttribute(
      'download',
      'wallet-uat-notes.pdf'
    );
    expect(within(execution).getAllByText(/Screenshot captured in UAT at 10:42/i).length).toBeGreaterThan(
      0
    );

    const reports = screen.getByRole('region', { name: /Reports and failure summaries/i });
    expect(within(reports).getByText(/1 failed/i)).toBeInTheDocument();
    expect(within(reports).getByText(/Probable cause: validation gap/i)).toBeInTheDocument();
    expect(within(reports).getByText(/Release blocked pending review/i)).toBeInTheDocument();

    const auditLog = screen.getByRole('region', { name: /Audit log/i });
    expect(within(auditLog).getByText(/Execution marked Fail by Admin User/i)).toBeInTheDocument();
  });

  it('configures Bring Your Own AI provider defaults and project overrides', async () => {
    const user = userEvent.setup();
    render(<App />);

    await signIn(user);
    await user.selectOptions(screen.getByLabelText(/Default AI provider/i), 'Anthropic Claude');
    await user.clear(screen.getByLabelText(/Default model/i));
    await user.type(screen.getByLabelText(/Default model/i), 'claude-3-5-sonnet');
    await user.click(screen.getByRole('checkbox', { name: /Use project-level AI override/i }));
    await user.selectOptions(screen.getByLabelText(/Project AI provider/i), 'Azure OpenAI');
    await user.clear(screen.getByLabelText(/Project model/i));
    await user.type(screen.getByLabelText(/Project model/i), 'gpt-4o-enterprise');
    await user.click(screen.getByRole('button', { name: /Save AI settings/i }));

    const settings = screen.getByRole('region', { name: /Bring Your Own AI settings/i });
    expect(within(settings).getByText(/Default: Anthropic Claude \/ claude-3-5-sonnet/i)).toBeInTheDocument();
    expect(within(settings).getByText(/Project override: Azure OpenAI \/ gpt-4o-enterprise/i)).toBeInTheDocument();

    const auditLog = screen.getByRole('region', { name: /Audit log/i });
    expect(within(auditLog).getByText(/AI settings updated by Admin User/i)).toBeInTheDocument();
  });
});
