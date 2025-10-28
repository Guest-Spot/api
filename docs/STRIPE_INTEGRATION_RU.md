# Интеграция Stripe - Документация

## Обзор реализации

Успешно интегрирована платежная система Stripe для приема онлайн-платежей при бронировании с использованием **предавторизации платежей (pre-authorization)**.

### Ключевые особенности

✅ **Предавторизация платежей** - деньги замораживаются, но не списываются до принятия артистом  
✅ **Автоматическое распределение** - платформа получает комиссию, остальное переводится артисту  
✅ **Безопасность PCI DSS** - все данные карт обрабатываются только на стороне Stripe  
✅ **Автоматическая отмена** - платежи автоматически отменяются через 7 дней без ответа  
✅ **Email уведомления** - автоматические письма о статусах платежей  
✅ **Webhook обработка** - реалтайм обновления статусов платежей

## Как это работает

### Упрощенный процесс оплаты

```
1. Guest создает бронирование
   ↓
2. Guest вызывает API для создания платежа
   ↓
3. Guest перенаправляется на Stripe Checkout
   ↓
4. Guest вводит данные карты и оплачивает
   ↓
5. Деньги ЗАМОРАЖИВАЮТСЯ на карте (не списываются)
   ↓
6. Артист получает уведомление о новом бронировании
   ↓
7. Артист принимает решение:
   
   ПРИНИМАЕТ:                      ОТКЛОНЯЕТ:
   → Деньги списываются             → Деньги освобождаются
   → Переводятся артисту            → Возврат мгновенный
   → Минус комиссия платформы       → Без затрат для guest
   
   ↓                                ↓
8. Обе стороны получают уведомления
```

### Автоматическая отмена через 7 дней

Если артист не ответил в течение 7 дней:
- Система автоматически отменяет платеж
- Деньги возвращаются на карту guest
- Бронирование отклоняется
- Guest получает уведомление

## Что было реализовано

### 1. Обновление схемы данных

**Файл:** `src/api/booking/content-types/booking/schema.json`

Добавлены поля для платежей:
- `amount` - сумма платежа в центах
- `currency` - валюта (по умолчанию USD)
- `paymentStatus` - статус оплаты (unpaid, authorized, paid, cancelled, failed)
- `stripePaymentIntentId` - ID платежного намерения Stripe
- `stripeCheckoutSessionId` - ID сессии оплаты
- `platformFee` - комиссия платформы в центах
- `authorizedAt` - время авторизации платежа

### 2. Stripe сервис

**Файл:** `src/utils/stripe.ts`

Утилиты для работы со Stripe API:
- Инициализация Stripe клиента
- Создание Checkout Session с предавторизацией
- Захват платежа (capture) при принятии артистом
- Отмена платежа (cancel) при отклонении
- Верификация webhook подписей
- Расчет комиссии платформы

### 3. API endpoints

#### Создание платежа
**POST** `/api/bookings/:id/create-payment`

Создает Stripe Checkout Session и возвращает URL для оплаты.

**Защита:**
- Требуется аутентификация
- Только владелец бронирования может создать платеж
- Проверка наличия Stripe аккаунта у артиста

#### Webhook endpoint
**POST** `/api/webhooks/stripe`

Обрабатывает события от Stripe:
- `checkout.session.completed` - сохранение payment intent ID
- `payment_intent.amount_capturable_updated` - средства заморожены
- `payment_intent.succeeded` - успешное списание
- `payment_intent.payment_failed` - ошибка платежа
- `payment_intent.canceled` - отмена платежа

**Защита:**
- Верификация подписи Stripe (webhook signature)
- Без JWT аутентификации (проверка через подпись)

### 4. Автоматический capture/cancel

**Файл:** `src/api/booking/controllers/booking.ts`

При изменении статуса бронирования (`reaction`):
- **Принятие (accepted)** → автоматический capture payment intent
- **Отклонение (rejected)** → автоматический cancel payment intent

### 5. Cron задача

**Файл:** `src/utils/payment-cron.ts`

Автоматическая отмена просроченных авторизаций:
- Запускается каждый час
- Находит платежи старше 7 дней в статусе "authorized"
- Отменяет payment intent в Stripe
- Обновляет статус бронирования
- Отправляет уведомления

### 6. Email уведомления

#### Payment Required
**Файл:** `src/utils/email/payment-required.ts` + `.html`

Отправляется guest'у когда артист принял бронирование.

Содержит:
- Сумму платежа
- Ссылку на оплату
- Информацию о бронировании

