import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useConnectivity } from '../hooks/useConnectivity.js';

const HIGHLIGHTS = [
  {
    title: 'Find any car in seconds',
    text: 'Search by plate, brand or model across the whole fleet, then narrow it down by status, class and district.',
  },
  {
    title: 'Keep the fleet moving',
    text: 'Change a status, retire a car or register a new one. The rules of the depot are enforced by the API, not by the form.',
  },
  {
    title: 'Works without a connection',
    text: 'Installed as an app, FleetDesk keeps the catalogue you have already seen and accepts changes while you are offline.',
  },
];

/** The landing page: what this is, and the two places worth going first. */
export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const { isOffline } = useConnectivity();

  return (
    <div className="page home">
      <section className="home__hero">
        <img
          className="home__mark"
          src="./icons/icon.svg"
          alt=""
          width="72"
          height="72"
          loading="eager"
        />
        <p className="home__eyebrow">Car-sharing dispatch · Almaty</p>
        <h1 className="home__title">Every car in the fleet, on one desk.</h1>
        <p className="home__lead">
          FleetDesk is the dispatcher&rsquo;s view of a car-sharing fleet: 180 cars with their
          fuel, mileage, service dates and current status — searchable, filterable and
          editable from a phone in the middle of a parking lot.
        </p>
        <div className="home__actions">
          <Link className="button button--primary" to="/vehicles">Open the fleet</Link>
          <Link className="button button--secondary" to="/dashboard">See the dashboard</Link>
        </div>
        {!isAuthenticated && !isOffline && (
          <p className="home__hint">
            Browsing is open to everyone. <Link to="/login">Log in</Link> to change the fleet.
          </p>
        )}
      </section>

      <section className="home__highlights" aria-label="What FleetDesk does">
        {HIGHLIGHTS.map((highlight) => (
          <article key={highlight.title} className="home__card">
            <h2 className="home__card-title">{highlight.title}</h2>
            <p className="home__card-text">{highlight.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
