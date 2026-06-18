# Ballot secrecy via unlinkability, not encryption

**Status:** accepted (2026-06-12)

We scope ballot secrecy to defend against *outsiders* and against the exposure of a single
database dump — **not** against trusted insiders (EC members, system administrators) who hold
live application secrets and DB credentials. Given that threat model and a co-located
deployment (Postgres and the `VOTE_ENCRYPTION_KEY` live inside the same Coolify trust boundary,
so any leak that exposes the database also exposes the key), we are **removing the
AES-encrypt-before-storage layer entirely** and achieving ballot secrecy through *unlinkability*
instead: the `Participation Record` (which voter has voted) and the `Ballot` (what was voted)
are stored in separate tables with no join key between them.

## Considered options

- **Keep AES encryption (status quo).** Rejected: with a single app-held symmetric key co-located
  with the database, encryption is defeated by the same dump that contains the ciphertext, while a
  plaintext per-candidate running tally (`candidate.voteCount`) was kept alongside it — so the
  encryption protected nothing and manufactured false confidence.
- **Threshold-trustee homomorphic encryption (ElectionGuard) or full E2E-V (Helios/Belenios).**
  Rejected for this election: defends against insiders and gives voter verifiability, but the
  trust model was explicitly scoped to exclude insider threat, and the engineering cost
  (key ceremony, ZK proofs, verifiable tally, client-side encryption) is disproportionate to a
  small-scale student election.
- **Encryption with an out-of-DB key (separated deployment).** Would earn its keep only if Postgres
  were a third-party managed service while the key lived elsewhere. Not our deployment.

## Consequences

- Ballot secrecy now depends entirely on the *unlinkable two-table design* holding. Every back-reference
  from a ballot to a voter must be eliminated — including the `Vote → VotingSession → User` foreign-key
  chain, the unsalted `voterHash` on the ballot, **and** the audit-log row that records `userId` together
  with the vote's id. Any one of these silently re-links and defeats the decision.
- Tallies and turnout are plaintext aggregates — acceptable, because they are published anyway.
- This decision is revisitable: if the threat model later expands to insiders or to voter verifiability,
  it should be superseded by an ADR adopting ElectionGuard-style threshold encryption.
