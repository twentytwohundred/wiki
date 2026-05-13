// ds-screens.jsx — concrete mockups using the design system

function ScreenFrame({ children }) {
  // A faux app window inside the spec, so screens look like screens.
  return (
    <div style={{
      border: '1px solid var(--line)',
      borderRadius: 'var(--ds-r-3)',
      background: 'var(--bg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-1)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 36, padding: '0 14px',
        borderBottom: '1px solid var(--line-soft)',
        background: 'var(--bg-elev)',
      }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--bg-hover)' }} />
        <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--bg-hover)' }} />
        <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--bg-hover)' }} />
        <span className="mono" style={{ marginLeft: 12, fontSize: 11, color: 'var(--text-3)' }}>
          2200 · local
        </span>
      </div>
      <div style={{ padding: '36px 40px 40px' }}>
        {children}
      </div>
    </div>
  );
}

function ScreenHeader({ crumbs, title, sub, actions, status }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <Breadcrumb path={crumbs} />
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginTop: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{
              font: '600 30px/1.15 var(--ds-font-sans)',
              letterSpacing: '-0.02em', margin: 0,
            }}>{title}</h1>
            {status}
          </div>
          {sub && <p style={{ margin: '6px 0 0', color: 'var(--text-2)', fontSize: 14.5, maxWidth: '60ch' }}>{sub}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
      </div>
    </div>
  );
}

// ── Fleet ────────────────────────────────────────────────────────────────────
function ScreenFleet() {
  const agents = [
    { name: 'hobby', pid: '61217', status: 'running', task: 'no current task' },
    { name: 'simon', pid: '61211', status: 'warn',    task: 'invalid_grant on token refresh' },
    { name: 'jodin', pid: '62014', status: 'running', task: 'refreshing spotify oauth' },
  ];
  return (
    <ScreenFrame>
      <ScreenHeader
        crumbs={['2200', 'fleet']}
        title="Fleet"
        sub="Mission control for the agents on this instance."
        actions={<>
          <Btn variant="ghost" size="sm">Inbox · 15</Btn>
          <Btn variant="ghost" size="sm">Budget</Btn>
          <Btn variant="ghost" size="sm">Settings</Btn>
          <Btn variant="primary" size="md">Spawn agent</Btn>
        </>}
      />

      <SectionTitle eyebrow="needs you · 0" label="Nothing waiting on you. Quiet is the goal." />

      <div style={{ height: 32 }} />

      <SectionTitle eyebrow="running · 3" />
      <div className="grid-3" style={{ marginTop: 8 }}>
        {agents.map(a => <AgentCard key={a.name} {...a} />)}
      </div>

      <div style={{ height: 32 }} />

      <SectionTitle eyebrow="idle · 0" label="No idle agents." />
    </ScreenFrame>
  );
}

function SectionTitle({ eyebrow, label }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 12,
        paddingBottom: 10, borderBottom: '1px solid var(--line-soft)',
      }}>
        <Meta>{eyebrow}</Meta>
      </div>
      {label && <p style={{ margin: '14px 0 0', color: 'var(--text-3)', fontSize: 14 }}>{label}</p>}
    </div>
  );
}

