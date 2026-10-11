import type { IntentClassificationResult } from './intent-classifier';
import { extractRequestSignals } from './request-signals';
import { getThreatMitigationAction, getLocalFallbackAction, type ThreatMitigationAction } from './threat-mitigation-policy';

/** Routing is a request for review, never permission to warn or lock. */
export function decideAIRoute(scan: IntentClassificationResult, text: string) {
  if (scan.hasFormedIntent) return { route: true, reason: 'formed-intent', intentType: scan.intentType ?? 'UNKNOWN' };
  const requests = extractRequestSignals(text).filter(s => s.stance === 'request' && s.object !== 'public_reference');
  const sensitive = requests.some(s => ['secret', 'wallet_secret', 'identity', 'military_sensitive'].includes(s.object));
  const uncertain = requests.some(s => s.concealed || s.destination === 'external' ||
    ['account', 'bank_details', 'generic_data'].includes(s.object));
  const model = scan.localClassifier;
  const learnedRisk = model?.status === 'ok' && model.decision !== 'SAFE' && model.decision !== 'ABSTAIN';
  // ABSTAIN alone is normal for greetings and unsupported language; do not send all chats.
  if (sensitive || uncertain || (learnedRisk && requests.length > 0)) {
    return { route: true, reason: sensitive ? 'sensitive-request' : 'uncertain-request', intentType: 'UNKNOWN' };
  }
  return { route: false, reason: 'no-review-evidence', intentType: 'UNKNOWN' };
}

const KNOWN_TYPES = new Set(['ESCROW_DELIVERY_SCAM', 'OFF_PLATFORM_REDIRECT', 'VERIFICATION_PHISHING',
  'PAYMENT_CREDENTIAL_THEFT', 'IDENTITY_PROBING', 'URGENCY_PRESSURE', 'MILITARY_SABOTAGE_RECRUITMENT',
  'SEED_PHRASE_THEFT', 'CRYPTO_WALLET_COMPROMISE', 'SUSPICIOUS_LURE']);

/** Never infer a hard-lock type from raw words, reasoning, or a local hypothesis. */
export function decideAIVerdict(reply: { isScam: boolean; confidence: number; scamType?: string } | null, walletContext = false):
  { action: ThreatMitigationAction | 'FALLBACK'; type?: string } {
  if (!reply || typeof reply.isScam !== 'boolean' || !Number.isFinite(reply.confidence) ||
    reply.confidence < 0 || reply.confidence > 100 || reply.confidence < 50) return { action: 'FALLBACK' };
  if (!reply.isScam) return { action: 'ALLOW' };
  if (!reply.scamType || !KNOWN_TYPES.has(reply.scamType)) return { action: 'FALLBACK' };
  const action = getThreatMitigationAction(true, reply.scamType);
  const unsupportedCrypto = ['CRYPTO_WALLET_COMPROMISE', 'SEED_PHRASE_THEFT'].includes(reply.scamType) && !walletContext;
  return { action: action === 'LOCK_INPUT' && (reply.confidence < 75 || unsupportedCrypto) ? 'WARN' : action, type: reply.scamType };
}

/** A generic access token/private key is sensitive, but not necessarily a cryptocurrency wallet. */
export function hasWalletContext(texts: string[]): boolean {
  return texts.slice(-4).some(text => /(?:крипто|гаман|кошел|wallet|seed|сід|сид[ -]?фраз|мнемон|recovery\s+phrase|фраз[а-яіїєё]*\s+відновлення|(?:12|24)\s+(?:слів|слова|слов|words))/iu.test(text.slice(0,4096)));
}

/** A local military resemblance cannot lock input without a concrete harmful request. */
export function hasConcreteLocalLockEvidence(type: string, texts: string[]): boolean {
  const signals = texts.slice(-4).flatMap(extractRequestSignals).filter(s => s.stance === 'request');
  if (type === 'SEED_PHRASE_THEFT' || type === 'CRYPTO_WALLET_COMPROMISE') {
    return signals.some(s => s.object === 'wallet_secret' && s.complete);
  }
  if (type !== 'MILITARY_SABOTAGE_RECRUITMENT') return false;
  return signals.some(s => s.object === 'military_sensitive' && s.complete) || texts.slice(-4).some(text =>
    /(?:підпали|підпаліть|спали|спаліть|підірви|підірвіть|пошкодь|пошкодьте|set\s+fire|burn|sabotage)[^.!?\n]{0,100}(?:шаф|релей|трансформатор|залізниц|військов|infrastructure|relay|transformer)/iu.test(text) &&
    !/(?:не|never|do\s+not|don't)\s+(?:підпал|спал|підрив|пошкод|set\s+fire|burn|sabotage)/iu.test(text) &&
    !/(?:цитат|приклад|example|quote|шахрай\s+(?:писав|просив)|scammer\s+(?:said|asked)|[«“"])[^.!?\n]{0,100}(?:підпали|спали|підірви|пошкодь|set\s+fire|burn|sabotage)/iu.test(text));
}

export function getRuntimeFallbackAction(type: string, confidence: number | undefined, texts: string[]): ThreatMitigationAction {
  const action = getLocalFallbackAction(type, confidence);
  return action === 'LOCK_INPUT' && !hasConcreteLocalLockEvidence(type, texts) ? 'WARN' : action;
}
