# LOCKED RUBRIC (loop 2)

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

## Ratchet criterion (loop 2)

11. **Self-incriminating instability from his own answers, before evidence.**
    Judged observably:
    a. **Generated:** a case's interview contains ≥1 pair of the suspect's own
       answers that conflict — derivable from the answers alone, with no lever,
       record, or external evidence presented.
    b. **Visible:** once the player has heard both conflicting answers, the game
       surfaces the conflict to the player (an in-play cue, not buried).
    c. **Stored:** the system records the contradiction as queryable state.
    d. **Usable as leverage:** the stored contradiction can be spent later — to
       crack a lie and/or in the confrontation — functioning as leverage
       *without* an external lever.
    e. **Not rote / not the lever path:** this is distinct from the existing
       lever→lie mechanic; the conflict comes from two of his own statements.
