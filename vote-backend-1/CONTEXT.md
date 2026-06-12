# Pax Romana – KNUST Election System — Domain Glossary

The canonical vocabulary for this system. Implementation details do **not** belong here —
this is a glossary of domain terms and the precise meaning each one carries. When code or
docs use one of these terms, they must mean exactly what is written here.

---

## Ballot Secrecy

The guarantee that a cast ballot cannot be tied back to the identity of the voter who cast it.

**Scope (decided 2026-06-12):** secrecy is guaranteed against *outsiders* and against the
exposure of a single database dump. It is **not** guaranteed against trusted insiders
(Electoral Commission members, system administrators) who hold live application secrets and
database credentials. Those parties are trusted not to deanonymize ballots.

Because voting is in-person and supervised (see **Polling Station**), the most realistic
secrecy threat is *positional*: a poll worker who starts a voter's session knows who sat at
the device and roughly when. Unlinkability must therefore defeat timestamp/session correlation,
not just foreign keys — the **Ballot** must carry no session reference and no fine-grained
cast time that could be matched against the queue.

This scope is the cheapest defensible point on the threat-model spectrum. It deliberately
excludes insider threat, end-to-end voter verifiability, and coercion-resistance. See the
ADR on the voting threat model for why this point was chosen and what it rules out.

## Participation Record

The fact that a given eligible voter *has voted*, keyed by **student ID number** (the dedup key).
Distinct from the **Ballot** itself. Participation is logged against voter identity (to enforce
one-person-one-vote); the Ballot is stored with **no join path back to the Participation Record
or the voter**. Keeping these two facts unlinkable is the mechanism by which Ballot Secrecy is
achieved. The Participation Record is load-bearing for dispute resolution now that there is no
physical (ink) backstop — see **Digital Uniqueness Gate**.

## Ballot

The set of candidate selections a voter submits — at most one candidate per **Position**.
A Ballot is anonymous: it carries no voter identifier once Ballot Secrecy is enforced.

## Eligibility Roster

The authoritative, pre-election list of who may vote. **The source of truth is Pax Romana's own
membership records** (subgroup lists plus the general member register) — **not** the university.
KNUST will not provide an API or tooling to verify students, so the system never validates student
status against the school; it relies on Pax's own roster plus a poll worker's visual check of the
physical KNUST ID card. A voter's identity on the roster is their **student ID number** (the stable
dedup key), not a (phone, email) tuple. Possessing a phone and email is not evidence of eligibility.

## Same-Day Attestation

The logged path taken when the fast path can't be used — either the voter is **not** on the
**Eligibility Roster** (typically an "ordinary" Pax member not on a subgroup list), **or** they could
not present a physical card (phone photo / no card). An EC official/poll worker takes named
responsibility: for roster members they knowledge-check stated details (name, programme, subgroup)
against the roster; for others they attest the person is a genuine Pax member. The system records
the **student ID, attesting official, timestamp, station, and reason** (e.g. "not on roster",
"photo", "no card"). This audit trail is mandatory — it is the only thing that makes attestation-path
fraud detectable after the fact. Attestation is the exception, not the norm; a high attestation rate
signals a stale roster, a card-bring problem, or abuse, and is monitored on the day.

## Voting Credential

The voter's **existing KNUST student ID card**. No separate "voting-ID number" is issued — the
student ID *number* is already a unique key and serves as the dedup key.

The number is what feeds the **Digital Uniqueness Gate**, and it can be obtained by any means
(physical card, phone photo, or recited from memory), so **no voter is ever turned away for lack of
a card** — the dedup still enforces one vote per number. What the card governs is *which path* a
voter takes:

- **Physical card → fast path.** The poll worker glances at the genuine card + face (as in a manual
  electoral register) and opens the session directly.
- **Phone photo or no card → Same-Day Attestation.** A photo is borrowable/editable/reusable and
  binds nothing to the person present; a missing card offers nothing to check. Both route to the
  logged attestation path instead of the fast path.

