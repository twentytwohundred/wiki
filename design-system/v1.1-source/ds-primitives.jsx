// ds-primitives.jsx — atomic pieces shared by docs + screens
// Exposes to window: Pill, Dot, Avatar, Btn, Field, Code, Kbd, Swatch, Tile,
//                    Meta, Tag, AGENT_HUES, statusOf

const AGENT_HUES = ['var(--agent-1)','var(--agent-2)','var(--agent-3)','var(--agent-4)','var(--agent-5)','var(--agent-6)'];

function hashIdx(name, mod) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}
const agentHue = (name) => AGENT_HUES[hashIdx(String(name || ''), AGENT_HUES.length)];

// ── Status dot ───────────────────────────────────────────────────────────────
function Dot({ tone = 'idle', pulse = false, size = 8, style }) {
  const tones = {
    running: 'var(--accent)',
    idle:    'var(--text-4)',
    error:   'var(--danger)',
    warn:    'var(--warn)',
    info:    'var(--info)',
    off:     'var(--text-4)',
  };
  const c = tones[tone] || tones.idle;
  return (
    <span aria-hidden="true" style={{
      display: 'inline-block', width: size, height: size, borderRadius: '999px',
      background: c,
      boxShadow: pulse ? `0 0 0 0 ${c}` : 'none',
      animation: pulse ? 'dsPulse 1.6s var(--ds-ease) infinite' : 'none',
      flex: '0 0 auto',
      ...style,
    }} />
  );
}

// global pulse keyframes (one-time inject)
if (typeof document !== 'undefined' && !document.getElementById('ds-pulse-kf')) {
  const s = document.createElement('style'); s.id = 'ds-pulse-kf';
  s.textContent = `@keyframes dsPulse{
    0%{box-shadow:0 0 0 0 color-mix(in oklch,var(--accent) 60%, transparent)}
    70%{box-shadow:0 0 0 8px color-mix(in oklch,var(--accent) 0%, transparent)}
    100%{box-shadow:0 0 0 0 color-mix(in oklch,var(--accent) 0%, transparent)}
  }`;
  document.head.appendChild(s);
}

// ── Pill (status / tag) ──────────────────────────────────────────────────────
function Pill({ tone = 'neutral', dot = false, pulse = false, mono = true, size = 'sm', children, style, as = 'span', ...rest }) {
  const tones = {
    neutral: { bg: 'var(--bg-sunk)',    fg: 'var(--text-2)', bd: 'var(--line)' },
    accent:  { bg: 'var(--accent-soft)',fg: 'var(--accent-ink)', bd: 'transparent' },
    success: { bg: 'var(--accent-soft)',fg: 'var(--accent-ink)', bd: 'transparent' },
    danger:  { bg: 'var(--danger-soft)',fg: 'var(--danger)', bd: 'transparent' },
    warn:    { bg: 'var(--warn-soft)',  fg: 'var(--warn)',   bd: 'transparent' },
    info:    { bg: 'var(--info-soft)',  fg: 'var(--info)',   bd: 'transparent' },
    ghost:   { bg: 'transparent',       fg: 'var(--text-3)', bd: 'var(--line)' },
  };
  const t = tones[tone] || tones.neutral;
  const sz = size === 'xs'
    ? { h: 18, fs: 10.5, px: 6, gap: 5 }
    : size === 'md'
    ? { h: 24, fs: 12,   px: 9, gap: 6 }
    : { h: 20, fs: 11,   px: 8, gap: 6 };
  const Tag = as;
  return (
    <Tag {...rest} style={{
      display: 'inline-flex', alignItems: 'center', gap: sz.gap,
      height: sz.h, padding: `0 ${sz.px}px`,
      borderRadius: 'var(--ds-r-pill)',
      background: t.bg, color: t.fg,
      border: `1px solid ${t.bd}`,
      font: `500 ${sz.fs}px/1 ${mono ? 'var(--ds-font-mono)' : 'var(--ds-font-sans)'}`,
      letterSpacing: mono ? '.02em' : '0',
      textTransform: mono ? 'lowercase' : 'none',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {dot && <Dot tone={tone === 'success' || tone === 'accent' ? 'running' : tone === 'danger' ? 'error' : tone === 'warn' ? 'warn' : tone === 'info' ? 'info' : 'idle'} pulse={pulse} size={6} />}
      {children}
    </Tag>
  );
}

// ── Tag (non-status, used for chips like @hobby) ─────────────────────────────
function Tag({ children, hue, onClick, removable, style }) {
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      height: 22, padding: '0 8px', borderRadius: 'var(--ds-r-pill)',
      background: 'var(--bg-sunk)', color: 'var(--text-2)',
      border: '1px solid var(--line)',
      font: '500 12px/1 var(--ds-font-mono)',
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>
      {hue && <span style={{ width: 6, height: 6, borderRadius: '999px', background: hue }} />}
      {children}
    </span>
  );
}

// ── Avatar (Agent identity) ──────────────────────────────────────────────────
function Avatar({ name = '?', size = 28, hue, status, glyph, style }) {
  const h = hue || agentHue(name);
  const fs = Math.round(size * 0.42);
  const initial = (glyph || name).toString().trim().charAt(0).toLowerCase() || '?';
  return (
    <span style={{
      position: 'relative',
      width: size, height: size, borderRadius: '999px',
      display: 'inline-grid', placeItems: 'center',
      background: `color-mix(in oklch, ${h} 18%, var(--bg-elev))`,
      color: h, border: `1px solid color-mix(in oklch, ${h} 35%, var(--line))`,
      font: `600 ${fs}px/1 var(--ds-font-mono)`,
      letterSpacing: '.02em', flex: '0 0 auto',
      ...style,
    }}>
      {initial}
      {status && (
        <span style={{
          position: 'absolute', right: -1, bottom: -1,
          width: Math.max(8, size * 0.3), height: Math.max(8, size * 0.3),
          borderRadius: '999px',
          background: status === 'running' ? 'var(--accent)' : status === 'error' ? 'var(--danger)' : status === 'warn' ? 'var(--warn)' : 'var(--text-4)',
          border: `2px solid var(--bg)`,
        }} />
      )}
    </span>
  );
}

// ── Button ──────────────────────────────────────────────────────────────────
function Btn({ variant = 'secondary', size = 'md', icon, kbd, children, style, ...rest }) {
  const sizes = {
    sm: { h: 28, px: 10, fs: 12.5, gap: 6, r: 'var(--ds-r-2)' },
    md: { h: 34, px: 14, fs: 13.5, gap: 8, r: 'var(--ds-r-2)' },
    lg: { h: 42, px: 18, fs: 14.5, gap: 10, r: 'var(--ds-r-3)' },
  };
  const s = sizes[size];
  const base = {
    appearance: 'none', border: '1px solid transparent',
    height: s.h, padding: `0 ${s.px}px`, borderRadius: s.r,
    font: `500 ${s.fs}px/1 var(--ds-font-sans)`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: s.gap,
    cursor: 'pointer', transition: 'background var(--ds-dur-fast) var(--ds-ease), border-color var(--ds-dur-fast) var(--ds-ease), color var(--ds-dur-fast) var(--ds-ease)',
    whiteSpace: 'nowrap',
  };
  const variants = {
    primary:   { background: 'var(--accent)', color: 'var(--on-accent)', borderColor: 'var(--accent)' },
    secondary: { background: 'var(--bg-elev)', color: 'var(--text)', borderColor: 'var(--line-strong)' },
    ghost:     { background: 'transparent', color: 'var(--text-2)', borderColor: 'transparent' },
    soft:      { background: 'var(--bg-sunk)', color: 'var(--text)', borderColor: 'var(--line)' },
    danger:    { background: 'transparent', color: 'var(--danger)', borderColor: 'color-mix(in oklch, var(--danger) 40%, var(--line))' },
    primarySoft: { background: 'var(--accent-soft)', color: 'var(--accent-ink)', borderColor: 'transparent' },
  };
  return (
    <button {...rest} style={{ ...base, ...variants[variant], ...style }}>
      {icon}
      <span>{children}</span>
      {kbd && <Kbd>{kbd}</Kbd>}
    </button>
  );
}

function Kbd({ children, style }) {
  return (
    <kbd style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 5px',
      borderRadius: 4, border: '1px solid var(--line)',
      background: 'var(--bg)',
      font: '500 10.5px/1 var(--ds-font-mono)',
      color: 'var(--text-3)',
      ...style,
    }}>{children}</kbd>
  );
}

