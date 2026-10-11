# Аналіз невідповідностей корпусу — 2026-10-09

Оцінка згенерована 2026-10-09T11:21:32.964Z; SHA-256 корпусу: 9319bb14b87430898ea9dc42f14cff7faa03aa37e215861612e633ab87442cde. Усього 326 сценаріїв; точний збіг 251/326 (77.0%). Розбіжностей: 75; невідповідностей дії: 63; хибних LOCK_INPUT: 0. Метрики виміряні на синтетичному корпусі.

## Розбивка за корпусом

| Split | Сценарії | Позитивні мітки | Точні збіги | Частка точних збігів |
|---|---:|---:|---:|---:|
| development | 100 | 59 | 94 | 94.0% |
| regressions | 113 | 61 | 86 | 76.1% |
| holdout | 113 | 68 | 71 | 62.8% |

## Зведення за типом розбіжності

| Група | Кількість |
|---|---:|
| Пропуск загрози: ESCROW_DELIVERY_SCAM → SAFE | 14 |
| Пропуск загрози: IDENTITY_PROBING → SAFE | 12 |
| Неправильний клас: VERIFICATION_PHISHING → PAYMENT_CREDENTIAL_THEFT | 11 |
| Пропуск загрози: CRYPTO_WALLET_COMPROMISE → SAFE | 11 |
| Пропуск загрози: MILITARY_SABOTAGE_RECRUITMENT → SAFE | 11 |
| Пропуск загрози: PAYMENT_CREDENTIAL_THEFT → SAFE | 6 |
| Пропуск загрози: VERIFICATION_PHISHING → SAFE | 3 |
| Пропуск загрози: OFF_PLATFORM_REDIRECT → SAFE | 3 |
| Неправильний клас: CRYPTO_WALLET_COMPROMISE → PAYMENT_CREDENTIAL_THEFT | 2 |
| Неправильний клас: OFF_PLATFORM_REDIRECT → ESCROW_DELIVERY_SCAM | 1 |
| Хибне спрацювання: SAFE → PAYMENT_CREDENTIAL_THEFT | 1 |

## Висновки та наступний пріоритет

1. **Виправлено нормалізовані назви месенджерів.** Латинські назви на кшталт Telegram/Signal/WhatsApp перетворювалися нормалізатором на змішані латинсько-кириличні форми. Словник не розпізнавав їх. Додано такі форми й кілька конкретних дієвих конструкцій. У development та regressions більше немає помилок класу OFF_PLATFORM_REDIRECT; чотири такі помилки залишилися у holdout і не використовувалися для налаштування.
2. **Holdout очищено від витоку точних прикладів.** 49 повідомлень, що дублювали development/regressions, замінено незалежними випадками зі збереженими мітками. Додано автоматичний тест на точний текстовий перетин, зараз він проходить. Окремий ручний огляд семантично близьких сценаріїв усе ще потрібен.
3. **Загальна оцінка покращилася, але ще не достатня.** Тепер 251/326 точних результатів, precision 99.2%, recall 68.1%, F1 80.8%; хибних блокувань — 0. Є один false positive у holdout: безпечне пояснення про перевірку банківського застосунку класифікувалося як запит платіжного секрету. Його слід занести до розгляду, але не підлаштовувати поточне правило під holdout.
4. Наступний клас для роботи — **ESCROW_DELIVERY_SCAM** (14 пропусків), потім **IDENTITY_PROBING** (12), **CRYPTO_WALLET_COMPROMISE** (11), **MILITARY_SABOTAGE_RECRUITMENT** (11). Для LOCK_INPUT не знижувати поріг без незалежних безпечних/цитованих контролів.

## Повна таблиця розбіжностей

