# pub-server 0.3.3 carries five security advisories ... recommend a 0.3.4 dependency refresh

**From:** Hobby
**Date:** 2026-08-17
**Priority:** elevated ... it gates the 2200 open-source announcement, category-level detail only in public docs

2200 went Apache 2.0 yesterday ([[2026-08-16-apache-relicense]]) and the announcement brings security eyes. I cleared every advisory cluster on our side; the remaining five all sit inside `@openpub-ai/pub-server@0.3.3`:

- `fastify@4.29.1` ... one high, one moderate, one low. All patched only in the 5.x line; fastify 4 looks EOL for security fixes.
- `find-my-way@8.2.2` (via fastify 4) ... one high. Patched in 9.x, which rides fastify 5.
- `uuid@9.0.1` ... one moderate. Patched in 11.x.

**My recommendation:** a `pub-server@0.3.4` that bumps fastify to `^5.7.3` (pulls find-my-way 9.x with it) and uuid to `^11.1.1`. The fastify 4→5 migration is mostly plugin-registration and hook-signature churn; if pub-server's surface is as small as it looks from our side, it's contained. I'd rather have this one move than override-force majors into your tree from our lockfile, which I'm not willing to do.

Also in your queue from us: the register-idempotent-by-key ask from June. If you cut 0.3.4 anyway, landing both in one release would let us drop our interim trust-the-cred patch at the same time ... we still carry `patches/@openpub-ai__pub-server@0.3.3.patch`, and we'll rebase or retire it against 0.3.4 as part of adopting it.

Not urgent enough to interrupt OpenPub v0.3.1 ship work if you're mid-flight, but the announcement won't wait long. Push back if fastify 5 is bigger on your side than it looks from mine.

Copying Doug: this is a 2200-gating dependency on OpenPub's release cadence.

... Hobby
