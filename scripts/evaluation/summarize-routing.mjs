import { readFileSync, writeFileSync } from 'node:fs';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const live = read('tests/results/groq-routing-cohort.json');
const offline = read('metrics/routing-evaluation.json');
const old = read('tests/review/LOCAL_BASELINE.json');
const suite = read('.cache/routing-suite.json');
const replay = read('tests/results/groq-routing-replay.json');
if (live.inProgress || live.completed !== live.plannedRequests) throw new Error('Live cohort is incomplete; do not publish partial accuracy');
const percent = n => n == null ? '—' : (100*n).toFixed(1)+'%';
// Derived impact metrics, not a relabelling or a change to stored predictions.
for (const [name,field] of [['localOnly','local'],['combined','combined'],['groqOnly','groq']]) {
  const rows=live.results.filter(r=>['safe','threat'].includes(r.assessment));
  live.metrics[name].incorrectLocks=rows.filter(r=>r.actionAgreement&&r.expectedAction!=='LOCK_INPUT'&&r[field]?.action==='LOCK_INPUT').length;
  live.metrics[name].actionMismatches=rows.filter(r=>r.actionAgreement&&r[field]&&r[field].action!==r.expectedAction).length;
}
writeFileSync('tests/results/groq-routing-cohort.json',JSON.stringify(live,null,2)+'\n');
const table = Object.entries(live.metrics).map(([name,m]) => `| ${name} | ${m.n} | ${m.tp} | ${m.fp} | ${m.fn} | ${m.tn} | ${percent(m.precision)} | ${percent(m.recall)} | ${percent(m.f1)} | ${m.exactMatches}/${m.exactScored} | ${m.falseLocks} | ${m.incorrectLocks} |`).join('\n');
const latency = live.results.map(r=>r.latencyMs).filter(Number.isFinite).sort((a,b)=>a-b);
const missed = live.results.filter(r=>r.assessment==='threat'&&!r.route).map(r=>r.id);
const typeMismatches = live.results.filter(r=>r.assessment==='threat'&&r.typeAgreement&&r.groq&&r.groq.type!==r.expectedType)
  .map(r=>`| ${r.id} | ${r.expectedType} | ${r.groq.type} |`).join('\n');
const oldThreats = old.cases.filter(r=>r.assessment==='threat'&&r.actualDetected).length;
const oldWrongLocks = old.cases.filter(r=>r.scored&&r.actualAction==='LOCK_INPUT'&&r.confidence>=75&&r.expectedAction!=='LOCK_INPUT').length;
const currentWrongLocks = offline.rows.filter(r=>['safe','threat'].includes(r.assessment)&&r.fallback==='LOCK_INPUT'&&r.expectedAction!=='LOCK_INPUT').length;
const critical = offline.rows.filter(r=>r.assessment==='threat'&&r.expectedAction==='LOCK_INPUT');
const digest = { generatedAt:live.generatedAt, datasetSha256:offline.datasetSha256, referenceSha256:offline.referenceSha256,
  summary:offline.summary, incorrectFallbackLocks:currentWrongLocks,
  criticalFallback:{n:critical.length,locked:critical.filter(r=>r.fallback==='LOCK_INPUT').length,
    warned:critical.filter(r=>r.fallback==='WARN').length,allowed:critical.filter(r=>r.fallback==='ALLOW').length},
  cases:offline.rows.map(({id,assessment,expectedType,expectedAction,localDetected,localType,confidence,route,reason,fallback,trajectory})=>
    ({id,assessment,expectedType,expectedAction,localDetected,localType,confidence,route,reason,fallback,trajectory})) };
