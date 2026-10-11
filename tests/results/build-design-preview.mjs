// Local visual snapshots of the real renderers; no extension storage or AI transport.
import { createServer } from 'vite';
import { Window } from 'happy-dom';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const window = new Window({ url: 'https://preview.sova.local/' });
window.happyDOM.settings.enableJavaScriptEvaluation = false;
window.happyDOM.settings.disableCSSFileLoading = true;
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Event', 'MouseEvent', 'MutationObserver']) {
  Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true });
}
const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
const output = 'tests/results/design-preview';
const messages = JSON.parse(readFileSync('public/_locales/uk/messages.json', 'utf8'));
globalThis.chrome = {
  runtime: {getURL: (file) => file},
  i18n: {getMessage: (key, substitutions = []) => {
    const entry = messages[key];
    const values = Array.isArray(substitutions) ? substitutions : [substitutions];
    let message = entry?.message || key;
    for (const [name, value] of Object.entries(entry?.placeholders || {})) {
      message = message.replaceAll(`$${name.toUpperCase()}$`, value.content.replace(/\$(\d+)/g, (_, n) => values[Number(n)-1] || ''));
    }
    return message;
  }},
};
mkdirSync(output, { recursive: true });
copyFileSync('public/logo.png', `${output}/logo.png`);
try {
  const { DebuggerOverlay } = await vite.ssrLoadModule('/src/ui/debugger-overlay.ts');
  const { SemanticTriggerEngine } = await vite.ssrLoadModule('/src/heuristics/semantic-trigger.ts');
  const { UnifiedFrictionModal } = await vite.ssrLoadModule('/src/ui/unified-modal.ts');
  const { SecurityFriction } = await vite.ssrLoadModule('/src/ui/friction.ts');
  const { ShadowHost } = await vite.ssrLoadModule('/src/ui/shadow-host.ts');
  const { DESIGN_TOKENS_CSS } = await vite.ssrLoadModule('/src/ui/design-tokens.ts');
  const save = (name, markup, css = '') => writeFileSync(`${output}/${name}.html`, `<!doctype html><html lang="uk"><meta charset="utf-8"><title>С.О.В.А. · ${name} · локальний preview</title><style>${DESIGN_TOKENS_CSS}body{margin:0;padding:24px;background:var(--sanctuary-canvas);font-family:var(--font-sanctuary);color:var(--sanctuary-ink-primary)}.preview-frame{width:460px;height:680px;margin:0 auto}.preview-caption{text-align:center;font-size:12px;margin:0 0 16px;color:var(--sanctuary-ink-secondary)}${css}</style><body><p class="preview-caption">Локальний preview · синтетичні дані</p><div class="preview-frame">${markup}</div></body></html>`);
  const snapshot = () => DebuggerOverlay.shadowRoot.innerHTML;
  DebuggerOverlay.clear();
  DebuggerOverlay.show();
  DebuggerOverlay.state.activeTab = 'vectors';
  DebuggerOverlay.render();
  save('empty-spectrum', snapshot());
  const telemetry = SemanticTriggerEngine.getDefaultTelemetry();
  DebuggerOverlay.recordVectorTelemetry(telemetry);
  DebuggerOverlay.render();
  save('spectrum', snapshot());
  save('spectrum-narrow', snapshot(), '.preview-frame{width:340px}');
  DebuggerOverlay.state.activeTab = 'overview';
  DebuggerOverlay.setSession('preview-session', 'HIGH');
  DebuggerOverlay.setThreatDecision('WARN', 'IDENTITY_PROBING', 45, 'local');
  save('overview', snapshot());
  const cancelled = DebuggerOverlay.beginAICheck({ sessionId:'preview-session',text:'Попередня репліка',intent:'IDENTITY_PROBING' });
  DebuggerOverlay.finishAICheck(cancelled,'cancelled',undefined,'Контекст оновився.');
  const id = DebuggerOverlay.beginAICheck({ sessionId:'preview-session',text:'Надішліть серію та номер паспорта.',dialogue:'[Співрозмовник]: Надішліть серію та номер паспорта.',intent:'IDENTITY_PROBING',flags:['Запит персональних даних'],redactedCount:0,preparedPrompt:'Перевірити запит персональних даних у вхідному повідомленні.' });
  DebuggerOverlay.aiHistory.records.at(-1).startedAt -= 515;
  const result={isScam:true,scamType:'IDENTITY_PROBING',confidence:98,reasoning:'Співрозмовник просить паспортні дані. Це може бути спробою викрадення особистості.',provider:'Groq',modelUsed:'qwen/qwen3.8-27b',latencyMs:515,rawResponse:'{"isScam":true,"confidence":98,"scamType":"IDENTITY_PROBING"}',requestMessages:[{role:'system',content:'You are a cybersecurity arbiter. Respond with JSON.'},{role:'user',content:'Перевірити запит персональних даних у вхідному повідомленні.'}]};
  DebuggerOverlay.finishAICheck(id,'completed',result);
  DebuggerOverlay.state.activeTab = 'ai'; DebuggerOverlay.render(true); save('ai', snapshot());
  save('ai-narrow', snapshot(), '.preview-frame{width:340px}');
  DebuggerOverlay.shadowRoot.querySelector('details').open=true;
  DebuggerOverlay.render(true);save('ai-expanded',snapshot());
  DebuggerOverlay.shadowRoot.querySelector('#btn-review-pause').click();
  DebuggerOverlay.log('Нова подія','Дані надходять під час призупинення',undefined,false);
  save('ai-paused',snapshot());
  DebuggerOverlay.shadowRoot.querySelector('#btn-review-pause').click();
  DebuggerOverlay.state.activeTab = 'events'; DebuggerOverlay.render(); save('events', snapshot());
  await UnifiedFrictionModal.show({type:'form',title:'Перевірте платіж',badgeText:'Платіжні дані',badgeLevel:'HIGH',contextLabel:'Сайт',contextValue:'preview.sova.local',triggers:[{message:'Сторінка запитує конфіденційні дані.',severity:'HIGH'}],onProceed:()=>{},onCancel:()=>{}});
  save('modal', ShadowHost.getRoot().innerHTML);
  UnifiedFrictionModal.close();
  SecurityFriction.showContextWarningBanner({sessionId:'preview',threatLevel:'HIGH',sourceDomain:'preview.sova.local',sourceUrl:'https://preview.sova.local/',scenario:'IDENTITY_PROBING',detectedAt:Date.now(),lastUpdatedAt:Date.now(),expiresAt:Date.now()+60000},'Співрозмовник просить паспортні дані.',undefined,'IDENTITY_PROBING','Надішліть номер паспорта.',45);
  save('banner', ShadowHost.getRoot().innerHTML);
  let popup=readFileSync('entrypoints/popup/index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace('href="./style.css"','href="popup.css"').replaceAll('src="/logo.png"','src="logo.png"');
  const popupCss=readFileSync('entrypoints/popup/style.css','utf8').replace("@import '../../src/ui/design-tokens.css';",DESIGN_TOKENS_CSS);
  writeFileSync(`${output}/popup.css`,popupCss);
  writeFileSync(`${output}/popup.html`,popup);
  for(const tab of ['Vault','Settings']){
    let html=popup.replace('id="tabContentShield" role="tabpanel"','id="tabContentShield" hidden style="display:none" role="tabpanel"');
    html=html.replace(new RegExp(`(id="tabContent${tab}"[^>]*?) hidden style="display: none;"`),'$1');
    html=html.replace('segment-btn active','segment-btn').replace(`class="segment-btn" id="tabBtn${tab}"`,`class="segment-btn active" id="tabBtn${tab}"`);
    if(tab==='Vault')html=html.replace('id="vaultLockedState" style="display: none;"','id="vaultLockedState"');
    writeFileSync(`${output}/popup-${tab.toLowerCase()}.html`,html);
  }
  console.info(`Rendered visual snapshots in ${output}`);
} finally {
  await vite.close();
  await window.happyDOM.abort();
}
