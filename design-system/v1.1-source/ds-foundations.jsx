// ds-foundations.jsx — token-doc sections (colors, type, spacing, radius, motion, principles)

function Principles() {
  const items = [
    { kbd: '01', t: 'Quiet by default', d: 'Surface activity, not chrome. Empty space means nothing needs you.' },
    { kbd: '02', t: 'Two voices', d: 'Sans for prose and headings. Mono for IDs, values, and code. One glance tells you which is which.' },
    { kbd: '03', t: 'One green', d: 'Green only ever means "alive" — running agents, primary actions, accept. Never decorative.' },
    { kbd: '04', t: 'Normals first, devs deeper', d: 'The first screen is obvious. The fourth tab exposes every knob.' },
  ];
  return (
    <div className="grid-2">
      {items.map(it => (
        <div key={it.kbd} className="ds-card pad" style={{ display: 'flex', gap: 16 }}>
          <Meta style={{ minWidth: 24 }}>{it.kbd}</Meta>
          <div>
            <div style={{ font: '600 16px/1.3 var(--ds-font-sans)', marginBottom: 4 }}>{it.t}</div>
            <div style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.5 }}>{it.d}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ColorTokens() {
  const groups = [
    {
      label: 'Surfaces',
      rows: [
        { n: 'bg',       v: 'var(--bg)' },
        { n: 'bg-elev',  v: 'var(--bg-elev)' },
        { n: 'bg-sunk',  v: 'var(--bg-sunk)' },
        { n: 'bg-hover', v: 'var(--bg-hover)' },
      ],
    },
    {
      label: 'Lines',
      rows: [
        { n: 'line-soft',   v: 'var(--line-soft)' },
        { n: 'line',        v: 'var(--line)' },
        { n: 'line-strong', v: 'var(--line-strong)' },
      ],
    },
    {
      label: 'Text',
      rows: [
        { n: 'text',   v: 'var(--text)' },
        { n: 'text-2', v: 'var(--text-2)' },
        { n: 'text-3', v: 'var(--text-3)' },
        { n: 'text-4', v: 'var(--text-4)' },
      ],
    },
    {
      label: 'Accent · green = alive',
      rows: [
        { n: 'accent',        v: 'var(--accent)' },
        { n: 'accent-strong', v: 'var(--accent-strong)' },
        { n: 'accent-soft',   v: 'var(--accent-soft)' },
        { n: 'accent-ink',    v: 'var(--accent-ink)' },
      ],
    },
    {
      label: 'Semantic',
      rows: [
        { n: 'danger', v: 'var(--danger)' },
        { n: 'warn',   v: 'var(--warn)' },
        { n: 'info',   v: 'var(--info)' },
      ],
    },
    {
      label: 'Agent hues · identity only, never state',
      rows: [
        { n: 'agent-1 · sage',  v: 'var(--agent-1)' },
        { n: 'agent-2 · iris',  v: 'var(--agent-2)' },
        { n: 'agent-3 · clay',  v: 'var(--agent-3)' },
        { n: 'agent-4 · steel', v: 'var(--agent-4)' },
        { n: 'agent-5 · plum',  v: 'var(--agent-5)' },
        { n: 'agent-6 · ochre', v: 'var(--agent-6)' },
      ],
    },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {groups.map(g => (
        <div key={g.label}>
          <div className="ds-eyebrow">{g.label}</div>
          <div className="grid-4">
            {g.rows.map(r => (
              <Swatch key={r.n} name={r.n.split(' · ')[0]} varName={`--${r.n.split(' · ')[0]}`} value={r.v} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TypeSpec() {
  const sansRows = [
    { name: 'Display',   size: 44, weight: 600, ls: '-0.025em', sample: 'A studio for your fleet of agents.' },
    { name: 'Title',     size: 30, weight: 600, ls: '-0.02em',  sample: 'Studio' },
    { name: 'Section',   size: 22, weight: 600, ls: '-0.015em', sample: 'Models & API keys' },
    { name: 'Heading',   size: 17, weight: 600, ls: '-0.005em', sample: 'Send task' },
    { name: 'Body',      size: 15, weight: 400, ls: '0',        sample: 'Multi-agent room. Tag with @, react with one click.' },
    { name: 'Body sm',   size: 13, weight: 400, ls: '0',        sample: 'Each agent has a Brain file that is theirs alone.' },
    { name: 'Caption',   size: 12, weight: 500, ls: '0',        sample: 'Restart agents to pick up key/URL changes.' },
  ];
  const monoRows = [
    { name: 'Data L',    size: 30, weight: 500, ls: '0',     sample: '$0.82' },
    { name: 'Data',      size: 15, weight: 500, ls: '0',     sample: 'pid 62014' },
    { name: 'Eyebrow',   size: 11, weight: 600, ls: '.12em', sample: 'FLEET · DEFAULT-DARK · WS OPEN', upper: true },
    { name: 'ID',        size: 12, weight: 400, ls: '.02em', sample: 'notif_0d14671b0f444eda83b' },
    { name: 'Kbd',       size: 11, weight: 500, ls: '0',     sample: '⌘K' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <div className="ds-eyebrow">Sans · Inter · prose, headings, UI labels</div>
        <div className="ds-card" style={{ overflow: 'hidden' }}>
          {sansRows.map((r, i) => (
            <div key={r.name} style={{
              display: 'grid', gridTemplateColumns: '160px 1fr 120px', alignItems: 'baseline',
              padding: '14px 18px',
              borderTop: i ? '1px solid var(--line-soft)' : 'none',
            }}>
              <div style={{ font: '500 12px/1.2 var(--ds-font-sans)', color: 'var(--text-3)' }}>{r.name}</div>
              <div style={{
                font: `${r.weight} ${r.size}px/${r.size > 24 ? 1.18 : 1.4} var(--ds-font-sans)`,
                letterSpacing: r.ls, color: 'var(--text)',
              }}>{r.sample}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
                {r.size}px · {r.weight}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="ds-eyebrow">Mono · JetBrains Mono · IDs, values, code</div>
        <div className="ds-card" style={{ overflow: 'hidden' }}>
          {monoRows.map((r, i) => (
            <div key={r.name} style={{
              display: 'grid', gridTemplateColumns: '160px 1fr 120px', alignItems: 'baseline',
              padding: '14px 18px',
              borderTop: i ? '1px solid var(--line-soft)' : 'none',
            }}>
              <div style={{ font: '500 12px/1.2 var(--ds-font-sans)', color: 'var(--text-3)' }}>{r.name}</div>
              <div style={{
                font: `${r.weight} ${r.size}px/1.3 var(--ds-font-mono)`,
                letterSpacing: r.ls, color: 'var(--text)',
                textTransform: r.upper ? 'uppercase' : 'none',
              }}>{r.sample}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
                {r.size}px · {r.weight}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpacingSpec() {
  const space = [
    { n: 1, v: 4 }, { n: 2, v: 8 }, { n: 3, v: 12 }, { n: 4, v: 16 },
    { n: 5, v: 20 }, { n: 6, v: 24 }, { n: 8, v: 32 }, { n: 10, v: 40 },
    { n: 12, v: 48 }, { n: 16, v: 64 }, { n: 20, v: 80 },
  ];
  const radius = [
    { n: 'r-1', v: 4 }, { n: 'r-2', v: 6 }, { n: 'r-3', v: 10 }, { n: 'r-4', v: 14 }, { n: 'pill', v: 999 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <div className="ds-eyebrow">Spacing scale · 4px base</div>
        <div className="ds-card pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {space.map(s => (
            <div key={s.n} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr 60px', alignItems: 'center',
            }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>--ds-{s.n}</span>
              <span style={{ height: 12, width: s.v, background: 'var(--accent-soft)', borderRadius: 'var(--ds-r-1)' }} />
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>{s.v}px</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="ds-eyebrow">Radius scale</div>
        <div className="grid-4">
          {radius.map(r => (
            <div key={r.n} className="ds-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 56, height: 56,
                background: 'var(--accent-soft)',
                borderRadius: r.v === 999 ? '999px' : r.v,
              }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>--ds-{r.n}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.v === 999 ? '999px' : `${r.v}px`}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MotionSpec() {
  const tokens = [
    { name: '--ds-dur-fast', v: '120ms', use: 'hover, focus, micro-state' },
    { name: '--ds-dur',      v: '200ms', use: 'panel reveal, button press, tab switch' },
    { name: '--ds-dur-slow', v: '360ms', use: 'page-level transitions, only when needed' },
    { name: '--ds-ease',     v: 'cubic-bezier(.2,.7,.2,1)', use: 'all timings — natural ease-out' },
  ];
  return (
    <div className="ds-card" style={{ overflow: 'hidden' }}>
      {tokens.map((t, i) => (
        <div key={t.name} style={{
          display: 'grid', gridTemplateColumns: '180px 220px 1fr', alignItems: 'center',
          padding: '12px 18px',
          borderTop: i ? '1px solid var(--line-soft)' : 'none',
        }}>
          <span className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>{t.name}</span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.v}</span>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{t.use}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Principles, ColorTokens, TypeSpec, SpacingSpec, MotionSpec });
