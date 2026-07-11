'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ── DATA ─────────────────────────────────────────────────────────────────────

const CONTRACTS = [
  {
    num: '01', name: 'ReputationToken', tag: 'ERC-5484 · Immutable', c: '#e11d7a', 
    addr: '0x9c77Ce31...F70F46',
    fullAddr: '0x9c77Ce31a110e360d62e4eF8B1F4cf8576F70F46',
    etherscan: 'https://sepolia.etherscan.io/address/0x9c77Ce31a110e360d62e4eF8B1F4cf8576F70F46',
    icon: '🛡️',
  },
  {
    num: '02', name: 'ReputationEngine', tag: 'UUPS · Upgradeable Proxy', c: '#3b82f6',
    addr: '0x4eFC1adc...FaBD8',
    fullAddr: '0x4eFC1adc7Dd594C4bB04865B6dCc5101392FaBD8',
    etherscan: 'https://sepolia.etherscan.io/address/0x4eFC1adc7Dd594C4bB04865B6dCc5101392FaBD8',
    icon: '⚙️',
  },
  {
    num: '03', name: 'ReputationVault', tag: 'Action Gateway', c: '#10b981',
    addr: '0xd53320CD...D98b6',
    fullAddr: '0xd53320CDEF6f3DfA54436D2806e765d6d6bD98b6',
    etherscan: 'https://sepolia.etherscan.io/address/0xd53320CDEF6f3DfA54436D2806e765d6d6bD98b6',
    icon: '🔒',
  },
];

const TIERS = [
  { name: 'Unranked', range: '0 – 99',     c: '#94a3b8', icon: '◈', voting: '0.5×', loan: 'None',  medal: 'Grey hexagon with a question mark — your journey begins here.' },
  { name: 'Bronze',   range: '100 – 299',  c: '#c2773a', icon: '★', voting: '1×',   loan: '20%',   medal: 'Copper circle bearing a six-point star — early trust established.' },
  { name: 'Silver',   range: '300 – 599',  c: '#8b9eb7', icon: '✦', voting: '1.5×', loan: '40%',   medal: 'Silver circle with a five-point star — a recognised participant.' },
  { name: 'Gold',     range: '600 – 849',  c: '#c9933a', icon: '♛', voting: '2×',   loan: '60%',   medal: 'Gold circle crowned with gemstones — a protocol veteran.' },
  { name: 'Platinum', range: '850 – 1000', c: '#7c5cbf', icon: '◆', voting: '3×',   loan: '80%',   medal: 'Platinum ring with a cut diamond — the pinnacle of on-chain identity.' },
];

const ACTIONS = [
  { name: 'DAO Vote',         delta: '+10', pos: true,  icon: '⬡', c: '#3b6cf6', why: 'Participating in governance signals long-term alignment with a protocol.' },
  { name: 'DAO Proposal',     delta: '+25', pos: true,  icon: '◈', c: '#0d9660', why: 'Submitting a proposal requires effort, research, and genuine skin in the game.' },
  { name: 'Loan Repaid',      delta: '+30', pos: true,  icon: '◉', c: '#7c5cbf', why: 'Repaying debt on-chain is the strongest signal of financial trustworthiness.' },
  { name: 'Airdrop Held 30d', delta: '+15', pos: true,  icon: '◆', c: '#c2357a', why: 'Holding an airdrop for 30 days demonstrates patience and project belief.' },
  { name: 'NFT Minted',       delta: '+5',  pos: true,  icon: '✦', c: '#c9933a', why: 'NFT minting shows active community participation and cultural engagement.' },
  { name: 'Loan Defaulted',   delta: '−50', pos: false, icon: '◌', c: '#ef4444', why: 'Defaulting on a loan is the most severe trust violation in DeFi.' },
  { name: 'Airdrop Dumped',   delta: '−20', pos: false, icon: '◇', c: '#f97316', why: 'Selling an airdrop immediately signals opportunism over genuine participation.' },
];

const PRINCIPLES = [
  {
    num: '01', title: 'Immutability where it matters',
    body: 'The token contract — which holds every wallet\'s SBT ownership record — is deliberately non-upgradeable. SBT ownership is the ground truth of on-chain identity. If the token contract were upgradeable, a compromised owner could silently reassign tokens or remove the transfer lock, destroying the soulbound guarantee entirely. Permanence is not a limitation here — it is the feature.',
    c: '#e11d7a',
  },
  {
    num: '02', title: 'Upgradeability where logic lives',
    body: 'The scoring engine that calculates reputation is built on the UUPS proxy pattern. This separates two distinct concerns: ownership (immutable) and intelligence (upgradeable). As new action types emerge, as tier thresholds need recalibration, or as the protocol evolves, the engine can be upgraded without touching the token layer. Your wallet\'s SBT address and token ID never change.',
    c: '#3b82f6',
  },
  {
    num: '03', title: 'No IPFS, no servers, no dependencies',
    body: 'Every medal — from the grey hexagon of an Unranked wallet to the platinum diamond of a Platinum holder — is generated entirely in Solidity as an on-chain SVG. The metadata lives in the blockchain itself. No external storage, no IPFS gateway that can go offline, no company server that can be shut down. Your token\'s artwork exists as long as Ethereum exists.',
    c: '#10b981',
  },
  {
    num: '04', title: 'Dynamic art, static ownership',
    body: 'When you call tokenURI() for a given token, the contract reads the wallet\'s current score from the engine and generates the appropriate medal on the fly. This means your medal upgrades automatically as your reputation improves — Bronze becomes Silver becomes Gold — without any re-minting, gas cost, or user action. The art reflects truth in real time.',
    c: '#c9933a',
  },
  {
    num: '05', title: 'One token per wallet, forever',
    body: 'The system enforces strict uniqueness. Every wallet can hold exactly one Soulbound Token. Once issued, it cannot be transferred to another address — ever. It is not listed on marketplaces. It is not sold. It is not gifted. The wallet that earned it is the only wallet that will ever hold it. If the token is burned, a new one can be re-issued to the same wallet on their next action.',
    c: '#7c5cbf',
  },
  {
    num: '06', title: 'Behaviour is penalised, not just rewarded',
    body: 'Most reputation systems only track positive signals. This protocol tracks both. Defaulting on a loan costs 50 points — the single largest single-action penalty in the system. Dumping an airdrop costs 20. These are not trivial deductions. A wallet that defaults erases months of careful governance participation in a single transaction. Reputation is fragile by design.',
    c: '#f97316',
  },
];