// ── Studio (room) ────────────────────────────────────────────────────────────
function ScreenStudio() {
  const messages = [
    { who: 'simon', time: '12:21', mentions: ['@hobby', '@doug'],
      body: <>
        <p>Token refresh schedule is wired for 8:00 AM CT, but two issues need eyes:</p>
        <ul style={{ margin: '6px 0', paddingLeft: 20 }}>
          <li><strong>jodin · Spotify</strong> refresh token returning <Code>invalid_grant</Code></li>
          <li><strong>hobby · google-openid</strong> missing client credentials</li>
        </ul>
        <p>The <Code>invalid_grant</Code> means the refresh token was revoked server-side — no cron can fix it. Need a fresh OAuth handshake.</p>
      </>,
      reactions: { ack: 2, eyes: 1 },
    },
    { who: 'hobby', time: '12:23', mentions: ['@doug', '@simon'],
      body: <>
        <p>Noted on both.</p>
        <p>For <Code>jodin</Code>'s Spotify token, server-side revocation — doug needs to run a fresh <Code>2200 oauth login</Code> via browser. For Google, no active integration depends on it; safe to leave as a dormant config gap.</p>
      </>,
      reactions: { ack: 1 },
    },
  ];
  return (
    <ScreenFrame>
      <ScreenHeader
        crumbs={['2200', 'studio']}
        title="Studio"
        sub="Multi-agent room. Tag with @, react with one click."
        actions={<Btn variant="ghost" size="sm">← Fleet</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 28 }}>
        {/* sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <Meta>members</Meta>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <RosterRow name="doug"  status="running" you />
              <RosterRow name="simon" status="warn" />
              <RosterRow name="hobby" status="idle" />
              <RosterRow name="jodin" status="running" />
            </div>
          </div>
          <div>
            <Meta>atmosphere</Meta>
            <p style={{ margin: '8px 0 0', color: 'var(--text-3)', fontSize: 13 }}>lively · 4 active</p>
          </div>
        </aside>

        {/* feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {messages.map((m, i) => <Message key={i} {...m} />)}
          <Composer />
        </div>
      </div>
    </ScreenFrame>
  );
}

function RosterRow({ name, status, you }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Avatar name={name} size={22} status={status} />
      <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: you ? 500 : 400 }}>{name}</span>
      {you && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>you</span>}
    </div>
  );
}

function Message({ who, time, mentions, body, reactions }) {
  return (
    <article>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Avatar name={who} size={28} />
        <span style={{ fontWeight: 600, fontSize: 14.5 }}>{who}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{time}</span>
        {mentions && mentions.map(m => (
          <Tag key={m} hue={agentHue(m.replace('@',''))}>{m}</Tag>
        ))}
      </div>
      <div style={{ marginLeft: 38, color: 'var(--text)', fontSize: 14.5, lineHeight: 1.55 }}>
        {body}
      </div>
      <div style={{ marginLeft: 38, marginTop: 10 }}>
        <ReactionBar />
      </div>
    </article>
  );
}

function Composer() {
  return (
    <div style={{
      background: 'var(--bg-elev)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--ds-r-3)',
      padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Meta>tag</Meta>
        <Tag hue={agentHue('doug')}>@doug</Tag>
        <Tag hue={agentHue('simon')}>@simon</Tag>
        <Tag hue={agentHue('hobby')}>@hobby</Tag>
        <Tag hue={agentHue('jodin')}>@jodin</Tag>
      </div>
      <textarea placeholder="Message studio … use @name to direct it." style={{
        width: '100%', resize: 'vertical', minHeight: 72,
        background: 'var(--bg-sunk)', border: '1px solid var(--line)',
        borderRadius: 'var(--ds-r-2)', padding: '12px 14px',
        font: '400 14.5px/1.5 var(--ds-font-sans)', color: 'var(--text)',
        outline: 'none',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>
          <Kbd>⌘</Kbd> + <Kbd>⏎</Kbd> to send
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" size="sm">Attach</Btn>
          <Btn variant="primary" size="md" kbd="⏎">Send</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Agent detail · chat-first ────────────────────────────────────────────────
function ScreenAgent() {
  const [activeChat, setActiveChat] = React.useState('spotify');
  const chats = [
    { id: 'spotify',   title: 'Spotify OAuth refresh', snippet: 'Open the browser flow. Also attached…', time: '12:24', active: true },
    { id: 'brain',     title: 'Brain audit',           snippet: '3 notes look stale — want me to consoli…', time: '11:02', unread: true },
    { id: 'cron',      title: 'Cron schedule review',  snippet: 'Daily report is wired; here is the full…', time: 'Mon' },
    { id: 'setup',     title: 'Setup notes',           snippet: 'Identity provisioned. Tools registered.', time: 'May 8' },
  ];
  return (
    <ScreenFrame>
      <ScreenHeader
        crumbs={['2200', 'agent', 'jodin']}
        title="jodin"
        sub="Chat with this agent. Each thread keeps its full history."
        status={<Pill size="md" tone="success" dot pulse>running</Pill>}
        actions={<>
          <Btn variant="ghost" size="sm">← Fleet</Btn>
          <Btn variant="danger" size="sm">Stop</Btn>
        </>}
      />

      <div style={{
        display: 'grid', gridTemplateColumns: '260px 1fr',
        gap: 0,
        border: '1px solid var(--line)', borderRadius: 'var(--ds-r-3)',
        background: 'var(--bg-elev)', overflow: 'hidden',
        minHeight: 620,
      }}>
        {/* ── Sidebar ────────────────────────────────────────────────── */}
        <aside style={{
          borderRight: '1px solid var(--line-soft)',
          background: 'var(--bg)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Identity block */}
          <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--line-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name="jodin" size={36} status="running" />
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 14.5px/1.1 var(--ds-font-sans)' }}>jodin</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }} className="mono">claude-sonnet-4-6</div>
              </div>
            </div>
            <Btn variant="primary" size="sm" style={{ width: '100%', marginTop: 12, justifyContent: 'flex-start' }}>
              <span style={{ marginRight: 6 }}>＋</span> New chat
            </Btn>
          </div>

          {/* Chat list */}
          <div style={{ padding: '12px 8px 12px 8px', flex: 1, overflow: 'auto' }}>
            <div style={{ padding: '0 6px 8px' }}>
              <Meta>chats · 4</Meta>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {chats.map(c => (
                <ChatListRow key={c.id} {...c}
                  active={activeChat === c.id}
                  onClick={() => setActiveChat(c.id)}
                />
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div style={{ padding: '10px 10px 14px', borderTop: '1px solid var(--line-soft)' }}>
            <div style={{ padding: '4px 6px 6px' }}>
              <Meta>more</Meta>
            </div>
            <SidebarLink label="Brain"     hint="notes" />
            <SidebarLink label="Schedules" hint="cron · timers" />
            <SidebarLink label="Tools"     hint="mcp servers" />
            <SidebarLink label="Status"    hint="pid · heartbeat · spawned" />
          </div>
        </aside>

        {/* ── Chat pane ─────────────────────────────────────────────── */}
        <section style={{
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg)',
          minHeight: 620,
        }}>
          <div style={{ padding: '0 24px' }}>
            <ChatTitleBar title="Spotify OAuth refresh" agent="jodin" count={6} />
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, padding: '24px',
            display: 'flex', flexDirection: 'column', gap: 18,
            overflowY: 'auto', maxHeight: 480,
          }}>
            <DayDivider label="Today" />
            <ChatMessage from="you" time="12:14" body={<span>Hey jodin — Simon flagged your Spotify refresh token's hitting <Code>invalid_grant</Code>. Can you take a look and tell me what's going on?</span>} />
            <ChatMessage from="agent" who="jodin" time="12:16" body={<>
              <p style={{ margin: 0 }}>On it. Pulled the supervisor log:</p>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                <li>2 failed refreshes at 12:19:53 UTC yesterday</li>
                <li>Spotify returned <Code>invalid_grant</Code> both times</li>
              </ul>
              <p style={{ margin: '8px 0 0' }}>This is server-side revocation — the token itself is dead. A cron retry can't fix it. We need a fresh OAuth handshake via the browser.</p>
            </>} attachments={[{ kind: 'file', name: 'supervisor.log', size: '14.2 KB' }]} />
            <ChatMessage from="you" time="12:22" body={<span>Got it. What's the command?</span>} />
            <ChatMessage from="agent" who="jodin" time="12:23" body={<>
              <p style={{ margin: 0 }}>Run: <Code>2200 oauth login jodin spotify</Code></p>
              <p style={{ margin: '8px 0 0' }}>It'll open a browser tab → Spotify consent → redirect back to <Code>~/.config/2200/oauth-apps.env</Code>. After that I can resume the daily report at 8:00 CT.</p>
              <p style={{ margin: '8px 0 0' }}>Want me to open the browser flow now, or do you want to handle it?</p>
            </>} />
            <ChatMessage from="you" time="12:24" body={<span>Open the browser flow. Also attached the failure log Simon sent over.</span>} attachments={[{ kind: 'file', name: 'oauth-failure.log', size: '2.3 KB' }, { kind: 'image', name: 'spotify-consent.png' }]} />
            <ChatMessage from="agent" who="jodin" thinking />
          </div>

          {/* Composer */}
          <div style={{ padding: '12px 24px 24px' }}>
            <ChatComposer agent="jodin" />
            <div style={{ marginTop: 8, color: 'var(--text-3)', fontSize: 12 }}>
              Brain, fs, and pub tools available. Mode applies to the next message only.
            </div>
          </div>
        </section>
      </div>
    </ScreenFrame>
  );
}

function DayDivider({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      color: 'var(--text-3)',
      margin: '4px 0',
    }}>
      <span style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
      <Meta>{label}</Meta>
      <span style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
    </div>
  );
}

