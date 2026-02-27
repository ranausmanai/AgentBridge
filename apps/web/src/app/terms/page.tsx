import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — AgentBridge',
  description: 'Terms governing use of AgentBridge web app, CLI, API registry, and connected integrations.',
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold mb-3">Terms of Service</h1>
      <p className="text-[var(--text-secondary)] mb-8">
        Effective date: February 27, 2026
      </p>

      <div className="space-y-8 text-[var(--text-secondary)] leading-7">
        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using AgentBridge, you agree to these Terms of Service. If you do not agree, do not use the service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">2. Service Description</h2>
          <p>
            AgentBridge provides tools to convert APIs into agent-ready actions and interact with those APIs through web chat, CLI, and MCP-compatible tooling.
            Features may evolve over time.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">3. Eligibility and Accounts</h2>
          <p>
            You must be legally capable of entering into a binding agreement and use AgentBridge in compliance with applicable law.
            You are responsible for activity under your account and credentials.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">4. Your Responsibilities</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Provide accurate API metadata and ensure you have rights to publish or operate connected APIs.</li>
            <li>Maintain confidentiality of your own keys, tokens, and account access methods.</li>
            <li>Review and confirm sensitive actions before execution where confirmation is required.</li>
            <li>Comply with third-party terms for connected services (for example Google, Spotify, and LLM providers).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">5. Prohibited Conduct</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Illegal activity, unauthorized access, abuse, scraping beyond provider permissions, or policy circumvention.</li>
            <li>Uploading malicious, deceptive, or rights-infringing API definitions or content.</li>
            <li>Attempting to disrupt service integrity, availability, or security controls.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">6. Connected Integrations and OAuth</h2>
          <p>
            You authorize AgentBridge to perform actions against connected APIs using scopes you approve. You may revoke access at any time through provider controls or
            by removing credentials in AgentBridge. You are responsible for choosing appropriate scopes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">7. BYOK and Third-Party Costs</h2>
          <p>
            AgentBridge may rely on bring-your-own-key providers (such as LLM services). You are responsible for third-party usage, quotas, and billing under your own accounts.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">8. Content and API Ownership</h2>
          <p>
            You retain ownership of your API specifications, credentials, and data you provide. You grant AgentBridge a limited license to process that data solely to operate,
            secure, and improve the service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">9. Availability and Changes</h2>
          <p>
            We may modify, suspend, or discontinue parts of the service at any time. We aim for reliable operation but do not guarantee uninterrupted availability.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">10. Disclaimer of Warranties</h2>
          <p>
            AgentBridge is provided on an “as is” and “as available” basis. To the fullest extent permitted by law, we disclaim warranties of merchantability,
            fitness for a particular purpose, and non-infringement.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">11. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, AgentBridge and its operators are not liable for indirect, incidental, special, consequential, or punitive damages,
            including data loss, service interruption, or third-party provider failures.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">12. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless AgentBridge and its operators from claims, liabilities, and costs arising from your use of the service,
            your content, or your violation of these terms or third-party rights.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">13. Termination</h2>
          <p>
            We may suspend or terminate access for violations of these terms, security abuse, legal requirements, or operational risk. You may stop using the service at any time.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">14. Governing Law</h2>
          <p>
            These terms are governed by applicable laws where the service operator resides, without regard to conflict-of-law principles, unless otherwise required by law.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">15. Contact</h2>
          <p>
            For terms questions, contact: <a className="text-[var(--accent)] hover:text-[var(--accent-hover)]" href="mailto:usmanashrafrana@gmail.com">usmanashrafrana@gmail.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}
