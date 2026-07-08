import Link from "next/link";

export const metadata = {
  title: "Privacy Notice — PronounceRight",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10 text-[var(--text-primary)]">
      <h1 className="text-2xl font-semibold">Privacy notice</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        This notice explains how PronounceRight handles your voice recording and personal
        data, in line with India&apos;s Digital Personal Data Protection Act, 2023 (DPDP Act).
      </p>

      <Section title="What we collect">
        <p>
          When you upload or record audio, your browser converts it to a 16kHz mono WAV file
          and sends it to our backend for analysis. We do not collect your name, email, or any
          other identifying information as part of the assessment flow.
        </p>
      </Section>

      <Section title="Why we process it (purpose limitation)">
        <p>
          Your audio is processed for the sole purpose of generating a pronunciation score and
          coaching feedback for you, in this session. It is not used for advertising, profiling,
          or any purpose beyond what you requested.
        </p>
      </Section>

      <Section title="Consent">
        <p>
          Processing only happens after you explicitly check the consent box on the home page.
          You can withdraw consent at any time simply by not submitting further recordings; there
          is no account or persistent identifier to withdraw from in the first place.
        </p>
      </Section>

      <Section title="Storage and retention">
        <p>
          Your audio is held in memory only for the duration of the single request that scores
          it. It is never written to disk, a database, or object storage on our servers. Once
          the response is returned to your browser, the backend retains nothing. Your browser
          keeps the recording only in local memory for playback, and it is discarded when you
          close the tab or click &ldquo;Analyze another recording.&rdquo;
        </p>
      </Section>

      <Section title="Sub-processors">
        <p>
          Two categories of third-party AI services process your audio/transcript momentarily
          to generate results, under their own enterprise data-handling terms:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Microsoft Azure AI Speech</strong>: receives the audio to compute
            pronunciation scores. Configured to a data center in India where available.
          </li>
          <li>
            <strong>Google Gemini / Groq</strong>: receives only the recognized transcript and
            numeric scores (never the raw audio), used to generate coaching tips.
          </li>
        </ul>
        <p className="mt-2">
          None of these providers are instructed to retain your data for model training in this
          integration.
        </p>
      </Section>

      <Section title="Data residency and cross-border transfer">
        <p>
          Where supported, our Azure Speech resource is provisioned in the Central India region,
          so audio is processed within India. Coaching-tip generation may involve a transfer of
          the (non-audio) transcript to servers outside India. The DPDP Act permits transfer of
          personal data outside India except to countries restricted by the Central Government;
          no such restriction applies to the providers used here.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Under the DPDP Act you have the right to access, correct, and erase your personal
          data, and to nominate someone to exercise these rights on your behalf. Because we
          retain no audio or transcript after your session ends, there is typically nothing
          stored to access or erase. If you believe otherwise, or have any grievance, contact us
          at the address below.
        </p>
      </Section>

      <Section title="Deletion">
        <p>
          There is no server-side deletion to request, since nothing is persisted. On your
          device, click &ldquo;Analyze another recording&rdquo; or close the tab to immediately
          discard the in-browser copy of your audio.
        </p>
      </Section>

      <Section title="Grievance officer / contact">
        <p>
          For any questions or complaints about this notice or how your data was handled,
          contact: <a className="text-[var(--accent)] underline" href="mailto:ashrafahmed1232@gmail.com">ashrafahmed1232@gmail.com</a>.
        </p>
      </Section>

      <Link href="/" className="mt-8 inline-block text-sm text-[var(--accent)] underline">
        ← Back to the app
      </Link>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{children}</div>
    </section>
  );
}
