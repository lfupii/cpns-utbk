import React from 'react';
import PublicSiteChrome from '../components/PublicSiteChrome';
import { refundSections } from '../siteContent';

export default function RefundPolicy() {
  return (
    <PublicSiteChrome
      eyebrow="Dokumen kebijakan"
      title="Kebijakan Refund"
      subtitle="Kebijakan pembatalan transaksi dan pengembalian dana untuk produk digital Ujiin."
    >
      <article className="policy-card">
        <p className="policy-meta-note">
          Kebijakan ini berlaku untuk transaksi produk digital berupa akses paket tryout pada
          website kami.
        </p>

        <div className="policy-section-list">
          {refundSections.map((section, index) => (
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
