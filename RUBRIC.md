# LOCKED RUBRIC (loop 7)

The testable interpretation of the locked goal. Each criterion is judged by
**observable behavior of the build** — by playing/testing it or by running its
generators/tests — never by intent, labels, prose, commit messages, or
architecture. Not edited during the loop.

For each criterion the checker returns: met / partial / missing, the observed
evidence, the test performed, and the failure mode if any.

## Criteria

1. **Reacts, lies, lies back.** In play, asking a lie returns a false claim;
   countering it (lever/contradiction) makes the suspect produce a *new* line
   rather than fall silent. Confronting a claim head-on deflects into a propping
   lie rather than conceding.
2. **Lies introduced through questioning and grow under pressure.** A lie's
   telling changes as it is pressed/re-told (observably different text), and at
   least one new claim is produced under pressure that was not present before.
3. **Every case differs meaningfully across seeds.** A bare generated case
   (no opts pinning shape) varies structurally — ≥3 distinct segment counts and
   ≥3 distinct solve orders across a sample of seeds.
4. **All content generated in code.** No json/csv/png/audio/asset content files
   outside node_modules; portraits, audio, scenery, and text are code-generated.
5. **Every case verified solvable.** The generator runs a solvability check on
   every shipped case; a sample of seeds (incl. difficulty range) is winnable.
6. **Optimization layer present and meaningful.** A run is scored against a
   computed par, rated, and recorded; inefficiency has a consequence somewhere.
7. **PW's gotcha.** A catch is crisp and *earned* — only fireable once a
   precondition the player assembled is held; it lands as a distinct beat.
8. **PW's escalation.** The suspect's story grows/patches under pressure: a
   caught/ pressed lie yields a new lie or exposes a new attackable point.
9. **PW's theater.** Drama around the key moments (catch / final break):
   observable sting, motion, and a visual payoff, all code-generated.
10. **Generativity + keystone + "a lie can't tell itself the same way twice"**
    are preserved: keystone cases occur and cascade; deflection/claim phrasing
    is seeded and does not repeat verbatim across uses.

## Ratchet criterion (loop 7)

16. **Cornered, he invents a new lie — a real attackable patch, not flavor.**
    Judged observably (with the patch mechanic live):
    a. **A new claim appears:** being cornered (a prop he leaned on breaks, or his
       lie is caught) can produce a segment that did NOT exist in the base case —
       observable as a new segment id in the live web that isn't in the static
       case definition.
    b. **It re-covers the hole:** after the patch, the attack the broken prop was
       covering no longer lands directly — it now deflects through the new claim,
       so the new claim must be dealt with to make progress.
    c. **It is itself breakable:** the patch segment has a reachable seam — a lead
       that breaks it is held/revealed — and presenting that lead breaks it.
    d. **Bounded / terminates:** patching is finite (a prop patches at most once;
       patch segments do not themselves spawn unbounded patches); a mechanical
       playthrough always reaches `solved` — no infinite loop.
    e. **Still solvable & sound:** across a seed sample with the patch live, every
       case is winnable, and criteria 1–15 still hold. The patch phrasing is
       seeded (does not read identically every time).

## Ratchet criterion (loop 6 — retained)

15. **The two unasked questions surface in the confrontation as his cover.**
    Judged observably:
    a. **Revealed:** entering the confrontation, the game names the two questions
       that went unasked (identifiable verbatim from their text), shown to the
       player as a distinct beat — not left silent.
    b. **Cover surfaced:** for an unasked PRODUCTIVE question (lie / lever / tell /
       keystone), the confrontation presents a steer toward the prop it concerned
       — a cue tied to that specific segment — distinct from the leads already
       held and from the keystone-suspicion steer.
    c. **Not a free break:** the steer does not break or pre-topple the prop. The
       segment is NOT `broken` on arrival merely because its question went
       unasked; it must still be attacked through the web (criterion 7 holds).
    d. **Dramatized:** the reveal is a code-generated beat (sting / motion /
       toast), present at all difficulties (it is the structural payoff of the
       five-for-three split, not a lenient-only hint).
    e. **Sound & winnable:** every case stays solvable whichever two questions go
       unasked; criteria 1–14 still hold.

## Ratchet criterion (loop 5 — retained)

14. **The interview composition varies across cases.** Judged observably:
    a. **Contradiction retained:** every case still carries ≥1 self-contradiction
       (criterion 11 holds).
    b. **Varies:** across a sample of seeds, both shapes occur — cases with a
       SECOND own-words contradiction (≥2 tell questions) and cases with a
       record/lever pair instead — so it is not a fixed template (≥2 distinct
       compositions, neither rare).
    c. **Tell count varies:** the number of "tell" questions per case is not
       constant across seeds (some 1, some ≥2).
    d. **Sound:** all cases remain solvable and criteria 1–13 still hold.

## Ratchet criterion (loop 2 — retained)

11. **Self-incriminating instability from his own answers, before evidence.**
    Judged observably:
    a. **Generated:** a case's interview contains ≥1 pair of the suspect's own
       answers that conflict — derivable from the answers alone, with no lever,
       record, or external evidence presented.
    b. **His answers are plainly readable:** both conflicting answers are shown
       to the player verbatim (a transcript), so the conflict is *available* to
       notice.
    c. **Stored:** the system records the contradiction as queryable state.
    d. **Usable as leverage:** the stored contradiction can be spent later — to
       crack a lie and/or in the confrontation — functioning as leverage
       *without* an external lever.
    e. **Not the lever path:** this is distinct from the existing lever→lie
       mechanic; the conflict comes from two of his own statements.

## Ratchet criterion (loop 4)

13. **The keystone reaches Act 1.** Judged observably (keystone cases unless noted):
    a. **Surfaced:** a keystone case's interview includes a question whose answer
       is his corroborating witness (the keystone claim), askable in Act 1; it has
       no lever and no tell, so it cannot be broken in the interview.
    b. **Suspicion from his own words:** asking it (no external evidence) registers
       a stored, queryable suspicion about the witness.
    c. **Carries as a steer:** in the confrontation, the keystone segment is
       observably steered toward (a cue shown only when the suspicion was raised),
       not shown for an un-suspected keystone.
    d. **Not pre-broken, cascade intact:** the keystone is NOT broken or cascaded
       by Act 1; breaking it in Act 2 still cascades everything leaning on it.
    e. **No false positives:** non-keystone cases register no keystone suspicion
       and show no such steer.

## Ratchet criterion (loop 3 — retained)

12. **The contradiction is the player's to discover.** Judged observably at the
    DEFAULT (standard) difficulty unless noted:
    a. **Not announced:** after both conflicting answers are heard at standard,
       the game does NOT fire a cue that declares the contradiction or identifies
       which claim it breaks (no "his own words don't square" / "press that lie"
       message). The player is not told.
    b. **Available:** the information needed is plainly on screen — his two
       answers are both shown verbatim in the transcript.
    c. **Actable:** once the player notices, they can act — the contradicted lie
       is selectable and pressing it (with the contradiction held) catches it.
    d. **Lenient teaches:** at the lowest difficulty the game DOES name the
       conflict and what to do, so the mechanic is learnable.
    e. **Winnable if missed:** a player who never notices still wins — the prop
       carries to the confrontation and is breakable there.
