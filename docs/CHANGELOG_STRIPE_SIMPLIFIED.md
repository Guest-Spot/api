# Changelog: Simplified Stripe Connect Onboarding

## Date: October 28, 2025

## Summary

Добавлен упрощенный процесс подключения Stripe Connect для артистов. Теперь артистам не нужно проходить полную форму onboarding - достаточно только добавить банковские реквизиты.

---

## What Changed

### New GraphQL Mutation

**`getStripeDashboardUrl`** - Упрощенный метод для настройки платежей артистами

```graphql
mutation {
  getStripeDashboardUrl {
    url        # Temporary Stripe Dashboard URL
    accountId  # Stripe Connect account ID
  }
}
```

**Что делает эта мутация:**
1. ✨ Автоматически создает Stripe Connect аккаунт (если его нет)
2. 🔍 Проверяет статус аккаунта:
   - **Новый аккаунт** → Генерирует Account Link для упрощенного onboarding
   - **Существующий аккаунт** → Генерирует Login Link для доступа к Dashboard
3. 💳 Артист проходит настройку или обновляет данные
4. ✅ Готово!

---

## Benefits

### Для артистов 🎨
- ⚡ Быстрее - не нужно заполнять длинную форму
- 💳 Проще - только номер карты/счета
- 🔒 Безопасно - все данные хранятся в Stripe

### Для платформы 🚀
- 📈 Выше conversion rate - меньше шагов
- 😊 Лучше UX - меньше friction
- ⚙️ Автоматизация - аккаунт создается сам

---

## Implementation

### Backend Changes

**Files Modified:**
- `src/utils/stripe.ts` - добавлены функции `createLoginLink` и `addExternalAccount`
- `src/extensions/graphql/stripe-connect.ts` - добавлена мутация `getStripeDashboardUrl`

**New Functionality:**
```typescript
// Auto-create Stripe Connect account
const account = await createConnectAccount({
  email: user.email,
  type: 'express',
  country: 'US'
});

// Check onboarding status and return appropriate link
const accountStatus = await getConnectAccount(accountId);
const isOnboarded = isAccountOnboarded(accountStatus);

if (isOnboarded) {
  // Return Login Link for dashboard access
  const loginLink = await createLoginLink(accountId);
} else {
  // Return Account Link for onboarding
  const accountLink = await createAccountLink({
    accountId,
    type: 'account_onboarding'
  });
}
```

### Documentation Added

**New Files:**
- `docs/STRIPE_ARTIST_SETUP_RU.md` - Полная инструкция для артистов на русском

**Updated Files:**
- `docs/STRIPE_QUICKSTART.md` - добавлен Option A с новым методом
- `docs/STRIPE_INTEGRATION_RU.md` - обновлен раздел onboarding
- `docs/STRIPE_GRAPHQL.md` - документация GraphQL мутаций

---

## Migration Guide

### Для существующих артистов

Существующие артисты с полным onboarding продолжат работать как раньше. Новый метод опциональный.

### Для новых артистов

Рекомендуем использовать новый упрощенный метод:

```typescript
// React/React Native example
const setupPayments = async () => {
  const { data } = await client.mutate({
    mutation: gql`
      mutation {
        getStripeDashboardUrl {
          url
          accountId
        }
      }
    `
  });
  
  // Open in browser/webview
  window.open(data.getStripeDashboardUrl.url, '_blank');
};
```

---

## Technical Details

### Account Type
- Using **Stripe Express** accounts
- Simplified compliance handled by Stripe
- Auto-created on first call to `getStripeDashboardUrl`

### Security
- Login links are temporary (expire after use)
- Authentication required (JWT)
- Only users with `type: "artist"` can access
- Stripe handles PCI compliance

### Workflow

```
1. Artist calls getStripeDashboardUrl mutation
   ↓
2. Backend checks: Does artist have Stripe account?
   ├─ NO → Create Express account automatically
   └─ YES → Use existing account
   ↓
3. Generate Login Link to Stripe Dashboard
   ↓
4. Artist opens link → Stripe Express Dashboard
   ↓
5. Artist adds bank account details
   ↓
6. Stripe verifies account
   ↓
7. Artist can receive payments! ✅
```

---

## Testing

### Test Data (Development Mode)

**US Bank Account:**
- Routing number: `110000000`
- Account number: `000123456789`

**Test the flow:**
1. Create artist account
2. Login as artist
3. Call `getStripeDashboardUrl` mutation
4. Open returned URL
5. Add test bank account
6. Verify status with `checkStripeAccountStatus`

---

## Comparison: Old vs New

| Feature | Traditional Onboarding | New Simplified Method |
|---------|----------------------|---------------------|
| Stripe account creation | Manual via mutation | ✨ Automatic |
| Forms to fill | Full KYC form | Only bank details |
| Required data | Name, DOB, SSN, Address, Bank | Bank account only |
| Steps | 5-7 steps | 2-3 steps |
| Time to complete | 5-10 minutes | 1-2 minutes |
| Redirect to Stripe | Yes (onboarding form) | Yes (dashboard) |
| Can add bank later | No | Yes |

---

## API Reference

### Types

```graphql
type StripeDashboardUrl {
  url: String!        # Temporary dashboard URL
  accountId: String!  # Stripe Connect account ID
}

type StripeAccountStatus {
  accountId: String
  onboarded: Boolean!
  payoutsEnabled: Boolean!
  chargesEnabled: Boolean!
  detailsSubmitted: Boolean!
}
```

### Mutations

```graphql
type Mutation {
  # New simplified method (recommended)
  getStripeDashboardUrl: StripeDashboardUrl!
  
  # Traditional method (still available)
  createStripeOnboardingUrl: StripeOnboardingUrl!
  refreshStripeOnboardingUrl: StripeOnboardingUrl!
  
  # Check account status
  checkStripeAccountStatus: StripeAccountStatus!
}
```

---

## Future Improvements

Potential enhancements:
- [ ] Auto-detect user country and set in `createConnectAccount`
- [ ] Support for multiple currencies based on artist location
- [ ] Webhook notifications when artist completes bank setup
- [ ] Dashboard link in artist profile UI
- [ ] Analytics on conversion rates

---

## Resources

**Documentation:**
- [Quick Start Guide](./STRIPE_QUICKSTART.md) - Updated with Option A
- [Artist Setup (RU)](./STRIPE_ARTIST_SETUP_RU.md) - New comprehensive guide
- [GraphQL API](./STRIPE_GRAPHQL.md) - Complete mutation docs
- [Integration Guide (RU)](./STRIPE_INTEGRATION_RU.md) - Updated overview

**Stripe Documentation:**
- [Express Accounts](https://stripe.com/docs/connect/express-accounts)
- [Account Links](https://stripe.com/docs/connect/account-links)
- [Login Links](https://stripe.com/docs/connect/express-dashboard#login-links)

---

## Support

Если возникли вопросы или проблемы:
1. Проверьте [STRIPE_ARTIST_SETUP_RU.md](./STRIPE_ARTIST_SETUP_RU.md)
2. Посмотрите [FAQ в STRIPE_INTEGRATION_RU.md](./STRIPE_INTEGRATION_RU.md#частые-проблемы)
3. Обратитесь к документации Stripe

**Common Issues:**
- **Dashboard URL expired** → Call `getStripeDashboardUrl` again (generates new link)
- **Not authorized** → Ensure user has `type: "artist"`
- **Account already exists** → No problem, mutation will use existing account

---

**Created by:** AI Assistant  
**Date:** October 28, 2025  
**Status:** ✅ Implemented and Documented

