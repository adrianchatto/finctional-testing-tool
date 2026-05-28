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

const providers = ['OpenAI', 'Anthropic Claude', 'Google Gemini', 'Azure OpenAI', 'AWS Bedrock'];

function createAudit(message) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    message,
    timestamp: new Date().toLocaleString()
  };
}

export function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('admin@example.com');
  const [loginPassword, setLoginPassword] = useState('password');
  const [authError, setAuthError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [projectError, setProjectError] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('https://github.com/acme/checkout-modernisation');
  const [connectedRepository, setConnectedRepository] = useState(null);
  const [requirementPrompt, setRequirementPrompt] = useState(
    'As a shopper, I need wallet payments to be validated before checkout completion.'
  );
  const [criterion, setCriterion] = useState(
    'Wallet payments must be validated before checkout completion.'
  );
  const [assetsGenerated, setAssetsGenerated] = useState(false);
  const [executionResult, setExecutionResult] = useState('Not Run');
  const [actualOutcome, setActualOutcome] = useState('Expected result is visible beside actual result.');
  const [evidenceFilename, setEvidenceFilename] = useState('checkout-evidence.png');
  const [documentEvidenceFilename, setDocumentEvidenceFilename] = useState('checkout-uat-notes.pdf');
  const [evidenceNotes, setEvidenceNotes] = useState('Screenshot attached to the UAT run.');
  const [savedExecution, setSavedExecution] = useState(null);
  const [defaultProvider, setDefaultProvider] = useState('OpenAI');
  const [defaultModel, setDefaultModel] = useState('gpt-4.1-mini');
  const [useOverride, setUseOverride] = useState(false);
  const [projectProvider, setProjectProvider] = useState('OpenAI');
  const [projectModel, setProjectModel] = useState('gpt-4o');
  const [savedAiSettings, setSavedAiSettings] = useState(null);
  const [audit, setAudit] = useState([
    createAudit('Project workspace initialised'),
    createAudit('Audit history cannot be deleted')
  ]);

  const activeProjects = projects.filter((project) => project.status === 'active');
  const visibleProjects = showArchived ? projects : activeProjects;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || activeProjects[0] || null;
  const displayName = currentUser?.name || 'Signed-in user';
  const userRoles = currentUser?.roles || [];

  const repoName = useMemo(() => {
    if (!connectedRepository) return 'No repository connected';
    return connectedRepository.replace('https://github.com/', '').replace(/\/$/, '');
  }, [connectedRepository]);

  const failCount = savedExecution?.result === 'Fail' ? 1 : 0;
  const blockedCount = savedExecution?.result === 'Blocked' ? 1 : 0;
  const passedCount = savedExecution?.result === 'Pass' ? 1 : 18;
  const notRunCount = savedExecution ? 0 : 6;
  const total = passedCount + failCount + blockedCount + notRunCount;
  const passRate = Math.round((passedCount / total) * 100);
  const readiness = failCount || blockedCount ? 'Release blocked pending review' : 'Release readiness: monitored';

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
    return payload.projects;
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
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordStatus(null);
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordStatus(null);
    try {
      const payload = await apiRequest('/auth/password', {
        method: 'PATCH',
        token,
        body: {
          currentPassword,
          newPassword,
          confirmPassword
        }
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

  function connectRepository() {
    setConnectedRepository(repositoryUrl);
    addAudit(`Repository connected by ${displayName}`);
  }

  async function createProject(event) {
    event.preventDefault();
    setProjectError('');
    try {
      const payload = await apiRequest('/projects', {
        method: 'POST',
        token,
        body: {
          name: projectName,
          description: projectDescription
        }
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

  function generateTestingAssets() {
    setAssetsGenerated(true);
    const lowerPrompt = requirementPrompt.toLowerCase();
    const subject = lowerPrompt.includes('wallet payments') ? 'wallet payments' : 'the requested workflow';
    setCriterion(
      `${subject[0].toUpperCase()}${subject.slice(1)} require valid token, permissions, and measurable acceptance checks.`
    );
    addAudit(`AI generated editable stories, acceptance criteria, tests, and negative scenarios by ${displayName}`);
  }

  function saveExecution() {
    const execution = {
      result: executionResult,
      actualOutcome,
      evidenceFilename,
      documentEvidenceFilename,
      evidenceNotes
    };
    setSavedExecution(execution);
    addAudit(`Execution marked ${executionResult} by ${displayName}`);
  }

  function saveAiSettings() {
    const settings = {
      defaultProvider,
      defaultModel,
      projectProvider,
      projectModel,
      useOverride
    };
    setSavedAiSettings(settings);
    addAudit(`AI settings updated by ${displayName}`);
  }

  if (!signedIn) {
    return (
      <main className="app-shell login-shell">
        <section className="login-card" aria-label="Sign in">
          <p className="eyebrow">UAT governance workspace</p>
          <h1>AI-Driven Functional Testing and UAT Platform</h1>
          <p className="intro">
            Sign in to manage projects, generate reviewed testing assets, execute manual UAT, and report release
            confidence.
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
          <div className="login-actions">
            <span className="status-pill neutral">Signed out</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">UAT governance workspace</p>
          <h1>AI-Driven Functional Testing and UAT Platform</h1>
          <p className="intro">
            Manage projects, generate reviewed testing assets, execute manual UAT, and report release confidence.
          </p>
        </div>
        <div className="session-panel" aria-label="Session status">
          <p className="label">Signed in as {displayName}</p>
          <button className="secondary-button" type="button" onClick={signOut}>
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </header>

      <div className="workspace-grid">
        <section className="panel" aria-label="User administration">
          <div className="section-title">
            <Users size={18} aria-hidden="true" />
            <h2>User administration</h2>
          </div>
          <p className="section-copy">Role-based access control is active for the MVP workspace.</p>
          <div className="role-list">
            {userRoles.map((role) => (
              <span className="role-chip" key={role}>
                {role}
              </span>
            ))}
          </div>
        </section>

        <section className="panel" aria-label="Account security">
          <div className="section-title">
            <KeyRound size={18} aria-hidden="true" />
            <h2>Account security</h2>
          </div>
          <p className="section-copy">Update your password with a stronger credential.</p>
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

        <section className="panel span-2" aria-label="Project management">
          <div className="section-title">
            <Activity size={18} aria-hidden="true" />
            <h2>Project management</h2>
          </div>
          <form className="project-create-form" onSubmit={createProject}>
            <label htmlFor="project-name">Project name</label>
            <input
              id="project-name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="e.g. UAT Release 1"
            />
            <label htmlFor="project-description">Project description</label>
            <textarea
              id="project-description"
              rows="3"
              value={projectDescription}
              onChange={(event) => setProjectDescription(event.target.value)}
              placeholder="Describe the workflow, release, or customer scope."
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

        <section className="panel span-2" aria-label="Project dashboard">
          <div className="dashboard-summary">
            <div>
              <div className="section-title">
                <Activity size={18} aria-hidden="true" />
                <h2>{selectedProject?.name || 'No active project'}</h2>
              </div>
              <p className="section-copy">
                {selectedProject?.description || 'Create or select a project to start tracking release confidence.'}
              </p>
            </div>
            <div className="readiness">
              <span>72%</span>
              <p>Release readiness</p>
            </div>
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
        </section>

        <section className="panel" aria-label="GitHub repository connection">
          <div className="section-title">
            <Github size={18} aria-hidden="true" />
            <h2>GitHub repository connection</h2>
          </div>
          <div className="stack-form">
            <label htmlFor="repository-url">Repository URL</label>
            <input
              id="repository-url"
              value={repositoryUrl}
              onChange={(event) => setRepositoryUrl(event.target.value)}
            />
            <button className="primary-button" type="button" onClick={connectRepository}>
              Connect repository
            </button>
          </div>
          <div className="connection-state">
            <span className={connectedRepository ? 'status-dot success' : 'status-dot'} aria-hidden="true" />
            <span>{connectedRepository ? repoName : 'Repository metadata will appear here after connection.'}</span>
            <span className={connectedRepository ? 'status-pill success' : 'status-pill neutral'}>
              {connectedRepository ? 'Connected' : 'Not connected'}
            </span>
          </div>
        </section>

        <section className="panel span-2" aria-label="Generated testing assets">
          <div className="section-title">
            <Bot size={18} aria-hidden="true" />
            <h2>AI requirement collaboration</h2>
          </div>
          <div className="stack-form">
            <label htmlFor="requirement-prompt">Requirement prompt</label>
            <textarea
              id="requirement-prompt"
              rows="4"
              value={requirementPrompt}
              onChange={(event) => setRequirementPrompt(event.target.value)}
            />
            <button className="primary-button" type="button" onClick={generateTestingAssets}>
              Generate testing assets
            </button>
          </div>
          <div className="asset-columns">
            <div>
              <h3>Acceptance criteria</h3>
              <label className="editable-line" htmlFor="criterion-1">
                Editable acceptance criterion 1
              </label>
              <textarea
                id="criterion-1"
                rows="3"
                value={criterion}
                onChange={(event) => setCriterion(event.target.value)}
              />
            </div>
            <div>
              <h3>Functional tests</h3>
              <ul className="asset-list">
                <li>Validate wallet payments before checkout completion.</li>
                <li>Preconditions, ordered steps, and expected outcomes are editable.</li>
                <li>Tests remain linked to the source story.</li>
              </ul>
            </div>
            <div>
              <h3>Negative scenarios</h3>
              <ul className="asset-list">
                <li>Invalid wallet token.</li>
                <li>Expired payment session.</li>
                <li>Missing permission and blocked fraud review.</li>
              </ul>
            </div>
          </div>
          {assetsGenerated && <p className="generated-story">Generated assets include wallet payments coverage.</p>}
        </section>

        <section className="panel" aria-label="Manual execution and evidence">
          <div className="section-title">
            <ClipboardCheck size={18} aria-hidden="true" />
            <h2>Manual execution and evidence</h2>
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
            <label htmlFor="evidence-filename">Screenshot evidence filename</label>
            <input
              id="evidence-filename"
              value={evidenceFilename}
              onChange={(event) => setEvidenceFilename(event.target.value)}
            />
            <label htmlFor="document-evidence-filename">Document evidence filename</label>
            <input
              id="document-evidence-filename"
              value={documentEvidenceFilename}
              onChange={(event) => setDocumentEvidenceFilename(event.target.value)}
            />
            <label htmlFor="evidence-notes">Evidence notes</label>
            <textarea
              id="evidence-notes"
              rows="2"
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
              <p>{savedExecution.evidenceFilename}</p>
              <p>{savedExecution.documentEvidenceFilename}</p>
              <p>{savedExecution.evidenceNotes}</p>
              <p>
                <a href={`data:image/png;base64,${btoa(savedExecution.evidenceNotes)}`} target="_blank" rel="noreferrer">
                  View screenshot evidence
                </a>
              </p>
              <p>
                <a
                  href={`data:application/pdf;base64,${btoa(savedExecution.actualOutcome)}`}
                  download={savedExecution.documentEvidenceFilename}
                >
                  Download document evidence
                </a>
              </p>
            </div>
          )}
        </section>

        <section className="panel" aria-label="Reports and failure summaries">
          <div className="section-title">
            <FileText size={18} aria-hidden="true" />
            <h2>Reports and failure summaries</h2>
          </div>
          <div className="report-line">
            <strong>{failCount} failed</strong>
            <strong>{blockedCount} blocked</strong>
            <strong>{passRate}% pass rate</strong>
          </div>
          <p className="section-copy">Probable cause: validation gap</p>
          <p className={failCount || blockedCount ? 'status-pill danger' : 'status-pill success'}>{readiness}</p>
        </section>

        <section className="panel" aria-label="Bring Your Own AI settings">
          <div className="section-title">
            <KeyRound size={18} aria-hidden="true" />
            <h2>Bring Your Own AI settings</h2>
          </div>
          <div className="stack-form">
            <label htmlFor="default-provider">Default AI provider</label>
            <select
              id="default-provider"
              value={defaultProvider}
              onChange={(event) => setDefaultProvider(event.target.value)}
            >
              {providers.map((provider) => (
                <option key={provider}>{provider}</option>
              ))}
            </select>
            <label htmlFor="default-model">Default model</label>
            <input id="default-model" value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)} />
            <label className="checkbox-row">
              <input type="checkbox" checked={useOverride} onChange={(event) => setUseOverride(event.target.checked)} />
              Use project-level AI override
            </label>
            <label htmlFor="project-provider">Project AI provider</label>
            <select
              id="project-provider"
              value={projectProvider}
              onChange={(event) => setProjectProvider(event.target.value)}
            >
              {providers.map((provider) => (
                <option key={provider}>{provider}</option>
              ))}
            </select>
            <label htmlFor="project-model">Project model</label>
            <input id="project-model" value={projectModel} onChange={(event) => setProjectModel(event.target.value)} />
            <button className="primary-button" type="button" onClick={saveAiSettings}>
              Save AI settings
            </button>
          </div>
          {savedAiSettings && (
            <div className="settings-summary">
              <p>
                Default: {savedAiSettings.defaultProvider} / {savedAiSettings.defaultModel}
              </p>
              {savedAiSettings.useOverride && (
                <p>
                  Project override: {savedAiSettings.projectProvider} / {savedAiSettings.projectModel}
                </p>
              )}
            </div>
          )}
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
    </main>
  );
}
