import { useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  ClipboardCheck,
  FileText,
  Github,
  KeyRound,
  LogIn,
  LogOut,
  ShieldCheck,
  Users
} from 'lucide-react';
import { apiRequest } from './api.js';

const providerOptions = [
  { value: 'openai', label: 'OpenAI / ChatGPT', defaultModel: 'gpt-4o-mini' },
  { value: 'anthropic', label: 'Anthropic Claude', defaultModel: 'claude-3-5-sonnet-latest' },
  { value: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-1.5-pro' },
  { value: 'azure-openai', label: 'Azure OpenAI', defaultModel: 'gpt-4o' },
  { value: 'aws-bedrock', label: 'AWS Bedrock', defaultModel: 'anthropic.claude-3-5-sonnet' }
];

function createAudit(message) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    message,
    timestamp: new Date().toLocaleString()
  };
}

export function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [activeView, setActiveView] = useState('projects');
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('admin@example.com');
  const [loginPassword, setLoginPassword] = useState('password');
  const [authError, setAuthError] = useState('');

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [projectError, setProjectError] = useState('');

  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [repositoryStatus, setRepositoryStatus] = useState(null);

  const [aiProvider, setAiProvider] = useState('openai');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiSettingsStatus, setAiSettingsStatus] = useState(null);

  const [requirementTitle, setRequirementTitle] = useState('');
  const [requirementPrompt, setRequirementPrompt] = useState('');
  const [requirementResult, setRequirementResult] = useState(null);
  const [requirementStatus, setRequirementStatus] = useState(null);

  const [executionResult, setExecutionResult] = useState('Not Run');
  const [actualOutcome, setActualOutcome] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [savedExecution, setSavedExecution] = useState(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState(null);

  const [audit, setAudit] = useState([
    createAudit('Workspace initialised'),
    createAudit('Audit history cannot be deleted')
  ]);

  const activeProjects = projects.filter((project) => project.status === 'active');
  const visibleProjects = showArchived ? projects : activeProjects;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || activeProjects[0] || null;
  const displayName = currentUser?.name || 'Signed-in user';
  const userRoles = currentUser?.roles || [];
  const selectedProvider = providerOptions.find((provider) => provider.value === aiProvider);

  const latestRequirement = requirementResult?.aiSuggestions || {};
  const failCount = savedExecution?.result === 'Fail' ? 1 : 0;
  const blockedCount = savedExecution?.result === 'Blocked' ? 1 : 0;
  const passedCount = savedExecution?.result === 'Pass' ? 1 : 0;
  const total = passedCount + failCount + blockedCount;
  const passRate = total ? Math.round((passedCount / total) * 100) : 0;

  const navItems = useMemo(
    () => [
      ['projects', 'Projects'],
      ['requirements', 'Requirements & AI'],
      ['uat', 'UAT Execution'],
      ['admin', 'Admin'],
      ['account', 'Account']
    ],
    []
  );

  function addAudit(message) {
    setAudit((current) => [createAudit(message), ...current]);
  }

  async function loadProjects(nextToken, includeArchived = showArchived) {
    const payload = await apiRequest(`/projects${includeArchived ? '?includeArchived=true' : ''}`, {
      token: nextToken
    });
    setProjects(payload.projects);
    setSelectedProjectId((current) => {
      if (payload.projects.some((project) => project.id === current)) return current;
      return payload.projects.find((project) => project.status === 'active')?.id || payload.projects[0]?.id || '';
    });
  }

  async function signIn(event) {
    event?.preventDefault();
    setAuthError('');
    try {
      const payload = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: loginEmail, password: loginPassword }
      });
      setToken(payload.token);
      setCurrentUser(payload.user);
      setSignedIn(true);
      await loadProjects(payload.token, showArchived);
      addAudit(`Login completed by ${payload.user.name}`);
    } catch (error) {
      setAuthError(error.message);
    }
  }

  function signOut() {
    setSignedIn(false);
    setToken('');
    setCurrentUser(null);
    setProjects([]);
    setSelectedProjectId('');
    setActiveView('projects');
  }

  async function createProject(event) {
    event.preventDefault();
    setProjectError('');
    try {
      const payload = await apiRequest('/projects', {
        method: 'POST',
        token,
        body: { name: projectName, description: projectDescription }
      });
      setProjects((current) => [payload.project, ...current]);
      setSelectedProjectId(payload.project.id);
      setProjectName('');
      setProjectDescription('');
      addAudit(`Project created by ${displayName}: ${payload.project.name}`);
    } catch (error) {
      setProjectError(error.message);
    }
  }

  async function archiveProject(projectId) {
    const payload = await apiRequest(`/projects/${projectId}/archive`, { method: 'POST', token });
    setProjects((current) => current.map((project) => (project.id === payload.project.id ? payload.project : project)));
    addAudit(`Project archived by ${displayName}: ${payload.project.name}`);
  }

  async function reopenProject(projectId) {
    const payload = await apiRequest(`/projects/${projectId}/reopen`, { method: 'POST', token });
    setProjects((current) => current.map((project) => (project.id === payload.project.id ? payload.project : project)));
    setSelectedProjectId(payload.project.id);
    addAudit(`Project reopened by ${displayName}: ${payload.project.name}`);
  }

  async function connectRepository(event) {
    event.preventDefault();
    setRepositoryStatus(null);
    if (!selectedProject) {
      setRepositoryStatus({ type: 'error', message: 'Create or select a project before connecting a repository.' });
      return;
    }
    try {
      const payload = await apiRequest('/repositories', {
        method: 'POST',
        token,
        body: { projectId: selectedProject.id, url: repositoryUrl }
      });
      setRepositoryStatus({ type: 'success', message: `${payload.repository.owner}/${payload.repository.name} connected.` });
      addAudit(`Repository connected by ${displayName}: ${payload.repository.owner}/${payload.repository.name}`);
    } catch (error) {
      setRepositoryStatus({ type: 'error', message: error.message });
    }
  }

  async function saveAiSettings(event) {
    event.preventDefault();
    setAiSettingsStatus(null);
    try {
      const payload = await apiRequest('/ai/provider-config', {
        method: 'POST',
        token,
        body: { provider: aiProvider, model: aiModel, apiKey: aiApiKey }
      });
      setAiApiKey('');
      setAiSettingsStatus({
        type: 'success',
        message: `${selectedProvider?.label || payload.config.provider} configured with ${payload.config.model}.`
      });
      addAudit(`AI provider configured by ${displayName}: ${payload.config.provider}`);
    } catch (error) {
      setAiSettingsStatus({ type: 'error', message: error.message });
    }
  }

  async function generateTestingAssets(event) {
    event.preventDefault();
    setRequirementStatus(null);
    if (!selectedProject) {
      setRequirementStatus({ type: 'error', message: 'Create or select a project before generating testing assets.' });
      return;
    }
    try {
      const payload = await apiRequest(`/projects/${selectedProject.id}/requirements`, {
        method: 'POST',
        token,
        body: {
          title: requirementTitle || 'Generated requirement',
          prompt: requirementPrompt
        }
      });
      setRequirementResult(payload.requirement);
      setRequirementStatus({ type: 'success', message: 'Requirement assets generated.' });
      addAudit(`AI generated requirement assets by ${displayName}`);
    } catch (error) {
      setRequirementStatus({ type: 'error', message: error.message });
    }
  }

  function saveExecution() {
    const execution = { result: executionResult, actualOutcome, evidenceNotes };
    setSavedExecution(execution);
    addAudit(`Execution marked ${executionResult} by ${displayName}`);
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordStatus(null);
    try {
      const payload = await apiRequest('/auth/password', {
        method: 'PATCH',
        token,
        body: { currentPassword, newPassword, confirmPassword }
      });
      setCurrentUser(payload.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus({ type: 'success', message: 'Password updated successfully.' });
      addAudit(`Password changed by ${displayName}`);
    } catch (error) {
      setPasswordStatus({ type: 'error', message: error.message });
    }
  }

  if (!signedIn) {
    return (
      <main className="app-shell login-shell">
        <section className="login-card" aria-label="Sign in">
          <p className="eyebrow">Functional testing workspace</p>
          <h1>AI-Driven Functional Testing and UAT Platform</h1>
          <p className="intro">
            Sign in to manage projects, configure your AI provider, generate UAT assets, and track release readiness.
          </p>
          <form className="login-form" onSubmit={signIn}>
            <label htmlFor="login-email">Email</label>
            <input id="login-email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} />
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
            />
            {authError && <p className="form-error">{authError}</p>}
            <button className="primary-button" type="submit">
              <LogIn size={18} aria-hidden="true" />
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Functional testing workspace</p>
          <h1>{selectedProject?.name || 'Projects'}</h1>
          <p className="intro">
            {selectedProject?.description || 'Create a project, connect context, configure AI, and generate reviewed UAT assets.'}
          </p>
        </div>
        <div className="session-panel" aria-label="Session status">
          <p className="label">Signed in as {displayName}</p>
          <button className="secondary-button" type="button" onClick={() => setActiveView('account')}>
            <KeyRound size={16} aria-hidden="true" />
            Account security
          </button>
          <button className="secondary-button" type="button" onClick={signOut}>
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </header>

      <nav className="workspace-nav" aria-label="Workspace sections">
        {navItems.map(([view, label]) => (
          <button
            className={activeView === view ? 'nav-button active' : 'nav-button'}
            key={view}
            type="button"
            onClick={() => setActiveView(view)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeView === 'projects' && (
        <div className="workspace-grid">
          <section className="panel span-2" aria-label="Project management">
            <div className="section-title">
              <Activity size={18} aria-hidden="true" />
              <h2>Projects</h2>
            </div>
            <form className="project-create-form" onSubmit={createProject}>
              <label htmlFor="project-name">Project name</label>
              <input
                id="project-name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="e.g. Claims Portal UAT"
              />
              <label htmlFor="project-description">Project description</label>
              <textarea
                id="project-description"
                rows="3"
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
                placeholder="Describe the release, workflow, customer, or scope."
              />
              {projectError && <p className="form-error">{projectError}</p>}
              <button className="primary-button" type="submit">
                Create project
              </button>
            </form>
            <label className="checkbox-row project-toggle">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={async (event) => {
                  setShowArchived(event.target.checked);
                  await loadProjects(token, event.target.checked);
                }}
              />
              Show archived projects
            </label>
            <div className="project-list">
              {visibleProjects.length === 0 ? (
                <p className="section-copy">No projects yet. Create one to start UAT planning.</p>
              ) : (
                visibleProjects.map((project) => (
                  <article className="project-row" key={project.id}>
                    <button
                      className="project-select"
                      type="button"
                      onClick={() => setSelectedProjectId(project.id)}
                      aria-pressed={selectedProjectId === project.id}
                    >
                      <strong>{project.name}</strong>
                      <span>{project.description || 'No description provided.'}</span>
                    </button>
                    <span className={project.status === 'active' ? 'status-pill success' : 'status-pill neutral'}>
                      {project.status}
                    </span>
                    {project.status === 'active' ? (
                      <button className="secondary-button" type="button" onClick={() => archiveProject(project.id)}>
                        Archive
                      </button>
                    ) : (
                      <button className="secondary-button" type="button" onClick={() => reopenProject(project.id)}>
                        Reopen
                      </button>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel" aria-label="GitHub repository connection">
            <div className="section-title">
              <Github size={18} aria-hidden="true" />
              <h2>GitHub repository</h2>
            </div>
            <form className="stack-form" onSubmit={connectRepository}>
              <label htmlFor="repository-url">Repository URL</label>
              <input
                id="repository-url"
                value={repositoryUrl}
                onChange={(event) => setRepositoryUrl(event.target.value)}
                placeholder="https://github.com/org/repo"
              />
              {repositoryStatus && (
                <p className={repositoryStatus.type === 'success' ? 'form-success' : 'form-error'}>
                  {repositoryStatus.message}
                </p>
              )}
              <button className="primary-button" type="submit">
                Connect repository
              </button>
            </form>
          </section>
        </div>
      )}

      {activeView === 'requirements' && (
        <div className="workspace-grid">
          <section className="panel" aria-label="AI provider settings">
            <div className="section-title">
              <KeyRound size={18} aria-hidden="true" />
              <h2>AI provider</h2>
            </div>
            <form className="stack-form" onSubmit={saveAiSettings}>
              <label htmlFor="default-provider">Provider</label>
              <select
                id="default-provider"
                value={aiProvider}
                onChange={(event) => {
                  const provider = providerOptions.find((option) => option.value === event.target.value);
                  setAiProvider(event.target.value);
                  setAiModel(provider?.defaultModel || '');
                }}
              >
                {providerOptions.map((provider) => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>
              <label htmlFor="default-model">Model</label>
              <input id="default-model" value={aiModel} onChange={(event) => setAiModel(event.target.value)} />
              <label htmlFor="ai-api-key">API key</label>
              <input
                id="ai-api-key"
                type="password"
                value={aiApiKey}
                onChange={(event) => setAiApiKey(event.target.value)}
                placeholder="Paste your provider API key"
              />
              {aiSettingsStatus && (
                <p className={aiSettingsStatus.type === 'success' ? 'form-success' : 'form-error'}>
                  {aiSettingsStatus.message}
                </p>
              )}
              <button className="primary-button" type="submit">
                Save AI settings
              </button>
            </form>
          </section>

          <section className="panel span-2" aria-label="Generated testing assets">
            <div className="section-title">
              <Bot size={18} aria-hidden="true" />
              <h2>Requirement analysis</h2>
            </div>
            <form className="stack-form" onSubmit={generateTestingAssets}>
              <label htmlFor="requirement-title">Requirement title</label>
              <input
                id="requirement-title"
                value={requirementTitle}
                onChange={(event) => setRequirementTitle(event.target.value)}
                placeholder="e.g. Password reset"
              />
              <label htmlFor="requirement-prompt">Requirement prompt</label>
              <textarea
                id="requirement-prompt"
                rows="7"
                value={requirementPrompt}
                onChange={(event) => setRequirementPrompt(event.target.value)}
                placeholder="Paste the requirement or business workflow to analyse."
              />
              {requirementStatus && (
                <p className={requirementStatus.type === 'success' ? 'form-success' : 'form-error'}>
                  {requirementStatus.message}
                </p>
              )}
              <button className="primary-button" type="submit">
                Generate test assets
              </button>
            </form>
            {requirementResult && (
              <div className="ai-output">
                <h3>AI summary</h3>
                <p>{requirementResult.aiResponse}</p>
                <h3>User stories</h3>
                <ul className="asset-list">
                  {(latestRequirement.userStories || []).map((story) => (
                    <li key={story.title}>
                      <strong>{story.title}</strong>: {story.narrative}
                    </li>
                  ))}
                </ul>
                <h3>Acceptance criteria</h3>
                <ul className="asset-list">
                  {(latestRequirement.acceptanceCriteria || []).map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
                <h3>Functional tests</h3>
                <ul className="asset-list">
                  {(latestRequirement.functionalTests || []).map((test) => (
                    <li key={test.title}>
                      <strong>{test.title}</strong>: {test.expectedOutcome}
                    </li>
                  ))}
                </ul>
                <h3>Negative scenarios</h3>
                <ul className="asset-list">
                  {(latestRequirement.negativeScenarios || latestRequirement.missingScenarios || []).map((scenario) => (
                    <li key={scenario}>{scenario}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}

      {activeView === 'uat' && (
        <div className="workspace-grid">
          <section className="panel span-2" aria-label="Project dashboard">
            <div className="section-title">
              <FileText size={18} aria-hidden="true" />
              <h2>Release dashboard</h2>
            </div>
            <div className="metric-row">
              <div className="metric metric-neutral">
                <strong>{total}</strong>
                <span>Total tests</span>
              </div>
              <div className="metric metric-success">
                <strong>{passedCount}</strong>
                <span>Passed</span>
              </div>
              <div className="metric metric-danger">
                <strong>{failCount}</strong>
                <span>Failed</span>
              </div>
              <div className="metric metric-warning">
                <strong>{blockedCount}</strong>
                <span>Blocked</span>
              </div>
            </div>
            <p className="status-pill neutral">{passRate}% pass rate</p>
          </section>

          <section className="panel" aria-label="Manual execution and evidence">
            <div className="section-title">
              <ClipboardCheck size={18} aria-hidden="true" />
              <h2>Manual execution</h2>
            </div>
            <div className="stack-form">
              <label htmlFor="execution-result">Execution result</label>
              <select
                id="execution-result"
                value={executionResult}
                onChange={(event) => setExecutionResult(event.target.value)}
              >
                <option>Pass</option>
                <option>Fail</option>
                <option>Blocked</option>
                <option>Not Run</option>
              </select>
              <label htmlFor="actual-outcome">Actual outcome</label>
              <textarea
                id="actual-outcome"
                rows="3"
                value={actualOutcome}
                onChange={(event) => setActualOutcome(event.target.value)}
              />
              <label htmlFor="evidence-notes">Evidence notes</label>
              <textarea
                id="evidence-notes"
                rows="3"
                value={evidenceNotes}
                onChange={(event) => setEvidenceNotes(event.target.value)}
              />
              <button className="primary-button" type="button" onClick={saveExecution}>
                Save execution result
              </button>
            </div>
            {savedExecution && (
              <div className="execution-record">
                <p>
                  <strong>{savedExecution.result}</strong>
                </p>
                <p>{savedExecution.actualOutcome}</p>
                <p>{savedExecution.evidenceNotes}</p>
              </div>
            )}
          </section>
        </div>
      )}

      {activeView === 'admin' && (
        <div className="workspace-grid">
          <section className="panel" aria-label="User administration">
            <div className="section-title">
              <Users size={18} aria-hidden="true" />
              <h2>User administration</h2>
            </div>
            <p className="section-copy">Role-based access control is active.</p>
            <div className="role-list">
              {userRoles.map((role) => (
                <span className="role-chip" key={role}>
                  {role}
                </span>
              ))}
            </div>
          </section>

          <section className="panel span-2" aria-label="Audit log">
            <div className="section-title">
              <ShieldCheck size={18} aria-hidden="true" />
              <h2>Audit log</h2>
            </div>
            <ul className="audit-list">
              {audit.map((event) => (
                <li key={event.id}>
                  <span>{event.message}</span>
                  <time>{event.timestamp}</time>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {activeView === 'account' && (
        <div className="workspace-grid">
          <section className="panel" aria-label="Account security">
            <div className="section-title">
              <KeyRound size={18} aria-hidden="true" />
              <h2>Account security</h2>
            </div>
            <p className="section-copy">Update your password separately from project and UAT work.</p>
            <form className="stack-form" onSubmit={changePassword}>
              <label htmlFor="current-password">Current password</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <label htmlFor="confirm-password">Confirm new password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {passwordStatus && (
                <p className={passwordStatus.type === 'success' ? 'form-success' : 'form-error'}>
                  {passwordStatus.message}
                </p>
              )}
              <button className="primary-button" type="submit">
                Update password
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
