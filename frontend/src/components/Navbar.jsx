import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const initials = user?.name?.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'U';

  // Closes the profile dropdown on outside click or Escape, not only via
  // its own trigger button.
  useEffect(() => {
    if (!profileOpen) return undefined;
    function handlePointer(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setProfileOpen(false);
    }
    function handleKey(e) {
      if (e.key === 'Escape') setProfileOpen(false);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [profileOpen]);

  // Same outside-click/Escape pattern for the mobile nav-links dropdown,
  // plus close it automatically if the viewport is resized back to desktop
  // width (e.g. rotating a tablet) so it can't get stuck open off-screen.
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    function handlePointer(e) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) setMobileMenuOpen(false);
    }
    function handleKey(e) {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    }
    function handleResize() {
      if (window.innerWidth > 720) setMobileMenuOpen(false);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileMenuOpen]);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="navbar-left" ref={mobileMenuRef}>
          <NavLink to="/" className="brand">
            <span className="brand-mark" aria-hidden>
              <svg viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" stroke="var(--signal)" strokeWidth="1.4" opacity=".35" />
                <circle cx="10" cy="10" r="5.5" stroke="var(--signal)" strokeWidth="1.4" opacity=".6" />
                <circle cx="10" cy="10" r="2.2" fill="var(--signal)" />
              </svg>
            </span>
            <span className="brand-name">JobMatch</span>
          </NavLink>
          {user && (
            <>
              <button
                className="nav-toggle"
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-links"
                aria-label="Toggle navigation menu"
              >
                <span className="nav-toggle-bars" aria-hidden>
                  <span /><span /><span />
                </span>
              </button>
              <nav
                id="mobile-nav-links"
                className={`nav-links${mobileMenuOpen ? ' nav-links-open' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <NavLink to="/jobs" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Discover</NavLink>
                <NavLink to="/resume" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Resume</NavLink>
                <NavLink to="/applied" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Applied</NavLink>
              </nav>
            </>
          )}
        </div>

        {user ? (
          <div ref={menuRef} className="navbar-right profile-menu-wrap">
            {!user.emailVerified && <span className="unverified-flag">Email unverified</span>}
            <button
              className="btn btn-quiet profile-trigger"
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <span className="profile-avatar profile-avatar-sm">{initials}</span>
              <span className="profile-trigger-name">{user.name}</span>
            </button>
            {profileOpen && (
              <div className="profile-menu" role="menu">
                <div className="profile-row">
                  <span className="profile-avatar profile-avatar-lg">{initials}</span>
                  <div>
                    <div className="profile-name">{user.name}</div>
                    <div className="profile-status">{user.emailVerified ? 'Verified account' : 'Email verification pending'}</div>
                  </div>
                </div>
                <div className="profile-email">{user.email}</div>
                <button
                  className="btn btn-block"
                  type="button"
                  style={{ marginTop: 12 }}
                  onClick={() => { setProfileOpen(false); logout(); navigate('/login'); }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          // Pointless to show "Sign in" while already on the login/register
          // page - clicking it would just reload the page you're on.
          !['/login', '/register'].includes(location.pathname) && (
            <NavLink to="/login" className="btn btn-primary">Sign in</NavLink>
          )
        )}
      </div>
    </header>
  );
}