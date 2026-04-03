'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { CONTRACTS } from '@/constants/contracts';

// ─── DATA ────────────────────────────────────────────────────────────────────
const TIERS = [
  { name: 'Unranked', min: 0,   max: 99,   color: '#64748b', bg: 'rgba(100,116,139,0.12)', icon: '◈', pct: 10  },
  { name: 'Bronze',   min: 100, max: 299,  color: '#c2773a', bg: 'rgba(194,119,58,0.12)',  icon: '★', pct: 30  },
  { name: 'Silver',   min: 300, max: 599,  color: '#6b82a8', bg: 'rgba(107,130,168,0.12)', icon: '✦', pct: 60  },
  { name: 'Gold',     min: 600, max: 849,  color: '#c9933a', bg: 'rgba(201,147,58,0.12)',  icon: '♛', pct: 85  },
  { name: 'Platinum', min: 850, max: 1000, color: '#4f46e5', bg: 'rgba(79,70,229,0.12)',   icon: '◆', pct: 100 },
];

const ACTIONS_PENALTY = [
  { icon: '◌', label: 'Loan Default',  delta: '−50', note: 'Owner-only trigger',      color: '#ef4444' },
  { icon: '◇', label: 'Early Settle',  delta: '−20', note: 'Settle before 30 days',   color: '#f97316' },
];

const short = (a: string) => `${a.slice(0,6)}…${a.slice(-4)}`;

function fmtCD(ts: number, now: number): string {
  const rem = Math.max(0, ts - now);
  if (!rem) return 'Ready';
  const h = Math.floor(rem / 3600), m = Math.floor((rem % 3600) / 60), s = rem % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function parseSBTImage(uri: string): string | null {
  try {
    const json = JSON.parse(atob(uri.replace('data:application/json;base64,', '')));
    return json.image ?? null;
  } catch { return null; }
}

function tierPct(score: number, idx: number) {
  const t = TIERS[Math.min(idx, 4)];
  return Math.min(100, Math.max(0, ((score - t.min) / (t.max - t.min + 1)) * 100));
}

// ─── ORB COMPONENT ───────────────────────────────────────────────────────────
interface OrbProps { size: number; x: string; y: string; delay?: number; dur?: number; c1?: string; c2?: string; c3?: string; }
function Orb({ size, x, y, delay = 0, dur = 5, c1 = '#dbeafe', c2 = '#e0e7ff', c3 = '#a5b4fc' }: OrbProps) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 33% 28%, rgba(255,255,255,0.95) 0%, ${c1} 25%, ${c2} 55%, ${c3} 82%, transparent 100%)`,
      animation: `orbF${delay % 4} ${dur}s ease-in-out ${delay * 0.4}s infinite`,
      pointerEvents: 'none',
    }} />
  );
}

// ─── RIBBON LAYER ────────────────────────────────────────────────────────────
function RibbonLayer() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      <defs>
        <linearGradient id="drib1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.7"/>
          <stop offset="45%" stopColor="#e0e7ff" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#ccfbf1" stopOpacity="0.2"/>
        </linearGradient>
        <linearGradient id="drib2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.6"/>
          <stop offset="50%" stopColor="#cffafe" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#e0e7ff" stopOpacity="0.15"/>
        </linearGradient>
        <linearGradient id="drib3" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#d1fae5" stopOpacity="0.45"/>
          <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.25"/>
        </linearGradient>
      </defs>
      <path d="M-100,350 C220,265 490,480 760,365 C1030,250 1230,420 1540,330"
        fill="none" stroke="url(#drib1)" strokeWidth="85" strokeLinecap="round" opacity="0.5">
        <animateTransform attributeName="transform" type="translate" values="0,0; 40,30; -25,10; 0,0" dur="5s" repeatCount="indefinite"/>
      </path>
      <path d="M-100,530 C310,440 590,635 890,520 C1190,405 1360,565 1540,475"
        fill="none" stroke="url(#drib2)" strokeWidth="50" strokeLinecap="round" opacity="0.38">
        <animateTransform attributeName="transform" type="translate" values="0,0; -50,18; 24,-10; 0,0" dur="6.5s" repeatCount="indefinite"/>
      </path>
      <path d="M-100,660 C260,595 580,720 870,630 C1160,540 1310,680 1540,605"
        fill="none" stroke="url(#drib3)" strokeWidth="28" strokeLinecap="round" opacity="0.3">
        <animateTransform attributeName="transform" type="translate" values="0,0; 25,-20; -15,12; 0,0" dur="4.5s" repeatCount="indefinite"/>
      </path>
    </svg>
  );
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
type ToastT = 'success' | 'error' | 'info';
function Toast({ msg, type }: { msg: string; type: ToastT }) {
  const c = { success: '#0d9660', error: '#ef4444', info: '#4f46e5' }[type];
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      maxWidth: 380, padding: '14px 20px',
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(24px)',
      border: `1px solid ${c}30`,
      borderLeft: `3px solid ${c}`,
      borderRadius: 16,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: `0 16px 48px rgba(0,0,0,0.08), 0 4px 16px ${c}15`,
      animation: 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0, boxShadow: `0 0 8px ${c}` }}/>
      <span style={{ fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: 'rgba(13,11,20,0.72)', lineHeight: 1.55 }}>{msg}</span>
    </div>
  );
}

// ─── SCORE RING ───────────────────────────────────────────────────────────────
function ScoreRing({ score, color }: { score: number; color: string }) {
  const R = 46, C = 2 * Math.PI * R;
  return (
    <svg width={112} height={112} viewBox="0 0 112 112">
      <circle cx={56} cy={56} r={R} fill="none" stroke="rgba(13,11,20,0.07)" strokeWidth={7}/>
      <circle cx={56} cy={56} r={R} fill="none" stroke={color} strokeWidth={7}
        strokeLinecap="round" strokeDasharray={C}
        strokeDashoffset={C * (1 - score / 1000)}
        transform="rotate(-90 56 56)"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 6px ${color}50)` }}/>
      <text x={56} y={50} textAnchor="middle" fontSize={24} fontWeight={900}
        fill={color} fontFamily="'Playfair Display', serif">{score}</text>
      <text x={56} y={66} textAnchor="middle" fontSize={9} fill="rgba(13,11,20,0.42)"
        fontFamily="'JetBrains Mono', monospace" letterSpacing="1">/1000</text>
    </svg>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const c = color ?? '#4f46e5';
  return (
    <div style={{
      background: 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(20px)',
      border: `1.5px solid ${c}18`,
      borderRadius: 18,
      padding: '18px 20px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: `0 4px 20px ${c}0a, 0 1px 4px rgba(0,0,0,0.04)`,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, borderRadius: '18px 18px 0 0',
        background: `linear-gradient(90deg, transparent, ${c}80, transparent)`,
      }}/>
      <div style={{ fontSize: 9.5, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(13,11,20,0.42)', letterSpacing: '0.14em', marginBottom: 8, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Playfair Display', serif", color: c, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(13,11,20,0.4)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ─── ACTION CARD ─────────────────────────────────────────────────────────────
interface AProps {
  icon: string; label: string; delta: string; fn: string; cdLabel: string;
  color: string; onCooldown: boolean; nextTime: number; cdSecs: number;
  now: number; loading: boolean; anyLoading: boolean;
  disabled?: boolean; disabledMsg?: string;
  onExec: () => void;
}
function ActionCard({ icon, label, delta, fn, cdLabel, color, onCooldown, nextTime, cdSecs, now, loading, anyLoading, disabled, disabledMsg, onExec }: AProps) {
  const [hov, setHov] = useState(false);
  const isPos = delta.startsWith('+');
  const blocked = anyLoading || onCooldown || disabled;
  const rem = Math.max(0, nextTime - now);
  const pct = cdSecs > 0 && nextTime > 0 ? Math.max(0, 100 - (rem / cdSecs) * 100) : 100;
  const statusLabel = loading ? 'Confirming…' : onCooldown ? fmtCD(nextTime, now) : (disabledMsg ?? cdLabel);
  const deltaColor = isPos ? '#0d9660' : '#ef4444';

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative', borderRadius: 20, padding: '22px 20px 20px',
        background: hov ? `linear-gradient(145deg, rgba(255,255,255,0.97) 0%, ${color}0e 100%)` : `linear-gradient(145deg, rgba(255,255,255,0.88) 0%, ${color}06 100%)`,
        border: `1.5px solid ${hov ? color + '40' : color + '18'}`,
        boxShadow: hov ? `0 16px 48px ${color}18, 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)` : `0 4px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)`,
        backdropFilter: 'blur(16px)',
        opacity: (onCooldown || disabled) ? 0.62 : 1,
        transition: 'all 0.38s cubic-bezier(0.16,1,0.3,1)',
        transform: hov && !blocked ? 'translateY(-3px) scale(1.008)' : 'none',
        overflow: 'hidden',
      }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, borderRadius: '20px 20px 0 0',
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        opacity: hov ? 1 : 0.45, transition: 'opacity 0.4s ease',
      }}/>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '35%', height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
        transform: hov ? 'translateX(350%) skewX(-15deg)' : 'translateX(-120%) skewX(-15deg)',
        transition: hov ? 'transform 0.6s ease' : 'none',
        pointerEvents: 'none', zIndex: 10,
      }}/>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
        opacity: hov ? 1 : 0.4, transition: 'opacity 0.4s ease', pointerEvents: 'none',
      }}/>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: `${color}14`, border: `1.5px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color,
            transform: hov ? 'scale(1.12) rotate(7deg)' : 'none',
            boxShadow: hov ? `0 6px 20px ${color}30` : 'none',
            transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
          }}>{icon}</div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: '#0d0b14', marginBottom: 3, letterSpacing: '-0.01em' }}>{label}</div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color, background: `${color}0d`, padding: '2px 7px', borderRadius: 6, border: `1px solid ${color}20` }}>{fn}()</span>
          </div>
        </div>
        <div style={{
          fontSize: 30, fontWeight: 900, fontFamily: "'Playfair Display', serif",
          color: deltaColor, lineHeight: 1, letterSpacing: '-0.02em',
          textShadow: hov ? `0 0 24px ${deltaColor}50` : 'none',
          transition: 'text-shadow 0.4s ease',
        }}>{delta}</div>
      </div>

      {cdSecs > 0 && nextTime > 0 && (
        <div style={{ height: 3, background: 'rgba(13,11,20,0.07)', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: rem === 0 ? `linear-gradient(90deg, #0d9660, #10b981)` : `linear-gradient(90deg, ${color}70, ${color})`, borderRadius: 3, transition: 'width 1s linear', boxShadow: `0 0 6px ${color}50` }}/>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(13,11,20,0.42)' }}>
          {onCooldown ? `⏳ ${fmtCD(nextTime, now)}` : statusLabel}
        </span>
        <button
          disabled={blocked}
          onClick={onExec}
          style={{
            padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700,
            fontFamily: "'Syne', sans-serif",
            border: `1.5px solid ${blocked ? 'rgba(13,11,20,0.1)' : color}`,
            background: blocked ? 'rgba(13,11,20,0.04)' : `${color}12`,
            color: blocked ? 'rgba(13,11,20,0.35)' : color,
            cursor: blocked ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.18s ease',
            letterSpacing: '0.04em',
          }}
        >
          {loading && anyLoading
            ? <><span style={{ animation: 'spinR 0.8s linear infinite', display: 'inline-block' }}>◌</span> Wait</>
            : '→ Execute'}
        </button>
      </div>
    </div>
  );
}

