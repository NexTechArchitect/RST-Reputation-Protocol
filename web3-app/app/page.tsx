'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useEffect, useRef, useState, useCallback } from 'react';

// ── DATA ─────────────────────────────────────────────────────────────────────
const TIERS = [
  { name: 'Unranked', range: '0 – 99',     c: '#94a3b8', g: 'rgba(148,163,184,0.15)', icon: '◈', voting: '0.5×', loan: '0%',  desc: 'Begin your journey',      pct: 10  },
  { name: 'Bronze',   range: '100 – 299',  c: '#c2773a', g: 'rgba(194,119,58,0.15)',  icon: '★', voting: '1×',   loan: '20%', desc: 'Emerging reputation',      pct: 30  },
  { name: 'Silver',   range: '300 – 599',  c: '#8b9eb7', g: 'rgba(139,158,183,0.15)', icon: '✦', voting: '1.5×', loan: '40%', desc: 'Trusted participant',       pct: 60  },
  { name: 'Gold',     range: '600 – 849',  c: '#c9933a', g: 'rgba(201,147,58,0.15)',  icon: '♛', voting: '2×',   loan: '60%', desc: 'Protocol veteran',         pct: 85  },
  { name: 'Platinum', range: '850 – 1000', c: '#7c5cbf', g: 'rgba(124,92,191,0.15)', icon: '◆', voting: '3×',   loan: '80%', desc: 'Elite on-chain identity',  pct: 100 },
];

const ACTIONS = [
  { name: 'DAO Vote',         delta: '+10', pos: true,  c: '#3b6cf6', icon: '⬡', fn: 'castVote()',       cd: '12h cooldown' },
  { name: 'DAO Proposal',     delta: '+25', pos: true,  c: '#0d9660', icon: '◈', fn: 'submitProposal()', cd: '24h cooldown' },
  { name: 'Loan Repaid',      delta: '+30', pos: true,  c: '#7c5cbf', icon: '◉', fn: 'repayLoan()',      cd: 'natural gate'  },
  { name: 'Airdrop Held 30d', delta: '+15', pos: true,  c: '#c2357a', icon: '◆', fn: 'settleAirdrop()',  cd: 'natural gate'  },
  { name: 'NFT Minted',       delta: '+5',  pos: true,  c: '#c9933a', icon: '✦', fn: 'mintNFT()',        cd: '12h cooldown'  },
  { name: 'Loan Default',     delta: '−50', pos: false, c: '#ef4444', icon: '◌', fn: 'markDefault()',    cd: 'owner only'    },
  { name: 'Airdrop Dumped',   delta: '−20', pos: false, c: '#f97316', icon: '◇', fn: 'settleAirdrop()',  cd: 'natural gate'  },
];

const CONTRACTS = [
  {
    name: 'ReputationToken', tag: 'ERC-5484 · Soulbound', c: '#e11d7a',
    addr: '0x9c77Ce31a110e360d62e4eF8B1F4cf8576F70F46', short: '0x9c77Ce31...F70F46',
    feats: ['One SBT per wallet, ever', 'Transfer-locked via _update()', 'On-chain SVG medal art'],
    icon: '🛡️', num: '01',
    etherscan: 'https://sepolia.etherscan.io/address/0x9c77Ce31a110e360d62e4eF8B1F4cf8576F70F46',
  },
  {
    name: 'ReputationEngine', tag: 'UUPS · Upgradeable', c: '#3b82f6',
    addr: '0x4eFC1adc7Dd594C4bB04865B6dCc5101392FaBD8', short: '0x4eFC1adc...FaBD8',
    feats: ['CEI strict + nonReentrant', 'Score clamped [0, 1000]', 'UUPS proxy pattern'],
    icon: '⚙️', num: '02',
    etherscan: 'https://sepolia.etherscan.io/address/0x4eFC1adc7Dd594C4bB04865B6dCc5101392FaBD8',
  },
  {
    name: 'ReputationVault', tag: 'Action Gateway', c: '#10b981',
    addr: '0xd53320CDEF6f3DfA54436D2806e765d6d6bD98b6', short: '0xd53320CD...D98b6',
    feats: ['12h vote / NFT cooldown', '30-day airdrop hold gate', 'Owner-only default marking'],
    icon: '🔒', num: '03',
    etherscan: 'https://sepolia.etherscan.io/address/0xd53320CDEF6f3DfA54436D2806e765d6d6bD98b6',
  },
];