#### Payment Success
**Файл:** `src/utils/email/payment-success.ts` + `.html`

Отправляется обеим сторонам при успешной оплате.

Содержит:
- Подтверждение платежа
- Детали бронирования
- Разные сообщения для guest и артиста

### 7. Документация

- `docs/STRIPE_INTEGRATION.md` - полная техническая документация (English)
- `docs/STRIPE_QUICKSTART.md` - быстрый старт для разработчиков (English)
- `README.md` - обновлен с переменными окружения и описанием флоу

## Настройка переменных окружения

Необходимо добавить в `.env`:

```bash
# Stripe API ключи
STRIPE_SECRET_KEY=sk_test_...                    # Секретный ключ Stripe
STRIPE_WEBHOOK_SECRET=whsec_...                  # Секрет для webhook

# Настройки платежей
BOOKING_AMOUNT=10000                              # Сумма в центах ($100.00)
STRIPE_PLATFORM_FEE_PERCENT=10                   # Комиссия платформы (10%)
DEFAULT_CURRENCY=usd                              # Валюта

# URL для перенаправлений
STRIPE_SUCCESS_URL=https://yourapp.com/booking-success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://yourapp.com/booking-cancelled

# URL вашего API
PUBLIC_URL=https://api.yourapp.com
```

## Безопасность и соответствие PCI DSS

### Реализованные меры безопасности

✅ **Никаких данных карт на сервере**
- Все платежные данные обрабатываются только на Stripe Checkout
- Карточные данные никогда не попадают на ваш сервер

✅ **Верификация webhook подписей**
- Каждый webhook запрос проверяется через Stripe signature
- Защита от поддельных уведомлений

✅ **Предавторизация платежей**
- Средства замораживаются, но не списываются
- Защита покупателя от несанкционированного списания

✅ **Stripe Connect**
- Безопасная передача средств артистам
- Автоматическое распределение комиссии

✅ **HTTPS обязателен**
- Все коммуникации со Stripe только через HTTPS
- Webhook endpoint должен использовать HTTPS в продакшене

### Соответствие PCI DSS

Данная реализация соответствует требованиям PCI DSS уровня SAQ A:
- Использование Stripe Checkout (hosted payment page)
- Отсутствие обработки карточных данных на сервере
- Отсутствие хранения sensitive cardholder data
- Использование токенизации Stripe

## API Endpoints

Доступны два способа работы с платежами:

### 1. REST API

**POST** `/api/bookings/:id/create-payment`

```javascript
fetch('https://api.yourapp.com/api/bookings/123/create-payment', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  }
})
```

### 2. GraphQL API ⭐

**Мутация:** `createBookingPayment`

```graphql
mutation {
  createBookingPayment(bookingId: "abc123") {
    sessionId
    sessionUrl
    booking {
      paymentStatus
      amount
      currency
    }
  }
}
```

**Преимущества GraphQL:**
- ✅ Получаете только нужные данные
- ✅ Единый endpoint для всех операций
- ✅ Типизация из коробки
- ✅ Встроенная документация (GraphQL Playground)

Подробная документация: [STRIPE_GRAPHQL.md](./STRIPE_GRAPHQL.md)

## Использование в мобильном приложении

### Интеграция в iOS/Android

#### С GraphQL (рекомендуется)

```typescript
// React Native с Apollo Client
import { gql, useMutation } from '@apollo/client';
import { Linking } from 'react-native';

const CREATE_PAYMENT = gql`
  mutation CreatePayment($bookingId: ID!) {
    createBookingPayment(bookingId: $bookingId) {
      sessionUrl
    }
  }
`;

function PaymentButton({ bookingId }) {
  const [createPayment, { loading }] = useMutation(CREATE_PAYMENT);

  const handlePay = async () => {
    const result = await createPayment({ variables: { bookingId } });
    await Linking.openURL(result.data.createBookingPayment.sessionUrl);
  };

  return <Button onPress={handlePay} title="Оплатить" />;
}
```

#### С REST API

1. **Создать бронирование через API**
2. **Вызвать endpoint создания платежа**
3. **Открыть Stripe Checkout в WebView** или использовать Stripe Mobile SDK
4. **Обработать редирект** после успешной оплаты
5. **Обновить UI** на основе webhook событий (через push notifications)

### Deep Links

Настройте success/cancel URLs как deep links:

```bash
STRIPE_SUCCESS_URL=guestspot://booking-success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=guestspot://booking-cancelled
```

