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
    bg: 'linear-gradient(145deg, #1a0011 0%, #2d0020 40%, #1a000e 100%)',
    addr: '0x9c77Ce31a110e360d62e4eF8B1F4cf8576F70F46', short: '0x9c77Ce31...F70F46',
    feats: ['One SBT per wallet, ever', 'Transfer-locked via _update()', 'On-chain SVG medal art'],
    icon: '🛡️', num: '01',
    etherscan: 'https://sepolia.etherscan.io/address/0x9c77Ce31a110e360d62e4eF8B1F4cf8576F70F46',
  },
  {
    name: 'ReputationEngine', tag: 'UUPS · Upgradeable', c: '#3b82f6',
    bg: 'linear-gradient(145deg, #00081a 0%, #001230 40%, #00060f 100%)',
    addr: '0x4eFC1adc7Dd594C4bB04865B6dCc5101392FaBD8', short: '0x4eFC1adc...FaBD8',
    feats: ['CEI strict + nonReentrant', 'Score clamped [0, 1000]', 'UUPS proxy pattern'],
    icon: '⚙️', num: '02',
    etherscan: 'https://sepolia.etherscan.io/address/0x4eFC1adc7Dd594C4bB04865B6dCc5101392FaBD8',
  },
  {
    name: 'ReputationVault', tag: 'Action Gateway', c: '#10b981',
    bg: 'linear-gradient(145deg, #001a0e 0%, #002d1a 40%, #000f0a 100%)',
    addr: '0xd53320CDEF6f3DfA54436D2806e765d6d6bD98b6', short: '0xd53320CD...D98b6',
    feats: ['12h vote / NFT cooldown', '30-day airdrop hold gate', 'Owner-only default marking'],
    icon: '🔒', num: '03',
    etherscan: 'https://sepolia.etherscan.io/address/0xd53320CDEF6f3DfA54436D2806e765d6d6bD98b6',
  },
];

