import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { it, expect, vi } from 'vitest';
import { decideAIVerdict, hasWalletContext } from '../../src/heuristics/ai-routing-policy';

it('replays frozen real Groq replies with the wallet compatibility guard, without network requests', () => {
  const raw = readFileSync('tests/review/groq-routing-frozen.json', 'utf8');
  const source = JSON.parse(raw);
  const pack = ['a','b'].flatMap(block => JSON.parse(readFileSync(`tests/review/share/block-${block}.json`, 'utf8')).cases)
    .sort((a,b) => a.id.localeCompare(b.id));
  expect(createHash('sha256').update(JSON.stringify(pack)).digest('hex')).toBe(source.cohort.datasetSha256);
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Replay must not send requests'));
  try {
    expect(source.completed).toBe(28);
    const results = source.results.map((row: any) => {
      const evidence = pack.find((p: any) => p.id === row.id);
      const walletContext = hasWalletContext(evidence.messages.filter((m: any) => m.speaker === 'interlocutor').map((m: any) => m.text));
      const verdict = decideAIVerdict({ isScam: row.groq.detected, confidence: row.aiConfidence, scamType: row.groq.type ?? undefined }, walletContext);
      expect(verdict.action).not.toBe('FALLBACK');
      const groq = { detected: verdict.action !== 'ALLOW', type: verdict.type ?? null, action: verdict.action };
      return { id: row.id, assessment: row.assessment, route: row.route, expectedType: row.expectedType, expectedAction: row.expectedAction,
        typeAgreement: row.typeAgreement, actionAgreement: row.actionAgreement, walletContext,
        local: row.local, groq, combined: row.route ? groq : row.local,
        previousCombined: row.combined, changedAction: (row.route ? groq : row.local).action !== row.combined.action };
    });
    const summarize = (field: 'groq' | 'combined') => {
      const rows = results.filter((r: any) => ['safe','threat'].includes(r.assessment));
      const tp = rows.filter((r: any) => r.assessment === 'threat' && r[field].detected).length;
      const fp = rows.filter((r: any) => r.assessment === 'safe' && r[field].detected).length;
      const fn = rows.filter((r: any) => r.assessment === 'threat' && !r[field].detected).length;
      const tn = rows.filter((r: any) => r.assessment === 'safe' && !r[field].detected).length;
      return { n: rows.length, tp,fp,fn,tn,f1:2*tp/(2*tp+fp+fn),
        incorrectLocks: rows.filter((r: any) => r.expectedAction !== 'LOCK_INPUT' && r[field].action === 'LOCK_INPUT').length };
    };
    expect(network).not.toHaveBeenCalled();
    if (process.env.SOVA_ROUTING_REPORT === '1') writeFileSync('tests/results/groq-routing-replay.json', JSON.stringify({
      generatedAt: new Date().toISOString(), sourceReportSha256: createHash('sha256').update(raw).digest('hex'),
      mode: 'offline replay of the same real replies after guard change, not another live run', requests: 0,
      metrics: { combined: summarize('combined'), groq: summarize('groq') }, results }, null, 2) + '\n');
  } finally { network.mockRestore(); }
});