writeFileSync('tests/review/ROUTING_BASELINE.json', JSON.stringify(digest,null,2)+'\n');
writeFileSync('tests/review/ROUTING_EVALUATION_REPORT.md', `# Маршрутизація, резервний захист та local + Groq

Дата live-прогону: ${live.generatedAt}. Модель: \`${live.model}\`.

## Що змінено

- Конкретні чутливі й неоднозначні вхідні запити передаються арбітру навіть без сформованого локального наміру. Для цього шляху тип UNKNOWN, без локального попередження чи блокування. ABSTAIN сам по собі не є підставою для API-виклику.
- Впевнений ризиковий прогноз компактної моделі підтримує маршрутизацію лише за наявності запиту. Модель не призначає тип чи hard lock.
- AI-тип не переписується за словами у повідомленні чи поясненні. Коректна загроза від 50 балів попереджає; критичний тип блокує від 75. Некоректні й слабкі відповіді запускають резерв.
- Локальний hard lock потребує конкретного запиту секрету гаманця, військових відомостей чи шкідливої дії. Без доказу критичний тип дає WARN. Банер отримує цю дію явно; вона зберігається через background та перезавантаження.
- Попередній SCAM не створює штучного вердикту нового контексту. Точний кеш залишено. 429 означає недоступність арбітражу й backoff, не SAFE.

Код: [політика](../../src/heuristics/ai-routing-policy.ts), [чат](../../src/heuristics/chat-channel.ts), [runtime](../../entrypoints/content.ts), [UI](../../src/ui/friction.ts), [арбітр](../../src/ai/ai-arbiter.service.ts).

## Офлайн: усі 600 діалогів

| Вимірювання | До | Після |
| --- | ---: | ---: |
| Загрози, що запускають арбітраж на фінальній репліці | ${oldThreats}/240 (${percent(oldThreats/240)}) | ${offline.summary.routedThreats}/240 (${percent(offline.summary.routedThreats/240)}) |
| Безпечні діалоги, що запускають арбітраж | ${old.cases.filter(r=>r.assessment==='safe'&&r.actualDetected).length}/244 | ${offline.summary.routedSafe}/244 |
| Неправильний фінальний локальний LOCK_INPUT на визначених мітках | ${oldWrongLocks} | ${currentWrongLocks} |

Фінальний арбітраж потрібен у ${offline.summary.finalRouted}/600 діалогів; ${offline.summary.routedUncertain} із них мають невизначену/спірну розмітку. ${offline.summary.missedThreats.length} загрози на фінальній репліці досі не маршрутизуються. До фінального запиту нова резервна політика дала ${offline.summary.earlyFallbackLocks} блокувань; історичне відображення локального типу на дію давало 40 потенційних ранніх блокувань. Це оцінка політики, не повторний браузерний експеримент.

**Компроміс:** із ${critical.length} загроз з очікуваним LOCK_INPUT резерв реально блокує ${digest.criticalFallback.locked}, попереджає про ${digest.criticalFallback.warned}, не застосовує дії у ${digest.criticalFallback.allowed}. Без API резерв не забезпечує повного захисту. Безпечні діалоги досі отримують ${offline.rows.filter(r=>r.assessment==='safe'&&r.fallback==='WARN').length} локальних попереджень. Зникнення false locks не означає зникнення false positives.

Евристичну класифікацію не перенавчено: A F1 75,5%, B 73,9% залишаються історичними й поточними показниками raw-класифікатора. Маршрутизація й реальна дія виміряні окремо. [JSON](ROUTING_BASELINE.json).

## Живе порівняння на однакових 28 діалогах

До API-викликів зафіксовано [вибірку](routing-cohort.json): по два перші ID кожного узгодженого типу загрози, вісім safe, чотири ambiguous/disputed. Разом 16 threat, 8 safe, 4 невизначених. Це діагностична стратифікована вибірка, не оцінка поширеності атак. Очікування й ID не передавалися моделі.

Використано production-підготовку промпту в AIArbiterService, стабільну псевдонімізацію та GroqDriver. Один запит на фінальний контекст кожного діалогу. Groq-only перевіряє всі 28; combined використовує ті самі відповіді тільки для ${live.requestsForCombined} маршрутизованих випадків, а для решти залишає локальний резерв. Це економить повторні API-виклики й чесно враховує пропущені маршрутизатором загрози.

| Режим | N | TP | FP | FN | TN | Precision | Recall | F1 | Точний збіг | Блокування safe | Неправильні блокування загалом |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${table}

Невизначені чотири випадки виключено з binary та exact метрик, їх рішення збережено в JSON. Маршрутизатор пропустив загрози: ${missed.join(', ')}. Незалежна сильна модель сама по собі не виправляє пропущені API-виклики.

Розбіжності точного типу Groq:

| ID | Попередня узгоджена мітка | Groq |
| --- | --- | --- |
${typeMismatches}

OTHER не є окремим production-класом. Дві seed/crypto розбіжності також відображають межу таксономії: компактний промпт наразі групує seed-фрази з компрометацією криптогаманця. Бінарне виявлення не доводить правильності категорії; ці розбіжності не приховано й мітки не змінено.

**Помилка дії у вихідному live-прогоні:** R-0146 — запит GitHub-токена з очікуваним OTHER/WARN, але Groq повернув CRYPTO_WALLET_COMPROMISE і спричинив LOCK_INPUT. Діалог небезпечний, тому це не binary false positive і не блокування safe, але дія надмірна. Отже, нуль FP не означає нуль помилкових блокувань. Вихідний JSON і таблиця вище зберігають цей результат.

### Після вимірювання: сумісність криптоблокування з контекстом

Додано загальну умову: навіть впевнений AI-тип CRYPTO_WALLET_COMPROMISE/SEED_PHRASE_THEFT дає hard lock лише за ознак криптогаманця/seed-фрази у чотирьох останніх вхідних репліках. Сам GitHub/AWS/SSH ключ цього не доводить: ризик залишається WARN. Це не змінює модель, промпт чи еталонну мітку і не виправляє її категорію. Є окремі тести на не-криптографічні access tokens і справжній секрет криптогаманця.

На тих самих 28 збережених відповідях виконано **офлайн replay без нових API-запитів**. Змінилася лише дія R-0146: LOCK_INPUT → WARN. Combined F1 залишається ${percent(replay.metrics.combined.f1)}, неправильних блокувань стало ${replay.metrics.combined.incorrectLocks}. Це перевірка нового guard на відомій помилці, а не незалежний повторний live-прогін чи доказ узагальнення. [Replay JSON](../results/groq-routing-replay.json), [тест](routing-replay.test.ts).

API: ${live.completed}/${live.plannedRequests} відповідей, ${live.totalTokens.toLocaleString('en-US')} токенів, без автоматичних повторів чи заміни моделі. Темп ≤6 RPM, rolling резерв ≤7000 TPM; доступні headers збережено. Загальний conservative preflight ceiling — 180000 токенів, фактична витрата показана вище. Ліміти користувача: 30 RPM / 8000 TPM / 200000 TPD. Headers не доводять скидання добового token budget за місцевою північчю.

HTTP latency: median ${latency[Math.floor(latency.length/2)]} мс, p95 ${latency[Math.min(latency.length-1,Math.floor(latency.length*.95))]} мс, max ${latency.at(-1)} мс. Це не повна UI-затримка; паузи limiter не включені. Live harness має timeout 15 с; production dispatcher може мати коротший налаштований timeout. Перевірки timeout/late reply, недоступності, 429, банера і клавіатури — окремі автоматизовані runtime-тести.

**Межі:** синтетичні споріднені сімейства, попередній консенсус двох ШІ без людського узгодження, один stochastic прогін, лише фінальні контексти. Повний combined прогін 600 діалогів, live аналіз кожної репліки, слабкий CPU та peak RAM тут не виміряні. Сирі промпти й ключ не публікуються.

## Перевірки й відтворення

Офлайн: ${suite.numPassedTests}/${suite.numTotalTests} тестів; ${suite.numFailedTests} помилок. Перевірка TypeScript і збірка також виконані. [Live JSON](../results/groq-routing-cohort.json).

1. \`SOVA_ROUTING_REPORT=1\` + \`npm test -- tests/review/routing.evaluation.test.ts\` — відтворити offline JSON і тимчасові production-промпти в ignored metrics/.
2. \`GROQ_ROUTING=1\` + \`node scripts/evaluation/run-groq-prompts.mjs\` — ключ через прихований ввід. Викликати лише явно, це витрачає квоту.
3. \`node scripts/evaluation/summarize-routing.mjs\` — звіт після повного live-прогону; неповний результат не публікується як точність.
`);
console.log('Routing report written; live cohort complete.');
