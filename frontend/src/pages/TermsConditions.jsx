import React from 'react';
import PublicSiteChrome from '../components/PublicSiteChrome';
import { termsSections } from '../siteContent';

export default function TermsConditions() {
  return (
    <PublicSiteChrome
      eyebrow="Dokumen kebijakan"
      title="Syarat & Ketentuan"
      subtitle="Syarat dan ketentuan penggunaan layanan Tryout CPNS UTBK."
    >
      <article className="policy-card">
        <p className="policy-meta-note">
          Berlaku untuk penggunaan website, akun, pembelian paket, pembayaran, dan akses tryout
          digital yang tersedia melalui platform ini.
        </p>

        <div className="policy-section-list">
          {termsSections.map((section, index) => (
            <section key={section.title} className="policy-section">
              <div className="policy-section-number">{index + 1}</div>
              <div>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.items && (
                  <ul className="policy-list">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      </article>
    </PublicSiteChrome>
  );
}
