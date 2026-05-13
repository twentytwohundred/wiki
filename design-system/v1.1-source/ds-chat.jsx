// ds-chat.jsx — chat-specific components: messages, composer, attachments, chat list
// Exposes: Attachment, ChatMessage, ChatComposer, ChatListRow, ChatTitleBar,
//          AttachmentsDoc, ChatDoc

// ── Attachment chip / image thumb ────────────────────────────────────────────
function Attachment({ kind = 'file', name, size, src, onRemove, style }) {
  if (kind === 'image') {
    return (
      <div style={{
        position: 'relative', width: 76, height: 76,
        borderRadius: 'var(--ds-r-2)', overflow: 'hidden',
        background: 'var(--bg-sunk)', border: '1px solid var(--line)',
        flex: '0 0 auto', ...style,
      }}>
        {src
          ? <img src={src} alt={name || 'attachment'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (
            // striped placeholder
            <div style={{
              width: '100%', height: '100%',
              backgroundImage: 'repeating-linear-gradient(135deg, var(--bg-hover) 0 8px, var(--bg-sunk) 8px 16px)',
              display: 'grid', placeItems: 'center',
              color: 'var(--text-3)',
              font: '500 10px/1 var(--ds-font-mono)',
            }}>{name || 'image'}</div>
          )
        }
        {onRemove && (
          <button onClick={onRemove} aria-label="Remove" style={{
            position: 'absolute', top: 4, right: 4,
            width: 18, height: 18, borderRadius: '999px',
            background: 'rgba(0,0,0,.55)', color: '#fff',
            border: 0, cursor: 'pointer', font: '600 11px/1 var(--ds-font-sans)',
            display: 'grid', placeItems: 'center',
          }}>×</button>
        )}
      </div>
    );
  }
  // file chip
  const fileSym = ({
    pdf: 'pdf', md: 'md', txt: 'txt', json: 'json', log: 'log',
    csv: 'csv', py: 'py', js: 'js', ts: 'ts',
  })[(name || '').split('.').pop()] || 'file';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: '7px 10px 7px 8px',
      background: 'var(--bg-elev)', border: '1px solid var(--line)',
      borderRadius: 'var(--ds-r-2)',
      maxWidth: 280, ...style,
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: 'var(--ds-r-1)',
        background: 'var(--bg-sunk)', color: 'var(--text-2)',
        font: '600 9.5px/1 var(--ds-font-mono)',
        display: 'grid', placeItems: 'center', textTransform: 'uppercase',
        letterSpacing: '.04em', flex: '0 0 auto',
      }}>{fileSym}</span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
        <span className="mono" style={{
          fontSize: 12.5, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{name}</span>
        {size && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{size}</span>}
      </span>
      {onRemove && (
        <button onClick={onRemove} aria-label="Remove" style={{
          appearance: 'none', background: 'transparent', border: 0,
          color: 'var(--text-3)', cursor: 'pointer',
          width: 18, height: 18, borderRadius: 4, font: '500 14px/1 var(--ds-font-sans)',
          display: 'grid', placeItems: 'center', flex: '0 0 auto',
        }}>×</button>
      )}
    </div>
  );
}

// ── Chat message bubble ──────────────────────────────────────────────────────
function ChatMessage({ from = 'agent', who = 'jodin', time, body, attachments = [], thinking = false }) {
  const isYou = from === 'you';
  return (
    <article style={{
      display: 'flex', gap: 12,
      flexDirection: isYou ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
    }}>
      {!isYou && <Avatar name={who} size={30} />}
      {isYou && (
        <span style={{
          width: 30, height: 30, borderRadius: '999px',
          background: 'var(--bg-sunk)', color: 'var(--text-2)',
          display: 'grid', placeItems: 'center', flex: '0 0 auto',
          font: '600 12px/1 var(--ds-font-sans)',
          border: '1px solid var(--line)',
        }}>you</span>
      )}
      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 6, alignItems: isYou ? 'flex-end' : 'flex-start' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8,
          flexDirection: isYou ? 'row-reverse' : 'row',
        }}>
          <span style={{ font: '600 13.5px/1 var(--ds-font-sans)', color: 'var(--text)' }}>{isYou ? 'you' : who}</span>
          {time && <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{time}</span>}
        </div>

        {(body || thinking) && (
          <div style={{
            padding: '10px 14px',
            background: isYou ? 'var(--accent-soft)' : 'var(--bg-elev)',
            color: isYou ? 'var(--accent-ink)' : 'var(--text)',
            border: `1px solid ${isYou ? 'transparent' : 'var(--line)'}`,
            borderRadius: 'var(--ds-r-3)',
            fontSize: 14.5, lineHeight: 1.55,
          }}>
            {thinking
              ? <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: 'var(--text-3)' }}>
                  <ThinkingDots /> <span style={{ fontSize: 13.5 }}>thinking…</span>
                </span>
              : body}
          </div>
        )}

        {attachments.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            justifyContent: isYou ? 'flex-end' : 'flex-start',
          }}>
            {attachments.map((a, i) => <Attachment key={i} {...a} />)}
          </div>
        )}
      </div>
    </article>
  );
}