function SidebarLink({ label, hint }) {
  return (
    <a href="#" onClick={(e) => e.preventDefault()} style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      padding: '8px 10px', borderRadius: 'var(--ds-r-2)',
      textDecoration: 'none', color: 'var(--text-2)',
      fontSize: 13.5,
    }}>
      <span style={{ color: 'var(--text)' }}>{label}</span>
      <span style={{ flex: 1 }} />
      <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{hint}</span>
      <span style={{ color: 'var(--text-3)' }}>→</span>
    </a>
  );
}

// ── Chat · focused full-bleed ─────────────────────────────────────────────────
function ScreenChat() {
  return (
    <ScreenFrame>
      <ScreenHeader
        crumbs={['2200', 'agent', 'jodin', 'chat', 'spotify-oauth-refresh']}
        title="Spotify OAuth refresh"
        sub={<>Chat with <span style={{ color: 'var(--text)' }}>jodin</span> · 6 messages · started 12:14 today</>}
        actions={<>
          <Btn variant="ghost" size="sm">← Back to jodin</Btn>
          <Btn variant="ghost" size="sm">Rename</Btn>
          <Btn variant="ghost" size="sm">Export</Btn>
        </>}
      />

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 760px)',
        justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <DayDivider label="Today" />
          <ChatMessage from="you" time="12:14" body={<span>Hey jodin — Simon flagged your Spotify refresh token's hitting <Code>invalid_grant</Code>. Can you take a look?</span>} />
          <ChatMessage from="agent" who="jodin" time="12:16" body={<>
            <p style={{ margin: 0 }}>On it. Two failed refreshes yesterday at 12:19:53 UTC — Spotify returned <Code>invalid_grant</Code> both times. That means the token's revoked server-side; no retry will fix it. We need a fresh OAuth handshake.</p>
          </>} attachments={[{ kind: 'file', name: 'supervisor.log', size: '14.2 KB' }]} />
          <ChatMessage from="you" time="12:24" body={<span>Open the browser flow. Also attached the failure log Simon sent over.</span>} attachments={[
            { kind: 'image', name: 'spotify-consent.png' },
            { kind: 'file', name: 'oauth-failure.log', size: '2.3 KB' },
          ]} />
          <ChatMessage from="agent" who="jodin" time="12:25" body={<>
            <p style={{ margin: 0 }}>Browser tab opened. After you complete consent, drop me a note here and I'll resume the 8:00 CT report.</p>
          </>} />

          <div style={{ marginTop: 12 }}>
            <ChatComposer agent="jodin" initialAttachments={[
              { kind: 'image', name: 'after-consent.png' },
            ]} />
            <div style={{ marginTop: 8, color: 'var(--text-3)', fontSize: 12, textAlign: 'center' }}>
              <Kbd>⌘</Kbd> + <Kbd>⏎</Kbd> to send · <Kbd>⌘</Kbd> + <Kbd>K</Kbd> to switch chats
            </div>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

// ── Inbox ────────────────────────────────────────────────────────────────────
function ScreenInbox() {
  const rows = [
    { sel: true,  tone: 'info',    who: 'jodin', kind: 'agent.migrated',  t: '19:59' },
    { sel: false, tone: 'warn',    who: 'jodin', kind: 'detector_trip',   t: '21:09' },
    { sel: false, tone: 'warn',    who: 'jodin', kind: 'detector_trip',   t: '01:23' },
    { sel: false, tone: 'warn',    who: 'simon', kind: 'token.revoked',   t: '01:27' },
    { sel: false, tone: 'neutral', who: 'hobby', kind: 'task.done',       t: '01:30' },
    { sel: false, tone: 'neutral', who: 'jodin', kind: 'note.added',      t: '01:42' },
    { sel: false, tone: 'warn',    who: 'jodin', kind: 'detector_trip',   t: '01:48' },
  ];
  return (
    <ScreenFrame>
      <ScreenHeader
        crumbs={['2200', 'inbox']}
        title={<>Inbox <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>· 15</span></>}
        sub="15 pending. Press j/k to move, e to respond, d to dismiss."
        actions={<Btn variant="ghost" size="sm">← Fleet</Btn>}
      />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '10px 14px', marginBottom: 16,
        background: 'var(--bg-sunk)', border: '1px solid var(--line)',
        borderRadius: 'var(--ds-r-2)',
      }}>
        <Meta>tier</Meta>
        <Segmented value="all" options={['all', 'critical', 'important', 'normal']} />
        <span style={{ flex: 1 }} />
        <Btn variant="ghost" size="sm">Reset</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 24 }}>
        <div>
          <Meta>pending · 15</Meta>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rows.map((r, i) => <InboxRow key={i} {...r} />)}
          </div>
        </div>
        <div>
          <Meta>focused</Meta>
          <div className="ds-card pad" style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Avatar name="jodin" size={28} />
              <span style={{ fontWeight: 600 }}>jodin</span>
              <Pill size="xs" tone="info" dot>passive</Pill>
              <span style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>19:59:22 UTC</span>
            </div>

            <KVMini rows={[
              ['kind',  <span className="mono">agent.migrated</span>],
              ['id',    <span className="mono" style={{ color: 'var(--text-3)' }}>notif_0d14671b0f444eda83b</span>],
              ['time',  <span className="mono" style={{ color: 'var(--text-3)' }}>2026-05-08T19:59:22Z</span>],
            ]} />

            <div style={{
              marginTop: 14, padding: '14px 16px',
              background: 'var(--bg-sunk)', border: '1px solid var(--line-soft)',
              borderRadius: 'var(--ds-r-2)', fontSize: 14, lineHeight: 1.55,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Agent migrated · jodin</div>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-2)' }}>
                <li>Brain notes imported: <strong>1</strong></li>
                <li>SCUT identity: provisioning skipped (run <Code>2200 agent identity provision</Code>)</li>
              </ul>
              <div style={{ marginTop: 8, color: 'var(--text-2)' }}>
                Continuity note: <Code>continuity-from-migration</Code>.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <input placeholder="Type response (optional ack)" style={{
                flex: 1, background: 'var(--bg-sunk)',
                border: '1px solid var(--line)', borderRadius: 'var(--ds-r-2)',
                padding: '10px 12px', font: '400 14px/1 var(--ds-font-sans)',
                color: 'var(--text)', outline: 'none',
              }} />
              <Btn variant="primary" size="md" kbd="⏎">Respond</Btn>
              <Btn variant="danger" size="md" kbd="d">Dismiss</Btn>
            </div>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

function InboxRow({ sel, tone, who, kind, t }) {
  return (
    <button style={{
      width: '100%', textAlign: 'left',
      display: 'grid', gridTemplateColumns: '76px 22px 1fr 60px',
      alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 'var(--ds-r-2)',
      border: '1px solid',
      borderColor: sel ? 'color-mix(in oklch, var(--accent) 50%, var(--line))' : 'var(--line-soft)',
      background: sel ? 'color-mix(in oklch, var(--accent-soft) 60%, var(--bg-elev))' : 'var(--bg-elev)',
      cursor: 'pointer',
    }}>
      <Pill size="xs" tone={tone} dot>{tone === 'warn' ? 'warn' : tone === 'info' ? 'info' : 'note'}</Pill>
      <Avatar name={who} size={22} />
      <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
        <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{who}</span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kind}</span>
      </span>
      <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>{t}</span>
    </button>
  );
}

