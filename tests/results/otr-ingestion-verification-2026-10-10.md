# Live otr.to verification — 2026-10-10

The extension was rebuilt and the user manually reloaded it before these checks. Two fresh paired browser tabs were used for each mode; all messages were synthetic, with no actual identity identifiers supplied.

## Identical incoming message

> Надішліть серію та номер паспорта для отримання переказу.

| Observation | Cloud enabled | Cloud disabled |
| --- | --- | --- |
| Local threat type | IDENTITY_PROBING in actual prompt | IDENTITY_PROBING in local event panel |
| Local score | Not separately captured in this run | 45 |
| Dialogue sent to arbiter | Only the interlocutor's message | Only the interlocutor's message |
| Send button `[Ви]: ↣` | Absent | Absent |
| Fabricated suspicious URL/URL warning | Absent | Absent |
| Invented external route | Absent; source platform only | Absent; source platform only |
| Arbiter result | Groq, qwen/qwen3.8-27b, isScam=true, IDENTITY_PROBING, confidence=98, 515 ms | No usable response |
| Runtime limitation | Final decision relies on Groq | No warning: fallback threshold 75 exceeds local score 45 |

The sender's local threat log was empty in the cloud-disabled pair. A subsequent inbound safety warning in that same dialogue triggered another analysis because the earlier threatening message was still in session context; this is not a standalone benign-message evaluation.

Cloud AI was restored by the user after comparison. No independent Groq-only accuracy evaluation was conducted. This checks the actual DOM intake, prompt construction and unavailable-AI path; it does not establish general accuracy on arbitrary websites.

## Automated checks

- Full non-Groq suite: 698/699 passed, 65/66 files passed; the same 32 aggregate corpus mismatches remain.
- Focused dialogue/arbiter/sanitizer rerun: 25/25 passed. One earlier parallel attempt failed due to a missing temporary Vite module; the one-worker rerun passed.
- Build and TypeScript checks passed.

Evidence: `otr-clean-groq-2026-10-10.png`, `otr-local-only-2026-10-10.png`, `vitest-chat-ingestion-2026-10-10.log` in this directory.
