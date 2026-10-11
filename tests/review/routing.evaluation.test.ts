import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { it, expect, vi } from 'vitest';
import { ChatSessionState } from '../../src/heuristics/chat-session-state';
import { ChatChannelMonitor } from '../../src/heuristics/chat-channel';
import { AIArbiterService } from '../../src/ai/ai-arbiter.service';
import { decideAIRoute, getRuntimeFallbackAction, hasWalletContext } from '../../src/heuristics/ai-routing-policy';

it('measures routing on all 600 conversations and freezes production prompts for the live cohort', async () => {
  const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
  const refs = read('tests/review/references.json');
  const cohort = read('tests/review/routing-cohort.json');
  const pack = [...read('tests/review/share/block-a.json').cases, ...read('tests/review/share/block-b.json').cases].sort((a,b) => a.id.localeCompare(b.id));
  expect(createHash('sha256').update(JSON.stringify(pack)).digest('hex')).toBe(refs.datasetSha256);
  expect(cohort.datasetSha256).toBe(refs.datasetSha256);
  const rows: any[] = [], prepared: any[] = [];
  const history = vi.spyOn(ChatChannelMonitor, 'getDialogueHistory').mockImplementation(() => ChatSessionState.getDialogueHistory());
  let prompt = '';
  vi.stubGlobal('chrome', { runtime: { sendMessage(message: any, callback: any) {
    if (message.type === 'AI_VERIFY') { prompt = message.payload.sanitizedPrompt; callback({ aiResult: null }); }
  } } });
  try {
    for (const c of pack) {
      ChatSessionState.reset(); AIArbiterService.clearCache();
      let scan: ReturnType<typeof ChatSessionState.addMessageAndEvaluate> | undefined;
      const trajectory: any[] = [];
      for (const [index, m] of c.messages.entries()) {
        scan = ChatSessionState.addMessageAndEvaluate(m.text, m.speaker === 'interlocutor' ? 'inbound' : 'outbound');
        if (m.speaker !== 'interlocutor') continue;
        const route = decideAIRoute(scan, m.text);
        const fallback = scan.hasFormedIntent ? getRuntimeFallbackAction(scan.intentType ?? '', scan.confidence,
          ChatSessionState.getRecentMessages().filter(m => m.direction === 'inbound').map(m => m.rawText)) : 'ALLOW';
        trajectory.push({ turn: index + 1, route: route.route, reason: route.reason, fallback });
      }
      const ref = refs.cases.find((r: any) => r.id === c.id);
      const last = trajectory.at(-1);
      const row = { ...ref, ...last, localDetected: scan!.hasFormedIntent, localType: scan!.hasFormedIntent ? scan!.intentType : null,
        confidence: scan!.confidence ?? 0, trajectory };
      rows.push(row);
      if (cohort.ids.includes(c.id)) {
        const latest = c.messages.filter((m: any) => m.speaker === 'interlocutor').at(-1).text;
        await AIArbiterService.verify({ context: { sessionId: 'synthetic-cohort', sourcePlatform: 'synthetic-review', scenario: scan!.intentType ?? 'UNKNOWN',
          threatLevel: 'HIGH', detectedKeywords: scan!.matchedSpans.map(s => s.text), offPlatformLure: false, timestamp: Date.now(), ttlMs: 900000 },
          rawTextToScan: latest, intentType: scan!.intentType ?? 'UNKNOWN', confidence: scan!.confidence });
        expect(prompt).toBeTruthy();
        expect(prompt).not.toContain(c.id);
        prepared.push({ ...row, walletContext: hasWalletContext(ChatSessionState.getRecentMessages().filter(m => m.direction === 'inbound').map(m => m.rawText)),
          prompt, promptSha256: createHash('sha256').update(prompt).digest('hex') });
      }
    }
  } finally { history.mockRestore(); vi.unstubAllGlobals(); ChatSessionState.reset(); AIArbiterService.clearCache(); }
  const threats = rows.filter(r => r.assessment === 'threat'), safe = rows.filter(r => r.assessment === 'safe');
  const summary = { conversations: rows.length, threats: threats.length, routedThreats: threats.filter(r => r.route).length,
    missedThreats: threats.filter(r => !r.route).map(r => r.id), safe: safe.length, routedSafe: safe.filter(r => r.route).length,
    routedUncertain: rows.filter(r => !['safe','threat'].includes(r.assessment) && r.route).length,
    finalRouted: rows.filter(r => r.route).length, allTurnRoutes: rows.reduce((n,r) => n + r.trajectory.filter((t: any) => t.route).length, 0),
    earlyFallbackLocks: rows.filter(r => r.trajectory.some((t: any) => t.turn <= 8 && t.fallback === 'LOCK_INPUT')).length,
    safeFinalFallbackLocks: safe.filter(r => r.fallback === 'LOCK_INPUT').length };
  expect(rows).toHaveLength(600); expect(prepared).toHaveLength(cohort.ids.length);
  if (process.env.SOVA_ROUTING_REPORT === '1') {
    mkdirSync('metrics', { recursive: true });
    writeFileSync('metrics/routing-evaluation.json', JSON.stringify({ generatedAt: new Date().toISOString(), datasetSha256: refs.datasetSha256,
      referenceSha256: refs.corpusSha256, summary, rows }, null, 2) + '\n');
    writeFileSync('metrics/routing-live-prepared.json', JSON.stringify({ cohort, rows: prepared }, null, 2) + '\n');
  }
  console.info('[routing evaluation]', JSON.stringify(summary));
}, 60000);
