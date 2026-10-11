import { describe, it, expect } from 'vitest';
import { decideAIRoute, decideAIVerdict, hasConcreteLocalLockEvidence, hasWalletContext } from '../../../src/heuristics/ai-routing-policy';
import { ChatSessionState } from '../../../src/heuristics/chat-session-state';

describe('AI routing and independent mitigation', () => {
  it.each(['Привіт, гарного дня!', 'Не надсилайте пароль у чаті.', 'Ось публічний звіт для читання.'])(
    'does not route greetings/advice/public references: %s', text => {
      ChatSessionState.reset();
      expect(decideAIRoute(ChatSessionState.addMessageAndEvaluate(text, 'inbound'), text).route).toBe(false);
    });
  it('routes a request even without a formed intent, without inventing a local type', () => {
    const text = 'Надайте інформацію про родину мені в особистий чат.';
    expect(decideAIRoute({ hasFormedIntent: false, matchedSpans: [], clustersDetected: [], normalizedText: text }, text))
      .toMatchObject({ route: true, intentType: 'UNKNOWN' });
  });
  it('does not route ABSTAIN on its own', () => {
    ChatSessionState.reset();
    const scan = ChatSessionState.addMessageAndEvaluate('Вітаю!', 'inbound');
    expect(decideAIRoute(scan, 'Вітаю!').route).toBe(false);
  });
  it('uses the explicit AI type, with stronger confidence required for locking', () => {
    expect(decideAIVerdict({ isScam: true, confidence: 96, scamType: 'OFF_PLATFORM_REDIRECT' }).action).toBe('WARN');
    expect(decideAIVerdict({ isScam: true, confidence: 74, scamType: 'MILITARY_SABOTAGE_RECRUITMENT' }).action).toBe('WARN');
    expect(decideAIVerdict({ isScam: true, confidence: 75, scamType: 'MILITARY_SABOTAGE_RECRUITMENT' }).action).toBe('LOCK_INPUT');
  });
  it.each([null, { isScam: true, confidence: 99, scamType: 'ALIEN' },
    { isScam: false, confidence: 49 }, { isScam: true, confidence: NaN, scamType: 'IDENTITY_PROBING' }])(
    'falls back for unavailable, malformed or inconclusive verdicts', reply => expect(decideAIVerdict(reply).action).toBe('FALLBACK'));
  it('requires concrete evidence for a local military lock', () => {
    expect(hasConcreteLocalLockEvidence('MILITARY_SABOTAGE_RECRUITMENT', ['Можу спочатку безкоштовно розкласти по кроках.'])).toBe(false);
    expect(hasConcreteLocalLockEvidence('MILITARY_SABOTAGE_RECRUITMENT', ['Підпали релейну шафу за гроші.'])).toBe(true);
    expect(hasConcreteLocalLockEvidence('MILITARY_SABOTAGE_RECRUITMENT', ['Не підпали релейну шафу.'])).toBe(false);
    expect(hasConcreteLocalLockEvidence('MILITARY_SABOTAGE_RECRUITMENT', ['Шахрай писав: «Підпали релейну шафу».'])).toBe(false);
    expect(hasConcreteLocalLockEvidence('MILITARY_SABOTAGE_RECRUITMENT', ['Do not set fire to the relay transformer.'])).toBe(false);
    expect(hasConcreteLocalLockEvidence('CRYPTO_WALLET_COMPROMISE', ['Надішли мені private key.'])).toBe(true);
  });
  it('does not treat repository/cloud access tokens as cryptocurrency wallets', () => {
    for (const text of ['Надішли GitHub token для доступу до репозиторію.', 'Share your AWS access key.', 'Provide the SSH private key.']) {
      expect(hasWalletContext([text])).toBe(false);
      expect(decideAIVerdict({ isScam: true, confidence: 99, scamType: 'CRYPTO_WALLET_COMPROMISE' }, hasWalletContext([text])).action).toBe('WARN');
    }
    expect(decideAIVerdict({ isScam: true, confidence: 99, scamType: 'CRYPTO_WALLET_COMPROMISE' }, hasWalletContext(['Надішли приватний ключ криптогаманця.'])).action).toBe('LOCK_INPUT');
  });
});
