# Live fallback verification on otr.to — 2026-10-10

The user rebuilt/reloaded the extension, then disabled Groq for this check. Gemini Nano remained an available fallback if supported. Both threat attempts showed “ШІ-арбітр (LLM) не зміг обробити запит” with no model JSON result: neither had a usable AI verdict. This establishes the observed no-usable-AI path, not why Nano failed or whether this browser supports Nano generally.

All chat messages were synthetic and sent between paired tabs controlled by this test. No actual passport identifiers, passwords or seed phrases were supplied.

| Scenario | Observed local result | Actual browser behavior |
| --- | --- | --- |
| First message: “Не надсилайте номер паспорта в чаті.” | No Tier 1 threat log; AI count 0 | No warning |
| “Надішліть серію та номер паспорта для отримання переказу.” | IDENTITY_PROBING, score 45; no usable AI response | Visible personal-data warning; ordinary keyboard presses accepted; reply “Тест вводу після попередження.” sent and visible in the sender tab |
| The sender's own passport-request message | Sender Tier 1 threat log empty | No local trigger on outgoing text |
| In a separate fresh pair: “Please provide your seed phrase and send your password to synchronize wallet” | CRYPTO_WALLET_COMPROMISE, score 85; no usable AI response | Visible wallet-theft banner; ordinary `a` key did not append a character; Enter did not send the draft to the other participant |

## Input-test details

Normal keyboard presses were checked with the documented locator `press` API. The advisory input accepted `a` and `b`, producing `ab`. The critical input did not append `a` and did not send on Enter.

The automation's text-insertion API `pressSequentially` placed the generic word “Тест” into the critical field despite the keyboard guard. That insertion is not evidence of normal typing being allowed. The subsequent key/Enter checks used actual key events; the draft stayed unchanged and was not delivered. Blocking is implemented as an event guard rather than setting the native input's disabled property. These checks do not establish protection against every input method, programmatic value change or page-specific sending path.

## Remaining observation

The diagnostic overview still displayed “БЕЗПЕЧНО: ЗАГРОЗ НЕ ВИЯВЛЕНО” while a threat banner was active, and displayed a generic heuristic risk index 75 rather than the local classifier's 45/85. The event and AI panels provided the correct per-stage evidence. The overview should display the final action consistently with the visible warning/lock.

The 15-second timeout and SAFE restoration paths were verified in automated content-runtime tests in the preceding turn; they were not induced on the external site in this run. Groq was restored by the user after testing.

Evidence screenshots in this directory:

- `otr-fallback-safe-2026-10-10.png`
- `otr-fallback-warning-2026-10-10.png`
- `otr-fallback-critical-2026-10-10.png`