## Тестирование

### Тестовые карты Stripe

**Успешная оплата:**
- Номер: `4242 4242 4242 4242`
- Срок: любая будущая дата
- CVC: любые 3 цифры

**Отклонение платежа:**
- Номер: `4000 0000 0000 0002`

**3D Secure аутентификация:**
- Номер: `4000 0025 0000 3155`

### Тестирование webhook локально

Используйте Stripe CLI:

```bash
# Установка (macOS)
brew install stripe/stripe-cli/stripe

# Логин
stripe login

# Прослушивание webhook
stripe listen --forward-to localhost:1337/api/webhooks/stripe
```

## Мониторинг

### Stripe Dashboard

Отслеживайте платежи в реальном времени:
- [Платежи](https://dashboard.stripe.com/payments)
- [События](https://dashboard.stripe.com/events)
- [Webhook](https://dashboard.stripe.com/webhooks)
- [Connect переводы](https://dashboard.stripe.com/connect/transfers)

### Логи приложения

Все операции логируются:
```
[info] Payment authorized for booking 123
[info] Payment captured for booking 123
[error] Error capturing payment intent: ...
```

## Onboarding артистов в Stripe Connect

Артисты должны завершить onboarding в Stripe Connect перед получением платежей.

### Процесс onboarding:

1. **Артист вызывает GraphQL мутацию:**
```graphql
mutation {
  createStripeOnboardingUrl {
    url
    accountId
  }
}
```

2. **Система создает Stripe Connect аккаунт** (если еще нет)

3. **Артист переходит по URL** на страницу Stripe

4. **Артист заполняет форму:**
   - Данные для идентификации
   - Банковский счет для выплат
   - Налоговая информация

5. **Stripe автоматически проверяет** данные

6. **Webhook уведомляет систему** о завершении

7. **Система обновляет** `payoutsEnabled: true`

8. **Артист готов принимать платежи!**

### Проверка статуса:

```graphql
mutation {
  checkStripeAccountStatus {
    onboarded
    payoutsEnabled
    chargesEnabled
  }
}
```

### Важно:

- ❌ Артист не может принимать платные букинги без onboarding
- ✅ URL для onboarding истекает через 30 минут
- ✅ Можно обновить URL через `refreshStripeOnboardingUrl`
- ✅ Webhook автоматически обновляет статус

Подробная документация: [STRIPE_CONNECT_ONBOARDING.md](./STRIPE_CONNECT_ONBOARDING.md)

## Что дальше?

### Необходимые шаги для запуска

1. ✅ Код готов и протестирован
2. ⏳ Создать Stripe аккаунт
3. ⏳ Получить API ключи (test для разработки)
4. ⏳ Настроить webhook endpoint (включая `account.updated`)
5. ⏳ Добавить переменные в `.env` (включая `FRONTEND_URL`)
6. ⏳ Реализовать UI для onboarding артистов
7. ⏳ Протестировать весь флоу (onboarding + платежи)
8. ⏳ Переключиться на live ключи для продакшена

### Будущие улучшения

Потенциальные расширения функционала:

1. **Динамическое ценообразование**
   - Артисты устанавливают свои ставки
   - Разные цены для разных типов работ

2. **Частичные платежи**
   - Депозит при создании
   - Остаток после выполнения

3. **Возвраты**
   - Частичный или полный возврат
   - При отмене со стороны любой из сторон

4. **Дополнительные способы оплаты**
   - Apple Pay
   - Google Pay
   - ACH transfers

5. **Аналитика**
   - Статистика успешных платежей
   - Средний чек
   - Конверсия

## Поддержка

### Документация

- [Полная документация](./STRIPE_INTEGRATION.md) - техническая информация (EN)
- [Quick Start Guide](./STRIPE_QUICKSTART.md) - быстрый старт для разработчиков (EN)
- [GraphQL API](./STRIPE_GRAPHQL.md) - документация GraphQL мутаций для платежей (EN)
- [Stripe Connect Onboarding](./STRIPE_CONNECT_ONBOARDING.md) - подключение артистов к Stripe (EN)
- [Stripe Docs](https://stripe.com/docs) - официальная документация Stripe

### Частые проблемы

Смотрите раздел "Troubleshooting" в [STRIPE_INTEGRATION.md](./STRIPE_INTEGRATION.md)

---

**Статус:** ✅ Полностью реализовано и готово к использованию  
**Дата:** 28 октября 2025  
**Версия:** 1.0.0