// ── RIBBON ────────────────────────────────────────────────────────────────────
function RibbonLayer() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      <defs>
        <linearGradient id="rib1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fce7f3" stopOpacity="0.85"/>
          <stop offset="45%" stopColor="#e9d5ff" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.25"/>
        </linearGradient>
        <linearGradient id="rib2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.75"/>
          <stop offset="50%" stopColor="#fbcfe8" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#ede9fe" stopOpacity="0.2"/>
        </linearGradient>
        <linearGradient id="rib3" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#d1fae5" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#fce7f3" stopOpacity="0.3"/>
        </linearGradient>
      </defs>
      <path d="M-100,380 C220,295 490,510 760,395 C1030,280 1230,450 1540,360"
        fill="none" stroke="url(#rib1)" strokeWidth="90" strokeLinecap="round" opacity="0.55">
        <animateTransform attributeName="transform" type="translate" values="0,0; 45,35; -30,12; 0,0" dur="5s" repeatCount="indefinite"/>
      </path>
      <path d="M-100,555 C310,465 590,660 890,545 C1190,430 1360,590 1540,500"
        fill="none" stroke="url(#rib2)" strokeWidth="55" strokeLinecap="round" opacity="0.42">
        <animateTransform attributeName="transform" type="translate" values="0,0; -55,20; 28,-12; 0,0" dur="6s" repeatCount="indefinite"/>
      </path>
      <path d="M-100,680 C260,615 580,740 870,650 C1160,560 1310,700 1540,625"
        fill="none" stroke="url(#rib3)" strokeWidth="32" strokeLinecap="round" opacity="0.35">
        <animateTransform attributeName="transform" type="translate" values="0,0; 28,-22; -18,14; 0,0" dur="4s" repeatCount="indefinite"/>
      </path>
    </svg>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [hoveredTier, setHoveredTier] = useState<number | null>(null);
  const [hoveredAction, setHoveredAction] = useState<number | null>(null);
  const [hoveredContract, setHoveredContract] = useState<number | null>(null);
  const [activeTier, setActiveTier] = useState(0);
  const [tierMorphing, setTierMorphing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Track if device is low-power (mobile) to disable canvas
  const [isLowPower, setIsLowPower] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    // Detect mobile/low-power: skip particle canvas on small screens or touch devices
    const isMobile = window.innerWidth <= 1024 || ('ontouchstart' in window);
    setIsLowPower(isMobile);
  }, []);

  // ── AUTO-CYCLE: 4000ms, smooth 350ms morph ──
  useEffect(() => {
    const MORPH_MS = 350;
    const startCycle = () => {
      autoIntervalRef.current = setInterval(() => {
        setTierMorphing(true);
        setTimeout(() => {
          setActiveTier(prev => (prev + 1) % TIERS.length);
          setTierMorphing(false);
        }, MORPH_MS);
      }, 4000);
    };
    startCycle();
    return () => {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 55);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // ── PARTICLE CANVAS — only on desktop ──────────────────────────────────────
  useEffect(() => {
    if (isLowPower) return; // skip canvas entirely on mobile
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const pts = Array.from({ length: 65 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 1.0, vy: (Math.random() - 0.5) * 1.0,
      r: Math.random() * 1.6 + 0.4, a: Math.random() * 0.22 + 0.06,
      h: Math.random() > 0.5 ? 310 : 270,
      trail: [] as { x: number; y: number }[],
    }));

    const comets = Array.from({ length: 2 }, (_, i) => ({
      x: -120, y: Math.random() * window.innerHeight * 0.7,
      vx: 11 + Math.random() * 6, vy: (Math.random() - 0.5) * 1.8,
      len: 75 + Math.random() * 55, h: i % 2 === 0 ? 310 : 280,
      active: false, timer: Math.floor(Math.random() * 300),
    }));

    let raf: number;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 7) p.trail.shift();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        p.trail.forEach((pos, ti) => {
          const ratio = ti / p.trail.length;
          ctx.beginPath(); ctx.arc(pos.x, pos.y, p.r * ratio * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.h},60%,70%,${p.a * ratio * 0.3})`; ctx.fill();
        });
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.h},60%,70%,${p.a})`; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 88) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.strokeStyle = `hsla(290,50%,68%,${0.055 * (1 - d / 88)})`; ctx.lineWidth = 0.5; ctx.stroke(); }
      }
      comets.forEach(c => {
        c.timer--;
        if (c.timer <= 0) { c.active = true; c.x = -120; c.y = Math.random() * canvas.height * 0.75; c.vx = 12 + Math.random() * 7; c.vy = (Math.random() - 0.5) * 2; c.timer = 320 + Math.floor(Math.random() * 360); }
        if (!c.active) return;
        c.x += c.vx; c.y += c.vy;
        if (c.x > canvas.width + 200) { c.active = false; return; }
        const grad = ctx.createLinearGradient(c.x - c.len, c.y, c.x, c.y);
        grad.addColorStop(0, `hsla(${c.h},70%,75%,0)`); grad.addColorStop(1, `hsla(${c.h},70%,80%,0.48)`);
        ctx.beginPath(); ctx.moveTo(c.x - c.len, c.y); ctx.lineTo(c.x, c.y); ctx.strokeStyle = grad; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.beginPath(); ctx.arc(c.x, c.y, 2, 0, Math.PI * 2); ctx.fillStyle = `hsla(${c.h},80%,90%,0.82)`; ctx.fill();
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [isLowPower]);

  // ── SCROLL REVEAL ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setVisible(p => new Set([...p, e.target.id])); });
    }, { threshold: 0.05 });
    document.querySelectorAll('[data-reveal]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [mounted]);

  const rv = useCallback((id: string, delay = 0): React.CSSProperties => ({
    opacity: visible.has(id) ? 1 : 0,
    transform: visible.has(id) ? 'translateY(0) scale(1)' : 'translateY(22px) scale(0.98)',
    transition: `opacity 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
  }), [visible]);

  // ── handleTierClick ──
  const handleTierClick = useCallback((i: number) => {
    const MORPH_MS = 350;
    setTierMorphing(true);
    setTimeout(() => {
      setActiveTier(i);
      setTierMorphing(false);
    }, MORPH_MS);
    if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => {
      autoIntervalRef.current = setInterval(() => {
        setTierMorphing(true);
        setTimeout(() => {
          setActiveTier(prev => (prev + 1) % TIERS.length);
          setTierMorphing(false);
        }, MORPH_MS);
      }, 4000);
    }, 8000);
  }, []);

  const navLinks = ['Tiers', 'Actions', 'Architecture'];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=JetBrains+Mono:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #fdfbff; color: #0d0b14; font-family: 'DM Sans', sans-serif; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
        ::selection { background: rgba(219,39,119,0.15); }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: #fdfbff; }
        ::-webkit-scrollbar-thumb { background: rgba(124,92,191,0.4); border-radius: 2px; }

        /* ══ KEYFRAMES — no will-change to avoid mobile GPU flicker ══ */
        @keyframes orbF0 { 0%,100%{transform:translate(0,0) rotate(0deg)} 33%{transform:translate(20px,-28px) rotate(5deg)} 66%{transform:translate(-12px,16px) rotate(-3deg)} }
        @keyframes orbF1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,32px)} }
        @keyframes orbF2 { 0%,100%{transform:translate(0,0)} 40%{transform:translate(16px,-20px)} 75%{transform:translate(-10px,13px)} }
        @keyframes orbF3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(11px,-22px) scale(1.03)} }

        @keyframes heroFadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmerTitle { 0%{background-position:-220% center} 100%{background-position:220% center} }
        @keyframes pulseGlow {
          0%,100%{box-shadow:0 8px 28px rgba(124,92,191,0.3),0 2px 8px rgba(194,53,122,0.15)}
          50%{box-shadow:0 14px 44px rgba(124,92,191,0.5),0 4px 18px rgba(194,53,122,0.3)}
        }
        @keyframes liveDot { 0%,100%{transform:scale(1);opacity:0.9} 50%{transform:scale(1.7);opacity:0.4} }
        @keyframes scrollHint { 0%,100%{transform:translateY(0);opacity:0.4} 50%{transform:translateY(10px);opacity:0.85} }
        @keyframes tierFloat { 0%,100%{transform:translateY(0px)} 33%{transform:translateY(-6px) rotate(2deg)} 66%{transform:translateY(-2px) rotate(-1.5deg)} }
        @keyframes contractGlow { 0%,100%{opacity:0.7} 50%{opacity:1} }
        @keyframes badgeShimmer { 0%,100%{background:rgba(255,255,255,0.82)} 50%{background:rgba(245,230,255,0.95)} }
        @keyframes rgbShift {
          0%{text-shadow: 2px 0 0 rgba(255,0,100,0.35), -2px 0 0 rgba(0,150,255,0.35);}
          25%{text-shadow: -2px 0 0 rgba(255,0,100,0.35), 2px 0 0 rgba(0,220,150,0.35);}
          50%{text-shadow: 2px 0 0 rgba(100,0,255,0.35), -2px 0 0 rgba(255,150,0,0.35);}
          75%{text-shadow: -2px 0 0 rgba(0,255,150,0.35), 2px 0 0 rgba(255,0,100,0.35);}
          100%{text-shadow: 2px 0 0 rgba(255,0,100,0.35), -2px 0 0 rgba(0,150,255,0.35);}
        }
        @keyframes rgbBorder {
          0%{border-color: rgba(255,0,100,0.35);}
          33%{border-color: rgba(100,0,255,0.35);}
          66%{border-color: rgba(0,200,150,0.35);}
          100%{border-color: rgba(255,0,100,0.35);}
        }
        @keyframes scanGlow {
          0%{opacity:0;transform:translateY(-100%);} 10%{opacity:1;} 90%{opacity:1;} 100%{opacity:0;transform:translateY(100%);}
        }
        @keyframes auroraShift {
          0%{background-position: 0% 50%;} 50%{background-position: 100% 50%;} 100%{background-position: 0% 50%;}
        }
        @keyframes actionCardIn {
          from { opacity:0; transform: translateY(24px) scale(0.96); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }
        @keyframes penaltyCardIn {
          from { opacity:0; transform: translateX(24px) scale(0.96); }
          to   { opacity:1; transform: translateX(0) scale(1); }
        }
        @keyframes deltaFloat { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-4px)} }
        @keyframes halorRing { 0%{transform:scale(0.85);opacity:0.9} 100%{transform:scale(1.7);opacity:0} }
        @keyframes shimmerSweep { 0%{transform:translateX(-100%) skewX(-15deg)} 100%{transform:translateX(300%) skewX(-15deg)} }
        @keyframes dotBounce { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-5px)} }
        @keyframes penaltyShake { 0%,100%{transform:rotate(0deg) scale(1)} 20%{transform:rotate(-3deg) scale(1.04)} 40%{transform:rotate(3deg) scale(1.02)} 60%{transform:rotate(-2deg)} }
        @keyframes warningPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.3)} 50%{box-shadow:0 0 0 8px rgba(239,68,68,0)} }
        @keyframes greenGlow { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.25)} 50%{box-shadow:0 0 0 8px rgba(16,185,129,0)} }
        @keyframes crystalFloat { 0%,100%{transform:translateY(0) rotate(0deg)} 33%{transform:translateY(-8px) rotate(3deg)} 66%{transform:translateY(-3px) rotate(-2deg)} }
        @keyframes floatOrb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(28px,-20px) scale(1.05)} }
        @keyframes floatOrb2 { 0%,100%{transform:translate(0,0) scale(1)} 60%{transform:translate(-16px,24px) scale(0.96)} }
        @keyframes floatOrb3 { 0%,100%{transform:translate(0,0)} 40%{transform:translate(20px,12px)} 75%{transform:translate(-10px,-7px)} }

        /* ══ TIER MORPH — no will-change (causes repaint flash on mobile) ══ */
        @keyframes tierFadeOut {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-10px) scale(0.98); }
        }
        @keyframes tierFadeIn {
          0%   { opacity: 0; transform: translateY(14px) scale(0.98); }
          60%  { opacity: 0.9; transform: translateY(-2px) scale(1.004); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .tier-morphing-out {
          animation: tierFadeOut 0.32s cubic-bezier(0.4,0,1,1) forwards !important;
        }
        .tier-morphing-in {
          animation: tierFadeIn 0.42s cubic-bezier(0.16,1,0.3,1) forwards !important;
        }

        /* ══ HEADING SHIMMER ══ */
        .heading-shimmer {
          font-family: 'Playfair Display', serif;
          font-weight: 900;
          font-size: clamp(32px, 5vw, 62px);
          letter-spacing: -0.03em;
          line-height: 1.04;
          background: linear-gradient(130deg, #0d0b14 0%, #3b0764 20%, #7c3aed 42%, #c2357a 64%, #c9933a 82%, #0d0b14 100%);
          background-size: 280% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerTitle 5s linear infinite;
        }

        /* action card shimmer */
        .action-card-cine { position: relative; overflow: hidden; }
        .action-card-cine::before {
          content: ''; position: absolute; top: 0; left: 0; width: 35%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
          transform: translateX(-120%) skewX(-15deg); z-index: 10;
        }
        .action-card-cine:hover::before { animation: shimmerSweep 0.65s ease forwards; }
        .penalty-card-cine { position: relative; overflow: hidden; }
        .penalty-card-cine::before {
          content: ''; position: absolute; top: 0; left: 0; width: 35%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          transform: translateX(-120%) skewX(-15deg); z-index: 10;
        }
        .penalty-card-cine:hover::before { animation: shimmerSweep 0.65s ease forwards; }

        /* ── NAV ── */
        .nav-root {
          position: fixed; top:0; left:0; right:0; z-index:900;
          padding: 14px 48px;
          display: flex; align-items: center; justify-content: space-between;
          transition: background 0.4s ease, border-color 0.4s ease, padding 0.4s ease;
        }
        .nav-root.scrolled {
          background: rgba(253,251,255,0.92);
          backdrop-filter: blur(24px) saturate(1.6);
          -webkit-backdrop-filter: blur(24px) saturate(1.6);
          border-bottom: 1px solid rgba(124,92,191,0.1);
          padding-top: 10px; padding-bottom: 10px;
        }

        .hero-title {
          font-family: 'Playfair Display', serif; font-weight: 900;
          font-size: clamp(38px, 7vw, 92px); line-height: 1.0; letter-spacing: -0.03em;
          background: linear-gradient(130deg, #0d0b14 0%, #3b0764 22%, #7c3aed 46%, #c2357a 68%, #c9933a 88%);
          background-size: 260% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; animation: shimmerTitle 4.5s linear infinite;
        }
        /* Disable rgbShift on mobile — causes flicker */
        @media (min-width: 1025px) {
          .hero-title { animation: shimmerTitle 4.5s linear infinite, rgbShift 6s linear infinite; }
        }

        .tier-pill { cursor: pointer; transition: all 0.32s cubic-bezier(0.16,1,0.3,1); }
        .contract-card { transition: all 0.3s cubic-bezier(0.16,1,0.3,1); }
        .contract-card:hover { transform: translateY(-8px) scale(1.01) !important; }

        .cinematic-line {
          position: absolute; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(124,92,191,0.5) 30%, rgba(194,53,122,0.6) 50%, rgba(124,92,191,0.5) 70%, transparent 100%);
          animation: scanGlow 8s ease-in-out infinite;
        }

        /* ══ ORBS — use display:none below 1025px to prevent layout paint & flicker ══ */
        .orb-desktop-only {
          display: none !important;
        }
        @media (min-width: 1025px) {
          .orb-desktop-only {
            display: block !important;
          }
        }

        /* ══ NAV RESPONSIVE ══ */
        @media (max-width: 900px) {
          .nav-links-desk  { display: none !important; }
          .nav-root        { padding: 12px 18px !important; }
          .ham-btn         { display: flex !important; }
        }

        /* ══ LAYOUT RESPONSIVE — breakpoints at both px values so desktop-mode on phones also works ══ */
        @media (max-width: 1024px) {
          .contracts-grid { grid-template-columns: 1fr 1fr !important; }
          .tier-sidebar-arc { display: none !important; }
          .actions-two-col { grid-template-columns: 1fr !important; gap: 0 !important; }
          .actions-divider-v { display: none !important; }
          .actions-score-viz { display: none !important; }
          .hero-btns { flex-direction: column; align-items: center !important; }
          .footer-addrs { display: none !important; }
          .tier-showcase-inner { flex-direction: column !important; gap: 20px !important; }
          .actions-light-hero { flex-direction: column !important; padding: 28px 20px !important; }
          .gains-grid { grid-template-columns: 1fr !important; }
          .stats-row { flex-wrap: wrap; gap: 18px !important; }
        }

        @media (max-width: 768px) {
          .contracts-grid { grid-template-columns: 1fr !important; }
          .hero-section { padding: 90px 20px 44px !important; min-height: auto !important; }
          .tiers-section { padding: 52px 20px 56px !important; }
          .actions-section-inner { padding: 56px 20px !important; }
          .arch-section { padding: 56px 20px !important; }
          .cta-section { padding: 64px 20px !important; }
          .tier-showcase-card { padding: 28px 20px !important; }
          .stats-row { gap: 14px !important; padding-top: 22px !important; margin-top: 36px !important; }
        }

        @media (max-width: 480px) {
          .hero-section { padding: 82px 16px 36px !important; }
          .tiers-section { padding: 44px 16px 48px !important; }
          .actions-section-inner { padding: 44px 16px !important; }
          .arch-section { padding: 44px 16px !important; }
          .cta-section { padding: 52px 16px !important; }
          .heading-shimmer { font-size: clamp(26px, 7.5vw, 44px) !important; }
          .contract-card-inner { padding: 24px 18px !important; }
          .tier-stat-pills { flex-wrap: wrap; }
          .hero-title { font-size: clamp(34px, 9vw, 56px) !important; }
          .tier-showcase-card { padding: 22px 16px !important; gap: 20px !important; }
          .nav-root { padding: 10px 13px !important; }
        }

        /* Tier pills */
        .tier-pills-row { display: flex; gap: 7px; justify-content: center; flex-wrap: wrap; margin-bottom: 22px; }
        @media (max-width: 480px) {
          .tier-pills-row { gap: 6px; }
          .tier-pill { padding: 7px 14px !important; font-size: 12px !important; }
        }

        /* ══ REDUCE MOTION: disable heavy animations on mobile ══ */
        @media (max-width: 1024px) {
          .cinematic-line { display: none !important; }
          /* Slow down aurora to reduce repaint cost */
          @keyframes auroraShift {
            0%{background-position: 0% 50%;} 100%{background-position: 100% 50%;}
          }
        }
      `}</style>

      {/* PARTICLE CANVAS — only rendered on desktop (isLowPower check in useEffect) */}
      {!isLowPower && (
        <canvas
          ref={canvasRef}
          style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.7 }}
        />
      )}

      {/* BG */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 85% 60% at 12% 4%, rgba(253,220,245,0.55) 0%, transparent 55%),
          radial-gradient(ellipse 65% 50% at 88% 12%, rgba(218,210,252,0.48) 0%, transparent 52%),
          radial-gradient(ellipse 50% 42% at 58% 78%, rgba(254,240,195,0.35) 0%, transparent 50%),
          radial-gradient(ellipse 42% 38% at 8% 82%, rgba(205,248,225,0.28) 0%, transparent 48%),
          #fdfbff
        `,
      }} />

      {/* ══ ORBS — only on desktop via className ══ */}
      <div className="orb-desktop-only" style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[
          { size: 260, x: '66%', y: '-6%',  delay: 0, dur: 5, c1: 'rgba(251,200,228,0.88)', c2: 'rgba(192,175,251,0.72)', c3: 'rgba(143,45,230,0.3)',   anim: 'orbF0' },
          { size: 180, x: '-5%', y: '8%',   delay: 1, dur: 4, c1: 'rgba(252,218,248,0.88)', c2: 'rgba(249,200,228,0.68)', c3: 'rgba(192,175,251,0.38)', anim: 'orbF1' },
          { size: 135, x: '60%', y: '50%',  delay: 2, dur: 6, c1: 'rgba(254,246,190,0.88)', c2: 'rgba(252,218,172,0.68)', c3: 'rgba(242,152,5,0.25)',   anim: 'orbF2' },
          { size: 220, x: '6%',  y: '60%',  delay: 0, dur: 5, c1: 'rgba(220,240,252,0.88)', c2: 'rgba(188,216,252,0.68)', c3: 'rgba(95,98,238,0.25)',   anim: 'orbF1' },
          { size: 90,  x: '86%', y: '68%',  delay: 1, dur: 4, c1: 'rgba(252,222,222,0.88)', c2: 'rgba(250,160,160,0.68)', c3: 'rgba(215,32,32,0.2)',    anim: 'orbF3' },
          { size: 115, x: '40%', y: '86%',  delay: 2, dur: 6, c1: 'rgba(216,250,228,0.88)', c2: 'rgba(128,236,168,0.62)', c3: 'rgba(12,180,125,0.22)',  anim: 'orbF2' },
        ].map((o, i) => (
          <div key={i} style={{
            position: 'absolute', left: o.x, top: o.y, width: o.size, height: o.size, borderRadius: '50%',
            background: `radial-gradient(circle at 33% 28%, rgba(255,255,255,0.95) 0%, ${o.c1} 25%, ${o.c2} 55%, ${o.c3} 82%, transparent 100%)`,
            animation: `${o.anim} ${o.dur}s ease-in-out ${o.delay * 0.4}s infinite`,
            pointerEvents: 'none',
          }} />
        ))}
      </div>

      {/* ══════════ NAVBAR ══════════ */}
      <nav className={`nav-root${scrolled ? ' scrolled' : ''}`}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #7c3aed, #c2357a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, flexShrink: 0,
            boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
            border: '1.5px solid rgba(124,92,191,0.4)',
          }}>◆</div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 17, color: '#0d0b14', letterSpacing: '0.04em', lineHeight: 1 }}>
              RST<span style={{ color: '#c2357a' }}>.</span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: 'rgba(13,11,20,0.42)', letterSpacing: '0.22em', marginTop: 1 }}>PROTOCOL</div>
          </div>
        </a>

        <div className="nav-links-desk" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {navLinks.map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
              color: 'rgba(13,11,20,0.52)', textDecoration: 'none',
              letterSpacing: '0.13em', transition: 'color 0.2s, transform 0.2s',
              display: 'inline-block', textTransform: 'uppercase',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#7c5cbf'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(13,11,20,0.52)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
            >{l}</a>
          ))}
          <div style={{ width: 1, height: 13, background: 'rgba(13,11,20,0.14)' }} />
          <a href="/about" style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
            color: 'rgba(13,11,20,0.6)', textDecoration: 'none',
            letterSpacing: '0.13em', transition: 'color 0.2s, transform 0.2s',
            display: 'inline-flex', alignItems: 'center', gap: 5, textTransform: 'uppercase',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c2357a'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(13,11,20,0.6)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
          >
            <span style={{ fontSize: 11 }}>◈</span> Docs
          </a>
          <a href="https://github.com/NexTechArchitect/RST-Reputation-Protocol" target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 13px', borderRadius: 8,
              background: 'rgba(13,11,20,0.06)', border: '1px solid rgba(13,11,20,0.12)',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
              color: 'rgba(13,11,20,0.6)', textDecoration: 'none', letterSpacing: '0.08em',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(124,92,191,0.1)'; el.style.borderColor = 'rgba(124,92,191,0.3)'; el.style.color = '#7c5cbf'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(13,11,20,0.06)'; el.style.borderColor = 'rgba(13,11,20,0.12)'; el.style.color = 'rgba(13,11,20,0.6)'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ConnectButton showBalance={false} chainStatus="none" accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }} />
          <button onClick={() => setMenuOpen(!menuOpen)} className="ham-btn" aria-label="Toggle menu"
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexDirection: 'column', gap: 5 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 22, height: 1.5, background: '#0d0b14', borderRadius: 2,
                transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                transform: menuOpen ? (i===0?'rotate(45deg) translate(4.5px,4.5px)':i===1?'scaleX(0)':'rotate(-45deg) translate(4.5px,-4.5px)') : 'none',
                opacity: menuOpen && i===1 ? 0 : 1,
              }} />
            ))}
          </button>
        </div>
      </nav>

      {/* MOBILE OVERLAY */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 890, background: '#fdfbff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36,
        opacity: menuOpen ? 1 : 0, pointerEvents: menuOpen ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
      }}>
        {[...navLinks, 'Docs'].map((item, i) => (
          <a key={item}
            href={item === 'Docs' ? '/about' : `#${item.toLowerCase()}`}
            onClick={() => setMenuOpen(false)}
            style={{
              fontFamily: "'Playfair Display', serif", fontSize: 42, fontWeight: 700,
              color: item === 'Docs' ? '#7c5cbf' : '#0d0b14', textDecoration: 'none', letterSpacing: '-0.02em',
              opacity: menuOpen ? 1 : 0, transform: menuOpen ? 'none' : 'translateY(16px)',
              transition: `all 0.44s cubic-bezier(0.16,1,0.3,1) ${i * 50}ms`,
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#c2357a'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = item === 'Docs' ? '#7c5cbf' : '#0d0b14'}
          >{item}</a>
        ))}
        <div style={{ opacity: menuOpen ? 1 : 0, transform: menuOpen ? 'none' : 'translateY(16px)', transition: `all 0.44s cubic-bezier(0.16,1,0.3,1) ${5 * 50}ms` }}>
          <ConnectButton label="Connect Wallet" />
        </div>
      </div>

      {/* ══════════ HERO ══════════ */}
      <section className="hero-section" style={{
        position: 'relative', zIndex: 1,
       
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '110px 32px 80px', textAlign: 'center', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}><RibbonLayer /></div>
        <div className="cinematic-line" style={{ top: '30%', zIndex: 2 }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 860, width: '100%' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 18px', borderRadius: 100,
            background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(194,53,122,0.22)',
            fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
            color: 'rgba(13,11,20,0.65)', letterSpacing: '0.13em', marginBottom: 28,
            animation: 'heroFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both, badgeShimmer 4s ease-in-out infinite',
            boxShadow: '0 2px 12px rgba(194,53,122,0.1)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'liveDot 2s ease-in-out infinite' }} />
            LIVE ON SEPOLIA TESTNET · ERC-5484 SOULBOUND
          </div>

          <h1 className="hero-title" style={{ marginBottom: 24, animation: 'heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}>
            On-Chain Reputation,<br />Crystallised Forever
          </h1>

          <p style={{
            fontSize: 16, fontWeight: 400, color: 'rgba(13,11,20,0.7)', lineHeight: 1.78,
            maxWidth: 480, margin: '0 auto 40px',
            animation: 'heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both',
          }}>
            Every vote, loan, and action forges your immutable Soulbound identity.
            Earn trust. Unlock credit. Govern with weight.
          </p>

          <div className="hero-btns" style={{
            display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap',
            animation: 'heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.3s both',
          }}>
            {mounted && !isConnected ? (
              <div style={{ animation: 'pulseGlow 3s ease-in-out infinite', borderRadius: 13 }}>
                <ConnectButton label="Connect & Begin →" />
              </div>
            ) : (
              <a href="/dashboard" style={{
                padding: '13px 30px', borderRadius: 13,
                background: 'linear-gradient(135deg, #7c3aed, #c2357a)',
                color: '#fff', fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600, textDecoration: 'none', letterSpacing: '0.03em',
                boxShadow: '0 8px 28px rgba(124,58,237,0.32)',
                animation: 'pulseGlow 3s ease-in-out infinite',
                transition: 'transform 0.22s ease',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px) scale(1.02)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
              >Open Dashboard →</a>
            )}
            <a href="/about" style={{
              padding: '13px 28px', borderRadius: 13,
              background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(13,11,20,0.13)',
              color: 'rgba(13,11,20,0.7)', fontSize: 14, fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500, textDecoration: 'none', transition: 'all 0.22s ease',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,92,191,0.38)'; (e.currentTarget as HTMLElement).style.color = '#7c5cbf'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(13,11,20,0.13)'; (e.currentTarget as HTMLElement).style.color = 'rgba(13,11,20,0.7)'; }}
            ><span style={{ fontSize: 13 }}>◈</span> Docs</a>
            <a href="https://github.com/NexTechArchitect/RST-Reputation-Protocol" target="_blank" rel="noopener noreferrer" style={{
              padding: '13px 20px', borderRadius: 13,
              background: 'rgba(13,11,20,0.06)', border: '1px solid rgba(13,11,20,0.12)',
              color: 'rgba(13,11,20,0.6)', fontSize: 14, fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500, textDecoration: 'none', transition: 'all 0.22s ease',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(124,92,191,0.1)'; el.style.borderColor = 'rgba(124,92,191,0.3)'; el.style.color = '#7c5cbf'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(13,11,20,0.06)'; el.style.borderColor = 'rgba(13,11,20,0.12)'; el.style.color = 'rgba(13,11,20,0.6)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              Source Code
            </a>
          </div>

          <div className="stats-row" style={{
            display: 'flex', gap: 40, justifyContent: 'center', marginTop: 52, paddingTop: 28,
            borderTop: '1px solid rgba(13,11,20,0.09)',
            animation: 'heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.42s both',
          }}>
            {[{ v: 'ERC-5484', l: 'Standard' }, { v: '5 Levels', l: 'Score Tiers' }, { v: 'On-Chain', l: 'SVG Medals' }, { v: 'Sepolia', l: 'Network' }].map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 19, color: '#0d0b14', letterSpacing: '-0.01em' }}>{s.v}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.48)', marginTop: 4, letterSpacing: '0.12em' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          position: 'absolute', bottom: 26, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
          animation: 'scrollHint 2.2s ease-in-out infinite',
        }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(13,11,20,0.35)', letterSpacing: '0.22em' }}>SCROLL</div>
          <div style={{ width: 1, height: 26, background: 'linear-gradient(to bottom, rgba(124,92,191,0.55), transparent)' }} />
        </div>
      </section>

      {/* ══════════ TIERS ══════════ */}
      <section id="tiers" className="tiers-section" style={{ position: 'relative', zIndex: 1, padding: '92px 32px', overflow: 'hidden' }}>
        <div id="tiers-hdr" data-reveal style={{ textAlign: 'center', marginBottom: 52, ...rv('tiers-hdr') }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, color: '#6d44b8', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 16 }}>
            ◆ &nbsp;REPUTATION LADDER&nbsp; ◆
          </div>
          <h2 className="heading-shimmer">Five crystals of trust</h2>
          <p style={{ fontSize: 15, fontWeight: 400, color: 'rgba(13,11,20,0.62)', marginTop: 14, maxWidth: 340, margin: '14px auto 0', lineHeight: 1.7 }}>
            Your score determines your tier. Your tier determines your protocol power.
          </p>
        </div>

        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <div id="tier-showcase" data-reveal style={{ ...rv('tier-showcase'), marginBottom: 20 }}>
            <div
              className={`tier-showcase-card ${tierMorphing ? 'tier-morphing-out' : 'tier-morphing-in'}`}
              style={{
                position: 'relative', borderRadius: 24, overflow: 'hidden',
                background: 'rgba(255,255,255,0.88)',
                border: `1.5px solid ${TIERS[activeTier].c}30`,
                boxShadow: `0 20px 55px ${TIERS[activeTier].g}, 0 4px 16px rgba(0,0,0,0.04)`,
                padding: '42px 46px',
                display: 'flex', alignItems: 'center', gap: 44,
                transition: `box-shadow 0.8s ease, border-color 0.8s ease`,
              }}
            >
              {/* Aurora top strip */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                backgroundImage: `linear-gradient(90deg, ${TIERS[activeTier].c}60, ${TIERS[activeTier].c}, ${TIERS[activeTier].c}60)`,
                borderRadius: '24px 24px 0 0',
                backgroundSize: '200% 100%',
                animation: 'auroraShift 3s ease infinite',
                transition: 'background-image 0.8s ease',
              }} />
              {/* Halo behind icon */}
              <div style={{ position: 'absolute', left: 44, width: 105, height: 105, borderRadius: 24, background: `${TIERS[activeTier].c}10`, animation: 'halorRing 3s ease-out infinite', pointerEvents: 'none' }} />

              <div style={{
                width: 105, height: 105, borderRadius: 24, flexShrink: 0,
                background: `radial-gradient(circle at 33% 28%, rgba(255,255,255,0.96) 0%, ${TIERS[activeTier].c}28 40%, ${TIERS[activeTier].c}65 100%)`,
                border: `2px solid ${TIERS[activeTier].c}28`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 46, boxShadow: `0 8px 28px ${TIERS[activeTier].g}`, animation: 'tierFloat 5s ease-in-out infinite',
                position: 'relative', zIndex: 1,
                transition: 'background 0.8s ease, box-shadow 0.8s ease',
              }}>{TIERS[activeTier].icon}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: 'rgba(13,11,20,0.42)', letterSpacing: '0.16em', marginBottom: 6 }}>TIER {activeTier + 1} OF 5</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 'clamp(24px,4.5vw,40px)', color: TIERS[activeTier].c, letterSpacing: '-0.025em', marginBottom: 4, lineHeight: 1, transition: 'color 0.8s ease' }}>{TIERS[activeTier].name}</h3>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'rgba(13,11,20,0.5)', marginBottom: 14, letterSpacing: '0.05em' }}>SCORE {TIERS[activeTier].range}</div>
                <p style={{ fontSize: 14.5, fontWeight: 400, color: 'rgba(13,11,20,0.65)', lineHeight: 1.65, marginBottom: 22, maxWidth: 300 }}>
                  {TIERS[activeTier].desc}. Reach this tier by accumulating on-chain reputation actions.
                </p>
                {/* Progress bar */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.4)', letterSpacing: '0.1em' }}>SCORE PROGRESS</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: TIERS[activeTier].c, fontWeight: 600 }}>{TIERS[activeTier].pct}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 100, background: 'rgba(13,11,20,0.07)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 100,
                      background: `linear-gradient(90deg, ${TIERS[activeTier].c}80, ${TIERS[activeTier].c})`,
                      width: `${TIERS[activeTier].pct}%`,
                      transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1), background 0.8s ease',
                      boxShadow: `0 0 8px ${TIERS[activeTier].c}55`,
                    }} />
                  </div>
                </div>
                <div className="tier-stat-pills" style={{ display: 'flex', gap: 10 }}>
                  {[{ l: 'Voting Power', v: TIERS[activeTier].voting }, { l: 'Loan Access', v: TIERS[activeTier].loan }].map(s => (
                    <div key={s.l} style={{ padding: '10px 18px', borderRadius: 13, background: `${TIERS[activeTier].c}10`, border: `1.5px solid ${TIERS[activeTier].c}28`, textAlign: 'center', minWidth: 95, transition: 'background 0.8s ease, border-color 0.8s ease' }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: 'rgba(13,11,20,0.48)', letterSpacing: '0.1em', marginBottom: 4 }}>{s.l}</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 22, color: TIERS[activeTier].c, transition: 'color 0.8s ease' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Arc ring — desktop only */}
              <div className="tier-sidebar-arc" style={{ flexShrink: 0 }}>
                <svg width={96} height={96} viewBox="0 0 96 96">
                  <circle cx={48} cy={48} r={40} fill="none" stroke="rgba(13,11,20,0.07)" strokeWidth={6.5} />
                  <circle cx={48} cy={48} r={40} fill="none" stroke={TIERS[activeTier].c} strokeWidth={6.5} strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={`${2 * Math.PI * 40 * (1 - TIERS[activeTier].pct / 100)}`}
                    transform="rotate(-90 48 48)" style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1), stroke 0.8s ease' }} />
                  <text x={48} y={44} textAnchor="middle" fontSize={17} fontWeight={700} fontFamily="'Playfair Display', serif" fill={TIERS[activeTier].c}>{TIERS[activeTier].pct}%</text>
                  <text x={48} y={58} textAnchor="middle" fontSize={7.5} fontFamily="'JetBrains Mono', monospace" fill="rgba(13,11,20,0.42)">max score</text>
                </svg>
              </div>
            </div>
          </div>

          {/* Tier pills */}
          <div className="tier-pills-row">
            {TIERS.map((t, i) => (
              <button key={t.name} className="tier-pill" onClick={() => handleTierClick(i)}
                onMouseEnter={() => setHoveredTier(i)} onMouseLeave={() => setHoveredTier(null)}
                style={{
                  padding: '8px 18px', borderRadius: 100,
                  background: activeTier === i ? `${t.c}15` : (hoveredTier === i ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.72)'),
                  border: `1.5px solid ${activeTier === i ? t.c + '50' : 'rgba(13,11,20,0.1)'}`,
                  color: activeTier === i ? t.c : 'rgba(13,11,20,0.6)',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: activeTier === i ? 700 : 500,
                  cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', gap: 7,
                  transform: activeTier === i ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: activeTier === i ? `0 4px 14px ${t.g}` : 'none',
                  transition: 'all 0.32s cubic-bezier(0.16,1,0.3,1)',
                }}>
                <span style={{ fontSize: 13 }}>{t.icon}</span>{t.name}
              </button>
            ))}
          </div>

          {/* Score spectrum bar */}
          <div id="spectrum" data-reveal style={{
            padding: '18px 22px', borderRadius: 16, background: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(13,11,20,0.07)', ...rv('spectrum', 250),
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              {['0','100','300','600','850','1000'].map(n => (
                <span key={n} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.5)' }}>{n}</span>
              ))}
            </div>
            <div style={{ height: 6, borderRadius: 100, background: 'linear-gradient(90deg, #94a3b8 0%, #94a3b8 10%, #c2773a 10%, #c2773a 30%, #8b9eb7 30%, #8b9eb7 60%, #c9933a 60%, #c9933a 85%, #7c5cbf 85%, #7c5cbf 100%)' }} />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: 'rgba(13,11,20,0.35)', marginTop: 8, textAlign: 'center', letterSpacing: '0.1em' }}>
              SCORE RANGE 0 → 1000 · AUTO-CLAMPED · ERC-5484 SOULBOUND TOKEN
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ ACTIONS ══════════ */}
      <section id="actions" style={{ position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 70% 55% at 5% 15%, rgba(253,220,245,0.58) 0%, transparent 55%),
            radial-gradient(ellipse 55% 48% at 95% 10%, rgba(218,210,252,0.5) 0%, transparent 52%),
            radial-gradient(ellipse 45% 40% at 50% 90%, rgba(254,240,195,0.42) 0%, transparent 55%),
            rgba(253,251,255,0.7)
          `,
        }} />

        <div className="actions-section-inner" style={{ maxWidth: 1040, margin: '0 auto', position: 'relative', zIndex: 1, padding: '92px 32px' }}>

          {/* Header */}
          <div id="actions-hdr" data-reveal style={{ marginBottom: 64, ...rv('actions-hdr') }}>
            <div className="actions-light-hero" style={{
              position: 'relative', borderRadius: 28, overflow: 'hidden',
              background: 'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(28px) saturate(1.8)',
              WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
              border: '1.5px solid rgba(255,255,255,0.9)',
              boxShadow: '0 24px 64px rgba(124,58,237,0.09), 0 6px 24px rgba(194,53,122,0.07), inset 0 1px 0 rgba(255,255,255,0.95)',
              padding: '48px 52px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40,
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '28px 28px 0 0',
                background: 'linear-gradient(90deg, #fce7f3, #c2357a, #7c3aed, #3b6cf6, #10b981, #c9933a, #fce7f3)',
                backgroundSize: '300% 100%', animation: 'auroraShift 5s ease infinite',
              }} />
              <div style={{ position: 'relative', zIndex: 2, flex: '1 1 300px', minWidth: 240 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 20, padding: '5px 14px', borderRadius: 100, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 8px rgba(124,58,237,0.7)', animation: 'liveDot 2s ease-in-out infinite', flexShrink: 0 }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 600, color: '#7c3aed', letterSpacing: '0.22em' }}>SCORE ENGINE</span>
                </div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 'clamp(28px, 4vw, 54px)', letterSpacing: '-0.03em', lineHeight: 1.0, marginBottom: 0, color: '#0d0b14' }}>Actions shape</h2>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 'clamp(28px, 4vw, 54px)', letterSpacing: '-0.03em', lineHeight: 1.08, marginBottom: 22, background: 'linear-gradient(130deg, #3b0764 0%, #7c3aed 38%, #c2357a 70%, #c9933a 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', backgroundSize: '220% auto', animation: 'shimmerTitle 4s linear infinite' }}>your crystal</h2>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontStyle: 'italic', fontSize: 14, fontWeight: 300, color: 'rgba(13,11,20,0.55)', lineHeight: 1.82, maxWidth: 320, marginBottom: 28, borderLeft: '2px solid rgba(124,58,237,0.22)', paddingLeft: 14 }}>
                  Every interaction is <span style={{ fontWeight: 600, fontStyle: 'normal', color: '#7c3aed' }}>permanently etched</span> on-chain.
                  No rollback. No forgiveness. No reset.
                  <br /><span style={{ fontWeight: 600, fontStyle: 'normal', color: '#c2357a' }}>Build trust</span> — or watch it burn.
                </p>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  {[
                    { v: '7', l: 'Total Actions', c: '#7c3aed', bg: 'rgba(124,58,237,0.07)', bc: 'rgba(124,58,237,0.18)' },
                    { v: '1000', l: 'Max Score',    c: '#c2357a', bg: 'rgba(194,53,122,0.07)', bc: 'rgba(194,53,122,0.18)' },
                    { v: '∞',   l: 'Permanent',    c: '#c9933a', bg: 'rgba(201,147,58,0.07)', bc: 'rgba(201,147,58,0.18)' },
                  ].map(s => (
                    <div key={s.l} style={{ padding: '10px 18px', borderRadius: 12, background: s.bg, border: `1.5px solid ${s.bc}`, textAlign: 'center', minWidth: 76, backdropFilter: 'blur(8px)' }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 20, color: s.c, lineHeight: 1 }}>{s.v}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(13,11,20,0.42)', letterSpacing: '0.1em', marginTop: 4 }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Score viz — desktop only */}
              <div className="actions-score-viz" style={{ position: 'relative', width: 240, height: 240, flexShrink: 0, zIndex: 2 }}>
                <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, rgba(194,53,122,0.05) 45%, transparent 65%)', animation: 'orbF1 6s ease-in-out infinite' }} />
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox="0 0 240 240">
                  <defs>
                    <linearGradient id="larcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.85"/>
                      <stop offset="50%" stopColor="#c2357a" stopOpacity="0.9"/>
                      <stop offset="100%" stopColor="#c9933a" stopOpacity="0.85"/>
                    </linearGradient>
                    <linearGradient id="larcGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b6cf6" stopOpacity="0.6"/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.6"/>
                    </linearGradient>
                  </defs>
                  <circle cx="120" cy="120" r="108" fill="none" stroke="rgba(124,58,237,0.08)" strokeWidth="1.5" strokeDasharray="6 10"/>
                  <circle cx="120" cy="120" r="88"  fill="none" stroke="rgba(194,53,122,0.07)" strokeWidth="1" strokeDasharray="3 8"/>
                  <circle cx="120" cy="120" r="108" fill="none" stroke="url(#larcGrad)" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${2*Math.PI*108*0.78} ${2*Math.PI*108*0.22}`}
                    transform="rotate(-90 120 120)" opacity="0.9"
                    style={{ filter: 'drop-shadow(0 0 5px rgba(124,58,237,0.3))' }}/>
                  <circle cx="120" cy="120" r="88"  fill="none" stroke="url(#larcGrad2)" strokeWidth="2" strokeLinecap="round"
                    strokeDasharray={`${2*Math.PI*88*0.55} ${2*Math.PI*88*0.45}`}
                    transform="rotate(45 120 120)" opacity="0.6"/>
                  <circle cx={120 + 108 * Math.cos(2*Math.PI*0.78 - Math.PI/2)} cy={120 + 108 * Math.sin(2*Math.PI*0.78 - Math.PI/2)} r="5" fill="#c2357a" opacity="0.9" style={{ filter: 'drop-shadow(0 0 7px rgba(194,53,122,0.7))' }}/>
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 78, lineHeight: 1, background: 'linear-gradient(135deg, #7c3aed, #c2357a, #c9933a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', backgroundSize: '200% auto', animation: 'crystalFloat 6s ease-in-out infinite' }}>◆</div>
                <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: 'rgba(13,11,20,0.42)', letterSpacing: '0.16em', whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.8)', padding: '3px 10px', borderRadius: 18, border: '1px solid rgba(124,58,237,0.12)' }}>REPUTATION SCORE</div>
              </div>
            </div>
          </div>

          {/* Actions grid */}
          <div className="actions-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: '0 32px' }}>

            {/* LEFT: GAINS */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '9px 20px', borderRadius: 100,
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(13,150,96,0.06) 100%)',
                  border: '1.5px solid rgba(16,185,129,0.28)',
                  animation: 'greenGlow 3s ease-in-out infinite',
                }}>
                  <span style={{ fontSize: 15, animation: 'dotBounce 1.8s ease-in-out infinite' }}>▲</span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 11.5, fontWeight: 800, color: '#0d9660', letterSpacing: '0.16em' }}>REPUTATION GAINS</span>
                </div>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(16,185,129,0.28), transparent)' }} />
              </div>

              <div className="gains-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                {ACTIONS.filter(a => a.pos).map((a, i) => (
                  <div key={a.name} id={`act${i}`} data-reveal className="action-card-cine"
                    onMouseEnter={() => setHoveredAction(i)} onMouseLeave={() => setHoveredAction(null)}
                    style={{
                      position: 'relative', borderRadius: 18, padding: '20px 18px 18px',
                      background: hoveredAction === i
                        ? `linear-gradient(145deg, rgba(255,255,255,0.97) 0%, ${a.c}10 100%)`
                        : `linear-gradient(145deg, rgba(255,255,255,0.88) 0%, ${a.c}06 100%)`,
                      border: `1.5px solid ${hoveredAction === i ? a.c + '45' : a.c + '1a'}`,
                      boxShadow: hoveredAction === i
                        ? `0 14px 40px ${a.c}1e, 0 3px 12px rgba(0,0,0,0.04)`
                        : `0 3px 14px rgba(0,0,0,0.05)`,
                      backdropFilter: 'blur(14px)',
                      cursor: 'default',
                      transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
                      transform: hoveredAction === i ? 'translateY(-3px) scale(1.008)' : 'none',
                      animation: `actionCardIn 0.55s cubic-bezier(0.16,1,0.3,1) ${i * 70}ms both`,
                      overflow: 'hidden',
                      gridColumn: i === 4 ? '1 / -1' : 'auto',
                      ...rv(`act${i}`, i * 55),
                    }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, borderRadius: '18px 18px 0 0', background: `linear-gradient(90deg, transparent, ${a.c}, transparent)`, opacity: hoveredAction === i ? 1 : 0.45, transition: 'opacity 0.35s ease' }} />
                    <div style={{ position: 'absolute', top: -18, right: -18, width: 90, height: 90, borderRadius: '50%', background: `radial-gradient(circle, ${a.c}18 0%, transparent 70%)`, opacity: hoveredAction === i ? 1 : 0.45, transition: 'opacity 0.35s ease', pointerEvents: 'none' }} />

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                        background: `${a.c}14`, border: `1.5px solid ${a.c}2e`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, color: a.c,
                        transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                        transform: hoveredAction === i ? 'scale(1.12) rotate(7deg)' : 'none',
                        boxShadow: hoveredAction === i ? `0 5px 16px ${a.c}30` : 'none',
                      }}>{a.icon}</div>
                      <div style={{
                        fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 30, color: '#0d9660',
                        lineHeight: 1, letterSpacing: '-0.02em',
                        textShadow: hoveredAction === i ? `0 0 20px rgba(13,150,96,0.45)` : 'none',
                        transition: 'text-shadow 0.35s ease',
                        animation: hoveredAction === i ? 'deltaFloat 2s ease-in-out infinite' : 'none',
                      }}>{a.delta}</div>
                    </div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13.5, fontWeight: 700, color: '#0d0b14', marginBottom: 5, letterSpacing: '-0.01em' }}>{a.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: a.c, background: `${a.c}0d`, padding: '2px 7px', borderRadius: 5, border: `1px solid ${a.c}1e` }}>{a.fn}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: 'rgba(13,11,20,0.4)' }}>{a.cd}</span>
                    </div>
                    <div style={{ height: 2.5, borderRadius: 100, background: 'rgba(13,11,20,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 100, background: `linear-gradient(90deg, ${a.c}70, ${a.c})`, width: hoveredAction === i ? `${Math.min(100, (parseInt(a.delta)/30)*100)}%` : `${Math.min(100, (parseInt(a.delta)/30)*50)}%`, transition: 'width 0.55s cubic-bezier(0.16,1,0.3,1)', boxShadow: `0 0 5px ${a.c}45` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="actions-divider-v" style={{ background: 'linear-gradient(to bottom, transparent, rgba(13,11,20,0.08) 20%, rgba(13,11,20,0.08) 80%, transparent)', borderRadius: 2 }} />

            {/* RIGHT: PENALTIES */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '9px 20px', borderRadius: 100,
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.05) 100%)',
                  border: '1.5px solid rgba(239,68,68,0.26)',
                  animation: 'warningPulse 3s ease-in-out infinite',
                }}>
                  <span style={{ fontSize: 15, color: '#ef4444', animation: 'dotBounce 2.2s ease-in-out infinite' }}>▼</span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 11.5, fontWeight: 800, color: '#ef4444', letterSpacing: '0.16em' }}>REPUTATION PENALTIES</span>
                </div>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(239,68,68,0.28), transparent)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ACTIONS.filter(a => !a.pos).map((a, i) => (
                  <div key={a.name} id={`actn${i}`} data-reveal className="penalty-card-cine"
                    onMouseEnter={() => setHoveredAction(10 + i)} onMouseLeave={() => setHoveredAction(null)}
                    style={{
                      position: 'relative', borderRadius: 18, padding: '24px 22px',
                      background: hoveredAction === 10 + i
                        ? `linear-gradient(145deg, rgba(255,255,255,0.97) 0%, ${a.c}10 100%)`
                        : `linear-gradient(145deg, rgba(255,255,255,0.88) 0%, ${a.c}07 100%)`,
                      border: `1.5px solid ${hoveredAction === 10 + i ? a.c + '50' : a.c + '22'}`,
                      boxShadow: hoveredAction === 10 + i
                        ? `0 18px 48px ${a.c}20, 0 3px 12px rgba(0,0,0,0.05)`
                        : `0 4px 20px rgba(0,0,0,0.05)`,
                      backdropFilter: 'blur(14px)',
                      cursor: 'default',
                      transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
                      transform: hoveredAction === 10 + i ? 'translateY(-3px) scale(1.006)' : 'none',
                      animation: `penaltyCardIn 0.55s cubic-bezier(0.16,1,0.3,1) ${i * 90}ms both`,
                      overflow: 'hidden',
                      ...rv(`actn${i}`, i * 75 + 130),
                    }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, borderRadius: '18px 18px 0 0', background: `linear-gradient(90deg, transparent, ${a.c}ee, ${a.c}aa, transparent)`, opacity: hoveredAction === 10 + i ? 1 : 0.55, transition: 'opacity 0.35s ease' }} />
                    <div style={{ position: 'absolute', bottom: -24, right: -24, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle, ${a.c}15 0%, transparent 70%)`, opacity: hoveredAction === 10 + i ? 1 : 0.45, transition: 'opacity 0.35s ease', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 100, color: `${a.c}07`, lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>{a.delta}</div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {hoveredAction === 10 + i && (
                          <div style={{ position: 'absolute', inset: -5, borderRadius: 18, border: `1.5px solid ${a.c}55`, animation: 'halorRing 1.6s ease-out infinite', pointerEvents: 'none' }} />
                        )}
                        <div style={{
                          width: 54, height: 54, borderRadius: 17, flexShrink: 0,
                          background: `linear-gradient(145deg, ${a.c}18, ${a.c}0a)`,
                          border: `2px solid ${a.c}${hoveredAction === 10 + i ? '55' : '28'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 25, color: a.c,
                          transition: 'all 0.3s ease',
                          animation: hoveredAction === 10 + i ? 'penaltyShake 0.85s ease-in-out' : 'none',
                          boxShadow: hoveredAction === 10 + i ? `0 7px 24px ${a.c}28` : `0 3px 10px ${a.c}14`,
                        }}>{a.icon}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15.5, fontWeight: 800, color: '#0d0b14', marginBottom: 6, letterSpacing: '-0.01em' }}>{a.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: a.c, background: `${a.c}0e`, padding: '2px 9px', borderRadius: 6, border: `1px solid ${a.c}22` }}>{a.fn}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.4)' }}>{a.cd}</span>
                        </div>
                        <div style={{ height: 3, borderRadius: 100, background: 'rgba(13,11,20,0.07)', overflow: 'hidden', maxWidth: 190 }}>
                          <div style={{ height: '100%', borderRadius: 100, background: `linear-gradient(90deg, ${a.c}80, ${a.c})`, width: hoveredAction === 10 + i ? `${Math.min(100,(Math.abs(parseInt(a.delta))/50)*100)}%` : `${Math.min(100,(Math.abs(parseInt(a.delta))/50)*42)}%`, transition: 'width 0.55s cubic-bezier(0.16,1,0.3,1)', boxShadow: `0 0 7px ${a.c}55` }} />
                        </div>
                      </div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 42, color: a.c, lineHeight: 1, letterSpacing: '-0.03em', flexShrink: 0, textShadow: hoveredAction === 10 + i ? `0 0 24px ${a.c}55` : 'none', transition: 'text-shadow 0.35s ease', animation: hoveredAction === 10 + i ? 'deltaFloat 1.8s ease-in-out infinite' : 'none' }}>{a.delta}</div>
                    </div>
                  </div>
                ))}

                {/* Warning banner */}
                <div style={{
                  position: 'relative', borderRadius: 18, overflow: 'hidden', padding: '20px 22px',
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.82) 0%, rgba(239,68,68,0.04) 100%)',
                  border: '1.5px solid rgba(239,68,68,0.2)', boxShadow: '0 6px 24px rgba(239,68,68,0.07)', backdropFilter: 'blur(14px)',
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, borderRadius: '18px 18px 0 0', background: 'linear-gradient(90deg, #ef4444, #f97316, #ef4444)', backgroundSize: '200% 100%', animation: 'auroraShift 3s ease infinite' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.26)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, animation: 'warningPulse 2.5s ease-in-out infinite' }}>⚠</div>
                    <div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 800, color: '#ef4444', letterSpacing: '0.13em', marginBottom: 5, textTransform: 'uppercase' }}>Permanent · No Reset · No Forgiveness</div>
                      <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(13,11,20,0.58)', lineHeight: 1.65 }}>Penalties are applied on-chain and cannot be undone. Your reputation is your most valuable on-chain asset.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ ARCHITECTURE ══════════ */}
      <section id="architecture" className="arch-section" style={{ position: 'relative', zIndex: 1, overflow: 'hidden', padding: '92px 32px' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(rgba(124,92,191,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(124,92,191,0.03) 1px, transparent 1px)`, backgroundSize: '56px 56px' }} />
        <div style={{ maxWidth: 1040, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div id="arch-hdr" data-reveal style={{ textAlign: 'center', marginBottom: 60, ...rv('arch-hdr') }}>
            <h2 className="heading-shimmer" style={{ marginBottom: 16 }}>Three contracts,<br />one identity</h2>
            <p style={{ fontSize: 15.5, fontWeight: 400, color: 'rgba(13,11,20,0.6)', maxWidth: 340, margin: '0 auto', lineHeight: 1.75 }}>Token is immutable. Engine evolves. Vault is your gateway.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, padding: '0 18px' }}>
            {CONTRACTS.map((c, i) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ flex: 1, height: 1, background: i === 0 ? 'transparent' : `linear-gradient(90deg, ${CONTRACTS[i-1].c}40, ${c.c}40)` }} />
                <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: `rgba(255,255,255,0.9)`, border: `1.5px solid ${c.c}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: c.c, boxShadow: `0 0 14px ${c.c}1e`, animation: `contractGlow ${2 + i}s ease-in-out infinite` }}>{c.num}</div>
                <div style={{ flex: 1, height: 1, background: i === CONTRACTS.length - 1 ? 'transparent' : `linear-gradient(90deg, ${c.c}40, ${CONTRACTS[i+1]?.c}40)` }} />
              </div>
            ))}
          </div>

          <div className="contracts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {CONTRACTS.map((c, i) => (
              <div key={c.name} id={`con${i}`} data-reveal className="contract-card"
                onMouseEnter={() => setHoveredContract(i)} onMouseLeave={() => setHoveredContract(null)}
                style={{
                  borderRadius: 20, overflow: 'hidden', position: 'relative',
                  background: 'rgba(255,255,255,0.88)', border: `1.5px solid ${c.c}22`,
                  boxShadow: hoveredContract === i ? `0 22px 55px ${c.c}16, 0 0 0 1px ${c.c}28` : `0 5px 22px rgba(13,11,20,0.07)`,
                  ...rv(`con${i}`, i * 90),
                }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${c.c}, transparent)`, opacity: hoveredContract === i ? 1 : 0.45, transition: 'opacity 0.3s ease' }} />
                <div style={{ position: 'absolute', top: -45, right: -45, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${c.c}0e 0%, transparent 65%)`, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -16, right: 0, fontFamily: "'Playfair Display', serif", fontSize: 90, fontWeight: 900, color: `${c.c}08`, lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>{c.num}</div>
                <div className="contract-card-inner" style={{ padding: '30px 24px', position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: `${c.c}10`, border: `1.5px solid ${c.c}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, transition: 'transform 0.26s ease', transform: hoveredContract === i ? 'scale(1.08) rotate(-3deg)' : 'none' }}>{c.icon}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: c.c, letterSpacing: '0.1em', padding: '4px 10px', borderRadius: 7, background: `${c.c}10`, border: `1px solid ${c.c}22` }}>{c.tag}</div>
                  </div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 'clamp(18px, 2vw, 23px)', color: '#0d0b14', letterSpacing: '-0.02em', marginBottom: 4, lineHeight: 1.1 }}>{c.name}</h3>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: c.c, opacity: 0.65, padding: '6px 10px', borderRadius: 8, background: `${c.c}08`, border: `1px solid ${c.c}14`, marginBottom: 20, marginTop: 10, letterSpacing: '0.04em' }}>{c.short}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 22 }}>
                    {c.feats.map((f, fi) => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 19, height: 19, borderRadius: 6, flexShrink: 0, background: `${c.c}12`, border: `1px solid ${c.c}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: c.c, fontWeight: 600 }}>{fi + 1}</div>
                        <span style={{ fontSize: 12.5, fontWeight: 400, color: 'rgba(13,11,20,0.68)', lineHeight: 1.4 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <a href={c.etherscan} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, background: `${c.c}10`, border: `1px solid ${c.c}24`, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: c.c, textDecoration: 'none', letterSpacing: '0.06em', fontWeight: 500, transition: 'all 0.2s ease' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${c.c}1e`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${c.c}10`; }}
                  >View on Etherscan ↗</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section className="cta-section" style={{
        position: 'relative', zIndex: 1, padding: '100px 32px', textAlign: 'center', overflow: 'hidden',
        background: 'linear-gradient(150deg, rgba(253,220,245,0.5) 0%, rgba(235,228,252,0.5) 50%, rgba(254,240,195,0.4) 100%)',
        borderTop: '1px solid rgba(124,92,191,0.1)',
      }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 600, height: 600, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,92,191,0.06) 0%, rgba(194,53,122,0.03) 45%, transparent 70%)', pointerEvents: 'none' }} />
        <div id="cta-content" data-reveal style={{ position: 'relative', zIndex: 1, ...rv('cta-content') }}>
          <div style={{ fontSize: 52, marginBottom: 22, display: 'inline-block', animation: 'crystalFloat 6s ease-in-out infinite' }}>◆</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 'clamp(30px, 5vw, 60px)', letterSpacing: '-0.03em', color: '#0d0b14', marginBottom: 18, lineHeight: 1.04 }}>
            Start building your<br />
            <span style={{ background: 'linear-gradient(130deg, #7c3aed, #c2357a, #c9933a)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'shimmerTitle 3s linear infinite' }}>reputation today</span>
          </h2>
          <p style={{ fontSize: 16, fontWeight: 400, color: 'rgba(13,11,20,0.65)', maxWidth: 380, margin: '0 auto 38px', lineHeight: 1.78 }}>
            Connect your wallet, take your first action, receive your Soulbound Token automatically.
          </p>
          <div style={{ display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ animation: 'pulseGlow 3s ease-in-out infinite', display: 'inline-block', borderRadius: 13 }}>
              <ConnectButton label="Connect & Begin →" />
            </div>
            <a href="https://github.com/NexTechArchitect/RST-Reputation-Protocol" target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '13px 24px', borderRadius: 13, background: 'rgba(13,11,20,0.06)', border: '1px solid rgba(13,11,20,0.12)', color: 'rgba(13,11,20,0.62)', fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, textDecoration: 'none', transition: 'all 0.22s ease' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(124,92,191,0.1)'; el.style.borderColor = 'rgba(124,92,191,0.28)'; el.style.color = '#7c5cbf'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(13,11,20,0.06)'; el.style.borderColor = 'rgba(13,11,20,0.12)'; el.style.color = 'rgba(13,11,20,0.62)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              View Source Code
            </a>
          </div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: 'rgba(13,11,20,0.32)', marginTop: 20, letterSpacing: '0.13em' }}>
            SEPOLIA TESTNET · ERC-5484 · SOULBOUND · NON-TRANSFERABLE
          </p>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{
        position: 'relative', zIndex: 1, padding: '18px 40px',
        borderTop: '1px solid rgba(13,11,20,0.08)', background: 'rgba(253,251,255,0.96)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 11,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 25, height: 25, borderRadius: 7, background: 'linear-gradient(135deg, #7c3aed, #c2357a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>◆</div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'rgba(13,11,20,0.52)' }}>RST Protocol — ERC-5484</span>
        </div>
        <div className="footer-addrs" style={{ display: 'flex', gap: 26 }}>
          {[{ l: 'Token', a: '0x9c77Ce31...' }, { l: 'Engine', a: '0x4eFC1adc...' }, { l: 'Vault', a: '0xd53320CD...' }].map(c => (
            <div key={c.l}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.32)', letterSpacing: '0.1em' }}>{c.l}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(13,11,20,0.55)' }}>{c.a}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="https://github.com/NexTechArchitect/RST-Reputation-Protocol" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(13,11,20,0.45)', textDecoration: 'none', transition: 'color 0.2s', letterSpacing: '0.06em' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#7c5cbf'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(13,11,20,0.45)'}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: 'rgba(13,11,20,0.38)', letterSpacing: '0.08em' }}>Built by NexTech Architect · 2025</div>
        </div>
      </footer>
    </>
  );
}