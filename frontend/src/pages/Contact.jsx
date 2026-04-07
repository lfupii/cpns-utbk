import React from 'react';
import PublicSiteChrome from '../components/PublicSiteChrome';
import { contactChannels } from '../siteContent';

export default function Contact() {
  return (
    <PublicSiteChrome
      eyebrow="Informasi bisnis"
      title="Kontak"
      subtitle="Halaman ini disediakan agar pelanggan dan reviewer merchant dapat menemukan saluran bantuan resmi dengan cepat."
    >
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
    </PublicSiteChrome>
  );
}
