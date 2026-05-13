// ds-app.jsx — composes the whole spec, wires Tweaks + theme

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": true,
  "accentHue": 150,
  "density": "regular",
  "radius": "regular"
}/*EDITMODE-END*/;

const SECTIONS = [
  { id: 'intro',        label: 'Intro' },
  { id: 'principles',   label: 'Principles' },
  { id: 'color',        label: 'Color' },
  { id: 'type',         label: 'Type' },
  { id: 'space',        label: 'Space & radius' },
  { id: 'motion',       label: 'Motion' },
  { id: 'buttons',      label: 'Buttons' },
  { id: 'pills',        label: 'Pills & tags' },
  { id: 'agents',       label: 'Agent identity' },
  { id: 'fields',       label: 'Fields' },
  { id: 'cards',        label: 'Cards' },
  { id: 'nav',          label: 'Navigation' },
  { id: 'feedback',     label: 'Feedback' },
  { id: 'chat',         label: 'Chat' },
  { id: 'attachments',  label: 'Attachments' },
  { id: 'screens',      label: 'Screens' },
  { id: 'handoff',      label: 'Handoff' },
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [active, setActive] = React.useState('intro');

  // Apply tweaks to <html>
  React.useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', !!t.dark);
    html.style.setProperty('--accent-h', t.accentHue);
    html.dataset.density = t.density || 'regular';
    html.dataset.radius = t.radius || 'regular';
  }, [t.dark, t.accentHue, t.density, t.radius]);

  // Scroll-spy nav
  React.useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-80px 0px -60% 0px' });
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <>
      <nav className="ds-nav">
        <div className="ds-nav-inner">
          <div className="ds-brand">
            <span className="glyph">22</span>
            <span>2200</span>
            <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>· Design System</span>
          </div>
          <div style={{ display: 'flex', gap: 2, overflowX: 'auto', maxWidth: '60vw' }}>
            {SECTIONS.slice(1, 15).map(s => (
              <a key={s.id} href={`#${s.id}`} className={active === s.id ? 'active' : ''}>{s.label}</a>
            ))}
          </div>
          <button onClick={() => setTweak('dark', !t.dark)} aria-label="Toggle theme" style={{
            appearance: 'none', border: '1px solid var(--line)',
            background: 'var(--bg-elev)', color: 'var(--text)',
            width: 32, height: 32, borderRadius: 999, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}>{t.dark ? '☾' : '☀'}</button>
        </div>
      </nav>

      <main className="ds-app">

        {/* HERO ─────────────────────────────────────────────────────────── */}
        <section id="intro" className="ds-hero">
          <div className="meta">
            <span>2200</span><span>·</span><span>design-system</span><span>·</span><span>v0.1</span><span>·</span><span>{t.dark ? 'dark' : 'light'}</span>
          </div>
          <h1>An operations room for a fleet of agents.</h1>
          <p className="lede">
            A reset of the 2200 visual language. Two voices — humanist sans for prose, JetBrains Mono
            for data — one signature color, and a calm grid. Built so Normals get it on first sight,
            and so Claude Code has a single source of truth to build against.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Pill size="md" tone="success" dot pulse>running</Pill>
            <Pill size="md" tone="info" dot>scheduled</Pill>
            <Pill size="md" tone="warn" dot>needs you</Pill>
            <Pill size="md" tone="neutral" dot>idle</Pill>
          </div>
        </section>

        {/* PRINCIPLES ────────────────────────────────────────────────────── */}
        <section id="principles" className="ds-section">
          <div className="ds-eyebrow">01 · Foundations</div>
          <h2>Principles</h2>
          <p className="lede">Four rules. Every other decision in this document falls out of these.</p>
          <Principles />
        </section>

        {/* COLOR ─────────────────────────────────────────────────────────── */}
        <section id="color" className="ds-section">
          <h2>Color</h2>
          <p className="lede">
            Tokens, not hex codes. All values are oklch so they age well across light, dark, and any
            future accent shift. Toggle dark mode at the top right to compare.
          </p>
          <ColorTokens />
        </section>

        {/* TYPE ──────────────────────────────────────────────────────────── */}
        <section id="type" className="ds-section">
          <h2>Type</h2>
          <p className="lede">
            Inter for prose and UI. JetBrains Mono for IDs, values, code, eyebrows. Pick one per role
            and never mix within a single chunk of meaning.
          </p>
          <TypeSpec />
        </section>

        {/* SPACE ─────────────────────────────────────────────────────────── */}
        <section id="space" className="ds-section">
          <h2>Space & radius</h2>
          <p className="lede">
            4-pixel base. Radius scale tops out at 14px to keep things crisp; pill for status and
            actions only. Compact density compresses paddings without retokenizing.
          </p>
          <SpacingSpec />
        </section>

        {/* MOTION ────────────────────────────────────────────────────────── */}
        <section id="motion" className="ds-section">
          <h2>Motion</h2>
          <p className="lede">
            One ease curve, three durations. If you reach for a fourth, you're animating something
            you shouldn't.
          </p>
          <MotionSpec />
        </section>

        {/* ─── COMPONENTS ─────────────────────────────────────────────────── */}
        <section id="buttons" className="ds-section">
          <div className="ds-eyebrow">02 · Components</div>
          <h2>Buttons</h2>
          <p className="lede">One primary per screen. Use the green only on canonical commit actions.</p>
          <ButtonsDoc />
        </section>

        <section id="pills" className="ds-section">
          <h2>Pills & tags</h2>
          <p className="lede">Pills mean <em>state</em>. Tags mean <em>identity</em>. They look different on purpose.</p>
          <PillsDoc />
        </section>

        <section id="agents" className="ds-section">
          <h2>Agent identity</h2>
          <p className="lede">
            Avatars use a deterministic hash → hue, so each agent looks the same everywhere. The hue
            palette is reserved for agents; never use an agent hue to indicate state.
          </p>
          <AgentsDoc />
        </section>

        <section id="fields" className="ds-section">
          <h2>Fields</h2>
          <p className="lede">Mono for paths, IDs, and code samples. Sans for prose and natural-language fields.</p>
          <FieldsDoc />
        </section>

        <section id="cards" className="ds-section">
          <h2>Cards</h2>
          <p className="lede">
            One card shape, three sizes of content. KV cards for status, agent cards for rosters,
            quick-link cards for navigation.
          </p>
          <CardsDoc />
        </section>

        <section id="nav" className="ds-section">
          <h2>Navigation</h2>
          <p className="lede">
            The breadcrumb is one mono line — that's the entire chrome budget. Page title carries the
            weight. Tabs replace the all-caps "MORE FOR THIS AGENT" pattern.
          </p>
          <NavDoc />
        </section>

        <section id="feedback" className="ds-section">
          <h2>Feedback</h2>
          <p className="lede">Toasts for transient state. Inline alerts for context-bound issues. Empty states for quiet.</p>
          <FeedbackDoc />
        </section>

        <section id="chat" className="ds-section">
          <h2>Chat</h2>
          <p className="lede">
            The Agent page is chat-first. Every conversation has a persistent history that scrolls.
            Each agent has unlimited chats — start a new one for every distinct context, just like Claude.
          </p>
          <ChatDoc />
        </section>

        <section id="attachments" className="ds-section">
          <h2>Attachments</h2>
          <p className="lede">
            Files and images attach to messages, not the agent. The composer carries a tray; the message
            displays them as a footer to the bubble. Same chip shape across both.
          </p>
          <AttachmentsDoc />
        </section>

        {/* ─── SCREENS ────────────────────────────────────────────────────── */}
        <section id="screens" className="ds-section">
          <div className="ds-eyebrow">03 · Screens</div>
          <h2>The system in context</h2>
          <p className="lede">
            Every screen below uses only the tokens and components above. Use these as the canonical
            reference when porting the existing CLI to the web app.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
            <ScreenSubhead n="3.1" name="Fleet"    desc="The dashboard. Default route. Quiet by default; “needs you” is the single attention surface." />
            <ScreenFleet />

            <ScreenSubhead n="3.2" name="Studio"   desc="Multi-agent room. The composer is one column wide so the eye lands on conversation, not chrome." />
            <ScreenStudio />

            <ScreenSubhead n="3.3" name="Agent"    desc="Chat is the primary surface. A persistent left rail lists every chat (like Claude). Identity, status, and tools sit alongside — never in front of — the conversation." />
            <ScreenAgent />

            <ScreenSubhead n="3.4" name="Chat · focused"  desc="A single chat full-bleed. Same composer, same bubbles, no sidebar — for deep work on one thread. Reached via the chat title bar or ⌘+\\." />
            <ScreenChat />

            <ScreenSubhead n="3.5" name="Inbox"    desc="Pending events. Selection is colored, not boxed. Keyboard-first." />
            <ScreenInbox />

            <ScreenSubhead n="3.6" name="Budget"   desc="One big number, one progress sliver, one tone of green per row. No other chrome." />
            <ScreenBudget />

            <ScreenSubhead n="3.7" name="Settings" desc="Provider rows are uniform. Theme + density + accent live in the Tweaks panel for now." />
            <ScreenSettings />
          </div>
        </section>

        {/* ─── HANDOFF ────────────────────────────────────────────────────── */}
        <section id="handoff" className="ds-section">
          <div className="ds-eyebrow">04 · Handoff</div>
          <h2>For Claude Code</h2>
          <p className="lede">A concrete cheat-sheet for the agent that ports this to production code.</p>

          <div className="grid-2">
            <div className="ds-card pad">
              <Meta>tokens are the source of truth</Meta>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 10 }}>
                All colors, spacing, type, and radius come from CSS custom properties on <Code>:root</Code>.
                Dark mode is <Code>html.dark</Code>. Density is <Code>html[data-density="compact"]</Code>.
                Radius preset is <Code>html[data-radius="sharp|regular|soft"]</Code>.
                Accent hue is <Code>--accent-h</Code> (an integer); all accent shades derive from it via oklch.
              </p>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 10 }}>
                Never hard-code hex. Never invent new colors. If you need an in-between shade,
                use <Code>color-mix(in oklch, var(--accent) 30%, var(--bg))</Code>.
              </p>
            </div>

            <div className="ds-card pad">
              <Meta>two voices · one rule</Meta>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 10 }}>
                Sans (<Code>var(--ds-font-sans)</Code>): page titles, body prose, button labels,
                form labels, alert copy.
              </p>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 10 }}>
                Mono (<Code>var(--ds-font-mono)</Code>): breadcrumbs, eyebrows, pills,
                timestamps, paths, IDs, model names, env vars, kbd, raw values, code.
              </p>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 10 }}>
                If a value <em>could be copied to a terminal</em>, it's mono.
              </p>
            </div>

            <div className="ds-card pad">
              <Meta>green means alive</Meta>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 10 }}>
                Green appears in: running pill, primary button, focus ring, progress fill,
                <Code>ok</Code> states, send button.
              </p>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 10 }}>
                Never use green for: a notification badge, a brand flourish, a chart axis,
                a generic "interactive" cue. If it's green, it can be acted on or it is
                presently alive.
              </p>
            </div>

            <div className="ds-card pad">
              <Meta>agent hue palette</Meta>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 10 }}>
                Six hues (<Code>--agent-1</Code> through <Code>--agent-6</Code>). Assign by hashing the
                agent name modulo 6. Same agent → same hue across every screen, light + dark.
              </p>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 10 }}>
                Hues are <strong>identity only</strong>. State is the green/red/amber/blue system.
                A purple "iris" agent who's running renders as a purple avatar with a green dot,
                not a purple pill.
              </p>
            </div>

            <div className="ds-card pad">
              <Meta>density tiers</Meta>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 10 }}>
                Default is comfortable. Power users can flip to compact via
                <Code>html[data-density="compact"]</Code> — paddings and row heights collapse,
                type size does not. Expose this as a setting once it ships, not as a per-screen toggle.
              </p>
            </div>

            <div className="ds-card pad">
              <Meta>chat is the agent's home</Meta>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 10 }}>
                The Agent page leads with chat. The left rail holds a list of every chat (unlimited),
                identity, and quick links to Brain / Schedules / Tools. The main pane is the active
                conversation with its full scroll history — newest at the bottom — and the composer
                pinned to the bottom edge.
              </p>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 10 }}>
                Attachments live on messages, not on the agent. The composer's tray previews them
                before send; the message footer keeps them after. <Code>+</Code> opens the file picker;
                drag-and-drop onto the composer works too. Image types render as 76px square thumbs;
                everything else as a typed file chip.
              </p>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 10 }}>
                Mode (<Code>pure</Code>, <Code>checkpointed</Code>, <Code>destructive</Code>) applies
                to the next message only — it does not change the chat's identity.
              </p>
            </div>

            <div className="ds-card pad">
              <Meta>the unbreakable rules</Meta>
              <ol style={{ color: 'var(--text-2)', fontSize: 14, paddingLeft: 18, margin: '10px 0 0' }}>
                <li>One primary action per screen.</li>
                <li>Breadcrumbs are one line, lowercase, mono. No <Code>DEFAULT-DARK · WS OPEN</Code> chrome.</li>
                <li>Pills carry state, tags carry identity. Never the other way around.</li>
                <li>If you need a new color, you don't. Use opacity or <Code>color-mix</Code>.</li>
                <li>Lowercase sentence-case for buttons and prose. ALL CAPS belongs only in <Code>&lt;Meta&gt;</Code>.</li>
              </ol>
            </div>
          </div>
        </section>

        <div className="ds-foot">
          <span>2200 · design system · v0.1 · 2026-05-13</span>
          <span>Tweaks panel toggles light/dark, accent hue, density, radius preset.</span>
        </div>
      </main>

      {/* Tweaks ────────────────────────────────────────────────────────── */}
      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak('dark', v)} />
        <TweakRadio label="Accent" value={t.accentHue}
          options={[
            { label: 'green',  value: 150 },
            { label: 'blue',   value: 240 },
            { label: 'amber',  value: 70  },
            { label: 'iris',   value: 280 },
          ]}
          onChange={(v) => setTweak('accentHue', v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density}
          options={['compact', 'regular', 'comfy']}
          onChange={(v) => setTweak('density', v)} />
        <TweakRadio label="Radius" value={t.radius}
          options={['sharp', 'regular', 'soft']}
          onChange={(v) => setTweak('radius', v)} />
      </TweaksPanel>
    </>
  );
}

function ScreenSubhead({ n, name, desc }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
        <Meta>{n}</Meta>
        <h3 style={{
          font: '600 22px/1.2 var(--ds-font-sans)',
          letterSpacing: '-0.015em', margin: 0,
        }}>{name}</h3>
      </div>
      <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 14, maxWidth: '64ch' }}>{desc}</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