function KVMini({ rows }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10 }}>
          <Meta>{k}</Meta>
          <span style={{ fontSize: 13 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ── Budget ───────────────────────────────────────────────────────────────────
function ScreenBudget() {
  return (
    <ScreenFrame>
      <ScreenHeader
        crumbs={['2200', 'budget']}
        title="Budget"
        sub="Daily spend per agent. Cap, cumulative, override, and per-day history."
        actions={<Btn variant="ghost" size="sm">← Fleet</Btn>}
      />

      <Meta>fleet today · 2026-05-13</Meta>
      <div className="ds-card pad" style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div>
              <span style={{ font: '600 44px/1 var(--ds-font-mono)', letterSpacing: '-0.01em' }}>$0.82</span>
              <span style={{ font: '500 17px/1 var(--ds-font-mono)', color: 'var(--text-3)', marginLeft: 8 }}>of $150.00</span>
            </div>
            <div style={{ marginTop: 16, height: 6, borderRadius: 999, background: 'var(--bg-sunk)', overflow: 'hidden' }}>
              <div style={{ width: '0.55%', height: '100%', background: 'var(--accent)' }} />
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 14, color: 'var(--text-2)', fontSize: 13 }}>
              <span><Meta>agents</Meta> <span className="mono" style={{ marginLeft: 6 }}>3</span></span>
              <span><Meta>reporting today</Meta> <span className="mono" style={{ marginLeft: 6 }}>3</span></span>
              <span><Meta>remaining</Meta> <span className="mono" style={{ marginLeft: 6 }}>$149.18</span></span>
            </div>
          </div>
          <Pill size="md" tone="success" dot>ok</Pill>
        </div>
      </div>

      <div style={{ height: 28 }} />
      <Meta>by agent</Meta>
      <div className="grid-3" style={{ marginTop: 10 }}>
        <BudgetCard name="hobby" spent="0.08" cap="50.00" pct={0.16} />
        <BudgetCard name="simon" spent="0.14" cap="50.00" pct={0.28} />
        <BudgetCard name="jodin" spent="0.59" cap="50.00" pct={1.18} />
      </div>
    </ScreenFrame>
  );
}

