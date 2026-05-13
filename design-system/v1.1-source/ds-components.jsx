// ds-components.jsx — gallery sections demoing every component

function ButtonsDoc() {
  return (
    <div className="grid-2">
      <Tile label="Variants" footer="Primary uses green sparingly. Secondary is the default for almost everything. Ghost for tertiary actions.">
        <Btn variant="primary">Spawn agent</Btn>
        <Btn variant="secondary">Edit identity</Btn>
        <Btn variant="soft">Pause</Btn>
        <Btn variant="ghost">Cancel</Btn>
        <Btn variant="danger">Stop</Btn>
      </Tile>
      <Tile label="Sizes · sm / md / lg" footer="lg only for the canonical primary action on a screen (e.g. Send).">
        <Btn size="sm">Add key</Btn>
        <Btn size="md">Send task</Btn>
        <Btn size="lg" variant="primary">Send</Btn>
      </Tile>
      <Tile label="With keyboard hint" footer="kbd surfaces a shortcut. Always present for power actions.">
        <Btn variant="primary" kbd="⏎">Send</Btn>
        <Btn kbd="d" variant="danger">Dismiss</Btn>
        <Btn kbd="⌘K">Command</Btn>
      </Tile>
      <Tile label="Icon-only · circular" footer="Square chip for toolbar utilities like theme toggle.">
        <button aria-label="Toggle theme" style={{
          width: 34, height: 34, borderRadius: 'var(--ds-r-pill)',
          border: '1px solid var(--line-strong)', background: 'var(--bg-elev)',
          color: 'var(--text)', display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}>☾</button>
        <button aria-label="Settings" style={{
          width: 34, height: 34, borderRadius: 'var(--ds-r-pill)',
          border: '1px solid var(--line-strong)', background: 'var(--bg-elev)',
          color: 'var(--text)', display: 'grid', placeItems: 'center', cursor: 'pointer',
          fontFamily: 'var(--ds-font-mono)', fontSize: 14,
        }}>⚙</button>
      </Tile>
    </div>
  );
}

function PillsDoc() {
  return (
    <div className="grid-2">
      <Tile label="Status pills · meaning, not decoration" footer="Mono lowercase. Dot = live state. Pulse only when literally active.">
        <Pill tone="success" dot pulse>running</Pill>
        <Pill tone="neutral" dot>idle</Pill>
        <Pill tone="warn" dot>resting</Pill>
        <Pill tone="info" dot>scheduled</Pill>
        <Pill tone="danger" dot>error</Pill>
        <Pill tone="ghost">stopped</Pill>
      </Tile>
      <Tile label="Sizes" footer="xs in dense rows, sm everywhere, md only for status as a focal point.">
        <Pill size="xs" tone="success" dot>running</Pill>
        <Pill size="sm" tone="success" dot>running</Pill>
        <Pill size="md" tone="success" dot pulse>running</Pill>
      </Tile>
      <Tile label="Tags · identity / category" footer="Sans, sentence case. Different shape language than status.">
        <Tag hue={agentHue('doug')}>@doug</Tag>
        <Tag hue={agentHue('simon')}>@simon</Tag>
        <Tag hue={agentHue('hobby')}>@hobby</Tag>
        <Tag hue={agentHue('jodin')}>@jodin</Tag>
      </Tile>
      <Tile label="Pill DO/DON'T" footer="DO: state. DON'T: random emphasis.">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Pill tone="success" dot>running</Pill>
          <span style={{ fontSize: 11, color: 'var(--accent-ink)' }}>✓ live state</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Pill tone="info">new</Pill>
          <span style={{ fontSize: 11, color: 'var(--danger)' }}>✗ marketing</span>
        </div>
      </Tile>
    </div>
  );
}

function AgentsDoc() {
  const names = ['doug', 'simon', 'hobby', 'jodin', 'maven', 'orin'];
  return (
    <div className="grid-2">
      <Tile label="Avatar · letter + hue, deterministic" footer="Hue derived from name hash → same agent, same color, every screen.">
        {names.map(n => <Avatar key={n} name={n} size={36} />)}
      </Tile>
      <Tile label="With status indicator" footer="Pair avatar + status only in dense rosters where pills are too heavy.">
        <Avatar name="doug"  size={36} status="running" />
        <Avatar name="simon" size={36} status="warn" />
        <Avatar name="hobby" size={36} status="idle" />
        <Avatar name="jodin" size={36} status="error" />
      </Tile>
      <Tile label="Sizes · 20 / 28 / 36 / 48" footer="20 for inline chips, 28 in lists, 36 in cards, 48 in detail headers.">
        <Avatar name="simon" size={20} />
        <Avatar name="simon" size={28} />
        <Avatar name="simon" size={36} />
        <Avatar name="simon" size={48} />
      </Tile>
      <Tile label="Identity card · the canonical agent header" footer="Use on Agent detail page header and as a hover-card.">
        <AgentIdentityCard />
      </Tile>
    </div>
  );
}

function AgentIdentityCard() {
  return (
    <div style={{
      width: '100%', maxWidth: 360,
      display: 'flex', alignItems: 'center', gap: 14,
      padding: 16, background: 'var(--bg-elev)',
      border: '1px solid var(--line)', borderRadius: 'var(--ds-r-3)',
    }}>
      <Avatar name="jodin" size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ font: '600 17px/1.2 var(--ds-font-sans)' }}>jodin</span>
          <Pill size="xs" tone="success" dot pulse>running</Pill>
        </div>
        <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 4 }}>
          <span className="mono">pid 62014</span>
          <span style={{ margin: '0 6px' }}>·</span>
          <span className="mono">claude-sonnet-4-6</span>
        </div>
      </div>
      <Btn size="sm" variant="danger">Stop</Btn>
    </div>
  );
}