// ── ORB ───────────────────────────────────────────────────────────────────────
interface OrbProps { size: number; x: string; y: string; delay?: number; dur?: number; c1?: string; c2?: string; c3?: string; }
function Orb({ size, x, y, delay = 0, dur = 5, c1 = '#fce7f3', c2 = '#e9d5ff', c3 = '#c4b5fd' }: OrbProps) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 33% 28%, rgba(255,255,255,0.95) 0%, ${c1} 25%, ${c2} 55%, ${c3} 82%, transparent 100%)`,
      animation: `orbF${delay % 4} ${dur}s ease-in-out ${delay * 0.4}s infinite`,
      pointerEvents: 'none',
    }} />
  );
}

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // ── AUTO-CYCLE: slowed to 4800ms with dramatic morph ──
  useEffect(() => {
    const startCycle = () => {
      autoIntervalRef.current = setInterval(() => {
        setTierMorphing(true);
        setTimeout(() => {
          setActiveTier(prev => (prev + 1) % TIERS.length);
          setTierMorphing(false);
        }, 700);
      }, 4800);
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

  // ── PARTICLE CANVAS ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const pts = Array.from({ length: 75 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2,
      r: Math.random() * 1.8 + 0.4, a: Math.random() * 0.3 + 0.08,
      h: Math.random() > 0.5 ? 310 : 270,
      trail: [] as { x: number; y: number }[],
    }));

    const comets = Array.from({ length: 3 }, (_, i) => ({
      x: -120, y: Math.random() * window.innerHeight * 0.7,
      vx: 11 + Math.random() * 7, vy: (Math.random() - 0.5) * 2,
      len: 80 + Math.random() * 60, h: i % 2 === 0 ? 310 : 280,
      active: false, timer: Math.floor(Math.random() * 300),
    }));

    let raf: number;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 8) p.trail.shift();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        p.trail.forEach((pos, ti) => {
          const ratio = ti / p.trail.length;
          ctx.beginPath(); ctx.arc(pos.x, pos.y, p.r * ratio * 0.7, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.h},60%,70%,${p.a * ratio * 0.35})`; ctx.fill();
        });
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.h},60%,70%,${p.a})`; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 90) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.strokeStyle = `hsla(290,50%,68%,${0.06 * (1 - d / 90)})`; ctx.lineWidth = 0.6; ctx.stroke(); }
      }
      comets.forEach(c => {
        c.timer--;
        if (c.timer <= 0) { c.active = true; c.x = -120; c.y = Math.random() * canvas.height * 0.75; c.vx = 12 + Math.random() * 7; c.vy = (Math.random() - 0.5) * 2; c.timer = 300 + Math.floor(Math.random() * 360); }
        if (!c.active) return;
        c.x += c.vx; c.y += c.vy;
        if (c.x > canvas.width + 200) { c.active = false; return; }
        const grad = ctx.createLinearGradient(c.x - c.len, c.y, c.x, c.y);
        grad.addColorStop(0, `hsla(${c.h},70%,75%,0)`); grad.addColorStop(1, `hsla(${c.h},70%,80%,0.5)`);
        ctx.beginPath(); ctx.moveTo(c.x - c.len, c.y); ctx.lineTo(c.x, c.y); ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(c.x, c.y, 2.2, 0, Math.PI * 2); ctx.fillStyle = `hsla(${c.h},80%,92%,0.85)`; ctx.fill();
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  // ── SCROLL REVEAL ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setVisible(p => new Set([...p, e.target.id])); });
    }, { threshold: 0.06 });
    document.querySelectorAll('[data-reveal]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [mounted]);

  const rv = useCallback((id: string, delay = 0): React.CSSProperties => ({
    opacity: visible.has(id) ? 1 : 0,
    transform: visible.has(id) ? 'translateY(0) scale(1)' : 'translateY(28px) scale(0.97)',
    transition: `opacity 0.72s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.72s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
  }), [visible]);

  // ── handleTierClick — slowed with dramatic morph ──
  const handleTierClick = useCallback((i: number) => {
    setTierMorphing(true);
    setTimeout(() => {
      setActiveTier(i);
      setTierMorphing(false);
    }, 700);
    if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => {
      setActiveTier(0);
      autoIntervalRef.current = setInterval(() => {
        setTierMorphing(true);
        setTimeout(() => {
          setActiveTier(prev => (prev + 1) % TIERS.length);
          setTierMorphing(false);
        }, 700);
      }, 4800);
    }, 10000);
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

        @keyframes orbF0 { 0%,100%{transform:translate(0,0) rotate(0deg)} 33%{transform:translate(20px,-28px) rotate(5deg)} 66%{transform:translate(-12px,16px) rotate(-3deg)} }
        @keyframes orbF1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,32px)} }
        @keyframes orbF2 { 0%,100%{transform:translate(0,0)} 40%{transform:translate(16px,-20px)} 75%{transform:translate(-10px,13px)} }
        @keyframes orbF3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(11px,-22px) scale(1.03)} }

        @keyframes heroFadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmerTitle { 0%{background-position:-220% center} 100%{background-position:220% center} }
        @keyframes pulseGlow {
          0%,100%{box-shadow:0 8px 28px rgba(124,92,191,0.3),0 2px 8px rgba(194,53,122,0.15)}
          50%{box-shadow:0 14px 44px rgba(124,92,191,0.5),0 4px 18px rgba(194,53,122,0.3)}
        }
        @keyframes liveDot { 0%,100%{transform:scale(1);opacity:0.9} 50%{transform:scale(1.7);opacity:0.4} }
        @keyframes scrollHint { 0%,100%{transform:translateY(0);opacity:0.4} 50%{transform:translateY(10px);opacity:0.85} }
        @keyframes floatGem { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-13px) rotate(7deg)} }
        @keyframes tierFloat { 0%,100%{transform:translateY(0px)} 33%{transform:translateY(-7px) rotate(2.5deg)} 66%{transform:translateY(-3px) rotate(-2deg)} }
        @keyframes contractGlow { 0%,100%{opacity:0.7} 50%{opacity:1} }
        @keyframes badgeShimmer { 0%,100%{background:rgba(255,255,255,0.82)} 50%{background:rgba(245,230,255,0.95)} }
        @keyframes hamOpen { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
        @keyframes rgbShift {
          0%{text-shadow: 2px 0 0 rgba(255,0,100,0.4), -2px 0 0 rgba(0,150,255,0.4);}
          25%{text-shadow: -2px 0 0 rgba(255,0,100,0.4), 2px 0 0 rgba(0,220,150,0.4);}
          50%{text-shadow: 2px 0 0 rgba(100,0,255,0.4), -2px 0 0 rgba(255,150,0,0.4);}
          75%{text-shadow: -2px 0 0 rgba(0,255,150,0.4), 2px 0 0 rgba(255,0,100,0.4);}
          100%{text-shadow: 2px 0 0 rgba(255,0,100,0.4), -2px 0 0 rgba(0,150,255,0.4);}
        }
        @keyframes rgbBorder {
          0%{border-color: rgba(255,0,100,0.35);}
          33%{border-color: rgba(100,0,255,0.35);}
          66%{border-color: rgba(0,200,150,0.35);}
          100%{border-color: rgba(255,0,100,0.35);}
        }
        @keyframes scanGlow {
          0%{opacity:0;transform:translateY(-100%);}
          10%{opacity:1;}
          90%{opacity:1;}
          100%{opacity:0;transform:translateY(100%);}
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes scrollHint2 { 0%,100%{transform:translateY(0);opacity:0.4} 50%{transform:translateY(10px);opacity:0.85} }

        /* ══ TIER MORPH — DRAMATIC SLOWMO ══ */
        @keyframes tierMorphOut {
          0%   { opacity:1; transform: scale(1) translateY(0px) rotateX(0deg); filter: blur(0px); }
          30%  { opacity:0.6; transform: scale(0.97) translateY(-6px) rotateX(2deg); filter: blur(2px); }
          100% { opacity:0; transform: scale(0.91) translateY(-22px) rotateX(8deg); filter: blur(12px); }
        }
        @keyframes tierMorphIn {
          0%   { opacity:0; transform: scale(1.08) translateY(26px) rotateX(-8deg); filter: blur(14px); }
          40%  { opacity:0.7; transform: scale(1.02) translateY(6px) rotateX(-2deg); filter: blur(3px); }
          70%  { opacity:0.92; transform: scale(0.995) translateY(-2px) rotateX(0.5deg); filter: blur(0.5px); }
          100% { opacity:1; transform: scale(1) translateY(0px) rotateX(0deg); filter: blur(0px); }
        }
        .tier-morphing-out {
          animation: tierMorphOut 0.7s cubic-bezier(0.4,0,0.6,1) forwards !important;
        }
        .tier-morphing-in {
          animation: tierMorphIn 0.95s cubic-bezier(0.16,1,0.3,1) forwards !important;
        }

        /* ══ SECTION HEADING SHIMMER ══ */
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

        /* ══ ACTIONS CINEMATIC ══ */
        @keyframes auroraShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes actionCardIn {
          from { opacity:0; transform: translateY(30px) scale(0.95); filter: blur(4px); }
          to   { opacity:1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes penaltyCardIn {
          from { opacity:0; transform: translateX(30px) scale(0.95); filter: blur(4px); }
          to   { opacity:1; transform: translateX(0) scale(1); filter: blur(0); }
        }
        @keyframes deltaFloat {
          0%,100% { transform: translateY(0px) scale(1); }
          50%      { transform: translateY(-5px) scale(1.04); }
        }
        @keyframes halorRing {
          0%   { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes glowPulseCard {
          0%,100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        @keyframes shimmerSweep {
          0%   { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(300%) skewX(-15deg); }
        }
        @keyframes shimmerTitle { 0%{background-position:-220% center} 100%{background-position:220% center} }
        @keyframes floatOrb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-22px) scale(1.06)} }
        @keyframes floatOrb2 { 0%,100%{transform:translate(0,0) scale(1)} 60%{transform:translate(-18px,26px) scale(0.96)} }
        @keyframes floatOrb3 { 0%,100%{transform:translate(0,0)} 40%{transform:translate(22px,14px)} 75%{transform:translate(-12px,-8px)} }
        @keyframes scoreCountUp { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }
        @keyframes dotBounce { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-6px)} }
        @keyframes penaltyShake {
          0%,100%{transform:rotate(0deg) scale(1)} 20%{transform:rotate(-3deg) scale(1.05)} 40%{transform:rotate(3deg) scale(1.02)} 60%{transform:rotate(-2deg)} 80%{transform:rotate(1.5deg)}
        }
        @keyframes warningPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
          50%      { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
        @keyframes greenGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.25); }
          50%      { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
        }
        @keyframes iconSpin {
          0%   { transform: rotate(0deg) scale(1); }
          25%  { transform: rotate(8deg) scale(1.08); }
          75%  { transform: rotate(-5deg) scale(0.96); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes barFillIn {
          from { width: 0%; opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes crystalFloat {
          0%,100% { transform: translateY(0) rotate(0deg); filter: drop-shadow(0 4px 18px rgba(124,58,237,0.25)); }
          33%      { transform: translateY(-9px) rotate(4deg); filter: drop-shadow(0 12px 28px rgba(124,58,237,0.4)); }
          66%      { transform: translateY(-4px) rotate(-3deg); filter: drop-shadow(0 8px 22px rgba(194,53,122,0.3)); }
        }

        /* action card hover shimmer */
        .action-card-cine { position: relative; overflow: hidden; }
        .action-card-cine::before {
          content: '';
          position: absolute; top: 0; left: 0; width: 35%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
          transform: translateX(-120%) skewX(-15deg);
          transition: none;
          z-index: 10;
        }
        .action-card-cine:hover::before {
          animation: shimmerSweep 0.7s ease forwards;
        }
        .penalty-card-cine { position: relative; overflow: hidden; }
        .penalty-card-cine::before {
          content: '';
          position: absolute; top: 0; left: 0; width: 35%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          transform: translateX(-120%) skewX(-15deg);
          z-index: 10;
        }
        .penalty-card-cine:hover::before {
          animation: shimmerSweep 0.7s ease forwards;
        }

        /* ── NAV ── */
        .nav-root {
          position: fixed; top:0; left:0; right:0; z-index:900;
          padding: 14px 48px;
          display: flex; align-items: center; justify-content: space-between;
          transition: all 0.45s cubic-bezier(0.16,1,0.3,1);
        }
        .nav-root.scrolled {
          background: rgba(253,251,255,0.92);
          backdrop-filter: blur(24px) saturate(1.6);
          -webkit-backdrop-filter: blur(24px) saturate(1.6);
          border-bottom: 1px solid rgba(124,92,191,0.1);
          padding-top: 11px; padding-bottom: 11px;
        }

        .hero-title {
          font-family: 'Playfair Display', serif; font-weight: 900;
          font-size: clamp(42px, 7.5vw, 92px); line-height: 1.0; letter-spacing: -0.03em;
          background: linear-gradient(130deg, #0d0b14 0%, #3b0764 22%, #7c3aed 46%, #c2357a 68%, #c9933a 88%);
          background-size: 260% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; animation: shimmerTitle 4.5s linear infinite, rgbShift 6s linear infinite;
        }
        .tier-pill { cursor: pointer; transition: all 0.4s cubic-bezier(0.16,1,0.3,1); }
        .contract-card { transition: all 0.35s cubic-bezier(0.16,1,0.3,1); }
        .contract-card:hover { transform: translateY(-10px) scale(1.012) !important; }

        .cinematic-line {
          position: absolute; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(124,92,191,0.5) 30%, rgba(194,53,122,0.6) 50%, rgba(124,92,191,0.5) 70%, transparent 100%);
          animation: scanGlow 8s ease-in-out infinite;
        }

        @media (max-width: 1024px) { .contracts-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 900px) {
          .nav-links-desk { display: none !important; }
          .nav-root { padding: 13px 20px !important; }
          .ham-btn { display: flex !important; }
          .tier-sidebar-arc { display: none !important; }
          .actions-two-col { grid-template-columns: 1fr !important; gap: 0 !important; }
          .actions-divider-v { display: none !important; }
          .contracts-grid { grid-template-columns: 1fr !important; }
          .stats-row { flex-wrap: wrap; gap: 22px !important; }
          .hero-btns { flex-direction: column; align-items: center !important; }
          .footer-addrs { display: none !important; }
          .tier-showcase-inner { flex-direction: column !important; gap: 24px !important; }
          .actions-light-hero { flex-direction: column !important; padding: 36px 24px !important; }
          .actions-score-viz { display: none !important; }
          .gains-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .hero-section { padding: 105px 18px 75px !important; }
          .section-pad { padding: 72px 18px !important; }
          .tier-stat-pills { flex-wrap: wrap; }
          .actions-section-inner { padding: 72px 18px !important; }
          .contract-card-inner { padding: 28px 20px !important; }
          .heading-shimmer { font-size: clamp(28px, 8vw, 46px) !important; }
          .gains-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 420px) {
          .nav-root { padding: 11px 14px !important; }
        }
      `}</style>

      {/* PARTICLE CANVAS */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

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

      {/* ORBS */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <Orb size={320} x="66%" y="-6%"  delay={0} dur={5} c1="rgba(251,200,228,0.88)" c2="rgba(192,175,251,0.72)" c3="rgba(143,45,230,0.3)" />
        <Orb size={220} x="-5%" y="8%"   delay={1} dur={4} c1="rgba(252,218,248,0.88)" c2="rgba(249,200,228,0.68)" c3="rgba(192,175,251,0.38)" />
        <Orb size={165} x="60%" y="50%"  delay={2} dur={6} c1="rgba(254,246,190,0.88)" c2="rgba(252,218,172,0.68)" c3="rgba(242,152,5,0.25)" />
        <Orb size={270} x="6%"  y="60%"  delay={0} dur={5} c1="rgba(220,240,252,0.88)" c2="rgba(188,216,252,0.68)" c3="rgba(95,98,238,0.25)" />
        <Orb size={110} x="86%" y="68%"  delay={1} dur={4} c1="rgba(252,222,222,0.88)" c2="rgba(250,160,160,0.68)" c3="rgba(215,32,32,0.2)" />
        <Orb size={140} x="40%" y="86%"  delay={2} dur={6} c1="rgba(216,250,228,0.88)" c2="rgba(128,236,168,0.62)" c3="rgba(12,180,125,0.22)" />
      </div>

      {/* ══════════ NAVBAR ══════════ */}
      <nav className={`nav-root${scrolled ? ' scrolled' : ''}`}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: 'linear-gradient(135deg, #7c3aed, #c2357a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
            boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
            animation: 'rgbBorder 4s linear infinite',
            border: '1.5px solid rgba(124,92,191,0.4)',
          }}>◆</div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: '#0d0b14', letterSpacing: '0.04em', lineHeight: 1 }}>
              RST<span style={{ color: '#c2357a' }}>.</span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: 'rgba(13,11,20,0.42)', letterSpacing: '0.22em', marginTop: 1 }}>PROTOCOL</div>
          </div>
        </a>

        <div className="nav-links-desk" style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
          {navLinks.map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 400,
              color: 'rgba(13,11,20,0.52)', textDecoration: 'none',
              letterSpacing: '0.13em', transition: 'color 0.2s, transform 0.2s',
              display: 'inline-block', textTransform: 'uppercase',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#7c5cbf'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(13,11,20,0.52)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
            >{l}</a>
          ))}
          <div style={{ width: 1, height: 14, background: 'rgba(13,11,20,0.14)' }} />
          <a href="/about" style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 500,
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
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(13,11,20,0.06)',
              border: '1px solid rgba(13,11,20,0.12)',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500,
              color: 'rgba(13,11,20,0.6)', textDecoration: 'none', letterSpacing: '0.08em',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(124,92,191,0.1)'; el.style.borderColor = 'rgba(124,92,191,0.3)'; el.style.color = '#7c5cbf'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(13,11,20,0.06)'; el.style.borderColor = 'rgba(13,11,20,0.12)'; el.style.color = 'rgba(13,11,20,0.6)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="nav-connect-desk">
            <ConnectButton showBalance={false} chainStatus="none" accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }} />
          </div>
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
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40,
        opacity: menuOpen ? 1 : 0, pointerEvents: menuOpen ? 'auto' : 'none',
        transition: 'opacity 0.35s ease',
      }}>
        {[...navLinks, 'Docs'].map((item, i) => (
          <a key={item}
            href={item === 'Docs' ? '/about' : `#${item.toLowerCase()}`}
            onClick={() => setMenuOpen(false)}
            style={{
              fontFamily: "'Playfair Display', serif", fontSize: 46, fontWeight: 700,
              color: item === 'Docs' ? '#7c5cbf' : '#0d0b14', textDecoration: 'none', letterSpacing: '-0.02em',
              opacity: menuOpen ? 1 : 0, transform: menuOpen ? 'none' : 'translateY(18px)',
              transition: `all 0.48s cubic-bezier(0.16,1,0.3,1) ${i * 55}ms`,
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#c2357a'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = item === 'Docs' ? '#7c5cbf' : '#0d0b14'}
          >{item}</a>
        ))}
        <div style={{ opacity: menuOpen ? 1 : 0, transform: menuOpen ? 'none' : 'translateY(18px)', transition: `all 0.48s cubic-bezier(0.16,1,0.3,1) ${5 * 55}ms` }}>
          <ConnectButton label="Connect Wallet" />
        </div>
      </div>

      {/* ══════════ HERO ══════════ */}
      <section className="hero-section" style={{
        position: 'relative', zIndex: 1, minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '120px 32px 95px', textAlign: 'center', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}><RibbonLayer /></div>
        <div className="cinematic-line" style={{ top: '30%', zIndex: 2 }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 880 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 20px', borderRadius: 100,
            background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(194,53,122,0.22)',
            fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
            color: 'rgba(13,11,20,0.65)', letterSpacing: '0.13em', marginBottom: 32,
            animation: 'heroFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both, badgeShimmer 4s ease-in-out infinite',
            boxShadow: '0 2px 12px rgba(194,53,122,0.1)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'liveDot 2s ease-in-out infinite' }} />
            LIVE ON SEPOLIA TESTNET · ERC-5484 SOULBOUND
          </div>

          <h1 className="hero-title" style={{ marginBottom: 28, animation: 'heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}>
            On-Chain Reputation,<br />Crystallised Forever
          </h1>

          <p style={{
            fontSize: 17, fontWeight: 400, color: 'rgba(13,11,20,0.7)', lineHeight: 1.78,
            maxWidth: 500, margin: '0 auto 46px',
            animation: 'heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both',
          }}>
            Every vote, loan, and action forges your immutable Soulbound identity.
            Earn trust. Unlock credit. Govern with weight.
          </p>

          <div className="hero-btns" style={{
            display: 'flex', gap: 13, justifyContent: 'center', flexWrap: 'wrap',
            animation: 'heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.3s both',
          }}>
            {mounted && !isConnected ? (
              <div style={{ animation: 'pulseGlow 3s ease-in-out infinite', borderRadius: 13 }}>
                <ConnectButton label="Connect & Begin →" />
              </div>
            ) : (
              <a href="/dashboard" style={{
                padding: '14px 32px', borderRadius: 13,
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
              padding: '14px 32px', borderRadius: 13,
              background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(13,11,20,0.13)',
              color: 'rgba(13,11,20,0.7)', fontSize: 14, fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500, textDecoration: 'none', transition: 'all 0.22s ease',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,92,191,0.38)'; (e.currentTarget as HTMLElement).style.color = '#7c5cbf'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(13,11,20,0.13)'; (e.currentTarget as HTMLElement).style.color = 'rgba(13,11,20,0.7)'; }}
            ><span style={{ fontSize: 13 }}>◈</span> Docs</a>
            <a href="https://github.com/NexTechArchitect/RST-Reputation-Protocol" target="_blank" rel="noopener noreferrer" style={{
              padding: '14px 22px', borderRadius: 13,
              background: 'rgba(13,11,20,0.06)', border: '1px solid rgba(13,11,20,0.12)',
              color: 'rgba(13,11,20,0.6)', fontSize: 14, fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500, textDecoration: 'none', transition: 'all 0.22s ease',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(124,92,191,0.1)'; el.style.borderColor = 'rgba(124,92,191,0.3)'; el.style.color = '#7c5cbf'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(13,11,20,0.06)'; el.style.borderColor = 'rgba(13,11,20,0.12)'; el.style.color = 'rgba(13,11,20,0.6)'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              Source Code
            </a>
          </div>

          <div className="stats-row" style={{
            display: 'flex', gap: 46, justifyContent: 'center', marginTop: 66, paddingTop: 32,
            borderTop: '1px solid rgba(13,11,20,0.09)',
            animation: 'heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.42s both',
          }}>
            {[{ v: 'ERC-5484', l: 'Standard' }, { v: '5 Levels', l: 'Score Tiers' }, { v: 'On-Chain', l: 'SVG Medals' }, { v: 'Sepolia', l: 'Network' }].map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: '#0d0b14', letterSpacing: '-0.01em' }}>{s.v}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.48)', marginTop: 5, letterSpacing: '0.12em' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          position: 'absolute', bottom: 32, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          animation: 'scrollHint 2.2s ease-in-out infinite',
        }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(13,11,20,0.35)', letterSpacing: '0.22em' }}>SCROLL</div>
          <div style={{ width: 1, height: 28, background: 'linear-gradient(to bottom, rgba(124,92,191,0.55), transparent)' }} />
        </div>
      </section>

      {/* ══════════ TIERS ══════════ */}
      <section id="tiers" className="section-pad" style={{ position: 'relative', zIndex: 1, padding: '108px 32px', overflow: 'hidden' }}>
        <div id="tiers-hdr" data-reveal style={{ textAlign: 'center', marginBottom: 68, ...rv('tiers-hdr') }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, color: '#6d44b8', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 18 }}>
            ◆ &nbsp;REPUTATION LADDER&nbsp; ◆
          </div>
          {/* ── STYLED "Five crystals of trust" heading ── */}
          <h2 className="heading-shimmer">Five crystals of trust</h2>
          <p style={{ fontSize: 16, fontWeight: 400, color: 'rgba(13,11,20,0.62)', marginTop: 18, maxWidth: 360, margin: '18px auto 0', lineHeight: 1.75 }}>
            Your score determines your tier. Your tier determines your protocol power.
          </p>
        </div>

        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div id="tier-showcase" data-reveal style={{ ...rv('tier-showcase'), marginBottom: 28 }}>
            {/* ── TIER SHOWCASE with dramatic slowmo morph ── */}
            <div
              className={tierMorphing ? 'tier-morphing-out' : 'tier-morphing-in'}
              style={{
                position: 'relative', borderRadius: 26, overflow: 'hidden',
                background: 'rgba(255,255,255,0.85)', border: `1.5px solid ${TIERS[activeTier].c}30`,
                boxShadow: `0 28px 70px ${TIERS[activeTier].g}, 0 4px 18px rgba(0,0,0,0.04)`,
                padding: '48px 52px',
                display: 'flex', alignItems: 'center', gap: 52,
                transition: `box-shadow 1.2s ease, border-color 1.2s ease`,
              }}
            >
              {/* Animated aurora top strip */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                backgroundImage: `linear-gradient(90deg, ${TIERS[activeTier].c}, ${TIERS[activeTier].c}40, ${TIERS[activeTier].c})`,
                borderRadius: '26px 26px 0 0',
                backgroundSize: '200% 100%',
                animation: 'auroraShift 3s ease infinite',
                transition: 'background-image 1.5s ease',
              }} />
              {/* Halo pulse behind icon */}
              <div style={{ position: 'absolute', left: 50, width: 115, height: 115, borderRadius: 26, background: `${TIERS[activeTier].c}12`, animation: 'halorRing 2.8s ease-out infinite', pointerEvents: 'none' }} />

              <div style={{
                width: 115, height: 115, borderRadius: 26, flexShrink: 0,
                background: `radial-gradient(circle at 33% 28%, rgba(255,255,255,0.96) 0%, ${TIERS[activeTier].c}28 40%, ${TIERS[activeTier].c}65 100%)`,
                border: `2px solid ${TIERS[activeTier].c}30`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 50, boxShadow: `0 10px 35px ${TIERS[activeTier].g}`, animation: 'tierFloat 6s ease-in-out infinite',
                position: 'relative', zIndex: 1,
                transition: 'background 1.5s ease, box-shadow 1.5s ease',
              }}>{TIERS[activeTier].icon}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(13,11,20,0.42)', letterSpacing: '0.16em', marginBottom: 8 }}>TIER {activeTier + 1} OF 5</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 'clamp(26px,5vw,42px)', color: TIERS[activeTier].c, letterSpacing: '-0.025em', marginBottom: 5, lineHeight: 1, transition: 'color 1.2s ease' }}>{TIERS[activeTier].name}</h3>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(13,11,20,0.5)', marginBottom: 16, letterSpacing: '0.06em' }}>SCORE {TIERS[activeTier].range}</div>
                <p style={{ fontSize: 15, fontWeight: 400, color: 'rgba(13,11,20,0.65)', lineHeight: 1.68, marginBottom: 26, maxWidth: 320 }}>
                  {TIERS[activeTier].desc}. Reach this tier by accumulating on-chain reputation actions.
                </p>
                {/* Animated progress bar */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.4)', letterSpacing: '0.1em' }}>SCORE PROGRESS</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: TIERS[activeTier].c, fontWeight: 600 }}>{TIERS[activeTier].pct}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 100, background: 'rgba(13,11,20,0.07)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 100,
                      background: `linear-gradient(90deg, ${TIERS[activeTier].c}80, ${TIERS[activeTier].c})`,
                      width: `${TIERS[activeTier].pct}%`,
                      transition: 'width 1.4s cubic-bezier(0.16,1,0.3,1), background 1.2s ease',
                      boxShadow: `0 0 8px ${TIERS[activeTier].c}60`,
                    }} />
                  </div>
                </div>
                <div className="tier-stat-pills" style={{ display: 'flex', gap: 11 }}>
                  {[{ l: 'Voting Power', v: TIERS[activeTier].voting }, { l: 'Loan Access', v: TIERS[activeTier].loan }].map(s => (
                    <div key={s.l} style={{ padding: '11px 20px', borderRadius: 13, background: `${TIERS[activeTier].c}10`, border: `1.5px solid ${TIERS[activeTier].c}28`, textAlign: 'center', minWidth: 100, transition: 'background 1.2s ease, border-color 1.2s ease' }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: 'rgba(13,11,20,0.48)', letterSpacing: '0.1em', marginBottom: 5 }}>{s.l}</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 24, color: TIERS[activeTier].c, transition: 'color 1.2s ease' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="tier-sidebar-arc" style={{ flexShrink: 0 }}>
                <svg width={100} height={100} viewBox="0 0 100 100">
                  <circle cx={50} cy={50} r={42} fill="none" stroke="rgba(13,11,20,0.07)" strokeWidth={7} />
                  <circle cx={50} cy={50} r={42} fill="none" stroke={TIERS[activeTier].c} strokeWidth={7} strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`} strokeDashoffset={`${2 * Math.PI * 42 * (1 - TIERS[activeTier].pct / 100)}`}
                    transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1), stroke 1.2s ease' }} />
                  <text x={50} y={46} textAnchor="middle" fontSize={18} fontWeight={700} fontFamily="'Playfair Display', serif" fill={TIERS[activeTier].c}>{TIERS[activeTier].pct}%</text>
                  <text x={50} y={61} textAnchor="middle" fontSize={8} fontFamily="'JetBrains Mono', monospace" fill="rgba(13,11,20,0.42)">max score</text>
                </svg>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
            {TIERS.map((t, i) => (
              <button key={t.name} className="tier-pill" onClick={() => handleTierClick(i)}
                onMouseEnter={() => setHoveredTier(i)} onMouseLeave={() => setHoveredTier(null)}
                style={{
                  padding: '9px 20px', borderRadius: 100,
                  background: activeTier === i ? `${t.c}15` : (hoveredTier === i ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.72)'),
                  border: `1.5px solid ${activeTier === i ? t.c + '50' : 'rgba(13,11,20,0.1)'}`,
                  color: activeTier === i ? t.c : 'rgba(13,11,20,0.6)',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: activeTier === i ? 700 : 500,
                  cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', gap: 7,
                  transform: activeTier === i ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: activeTier === i ? `0 5px 18px ${t.g}` : 'none',
                  transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1)',
                }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>{t.name}
              </button>
            ))}
          </div>

          <div id="spectrum" data-reveal style={{
            padding: '20px 26px', borderRadius: 18, background: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(13,11,20,0.07)', ...rv('spectrum', 300),
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
              {['0','100','300','600','850','1000'].map(n => (
                <span key={n} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.5)' }}>{n}</span>
              ))}
            </div>
            <div style={{ height: 6, borderRadius: 100, background: 'linear-gradient(90deg, #94a3b8 0%, #94a3b8 10%, #c2773a 10%, #c2773a 30%, #8b9eb7 30%, #8b9eb7 60%, #c9933a 60%, #c9933a 85%, #7c5cbf 85%, #7c5cbf 100%)' }} />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.35)', marginTop: 9, textAlign: 'center', letterSpacing: '0.12em' }}>
              SCORE RANGE 0 → 1000 · AUTO-CLAMPED · ERC-5484 SOULBOUND TOKEN
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ ACTIONS — FULL CINEMATIC REDESIGN ══════════ */}
      <section id="actions" style={{ position: 'relative', zIndex: 1, overflow: 'hidden' }}>

        {/* Section background */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 70% 55% at 5% 15%, rgba(253,220,245,0.62) 0%, transparent 55%),
            radial-gradient(ellipse 55% 48% at 95% 10%, rgba(218,210,252,0.52) 0%, transparent 52%),
            radial-gradient(ellipse 45% 40% at 50% 90%, rgba(254,240,195,0.45) 0%, transparent 55%),
            rgba(253,251,255,0.7)
          `,
        }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(124,92,191,0.045) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }} />
        {/* Floating orbs */}
        <div style={{ position: 'absolute', top: '6%', left: '1%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,108,246,0.12) 0%, transparent 65%)', pointerEvents: 'none', animation: 'floatOrb1 8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '50%', right: '-4%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 60%)', pointerEvents: 'none', animation: 'floatOrb2 10s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '8%', left: '30%', width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 60%)', pointerEvents: 'none', animation: 'floatOrb3 7s ease-in-out infinite' }} />

        <div className="actions-section-inner" style={{ maxWidth: 1080, margin: '0 auto', position: 'relative', zIndex: 1, padding: '108px 32px' }}>

          {/* ── CINEMATIC HEADER ── */}
          <div id="actions-hdr" data-reveal style={{ marginBottom: 80, ...rv('actions-hdr') }}>
            <div className="actions-light-hero" style={{
              position: 'relative', borderRadius: 32, overflow: 'hidden',
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(32px) saturate(1.8)',
              WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
              border: '1.5px solid rgba(255,255,255,0.9)',
              boxShadow: '0 32px 80px rgba(124,58,237,0.1), 0 8px 32px rgba(194,53,122,0.08), inset 0 1px 0 rgba(255,255,255,0.95)',
              padding: '56px 60px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 48,
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '32px 32px 0 0',
                background: 'linear-gradient(90deg, #fce7f3, #c2357a, #7c3aed, #3b6cf6, #10b981, #c9933a, #fce7f3)',
                backgroundSize: '300% 100%', animation: 'auroraShift 5s ease infinite',
              }} />
              <div style={{ position: 'relative', zIndex: 2, flex: '1 1 320px', minWidth: 260 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 22, padding: '6px 16px', borderRadius: 100, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 8px rgba(124,58,237,0.7)', animation: 'liveDot 2s ease-in-out infinite', flexShrink: 0 }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 600, color: '#7c3aed', letterSpacing: '0.22em' }}>SCORE ENGINE</span>
                </div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 'clamp(30px, 4.5vw, 58px)', letterSpacing: '-0.03em', lineHeight: 1.0, marginBottom: 0, color: '#0d0b14' }}>Actions shape</h2>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 'clamp(30px, 4.5vw, 58px)', letterSpacing: '-0.03em', lineHeight: 1.08, marginBottom: 26, background: 'linear-gradient(130deg, #3b0764 0%, #7c3aed 38%, #c2357a 70%, #c9933a 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', backgroundSize: '220% auto', animation: 'shimmerTitle 4s linear infinite' }}>your crystal</h2>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontStyle: 'italic', fontSize: 14.5, fontWeight: 300, color: 'rgba(13,11,20,0.55)', lineHeight: 1.85, maxWidth: 340, marginBottom: 32, borderLeft: '2px solid rgba(124,58,237,0.22)', paddingLeft: 16 }}>
                  Every interaction is <span style={{ fontWeight: 600, fontStyle: 'normal', color: '#7c3aed' }}>permanently etched</span> on-chain.
                  No rollback. No forgiveness. No reset.
                  <br /><span style={{ fontWeight: 600, fontStyle: 'normal', color: '#c2357a' }}>Build trust</span> — or watch it burn.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { v: '7', l: 'Total Actions', c: '#7c3aed', bg: 'rgba(124,58,237,0.07)', bc: 'rgba(124,58,237,0.18)' },
                    { v: '1000', l: 'Max Score',    c: '#c2357a', bg: 'rgba(194,53,122,0.07)', bc: 'rgba(194,53,122,0.18)' },
                    { v: '∞',   l: 'Permanent',    c: '#c9933a', bg: 'rgba(201,147,58,0.07)', bc: 'rgba(201,147,58,0.18)' },
                  ].map(s => (
                    <div key={s.l} style={{ padding: '11px 20px', borderRadius: 13, background: s.bg, border: `1.5px solid ${s.bc}`, textAlign: 'center', minWidth: 80, backdropFilter: 'blur(8px)' }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 22, color: s.c, lineHeight: 1 }}>{s.v}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(13,11,20,0.42)', letterSpacing: '0.1em', marginTop: 5 }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="actions-score-viz" style={{ position: 'relative', width: 270, height: 270, flexShrink: 0, zIndex: 2 }}>
                <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, rgba(194,53,122,0.06) 45%, transparent 65%)', animation: 'orbF1 6s ease-in-out infinite' }} />
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox="0 0 270 270">
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
                  <circle cx="135" cy="135" r="122" fill="none" stroke="rgba(124,58,237,0.09)" strokeWidth="1.5" strokeDasharray="6 10"/>
                  <circle cx="135" cy="135" r="100" fill="none" stroke="rgba(194,53,122,0.07)" strokeWidth="1" strokeDasharray="3 8"/>
                  <circle cx="135" cy="135" r="76" fill="none" stroke="rgba(201,147,58,0.08)" strokeWidth="1"/>
                  <circle cx="135" cy="135" r="122" fill="none" stroke="url(#larcGrad)" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 122 * 0.78} ${2 * Math.PI * 122 * 0.22}`}
                    transform="rotate(-90 135 135)" opacity="0.9"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(124,58,237,0.35))' }}/>
                  <circle cx="135" cy="135" r="100" fill="none" stroke="url(#larcGrad2)" strokeWidth="2" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 100 * 0.55} ${2 * Math.PI * 100 * 0.45}`}
                    transform="rotate(45 135 135)" opacity="0.6"/>
                  <circle cx={135 + 122 * Math.cos(2 * Math.PI * 0.78 - Math.PI / 2)} cy={135 + 122 * Math.sin(2 * Math.PI * 0.78 - Math.PI / 2)} r="5" fill="#c2357a" opacity="0.9" style={{ filter: 'drop-shadow(0 0 8px rgba(194,53,122,0.7))' }}/>
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 88, lineHeight: 1, background: 'linear-gradient(135deg, #7c3aed, #c2357a, #c9933a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', backgroundSize: '200% auto', animation: 'crystalFloat 6s ease-in-out infinite' }}>◆</div>
                <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.42)', letterSpacing: '0.18em', whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.8)', padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(124,58,237,0.12)' }}>REPUTATION SCORE</div>
              </div>
            </div>
          </div>

          {/* ══ CINEMATIC ACTIONS GRID ══ */}
          <div className="actions-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: '0 36px' }}>

            {/* ══ LEFT: REPUTATION GAINS — Card Grid ══ */}
            <div>
              {/* Section label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '10px 22px', borderRadius: 100,
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(13,150,96,0.06) 100%)',
                  border: '1.5px solid rgba(16,185,129,0.3)',
                  boxShadow: '0 4px 20px rgba(16,185,129,0.12)',
                  animation: 'greenGlow 3s ease-in-out infinite',
                }}>
                  <span style={{ fontSize: 16, animation: 'dotBounce 1.8s ease-in-out infinite' }}>▲</span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 800, color: '#0d9660', letterSpacing: '0.18em' }}>REPUTATION GAINS</span>
                </div>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(16,185,129,0.3), transparent)' }} />
              </div>

              {/* ── 2-column card grid ── */}
              <div className="gains-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {ACTIONS.filter(a => a.pos).map((a, i) => (
                  <div
                    key={a.name}
                    id={`act${i}`}
                    data-reveal
                    className="action-card-cine"
                    onMouseEnter={() => setHoveredAction(i)}
                    onMouseLeave={() => setHoveredAction(null)}
                    style={{
                      position: 'relative',
                      borderRadius: 20,
                      padding: '22px 20px 20px',
                      background: hoveredAction === i
                        ? `linear-gradient(145deg, rgba(255,255,255,0.97) 0%, ${a.c}10 100%)`
                        : `linear-gradient(145deg, rgba(255,255,255,0.88) 0%, ${a.c}06 100%)`,
                      border: `1.5px solid ${hoveredAction === i ? a.c + '45' : a.c + '1a'}`,
                      boxShadow: hoveredAction === i
                        ? `0 16px 48px ${a.c}20, 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)`
                        : `0 4px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)`,
                      backdropFilter: 'blur(16px)',
                      cursor: 'default',
                      transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
                      transform: hoveredAction === i ? 'translateY(-4px) scale(1.01)' : 'translateY(0) scale(1)',
                      animation: `actionCardIn 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 80}ms both`,
                      overflow: 'hidden',
                      // last item spans full width if odd count
                      gridColumn: i === 4 ? '1 / -1' : 'auto',
                      ...rv(`act${i}`, i * 60),
                    }}
                  >
                    {/* Top accent bar */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, borderRadius: '20px 20px 0 0',
                      background: `linear-gradient(90deg, transparent, ${a.c}, transparent)`,
                      opacity: hoveredAction === i ? 1 : 0.5,
                      transition: 'opacity 0.4s ease',
                    }} />
                    {/* Corner radial glow */}
                    <div style={{
                      position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%',
                      background: `radial-gradient(circle, ${a.c}20 0%, transparent 70%)`,
                      opacity: hoveredAction === i ? 1 : 0.5,
                      transition: 'opacity 0.4s ease',
                      pointerEvents: 'none',
                    }} />
                    {/* Halo ring behind icon */}
                    {hoveredAction === i && (
                      <div style={{
                        position: 'absolute', top: 18, left: 16, width: 44, height: 44, borderRadius: 14,
                        background: `${a.c}15`,
                        animation: 'halorRing 1.8s ease-out infinite',
                        pointerEvents: 'none',
                      }} />
                    )}

                    {/* Top row: icon + delta */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                        background: `${a.c}14`,
                        border: `1.5px solid ${a.c}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22,
                        color: a.c,
                        transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
                        transform: hoveredAction === i ? 'scale(1.15) rotate(8deg)' : 'scale(1)',
                        boxShadow: hoveredAction === i ? `0 6px 20px ${a.c}35` : 'none',
                        position: 'relative', zIndex: 1,
                      }}>{a.icon}</div>

                      {/* Score delta — big, glowing */}
                      <div style={{
                        fontFamily: "'Playfair Display', serif",
                        fontWeight: 900,
                        fontSize: 32,
                        color: '#0d9660',
                        lineHeight: 1,
                        letterSpacing: '-0.02em',
                        textShadow: hoveredAction === i ? `0 0 24px rgba(13,150,96,0.5), 0 0 48px rgba(13,150,96,0.25)` : 'none',
                        transition: 'text-shadow 0.4s ease',
                        animation: hoveredAction === i ? 'deltaFloat 2s ease-in-out infinite' : 'none',
                      }}>{a.delta}</div>
                    </div>

                    {/* Name */}
                    <div style={{
                      fontFamily: "'Syne', sans-serif",
                      fontSize: 14, fontWeight: 700,
                      color: '#0d0b14',
                      marginBottom: 6,
                      letterSpacing: '-0.01em',
                    }}>{a.name}</div>

                    {/* Function + cooldown */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9.5, color: a.c, opacity: 0.9, fontWeight: 500,
                        background: `${a.c}0d`, padding: '2px 8px', borderRadius: 6,
                        border: `1px solid ${a.c}20`,
                      }}>{a.fn}</span>
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(13,11,20,0.18)', flexShrink: 0 }} />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.4)' }}>{a.cd}</span>
                    </div>

                    {/* Animated score bar */}
                    <div style={{ height: 3, borderRadius: 100, background: 'rgba(13,11,20,0.06)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 100,
                        background: `linear-gradient(90deg, ${a.c}70, ${a.c})`,
                        width: hoveredAction === i
                          ? `${Math.min(100, (parseInt(a.delta) / 30) * 100)}%`
                          : `${Math.min(100, (parseInt(a.delta) / 30) * 55)}%`,
                        transition: 'width 0.65s cubic-bezier(0.16,1,0.3,1)',
                        boxShadow: `0 0 6px ${a.c}50`,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="actions-divider-v" style={{
              background: 'linear-gradient(to bottom, transparent, rgba(13,11,20,0.08) 20%, rgba(13,11,20,0.08) 80%, transparent)',
              borderRadius: 2,
            }} />

            {/* ══ RIGHT: REPUTATION PENALTIES — Dramatic Full Cards ══ */}
            <div>
              {/* Section label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '10px 22px', borderRadius: 100,
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.05) 100%)',
                  border: '1.5px solid rgba(239,68,68,0.28)',
                  boxShadow: '0 4px 20px rgba(239,68,68,0.1)',
                  animation: 'warningPulse 3s ease-in-out infinite',
                }}>
                  <span style={{ fontSize: 16, color: '#ef4444', animation: 'dotBounce 2.2s ease-in-out infinite' }}>▼</span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 800, color: '#ef4444', letterSpacing: '0.18em' }}>REPUTATION PENALTIES</span>
                </div>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(239,68,68,0.3), transparent)' }} />
              </div>

              {/* Penalty cards — full width, more dramatic */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {ACTIONS.filter(a => !a.pos).map((a, i) => (
                  <div
                    key={a.name}
                    id={`actn${i}`}
                    data-reveal
                    className="penalty-card-cine"
                    onMouseEnter={() => setHoveredAction(10 + i)}
                    onMouseLeave={() => setHoveredAction(null)}
                    style={{
                      position: 'relative',
                      borderRadius: 20,
                      padding: '26px 24px',
                      background: hoveredAction === 10 + i
                        ? `linear-gradient(145deg, rgba(255,255,255,0.97) 0%, ${a.c}10 100%)`
                        : `linear-gradient(145deg, rgba(255,255,255,0.88) 0%, ${a.c}07 100%)`,
                      border: `1.5px solid ${hoveredAction === 10 + i ? a.c + '50' : a.c + '22'}`,
                      boxShadow: hoveredAction === 10 + i
                        ? `0 20px 56px ${a.c}22, 0 4px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)`
                        : `0 6px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)`,
                      backdropFilter: 'blur(16px)',
                      cursor: 'default',
                      transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
                      transform: hoveredAction === 10 + i ? 'translateY(-4px) scale(1.008)' : 'translateY(0) scale(1)',
                      animation: `penaltyCardIn 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 100}ms both`,
                      overflow: 'hidden',
                      ...rv(`actn${i}`, i * 80 + 150),
                    }}
                  >
                    {/* Top accent bar — gradient danger */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '20px 20px 0 0',
                      background: `linear-gradient(90deg, transparent, ${a.c}ee, ${a.c}aa, transparent)`,
                      opacity: hoveredAction === 10 + i ? 1 : 0.6,
                      transition: 'opacity 0.4s ease',
                    }} />
                    {/* Bottom corner radial glow */}
                    <div style={{
                      position: 'absolute', bottom: -30, right: -30, width: 160, height: 160, borderRadius: '50%',
                      background: `radial-gradient(circle, ${a.c}18 0%, transparent 70%)`,
                      opacity: hoveredAction === 10 + i ? 1 : 0.5,
                      transition: 'opacity 0.4s ease',
                      pointerEvents: 'none',
                    }} />
                    {/* Large bg number */}
                    <div style={{
                      position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)',
                      fontFamily: "'Playfair Display', serif", fontWeight: 900,
                      fontSize: 110, color: `${a.c}08`, lineHeight: 1,
                      pointerEvents: 'none', userSelect: 'none',
                    }}>{a.delta}</div>

                    {/* Content row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative', zIndex: 1 }}>
                      {/* Icon with pulsing ring */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {hoveredAction === 10 + i && (
                          <div style={{
                            position: 'absolute', inset: -6, borderRadius: 20,
                            border: `1.5px solid ${a.c}60`,
                            animation: 'halorRing 1.6s ease-out infinite',
                            pointerEvents: 'none',
                          }} />
                        )}
                        <div style={{
                          width: 56, height: 56, borderRadius: 18, flexShrink: 0,
                          background: `linear-gradient(145deg, ${a.c}18, ${a.c}0a)`,
                          border: `2px solid ${a.c}${hoveredAction === 10 + i ? '55' : '28'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 26, color: a.c,
                          transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
                          animation: hoveredAction === 10 + i ? 'penaltyShake 0.9s ease-in-out' : 'none',
                          boxShadow: hoveredAction === 10 + i ? `0 8px 28px ${a.c}30` : `0 4px 12px ${a.c}15`,
                        }}>{a.icon}</div>
                      </div>

                      {/* Text block */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: "'Syne', sans-serif",
                          fontSize: 16, fontWeight: 800,
                          color: '#0d0b14', marginBottom: 7,
                          letterSpacing: '-0.01em',
                        }}>{a.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10, color: a.c, fontWeight: 500,
                            background: `${a.c}0e`, padding: '3px 10px', borderRadius: 7,
                            border: `1px solid ${a.c}25`,
                          }}>{a.fn}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: 'rgba(13,11,20,0.4)' }}>{a.cd}</span>
                        </div>
                        {/* Penalty bar */}
                        <div style={{ height: 3.5, borderRadius: 100, background: 'rgba(13,11,20,0.07)', overflow: 'hidden', maxWidth: 200 }}>
                          <div style={{
                            height: '100%', borderRadius: 100,
                            background: `linear-gradient(90deg, ${a.c}80, ${a.c})`,
                            width: hoveredAction === 10 + i
                              ? `${Math.min(100, (Math.abs(parseInt(a.delta)) / 50) * 100)}%`
                              : `${Math.min(100, (Math.abs(parseInt(a.delta)) / 50) * 45)}%`,
                            transition: 'width 0.65s cubic-bezier(0.16,1,0.3,1)',
                            boxShadow: `0 0 8px ${a.c}60`,
                          }} />
                        </div>
                      </div>

                      {/* Score delta — huge, dramatic */}
                      <div style={{
                        fontFamily: "'Playfair Display', serif",
                        fontWeight: 900,
                        fontSize: 44,
                        color: a.c,
                        lineHeight: 1,
                        letterSpacing: '-0.03em',
                        flexShrink: 0,
                        textShadow: hoveredAction === 10 + i
                          ? `0 0 28px ${a.c}60, 0 0 55px ${a.c}30`
                          : 'none',
                        transition: 'text-shadow 0.4s ease',
                        animation: hoveredAction === 10 + i ? 'deltaFloat 1.8s ease-in-out infinite' : 'none',
                      }}>{a.delta}</div>
                    </div>
                  </div>
                ))}

                {/* ── "NO RESET" Banner — cinematic warning ── */}
                <div style={{
                  position: 'relative', borderRadius: 20, overflow: 'hidden',
                  padding: '22px 24px',
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.82) 0%, rgba(239,68,68,0.05) 100%)',
                  border: '1.5px solid rgba(239,68,68,0.22)',
                  boxShadow: '0 8px 28px rgba(239,68,68,0.08)',
                  backdropFilter: 'blur(16px)',
                }}>
                  {/* Animated top strip */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, borderRadius: '20px 20px 0 0',
                    background: 'linear-gradient(90deg, #ef4444, #f97316, #ef4444)',
                    backgroundSize: '200% 100%',
                    animation: 'auroraShift 3s ease infinite',
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Warning icon */}
                    <div style={{
                      width: 48, height: 48, borderRadius: 15, flexShrink: 0,
                      background: 'linear-gradient(145deg, rgba(239,68,68,0.14), rgba(239,68,68,0.06))',
                      border: '1.5px solid rgba(239,68,68,0.28)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22,
                      boxShadow: '0 4px 16px rgba(239,68,68,0.12)',
                      animation: 'warningPulse 2.5s ease-in-out infinite',
                    }}>⚠</div>
                    <div>
                      <div style={{
                        fontFamily: "'Syne', sans-serif", fontSize: 11.5, fontWeight: 800,
                        color: '#ef4444', letterSpacing: '0.14em', marginBottom: 6,
                        textTransform: 'uppercase',
                      }}>Permanent · No Reset · No Forgiveness</div>
                      <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(13,11,20,0.58)', lineHeight: 1.65 }}>
                        Penalties are applied on-chain and cannot be undone.<br />
                        Your reputation is your most valuable on-chain asset.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ ARCHITECTURE ══════════ */}
      <section id="architecture" style={{ position: 'relative', zIndex: 1, overflow: 'hidden', padding: '108px 32px' }}>
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: `linear-gradient(rgba(124,92,191,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(124,92,191,0.03) 1px, transparent 1px)`,
          backgroundSize: '56px 56px',
        }} />

        <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div id="arch-hdr" data-reveal style={{ textAlign: 'center', marginBottom: 72, ...rv('arch-hdr') }}>
            <h2 className="heading-shimmer" style={{ marginBottom: 18 }}>Three contracts,<br />one identity</h2>
            <p style={{ fontSize: 16, fontWeight: 400, color: 'rgba(13,11,20,0.6)', maxWidth: 360, margin: '0 auto', lineHeight: 1.75 }}>
              Token is immutable. Engine evolves. Vault is your gateway.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, padding: '0 20px' }}>
            {CONTRACTS.map((c, i) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ flex: 1, height: 1, background: i === 0 ? 'transparent' : `linear-gradient(90deg, ${CONTRACTS[i-1].c}40, ${c.c}40)` }} />
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: `rgba(255,255,255,0.9)`, border: `1.5px solid ${c.c}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: c.c,
                  boxShadow: `0 0 16px ${c.c}20`, animation: `contractGlow ${2 + i}s ease-in-out infinite`,
                }}>{c.num}</div>
                <div style={{ flex: 1, height: 1, background: i === CONTRACTS.length - 1 ? 'transparent' : `linear-gradient(90deg, ${c.c}40, ${CONTRACTS[i+1]?.c}40)` }} />
              </div>
            ))}
          </div>

          <div className="contracts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {CONTRACTS.map((c, i) => (
              <div key={c.name} id={`con${i}`} data-reveal className="contract-card"
                onMouseEnter={() => setHoveredContract(i)} onMouseLeave={() => setHoveredContract(null)}
                style={{
                  borderRadius: 22, overflow: 'hidden', position: 'relative',
                  background: 'rgba(255,255,255,0.88)',
                  border: `1.5px solid ${c.c}22`,
                  boxShadow: hoveredContract === i ? `0 24px 60px ${c.c}18, 0 0 0 1px ${c.c}28` : `0 6px 24px rgba(13,11,20,0.07), 0 0 0 1px ${c.c}12`,
                  ...rv(`con${i}`, i * 100),
                }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${c.c}, transparent)`, opacity: hoveredContract === i ? 1 : 0.5, transition: 'opacity 0.35s ease' }} />
                <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${c.c}10 0%, transparent 65%)`, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -18, right: 0, fontFamily: "'Playfair Display', serif", fontSize: 100, fontWeight: 900, color: `${c.c}08`, lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>{c.num}</div>
                <div className="contract-card-inner" style={{ padding: '34px 28px', position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{
                      width: 50, height: 50, borderRadius: 15, background: `${c.c}10`, border: `1.5px solid ${c.c}28`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                      transition: 'transform 0.28s ease', transform: hoveredContract === i ? 'scale(1.08) rotate(-3deg)' : 'none',
                    }}>{c.icon}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 700, color: c.c, letterSpacing: '0.1em', padding: '5px 11px', borderRadius: 8, background: `${c.c}10`, border: `1px solid ${c.c}22` }}>{c.tag}</div>
                  </div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 'clamp(19px, 2.2vw, 24px)', color: '#0d0b14', letterSpacing: '-0.02em', marginBottom: 4, lineHeight: 1.1 }}>{c.name}</h3>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: c.c, opacity: 0.65, padding: '7px 11px', borderRadius: 9, background: `${c.c}08`, border: `1px solid ${c.c}15`, marginBottom: 22, marginTop: 12, letterSpacing: '0.04em' }}>{c.short}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
                    {c.feats.map((f, fi) => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, background: `${c.c}12`, border: `1px solid ${c.c}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: c.c, fontWeight: 600 }}>{fi + 1}</div>
                        <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(13,11,20,0.68)', lineHeight: 1.4 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <a href={c.etherscan} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, background: `${c.c}10`, border: `1px solid ${c.c}25`, fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", color: c.c, textDecoration: 'none', letterSpacing: '0.07em', fontWeight: 500, transition: 'all 0.2s ease' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${c.c}20`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${c.c}10`; }}
                  >View on Etherscan ↗</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section style={{
        position: 'relative', zIndex: 1, padding: '115px 32px', textAlign: 'center', overflow: 'hidden',
        background: 'linear-gradient(150deg, rgba(253,220,245,0.5) 0%, rgba(235,228,252,0.5) 50%, rgba(254,240,195,0.4) 100%)',
        borderTop: '1px solid rgba(124,92,191,0.1)',
      }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 700, height: 700, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,92,191,0.06) 0%, rgba(194,53,122,0.03) 45%, transparent 70%)', pointerEvents: 'none' }} />
        <div id="cta-content" data-reveal style={{ position: 'relative', zIndex: 1, ...rv('cta-content') }}>
          <div style={{ fontSize: 58, marginBottom: 26, display: 'inline-block', animation: 'crystalFloat 6s ease-in-out infinite' }}>◆</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 'clamp(34px, 5.5vw, 64px)', letterSpacing: '-0.03em', color: '#0d0b14', marginBottom: 20, lineHeight: 1.04 }}>
            Start building your<br />
            <span style={{ background: 'linear-gradient(130deg, #7c3aed, #c2357a, #c9933a)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'shimmerTitle 3s linear infinite' }}>reputation today</span>
          </h2>
          <p style={{ fontSize: 17, fontWeight: 400, color: 'rgba(13,11,20,0.65)', maxWidth: 400, margin: '0 auto 42px', lineHeight: 1.78 }}>
            Connect your wallet, take your first action, receive your Soulbound Token automatically — no mint required.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ animation: 'pulseGlow 3s ease-in-out infinite', display: 'inline-block', borderRadius: 13 }}>
              <ConnectButton label="Connect & Begin →" />
            </div>
            <a href="https://github.com/NexTechArchitect/RST-Reputation-Protocol" target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 26px', borderRadius: 13, background: 'rgba(13,11,20,0.06)', border: '1px solid rgba(13,11,20,0.12)', color: 'rgba(13,11,20,0.62)', fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, textDecoration: 'none', transition: 'all 0.22s ease' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(124,92,191,0.1)'; el.style.borderColor = 'rgba(124,92,191,0.28)'; el.style.color = '#7c5cbf'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(13,11,20,0.06)'; el.style.borderColor = 'rgba(13,11,20,0.12)'; el.style.color = 'rgba(13,11,20,0.62)'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              View Source Code
            </a>
          </div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.32)', marginTop: 22, letterSpacing: '0.13em' }}>
            SEPOLIA TESTNET · ERC-5484 · SOULBOUND · NON-TRANSFERABLE
          </p>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{
        position: 'relative', zIndex: 1, padding: '20px 44px',
        borderTop: '1px solid rgba(13,11,20,0.08)', background: 'rgba(253,251,255,0.96)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg, #7c3aed, #c2357a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>◆</div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(13,11,20,0.52)' }}>RST Protocol — ERC-5484</span>
        </div>
        <div className="footer-addrs" style={{ display: 'flex', gap: 28 }}>
          {[{ l: 'Token', a: '0x9c77Ce31...' }, { l: 'Engine', a: '0x4eFC1adc...' }, { l: 'Vault', a: '0xd53320CD...' }].map(c => (
            <div key={c.l}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.32)', letterSpacing: '0.1em' }}>{c.l}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'rgba(13,11,20,0.55)' }}>{c.a}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="https://github.com/NexTechArchitect/RST-Reputation-Protocol" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(13,11,20,0.45)', textDecoration: 'none', transition: 'color 0.2s', letterSpacing: '0.06em' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#7c5cbf'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(13,11,20,0.45)'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(13,11,20,0.38)', letterSpacing: '0.08em' }}>
            Built by NexTech Architect · 2025
          </div>
        </div>
      </footer>
    </>
  );
}