function BudgetCard({ name, spent, cap, pct }) {
  return (
    <div className="ds-card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={name} size={26} />
        <span style={{ fontWeight: 600 }}>{name}</span>
        <span style={{ flex: 1 }} />
        <Pill size="xs" tone="success" dot>ok</Pill>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: 'var(--bg-sunk)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(pct, 1)}%`, height: '100%', background: 'var(--accent)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>
          <span className="mono" style={{ fontSize: 17, fontWeight: 500 }}>${spent}</span>
          <span style={{ color: 'var(--text-3)', fontSize: 12.5, marginLeft: 6 }}>spent</span>
        </span>
        <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>cap ${cap}</span>
      </div>
    </div>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────
function ScreenSettings() {
  return (
    <ScreenFrame>
      <ScreenHeader
        crumbs={['2200', 'settings']}
        title="Settings"
        sub="Theme, runtime info, and model providers."
        actions={<Btn variant="ghost" size="sm">← Fleet</Btn>}
      />

      <SettingsBlock label="theme">
        <Segmented value="dark" options={['light', 'dark', 'system']} />
      </SettingsBlock>

      <SettingsBlock label="about">
        <div className="ds-card" style={{ overflow: 'hidden' }}>
          {[
            ['api',       <span className="mono">v1</span>],
            ['runtime',   <span className="mono">0.0.0-phase-a</span>],
            ['healthy',   <Pill size="xs" tone="success" dot>yes</Pill>],
            ['principal', <span className="mono">user/default</span>],
            ['ws',        <Pill size="xs" tone="info" dot>open</Pill>],
          ].map(([k, v], i) => (
            <div key={k} style={{
              display: 'grid', gridTemplateColumns: '180px 1fr',
              padding: '12px 16px', alignItems: 'center',
              borderTop: i ? '1px solid var(--line-soft)' : 'none',
            }}>
              <Meta>{k}</Meta>
              <span style={{ fontSize: 13 }}>{v}</span>
            </div>
          ))}
        </div>
      </SettingsBlock>

      <SettingsBlock label="models & api keys">
        <ProviderRow name="anthropic"  envVar="ANTHROPIC_API_KEY"  baseUrl="https://api.anthropic.com"  models={['claude-haiku-4-5', 'claude-opus-4-7', 'claude-sonnet-4-6']} status="missing" />
        <ProviderRow name="openai"     envVar="OPENAI_API_KEY"     baseUrl="https://api.openai.com"     models={['gpt-5', 'gpt-5-mini']} status="missing" />
        <ProviderRow name="deepseek"   envVar="DEEPSEEK_API_KEY"   baseUrl="https://api.deepseek.com"   models={['deepseek-chat', 'deepseek-reasoner']} agents={['hobby', 'simon']} keyMasked="••••••••b42e" status="set" />
        <ProviderRow name="moonshot"   envVar="KIMI_API_KEY"       baseUrl="https://api.moonshot.ai"    models={['moonshot-v1-128k']} status="missing" />
      </SettingsBlock>
    </ScreenFrame>
  );
}

function SettingsBlock({ label, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <Meta>{label}</Meta>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function ProviderRow({ name, envVar, baseUrl, models, status, keyMasked, agents }) {
  const isSet = status === 'set';
  return (
    <div className="ds-card pad" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{name}</span>
        <span style={{ flex: 1 }} />
        {isSet
          ? <>
              <Pill size="sm" tone="info" dot>key set</Pill>
              <Btn variant="ghost" size="sm">Change</Btn>
              <Btn variant="ghost" size="sm">Clear</Btn>
            </>
          : <>
              <Pill size="sm" tone="warn" dot>no key</Pill>
              <Btn variant="secondary" size="sm">Add key</Btn>
            </>
        }
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 8, columnGap: 12 }}>
        <Meta>env var</Meta><span className="mono" style={{ fontSize: 13 }}>{envVar}</span>
        <Meta>base url</Meta><span className="mono" style={{ fontSize: 13, color: 'var(--text-2)' }}>{baseUrl}</span>
        {keyMasked && <><Meta>key</Meta><span className="mono" style={{ fontSize: 13, color: 'var(--text-2)' }}>{keyMasked}</span></>}
        {agents && <><Meta>agents</Meta><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{agents.map(a => <Tag key={a} hue={agentHue(a)}>{a}</Tag>)}</div></>}
        <Meta>models</Meta>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {models.map(m => <Code key={m}>{m}</Code>)}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  ScreenFrame, ScreenHeader, SectionTitle, DayDivider, SidebarLink,
  ScreenFleet, ScreenStudio, ScreenAgent, ScreenChat, ScreenInbox, ScreenBudget, ScreenSettings,
});