// ── RIBBON SVG ────────────────────────────────────────────────────────────────
function RibbonLayer() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      <defs>
        <linearGradient id="ar1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fce7f3" stopOpacity="0.7"/>
          <stop offset="50%" stopColor="#e9d5ff" stopOpacity="0.45"/>
          <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.18"/>
        </linearGradient>
        <linearGradient id="ar2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#ede9fe" stopOpacity="0.18"/>
        </linearGradient>
      </defs>
      <path d="M-100,420 C220,310 490,520 760,400 C1030,280 1230,460 1540,370"
        fill="none" stroke="url(#ar1)" strokeWidth="80" strokeLinecap="round" opacity="0.5">
        <animateTransform attributeName="transform" type="translate" values="0,0;40,30;-25,10;0,0" dur="6s" repeatCount="indefinite"/>
      </path>
      <path d="M-100,620 C310,530 590,700 890,580 C1190,460 1360,630 1540,540"
        fill="none" stroke="url(#ar2)" strokeWidth="42" strokeLinecap="round" opacity="0.35">
        <animateTransform attributeName="transform" type="translate" values="0,0;-45,18;22,-10;0,0" dur="7s" repeatCount="indefinite"/>
      </path>
    </svg>
  );
}

// ── SCROLL REVEAL ─────────────────────────────────────────────────────────────
function useReveal() {
  const [visible, setVisible] = useState<Set<string>>(new Set());
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setVisible(p => new Set([...p, e.target.id])); }),
      { threshold: 0.08 }
    );
    const els = document.querySelectorAll('[data-reveal]');
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  const rv = useCallback((id: string, delay = 0): React.CSSProperties => ({
    opacity: visible.has(id) ? 1 : 0,
    transform: visible.has(id) ? 'translateY(0) scale(1)' : 'translateY(26px) scale(0.98)',
    transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
  }), [visible]);
  return { rv };
}