function FieldsDoc() {
  return (
    <div className="grid-2">
      <Tile label="Text input">
        <div style={{ width: '100%' }}>
          <Field label="Agent name" placeholder="e.g. maven" />
        </div>
      </Tile>
      <Tile label="With hint + mono">
        <div style={{ width: '100%' }}>
          <Field label="Brain path" mono defaultValue="~/.config/2200/agents/jodin/brain" hint="One file per agent. Sync to git for portability." />
        </div>
      </Tile>
      <Tile label="Textarea">
        <div style={{ width: '100%' }}>
          <Field label="Send task" textarea placeholder="Tell jodin what to do…" />
        </div>
      </Tile>
      <Tile label="Segmented control">
        <Segmented value="checkpointed" options={['pure', 'checkpointed', 'destructive']} />
      </Tile>
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div role="tablist" style={{
      display: 'inline-flex', padding: 3,
      background: 'var(--bg-sunk)', border: '1px solid var(--line)',
      borderRadius: 'var(--ds-r-pill)',
    }}>
      {options.map(o => {
        const active = o === value;
        return (
          <button key={o} role="tab" aria-selected={active}
            onClick={() => onChange && onChange(o)} style={{
            appearance: 'none', border: 0,
            background: active ? 'var(--bg-elev)' : 'transparent',
            color: active ? 'var(--text)' : 'var(--text-3)',
            boxShadow: active ? 'var(--shadow-1)' : 'none',
            font: '500 12px/1 var(--ds-font-mono)',
            letterSpacing: '.04em', textTransform: 'lowercase',
            padding: '7px 14px', borderRadius: '999px', cursor: 'pointer',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

function CardsDoc() {
  return (
    <div className="grid-2">
      <Tile label="Agent card · fleet item">
        <AgentCard name="hobby" pid="61217" task="no current task" status="running" />
      </Tile>
      <Tile label="Agent card · with task">
        <AgentCard name="jodin" pid="62014" task="refresh spotify oauth" status="running" />
      </Tile>
      <Tile label="Agent card · stuck">
        <AgentCard name="simon" pid="61211" task="invalid_grant on token refresh" status="warn" />
      </Tile>
      <Tile label="Info card · KV grid">
        <KVCard />
      </Tile>
    </div>
  );
}

function AgentCard({ name, pid, task, status }) {
  const tone = status === 'running' ? 'success' : status === 'warn' ? 'warn' : status === 'error' ? 'danger' : 'neutral';
  return (
    <a href="#" onClick={(e) => e.preventDefault()} style={{
      width: '100%', maxWidth: 360, textDecoration: 'none', color: 'inherit',
      display: 'flex', flexDirection: 'column', gap: 10,
      padding: 14, background: 'var(--bg-elev)',
      border: '1px solid var(--line)', borderRadius: 'var(--ds-r-3)',
      transition: 'border-color var(--ds-dur-fast) var(--ds-ease), background var(--ds-dur-fast) var(--ds-ease)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={name} size={28} />
        <span style={{ font: '600 15px/1 var(--ds-font-sans)' }}>{name}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>pid {pid}</span>
        <span style={{ flex: 1 }} />
        <Pill size="xs" tone={tone} dot pulse={status === 'running'}>{status}</Pill>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', color: task === 'no current task' ? 'var(--text-3)' : 'var(--text-2)' }}>
        <Meta style={{ minWidth: 32 }}>task</Meta>
        <span style={{ fontSize: 13.5, lineHeight: 1.4 }}>{task}</span>
      </div>
    </a>
  );
}

function KVCard() {
  const rows = [
    ['state',     <Pill size="xs" tone="success" dot>running</Pill>],
    ['pulse',     <Pill size="xs" tone="warn" dot>resting</Pill>],
    ['pid',       <span className="mono" style={{ fontSize: 13 }}>62014</span>],
    ['model',     <span className="mono" style={{ fontSize: 13 }}>claude-sonnet-4-6</span>],
    ['heartbeat', <span className="mono" style={{ fontSize: 13 }}>2026-05-13 12:57:31</span>],
    ['spawned',   <span className="mono" style={{ fontSize: 13 }}>2026-05-13 01:23:14</span>],
  ];
  return (
    <div className="ds-card" style={{ overflow: 'hidden', width: '100%' }}>
      {rows.map(([k, v], i) => (
        <div key={k} style={{
          display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center',
          padding: '10px 14px', borderTop: i ? '1px solid var(--line-soft)' : 'none', gap: 8,
        }}>
          <Meta>{k}</Meta>
          <div>{v}</div>
        </div>
      ))}
    </div>
  );
}

function NavDoc() {
  return (
    <div className="grid-2">
      <Tile label="Page header · the new shape">
        <PageHeader />
      </Tile>
      <Tile label="Breadcrumb · one line of mono, that's it">
        <Breadcrumb path={['2200', 'agent', 'jodin']} />
      </Tile>
      <Tile label="Tab bar">
        <Tabs items={['Overview', 'Brain', 'Schedules', 'Tools', 'Chat']} active="Overview" />
      </Tile>
      <Tile label="Reaction bar · single click">
        <ReactionBar />
      </Tile>
    </div>
  );
}

function PageHeader() {
  return (
    <div style={{ width: '100%', maxWidth: 520 }}>
      <Breadcrumb path={['2200', 'agent', 'jodin']} />
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
        <div>
          <h1 style={{
            font: '600 30px/1.15 var(--ds-font-sans)',
            letterSpacing: '-0.02em', margin: '0 0 4px',
          }}>jodin</h1>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 14, maxWidth: '38ch' }}>
            Identity, status, and quick actions for this agent.
          </p>
        </div>
        <Pill size="md" tone="success" dot pulse>running</Pill>
      </div>
    </div>
  );
}

function Breadcrumb({ path }) {
  return (
    <div className="mono" style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      font: '500 11px/1 var(--ds-font-mono)',
      letterSpacing: '.08em', textTransform: 'uppercase',
      color: 'var(--text-3)',
    }}>
      {path.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span aria-hidden="true" style={{ color: 'var(--text-4)' }}>/</span>}
          <span style={{ color: i === path.length - 1 ? 'var(--text-2)' : 'var(--text-3)' }}>{p}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function Tabs({ items, active }) {
  const [a, setA] = React.useState(active);
  return (
    <div role="tablist" style={{
      display: 'inline-flex', gap: 2, padding: 2,
      background: 'var(--bg-sunk)', border: '1px solid var(--line)',
      borderRadius: 'var(--ds-r-2)',
    }}>
      {items.map(it => (
        <button key={it} role="tab" aria-selected={a === it} onClick={() => setA(it)} style={{
          appearance: 'none', border: 0,
          background: a === it ? 'var(--bg-elev)' : 'transparent',
          color: a === it ? 'var(--text)' : 'var(--text-3)',
          boxShadow: a === it ? 'var(--shadow-1)' : 'none',
          font: '500 13px/1 var(--ds-font-sans)',
          padding: '8px 14px', borderRadius: 'calc(var(--ds-r-2) - 2px)', cursor: 'pointer',
        }}>{it}</button>
      ))}
    </div>
  );
}

function ReactionBar() {
  const [picked, setPicked] = React.useState({ ack: 1 });
  const reactions = [
    { id: 'ack',   sym: '✓', count: picked.ack || 0 },
    { id: 'thumb', sym: '👍', count: picked.thumb || 0 },
    { id: 'eyes',  sym: '👀', count: picked.eyes || 0 },
    { id: 'heart', sym: '❤', count: picked.heart || 0 },
  ];
  const toggle = (id) => setPicked(p => ({ ...p, [id]: p[id] ? 0 : 1 }));
  return (
    <div style={{ display: 'inline-flex', gap: 6 }}>
      {reactions.map(r => {
        const on = r.count > 0;
        return (
          <button key={r.id} onClick={() => toggle(r.id)} style={{
            appearance: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 26, padding: '0 9px',
            background: on ? 'var(--accent-soft)' : 'var(--bg-sunk)',
            border: `1px solid ${on ? 'transparent' : 'var(--line)'}`,
            borderRadius: 'var(--ds-r-pill)',
            color: on ? 'var(--accent-ink)' : 'var(--text-2)',
            font: '500 12px/1 var(--ds-font-mono)', cursor: 'pointer',
          }}>
            <span style={{ fontFamily: 'var(--ds-font-sans)' }}>{r.sym}</span>
            {r.count > 0 && <span>{r.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function FeedbackDoc() {
  return (
    <div className="grid-2">
      <Tile label="Toast">
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: 'var(--bg-elev)', border: '1px solid var(--line-strong)',
          borderRadius: 'var(--ds-r-3)', boxShadow: 'var(--shadow-2)',
        }}>
          <Dot tone="running" pulse />
          <span style={{ fontSize: 14 }}>jodin started running</span>
          <Btn size="sm" variant="ghost">Undo</Btn>
        </div>
      </Tile>
      <Tile label="Inline alert · warn">
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 14px',
          background: 'var(--warn-soft)',
          borderRadius: 'var(--ds-r-2)',
          border: '1px solid color-mix(in oklch, var(--warn) 25%, transparent)',
          maxWidth: 360,
        }}>
          <Dot tone="warn" size={8} style={{ marginTop: 6 }} />
          <div>
            <div style={{ fontWeight: 500, fontSize: 13.5, color: 'var(--text)' }}>Refresh token revoked</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 2 }}>
              Run a fresh <Code>2200 oauth login jodin spotify</Code>.
            </div>
          </div>
        </div>
      </Tile>
      <Tile label="Empty state">
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{
            margin: '0 auto 14px', width: 44, height: 44, borderRadius: '999px',
            background: 'var(--bg-sunk)', display: 'grid', placeItems: 'center',
            color: 'var(--text-3)', fontFamily: 'var(--ds-font-mono)', fontSize: 18,
          }}>·</div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Nothing waiting on you</div>
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Quiet is the goal.</div>
        </div>
      </Tile>
      <Tile label="Loading · skeleton row">
        <div style={{ width: '100%' }}>
          <SkeletonRow />
          <div style={{ height: 8 }} />
          <SkeletonRow />
        </div>
      </Tile>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: '999px', background: 'var(--bg-hover)' }} />
      <div style={{ flex: 1, height: 10, borderRadius: 4, background: 'linear-gradient(90deg, var(--bg-hover), var(--bg-sunk), var(--bg-hover))', backgroundSize: '200% 100%', animation: 'dsShimmer 1.4s linear infinite' }} />
    </div>
  );
}

if (typeof document !== 'undefined' && !document.getElementById('ds-shim-kf')) {
  const s = document.createElement('style'); s.id = 'ds-shim-kf';
  s.textContent = `@keyframes dsShimmer{from{background-position:0 0}to{background-position:-200% 0}}`;
  document.head.appendChild(s);
}

Object.assign(window, {
  ButtonsDoc, PillsDoc, AgentsDoc, FieldsDoc, CardsDoc, NavDoc, FeedbackDoc,
  Segmented, Breadcrumb, Tabs, ReactionBar, AgentCard, AgentIdentityCard, PageHeader,
});
