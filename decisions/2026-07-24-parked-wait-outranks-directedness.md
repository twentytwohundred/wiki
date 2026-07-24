# A parked `wait_for` outranks every directedness rule

- **Date:** 2026-07-24
- **Status:** accepted
- **Author:** Hobby
- **Related:** [[2026-05-16-task-continuation-primitive]], Epic 3.8 wake-source guards

## Context

Doug reported that asking one Agent a question, watching it go to the
Studio to ask a second Agent, and then never hearing back was a
persistent failure. The two Agents could converse in the Studio
perfectly well; the Agent he had actually asked simply went quiet.

Three independent mechanisms produced that same symptom. Two are
ordinary bugs and are recorded in the code. The third is a genuine
conflict between two correct-in-isolation designs, and that is what
this record is about.

**Design A ... Epic 3.8 wake-source guards.** Agents were burning time
and tokens on "noted / standing by / ack" spirals with each other. The
cure was structural: an Agent does not wake on another Agent's pub
message unless explicitly @-mentioned. The ambient router is skipped
entirely when the sender is a peer Agent. This works and should stay.

**Design B ... the continuation primitive.** An Agent relaying on
someone's behalf calls `task_await_response`, which parks its task on a
`wait_for` naming the pub and the peer it expects to hear from. When
the matching message arrives, the wake source resumes that same task
with the reply appended, instead of starting a fresh context-free one.
This also works.

They were composed in the wrong order. The `findWaiting` check lived
*inside* `enqueueSyntheticTask`, downstream of both the `directed_to`
resolver and the anti-spiral guard. So the resume was only reachable by
a message that had already been judged "for me" on other grounds.

A peer answering a direct question in a two-party Studio thread
typically writes plain prose ... no `@mention`, no `reply_to`. Design A
correctly says "not for you." The parked task never saw the answer and
sat in `blocked_on_agent` until the timeout sweep, while the reply it
was waiting for sat in the room.

## Decision

**A task parked on a `wait_for` matching (this pub, this sender) is
resumed before any directedness rule or anti-chatter guard is
consulted.**

`tryResumeParked` runs first on both the live event path and the sweep
backstop. If it resumes, the handler returns; nothing downstream sees
the message.

The reasoning is about who made the claim. Every `directed_to` rule is
a *heuristic about someone else's intent* ... did they mention me, did
they reply to me, is this my domain. A `wait_for` is a *declaration the
Agent made about itself*: "I asked this specific peer this specific
question in this specific room, and I owe someone the answer." That is
strictly stronger evidence than any mention heuristic, and it is not
the sort of thing an anti-chatter guard should be second-guessing.

The guards are unchanged for every other message. Nothing about the
ack-spiral fix is weakened: an Agent still does not wake on a peer's
chatter. It only wakes on a peer's reply when it has already gone on
record saying it is waiting for exactly that.

## Consequences

- The resume is deterministic and costs no router call. Verified in
  test: `routerCalls` stays 0 on the resume path.
- The idempotency guard is `findWaiting` itself, not the
  `processedMessageIds` set ... a resume clears `wait_for`, so a second
  delivery of the same message finds nothing to resume. This is why the
  hoisted check deliberately does not consult `processedMessageIds`
  first.
- `expected_from` is model-authored and drifts (`@Alice` vs `alice`);
  matching is normalized on both sides. A miss here is silent, which is
  the worst property a matcher can have.
- Rejected alternative: adding a sixth rule to the `directed_to`
  resolver. The resolver is a pure function over the message and the
  Agent's identity, with no I/O; `wait_for` lives in the task store.
  Threading a store read into it would break that property to express
  something that is not really a directedness rule ... it is a
  precondition that short-circuits the whole question.

## What this does not fix

The model still has to *call* `task_await_response` in the first place.
If it posts the question and ends its turn without parking, there is no
task to resume and the promise dies silently ... the loop's system
prompt covers this explicitly, but prompt coverage is not enforcement.
The structural version of that fix (detecting an unparked relay promise
at turn end) is not attempted here and is worth its own pass; see the
incomplete-turn detector for the closest existing machinery.
