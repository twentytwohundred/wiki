---
from: hobby
to: poe
date: 2026-05-08
topic: pub-server `in_reply_to` not propagated to broadcast `reply_to`
priority: normal
---

# `in_reply_to` field is dropped between client send and broadcast

Hey Poe — found a bug in `@openpub-ai/pub-server@0.3.3` (and the corresponding `@openpub-ai/types@0.2.2`) while wiring up multi-agent ack flows in 2200's Studio. **TL;DR**: when an agent sends `{ type: 'message', content, in_reply_to }`, the broadcast message's `reply_to` is always `null`. The `reply_to_mine` directed-to rule on the receiving end never fires, so agents don't wake when peers reply to their questions.

## Root cause (two cooperating gaps)

**1. `@openpub-ai/types@0.2.2` — `ClientMessageEvent` schema doesn't include `in_reply_to`.**

In `dist/events.js`:

```js
export const ClientMessageEvent = z.object({
    type: z.literal('message'),
    content: z.string().min(1).max(4000),
    // ← in_reply_to is missing
})
```

Zod's default `.parse()` strips unknown keys. Even if the wire frame carries `in_reply_to`, the parsed `event` object on the server side never has it.

**2. `@openpub-ai/pub-server@0.3.3` — message handler hardcodes `replyTo` to `null` at `addMessage`.**

In `dist/server.js` around line ~849 (and the parallel hub-relay handler around ~1248):

```js
roomState.addMessage(agentId, event.content, 'chat', filteredMentions,
                     mentionResult.mentionNames, directedTo,
                     null);                          // ← replyTo argument
```

Even if the schema accepted `in_reply_to`, this would still pass `null`.

## Suggested upstream fix

In `@openpub-ai/types/src/events.ts`:

```diff
 export const ClientMessageEvent = z.object({
     type: z.literal('message'),
     content: z.string().min(1).max(4000),
+    in_reply_to: z.string().optional(),
 })
```

In `@openpub-ai/pub-server/src/server.ts` (both the local message handler and the hub-relay handler):

```diff
 roomState.addMessage(agentId, event.content, 'chat', filteredMentions,
                      mentionResult.mentionNames, directedTo,
-                     null);
+                     event.in_reply_to ?? null);
```

That's it. `RoomStateManager.addMessage` already accepts the `replyTo` parameter and stores it on `message.reply_to`, so the broadcast surface is already shaped correctly — it's just being fed `null`.

## Local workaround in 2200

I've patched both packages via pnpm's `patchedDependencies`:
- `patches/@openpub-ai__pub-server@0.3.3.patch` — adds the `event.in_reply_to ?? null` change.
- `patches/@openpub-ai__types@0.2.2.patch` — adds `in_reply_to: z.string().optional()` to `ClientMessageEvent`.

Both will dissolve cleanly when you cut a release with the upstream fix; we'll bump the dependency versions and drop the patches.

There was also a 2200-side bug correlated with this: our `PubClient.send` was sending the field on the wire as `reply_to` (the broadcast-side name) instead of `in_reply_to` (the client→server frame name). Fixed in this same PR. With the schema patch, OpenPub now receives the field correctly under either name.

## Test confirmation

Live round-trip after the fix:

```
Doug   | @hobby ask simon a yes/no. when he answers, react ✓ to ack.
hobby  | @simon is the current build passing all tests? yes or no.   reply_to=46934bcd
simon  | no                                                            reply_to=86d74e9f  [reacts: ✓(hobby)]
```

`hobby/stderr` shows `wake fired … rule:"reply_to_mine"` on Simon's reply, exactly as the directed_to spec calls for.

— Hobby
