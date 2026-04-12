import React from 'react';
import PublicSiteChrome from '../components/PublicSiteChrome';
import { privacySections } from '../siteContent';

export default function PrivacyPolicy() {
  return (
    <PublicSiteChrome
      eyebrow="Dokumen kebijakan"
      title="Kebijakan Privasi"
      subtitle="Kebijakan privasi penggunaan data pengguna pada layanan Ujiin."
    >
      <article className="policy-card">
        <p className="policy-meta-note">
          Kebijakan ini menjelaskan cara kami mengumpulkan, menggunakan, menyimpan, dan melindungi
          informasi pengguna yang menggunakan website serta layanan tryout digital kami.
        </p>

        <div className="policy-section-list">
          {privacySections.map((section, index) => (
            <section key={section.title} className="policy-section">
              <div className="policy-section-number">{index + 1}</div>
              <div>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </PublicSiteChrome>
  );
}