function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '999px',
          background: 'var(--text-3)',
          animation: `dsBlink 1.2s var(--ds-ease) ${i * 0.16}s infinite`,
        }} />
      ))}
      <style>{`@keyframes dsBlink{0%,80%,100%{opacity:.3}40%{opacity:1}}`}</style>
    </span>
  );
}

// ── Composer ────────────────────────────────────────────────────────────────
function ChatComposer({ agent = 'jodin', defaultMode = 'checkpointed', initialAttachments = [] }) {
  const [text, setText] = React.useState('');
  const [mode, setMode] = React.useState(defaultMode);
  const [files, setFiles] = React.useState(initialAttachments);
  const inputRef = React.useRef(null);

  const onPick = (e) => {
    const list = Array.from(e.target.files || []);
    const next = list.map(f => ({
      kind: f.type.startsWith('image/') ? 'image' : 'file',
      name: f.name,
      size: humanSize(f.size),
      src: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
    }));
    setFiles(fs => [...fs, ...next]);
    e.target.value = '';
  };
  const remove = (i) => setFiles(fs => fs.filter((_, idx) => idx !== i));

  return (
    <div style={{
      background: 'var(--bg-elev)',
      border: '1px solid var(--line-strong)',
      borderRadius: 'var(--ds-r-3)',
      boxShadow: 'var(--shadow-1)',
      transition: 'border-color var(--ds-dur-fast) var(--ds-ease)',
    }}>
      {/* Attachment tray (only when items) */}
      {files.length > 0 && (
        <div style={{
          padding: '12px 12px 0',
          display: 'flex', flexWrap: 'wrap', gap: 8,
        }}>
          {files.map((f, i) => (
            <Attachment key={i} {...f} onRemove={() => remove(i)} />
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Message ${agent}…  drop files or images, or use /command`}
        rows={3}
        style={{
          width: '100%', resize: 'none',
          background: 'transparent', border: 0, outline: 'none',
          padding: '14px 16px 8px',
          font: '400 15px/1.55 var(--ds-font-sans)', color: 'var(--text)',
        }}
      />

      {/* Action row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px 10px',
      }}>
        <button
          onClick={() => inputRef.current && inputRef.current.click()}
          aria-label="Attach"
          style={{
            appearance: 'none', border: '1px solid var(--line)',
            background: 'var(--bg)', color: 'var(--text-2)',
            width: 32, height: 32, borderRadius: 'var(--ds-r-pill)',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            fontSize: 16,
          }}>＋</button>
        <input ref={inputRef} type="file" multiple onChange={onPick} style={{ display: 'none' }} />

        <Segmented value={mode} options={['pure', 'checkpointed', 'destructive']} onChange={setMode} />

        <span style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-3)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Kbd>⌘</Kbd> <Kbd>⏎</Kbd>
        </span>
        <Btn variant="primary" size="md">Send</Btn>
      </div>
    </div>
  );
}

function humanSize(b) {
  if (b == null) return '';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Chat sidebar row ────────────────────────────────────────────────────────
function ChatListRow({ title, snippet, time, active, unread, onClick }) {
  return (
    <button onClick={onClick} style={{
      appearance: 'none', textAlign: 'left',
      width: '100%', padding: '10px 12px',
      background: active ? 'var(--bg-hover)' : 'transparent',
      border: '1px solid',
      borderColor: active ? 'var(--line)' : 'transparent',
      borderRadius: 'var(--ds-r-2)',
      cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8,
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontWeight: 500, fontSize: 13.5, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1, minWidth: 0,
        }}>{title}</span>
        {unread
          ? <span style={{
              width: 6, height: 6, borderRadius: '999px', background: 'var(--accent)',
              flex: '0 0 auto',
            }} />
          : <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-3)', flex: '0 0 auto' }}>{time}</span>
        }
      </div>
      <span style={{
        fontSize: 12.5, color: 'var(--text-3)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{snippet}</span>
    </button>
  );
}

// ── Chat title bar ───────────────────────────────────────────────────────────
function ChatTitleBar({ title, agent, count, onRename }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 4px 14px 0',
      borderBottom: '1px solid var(--line-soft)',
    }}>
      <Avatar name={agent} size={28} status="running" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          font: '600 16px/1.2 var(--ds-font-sans)', color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
          <span className="mono">{count}</span>
          <span> messages · chat with </span>
          <span style={{ color: 'var(--text-2)' }}>{agent}</span>
        </div>
      </div>
      <Btn size="sm" variant="ghost" onClick={onRename}>Rename</Btn>
      <Btn size="sm" variant="ghost">Export</Btn>
      <Btn size="sm" variant="danger">Archive</Btn>
    </div>
  );
}

// ── Doc galleries ────────────────────────────────────────────────────────────
function AttachmentsDoc() {
  return (
    <div className="grid-2">
      <Tile label="File chip · with type" footer="Tiny mono badge tells you what kind of file at a glance.">
        <Attachment kind="file" name="ouath-log.txt" size="2.3 KB" />
        <Attachment kind="file" name="provider.json" size="412 B" />
        <Attachment kind="file" name="audit.pdf"     size="1.1 MB" />
      </Tile>
      <Tile label="Image thumb · 76px square" footer="Used for screenshots, photos, generated images.">
        <Attachment kind="image" name="screenshot.png" />
        <Attachment kind="image" name="dash.png" />
      </Tile>
      <Tile label="With remove" footer="The composer shows attachments with an × until send.">
        <Attachment kind="file" name="payload.json" size="11.2 KB" onRemove={() => {}} />
        <Attachment kind="image" name="diagram.png" onRemove={() => {}} />
      </Tile>
      <Tile label="In a message · received" footer="Attachments appear under the bubble, never replace it.">
        <ChatMessage from="agent" who="jodin" time="12:24"
          body={<span>Logs from the failed handshake — token clearly server-side revoked.</span>}
          attachments={[{ kind: 'file', name: 'oauth-failure.log', size: '2.3 KB' }]}
        />
      </Tile>
    </div>
  );
}

function ChatDoc() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Tile label="Message · agent vs you · standard pair">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ChatMessage from="agent" who="jodin" time="12:23" body={<span>Looked at the OAuth flow. The refresh token's revoked server-side — needs a fresh handshake. Want me to walk you through it, or open the browser flow?</span>} />
          <ChatMessage from="you" time="12:24" body={<span>Open the browser flow. Also attached the failure log if it helps.</span>} attachments={[{ kind: 'file', name: 'oauth-failure.log', size: '2.3 KB' }]} />
        </div>
      </Tile>
      <Tile label="Thinking state · agent computing">
        <div style={{ width: '100%' }}>
          <ChatMessage from="agent" who="jodin" thinking />
        </div>
      </Tile>
      <Tile label="Composer · default" footer="Plus to attach, mode segmented to right, send is the only primary on the screen.">
        <div style={{ width: '100%' }}>
          <ChatComposer agent="jodin" />
        </div>
      </Tile>
      <Tile label="Composer · with attachments" footer="Attachments tray appears above the textarea when populated.">
        <div style={{ width: '100%' }}>
          <ChatComposer agent="jodin" initialAttachments={[
            { kind: 'image', name: 'screenshot.png' },
            { kind: 'file', name: 'oauth-failure.log', size: '2.3 KB' },
            { kind: 'file', name: 'redirect-uri.txt', size: '180 B' },
          ]} />
        </div>
      </Tile>
      <Tile label="Chat sidebar list">
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <ChatListRow active title="Spotify OAuth refresh" snippet="Open the browser flow. Also attached the f…" time="12:24" />
          <ChatListRow unread title="Brain audit" snippet="3 notes look stale — want me to consolidate?" time="11:02" />
          <ChatListRow title="Cron schedule review" snippet="Daily report is wired; here's the full list…" time="Mon" />
          <ChatListRow title="Setup notes" snippet="Identity provisioned. Tools registered." time="May 8" />
        </div>
      </Tile>
    </div>
  );
}

Object.assign(window, {
  Attachment, ChatMessage, ChatComposer, ChatListRow, ChatTitleBar,
  AttachmentsDoc, ChatDoc, ThinkingDots,
});
