# Исправление: Login Links для Stripe Connect

## Проблема

При попытке использовать `getStripeDashboardUrl` возникала ошибка:

```
error: Error creating login link: Cannot create a login link for an account that has not completed onboarding.
```

## Причина

**Login Links** в Stripe работают ТОЛЬКО для аккаунтов, которые **УЖЕ завершили onboarding**.

Для новых аккаунтов Stripe требует использовать **Account Links** с типом `account_onboarding`.

## Решение

Реализована умная маршрутизация в мутации `getStripeDashboardUrl`:

```typescript
// Проверяем статус onboarding
const account = await getConnectAccount(accountId);
const onboarded = isAccountOnboarded(account);

if (onboarded) {
  // ✅ Для завершивших onboarding → Login Link (прямой доступ к Dashboard)
  const loginLink = await createLoginLink(accountId);
  return loginLink.url;
} else {
  // ✅ Для новых аккаунтов → Account Link (упрощенный onboarding)
  const accountLink = await createAccountLink({
    accountId,
    type: 'account_onboarding',
    refreshUrl: `${frontendUrl}/artist/stripe-setup?refresh=true`,
    returnUrl: `${frontendUrl}/artist/stripe-setup/success`,
  });
  return accountLink.url;
}
```

## Как это работает теперь

### Первое использование (новый артист)

```
1. Artist calls getStripeDashboardUrl
   ↓
2. Backend creates Stripe Express account
   ↓
3. Backend checks: account.details_submitted = false
   ↓
4. Returns ACCOUNT LINK → Simplified onboarding form
   ↓
5. Artist completes minimal form (bank details, etc.)
   ↓
6. Stripe marks account as onboarded
   ↓
7. Artist can receive payments! ✅
```

### Повторное использование (существующий артист)

```
1. Artist calls getStripeDashboardUrl
   ↓
2. Backend finds existing Stripe account
   ↓
3. Backend checks: account.details_submitted = true
   ↓
4. Returns LOGIN LINK → Direct dashboard access
   ↓
5. Artist accesses Stripe Dashboard
   ↓
6. Can update bank details, view payouts, etc.
```

## Типы ссылок в Stripe

### Account Link
- ✅ Для **новых** аккаунтов
- ✅ Ведет на **onboarding форму**
- ✅ Требует заполнения данных
- ⏰ Истекает через некоторое время
- 🔄 Можно создать новую если истекла

**Использование:**
```typescript
const accountLink = await stripe.accountLinks.create({
  account: accountId,
  refresh_url: 'https://yourapp.com/refresh',
  return_url: 'https://yourapp.com/success',
  type: 'account_onboarding', // или 'account_update'
});
```

### Login Link
- ✅ Для **onboarded** аккаунтов
- ✅ Ведет на **Express Dashboard**
- ✅ Прямой доступ, без форм
- ⏰ Одноразовая, истекает после использования
- 🔒 Более безопасная

**Использование:**
```typescript
const loginLink = await stripe.accounts.createLoginLink(accountId);
```

## Проверка статуса onboarding

Функция для проверки:

```typescript
export const isAccountOnboarded = (account: Stripe.Account): boolean => {
  return (
    account.details_submitted === true &&
    account.payouts_enabled === true &&
    account.charges_enabled === true
  );
};
```

**Критерии:**
- `details_submitted` - форма onboarding заполнена
- `payouts_enabled` - выплаты включены
- `charges_enabled` - прием платежей включен

## Тестирование

### Тест 1: Новый артист

```graphql
# Создаем артиста впервые
mutation {
  getStripeDashboardUrl {
    url
    accountId
  }
}

# Ожидаемый результат:
# url будет содержать "connect.stripe.com/setup/"
# Это Account Link для onboarding
```

### Тест 2: Существующий артист

```graphql
# После завершения onboarding вызываем снова
mutation {
  getStripeDashboardUrl {
    url
    accountId
  }
}

# Ожидаемый результат:
# url будет содержать "connect.stripe.com/express/"
# Это Login Link для dashboard
```

### Тест 3: Проверка статуса

```graphql
mutation {
  checkStripeAccountStatus {
    accountId
    onboarded
    payoutsEnabled
    chargesEnabled
    detailsSubmitted
  }
}

# Ожидаемый результат после onboarding:
# {
#   "accountId": "acct_xxx",
#   "onboarded": true,
#   "payoutsEnabled": true,
#   "chargesEnabled": true,
#   "detailsSubmitted": true
# }
```

## Обновленная документация

Обновлены следующие файлы:
- ✅ `src/extensions/graphql/stripe-connect.ts` - добавлена проверка статуса
- ✅ `docs/STRIPE_ARTIST_SETUP_RU.md` - обновлено описание workflow
- ✅ `docs/STRIPE_QUICKSTART.md` - уточнены детали Option A
- ✅ `docs/STRIPE_GRAPHQL.md` - обновлена документация мутации
- ✅ `docs/STRIPE_INTEGRATION_RU.md` - исправлено описание процесса
- ✅ `docs/CHANGELOG_STRIPE_SIMPLIFIED.md` - обновлен changelog

## Важные моменты

### 1. Нельзя создать Login Link для нового аккаунта
❌ **НЕ РАБОТАЕТ:**
```typescript
// Создали аккаунт
const account = await stripe.accounts.create({ type: 'express' });

// Сразу пытаемся создать Login Link
const link = await stripe.accounts.createLoginLink(account.id); 
// ERROR! Account has not completed onboarding
```

✅ **ПРАВИЛЬНО:**
```typescript
// Создали аккаунт
const account = await stripe.accounts.create({ type: 'express' });

// Создаем Account Link для onboarding
const link = await stripe.accountLinks.create({
  account: account.id,
  type: 'account_onboarding',
  refresh_url: '...',
  return_url: '...',
});
```

### 2. Login Link можно использовать только после onboarding
✅ **РАБОТАЕТ:**
```typescript
const account = await stripe.accounts.retrieve(accountId);

if (account.details_submitted && account.payouts_enabled) {
  // Теперь можно создать Login Link
  const link = await stripe.accounts.createLoginLink(accountId);
}
```

### 3. Account Link можно обновить
```typescript
// Если ссылка истекла, создаем новую
const accountLink = await stripe.accountLinks.create({
  account: accountId,
  type: 'account_update', // для обновления существующего аккаунта
  refresh_url: '...',
  return_url: '...',
});
```

## Ссылки

- [Stripe Account Links Documentation](https://stripe.com/docs/connect/account-links)
- [Stripe Login Links Documentation](https://stripe.com/docs/connect/express-dashboard#login-links)
- [Express Accounts Guide](https://stripe.com/docs/connect/express-accounts)

---

**Исправлено:** October 28, 2025  
**Статус:** ✅ Работает корректно