| ID | Корпус | Тип помилки | Очікувалось (клас / дія) | Фактично (клас / дія) | Впевненість | Повідомлення |
|---|---|---|---|---|---:|---|
| dev-verification-002 | development | Неправильний клас | VERIFICATION_PHISHING / WARN | PAYMENT_CREDENTIAL_THEFT / WARN | 76 | interlocutor: Підтвердіть профіль: надішліть код із SMS, який щойно надійшов від банку. |
| dev-verification-004 | development | Неправильний клас | VERIFICATION_PHISHING / WARN | PAYMENT_CREDENTIAL_THEFT / WARN | 60 | interlocutor: To verify your account, send the card security code and SMS confirmation code. |
| dev-escrow-004 | development | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: I arranged courier delivery. Click this link to receive your payment: https://example.invalid/claim |
| dev2-id-003 | development | Пропуск загрози | IDENTITY_PROBING / WARN | — / ALLOW | 0 | interlocutor: Напишите серию и номер паспорта для получения перевода. |
| dev2-crypto-002 | development | Пропуск загрози | CRYPTO_WALLET_COMPROMISE / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Пришлите вашу мнемоническую фразу из 24 слов для проверки кошелька. |
| dev2-military-004 | development | Пропуск загрози | MILITARY_SABOTAGE_RECRUITMENT / LOCK_INPUT | — / ALLOW | 0 | interlocutor: We pay couriers to collect reconnaissance information about military sites. |
| reg-identity-002 | regressions | Пропуск загрози | IDENTITY_PROBING / WARN | — / ALLOW | 0 | interlocutor: Скажите девичью фамилию матери для проверки личности. |
| reg-crypto-001 | regressions | Пропуск загрози | CRYPTO_WALLET_COMPROMISE / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Підтримка гаманця просить ввести вашу сід-фразу з 12 слів для відновлення. |
| reg2-verification-001 | regressions | Неправильний клас | VERIFICATION_PHISHING / WARN | PAYMENT_CREDENTIAL_THEFT / WARN | 76 | interlocutor: Для підтвердження замовлення введіть код із SMS у формі за посиланням https://verify.example.invalid. |
| reg2-verification-002 | regressions | Неправильний клас | VERIFICATION_PHISHING / WARN | PAYMENT_CREDENTIAL_THEFT / WARN | 75 | interlocutor: Надішліть код підтвердження, щоб ми перевірили ваш профіль. |
| reg2-verification-003 | regressions | Пропуск загрози | VERIFICATION_PHISHING / WARN | — / ALLOW | 0 | interlocutor: Ваш акаунт заблокують, якщо не підтвердите вхід за посиланням https://secure.example.invalid/check. |
| reg2-verification-004 | regressions | Пропуск загрози | VERIFICATION_PHISHING / WARN | — / ALLOW | 0 | interlocutor: Служба безпеки просить одноразовий код для скасування підозрілої операції. |
| reg2-verification-006 | regressions | Неправильний клас | VERIFICATION_PHISHING / WARN | PAYMENT_CREDENTIAL_THEFT / WARN | 76 | interlocutor: Повідомте код із SMS оператору чату для завершення перевірки. |
| reg2-payment-002 | regressions | Пропуск загрози | PAYMENT_CREDENTIAL_THEFT / WARN | — / ALLOW | 0 | interlocutor: Надішліть фото картки з обох боків для зарахування коштів. |
| reg2-payment-006 | regressions | Пропуск загрози | PAYMENT_CREDENTIAL_THEFT / WARN | — / ALLOW | 0 | interlocutor: Щоб покупець оплатив доставку, авторизуйтеся в банку за https://wallet.example.invalid/restore. |
| reg2-identity-001 | regressions | Пропуск загрози | IDENTITY_PROBING / WARN | — / ALLOW | 0 | interlocutor: Надішліть фото паспорта з обох боків для оформлення доставки. |
| reg2-identity-004 | regressions | Пропуск загрози | IDENTITY_PROBING / WARN | — / ALLOW | 0 | interlocutor: Завантажте фото посвідчення особи у форму https://pay.example.invalid. |
| reg2-identity-005 | regressions | Пропуск загрози | IDENTITY_PROBING / WARN | — / ALLOW | 0 | interlocutor: Надішліть адресу проживання та номер документа для реєстрації виплати. |
| reg2-identity-006 | regressions | Пропуск загрози | IDENTITY_PROBING / WARN | — / ALLOW | 0 | interlocutor: Підтвердіть особу, повідомивши серію та номер паспорта. |
| reg2-escrow-001 | regressions | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: Оплатив доставку, заберіть кошти через https://verify.example.invalid. |
| reg2-escrow-002 | regressions | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: Для отримання грошей за товар відкрийте форму перевізника https://parcel.example.invalid/claim. |
| reg2-escrow-003 | regressions | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: Платформа зарезервувала оплату; введіть картку на https://secure.example.invalid/check для зарахування. |
| reg2-escrow-004 | regressions | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: Я вже оплатив замовлення, підтвердіть доставку за посиланням https://pay.example.invalid. |
| reg2-escrow-005 | regressions | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: Кур’єр чекає підтвердження виплати на сторінці https://account.example.invalid/confirm. |
| reg2-escrow-006 | regressions | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: Щоб отримати передоплату, пройдіть оформлення доставки на https://wallet.example.invalid/restore. |
| reg2-military-003 | regressions | Пропуск загрози | MILITARY_SABOTAGE_RECRUITMENT / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Знайдіть графік переміщення техніки та передайте його нам. |
| reg2-military-004 | regressions | Пропуск загрози | MILITARY_SABOTAGE_RECRUITMENT / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Потрібен кур’єр, щоб закласти пристрій біля військової будівлі. |
| reg2-military-005 | regressions | Пропуск загрози | MILITARY_SABOTAGE_RECRUITMENT / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Зніміть на відео систему ППО та позначте місце на мапі. |
| reg2-military-006 | regressions | Пропуск загрози | MILITARY_SABOTAGE_RECRUITMENT / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Допоможіть пошкодити військовий транспорт, витрати компенсуємо. |
| reg2-crypto-001 | regressions | Пропуск загрози | CRYPTO_WALLET_COMPROMISE / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Надішліть seed phrase з 12 слів для відновлення гаманця. |
| reg2-crypto-002 | regressions | Пропуск загрози | CRYPTO_WALLET_COMPROMISE / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Підтримка просить приватний ключ, щоб синхронізувати баланс. |
| reg2-crypto-005 | regressions | Пропуск загрози | CRYPTO_WALLET_COMPROMISE / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Надішліть резервну фразу з 24 слів нашому фахівцю. |
| reg2-crypto-006 | regressions | Пропуск загрози | CRYPTO_WALLET_COMPROMISE / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Для повернення токенів повідомте приватний ключ гаманця. |
| hold-off-001 | holdout | Пропуск загрози | OFF_PLATFORM_REDIRECT / WARN | — / ALLOW | 0 | interlocutor: У мене не відкривається чат, переходьте в Telegram за адресою t.me/order_help. |
| hold-verify-001 | holdout | Неправильний клас | VERIFICATION_PHISHING / WARN | PAYMENT_CREDENTIAL_THEFT / WARN | 76 | interlocutor: Для підтвердження профілю відкрийте посилання та введіть код із SMS: https://example.invalid/check |
| hold-verify-003 | holdout | Неправильний клас | VERIFICATION_PHISHING / WARN | PAYMENT_CREDENTIAL_THEFT / WARN | 68 | interlocutor: Для подтверждения выплаты введите одноразовый пароль из SMS. |
| hold-id-002 | holdout | Пропуск загрози | IDENTITY_PROBING / WARN | — / ALLOW | 0 | interlocutor: Напишите девичью фамилию матери, чтобы восстановить доступ. |
| hold-escrow-003 | holdout | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: I have placed the order. Follow this link to claim your payout: https://example.invalid/payout |
| hold-mil-005 | holdout | Пропуск загрози | MILITARY_SABOTAGE_RECRUITMENT / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Photograph the military checkpoint and send its location for payment. |
| hold-crypto-001 | holdout | Пропуск загрози | CRYPTO_WALLET_COMPROMISE / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Надішліть вашу мнемонічну фразу з 24 слів для перевірки гаманця. |
| hold2-phone-003 | holdout | Пропуск загрози | OFF_PLATFORM_REDIRECT / WARN | — / ALLOW | 0 | interlocutor: У застосунку не бачу вкладень, тому давайте перейдемо у WhatsApp для фото. |
| hold2-phone-005 | holdout | Неправильний клас | OFF_PLATFORM_REDIRECT / WARN | ESCROW_DELIVERY_SCAM / WARN | 65 | interlocutor: Наберіть мене через Telegram, щоб я пояснив, як оформити замовлення. |
| hold2-phone-006 | holdout | Пропуск загрози | OFF_PLATFORM_REDIRECT / WARN | — / ALLOW | 0 | interlocutor: Для швидшого погодження доставки зв’яжімося в Signal поза чатом майданчика. |
| hold2-verification-001 | holdout | Неправильний клас | VERIFICATION_PHISHING / WARN | PAYMENT_CREDENTIAL_THEFT / WARN | 60 | interlocutor: Щоб підтвердити покупку, введіть одноразовий код у формі за адресою https://order.example.invalid/approve. |
| hold2-verification-002 | holdout | Неправильний клас | VERIFICATION_PHISHING / WARN | PAYMENT_CREDENTIAL_THEFT / WARN | 75 | interlocutor: Продиктуйте код підтвердження з повідомлення, і я завершу перевірку вашого акаунта. |
| hold2-verification-003 | holdout | Пропуск загрози | VERIFICATION_PHISHING / WARN | — / ALLOW | 0 | interlocutor: Необхідно негайно підтвердити особу на https://profile.example.invalid/login, інакше замовлення скасують. |
| hold2-verification-004 | holdout | Неправильний клас | VERIFICATION_PHISHING / WARN | PAYMENT_CREDENTIAL_THEFT / WARN | 81 | interlocutor: Працівник безпеки просить надіслати код входу, щоб нібито зупинити переказ. |
| hold2-verification-006 | holdout | Неправильний клас | VERIFICATION_PHISHING / WARN | PAYMENT_CREDENTIAL_THEFT / WARN | 76 | interlocutor: Для розблокування профілю надішліть код, який щойно прийшов на ваш телефон. |
| hold2-payment-001 | holdout | Пропуск загрози | PAYMENT_CREDENTIAL_THEFT / WARN | — / ALLOW | 0 | interlocutor: Впишіть термін дії картки та три цифри з її звороту у форму виплати https://cash.example.invalid. |
| hold2-payment-002 | holdout | Пропуск загрози | PAYMENT_CREDENTIAL_THEFT / WARN | — / ALLOW | 0 | interlocutor: Покажіть картку з лицьового й зворотного боку, щоб бухгалтерія зарахувала кошти. |
| hold2-payment-004 | holdout | Пропуск загрози | PAYMENT_CREDENTIAL_THEFT / WARN | — / ALLOW | 0 | interlocutor: Заповніть номер картки, дату завершення дії та CVV для отримання компенсації. |
| hold2-payment-005 | holdout | Пропуск загрози | PAYMENT_CREDENTIAL_THEFT / WARN | — / ALLOW | 0 | interlocutor: Оператор просить код із банківського SMS, аби завершити зарахування грошей. |
| hold2-identity-001 | holdout | Пропуск загрози | IDENTITY_PROBING / WARN | — / ALLOW | 0 | interlocutor: Для договору оренди надішліть скан паспорта та місце реєстрації. |
| hold2-identity-003 | holdout | Пропуск загрози | IDENTITY_PROBING / WARN | — / ALLOW | 0 | interlocutor: Яке повне ім’я вказано у вашому документі та в якому місті ви народилися? |
| hold2-identity-004 | holdout | Пропуск загрози | IDENTITY_PROBING / WARN | — / ALLOW | 0 | interlocutor: Завантажте посвідчення особи у форму перевірки https://id.example.invalid/upload. |
| hold2-identity-005 | holdout | Пропуск загрози | IDENTITY_PROBING / WARN | — / ALLOW | 0 | interlocutor: Перед оформленням компенсації повідомте адресу проживання та номер паспорта. |
| hold2-identity-006 | holdout | Пропуск загрози | IDENTITY_PROBING / WARN | — / ALLOW | 0 | interlocutor: Для звірки профілю потрібні ваше прізвище при народженні та податковий номер. |
| hold2-escrow-001 | holdout | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: Покупець уже оплатив доставку; заберіть кошти через форму https://parcel.example.invalid/payout. |
| hold2-escrow-002 | holdout | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: Кур’єр приїде після того, як ви підтвердите отримання оплати на зовнішній сторінці. |
| hold2-escrow-003 | holdout | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: Сервіс угоди нібито зарезервував суму — відкрийте посилання для її виведення. |
| hold2-escrow-004 | holdout | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: Щоб кур’єр привіз посилку, оплатіть страховий збір через надіслану форму. |
| hold2-escrow-005 | holdout | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: Після продажу платформа має переказати гроші; авторизуйтеся для підтвердження виплати. |
| hold2-escrow-006 | holdout | Пропуск загрози | ESCROW_DELIVERY_SCAM / WARN | — / ALLOW | 0 | interlocutor: Я створив заявку на кур’єра. Для зарахування вартості товару підтвердьте картку тут: https://ship.example.invalid/receive. |
| hold2-military-002 | holdout | Пропуск загрози | MILITARY_SABOTAGE_RECRUITMENT / LOCK_INPUT | — / ALLOW | 0 | interlocutor: З’ясуйте, коли змінюється варта на об’єкті, та надішліть розклад. |
| hold2-military-003 | holdout | Пропуск загрози | MILITARY_SABOTAGE_RECRUITMENT / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Поставте позначку на мапі біля місця стоянки військової техніки й поділіться координатами. |
| hold2-military-004 | holdout | Пропуск загрози | MILITARY_SABOTAGE_RECRUITMENT / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Потрібно залишити запалювальну суміш біля складу; оплату переказую після фото. |
| hold2-military-005 | holdout | Пропуск загрози | MILITARY_SABOTAGE_RECRUITMENT / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Зніміть розташування блокпоста та надішліть відео з геолокацією. |
| hold2-military-006 | holdout | Пропуск загрози | MILITARY_SABOTAGE_RECRUITMENT / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Допоможіть вивести з ладу службове авто біля військової частини за винагороду. |
| hold2-crypto-001 | holdout | Неправильний клас | CRYPTO_WALLET_COMPROMISE / LOCK_INPUT | PAYMENT_CREDENTIAL_THEFT / WARN | 53 | interlocutor: Для імпорту гаманця надішліть усі 12 секретних слів відновлення. |
| hold2-crypto-002 | holdout | Неправильний клас | CRYPTO_WALLET_COMPROMISE / LOCK_INPUT | PAYMENT_CREDENTIAL_THEFT / WARN | 78 | interlocutor: Щоб перевірити баланс, введіть приватний ключ криптогаманця у форму підтримки. |
| hold2-crypto-003 | holdout | Пропуск загрози | CRYPTO_WALLET_COMPROMISE / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Розблокуйте крипторахунок, передавши seed-фразу нашому консультанту. |
| hold2-crypto-004 | holdout | Пропуск загрози | CRYPTO_WALLET_COMPROMISE / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Служба безпеки біржі просить пароль від вашого криптогаманця для синхронізації. |
| hold2-crypto-005 | holdout | Пропуск загрози | CRYPTO_WALLET_COMPROMISE / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Надішліть 24 слова резервної фрази, і ми відновимо доступ до токенів. |
| hold2-crypto-006 | holdout | Пропуск загрози | CRYPTO_WALLET_COMPROMISE / LOCK_INPUT | — / ALLOW | 0 | interlocutor: Для повернення криптовалюти повідомте секретний ключ від гаманця. |
| hold2-benign-007 | holdout | Хибне спрацювання | — / ALLOW | PAYMENT_CREDENTIAL_THEFT / WARN | 76 | interlocutor: Я сам відкрию застосунок банку, щоб перевірити надходження, і не передаватиму коди. |