// ─── PENALTY CARD ─────────────────────────────────────────────────────────────
// Extracted from Dashboard's .map() to comply with Rules of Hooks
function PenaltyCard({ p }: { p: typeof ACTIONS_PENALTY[number] }) {
  const [ph, setPh] = useState(false);
  return (
    <div
      onMouseEnter={() => setPh(true)} onMouseLeave={() => setPh(false)}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 16,
        padding: '20px 22px', borderRadius: 18, overflow: 'hidden',
        background: ph ? `linear-gradient(145deg, rgba(255,255,255,0.97) 0%, ${p.color}0e 100%)` : `linear-gradient(145deg, rgba(255,255,255,0.88) 0%, ${p.color}07 100%)`,
        border: `1.5px solid ${ph ? p.color + '40' : p.color + '20'}`,
        boxShadow: ph ? `0 14px 40px ${p.color}18` : '0 2px 12px rgba(0,0,0,0.04)',
        transform: ph ? 'translateY(-2px)' : 'none',
        transition: 'all 0.38s cubic-bezier(0.16,1,0.3,1)',
        cursor: 'default',
      }}>
      {/* Accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, borderRadius: '18px 18px 0 0', background: `linear-gradient(90deg, transparent, ${p.color}cc, transparent)`, opacity: ph ? 1 : 0.5, transition: 'opacity 0.3s' }}/>
      {/* Big bg delta */}
      <div style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 90, color: `${p.color}08`, lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>{p.delta}</div>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        {ph && <div style={{ position: 'absolute', inset: -5, borderRadius: 16, border: `1.5px solid ${p.color}55`, animation: 'halorRing 1.6s ease-out infinite', pointerEvents: 'none' }}/>}
        <div style={{
          width: 52, height: 52, borderRadius: 16, flexShrink: 0,
          background: `${p.color}14`, border: `1.5px solid ${p.color}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, color: p.color,
          animation: ph ? 'penaltyShake 0.9s ease-in-out' : 'none',
          boxShadow: ph ? `0 6px 24px ${p.color}28` : 'none',
          transition: 'box-shadow 0.3s',
        }}>{p.icon}</div>
      </div>
      <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: '#0d0b14', marginBottom: 4 }}>{p.label}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(13,11,20,0.45)' }}>{p.note}</div>
      </div>
      <div style={{
        fontFamily: "'Playfair Display', serif", fontSize: 38, fontWeight: 900, color: p.color, letterSpacing: '-0.03em', flexShrink: 0, position: 'relative', zIndex: 1,
        textShadow: ph ? `0 0 24px ${p.color}50` : 'none',
        animation: ph ? 'deltaFloat 1.8s ease-in-out infinite' : 'none',
        transition: 'text-shadow 0.4s ease',
      }}>{p.delta}</div>
    </div>
  );
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [tab, setTab] = useState<'actions' | 'vault' | 'identity'>('actions');
  const [sbtImage, setSbtImage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [pending, setPending] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: ToastT } | null>(null);
  const [loanInput, setLoanInput] = useState('1000');
  const [airdropInput, setAirdropInput] = useState('500');
  const [scrolled, setScrolled] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 45);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // ── CINEMATIC PARTICLE CANVAS ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const pts = Array.from({ length: 70 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 1.1, vy: (Math.random() - 0.5) * 1.1,
      r: Math.random() * 1.6 + 0.4, a: Math.random() * 0.22 + 0.06,
      h: Math.random() > 0.5 ? 240 : 200,
      trail: [] as { x: number; y: number }[],
    }));

    const comets = Array.from({ length: 3 }, (_, i) => ({
      x: -120, y: Math.random() * window.innerHeight * 0.7,
      vx: 12 + Math.random() * 7, vy: (Math.random() - 0.5) * 2,
      len: 80 + Math.random() * 55, h: i % 2 === 0 ? 240 : 180,
      active: false, timer: Math.floor(Math.random() * 280),
    }));

    let raf: number;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 9) p.trail.shift();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        p.trail.forEach((pos, ti) => {
          const ratio = ti / p.trail.length;
          ctx.beginPath(); ctx.arc(pos.x, pos.y, p.r * ratio * 0.65, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.h},55%,65%,${p.a * ratio * 0.3})`; ctx.fill();
        });
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.h},55%,65%,${p.a})`; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 88) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.strokeStyle = `hsla(220,50%,65%,${0.055 * (1 - d / 88)})`; ctx.lineWidth = 0.5; ctx.stroke(); }
      }
      comets.forEach(c => {
        c.timer--;
        if (c.timer <= 0) { c.active = true; c.x = -120; c.y = Math.random() * canvas.height * 0.75; c.vx = 13 + Math.random() * 7; c.vy = (Math.random() - 0.5) * 2; c.timer = 280 + Math.floor(Math.random() * 340); }
        if (!c.active) return;
        c.x += c.vx; c.y += c.vy;
        if (c.x > canvas.width + 200) { c.active = false; return; }
        const grad = ctx.createLinearGradient(c.x - c.len, c.y, c.x, c.y);
        grad.addColorStop(0, `hsla(${c.h},65%,72%,0)`); grad.addColorStop(1, `hsla(${c.h},65%,78%,0.45)`);
        ctx.beginPath(); ctx.moveTo(c.x - c.len, c.y); ctx.lineTo(c.x, c.y); ctx.strokeStyle = grad; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.beginPath(); ctx.arc(c.x, c.y, 2, 0, Math.PI * 2); ctx.fillStyle = `hsla(${c.h},80%,88%,0.8)`; ctx.fill();
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  const showToast = useCallback((msg: string, type: ToastT = 'info') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4500);
  }, []);

  // Contract reads
  const { data: d, refetch } = useReadContracts({
    contracts: address ? [
      { ...CONTRACTS.RST_ENGINE, functionName: 'getScore', args: [address] },
      { ...CONTRACTS.RST_ENGINE, functionName: 'getTier', args: [address] },
      { ...CONTRACTS.RST_ENGINE, functionName: 'getVotingMultiplier', args: [address] },
      { ...CONTRACTS.RST_ENGINE, functionName: 'getLoanLimitBps', args: [address] },
      { ...CONTRACTS.RST_ENGINE, functionName: 'getActionCount', args: [address] },
      { ...CONTRACTS.RST_ENGINE, functionName: 'getLastActionAt', args: [address] },
      { ...CONTRACTS.RST_TOKEN, functionName: 'hasSBT', args: [address] },
      { ...CONTRACTS.RST_TOKEN, functionName: 'tokenOf', args: [address] },
      { ...CONTRACTS.RST_TOKEN, functionName: 'totalSupply' },
      { ...CONTRACTS.RST_VAULT, functionName: 'getNextVoteTime', args: [address] },
      { ...CONTRACTS.RST_VAULT, functionName: 'getNextProposalTime', args: [address] },
      { ...CONTRACTS.RST_VAULT, functionName: 'getNextNftMintTime', args: [address] },
      { ...CONTRACTS.RST_VAULT, functionName: 'getActiveLoan', args: [address] },
      { ...CONTRACTS.RST_VAULT, functionName: 'getAirdropClaimTime', args: [address] },
      { ...CONTRACTS.RST_VAULT, functionName: 'isAirdropHeld', args: [address] },
      { ...CONTRACTS.RST_VAULT, functionName: 'getAirdropAmount', args: [address] },
    ] : [],
  });

  const score        = d?.[0]?.result  ? Number(d[0].result)  : 0;
  const tierIdx      = d?.[1]?.result  ? Number(d[1].result)  : 0;
  const votingMul    = d?.[2]?.result  ? Number(d[2].result)  : 5000;
  const loanBps      = d?.[3]?.result  ? Number(d[3].result)  : 0;
  const actionCount  = d?.[4]?.result  ? Number(d[4].result)  : 0;
  const lastActionAt = d?.[5]?.result  ? Number(d[5].result)  : 0;
  const hasSBT       = Boolean(d?.[6]?.result ?? false);
  const tokenId      = d?.[7]?.result  ? Number(d[7].result)  : 0;
  const totalSupply  = d?.[8]?.result  ? Number(d[8].result)  : 0;
  const nextVote     = d?.[9]?.result  ? Number(d[9].result)  : 0;
  const nextProposal = d?.[10]?.result ? Number(d[10].result) : 0;
  const nextNft      = d?.[11]?.result ? Number(d[11].result) : 0;
  const activeLoan   = d?.[12]?.result ? Number(d[12].result) : 0;
  const airdropTs    = d?.[13]?.result ? Number(d[13].result) : 0;
  const airdropHeld  = Boolean(d?.[14]?.result ?? false);
  const airdropAmt   = d?.[15]?.result ? Number(d[15].result) : 0;

  const tier    = TIERS[Math.min(tierIdx, 4)];
  const pct30d  = airdropTs > 0 ? Math.min(100, Math.max(0, ((now - airdropTs) / 2592000) * 100)) : 0;

  const { data: uriData } = useReadContracts({
    contracts: tokenId > 0 ? [{ ...CONTRACTS.RST_TOKEN, functionName: 'tokenURI', args: [BigInt(tokenId)] }] : [],
  });
  useEffect(() => {
    const uri = uriData?.[0]?.result as string | undefined;
    setSbtImage(uri ? parseSBTImage(uri) : null);
  }, [uriData]);

  const { writeContract, isPending } = useWriteContract();
  const { isLoading: txLoading, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (txSuccess) {
      showToast('Transaction confirmed!', 'success');
      setPending(null); setTxHash(undefined);
      setTimeout(() => refetch(), 2000);
    }
  }, [txSuccess, refetch, showToast]);

  const exec = useCallback((name: string, cfg: Parameters<typeof writeContract>[0]) => {
    setPending(name);
    writeContract(cfg, {
      onSuccess: (h) => setTxHash(h),
      onError: (e) => {
        const msg =
          e.message?.includes('CooldownActive') ? 'Still on cooldown — please wait.' :
          e.message?.includes('AlreadyHasActiveLoan') ? 'You already have an active loan.' :
          e.message?.includes('NoActiveLoan') ? 'No active loan found.' :
          e.message?.includes('AirdropAlreadyClaimed') ? 'Airdrop already claimed.' :
          e.message?.includes('NoAirdropToClaim') ? 'No airdrop to settle.' :
          e.message?.includes('ZeroAmount') ? 'Amount must be > 0.' :
          (e.message?.slice(0, 80) ?? 'Transaction failed.');
        showToast(msg, 'error');
        setPending(null);
      },
    });
  }, [writeContract, showToast]);

  const isLoading   = isPending || txLoading;
  const voteCD      = nextVote > 0 && now < nextVote;
  const proposalCD  = nextProposal > 0 && now < nextProposal;
  const nftCD       = nextNft > 0 && now < nextNft;

  if (!mounted) return null;

  // ─── CSS ─────────────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=JetBrains+Mono:wght@300;400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background: #f6f8ff;
      color: #0d0b14;
      font-family: 'DM Sans', sans-serif;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }
    ::selection { background: rgba(79,70,229,0.15); }
    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-track { background: #f6f8ff; }
    ::-webkit-scrollbar-thumb { background: rgba(79,70,229,0.35); border-radius: 2px; }

    @keyframes orbF0 { 0%,100%{transform:translate(0,0) rotate(0deg)} 33%{transform:translate(18px,-26px) rotate(4deg)} 66%{transform:translate(-10px,14px) rotate(-3deg)} }
    @keyframes orbF1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-22px,28px)} }
    @keyframes orbF2 { 0%,100%{transform:translate(0,0)} 40%{transform:translate(14px,-18px)} 75%{transform:translate(-8px,11px)} }
    @keyframes orbF3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(9px,-20px) scale(1.03)} }

    @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
    @keyframes fadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
    @keyframes spinR   { to{transform:rotate(360deg)} }
    @keyframes liveDot { 0%,100%{transform:scale(1);opacity:0.9} 50%{transform:scale(1.7);opacity:0.4} }
    @keyframes auroraShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
    @keyframes shimmerTitle { 0%{background-position:-220% center} 100%{background-position:220% center} }
    @keyframes pulseGlow { 0%,100%{box-shadow:0 8px 28px rgba(79,70,229,0.25)} 50%{box-shadow:0 14px 44px rgba(79,70,229,0.45)} }
    @keyframes crystalFloat { 0%,100%{transform:translateY(0) rotate(0deg)} 33%{transform:translateY(-8px) rotate(4deg)} 66%{transform:translateY(-3px) rotate(-3deg)} }
    @keyframes halorRing { 0%{transform:scale(0.85);opacity:0.8} 100%{transform:scale(1.7);opacity:0} }
    @keyframes greenGlow { 0%,100%{box-shadow:0 0 0 0 rgba(13,150,96,0.2)} 50%{box-shadow:0 0 0 8px rgba(13,150,96,0)} }
    @keyframes warningPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.25)} 50%{box-shadow:0 0 0 8px rgba(239,68,68,0)} }
    @keyframes dotBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
    @keyframes deltaFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
    @keyframes penaltyShake { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-3deg)} 40%{transform:rotate(3deg)} 60%{transform:rotate(-2deg)} }
    @keyframes contractGlow { 0%,100%{opacity:0.7} 50%{opacity:1} }
    @keyframes barFill { from{width:0%} }
    @keyframes scanLine { 0%{opacity:0;transform:translateY(-100%)} 10%{opacity:1} 90%{opacity:1} 100%{opacity:0;transform:translateY(100%)} }

    .heading-shimmer {
      font-family: 'Playfair Display', serif;
      font-weight: 900;
      background: linear-gradient(130deg, #0d0b14 0%, #1e3a8a 20%, #4f46e5 42%, #0d9660 64%, #c9933a 82%, #0d0b14 100%);
      background-size: 280% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: shimmerTitle 5s linear infinite;
    }

    .nav-root {
      position: fixed; top:0; left:0; right:0; z-index:900;
      padding: 14px 32px;
      display: flex; align-items: center; justify-content: space-between;
      transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
    }
    .nav-root.scrolled {
      background: rgba(246,248,255,0.92);
      backdrop-filter: blur(24px) saturate(1.6);
      border-bottom: 1px solid rgba(79,70,229,0.1);
      padding-top: 11px; padding-bottom: 11px;
    }

    .tab-btn {
      padding: 9px 18px; border-radius: 100px;
      font-size: 12.5px; font-weight: 700; font-family: 'Syne', sans-serif;
      cursor: pointer; border: 1.5px solid transparent;
      transition: all 0.32s cubic-bezier(0.16,1,0.3,1);
      display: flex; align-items: center; gap: 7px; white-space: nowrap;
      letter-spacing: 0.02em;
    }
    .tab-btn.active {
      background: rgba(79,70,229,0.1);
      border-color: rgba(79,70,229,0.35);
      color: #4f46e5;
      box-shadow: 0 4px 16px rgba(79,70,229,0.12);
    }
    .tab-btn:not(.active) {
      background: rgba(255,255,255,0.72);
      border-color: rgba(13,11,20,0.09);
      color: rgba(13,11,20,0.52);
    }
    .tab-btn:not(.active):hover {
      border-color: rgba(79,70,229,0.22);
      color: rgba(13,11,20,0.75);
      background: rgba(255,255,255,0.9);
    }

    .exec-btn {
      padding: 11px 20px; border-radius: 12px;
      font-size: 13px; font-weight: 700; font-family: 'Syne', sans-serif;
      cursor: pointer; border: 1.5px solid;
      display: inline-flex; align-items: center;
      gap: 7px; transition: all 0.18s ease; letter-spacing: 0.03em;
    }
    .exec-btn:disabled { opacity: 0.38; cursor: not-allowed; }
    .exec-btn:not(:disabled):hover { filter: brightness(1.12); transform: translateY(-1px); }

    .input-field {
      background: rgba(255,255,255,0.82);
      backdrop-filter: blur(12px);
      border: 1.5px solid rgba(13,11,20,0.1);
      border-radius: 12px; padding: 11px 15px;
      color: #0d0b14;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px; outline: none; width: 100%;
      transition: border-color 0.2s;
    }
    .input-field:focus { border-color: rgba(79,70,229,0.45); box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }
    .input-field::placeholder { color: rgba(13,11,20,0.35); }

    .section-card {
      background: rgba(255,255,255,0.82);
      backdrop-filter: blur(20px);
      border: 1.5px solid rgba(13,11,20,0.07);
      border-radius: 22px;
      padding: 24px 26px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9);
    }
    .section-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 2.5px;
      border-radius: 22px 22px 0 0;
      background: linear-gradient(90deg, transparent, rgba(79,70,229,0.5), rgba(13,150,96,0.4), rgba(201,147,58,0.4), transparent);
      backgroundSize: '300% 100%';
      animation: auroraShift 6s ease infinite;
    }

    .section-label {
      font-size: 9.5px; font-weight: 800; letter-spacing: 0.18em;
      text-transform: uppercase; color: rgba(13,11,20,0.42);
      font-family: 'JetBrains Mono', monospace; margin-bottom: 18px;
      display: flex; align-items: center; gap: 9px;
    }
    .section-label::before {
      content: ''; display: block; width: 3px; height: 13px;
      border-radius: 2px; background: currentColor; flex-shrink: 0;
    }

    .live-dot { width: 7px; height: 7px; border-radius: 50%; background: #0d9660; animation: liveDot 2s ease-in-out infinite; box-shadow: 0 0 6px #0d9660; flex-shrink: 0; }

    .cinematic-line {
      position: absolute; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(79,70,229,0.4) 30%, rgba(13,150,96,0.5) 50%, rgba(79,70,229,0.4) 70%, transparent 100%);
      animation: scanLine 10s ease-in-out infinite;
    }

    @media (max-width: 860px) {
      .stats-grid { grid-template-columns: 1fr 1fr !important; }
      .actions-grid { grid-template-columns: 1fr !important; }
      .vault-grid { grid-template-columns: 1fr !important; }
      .identity-grid { grid-template-columns: 1fr !important; }
      .hero-row { flex-direction: column !important; align-items: flex-start !important; gap: 20px !important; }
    }
    @media (max-width: 520px) {
      .stats-grid { grid-template-columns: 1fr !important; }
      .nav-root { padding: 12px 16px !important; }
    }
  `;

  return (
    <>
      <style>{css}</style>

      {/* ── PARTICLE CANVAS ── */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.65 }}/>

      {/* ── BG GRADIENT ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 80% 55% at 10% 3%, rgba(219,234,254,0.65) 0%, transparent 55%),
          radial-gradient(ellipse 60% 48% at 88% 10%, rgba(224,231,255,0.55) 0%, transparent 52%),
          radial-gradient(ellipse 48% 40% at 55% 80%, rgba(254,243,199,0.4) 0%, transparent 50%),
          radial-gradient(ellipse 40% 36% at 6% 80%, rgba(209,250,229,0.32) 0%, transparent 46%),
          #f6f8ff
        `,
      }}/>

      {/* ── FLOATING ORBS ── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <Orb size={300} x="64%" y="-5%"  delay={0} dur={5} c1="rgba(199,210,254,0.88)" c2="rgba(165,180,252,0.72)" c3="rgba(79,70,229,0.28)" />
        <Orb size={200} x="-4%" y="7%"   delay={1} dur={4} c1="rgba(186,230,253,0.88)" c2="rgba(147,210,252,0.68)" c3="rgba(14,165,233,0.28)" />
        <Orb size={155} x="58%" y="52%"  delay={2} dur={6} c1="rgba(254,243,199,0.88)" c2="rgba(252,211,77,0.55)"  c3="rgba(201,147,58,0.22)" />
        <Orb size={250} x="5%"  y="58%"  delay={0} dur={5} c1="rgba(209,250,229,0.88)" c2="rgba(110,231,183,0.6)"  c3="rgba(13,150,96,0.22)"  />
        <Orb size={105} x="84%" y="70%"  delay={1} dur={4} c1="rgba(254,226,226,0.88)" c2="rgba(252,165,165,0.6)"  c3="rgba(239,68,68,0.18)"  />
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type}/>}

      {/* ── NAVBAR ── */}
      <nav className={`nav-root${scrolled ? ' scrolled' : ''}`}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #4f46e5, #0d9660)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, boxShadow: '0 4px 16px rgba(79,70,229,0.32)',
          }}>◆</div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 17, color: '#0d0b14', letterSpacing: '0.04em', lineHeight: 1 }}>
              RST<span style={{ color: '#4f46e5' }}>.</span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: 'rgba(13,11,20,0.4)', letterSpacing: '0.22em', marginTop: 1 }}>PROTOCOL</div>
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {isConnected && address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 100, background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(13,11,20,0.08)' }}>
              <span className="live-dot"/>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(13,11,20,0.52)' }}>{short(address)}</span>
            </div>
          )}
          {isConnected && (
            <div style={{
              padding: '5px 12px', borderRadius: 100,
              background: tier.bg, border: `1px solid ${tier.color}30`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 13 }}>{tier.icon}</span>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 10, color: tier.color, fontWeight: 800, letterSpacing: '0.1em' }}>{tier.name.toUpperCase()}</span>
            </div>
          )}
          <ConnectButton showBalance={false} chainStatus="none" accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}/>
        </div>
      </nav>

      {/* ── MAIN ── */}
      <main style={{ position: 'relative', zIndex: 1, padding: '88px 20px 48px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── NOT CONNECTED ── */}
        {!isConnected ? (
          <div style={{ minHeight: '88vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 0, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}><RibbonLayer /></div>
            <div className="cinematic-line" style={{ top: '35%', zIndex: 2 }}/>

            <div style={{ position: 'relative', zIndex: 2, maxWidth: 820 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 20px', borderRadius: 100,
                background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(79,70,229,0.2)',
                fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                color: 'rgba(13,11,20,0.62)', letterSpacing: '0.14em', marginBottom: 32,
                boxShadow: '0 2px 12px rgba(79,70,229,0.1)',
                animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0d9660', boxShadow: '0 0 8px #0d9660', animation: 'liveDot 2s ease-in-out infinite', flexShrink: 0 }}/>
                LIVE ON SEPOLIA · ERC-5484 SOULBOUND
              </div>

              <h1 className="heading-shimmer" style={{ fontSize: 'clamp(40px,7.5vw,86px)', lineHeight: 1.01, letterSpacing: '-0.03em', marginBottom: 26, animation: 'fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.08s both' }}>
                Your On-Chain<br/>Identity Awaits
              </h1>

              <p style={{
                fontSize: 16.5, fontWeight: 400, color: 'rgba(13,11,20,0.68)', lineHeight: 1.78,
                maxWidth: 460, margin: '0 auto 40px',
                animation: 'fadeUp 0.65s cubic-bezier(0.16,1,0.3,1) 0.16s both',
              }}>
                Connect your wallet to view your reputation score, perform on-chain actions, and forge your soulbound identity.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', animation: 'fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.24s both' }}>
                <div style={{ animation: 'pulseGlow 3s ease-in-out infinite', borderRadius: 14 }}>
                  <ConnectButton label="Connect & Begin →"/>
                </div>
                <Link href="/" style={{
                  padding: '13px 28px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(13,11,20,0.12)',
                  color: 'rgba(13,11,20,0.65)', fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500, textDecoration: 'none', transition: 'all 0.22s ease',
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                }}>
                  <span style={{ fontSize: 13 }}>◈</span> Learn More
                </Link>
              </div>

              <div style={{
                display: 'flex', gap: 44, justifyContent: 'center', marginTop: 64, paddingTop: 32,
                borderTop: '1px solid rgba(13,11,20,0.08)',
                animation: 'fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.34s both',
                flexWrap: 'wrap',
              }}>
                {[{ v: 'ERC-5484', l: 'Standard' }, { v: '5 Tiers', l: 'Reputation' }, { v: 'On-Chain', l: 'SVG Art' }, { v: 'Sepolia', l: 'Network' }].map(s => (
                  <div key={s.l} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 19, color: '#0d0b14', letterSpacing: '-0.01em' }}>{s.v}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.45)', marginTop: 5, letterSpacing: '0.14em' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>

            {/* ── HERO IDENTITY CARD ── */}
            <div className="section-card" style={{ borderColor: `${tier.color}25`, boxShadow: `0 16px 48px ${tier.color}10, 0 4px 16px rgba(0,0,0,0.04)` }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '22px 22px 0 0',
                background: `linear-gradient(90deg, transparent, ${tier.color}, rgba(13,150,96,0.6), ${tier.color}, transparent)`,
                backgroundSize: '300% 100%', animation: 'auroraShift 5s ease infinite',
              }}/>
              <div style={{ position: 'absolute', left: 24, top: 24, width: 95, height: 95, borderRadius: 20, background: `${tier.color}10`, animation: 'halorRing 3s ease-out infinite', pointerEvents: 'none' }}/>

              <div className="hero-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  {sbtImage ? (
                    <div style={{ width: 88, height: 88, borderRadius: 18, overflow: 'hidden', border: `2px solid ${tier.color}35`, flexShrink: 0, boxShadow: `0 8px 24px ${tier.color}20` }}>
                      <img src={sbtImage} alt="SBT" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    </div>
                  ) : (
                    <div style={{
                      width: 88, height: 88, borderRadius: 18, flexShrink: 0,
                      background: `radial-gradient(circle at 33% 28%, rgba(255,255,255,0.92) 0%, ${tier.bg} 60%, ${tier.color}20 100%)`,
                      border: `2px solid ${tier.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 42, color: tier.color,
                      boxShadow: `0 8px 24px ${tier.color}18`,
                      animation: 'crystalFloat 6s ease-in-out infinite',
                    }}>{tier.icon}</div>
                  )}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: tier.color, letterSpacing: '-0.02em' }}>{tier.name}</span>
                      {hasSBT && (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: '#0d9660', padding: '3px 9px', borderRadius: 7, background: 'rgba(13,150,96,0.1)', border: '1px solid rgba(13,150,96,0.22)' }}>
                          SBT #{tokenId}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'rgba(13,11,20,0.45)', marginBottom: 12 }}>
                      {short(address!)} · {actionCount} actions recorded
                    </div>
                    <div style={{ width: 230, maxWidth: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.4)' }}>Score {tier.min}–{tier.max}</span>
                        {tierIdx < 4
                          ? <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: tier.color }}>{TIERS[tierIdx + 1].min - score} to {TIERS[tierIdx + 1].name}</span>
                          : <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: tier.color }}>MAX ◆</span>
                        }
                      </div>
                      <div style={{ height: 5, background: 'rgba(13,11,20,0.07)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${tierPct(score, tierIdx)}%`, borderRadius: 5, transition: 'width 1.3s cubic-bezier(0.16,1,0.3,1)', boxShadow: `0 0 8px ${tier.color}60`,
                          background: `linear-gradient(90deg, ${tier.color}80, ${tier.color})`,
                        }}/>
                      </div>
                    </div>
                  </div>
                </div>

                <ScoreRing score={score} color={tier.color}/>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { l: 'Voting', v: `${(votingMul / 10000).toFixed(1)}×`, c: '#4f46e5' },
                    { l: 'Loan',   v: `${loanBps / 100}%`,                  c: '#0d9660' },
                    { l: 'Actions', v: String(actionCount),                  c: '#c9933a' },
                  ].map(s => (
                    <div key={s.l} style={{
                      padding: '12px 16px', borderRadius: 14, minWidth: 76, textAlign: 'center',
                      background: `${s.c}0c`, border: `1.5px solid ${s.c}22`,
                    }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: 'rgba(13,11,20,0.42)', letterSpacing: '0.12em', marginBottom: 5 }}>{s.l.toUpperCase()}</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: s.c, letterSpacing: '-0.02em' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── STAT CARDS ── */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <StatCard label="Reputation Score" value={String(score)} sub={`Tier ${tierIdx + 1} of 5`} color={tier.color}/>
              <StatCard label="Voting Power" value={`${(votingMul / 10000).toFixed(1)}×`} sub={`${votingMul} bps weight`} color="#4f46e5"/>
              <StatCard label="Loan Ceiling" value={`${loanBps / 100}%`} sub={`${loanBps} bps max`} color="#0d9660"/>
              <StatCard label="Last Action" value={lastActionAt > 0 ? new Date(lastActionAt * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : 'Never'} sub={`${actionCount} total`} color="#c9933a"/>
            </div>

            {/* ── TABS ── */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { k: 'actions',  l: 'Reputation Actions', icon: '▲' },
                { k: 'vault',    l: 'Vault & Positions',  icon: '◉' },
                { k: 'identity', l: 'SBT Identity',       icon: '◆' },
              ].map(t => (
                <button key={t.k} className={`tab-btn${tab === t.k ? ' active' : ''}`} onClick={() => setTab(t.k as any)}>
                  <span style={{ fontSize: 13 }}>{t.icon}</span>{t.l}
                </button>
              ))}
            </div>

            {/* ════════════ ACTIONS TAB ════════════ */}
            {tab === 'actions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both' }}>

                {/* GAINS */}
                <div className="section-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 10,
                      padding: '9px 20px', borderRadius: 100,
                      background: 'linear-gradient(135deg, rgba(13,150,96,0.1), rgba(13,150,96,0.05))',
                      border: '1.5px solid rgba(13,150,96,0.28)',
                      animation: 'greenGlow 3s ease-in-out infinite',
                    }}>
                      <span style={{ fontSize: 14, animation: 'dotBounce 1.8s ease-in-out infinite' }}>▲</span>
                      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 800, color: '#0d9660', letterSpacing: '0.16em' }}>REPUTATION GAINS</span>
                    </div>
                    <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(13,150,96,0.3), transparent)' }}/>
                  </div>

                  <div className="actions-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <ActionCard icon="⬡" label="Cast DAO Vote"   delta="+10" fn="castVote"       cdLabel="12h cooldown"      color="#3b82f6" onCooldown={voteCD}     nextTime={nextVote}     cdSecs={43200} now={now} loading={pending === 'vote'}     anyLoading={isLoading} onExec={() => exec('vote',     { ...CONTRACTS.RST_VAULT, functionName: 'castVote' })}/>
                    <ActionCard icon="◈" label="Submit Proposal" delta="+25" fn="submitProposal" cdLabel="24h cooldown"      color="#4f46e5" onCooldown={proposalCD} nextTime={nextProposal} cdSecs={86400} now={now} loading={pending === 'proposal'} anyLoading={isLoading} onExec={() => exec('proposal', { ...CONTRACTS.RST_VAULT, functionName: 'submitProposal' })}/>
                    <ActionCard icon="✦" label="Mint NFT"        delta="+5"  fn="mintNFT"        cdLabel="12h cooldown"      color="#c9933a" onCooldown={nftCD}      nextTime={nextNft}      cdSecs={43200} now={now} loading={pending === 'nft'}      anyLoading={isLoading} onExec={() => exec('nft',      { ...CONTRACTS.RST_VAULT, functionName: 'mintNFT' })}/>
                    <ActionCard icon="◉" label="Repay Loan"      delta="+30" fn="repayLoan"      cdLabel="needs active loan" color="#0d9660" onCooldown={false}      nextTime={0}            cdSecs={0}     now={now} loading={pending === 'repay'}    anyLoading={isLoading} disabled={activeLoan === 0} disabledMsg={activeLoan === 0 ? 'No active loan' : undefined} onExec={() => exec('repay', { ...CONTRACTS.RST_VAULT, functionName: 'repayLoan' })}/>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <ActionCard icon="◆" label="Settle Airdrop (30d hold)" delta="+15" fn="settleAirdrop" cdLabel="must hold 30 days" color="#c2357a" onCooldown={false} nextTime={0} cdSecs={0} now={now} loading={pending === 'settle'} anyLoading={isLoading} disabled={airdropTs === 0 || !airdropHeld} disabledMsg={airdropTs === 0 ? 'No active airdrop' : !airdropHeld ? `Hold ${fmtCD(airdropTs + 2592000, now)} more` : undefined} onExec={() => exec('settle', { ...CONTRACTS.RST_VAULT, functionName: 'settleAirdrop' })}/>
                    </div>
                  </div>
                </div>

                {/* PENALTIES */}
                <div className="section-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 10,
                      padding: '9px 20px', borderRadius: 100,
                      background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.25)',
                      animation: 'warningPulse 3s ease-in-out infinite',
                    }}>
                      <span style={{ fontSize: 14, color: '#ef4444', animation: 'dotBounce 2.2s ease-in-out infinite' }}>▼</span>
                      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 800, color: '#ef4444', letterSpacing: '0.16em' }}>REPUTATION PENALTIES</span>
                    </div>
                    <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(239,68,68,0.28), transparent)' }}/>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* ✅ Fixed: PenaltyCard is a proper component, not a hook call inside .map() */}
                    {ACTIONS_PENALTY.map((p) => (
                      <PenaltyCard key={p.label} p={p} />
                    ))}

                    {/* Warning banner */}
                    <div style={{
                      position: 'relative', borderRadius: 18, overflow: 'hidden',
                      padding: '18px 20px',
                      background: 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(239,68,68,0.04) 100%)',
                      border: '1.5px solid rgba(239,68,68,0.2)',
                    }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, borderRadius: '18px 18px 0 0', background: 'linear-gradient(90deg, #ef4444, #f97316, #ef4444)', backgroundSize: '200% 100%', animation: 'auroraShift 3s ease infinite' }}/>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, animation: 'warningPulse 2.5s ease-in-out infinite' }}>⚠</div>
                        <div>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 800, color: '#ef4444', letterSpacing: '0.12em', marginBottom: 5, textTransform: 'uppercase' }}>Permanent · No Reset · No Forgiveness</div>
                          <div style={{ fontSize: 12.5, color: 'rgba(13,11,20,0.58)', lineHeight: 1.65 }}>Penalties are applied on-chain and cannot be undone. Your reputation is your most valuable on-chain asset.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score spectrum */}
                <div className="section-card">
                  <div className="section-label">Score Spectrum</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    {['0','100','300','600','850','1000'].map(n => (
                      <span key={n} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.4)' }}>{n}</span>
                    ))}
                  </div>
                  <div style={{ height: 7, borderRadius: 7, position: 'relative', overflow: 'hidden',
                    background: 'linear-gradient(90deg, #94a3b8 0%, #94a3b8 10%, #c2773a 10%, #c2773a 30%, #6b82a8 30%, #6b82a8 60%, #c9933a 60%, #c9933a 85%, #4f46e5 85%, #4f46e5 100%)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}>
                    {score > 0 && <div style={{ position: 'absolute', left: `${(score / 1000) * 100}%`, top: -3, bottom: -3, width: 3, background: '#fff', borderRadius: 2, transform: 'translateX(-50%)', boxShadow: '0 0 6px rgba(0,0,0,0.3)' }}/>}
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
                    {TIERS.map(t => (
                      <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color, display: 'inline-block', flexShrink: 0 }}/>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: 'rgba(13,11,20,0.52)' }}>{t.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════ VAULT TAB ════════════ */}
            {tab === 'vault' && (
              <div className="vault-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, animation: 'fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both' }}>

                {/* LOAN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="section-card">
                    <div className="section-label" style={{ color: '#0d9660' }}>
                      Loan Management
                      {activeLoan > 0 && <span style={{ marginLeft: 'auto', fontSize: 9, color: '#c9933a', padding: '2px 9px', borderRadius: 6, background: 'rgba(201,147,58,0.1)', border: '1px solid rgba(201,147,58,0.22)', fontFamily: "'JetBrains Mono', monospace" }}>ACTIVE: {activeLoan} units</span>}
                    </div>

                    {activeLoan > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ padding: '14px 18px', borderRadius: 14, background: 'rgba(201,147,58,0.07)', border: '1px solid rgba(201,147,58,0.2)' }}>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: '#c9933a', marginBottom: 5 }}>Active Loan Position</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'rgba(13,11,20,0.48)' }}>{activeLoan} notional units · pure on-chain simulation</div>
                        </div>
                        <p style={{ fontSize: 13, color: 'rgba(13,11,20,0.62)', lineHeight: 1.65 }}>
                          Repay to earn <strong style={{ color: '#0d9660' }}>+30 pts</strong>. A loan default (owner-only) costs <strong style={{ color: '#ef4444' }}>−50 pts</strong>.
                        </p>
                        <button className="exec-btn" disabled={isLoading} onClick={() => exec('repay', { ...CONTRACTS.RST_VAULT, functionName: 'repayLoan' })}
                          style={{ borderColor: 'rgba(13,150,96,0.4)', background: 'rgba(13,150,96,0.08)', color: '#0d9660', width: '100%', justifyContent: 'center' }}>
                          {pending === 'repay' && isLoading ? <><span style={{ animation: 'spinR 0.8s linear infinite', display: 'inline-block' }}>◌</span>Confirming…</> : '◉ Repay Loan · Earn +30 pts'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <p style={{ fontSize: 13, color: 'rgba(13,11,20,0.62)', lineHeight: 1.65 }}>
                          Open a simulated loan. No ETH transferred — pure reputation simulation. Repay to earn <strong style={{ color: '#0d9660' }}>+30 pts</strong>.
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <input className="input-field" type="number" min="1" placeholder="Amount (e.g. 1000)" value={loanInput} onChange={e => setLoanInput(e.target.value)} style={{ flex: 1 }}/>
                          <button className="exec-btn" disabled={isLoading || !loanInput || parseInt(loanInput) < 1}
                            onClick={() => exec('loan', { ...CONTRACTS.RST_VAULT, functionName: 'takeLoan', args: [BigInt(Math.max(1, parseInt(loanInput) || 1))] })}
                            style={{ borderColor: 'rgba(13,150,96,0.38)', background: 'rgba(13,150,96,0.08)', color: '#0d9660', flexShrink: 0 }}>
                            {pending === 'loan' && isLoading ? <span style={{ animation: 'spinR 0.8s linear infinite', display: 'inline-block' }}>◌</span> : 'Take Loan'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="section-card">
                    <div className="section-label">Loan Rules</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { i: '◉', t: 'One active loan per wallet at a time',          c: '#0d9660' },
                        { i: '✦', t: 'Repay earns +30 reputation points',             c: '#4f46e5' },
                        { i: '◌', t: 'Default (owner-only) costs −50 reputation',     c: '#ef4444' },
                        { i: '◈', t: 'No real ETH transferred — simulation only',     c: '#c9933a' },
                        { i: '◆', t: `Your loan ceiling: ${loanBps / 100}%`,          c: '#3b82f6' },
                      ].map(r => (
                        <div key={r.t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ color: r.c, fontSize: 14, flexShrink: 0, marginTop: 1 }}>{r.i}</span>
                          <span style={{ fontSize: 12.5, color: 'rgba(13,11,20,0.62)', lineHeight: 1.55 }}>{r.t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AIRDROP */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="section-card">
                    <div className="section-label" style={{ color: '#c2357a' }}>
                      Airdrop Management
                      {airdropTs > 0 && (
                        <span style={{ marginLeft: 'auto', fontSize: 9, padding: '2px 9px', borderRadius: 6, border: '1px solid', fontFamily: "'JetBrains Mono', monospace",
                          color: airdropHeld ? '#0d9660' : '#c9933a',
                          background: airdropHeld ? 'rgba(13,150,96,0.1)' : 'rgba(201,147,58,0.1)',
                          borderColor: airdropHeld ? 'rgba(13,150,96,0.22)' : 'rgba(201,147,58,0.22)',
                        }}>
                          {airdropHeld ? '✓ READY' : 'HOLDING…'}
                        </span>
                      )}
                    </div>

                    {airdropTs === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <p style={{ fontSize: 13, color: 'rgba(13,11,20,0.62)', lineHeight: 1.65 }}>
                          Claim a simulated airdrop and hold for 30 days to earn <strong style={{ color: '#0d9660' }}>+15 pts</strong>. Settling early costs <strong style={{ color: '#ef4444' }}>−20 pts</strong>.
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <input className="input-field" type="number" min="1" placeholder="Amount (e.g. 500)" value={airdropInput} onChange={e => setAirdropInput(e.target.value)} style={{ flex: 1 }}/>
                          <button className="exec-btn" disabled={isLoading || !airdropInput || parseInt(airdropInput) < 1}
                            onClick={() => exec('airdrop', { ...CONTRACTS.RST_VAULT, functionName: 'claimAirdrop', args: [BigInt(Math.max(1, parseInt(airdropInput) || 1))] })}
                            style={{ borderColor: 'rgba(194,53,122,0.38)', background: 'rgba(194,53,122,0.08)', color: '#c2357a', flexShrink: 0 }}>
                            {pending === 'airdrop' && isLoading ? <span style={{ animation: 'spinR 0.8s linear infinite', display: 'inline-block' }}>◌</span> : 'Claim'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ padding: '14px 18px', borderRadius: 14,
                          background: airdropHeld ? 'rgba(13,150,96,0.07)' : 'rgba(201,147,58,0.07)',
                          border: `1px solid ${airdropHeld ? 'rgba(13,150,96,0.2)' : 'rgba(201,147,58,0.2)'}`,
                        }}>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: airdropHeld ? '#0d9660' : '#c9933a', marginBottom: 5 }}>
                            {airdropHeld ? 'Hold period complete!' : 'Holding airdrop…'}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'rgba(13,11,20,0.48)' }}>
                            {airdropAmt} units · Claimed {new Date(airdropTs * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.42)' }}>30-Day Hold Progress</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: airdropHeld ? '#0d9660' : '#c9933a' }}>{pct30d.toFixed(1)}%</span>
                          </div>
                          <div style={{ height: 6, background: 'rgba(13,11,20,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 6, transition: 'width 1s linear',
                              width: `${pct30d}%`,
                              background: airdropHeld ? 'linear-gradient(90deg, #0d9660, #10b981)' : 'linear-gradient(90deg, #c2357a, #c9933a)',
                              boxShadow: `0 0 8px ${airdropHeld ? '#0d966060' : '#c9933a60'}`,
                            }}/>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.35)' }}>Day 0</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.35)' }}>Day 30</span>
                          </div>
                        </div>

                        <p style={{ fontSize: 13, color: 'rgba(13,11,20,0.62)', lineHeight: 1.65 }}>
                          {airdropHeld
                            ? 'You have held for 30+ days. Settle now to receive +15 reputation!'
                            : `Settle in ${fmtCD(airdropTs + 2592000, now)} for +15 pts, or settle early for −20 pts.`}
                        </p>

                        {airdropHeld ? (
                          <button className="exec-btn" disabled={isLoading} onClick={() => exec('settle', { ...CONTRACTS.RST_VAULT, functionName: 'settleAirdrop' })}
                            style={{ borderColor: 'rgba(13,150,96,0.4)', background: 'rgba(13,150,96,0.08)', color: '#0d9660', width: '100%', justifyContent: 'center' }}>
                            {pending === 'settle' && isLoading ? <><span style={{ animation: 'spinR 0.8s linear infinite', display: 'inline-block' }}>◌</span>Confirming…</> : '◆ Settle · Earn +15 pts'}
                          </button>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <button className="exec-btn" disabled={isLoading} onClick={() => exec('settle', { ...CONTRACTS.RST_VAULT, functionName: 'settleAirdrop' })}
                              style={{ borderColor: 'rgba(239,68,68,0.32)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', width: '100%', justifyContent: 'center' }}>
                              {pending === 'settle' && isLoading ? <><span style={{ animation: 'spinR 0.8s linear infinite', display: 'inline-block' }}>◌</span>Confirming…</> : '◇ Settle Early · Lose −20 pts'}
                            </button>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: 'rgba(13,11,20,0.4)', textAlign: 'center' }}>⚠ Early settlement permanently deducts 20 pts</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="section-card">
                    <div className="section-label">Airdrop Rules</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { i: '◆', t: 'Claim once — starts 30-day hold timer',       c: '#c2357a' },
                        { i: '✦', t: 'Hold 30 days → settle for +15 reputation',    c: '#0d9660' },
                        { i: '◇', t: 'Settle early → lose −20 reputation',          c: '#ef4444' },
                        { i: '◈', t: 'Score changes only on settlement',             c: '#c9933a' },
                      ].map(r => (
                        <div key={r.t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ color: r.c, fontSize: 14, flexShrink: 0, marginTop: 1 }}>{r.i}</span>
                          <span style={{ fontSize: 12.5, color: 'rgba(13,11,20,0.62)', lineHeight: 1.55 }}>{r.t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════ IDENTITY TAB ════════════ */}
            {tab === 'identity' && (
              <div className="identity-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, animation: 'fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both' }}>

                {/* SBT Card */}
                <div className="section-card" style={{ borderColor: `${tier.color}28`, boxShadow: `0 12px 40px ${tier.color}0e` }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '22px 22px 0 0',
                    background: `linear-gradient(90deg, transparent, ${tier.color}cc, rgba(13,150,96,0.6), ${tier.color}cc, transparent)`,
                    backgroundSize: '300% 100%', animation: 'auroraShift 5s ease infinite',
                  }}/>
                  <div className="section-label">Soulbound Token · ERC-5484</div>

                  {hasSBT ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {sbtImage ? (
                          <div style={{ width: 160, height: 160, borderRadius: 22, overflow: 'hidden', border: `2px solid ${tier.color}30`, boxShadow: `0 12px 36px ${tier.color}20` }}>
                            <img src={sbtImage} alt="SBT Medal" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                          </div>
                        ) : (
                          <div style={{
                            width: 160, height: 160, borderRadius: 22,
                            background: `radial-gradient(circle at 33% 28%, rgba(255,255,255,0.94) 0%, ${tier.bg} 55%, ${tier.color}20 100%)`,
                            border: `2px solid ${tier.color}28`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 72, color: tier.color,
                            boxShadow: `0 12px 36px ${tier.color}18`,
                            animation: 'crystalFloat 6s ease-in-out infinite',
                          }}>{tier.icon}</div>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                        {[
                          { l: 'Token ID',  v: `#${tokenId}` },
                          { l: 'Standard',  v: 'ERC-5484'    },
                          { l: 'Tier',      v: tier.name     },
                          { l: 'Score',     v: String(score) },
                          { l: 'Transfer',  v: 'Locked'      },
                          { l: 'Burn Auth', v: 'Issuer Only' },
                        ].map(m => (
                          <div key={m.l} style={{ padding: '11px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(13,11,20,0.07)' }}>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: 'rgba(13,11,20,0.4)', letterSpacing: '0.1em', marginBottom: 4 }}>{m.l.toUpperCase()}</div>
                            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: '#0d0b14' }}>{m.v}</div>
                          </div>
                        ))}
                      </div>

                      <a href={`https://sepolia.etherscan.io/token/0x9c77Ce31a110e360d62e4eF8B1F4cf8576F70F46?a=${address}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 18px', borderRadius: 12, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: tier.color, textDecoration: 'none', border: `1.5px solid ${tier.color}25`, background: `${tier.color}08`, transition: 'all 0.2s ease' }}>
                        View on Etherscan ↗
                      </a>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '44px 0' }}>
                      <div style={{ fontSize: 60, marginBottom: 18, opacity: 0.18, animation: 'crystalFloat 6s ease-in-out infinite' }}>◈</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: 'rgba(13,11,20,0.55)', marginBottom: 10 }}>No SBT Yet</div>
                      <div style={{ fontSize: 13, color: 'rgba(13,11,20,0.45)', lineHeight: 1.7, maxWidth: 240, margin: '0 auto' }}>
                        Your Soulbound Token mints automatically on your first on-chain action.
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: stats + contracts + tier ladder */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="section-card">
                    <div className="section-label">Protocol Stats</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 20 }}>
                      {[
                        { l: 'Total SBTs',   v: String(totalSupply), c: '#4f46e5' },
                        { l: 'Your Score',   v: String(score),       c: tier.color },
                        { l: 'Voting Power', v: `${(votingMul / 10000).toFixed(1)}×`, c: '#4f46e5' },
                        { l: 'Loan Access',  v: `${loanBps / 100}%`, c: '#0d9660'  },
                        { l: 'Actions Done', v: String(actionCount), c: '#c9933a'  },
                        { l: 'Your Tier',    v: tier.name,           c: tier.color },
                      ].map(s => (
                        <div key={s.l} style={{ padding: '10px 12px', borderRadius: 11, background: `${s.c}08`, border: `1.5px solid ${s.c}18` }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: 'rgba(13,11,20,0.42)', letterSpacing: '0.1em', marginBottom: 4 }}>{s.l.toUpperCase()}</div>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: s.c }}>{s.v}</div>
                        </div>
                      ))}
                    </div>

                    <div className="section-label" style={{ marginBottom: 12 }}>Tier Ladder</div>
                    {TIERS.map((t, i) => (
                      <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                          background: tierIdx >= i ? t.bg : 'rgba(13,11,20,0.04)',
                          border: `1.5px solid ${tierIdx >= i ? t.color + '40' : 'rgba(13,11,20,0.08)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                          transition: 'all 0.3s ease',
                        }}>{t.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 800, color: tierIdx >= i ? t.color : 'rgba(13,11,20,0.38)', letterSpacing: '0.04em' }}>{t.name}</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(13,11,20,0.35)' }}>{t.min}–{t.max}</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 4, background: 'rgba(13,11,20,0.07)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 4, transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)',
                              width: tierIdx > i ? '100%' : tierIdx === i ? `${tierPct(score, i)}%` : '0%',
                              background: `linear-gradient(90deg, ${t.color}80, ${t.color})`,
                              boxShadow: `0 0 6px ${t.color}50`,
                            }}/>
                          </div>
                        </div>
                        {tierIdx === i && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.color, flexShrink: 0, fontWeight: 600 }}>← You</span>}
                        {tierIdx > i  && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.color, flexShrink: 0 }}>✓</span>}
                      </div>
                    ))}
                  </div>

                  <div className="section-card">
                    <div className="section-label">Deployed Contracts · Sepolia</div>
                    {[
                      { l: 'ReputationToken',  a: '0x9c77Ce31…F70F46', href: 'https://sepolia.etherscan.io/address/0x9c77Ce31a110e360d62e4eF8B1F4cf8576F70F46', tag: 'ERC-5484', c: '#c2357a' },
                      { l: 'ReputationEngine', a: '0x4eFC1adc…FaBD8',  href: 'https://sepolia.etherscan.io/address/0x4eFC1adc7Dd594C4bB04865B6dCc5101392FaBD8', tag: 'UUPS',    c: '#4f46e5' },
                      { l: 'ReputationVault',  a: '0xd53320CD…D98b6',  href: 'https://sepolia.etherscan.io/address/0xd53320CDEF6f3DfA54436D2806e765d6d6bD98b6', tag: 'Gateway', c: '#0d9660' },
                    ].map(c => (
                      <a key={c.l} href={c.href} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', padding: '11px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(13,11,20,0.07)', marginBottom: 9, transition: 'all 0.2s ease' }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${c.c}0a`; el.style.borderColor = `${c.c}28`; }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.7)'; el.style.borderColor = 'rgba(13,11,20,0.07)'; }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: c.c, padding: '2px 7px', borderRadius: 5, background: `${c.c}12`, border: `1px solid ${c.c}22` }}>{c.tag}</span>
                          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(13,11,20,0.7)', fontWeight: 500 }}>{c.l}</span>
                        </div>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: c.c }}>{c.a} ↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── FOOTER ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 22px', borderRadius: 18,
              background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(13,11,20,0.07)',
              flexWrap: 'wrap', gap: 12,
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: 'linear-gradient(135deg, #4f46e5, #0d9660)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>◆</div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'rgba(13,11,20,0.48)' }}>RST Protocol · ERC-5484 · Sepolia</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span className="live-dot"/>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(13,11,20,0.45)' }}>{totalSupply} wallets tracked</span>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(13,11,20,0.38)' }}>Built by NexTech Architect · 2025</span>
            </div>

          </div>
        )}
      </main>
    </>
  );
}