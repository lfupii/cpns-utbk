import React from 'react';
import PublicSiteChrome from '../components/PublicSiteChrome';
import {
  aboutJourney,
  aboutPrinciples,
  businessProfile,
  contactChannels,
} from '../siteContent';

export default function About() {
  return (
    <PublicSiteChrome
      eyebrow="Profil platform"
      title="Tentang"
      subtitle="Ujiin membantu peserta menyiapkan sesi latihan dan tryout digital untuk jalur CPNS maupun UTBK dalam satu pengalaman belajar yang ringkas."
    >
      <article className="policy-card policy-card-accent">
        <p className="policy-meta-note">
          {businessProfile.serviceSummary}
        </p>

        <div className="policy-section-heading">
          <span className="policy-section-kicker">Siapa kami</span>
          <h2>Platform latihan yang fokus pada progres belajar</h2>
        </div>

        <p>
          Ujiin dirancang untuk peserta yang ingin belajar lebih teratur, mencoba simulasi soal
          dengan waktu nyata, lalu membaca hasilnya tanpa menunggu proses manual.
        </p>
        <p>
          Fokus kami sederhana: bikin persiapan CPNS dan UTBK terasa lebih jelas, lebih cepat
          dimulai, dan lebih gampang dipantau dari satu akun.
        </p>

        <div className="policy-inline-list">
          {aboutPrinciples.map((item) => (
            <div key={item.title} className="policy-chip-card">
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="policy-card">
        <div className="policy-section-heading">
          <span className="policy-section-kicker">Program utama</span>
          <h2>Dirancang untuk dua kebutuhan belajar</h2>
        </div>

        <div className="contact-card-list">
          {businessProfile.packageHighlights.map((pkg) => (
            <div key={pkg.name} className="contact-card">
              <span className="contact-card-label">{pkg.price}</span>
              <strong>{pkg.name}</strong>
              <p>{pkg.summary}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="policy-card">
        <div className="policy-section-heading">
          <span className="policy-section-kicker">Cara kerja</span>
          <h2>Alur belajar yang dibuat singkat</h2>
        </div>

        <div className="policy-step-list">
          {aboutJourney.map((step, index) => (
            <section key={step.title} className="policy-step">
              <div className="policy-step-index">{index + 1}</div>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </section>
          ))}
        </div>
      </article>

      <article className="policy-card">
        <div className="policy-section-heading">
          <span className="policy-section-kicker">Hubungi kami</span>
          <h2>Informasi resmi platform</h2>
        </div>

        <div className="contact-card-list">
          {contactChannels.map((channel) => (
            <a
              key={channel.title}
              href={channel.href}
              className="contact-card"
              target={channel.href.startsWith('http') ? '_blank' : undefined}
              rel={channel.href.startsWith('http') ? 'noreferrer' : undefined}
            >
              <span className="contact-card-label">{channel.title}</span>
              <strong>{channel.value}</strong>
              <p>{channel.description}</p>
            </a>
          ))}
        </div>
      </article>
    </PublicSiteChrome>
  );
}