// ── Field (label + input/textarea) ───────────────────────────────────────────
function Field({ label, hint, mono = false, textarea = false, children, ...rest }) {
  const style = {
    width: '100%', appearance: 'none',
    background: 'var(--bg-sunk)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--ds-r-2)',
    padding: '10px 12px',
    color: 'var(--text)',
    font: `400 14px/1.45 ${mono ? 'var(--ds-font-mono)' : 'var(--ds-font-sans)'}`,
    outline: 'none', transition: 'border-color var(--ds-dur-fast) var(--ds-ease), background var(--ds-dur-fast) var(--ds-ease)',
    resize: textarea ? 'vertical' : 'none',
    minHeight: textarea ? 90 : undefined,
  };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <span style={{ font: '500 12px/1 var(--ds-font-sans)', color: 'var(--text-2)' }}>{label}</span>}
      {textarea
        ? <textarea {...rest} style={style}>{children}</textarea>
        : <input {...rest} style={style} />}
      {hint && <span style={{ font: '400 12px/1.4 var(--ds-font-sans)', color: 'var(--text-3)' }}>{hint}</span>}
    </label>
  );
}

// ── Code / Kbd ──────────────────────────────────────────────────────────────
function Code({ children, style }) {
  return (
    <code style={{
      font: '500 12.5px/1 var(--ds-font-mono)',
      background: 'var(--bg-sunk)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--ds-r-1)',
      padding: '2px 6px',
      color: 'var(--text-2)',
      ...style,
    }}>{children}</code>
  );
}

// ── Meta (mono label, used in breadcrumb / status rows) ──────────────────────
function Meta({ children, style }) {
  return (
    <span style={{
      font: '500 11px/1 var(--ds-font-mono)',
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--text-3)',
      ...style,
    }}>{children}</span>
  );
}

// ── Swatch (used in foundations) ─────────────────────────────────────────────
function Swatch({ name, value, varName, fg = 'var(--text)' }) {
  return (
    <div style={{
      border: '1px solid var(--line)', borderRadius: 'var(--ds-r-2)',
      background: 'var(--bg-elev)', overflow: 'hidden',
    }}>
      <div style={{ background: value, height: 64 }} />
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ font: '500 12.5px/1.3 var(--ds-font-sans)', color: 'var(--text)' }}>{name}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{varName}</span>
      </div>
    </div>
  );
}

// ── Tile (used to demo a single thing) ───────────────────────────────────────
function Tile({ label, children, footer, style }) {
  return (
    <div className="ds-card" style={{ display: 'flex', flexDirection: 'column', ...style }}>
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--line-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Meta>{label}</Meta>
      </div>
      <div style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 90, gap: 12, flexWrap: 'wrap' }}>
        {children}
      </div>
      {footer && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line-soft)', color: 'var(--text-3)', fontSize: 12 }}>
          {footer}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Pill, Dot, Tag, Avatar, Btn, Field, Code, Kbd, Meta, Swatch, Tile, AGENT_HUES, agentHue });
