'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 55);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Anchor links (same page) + About page link
  const anchorLinks = ['Tiers', 'Actions', 'Architecture'];

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
        padding: scrolled ? '13px 48px' : '20px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(248,244,238,0.88)' : 'rgba(248,244,238,0)',
        backdropFilter: scrolled ? 'blur(24px) saturate(1.4)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(24px) saturate(1.4)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(12,11,9,0.07)' : '1px solid transparent',
        transition: 'all 0.5s cubic-bezier(.16,1,.3,1)',
      }}>

        {/* ── LOGO ── */}
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '11px', textDecoration: 'none' }}>
          <div style={{ position: 'relative', width: '26px', height: '26px', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, #b8923a, #ead898, #b8923a)',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              animation: 'logoGemSpin 8s linear infinite',
            }} />
            <div style={{
              position: 'absolute', inset: '22%',
              background: 'rgba(255,255,255,0.55)',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            }} />
          </div>
          <div>
            <div style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: '18px', fontWeight: 400,
              color: '#0c0b09', lineHeight: 1, letterSpacing: '0.04em',
            }}>
              RST<span style={{ color: '#b8923a' }}>.</span>
            </div>
            <div style={{
              fontFamily: "'Azeret Mono', monospace",
              fontSize: '7px', letterSpacing: '0.26em',
              color: 'rgba(12,11,9,0.28)', marginTop: '2px',
            }}>PROTOCOL</div>
          </div>
        </a>

        {/* ── DESKTOP LINKS ── */}
        <div className="nav-links-desktop" style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>

          {/* Anchor links */}
          {anchorLinks.map(item => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              style={{
                fontFamily: "'Hanken Grotesk', sans-serif",
                fontSize: '11px', fontWeight: 500,
                letterSpacing: '0.12em',
                color: 'rgba(12,11,9,0.38)',
                textDecoration: 'none',
                transition: 'color 0.22s, transform 0.22s',
                display: 'inline-block',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = '#0c0b09';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = 'rgba(12,11,9,0.38)';
                (e.currentTarget as HTMLElement).style.transform = 'none';
              }}
            >
              {item.toUpperCase()}
            </a>
          ))}

          {/* Divider */}
          <div style={{ width: '1px', height: '14px', background: 'rgba(12,11,9,0.12)' }} />

          {/* About — page link, slightly different style */}
          <a
            href="/about"
            style={{
              fontFamily: "'Hanken Grotesk', sans-serif",
              fontSize: '11px', fontWeight: 600,
              letterSpacing: '0.12em',
              color: 'rgba(12,11,9,0.55)',
              textDecoration: 'none',
              transition: 'color 0.22s, transform 0.22s',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = '#b8923a';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'rgba(12,11,9,0.55)';
              (e.currentTarget as HTMLElement).style.transform = 'none';
            }}
          >
            <span style={{ fontSize: '10px', opacity: 0.7 }}>◈</span>
            DOCS
          </a>
        </div>

        {/* ── RIGHT: ConnectButton + hamburger ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="nav-connect-btn">
            <ConnectButton
              showBalance={false}
              chainStatus="none"
              accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
            />
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="ham-btn"
            aria-label="Toggle menu"
            style={{
              display: 'none',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px',
              flexDirection: 'column', gap: '5px',
            }}
          >
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '22px', height: '1.5px',
                background: '#0c0b09',
                borderRadius: '2px',
                transition: 'all 0.32s cubic-bezier(.16,1,.3,1)',
                transform: menuOpen
                  ? i === 0 ? 'rotate(45deg) translate(4.5px, 4.5px)'
                  : i === 1 ? 'scaleX(0)'
                  : 'rotate(-45deg) translate(4.5px, -4.5px)'
                  : 'none',
                opacity: menuOpen && i === 1 ? 0 : 1,
              }} />
            ))}
          </button>
        </div>
      </nav>

      {/* ── MOBILE OVERLAY ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 490,
        background: '#f8f4ee',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '40px',
        opacity: menuOpen ? 1 : 0,
        pointerEvents: menuOpen ? 'auto' : 'none',
        transition: 'opacity 0.38s ease',
      }}>
        {anchorLinks.map((item, i) => (
          <a
            key={item}
            href={`#${item.toLowerCase()}`}
            onClick={() => setMenuOpen(false)}
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: '48px', fontWeight: 300,
              color: '#0c0b09', textDecoration: 'none',
              letterSpacing: '-0.02em',
              opacity: menuOpen ? 1 : 0,
              transform: menuOpen ? 'none' : 'translateY(20px)',
              transition: `all 0.5s cubic-bezier(.16,1,.3,1) ${i * 60}ms`,
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#b8923a'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#0c0b09'}
          >
            {item}
          </a>
        ))}

        {/* About in mobile menu */}
        <a
          href="/about"
          onClick={() => setMenuOpen(false)}
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: '48px', fontWeight: 300,
            color: '#b8923a', textDecoration: 'none',
            letterSpacing: '-0.02em',
            opacity: menuOpen ? 1 : 0,
            transform: menuOpen ? 'none' : 'translateY(20px)',
            transition: `all 0.5s cubic-bezier(.16,1,.3,1) ${anchorLinks.length * 60}ms`,
            display: 'flex', alignItems: 'center', gap: '12px',
          }}
        >
          <span style={{ fontSize: '32px' }}>◈</span> Docs
        </a>

        <div style={{
          marginTop: '8px',
          opacity: menuOpen ? 1 : 0,
          transform: menuOpen ? 'none' : 'translateY(20px)',
          transition: `all 0.5s cubic-bezier(.16,1,.3,1) ${(anchorLinks.length + 1) * 60}ms`,
        }}>
          <ConnectButton label="Connect Wallet" />
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,200..900;1,9..144,200..900&family=Hanken+Grotesk:wght@300;400;500;600&family=Azeret+Mono:wght@300;400;500&display=swap');

        @keyframes logoGemSpin {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(184,146,58,0.5));  }
          50%       { filter: drop-shadow(0 0 14px rgba(184,146,58,0.85)); }
        }

        @media (max-width: 900px) {
          .nav-links-desktop { display: none !important; }
          .ham-btn            { display: flex  !important; }
          .nav-connect-btn    { display: none  !important; }
          nav { padding-left: 24px !important; padding-right: 24px !important; }
        }
      `}</style>
    </>
  );
}