Residual, accepted risk (see ADR-0002): no non-biometric scheme fully prevents *impersonation of an
abstaining eligible member* — a forged card or a harvested photo of someone who won't vote can pass.
The dedup caps this at one vote per real ID; the attestation trail makes weak-evidence votes
traceable; ink (which wouldn't have stopped impersonation either) was dropped by choice.

## Digital Uniqueness Gate

The one-person-one-vote mechanism: a **student ID number** can appear in the **Participation
Record** at most once. Marking a student ID "voted" digitally is what prevents a second vote —
it replaces indelible ink, which was considered and deliberately dropped (voters objected to being
inked; see ADR-0002). Consequence: there is **no physical backstop** — the digital dedup plus the
poll worker's card check are the *only* uniqueness guarantees.

## Voter

A person who is either on the **Eligibility Roster** or enrolled via **Same-Day Attestation**.
A Voter is authenticated *physically* by a poll worker at a **Polling Station** (there is no phone
OTP); their identity is severed from the **Ballot** at the moment of casting.

## Verification

A single endorsement record for a nomination, modeled as **one** `Verification` entity with a
`role: NOMINATOR | GUARANTOR` discriminator (not two separate tables). Each nomination has exactly
**one** NOMINATOR Verification and exactly **two** GUARANTOR Verifications (counts enforced in
application logic). `status` is the `VerificationStatus` enum — never a free string.

States: `PENDING` (awaiting response), `VERIFIED` (endorser confirmed support), `DECLINED`
(endorser won't support), `EXPIRED` (token lapsed), and `REPUDIATED` (the named person asserts they
were *wrongly listed* as an endorser). Repudiation is distinct from declining: it is a fabrication
signal that **flags the nomination for EC attention** rather than silently counting as a non-support.

A **VerificationToken** points to a Verification by a *real* foreign key (no polymorphic
`verificationId`+type pairing, no manual two-step lookup), resolved through a single
`resolveAndValidate(token)` seam that returns a hydrated, validated Verification or throws — callers
never re-implement the expiry/used/type checks. Endorsement tokens and password-reset tokens are
separate concerns and do not share a table.

Confirming or declining an endorsement updates the Verification **and** drives the resulting
**Nomination Lifecycle** transition **synchronously, in the same transaction** (a direct
`Lifecycle.apply(...)` call, never a droppable event) — so a nomination cannot be stranded in
`PARTIALLY_VERIFIED` by a lost message. Only the after-effects (notifications) are fire-and-forget
events. See ADR-0008 (scope).

## Endorsement

The act a nominator or guarantor performs when they confirm support for an aspirant via their
Verification link — recording confirmation and a rationale. An endorsement moves a **Verification**
to `VERIFIED`.

## Nomination Lifecycle

The states a nomination moves through, governed by a single **guarded transition** (the only writer
of nomination status — illegal jumps are rejected, not silently written):

- `PENDING` — created; endorsement tokens not yet dispatched.
- `AWAITING_VERIFICATION` — tokens sent to the 1 nominator + 2 guarantors; no/some responses.
- `PARTIALLY_VERIFIED` — at least one endorsement `VERIFIED`, but not the full 1 + 2.
- `NEEDS_ATTENTION` — an endorser `DECLINED` or `REPUDIATED`; the nomination is recoverable while the
  nomination window is open (the aspirant replaces that endorser, which re-issues a token and returns
  the nomination to `AWAITING_VERIFICATION`/`PARTIALLY_VERIFIED`).
- `VERIFIED` — **exactly** 1 nominator and **exactly** 2 guarantors, all `VERIFIED` (a count check,
  never a vacuous "every existing one is verified"). Only `VERIFIED` nominations enter EC review.
- `UNDER_REVIEW` — an EC member has cast a review; awaiting **EC Consensus**.
- `APPROVED` / `REJECTED` — terminal (consensus or **Chair Override**).
- `WITHDRAWN` — aspirant withdrew (terminal).

A token may be processed **only** when the nomination is in `{AWAITING_VERIFICATION,
PARTIALLY_VERIFIED, NEEDS_ATTENTION}` — never against a `VERIFIED` or terminal nomination (this closes
the stale-token flip-back). At the nomination deadline, anything not `VERIFIED` expires to `REJECTED`.

**Recovery bounds (see ADR-0007):** endorser replacements are capped per nomination (≈3 total). Each
`REPUDIATED` is logged and attached to the nomination for EC visibility; **two or more repudiations on
one nomination escalates** — the nomination cannot auto-advance to `VERIFIED` until an EC member clears
the flag. This keeps "recoverable" from becoming endorser-fishing or consequence-free fabrication.

**Transition shape (deepening):** the lifecycle is a single pure, table-driven core
(`next(state, event) → state | error`) — the only writer of nomination status — wrapped by a thin
service that loads, applies, and persists in one transaction. The core is **side-effect-free**; after
a transition commits, the service emits domain events (`NominationVerified`, `NominationApproved`,
`NominationRejected`, …) over the same after-commit/fire-and-forget seam as **VotingEvents** (ADR-0008).
Notifications and candidate-creation are **subscribers** — recipient-resolution lives behind a
`recipientsFor(role)` seam, never a raw `prisma.user` query inside notifications.

## Electoral Commission (EC)

The body that reviews **VERIFIED** nominations and decides which become candidates. Its voting
members are the active `EC_MEMBER` users on the frozen **EC Roll**. The **Chairperson**
(`SUPER_ADMIN`) is *not* a voting member — they hold only the **Chair Override**. `ADMIN` users are
**not** part of the EC at all (general/technical administration, no review and no vote-data access,
per spec §4.5.2). Earlier code wrongly counted `ADMIN` in the quorum and excluded the Chairperson.

## EC Roll

The frozen set of `EC_MEMBER`s eligible to review, snapshotted when the review phase opens. It is
the denominator for **EC Consensus** and must not be recomputed live — outcomes have to be
reproducible and auditable even if EC membership changes later. Parallels the voter **Eligibility
Roster**: rolls are frozen before the phase begins.

## EC Consensus

A nomination is APPROVED or REJECTED when at least `ceil(2/3 × |EC Roll|)` EC members record that
decision (via `EcReview`). Consensus is **binding** — it cannot be overturned by the Chair. The
decision is computed from `EcReview` rows (the single source of truth); redundant counters are not
kept.

## Chair Override

The Chairperson's authority to finalize a nomination **only when consensus is Deadlocked**. The
Chair cannot overturn a reached **EC Consensus**. Every override is logged to the election record
with the acting Chair, timestamp, and reason.

## Deadlock

The state in which **EC Consensus** can no longer be reached: either the review deadline (from
`ElectionTimeline`: phase `endDate` + `gracePeriodHours`) has passed without consensus, or neither
`approvals + pending` nor `rejections + pending` can still reach the 2/3 threshold. Only in this
state may the **Chair Override** be exercised.

## Position

A single executive office being contested (PRESIDENT, VICE_PRESIDENT, GEN_SECRETARY,
FINANCIAL_SECRETARY, ORGANIZING_SECRETARY_MAIN, PRO_MAIN, WOMEN_COMMISSIONER). A Ballot
holds at most one selection per Position.

## Ballot Casting

The single, authoritative, transactional act of recording a vote: validate the selections (each
belongs to its claimed **Position**; at most one per Position), enforce the **Digital Uniqueness
Gate**, write the anonymous **Ballot** and the **Participation Record**, and return a selection-free,
identity-free receipt. Ballot Casting does *only* this — it does not broadcast, compute stats, or
detect anomalies. Those are observation, and they happen behind the **VotingEvents** seam.

## VotingEvents / BallotCast

The seam separating *casting* a ballot from *observing* the election. After a cast commits, Ballot
Casting emits a single **BallotCast** event; observers (live turnout, anomaly detection, audit)
subscribe. Emission is **after-commit, fire-and-forget**: observers run outside the cast transaction,
each isolated so a failing observer is logged and never affects the recorded vote (a missed event is a
momentarily stale dashboard that self-heals on the next vote). **BallotCast is operational-only** — it
carries that a ballot occurred, a timestamp, and selection-free operational context (e.g. station /
IP) for anomaly detection. It carries **no voter identity** (ADR-0001) and **no candidate selections**
(ADR-0004); standings do not exist until the post-close **Tally**.

## Tally

The count of votes per candidate. A **pure, deterministic function** of the anonymous **Ballot** rows
(plus the candidate set) — recompute it anytime and it yields the same answer; it owns the per-position
counting, percentage, leader, and tie rules in one place. There is **one** Tally, consumed by both the
results view and certification — never two independent counters from two sources.

Computed **after voting closes** (no live per-candidate counter; only *turnout* — the count of
**Participation Records** — is observable while voting is open, and that count is the **VotingEvents**
observer's job, not the Tally's). **Certification freezes the Tally into an immutable snapshot** (the
certified record); publication serves the snapshot, not a live recompute — so a certified result is
both reproducible (pure function) and pinned (frozen). Matches the certify-after-close flow (spec §3.4)
and removes per-vote write contention and any mid-election standings leak.

## Polling Station

A supervised, physical location where voting takes place on organization-provided (often *borrowed*)
laptops/tablets. Voting is **in-person only** — there is no remote or personal-device voting. The
integrity perimeter is formed by: the **Station Operator** (who checks each voter in), the
**Digital Uniqueness Gate** (student-ID dedup), the fixed voting time window (driven by the
`ElectionTimeline`), and an **IP allowlist**.

Realistic scale: a handful of devices (≈3–4) and ≈3 EC members. The IP allowlist is weaker than it
looks: borrowed laptops share one venue NAT IP, so allowlisting only fences out the open internet,
not other devices on the same WiFi. The real per-device gate is the Station Operator's JWT plus
single-use, short-TTL ballot tokens; a dedicated voting router/SSID is the cheap way to make the IP
allowlist mean "official devices only." (Enforcement note: behind a reverse proxy the allowlist must
read the *real* client IP — proxy layer or a correct trusted-proxy / `X-Forwarded-For` config — else
it silently passes everyone.)

## Station Operator

Whoever drives a station device and checks voters in. Two roles split by privilege:

- **`POLL_WORKER`** (minimal): fast-path check-in only — verify a physical card, open an anonymous
  ballot session. No nomination, admin, or results access. Lets a few EC members cover more devices.
- **`EC_MEMBER`**: performs every **Same-Day Attestation** (the photo / no-card / not-on-roster
  exception path) and supervises. Concentrating the privileged judgment call in EC hands, while
  delegating the routine glance, preserves separation of duties.

Operator JWTs are short-lived and cleared at end of shift (the devices are borrowed personal
machines). During the voting phase, EC nomination-review powers are phase-gated off, so a station
token cannot reach the nomination subsystem.
