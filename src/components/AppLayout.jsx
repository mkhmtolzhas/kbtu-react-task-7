import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import CachedDataBanner from './CachedDataBanner.jsx';
import ConnectionStatus from './ConnectionStatus.jsx';
import SimulatedErrorBanner from './SimulatedErrorBanner.jsx';
import Spinner from './Spinner.jsx';
import UpdateToast from './UpdateToast.jsx';
import UserMenu from './UserMenu.jsx';
import { useAuth } from '../hooks/useAuth.js';

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/vehicles', label: 'Fleet' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/about', label: 'About' },
];

export default function AppLayout() {
  const { isConfigured, configError } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef(null);
  const panelRef = useRef(null);
  const menuId = useId();

  // A navigation always closes the menu: on a phone the panel covers the page
  // that was just opened.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  // Escape closes it, and focus goes back to the button that opened it.
  useEffect(() => {
    if (!menuOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      toggleRef.current?.focus();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  // Opening the menu moves focus into it, so a keyboard or screen-reader user
  // lands on the links instead of continuing behind the panel.
  useEffect(() => {
    if (menuOpen) panelRef.current?.focus();
  }, [menuOpen]);

  return (
    <div className={`app${menuOpen ? ' app--menu-open' : ''}`}>
      <header className="app-header">
        <div className="app-header__inner">
          <NavLink to="/" className="brand" end>
            <svg className="brand__logo" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="8" />
              <path d="M7 19.5 9.3 13a2 2 0 0 1 1.9-1.4h9.6a2 2 0 0 1 1.9 1.4l2.3 6.5V23a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-11v1a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" />
            </svg>
            <span className="brand__name">FleetDesk</span>
            <span className="brand__city">Almaty</span>
          </NavLink>

          <div className="app-header__tools">
            <ConnectionStatus />
            <button
              ref={toggleRef}
              type="button"
              className="nav-toggle"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="nav-toggle__bars" aria-hidden="true" />
              <span className="visually-hidden">{menuOpen ? 'Close menu' : 'Open menu'}</span>
            </button>
          </div>

          <div
            ref={panelRef}
            id={menuId}
            className={`app-menu${menuOpen ? ' app-menu--open' : ''}`}
            tabIndex={-1}
          >
            <nav className="app-nav" aria-label="Main">
              {NAV_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end} className="app-nav__link">
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Tapping outside the open menu closes it, like a native drawer. */}
      {menuOpen && (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {!isConfigured && (
        <p className="dev-banner" role="note">
          {configError}
        </p>
      )}
      <SimulatedErrorBanner />
      <CachedDataBanner />

      <main className="app-main">
        {/* Lazily loaded pages arrive as their own chunk. */}
        <Suspense fallback={<Spinner label="Loading page…" />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="app-footer">
        FleetDesk · car-sharing dispatch for Almaty · changes are stored in this browser
      </footer>

      <UpdateToast />
      <ScrollRestoration />
    </div>
  );
}