// ── SECTION WRAPPER ───────────────────────────────────────────────────────────
function Section({ id, children, style = {} }: { id: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section id={id} style={{ position: 'relative', zIndex: 1, ...style }}>
      {children}
    </section>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function About() {
  const { rv } = useReveal();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLowPower, setIsLowPower] = useState(true); // default true, set false only on desktop
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 55);
    window.addEventListener('scroll', fn, { passive: true });
    // Detect desktop: no touch + wide screen
    const notMobile = window.innerWidth > 1024 && !('ontouchstart' in window);
    setIsLowPower(!notMobile);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Particle canvas — desktop only
  useEffect(() => {
    if (isLowPower) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const pts = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.9, vy: (Math.random() - 0.5) * 0.9,
      r: Math.random() * 1.6 + 0.3, a: Math.random() * 0.28 + 0.06,
      h: Math.random() > 0.5 ? 310 : 270,
    }));
    let raf: number;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.h},55%,68%,${p.a})`; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 85) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.strokeStyle = `hsla(290,45%,65%,${0.05 * (1 - d / 85)})`; ctx.lineWidth = 0.5; ctx.stroke(); }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [isLowPower]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700;1,800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&family=JetBrains+Mono:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #fdfbff; color: #0d0b14; font-family: 'DM Sans', sans-serif; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
        ::selection { background: rgba(219,39,119,0.14); }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: #fdfbff; }
        ::-webkit-scrollbar-thumb { background: rgba(124,92,191,0.35); border-radius: 2px; }

        @keyframes orbA0 { 0%,100%{transform:translate(0,0) rotate(0deg)} 33%{transform:translate(18px,-24px) rotate(4deg)} 66%{transform:translate(-10px,14px) rotate(-3deg)} }
        @keyframes orbA1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-22px,28px)} }
        @keyframes orbA2 { 0%,100%{transform:translate(0,0)} 40%{transform:translate(14px,-18px)} 75%{transform:translate(-9px,11px)} }
        @keyframes orbA3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(10px,-20px) scale(1.02)} }

        @keyframes heroFadeUp { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmerTitle { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes liveDot { 0%,100%{transform:scale(1);opacity:0.9} 50%{transform:scale(1.7);opacity:0.4} }
        @keyframes scrollHint { 0%,100%{transform:translateY(0);opacity:0.4} 50%{transform:translateY(9px);opacity:0.8} }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 8px 28px rgba(124,92,191,0.28)} 50%{box-shadow:0 14px 44px rgba(124,92,191,0.48)} }
        @keyframes floatGem { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-11px)} }
        @keyframes badgeShimmer { 0%,100%{background:rgba(255,255,255,0.82)} 50%{background:rgba(245,230,255,0.95)} }

        /* ── NAV ── */
        .nav-root {
          position: fixed; top: 0; left: 0; right: 0; z-index: 900;
          padding: 14px 48px; display: flex; align-items: center; justify-content: space-between;
          transition: background 0.4s ease, border-color 0.4s ease, padding 0.4s ease;
        }
        .nav-root.scrolled {
          background: rgba(253,251,255,0.92);
          backdrop-filter: blur(24px) saturate(1.6);
          -webkit-backdrop-filter: blur(24px) saturate(1.6);
          border-bottom: 1px solid rgba(124,92,191,0.1);
          padding-top: 11px; padding-bottom: 11px;
        }

        /* ── HERO — the key fix ── */
        /* Do NOT use min-height: 100vh or 100svh here.
           Instead use a fixed pixel min + flex centering so content
           always visible without massive blank gap in desktop mode. */
        .about-hero {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          overflow: hidden;
          /* Desktop: tall but bounded */
          min-height: 600px;
          max-height: 860px;
          padding: 100px 24px 60px;
        }

        @media (max-width: 1024px) {
          .about-hero {
            min-height: 520px;
            max-height: 780px;
            padding: 88px 20px 52px;
          }
        }
        @media (max-width: 768px) {
          .about-hero {
            min-height: 460px !important;
            max-height: 680px !important;
            padding: 80px 16px 44px !important;
          }
        }
        @media (max-width: 480px) {
          .about-hero {
            min-height: 420px !important;
            max-height: 620px !important;
            padding: 72px 14px 40px !important;
          }
        }
        @media (max-height: 520px) {
          .about-hero {
            min-height: auto !important;
            max-height: none !important;
            padding: 68px 16px 32px !important;
          }
        }

        /* ── PAGE TITLE ── */
        .page-title {
          font-family: 'Playfair Display', serif; font-weight: 900;
          font-size: clamp(32px, 6vw, 80px); line-height: 1.02; letter-spacing: -0.03em;
          background: linear-gradient(130deg, #0d0b14 0%, #3b0764 22%, #7c3aed 46%, #c2357a 68%, #c9933a 88%);
          background-size: 260% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; animation: shimmerTitle 4.5s linear infinite;
        }

        .section-h { font-family: 'Playfair Display', serif; font-weight: 900; font-size: clamp(22px,4vw,50px); letter-spacing: -0.03em; color: #0d0b14; line-height: 1.06; }
        .body-text { font-size: clamp(14px,1.6vw,16px); font-weight: 400; color: rgba(13,11,20,0.68); line-height: 1.82; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .pull-quote { border-left: 3px solid; padding: 20px 24px; border-radius: 0 12px 12px 0; margin: 32px 0; }

        /* ── ORB: desktop only ── */
        .orb-wrap {
          position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none;
          /* hidden by default, shown only on desktop via media query */
          display: none;
        }
        @media (min-width: 1025px) {
          .orb-wrap { display: block; }
        }

        /* ── TOC ── */
        .toc-link { display: flex; padding: 10px 0; border-bottom: 1px solid rgba(13,11,20,0.07); font-size: 13px; font-weight: 500; color: rgba(13,11,20,0.55); text-decoration: none; transition: all 0.2s ease; align-items: center; gap: 10px; }
        .toc-link:hover { color: #7c5cbf; padding-left: 6px; }
        .toc-num { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: rgba(13,11,20,0.28); min-width: 24px; }
        .contract-chip { padding: 5px 12px; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.06em; transition: all 0.2s ease; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }

        /* ── NAV RESPONSIVE ── */
        .nav-links-desk { display: flex; gap: 26px; align-items: center; }
        .ham-btn { display: none !important; }

        @media (max-width: 900px) {
          .nav-root { padding: 12px 16px !important; }
          .nav-links-desk { display: none !important; }
          .ham-btn { display: flex !important; }
        }
        @media (max-width: 480px) {
          .nav-root { padding: 10px 12px !important; }
        }

        /* ── LAYOUT GRIDS ── */
        @media (max-width: 768px) {
          .two-col { grid-template-columns: 1fr !important; }
          .toc-grid { grid-template-columns: 1fr !important; }
          .tier-cards { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .tier-cards { grid-template-columns: 1fr !important; }
          .pull-quote { padding: 14px 16px; }
          .toc-inner { padding: 22px 18px !important; }
          .contract-card { padding: 20px 16px !important; }
          .principle-card { padding: 18px 16px !important; }
          .security-item { padding: 12px 14px !important; }
        }

        /* ── SECTION PADDING ── */
        .sec-pad { padding: 56px 16px; }
        @media (max-width: 768px) { .sec-pad { padding: 48px 16px; } }
        @media (max-width: 480px) { .sec-pad { padding: 40px 14px; } }

        /* ── SCROLL HINT: hide on short screens ── */
        @media (max-height: 600px), (max-width: 480px) {
          .scroll-hint { display: none !important; }
        }
      `}</style>

      {/* Particle canvas — desktop only, add class for CSS fallback */}
      {!isLowPower && (
        <canvas ref={canvasRef} className="particle-canvas"
          style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.65 }} />
      )}

      {/* Background gradient mesh */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 85% 55% at 10% 5%, rgba(253,220,245,0.5) 0%, transparent 55%),
          radial-gradient(ellipse 60% 48% at 88% 10%, rgba(218,210,252,0.44) 0%, transparent 52%),
          radial-gradient(ellipse 48% 40% at 55% 80%, rgba(254,240,195,0.32) 0%, transparent 50%),
          radial-gradient(ellipse 38% 35% at 6% 84%, rgba(205,248,225,0.24) 0%, transparent 48%),
          #fdfbff
        `,
      }} />

      {/* Orbs — desktop only via class */}
      <div className="orb-wrap">
        {[
          { size: 280, x: '68%', y: '-8%',  delay: 0, dur: 5, c1: 'rgba(251,200,228,0.85)', c2: 'rgba(192,175,251,0.7)',  c3: 'rgba(143,45,230,0.28)',  anim: 'orbA0' },
          { size: 160, x: '-4%', y: '4%',   delay: 1, dur: 4, c1: 'rgba(252,218,248,0.85)', c2: 'rgba(249,200,228,0.65)', c3: 'rgba(192,175,251,0.35)', anim: 'orbA1' },
          { size: 120, x: '65%', y: '50%',  delay: 2, dur: 6, c1: 'rgba(254,246,190,0.85)', c2: 'rgba(252,218,172,0.65)', c3: 'rgba(242,152,5,0.22)',   anim: 'orbA2' },
          { size: 220, x: '5%',  y: '60%',  delay: 0, dur: 5, c1: 'rgba(220,240,252,0.85)', c2: 'rgba(188,216,252,0.65)', c3: 'rgba(95,98,238,0.22)',   anim: 'orbA1' },
          { size: 90,  x: '86%', y: '68%',  delay: 1, dur: 4, c1: 'rgba(252,222,222,0.85)', c2: 'rgba(250,160,160,0.65)', c3: 'rgba(215,32,32,0.18)',   anim: 'orbA3' },
        ].map((o, i) => (
          <div key={i} style={{
            position: 'absolute', left: o.x, top: o.y, width: o.size, height: o.size, borderRadius: '50%',
            background: `radial-gradient(circle at 33% 28%, rgba(255,255,255,0.95) 0%, ${o.c1} 25%, ${o.c2} 55%, ${o.c3} 82%, transparent 100%)`,
            animation: `${o.anim} ${o.dur}s ease-in-out ${o.delay * 0.35}s infinite`,
            pointerEvents: 'none',
          }} />
        ))}
      </div>

      {/* ══════════ NAVBAR ══════════ */}
      <nav className={`nav-root${scrolled ? ' scrolled' : ''}`}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #7c3aed, #c2357a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, boxShadow: '0 4px 14px rgba(124,58,237,0.32)', flexShrink: 0 }}>◆</div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: '#0d0b14', letterSpacing: '0.04em', lineHeight: 1 }}>RST<span style={{ color: '#c2357a' }}>.</span></div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: 'rgba(13,11,20,0.38)', letterSpacing: '0.22em', marginTop: 1 }}>PROTOCOL</div>
          </div>
        </a>

        <div className="nav-links-desk">
          {['Overview', 'Architecture', 'Tiers', 'Actions', 'Security'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: 'rgba(13,11,20,0.5)', textDecoration: 'none', letterSpacing: '0.13em', transition: 'color 0.2s', textTransform: 'uppercase' as const }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#7c5cbf'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(13,11,20,0.5)'}
            >{l}</a>
          ))}
          <div style={{ width: 1, height: 14, background: 'rgba(13,11,20,0.12)' }} />
          <a href="/" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: 'rgba(13,11,20,0.5)', textDecoration: 'none', letterSpacing: '0.13em', transition: 'color 0.2s', textTransform: 'uppercase' as const }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#c2357a'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(13,11,20,0.5)'}
          >← Back to App</a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="https://github.com/NexTechArchitect/RST-Reputation-Protocol" target="_blank" rel="noopener noreferrer"
            style={{ display: 'none' }}
            className="nav-links-desk"
          >GitHub</a>

          <button onClick={() => setMenuOpen(!menuOpen)} className="ham-btn" aria-label="Toggle menu"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexDirection: 'column' as const, gap: 5, alignItems: 'center', justifyContent: 'center' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 22, height: 1.5, background: '#0d0b14', borderRadius: 2, transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)', transform: menuOpen ? (i===0?'rotate(45deg) translate(4.5px,4.5px)':i===1?'scaleX(0)':'rotate(-45deg) translate(4.5px,-4.5px)') : 'none', opacity: menuOpen && i===1 ? 0 : 1 }} />
            ))}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 890, background: '#fdfbff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, opacity: menuOpen ? 1 : 0, pointerEvents: menuOpen ? 'auto' : 'none', transition: 'opacity 0.3s ease' }}>
        {['Overview', 'Architecture', 'Tiers', 'Actions', 'Security', '← App'].map((item, i) => (
          <a key={item} href={item === '← App' ? '/' : `#${item.toLowerCase()}`} onClick={() => setMenuOpen(false)}
            style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, fontWeight: 700, color: '#0d0b14', textDecoration: 'none', opacity: menuOpen ? 1 : 0, transform: menuOpen ? 'none' : 'translateY(16px)', transition: `all 0.44s cubic-bezier(0.16,1,0.3,1) ${i * 50}ms` }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#c2357a'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#0d0b14'}
          >{item}</a>
        ))}
        <a href="https://github.com/NexTechArchitect/RST-Reputation-Protocol" target="_blank" rel="noopener noreferrer"
          onClick={() => setMenuOpen(false)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4, padding: '10px 20px', borderRadius: 10, background: 'rgba(13,11,20,0.06)', border: '1px solid rgba(13,11,20,0.12)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'rgba(13,11,20,0.6)', textDecoration: 'none', opacity: menuOpen ? 1 : 0, transition: `all 0.44s cubic-bezier(0.16,1,0.3,1) 300ms` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          GitHub
        </a>
      </div>

      {/* ══════════ HERO ══════════ */}
      <section className="about-hero">
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}><RibbonLayer /></div>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 820, width: '100%' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '6px 14px', borderRadius: 100, background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(124,92,191,0.2)', fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: 'rgba(13,11,20,0.6)', letterSpacing: '0.12em', marginBottom: 22, animation: 'heroFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both, badgeShimmer 4s ease-in-out infinite', boxShadow: '0 2px 12px rgba(124,92,191,0.1)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'liveDot 2s ease-in-out infinite', flexShrink: 0 }} />
            PROJECT DOCUMENTATION · RST PROTOCOL
          </div>

          <h1 className="page-title" style={{ marginBottom: 18, animation: 'heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}>
            What is the RST<br />Protocol?
          </h1>

          <p className="body-text" style={{ maxWidth: 520, margin: '0 auto 28px', animation: 'heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both', padding: '0 4px' }}>
            A fully on-chain reputation system that assigns every Ethereum wallet a permanent, non-transferable identity token — one that evolves as the wallet behaves. No servers. No databases. No IPFS. Just Solidity, storage, and truth.
          </p>

          {/* Jump links */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', animation: 'heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.28s both', padding: '0 4px' }}>
            {[
              { l: 'Overview',     href: '#overview',      c: '#7c3aed' },
              { l: 'Architecture', href: '#architecture',  c: '#3b82f6' },
              { l: 'Tiers',        href: '#tiers',         c: '#c9933a' },
              { l: 'Security',     href: '#security',      c: '#e11d7a' },
            ].map(link => (
              <a key={link.l} href={link.href} style={{ padding: '7px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(13,11,20,0.1)', fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: 'rgba(13,11,20,0.62)', textDecoration: 'none', letterSpacing: '0.08em', transition: 'all 0.22s ease' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = link.c; el.style.borderColor = `${link.c}40`; el.style.background = 'rgba(255,255,255,0.96)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(13,11,20,0.62)'; el.style.borderColor = 'rgba(13,11,20,0.1)'; el.style.background = 'rgba(255,255,255,0.82)'; }}
              >{link.l}</a>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div className="scroll-hint" style={{ position: 'absolute', bottom: 20, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, animation: 'scrollHint 2.2s ease-in-out infinite' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: 'rgba(13,11,20,0.32)', letterSpacing: '0.22em' }}>SCROLL TO READ</div>
          <div style={{ width: 1, height: 22, background: 'linear-gradient(to bottom, rgba(124,92,191,0.5), transparent)' }} />
        </div>
      </section>

      {/* ══════════ TABLE OF CONTENTS ══════════ */}
      <Section id="toc" style={{ padding: '40px 16px 48px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div id="toc-block" data-reveal className="toc-inner" style={{ padding: '28px 32px', borderRadius: 20, background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(124,92,191,0.12)', boxShadow: '0 8px 36px rgba(13,11,20,0.06)', ...rv('toc-block') }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '0.22em', color: 'rgba(13,11,20,0.38)', marginBottom: 18, textTransform: 'uppercase' as const }}>Contents</div>
            <div className="toc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
              {[
                ['01', 'The Problem', '#overview'],
                ['02', 'How It Works', '#how-it-works'],
                ['03', 'System Architecture', '#architecture'],
                ['04', 'The Three Contracts', '#contracts'],
                ['05', 'Reputation Tiers', '#tiers'],
                ['06', 'Scoring Actions', '#actions'],
                ['07', 'On-Chain SVG Medals', '#medals'],
                ['08', 'Design Philosophy', '#philosophy'],
                ['09', 'Security Model', '#security'],
                ['10', 'Deployed Contracts', '#deployed'],
              ].map(([num, label, href]) => (
                <a key={num} href={href} className="toc-link">
                  <span className="toc-num mono">{num}</span>
                  <span>{label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ══════════ OVERVIEW ══════════ */}
      <Section id="overview" style={{ padding: '56px 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div id="ov-hdr" data-reveal style={rv('ov-hdr')}>
            <h2 className="section-h" style={{ marginBottom: 24 }}>On-chain identity is broken.</h2>
          </div>
          <div id="ov-body" data-reveal style={{ ...rv('ov-body', 100) }}>
            <p className="body-text" style={{ marginBottom: 20 }}>
              Every Ethereum wallet looks the same to a smart contract. A DeFi power user who has voted in dozens of governance proposals, repaid multiple loans, and held through three market cycles is indistinguishable — at the protocol level — from a wallet created five minutes ago with a single ETH transfer.
            </p>
            <p className="body-text" style={{ marginBottom: 20 }}>
              This creates a fundamental problem for any protocol that wants to reward trust, extend credit, or weight governance influence. Without persistent, verifiable on-chain identity, every system defaults to treating wallets as anonymous and equal — which they are not.
            </p>
            <div className="pull-quote" style={{ borderColor: '#7c3aed22', background: 'rgba(124,58,237,0.04)' }}>
              <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(14px,2vw,20px)', fontWeight: 700, color: '#3b0764', lineHeight: 1.55, fontStyle: 'italic' }}>
                "The RST Protocol solves this. Not with a centralised score, not with a KYC provider, not with a social graph — but with raw on-chain behaviour, permanently recorded and cryptographically verified."
              </p>
            </div>
            <p className="body-text" style={{ marginBottom: 20 }}>
              When a wallet interacts with the RST Protocol, every action they take — every vote cast, every loan repaid, every airdrop held — is permanently written to the blockchain and translated into a numeric reputation score between 0 and 1000.
            </p>
            <p className="body-text">
              The result is a composable reputation layer that any DeFi protocol can read from. Lending protocols can offer larger undercollateralised loans to Platinum wallets. DAOs can weight Platinum votes three times higher than Unranked wallets. All of this happens transparently, on-chain, without a single database or API call.
            </p>
          </div>
        </div>
      </Section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <Section id="how-it-works" style={{ padding: '56px 16px', background: 'rgba(255,255,255,0.45)', borderTop: '1px solid rgba(13,11,20,0.07)', borderBottom: '1px solid rgba(13,11,20,0.07)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div id="hiw-hdr" data-reveal style={{ marginBottom: 40, ...rv('hiw-hdr') }}>
            <h2 className="section-h">Four steps. One identity.</h2>
          </div>
          <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { step: '01', title: 'You connect your wallet', c: '#7c3aed', body: 'Nothing is minted immediately. Your wallet exists in an Unranked state — a score of zero, no token. The protocol is aware of you, but your on-chain story has not yet begun.' },
              { step: '02', title: 'You take your first action', c: '#3b82f6', body: 'The moment you cast a vote, repay a loan, or perform any tracked action through the ReputationVault, two things happen at once: your score is updated, and if you do not already have a Soulbound Token, one is issued to your wallet automatically.' },
              { step: '03', title: 'Your score accumulates', c: '#10b981', body: 'Every subsequent action modifies your score upward or downward. The scoring is bounded between 0 and 1000. Your score reflects a lifetime of on-chain behaviour, not just your most recent transaction.' },
              { step: '04', title: 'Your medal upgrades automatically', c: '#c9933a', body: 'As your score crosses tier thresholds — 100 for Bronze, 300 for Silver, 600 for Gold, 850 for Platinum — the artwork displayed by your Soulbound Token changes on the fly. No re-minting. No gas cost.' },
            ].map((item, i) => (
              <div key={item.step} id={`hiw${i}`} data-reveal style={{ padding: '22px 20px', borderRadius: 16, background: 'rgba(255,255,255,0.88)', border: `1px solid ${item.c}18`, position: 'relative', overflow: 'hidden', ...rv(`hiw${i}`, i * 80) }}>
                <div style={{ position: 'absolute', bottom: -12, right: 8, fontFamily: "'Playfair Display',serif", fontSize: 72, fontWeight: 900, color: `${item.c}07`, lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>{item.step}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: item.c, letterSpacing: '0.16em', marginBottom: 10, fontWeight: 600 }}>STEP {item.step}</div>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, fontSize: 'clamp(15px,2vw,20px)', color: '#0d0b14', marginBottom: 12, lineHeight: 1.2 }}>{item.title}</h3>
                <p style={{ fontSize: 13, fontWeight: 400, color: 'rgba(13,11,20,0.64)', lineHeight: 1.72 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════ ARCHITECTURE ══════════ */}
      <Section id="architecture" style={{ padding: '56px 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div id="arch-hdr" data-reveal style={rv('arch-hdr')}>
            <h2 className="section-h" style={{ marginBottom: 24 }}>Separation of concerns, taken seriously.</h2>
          </div>
          <div id="arch-body" data-reveal style={{ ...rv('arch-body', 90) }}>
            <p className="body-text" style={{ marginBottom: 20 }}>
              The RST Protocol is composed of three independent smart contracts, each with a single, clearly defined responsibility. This separation is not just a design preference — it is a security requirement.
            </p>
            <p className="body-text" style={{ marginBottom: 28 }}>
              The token — which holds the permanent record of who owns which Soulbound Token — is completely immutable. The engine — which calculates scores, resolves tiers, and decides when to issue tokens — is upgradeable via the UUPS proxy pattern. Scoring logic is not ground truth. It is policy, and policy must be allowed to evolve.
            </p>
            {/* Architecture diagram */}
            <div style={{ padding: '20px 18px', borderRadius: 16, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(13,11,20,0.08)', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, lineHeight: 2.0, overflowX: 'auto' }}>
              <div style={{ color: 'rgba(13,11,20,0.4)', fontSize: 8, letterSpacing: '0.16em', marginBottom: 14 }}>SYSTEM LAYERS · TOP TO BOTTOM</div>
              {[
                { label: 'USER / DAPP', sub: 'Wagmi v2 · Viem · RainbowKit', c: '#7c5cbf', arrow: true },
                { label: 'REPUTATION VAULT', sub: 'castVote() · takeLoan() · claimAirdrop() · mintNFT()', c: '#10b981', arrow: true },
                { label: 'REPUTATION ENGINE', sub: 'Score calculation · Tier resolution · SBT auto-issuance', c: '#3b82f6', arrow: true },
                { label: 'REPUTATION TOKEN', sub: 'ERC-5484 Soulbound · On-chain SVG · Immutable ownership', c: '#e11d7a', arrow: false },
              ].map((layer) => (
                <div key={layer.label}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, background: `${layer.c}08`, border: `1px solid ${layer.c}18`, flexWrap: 'wrap' }}>
                    <span style={{ color: layer.c, fontWeight: 600, fontSize: 10, letterSpacing: '0.08em', minWidth: 150, flexShrink: 0 }}>{layer.label}</span>
                    <span style={{ color: 'rgba(13,11,20,0.48)', fontSize: 10 }}>{layer.sub}</span>
                  </div>
                  {layer.arrow && <div style={{ textAlign: 'center', color: 'rgba(13,11,20,0.22)', fontSize: 14, margin: '2px 0' }}>↓</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ══════════ THE THREE CONTRACTS ══════════ */}
      <Section id="contracts" style={{ padding: '56px 16px', background: 'rgba(255,255,255,0.45)', borderTop: '1px solid rgba(13,11,20,0.07)', borderBottom: '1px solid rgba(13,11,20,0.07)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div id="con-hdr" data-reveal style={{ marginBottom: 40, ...rv('con-hdr') }}>
            <h2 className="section-h">Three contracts. One identity.</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              {
                ...CONTRACTS[0],
                heading: 'The soul of the system',
                body: `ReputationToken is where permanent records live. Every wallet's Soulbound Token ownership is stored here, and this contract will never change. It enforces the ERC-5484 standard — which means it fires the correct Issued event with burn authorisation details when a token is created, registers its own interface ID so other contracts can detect it, and absolutely refuses to allow any token transfer between wallets. The transfer lock is enforced at the lowest possible level inside OpenZeppelin's ERC-721 base, meaning no present or future code path can bypass it.`,
                detail: 'The token contract can only be controlled by the engine address, which is set exactly once after deployment and can never be changed again. This engine lock means even if the owner\'s private key were compromised, the token records themselves are fully protected.',
              },
              {
                ...CONTRACTS[1],
                heading: 'The brain of the system',
                body: `ReputationEngine is where intelligence lives. It receives action signals from authorised callers — primarily the ReputationVault — and updates scores accordingly. The engine uses a pure math library called ReputationMath to calculate score changes. Every score delta is routed through an Action enum rather than raw signed integers, which prevents callers from injecting arbitrary score changes. The engine is deployed behind a UUPS proxy, meaning its logic can be upgraded while the proxy address remains unchanged.`,
                detail: 'The engine is responsible for one automatic behaviour that happens on every first action: if the acting wallet does not yet have a Soulbound Token, it calls the token contract to issue one. This removes any separate minting step for the user.',
              },
              {
                ...CONTRACTS[2],
                heading: 'The gateway of the system',
                body: `ReputationVault is the user-facing entry point. It simulates the kinds of actions that real DeFi protocols would perform — DAO governance, lending, airdrop mechanics, NFT minting — and records each one to the engine. Cooldowns are enforced per action type: voting and NFT minting have 12-hour cooldowns, proposal submission has a 24-hour cooldown, loan and airdrop actions are gated by natural state rather than time.`,
                detail: 'The airdrop mechanic is particularly deliberate: claiming an airdrop starts a timer, and settling it before 30 days have passed penalises the wallet with −20 points. Settling after 30 days rewards it with +15.',
              },
            ].map((c, i) => (
              <div key={c.name} id={`ccard${i}`} data-reveal className="contract-card" style={{ padding: '26px 22px', borderRadius: 18, background: 'rgba(255,255,255,0.9)', border: `1px solid ${c.c}18`, overflow: 'hidden', position: 'relative', ...rv(`ccard${i}`, i * 90) }}>
                <div style={{ position: 'absolute', top: -16, right: -8, fontFamily: "'Playfair Display',serif", fontSize: 90, fontWeight: 900, color: `${c.c}06`, lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>{c.num}</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 20 }}>{c.icon}</span>
                      <h3 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: 'clamp(17px,2.5vw,23px)', color: '#0d0b14', letterSpacing: '-0.02em', lineHeight: 1 }}>{c.name}</h3>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 600, color: c.c, padding: '3px 8px', borderRadius: 6, background: `${c.c}10`, border: `1px solid ${c.c}22`, letterSpacing: '0.07em' }}>{c.tag}</span>
                    </div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(13px,1.5vw,15px)', fontStyle: 'italic', color: 'rgba(13,11,20,0.48)' }}>{c.heading}</div>
                  </div>
                </div>
                <p style={{ fontSize: 'clamp(13px,1.4vw,14.5px)', fontWeight: 400, color: 'rgba(13,11,20,0.66)', lineHeight: 1.78, marginBottom: 14 }}>{c.body}</p>
                <div style={{ padding: '12px 14px', borderRadius: 10, background: `${c.c}06`, border: `1px solid ${c.c}14`, marginBottom: 16 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 400, color: 'rgba(13,11,20,0.58)', lineHeight: 1.7 }}>{c.detail}</p>
                </div>
                <a href={c.etherscan} target="_blank" rel="noopener noreferrer" className="contract-chip"
                  style={{ background: `${c.c}0e`, border: `1px solid ${c.c}28`, color: c.c, flexWrap: 'wrap' as const, wordBreak: 'break-all' as const }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${c.c}1e`}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `${c.c}0e`}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  View on Etherscan · {c.addr}
                </a>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════ TIERS ══════════ */}
      <Section id="tiers" style={{ padding: '56px 16px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div id="tier-hdr" data-reveal style={{ marginBottom: 36, ...rv('tier-hdr') }}>
            <h2 className="section-h">Five levels of trust.</h2>
            <p style={{ fontSize: 'clamp(13px,1.5vw,15px)', color: 'rgba(13,11,20,0.58)', marginTop: 12, maxWidth: 520, lineHeight: 1.72 }}>
              Your score places you in exactly one tier at any given time. Tiers determine two concrete privileges: how much your vote counts in governance, and how large an undercollateralised loan you can access.
            </p>
          </div>
          <div className="tier-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {TIERS.map((t, i) => (
              <div key={t.name} id={`tier${i}`} data-reveal style={{ padding: '20px 18px', borderRadius: 16, background: 'rgba(255,255,255,0.88)', border: `1.5px solid ${t.c}22`, ...rv(`tier${i}`, i * 75) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: `${t.c}12`, border: `1.5px solid ${t.c}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{t.icon}</div>
                  <div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: 18, color: t.c, letterSpacing: '-0.01em', lineHeight: 1 }}>{t.name}</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'rgba(13,11,20,0.4)', marginTop: 3 }}>Score {t.range}</div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(13,11,20,0.6)', lineHeight: 1.65, marginBottom: 14 }}>{t.medal}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ l: 'Voting', v: t.voting }, { l: 'Loan Cap', v: t.loan }].map(s => (
                    <div key={s.l} style={{ flex: 1, padding: '7px 6px', borderRadius: 9, background: `${t.c}09`, border: `1px solid ${t.c}1e`, textAlign: 'center' as const }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: 'rgba(13,11,20,0.4)', letterSpacing: '0.1em', marginBottom: 3 }}>{s.l}</div>
                      <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: 17, color: t.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════ ACTIONS ══════════ */}
      <Section id="actions" style={{ padding: '56px 16px', background: 'rgba(255,255,255,0.45)', borderTop: '1px solid rgba(13,11,20,0.07)', borderBottom: '1px solid rgba(13,11,20,0.07)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div id="act-hdr" data-reveal style={{ marginBottom: 36, ...rv('act-hdr') }}>
            <h2 className="section-h">What you do. What it costs. What it earns.</h2>
            <p style={{ fontSize: 'clamp(13px,1.5vw,15px)', color: 'rgba(13,11,20,0.58)', marginTop: 12, lineHeight: 1.72 }}>
              Every action maps to a signed score delta. Positive actions build your reputation. Negative actions erode it. There is no undo, no appeal, and no reset.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {ACTIONS.map((a, i) => (
              <div key={a.name} id={`act${i}`} data-reveal style={{ padding: '14px 16px', borderRadius: 13, background: 'rgba(255,255,255,0.85)', border: `1px solid ${a.c}18`, ...rv(`act${i}`, i * 60) }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: `${a.c}10`, border: `1.5px solid ${a.c}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: a.c }}>{a.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4, flexWrap: 'wrap' as const }}>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13.5, fontWeight: 700, color: '#0d0b14' }}>{a.name}</span>
                      <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: 17, color: a.pos ? '#0d9660' : '#ef4444', background: a.pos ? 'rgba(13,150,96,0.08)' : 'rgba(239,68,68,0.08)', padding: '2px 9px', borderRadius: 7, flexShrink: 0 }}>{a.delta}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(13,11,20,0.55)', lineHeight: 1.65 }}>{a.why}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════ ON-CHAIN SVG MEDALS ══════════ */}
      <Section id="medals" style={{ padding: '56px 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div id="med-hdr" data-reveal style={rv('med-hdr')}>
            <h2 className="section-h" style={{ marginBottom: 24 }}>Art that lives on the blockchain.</h2>
          </div>
          <div id="med-body" data-reveal style={{ ...rv('med-body', 100) }}>
            <p className="body-text" style={{ marginBottom: 20 }}>
              Every tier has a distinct medal design, generated entirely in Solidity as raw SVG markup. There is no external storage, no IPFS gateway, no image host. The SVG is constructed character by character inside the contract and returned as a Base64-encoded data URI directly from the tokenURI function.
            </p>
            <p className="body-text" style={{ marginBottom: 20 }}>
              The Unranked medal is a grey hexagon bearing a question mark — deliberately austere. The Bronze medal is a copper circle with a six-point star. Silver brings a five-point star and a cooler metallic palette. Gold introduces a crown with five coloured gemstones. Platinum is the most elaborate — a layered diamond facet with sparkle accents and multiple concentric rings.
            </p>
            <div className="pull-quote" style={{ borderColor: '#c9933a30', background: 'rgba(201,147,58,0.04)' }}>
              <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(14px,2vw,19px)', fontWeight: 700, color: '#7a5500', lineHeight: 1.55, fontStyle: 'italic' }}>
                "The most elegant detail: the medal is dynamic. The contract reads your current score from the engine every time tokenURI is called and renders the appropriate tier's artwork. As you climb from Bronze to Gold, your medal upgrades on every refresh — with no re-mint, no transaction, no gas."
              </p>
            </div>
            <p className="body-text">
              This design means the Soulbound Token is genuinely living artwork. It is a visual representation of your on-chain reputation that updates in real time. Any wallet, marketplace, or dashboard that supports ERC-721 tokenURI rendering will display your current tier automatically.
            </p>
          </div>
        </div>
      </Section>

      {/* ══════════ DESIGN PHILOSOPHY ══════════ */}
      <Section id="philosophy" style={{ padding: '56px 16px', background: 'rgba(255,255,255,0.45)', borderTop: '1px solid rgba(13,11,20,0.07)', borderBottom: '1px solid rgba(13,11,20,0.07)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div id="phi-hdr" data-reveal style={{ marginBottom: 40, ...rv('phi-hdr') }}>
            <h2 className="section-h">Why it was built this way.</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PRINCIPLES.map((p, i) => (
              <div key={p.num} id={`phi${i}`} data-reveal className="principle-card" style={{ padding: '22px 20px', borderRadius: 16, background: 'rgba(255,255,255,0.88)', border: `1px solid ${p.c}15`, ...rv(`phi${i}`, i * 70) }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: 22, color: `${p.c}55`, lineHeight: 1, flexShrink: 0, paddingTop: 2 }}>{p.num}</div>
                  <div>
                    <h3 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, fontSize: 'clamp(14px,2vw,19px)', color: p.c, letterSpacing: '-0.02em', marginBottom: 10, lineHeight: 1.2 }}>{p.title}</h3>
                    <p style={{ fontSize: 'clamp(13px,1.4vw,14.5px)', fontWeight: 400, color: 'rgba(13,11,20,0.66)', lineHeight: 1.78 }}>{p.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════ SECURITY ══════════ */}
      <Section id="security" style={{ padding: '56px 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div id="sec-hdr" data-reveal style={rv('sec-hdr')}>
            <h2 className="section-h" style={{ marginBottom: 24 }}>Designed to be attacked. Built to hold.</h2>
          </div>
          <div id="sec-body" data-reveal style={{ ...rv('sec-body', 90) }}>
            <p className="body-text" style={{ marginBottom: 20 }}>
              Every state-changing function in the system follows the Checks-Effects-Interactions pattern without exception. This means all validation happens first, all storage writes happen second, and any external calls happen last.
            </p>
            <p className="body-text" style={{ marginBottom: 20 }}>
              Reentrancy guards are applied to every state-changing function in both the Engine and the Vault. The Vault is not upgradeable and has no delegate calls, eliminating a large class of proxy-related vulnerabilities. The Engine's UUPS upgrade mechanism is gated behind the owner address.
            </p>
            <p className="body-text" style={{ marginBottom: 32 }}>
              Score arithmetic is handled by a pure library with no state and no external calls. The Action enum gates all score mutations — it is impossible for any caller to supply an arbitrary integer delta. Score bounds are enforced at both the entry and exit of every calculation.
            </p>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, fontSize: 'clamp(15px,2vw,21px)', color: '#0d0b14', marginBottom: 16 }}>Security invariants at a glance</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { inv: 'One SBT per wallet, ever', how: 'Enforced by a wallet-to-tokenId mapping. Any attempt to issue a second token to the same address reverts.' },
                { inv: 'Transfer always reverts', how: 'The _update() hook — the lowest-level transfer primitive in OpenZeppelin ERC-721 v5 — is overridden to block any from-non-zero to-non-zero transition.' },
                { inv: 'Engine address is write-once', how: 'setEngine() can only be called once. A second call reverts with EngineAlreadySet. Once set, the engine address is permanent.' },
                { inv: 'Score always in [0, 1000]', how: 'The ReputationMath library clamps every result before returning it. No arithmetic operation can produce an out-of-bounds score.' },
                { inv: 'All mutations follow CEI', how: 'Checks, Effects, Interactions — in that order, without exception, across all contracts.' },
                { inv: 'SBT auto-issued last in CEI', how: 'The token.issue() call happens after all storage writes in recordAction(), so any theoretical reentrancy into the engine sees a fully committed post-action state.' },
              ].map((item, i) => (
                <div key={i} className="security-item" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(13,11,20,0.07)' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0, marginTop: 6 }} />
                  <div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: '#0d0b14', marginBottom: 4 }}>{item.inv}</div>
                    <div style={{ fontSize: 12, color: 'rgba(13,11,20,0.54)', lineHeight: 1.65 }}>{item.how}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 22, padding: '14px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.16)' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'rgba(239,68,68,0.7)', letterSpacing: '0.12em', marginBottom: 8 }}>⚠ DISCLAIMER</div>
              <p style={{ fontSize: 12.5, color: 'rgba(13,11,20,0.56)', lineHeight: 1.7 }}>
                These contracts implement production-grade security patterns and have been thoroughly self-audited by the author. They have not undergone a formal external security audit. Do not deploy to mainnet with real funds without engaging a professional smart contract auditing firm.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ══════════ DEPLOYED CONTRACTS ══════════ */}
      <Section id="deployed" style={{ padding: '56px 16px', background: 'rgba(255,255,255,0.45)', borderTop: '1px solid rgba(13,11,20,0.07)', borderBottom: '1px solid rgba(13,11,20,0.07)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div id="dep-hdr" data-reveal style={{ marginBottom: 36, ...rv('dep-hdr') }}>
            <h2 className="section-h">Live on Ethereum Sepolia Testnet.</h2>
            <p style={{ fontSize: 'clamp(13px,1.5vw,15px)', color: 'rgba(13,11,20,0.55)', marginTop: 12, lineHeight: 1.72 }}>All contracts are verified and publicly readable on Etherscan. Interact with the proxy address for the Engine — never the implementation directly.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { ...CONTRACTS[0] },
              {
                num: '02a', name: 'ReputationEngine (Proxy)', tag: 'Use this address', c: '#3b82f6', icon: '⚙️',
                addr: '0x4eFC1adc...FaBD8', fullAddr: '0x4eFC1adc7Dd594C4bB04865B6dCc5101392FaBD8',
                etherscan: 'https://sepolia.etherscan.io/address/0x4eFC1adc7Dd594C4bB04865B6dCc5101392FaBD8',
              },
              {
                num: '02b', name: 'ReputationEngine (Implementation)', tag: 'Do not call directly', c: '#93c5fd', icon: '📄',
                addr: '0xC8153261...df5957', fullAddr: '0xC81532619d5fB4728932A43A77Bfea04c3df5957',
                etherscan: 'https://sepolia.etherscan.io/address/0xC81532619d5fB4728932A43A77Bfea04c3df5957',
              },
              { ...CONTRACTS[2] },
            ].map((c, i) => (
              <div key={c.name} id={`dep${i}`} data-reveal style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.9)', border: `1px solid ${c.c}18`, flexWrap: 'wrap' as const, ...rv(`dep${i}`, i * 70) }}>
                <div style={{ fontSize: 18, flexShrink: 0, paddingTop: 2 }}>{c.icon}</div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13.5, color: '#0d0b14', marginBottom: 4 }}>{c.name}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, color: 'rgba(13,11,20,0.45)', letterSpacing: '0.02em', wordBreak: 'break-all' }}>{c.fullAddr}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 600, color: c.c, padding: '3px 8px', borderRadius: 6, background: `${c.c}10`, border: `1px solid ${c.c}22`, letterSpacing: '0.08em' }}>{c.tag}</span>
                  <a href={c.etherscan} target="_blank" rel="noopener noreferrer" className="contract-chip"
                    style={{ background: `${c.c}0e`, border: `1px solid ${c.c}25`, color: c.c, fontSize: 10 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${c.c}1e`}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `${c.c}0e`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    Etherscan ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════ CTA ══════════ */}
      <section style={{ position: 'relative', zIndex: 1, padding: '72px 16px', textAlign: 'center', overflow: 'hidden', background: 'linear-gradient(150deg, rgba(253,220,245,0.45) 0%, rgba(235,228,252,0.45) 50%, rgba(254,240,195,0.36) 100%)', borderTop: '1px solid rgba(124,92,191,0.1)' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 400, height: 400, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,92,191,0.05) 0%, rgba(194,53,122,0.025) 45%, transparent 70%)', pointerEvents: 'none' }} />
        <div id="cta-close" data-reveal style={{ position: 'relative', zIndex: 1, maxWidth: 520, margin: '0 auto', ...rv('cta-close') }}>
          <div style={{ fontSize: 40, marginBottom: 18, display: 'inline-block', animation: 'floatGem 6s ease-in-out infinite' }}>◆</div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: 'clamp(24px,4.5vw,48px)', letterSpacing: '-0.03em', color: '#0d0b14', marginBottom: 14, lineHeight: 1.05 }}>
            Ready to build your<br />
            <span style={{ background: 'linear-gradient(130deg, #7c3aed, #c2357a, #c9933a)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'shimmerTitle 3s linear infinite' }}>on-chain identity?</span>
          </h2>
          <p style={{ fontSize: 'clamp(13px,1.5vw,15px)', fontWeight: 400, color: 'rgba(13,11,20,0.6)', marginBottom: 28, lineHeight: 1.75 }}>
            Connect your wallet, take your first action, and receive your Soulbound Token — automatically issued, permanently yours.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/" style={{ padding: '12px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #7c3aed, #c2357a)', color: '#fff', fontSize: 13, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, textDecoration: 'none', letterSpacing: '0.03em', boxShadow: '0 8px 28px rgba(124,58,237,0.3)', animation: 'pulseGlow 3s ease-in-out infinite', transition: 'transform 0.22s ease' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
            >Launch App →</a>
            <a href="https://github.com/NexTechArchitect/RST-Reputation-Protocol" target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '12px 20px', borderRadius: 12, background: 'rgba(13,11,20,0.06)', border: '1px solid rgba(13,11,20,0.12)', color: 'rgba(13,11,20,0.62)', fontSize: 13, fontFamily: "'DM Sans',sans-serif", fontWeight: 500, textDecoration: 'none', transition: 'all 0.22s ease' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(124,92,191,0.1)'; el.style.color = '#7c5cbf'; el.style.borderColor = 'rgba(124,92,191,0.28)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(13,11,20,0.06)'; el.style.color = 'rgba(13,11,20,0.62)'; el.style.borderColor = 'rgba(13,11,20,0.12)'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.835-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              Source Code
            </a>
          </div>
          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'rgba(13,11,20,0.28)', marginTop: 18, letterSpacing: '0.12em' }}>
            SEPOLIA TESTNET · ERC-5484 SOULBOUND · BUILT BY NEXTECH ARCHITECT
          </p>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{ position: 'relative', zIndex: 1, padding: '16px 20px', borderTop: '1px solid rgba(13,11,20,0.08)', background: 'rgba(253,251,255,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: 'linear-gradient(135deg, #7c3aed, #c2357a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>◆</div>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'rgba(13,11,20,0.5)' }}>RST Protocol Documentation</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <a href="/" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'rgba(13,11,20,0.4)', textDecoration: 'none', letterSpacing: '0.08em', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#7c5cbf'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(13,11,20,0.4)'}>← Back to App</a>
          <a href="https://github.com/NexTechArchitect/RST-Reputation-Protocol" target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'rgba(13,11,20,0.4)', textDecoration: 'none', letterSpacing: '0.08em', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: 5 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#7c5cbf'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(13,11,20,0.4)'}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            NexTechArchitect
          </a>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'rgba(13,11,20,0.32)' }}>2025</span>
        </div>
      </footer>
    </>
  );
}
