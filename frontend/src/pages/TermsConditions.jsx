import React from 'react';
import PublicSiteChrome from '../components/PublicSiteChrome';
import { privacySections, refundSections, termsSections } from '../siteContent';

export default function TermsConditions() {
  return (
    <PublicSiteChrome
      eyebrow="Dokumen kebijakan"
      title="Syarat & Ketentuan"
      subtitle="Satu halaman kebijakan untuk syarat penggunaan, privasi, dan refund layanan Tryout CPNS UTBK."
    >
      <nav className="policy-anchor-nav">
        <a href="#terms-policy">Syarat &amp; Ketentuan</a>
        <a href="#privacy-policy">Kebijakan Privasi</a>
        <a href="#refund-policy">Kebijakan Refund</a>
      </nav>

      <article id="terms-policy" className="policy-card">
        <p className="policy-meta-note">
          Berlaku untuk penggunaan website, akun, pembelian paket, pembayaran, dan akses tryout
          digital yang tersedia melalui platform ini.
        </p>

        <div className="policy-section-heading">
          <span className="policy-section-kicker">Bagian 1</span>
          <h2>Syarat &amp; Ketentuan</h2>
        </div>

        <div className="policy-section-list">
          {termsSections.map((section, index) => (
            <section key={section.title} className="policy-section">
              <div className="policy-section-number">{index + 1}</div>
              <div>
                <h3>{section.title}</h3>
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

      <article id="privacy-policy" className="policy-card">
        <div className="policy-section-heading">
          <span className="policy-section-kicker">Bagian 2</span>
          <h2>Kebijakan Privasi</h2>
        </div>

        <p className="policy-meta-note">
          Bagian ini menjelaskan cara kami mengumpulkan, menggunakan, menyimpan, dan melindungi
          informasi pengguna yang menggunakan website serta layanan tryout digital kami.
        </p>

        <div className="policy-section-list">
          {privacySections.map((section, index) => (
            <section key={section.title} className="policy-section">
              <div className="policy-section-number">{index + 1}</div>
              <div>
                <h3>{section.title}</h3>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>

      <article id="refund-policy" className="policy-card">
        <div className="policy-section-heading">
          <span className="policy-section-kicker">Bagian 3</span>
          <h2>Kebijakan Refund</h2>
        </div>

        <p className="policy-meta-note">
          Bagian ini mengatur pembatalan transaksi dan pengembalian dana untuk produk digital
          berupa akses paket tryout pada website kami.
        </p>

        <div className="policy-section-list">
          {refundSections.map((section, index) => (
            <section key={section.title} className="policy-section">
              <div className="policy-section-number">{index + 1}</div>
              <div>
                <h3>{section.title}</h3>
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
