import { Link } from 'react-router-dom';
import { about, links, profile, skills } from '../data/profile.js';

const STACK = [
  { label: 'React 18 + Vite', detail: 'Hash routing, lazy-loaded pages, no UI framework.' },
  { label: 'TanStack Query', detail: 'Caching, revalidation and cache invalidation after every change.' },
  { label: 'Firebase Auth', detail: 'Email/password and Google sign-in for everything that edits the fleet.' },
  { label: 'Static JSON API', detail: 'The catalogue is served as real files, so it can be cached for offline use.' },
  { label: 'Service worker', detail: 'Written by hand: versioned caches, two strategies, an update prompt.' },
];

/** About the project and about the person who built it (homework 2, carried over). */
export default function AboutPage() {
  return (
    <div className="page page--narrow about">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">About</h1>
          <p className="page-header__subtitle">
            What this application is, how it is built, and who built it.
          </p>
        </div>
      </header>

      <section className="about__section" aria-labelledby="about-project">
        <h2 className="section-title" id="about-project">The project</h2>
        <p>
          FleetDesk is a dispatch dashboard for a car-sharing fleet in Almaty. It started as the
          midterm project of the KBTU React course and has grown with every assignment since:
          server data and caching, authentication, and now an installable, offline-capable
          progressive web app.
        </p>
        <p>
          The fleet lives in a <strong>public catalogue served as static JSON</strong>. Everything a
          dispatcher changes — a new car, a status change, a removal — is kept in this browser and
          merged over that catalogue, which is why the application stays usable with no connection
          at all. <Link to="/offline">What works offline</Link>.
        </p>
        <ul className="about__stack">
          {STACK.map((item) => (
            <li key={item.label}>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="about__section" aria-labelledby="about-me">
        <h2 className="section-title" id="about-me">The author</h2>
        <p className="about__tagline">
          <strong>{profile.name}</strong> — {profile.roles.join(' · ')}
        </p>
        {about.map((paragraph) => <p key={paragraph.slice(0, 24)}>{paragraph}</p>)}

        <div className="about__skills">
          {Object.entries(skills).map(([group, items]) => (
            <div key={group} className="about__skill-group">
              <h3 className="about__skill-title">{group}</h3>
              <ul className="chip-group">
                {items.map((item) => <li key={item} className="chip chip--static">{item}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <ul className="about__links">
          {links.map((link) => (
            <li key={link.label}>
              <span>{link.label}</span>
              <a href={link.url} target="_blank" rel="noreferrer">{link.value}</a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
