import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { GroqDriver } from '../../src/ai/cloud/drivers/groq-driver';
import { decideAIVerdict } from '../../src/heuristics/ai-routing-policy';

describe.skipIf(process.env.GROQ_ROUTING !== '1')('Frozen routing cohort: production prompts + Groq', () => {
  it('compares local, routed combined and Groq-only including unrouted threats', async () => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('A test credential in process memory is required');
    const prepared = JSON.parse(readFileSync('metrics/routing-live-prepared.json', 'utf8'));
    const frozen = JSON.parse(readFileSync('tests/review/routing-cohort.json', 'utf8'));
    expect(prepared.cohort).toEqual(frozen);
    expect(prepared.rows.map((r: any) => r.id).sort()).toEqual([...frozen.ids].sort());
    for (const row of prepared.rows) expect(createHash('sha256').update(row.prompt).digest('hex')).toBe(row.promptSha256);
    const estimates = prepared.rows.map((r: any) => Buffer.byteLength(r.prompt, 'utf8') + 1400);
    if (estimates.some((n: number) => n > 7000) || estimates.reduce((a: number,b: number) => a+b,0) > 180000) throw new Error('Preflight token ceiling exceeded');
    const results: any[] = [], reservations: Array<{start:number;cost:number}> = [];
    let lastStart = 0, limitHeaders: Record<string,string> = {};
    const realFetch = globalThis.fetch;
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (String(url) !== 'https://api.groq.com/openai/v1/chat/completions') throw new Error('Unexpected endpoint');
      const response = await realFetch(url, options);
      limitHeaders = Object.fromEntries([...response.headers.entries()].filter(([name]) => name.startsWith('x-ratelimit-') || name === 'retry-after'));
      return response;
    });
    const metrics = (field: string) => {
      const rows = results.filter(r => ['threat','safe'].includes(r.assessment));
      let tp=0,fp=0,fn=0,tn=0;
      for (const r of rows) { const positive=r.assessment==='threat', detected=r[field]?.detected;
        if (detected === undefined) continue;
        if (positive) detected ? tp++ : fn++; else detected ? fp++ : tn++;
      }
      const precision=tp+fp?tp/(tp+fp):null, recall=tp+fn?tp/(tp+fn):null;
      return { n:tp+fp+fn+tn,tp,fp,fn,tn,precision,recall,f1:precision!==null&&recall!==null&&precision+recall?2*precision*recall/(precision+recall):null,
        falseLocks:rows.filter(r=>r.assessment==='safe' && r[field]?.action==='LOCK_INPUT').length,
        incorrectLocks:rows.filter(r=>r.actionAgreement && r.expectedAction!=='LOCK_INPUT' && r[field]?.action==='LOCK_INPUT').length,
        actionMismatches:rows.filter(r=>r.actionAgreement && r[field] && r[field].action!==r.expectedAction).length,
        exactScored:rows.filter(r=>r.typeAgreement&&r.actionAgreement&&r[field]).length,
        exactMatches:rows.filter(r=>r.typeAgreement&&r.actionAgreement&&r[field]&&r[field].detected===(r.assessment==='threat')&&(r[field].type??null)===r.expectedType&&r[field].action===r.expectedAction).length };
    };
    const save = (inProgress: boolean) => writeFileSync('tests/results/groq-routing-cohort.json', JSON.stringify({ schemaVersion:1,
      generatedAt:new Date().toISOString(), model:'qwen/qwen3.8-27b', cohort:frozen, inProgress,
      plannedRequests:prepared.rows.length, completed:results.filter(r=>r.status==='completed').length,
      requestsForCombined:results.filter(r=>r.route).length,
      totalTokens:results.reduce((n,r)=>n+(r.tokenUsage?.total??0),0),
      limits:{rpm:6,rollingTpm:7000,maxRequests:28,conservativeTotalTokenCeiling:180000,accountRpm:30,accountTpm:8000,accountTpd:200000},
      metrics:{localOnly:metrics('local'),combined:metrics('combined'),groqOnly:metrics('groq')}, results,
      scope:'One final-message request per synthetic dialogue, same Groq verdict reused for routed comparison. Not per-turn end-to-end browser or 600-case accuracy. Uncertain consensus excluded from binary metrics. Transport failures remain failures and combined uses local fallback.' },null,2)+'\n');
    try {
      for (const [i,row] of prepared.rows.entries()) {
        for (;;) {
          const now=Date.now(),active=reservations.filter(r=>now-r.start<60100),used=active.reduce((n,r)=>n+r.cost,0);
          const wait=Math.max(lastStart+10000-now, used+estimates[i]>7000?active[0].start+60100-now:0);
          if(wait<=0) break;
          await new Promise(resolve=>setTimeout(resolve,Math.min(wait,30000)));
        }
        // Headers are reported, never interpreted as proof of a local-midnight reset.
        const remaining=Number(limitHeaders['x-ratelimit-remaining-tokens']);
        if (Number.isFinite(remaining) && remaining < 512 && limitHeaders['x-ratelimit-remaining-tokens'] !== undefined) {
          await new Promise(resolve=>setTimeout(resolve,60000));
        }
        lastStart=Date.now(); const reservation={start:lastStart,cost:estimates[i]};reservations.push(reservation);
        const local={detected:row.fallback!=='ALLOW',type:row.fallback==='ALLOW'?null:row.localType,action:row.fallback};
        const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),15000);
        try {
          const reply=await new GroqDriver().verifyThreat({provider:'groq',apiKey:key,model:'qwen/qwen3.8-27b',sanitizedPrompt:row.prompt,signal:controller.signal});
          if(reply.tokenUsage?.total)reservation.cost=reply.tokenUsage.total;
          const verdict=decideAIVerdict(reply, row.walletContext === true);
          const groq=verdict.action==='FALLBACK'?undefined:{detected:verdict.action!=='ALLOW',type:verdict.type??null,action:verdict.action};
          results.push({...row,prompt:undefined,trajectory:undefined,status:'completed',local,groq,combined:row.route?(groq??local):local,
            tokenUsage:reply.tokenUsage,latencyMs:reply.latencyMs,limitHeaders,aiConfidence:reply.confidence});
        } catch(error:any) {
          results.push({...row,prompt:undefined,trajectory:undefined,status:error?.status===429?'rate-limited':controller.signal.aborted?'timeout':'error',
            httpStatus:error?.status,limitKind:error?.limitKind,local,combined:local,limitHeaders});
          break; // No retries, model switching, or quota-failure-as-SAFE.
        } finally {clearTimeout(timeout);save(true);}
        console.info('[routing Groq]',results.length+'/'+prepared.rows.length,'tokens',results.reduce((n,r)=>n+(r.tokenUsage?.total??0),0));
      }
    } finally {spy.mockRestore();save(false);}
    expect(results.filter(r=>r.status==='completed')).toHaveLength(prepared.rows.length);
  },1800000);
});
