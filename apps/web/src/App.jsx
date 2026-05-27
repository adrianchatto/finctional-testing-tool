import { useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Github,
  KeyRound,
  LogIn,
  LogOut,
  ShieldCheck,
  Users
} from 'lucide-react';

const admin = {
  name: 'Priya Shah',
  roles: ['Admin', 'Project Manager', 'Tester', 'Viewer']
};

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
    createAudit('Project created by Priya Shah'),
    createAudit('Audit history cannot be deleted')
  ]);

  const repoName = useMemo(() => {
    if (!connectedRepository) return 'No repository connected';
    return connectedRepository.replace('https://github.com/', '').replace(/\/$/, '');
  }, [connectedRepository]);

  const failCount = savedExecution?.result === 'Fail' ? 1 : 0;
  const blockedCount = savedExecution?.result === 'Blocked' ? 1 : 0;
  const passedCount = savedExecution?.result === 'Pass' ? 1 : 18;
  const notRunCount = savedExecution ? 0 : 6;
  const total = passedCount + failCount + blockedCount + notRunCount;
  const readiness = failCount || blockedCount ? 'Release blocked pending review' : 'Release readiness: monitored';

  function addAudit(message) {
    setAudit((current) => [createAudit(message), ...current]);
  }

  function signIn() {
    setSignedIn(true);
    addAudit('Login completed by Priya Shah');
  }

  function connectRepository() {
    setConnectedRepository(repositoryUrl);
    addAudit('Repository connected by Priya Shah');
  }

  function generateTestingAssets() {
    setAssetsGenerated(true);
    const lowerPrompt = requirementPrompt.toLowerCase();
    const subject = lowerPrompt.includes('wallet payments') ? 'wallet payments' : 'the requested workflow';
    setCriterion(`${subject[0].toUpperCase()}${subject.slice(1)} require valid token, permissions, and measurable acceptance checks.`);
    addAudit('AI generated editable stories, acceptance criteria, tests, and negative scenarios by Priya Shah');
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
    addAudit(`Execution marked ${executionResult} by Priya Shah`);
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
    addAudit('AI settings updated by Priya Shah');
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">UAT governance workspace</p>
          <h1>AI-Driven Functional Testing and UAT Platform</h1>
          <p className="lede">
            Manage projects, generate reviewed testing assets, execute manual UAT, and report release confidence.
          </p>
        </div>
        <div className="session-panel" aria-label="Session status">
          <p>{signedIn ? `Signed in as ${admin.name}` : 'Signed out'}</p>
          {signedIn ? (
            <button type="button" onClick={() => setSignedIn(false)}>
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          ) : (
            <button type="button" onClick={signIn}>
              <LogIn size={16} aria-hidden="true" />
              Sign in as admin
            </button>
          )}
        </div>
      </header>

      <div className="workspace-grid">
        <section className="panel" aria-label="User administration">
          <h2>
            <Users size={18} aria-hidden="true" />
            User administration
          </h2>
          <p className="muted">Role-based access control is active for the MVP workspace.</p>
          <div className="role-grid">
            {admin.roles.map((role) => (
              <span key={role}>{role}</span>
            ))}
          </div>
        </section>

        <section className="panel" aria-label="Project dashboard">
          <h2>
            <Activity size={18} aria-hidden="true" />
            Project dashboard
          </h2>
          <p className="project-title">Checkout Modernisation</p>
          <dl className="metric-grid">
            <div>
              <dt>Total tests</dt>
              <dd>{total}</dd>
            </div>
            <div>
              <dt>Passed</dt>
              <dd>{passedCount}</dd>
            </div>
            <div>
              <dt>Failed</dt>
              <dd>{failCount}</dd>
            </div>
            <div>
              <dt>Blocked</dt>
              <dd>{blockedCount}</dd>
            </div>
          </dl>
          <p className="readiness">Release readiness 72%</p>
        </section>

        <section className="panel" aria-label="GitHub repository connection">
          <h2>
            <Github size={18} aria-hidden="true" />
            GitHub repository connection
          </h2>
          <label htmlFor="repository-url">Repository URL</label>
          <div className="inline-form">
            <input
              id="repository-url"
              value={repositoryUrl}
              onChange={(event) => setRepositoryUrl(event.target.value)}
            />
            <button type="button" onClick={connectRepository} disabled={!signedIn}>
              Connect repository
            </button>
          </div>
          <p className={connectedRepository ? 'status-ok' : 'muted'}>
            {connectedRepository ? `${repoName} Connected` : 'Repository metadata will appear here after connection.'}
          </p>
        </section>

        <section className="panel wide" aria-label="Generated testing assets">
          <h2>
            <Bot size={18} aria-hidden="true" />
            AI requirement collaboration
          </h2>
          <label htmlFor="requirement-prompt">Requirement prompt</label>
          <textarea
            id="requirement-prompt"
            rows="4"
            value={requirementPrompt}
            onChange={(event) => setRequirementPrompt(event.target.value)}
          />
          <button type="button" onClick={generateTestingAssets} disabled={!signedIn}>
            Generate testing assets
          </button>
          <div className="generated-columns">
            <div>
              <h3>Acceptance criteria</h3>
              <label htmlFor="criterion-1">Editable acceptance criterion 1</label>
              <textarea
                id="criterion-1"
                rows="3"
                value={criterion}
                onChange={(event) => setCriterion(event.target.value)}
              />
            </div>
            <div>
              <h3>Functional tests</h3>
              <p>
                Test title: Validate wallet payments before checkout completion. Preconditions, ordered steps, and expected
                outcome are editable and linked to the source story.
              </p>
            </div>
            <div>
              <h3>Negative scenarios</h3>
              <p>
                Invalid wallet token, expired payment session, missing permission, and blocked fraud review are suggested.
              </p>
            </div>
          </div>
          {assetsGenerated && <p className="status-ok">Generated assets include wallet payments coverage.</p>}
        </section>

        <section className="panel" aria-label="Manual execution and evidence">
          <h2>
            <ClipboardCheck size={18} aria-hidden="true" />
            Manual execution and evidence
          </h2>
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
          <button type="button" onClick={saveExecution} disabled={!signedIn}>
            Save execution result
          </button>
          {savedExecution && (
            <div className="result-box">
              <p>{savedExecution.result}</p>
              <p>{savedExecution.actualOutcome}</p>
              <p>{savedExecution.evidenceFilename}</p>
              <p>{savedExecution.documentEvidenceFilename}</p>
              <p>{savedExecution.evidenceNotes}</p>
              <a
                href={`data:image/png;base64,${btoa(savedExecution.evidenceNotes)}`}
                target="_blank"
                rel="noreferrer"
              >
                View screenshot evidence
              </a>
              <a
                href={`data:application/pdf;base64,${btoa(savedExecution.actualOutcome)}`}
                download={savedExecution.documentEvidenceFilename}
              >
                Download document evidence
              </a>
            </div>
          )}
        </section>

        <section className="panel" aria-label="Reports and failure summaries">
          <h2>
            <FileText size={18} aria-hidden="true" />
            Reports and failure summaries
          </h2>
          <p>{failCount} failed</p>
          <p>{blockedCount} blocked</p>
          <p>Pass rate: {Math.round((passedCount / total) * 100)}%</p>
          <p>Probable cause: validation gap</p>
          <p>{readiness}</p>
        </section>

        <section className="panel" aria-label="Bring Your Own AI settings">
          <h2>
            <KeyRound size={18} aria-hidden="true" />
            Bring Your Own AI settings
          </h2>
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
          <button type="button" onClick={saveAiSettings} disabled={!signedIn}>
            Save AI settings
          </button>
          {savedAiSettings && (
            <div className="result-box">
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

        <section className="panel" aria-label="Audit log">
          <h2>
            <ShieldCheck size={18} aria-hidden="true" />
            Audit log
          </h2>
          <ul className="audit-list">
            {audit.map((event) => (
              <li key={event.id}>
                <CheckCircle2 size={14} aria-hidden="true" />
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
