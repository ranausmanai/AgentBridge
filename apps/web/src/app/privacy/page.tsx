import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — AgentBridge',
  description: 'How AgentBridge collects, uses, and protects data across web, CLI, OAuth integrations, and API usage analytics.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold mb-3">Privacy Policy</h1>
      <p className="text-[var(--text-secondary)] mb-8">
        Effective date: February 27, 2026
      </p>

      <div className="space-y-8 text-[var(--text-secondary)] leading-7">
        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">1. Who We Are</h2>
          <p>
            AgentBridge is a platform that makes APIs agent-ready. We provide a hosted web app, CLI, and MCP tooling so users can connect APIs,
            authenticate where required, and interact using natural language.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">2. Data We Collect</h2>
          <p className="mb-2">We collect data in the following categories:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Account data: if authentication is enabled, your account identifier and login metadata.</li>
            <li>API registry data: API names, descriptions, manifests, OpenAPI specs, ownership, visibility settings.</li>
            <li>OAuth session data: temporary OAuth state, PKCE verifier, redirect URI, and expiry during OAuth flows.</li>
            <li>Credential vault data: encrypted API credentials/tokens stored per user and API when vault is configured.</li>
            <li>Usage analytics: API event telemetry such as manifest fetches, chat usage, action calls, timestamps, user agent, and optional hashed IP.</li>
            <li>Operational logs: service health and error logs required to run and secure the platform.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">3. Data We Do Not Collect by Default</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>We do not require users to store LLM API keys server-side; users can bring their own key in session.</li>
            <li>We do not claim ownership of third-party API data returned through connected APIs.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">4. How We Use Data</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide core functionality: API registration, discovery, chat execution, OAuth connection, and tool calling.</li>
            <li>To secure and operate the service: fraud prevention, abuse detection, troubleshooting, and reliability improvements.</li>
            <li>To provide product analytics: aggregate usage stats and API-level performance insights.</li>
            <li>To comply with legal obligations and enforce our terms.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">5. Credential Security</h2>
          <p>
            When credential vault is enabled, credentials are encrypted at rest using AES-256-GCM with a server-side encryption key.
            Decryption is performed only as needed to execute user-requested calls. Operators are responsible for managing and rotating encryption keys safely.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">6. OAuth and Connected Services</h2>
          <p>
            If you connect services such as Spotify, Gmail, or Google Calendar, AgentBridge processes OAuth tokens/scopes needed to perform authorized actions
            on your behalf. Your use of those services is also governed by the respective provider’s terms and privacy policies.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">7. Third-Party Processors</h2>
          <p>
            Depending on user configuration, requests may be sent to third-party providers including LLM vendors and API providers selected by the user.
            We only forward data necessary to complete the requested operation.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">8. Data Retention</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>OAuth sessions are short-lived and automatically expire.</li>
            <li>Credential records remain until user deletion, owner removal, or key mismatch cleanup.</li>
            <li>Analytics and operational logs are retained as needed for operations, security, and product improvement.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">9. User Controls</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>You can disconnect integrations by removing stored credentials.</li>
            <li>You can delete APIs you own and control their visibility where ownership rules apply.</li>
            <li>You can choose whether to provide credentials in-session or store them in the vault (when available).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">10. International Data Transfers</h2>
          <p>
            AgentBridge may process data in regions where hosting providers or integrated services operate. By using AgentBridge, you acknowledge that
            connected service data may cross borders depending on provider infrastructure.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">11. Children’s Privacy</h2>
          <p>
            AgentBridge is not intended for children under 13, and we do not knowingly collect personal information from children under 13.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">12. Changes to This Policy</h2>
          <p>
            We may update this policy to reflect product, legal, or operational changes. The effective date above indicates the current version.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">13. Contact</h2>
          <p>
            For privacy inquiries, contact: <a className="text-[var(--accent)] hover:text-[var(--accent-hover)]" href="mailto:usmanashrafrana@gmail.com">usmanashrafrana@gmail.com</a> or join our support channel on{' '}
            <a
              className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
              href="https://discord.gg/UW67PSwF"
              target="_blank"
              rel="noopener noreferrer"
            >
              Discord
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
