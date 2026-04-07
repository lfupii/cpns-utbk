import React from 'react';
import PublicSiteChrome from '../components/PublicSiteChrome';
import { businessProfile, contactChannels } from '../siteContent';

export default function Contact() {
  return (
    <PublicSiteChrome
      eyebrow="Informasi bisnis"
      title="Kontak"
      subtitle="Halaman ini disediakan agar pelanggan dan reviewer merchant dapat menemukan saluran bantuan resmi dengan cepat."
    >
      <section className="policy-grid">
        <article className="policy-card policy-card-accent">
          <h2>Tentang Layanan</h2>
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
          <h2>Kanal Kontak Resmi</h2>
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
      </section>

      <section className="policy-card">
        <h2>Untuk kebutuhan review merchant</h2>
        <p>
          Jika Anda adalah reviewer payment gateway atau bank rekanan, silakan gunakan halaman{' '}
          <a href="/midtrans-review">Panduan Reviewer Midtrans</a> untuk melihat alur pengecekan
          website, jalur login, serta dokumen kebijakan yang tersedia secara publik.
        </p>
        <p>
          Kredensial akun reviewer dikirim melalui kanal privat pada proses review dan tidak
          ditampilkan di halaman publik demi menjaga keamanan akses.
        </p>
      </section>
    </PublicSiteChrome>
  );
}
