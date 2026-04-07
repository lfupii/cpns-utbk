import React from 'react';
import PublicSiteChrome from '../components/PublicSiteChrome';
import { businessProfile, midtransChecklist, reviewerFlowSteps } from '../siteContent';

export default function MidtransReview() {
  return (
    <PublicSiteChrome
      eyebrow="Panduan reviewer"
      title="Panduan Reviewer Midtrans"
      subtitle="Halaman ringkas untuk membantu proses review merchant atas website Tryout CPNS UTBK."
    >
      <section className="policy-grid">
        <article className="policy-card policy-card-accent">
          <h2>Ringkasan Bisnis</h2>
          <p>{businessProfile.serviceSummary}</p>
          <div className="policy-inline-list">
            {businessProfile.packageHighlights.map((item) => (
              <div key={item.name} className="policy-chip-card">
                <strong>{item.name}</strong>
                <span>{item.price}</span>
                <p>{item.summary}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="policy-card">
          <h2>Halaman publik yang dapat diperiksa</h2>
          <div className="policy-link-list">
            <a href="/">Beranda</a>
            <a href="/login">Login</a>
            <a href="/contact">Kontak</a>
            <a href="/terms">Syarat &amp; Ketentuan</a>
            <a href="/terms#privacy-policy">Kebijakan Privasi</a>
            <a href="/terms#refund-policy">Kebijakan Refund</a>
          </div>
        </article>
      </section>

      <section className="policy-card">
        <h2>Flow akun dummy/reviewer</h2>
        <div className="policy-step-list">
          {reviewerFlowSteps.map((step, index) => (
            <div key={step.title} className="policy-step">
              <div className="policy-step-index">{index + 1}</div>
              <div>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="policy-reviewer-note">
          <strong>Catatan keamanan:</strong>
          <p>
            Kredensial reviewer tidak ditampilkan di halaman ini. Silakan gunakan akun dummy yang
            dikirim terpisah melalui kanal review Midtrans/FormAssembly.
          </p>
        </div>
      </section>

      <section className="policy-card">
        <h2>Checklist Midtrans untuk website ini</h2>
        <div className="review-checklist">
          {midtransChecklist.map((item) => (
            <div
              key={item.title}
              className={`review-checklist-item review-checklist-item-${item.status}`}
            >
              <span className="review-checklist-status">
                {item.status === 'done' ? 'Siap' : 'Perlu dikirim'}
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicSiteChrome>
  );
}
