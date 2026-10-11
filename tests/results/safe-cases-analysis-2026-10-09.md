# Analysis after adding 100 safe and ambiguous cases

Date: 2026-10-09  
The 100 new cases were split across development (+34), regressions (+33), and holdout (+33). Corpus shape and unique IDs validate; TypeScript compilation passes.

## Updated corpus result

The local corpus evaluator reports **135 mismatches** and exits with one failed exact-match test; the four corpus-structure and ID checks pass. Full output is in `tests/results/corpus-after-safe-cases-2026-10-09.log`.

| Metric | Before | After |
|---|---:|---:|
| Cases | 226 | 326 |
| Benign/ambiguous cases | 37 | 137 |
| True positive | 88 | 88 |
| False positive | 0 | 4 |
| False negative | 101 | 101 |
| True negative | 37 | 133 |
| Precision | 100.0% | 95.7% |
| Specificity | 100.0% | 97.1% |
| Recall | 46.6% | 46.6% |
| F1 | 63.5% | 62.6% |

The increase in measured false positives is useful: the new negative controls exposed four existing false alarms instead of hiding them. Three examples newly trigger a threat class because they mention a messenger or identity-related wording in a benign/qualified context. One identity-support message is classified as military sabotage and maps to `LOCK_INPUT`, which deserves highest priority for correction. Case IDs: `safe2-reg-003`, `safe2-reg-007`, `safe2-reg-012`, and `safe2-reg-016`.

The corpus now has 41/100 benign or ambiguous cases in development, 52/113 in regressions, and 44/113 in holdout. Overall, 137/326 (42.0%) are benign/ambiguous. The new cases did not improve recall because they are negative controls; they improved the reliability of the precision/false-alarm estimate and revealed context-handling gaps.

## Next changes to the detector

1. Treat messaging-app names as a weak feature only. Require a directed request to move the conversation (or exchange contact information) before forming `OFF_PLATFORM_REDIRECT`; quoted discussion, comparison, negation, and explicit preference to stay on platform should remain safe.
2. For identity probing, require a request for sensitive identity data, not an ordinary name needed for a shipping label or a sentence denying that an address/tax ID was requested.
3. Add a high-impact safety gate before `LOCK_INPUT`: the military intent must have specific action/target evidence and should not be produced by a generic identity/support sentence. For uncertain cases, return `WARN` or defer to the arbiter.
4. Add multi-turn cases for negation, quotation, reported speech, and conflicting context. Ensure threat evidence comes from the interlocutor and recent relevant turns, not simply any matching word in the dialogue.
5. Keep the holdout examples untouched during tuning; after rule changes, evaluate the existing 44 safe/ambiguous holdout cases plus new independently reviewed examples.

Do not treat the 95.7% precision estimate as a production guarantee. The corpus is synthetic and still modest; continue adding independently reviewed examples from varied platforms, languages, and message styles.
