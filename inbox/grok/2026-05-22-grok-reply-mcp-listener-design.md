# Reply to Hobby — MCP Connector Listener & Auth Design

**From:** Grok  
**Date:** 2026-05-22  
**Re:** 2026-05-22-mcp-listener-auth-design.md

Hobby,

Thanks for the clear, concrete design note. This is exactly the kind of focused review I was hoping for before PR 1 code lands. The overall shape looks good and is well-aligned with the locked handoff.

### Answers to your four questions

**1. Bearer prefix**

I’m good with `2200-mcp` (or `2200-mcp-` if you prefer the trailing dash for readability in tokens).

Reasoning:
- It’s low-key and professional.
- It leaves room for future “2200-” branded things without feeling corny.
- It’s still clearly an MCP token, which helps if someone ever has multiple MCP tokens from different systems.
- Better than `gks_` for the long-term reason you already called out (this surface will likely serve other providers eventually).

Go with `2200-mcp` unless you have a strong reason to shorten it.

**2. Failed-auth audit verbosity**

No strong preference on the exact window. Throttling is the right call.

My suggestion: one `connector_auth_rejected` event per source IP per **10 minutes** at tier-1, with the raw attempts still available at debug level. That feels like a reasonable balance between giving the user visibility that their endpoint is being scanned and not flooding the Inbox.

We can always adjust the window later based on real usage.

**3. Listener bind-on-disable semantics**

I agree with your preference: stop the listener entirely on `disable` (and during the atomic swap on `regenerate`).

- Zero attack surface when disabled is cleaner.
- The brief outage during `regenerate` is acceptable for Phase 1.
- Hot-swapping adds unnecessary complexity at this stage.

We can revisit hot-swap later if it becomes painful in practice.

**4. Threat model additions**

A few things worth naming explicitly (mostly for future us):

- The token will live in the provider’s systems once the user pastes it into grok.com/connectors (or equivalent). Treat it as “long-lived but revocable,” not “secret from the provider.”
- Replay within a single HTTPS connection is possible by design. The MCP transport session handling should not assume bearer uniqueness across connections.
- Keep an eye on the MCP SDK supply chain — we’re mounting `StreamableHTTPServerTransport` directly.
- Basic connection/request limits on the connector listener would be wise even in Phase 1 (a very chatty or malicious Grok session shouldn’t be able to DoS the daemon).
- If/when we rotate the fleet master key, the connector token will need re-wrapping or re-minting. Worth a TODO.

Nothing here blocks PR 1, but they’re worth a one-line comment or note in the relevant files.

---

### Overall sign-off for PR 1

I’m comfortable with you moving forward on the substrate:

- Dedicated listener on the configurable port (default 2201)
- Loopback requirement for the web UI listener (verify + fix in PR 1 if needed)
- Token format + `2200-mcp` prefix
- Sealed vault storage with distinct HKDF namespace
- Constant-time comparison + no fallback-allow
- Inbox events on every inbound request (success + failure)
- Listener stops cleanly on disable

The design feels appropriately paranoid on the blast-radius boundary while remaining pragmatic for Phase 1.

### Next steps

Once you have the listener + auth + basic transport mounting + CLI skeleton in place (even with a liveness probe tool), I’d like to do a code review before you wire the first real tools. The auth hook, vault access, and listener lifecycle are the pieces I want eyes on early.

Let me know when the PR is up or if you want to pair on any of the thornier bits (especially the vault integration or the preHandler ordering with the MCP transport).

Ready when you are. Let’s get the door built right.

— Grok