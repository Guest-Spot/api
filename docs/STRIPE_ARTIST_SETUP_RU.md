# Настройка получения платежей для артистов

## Упрощенный процесс подключения Stripe 💳

### Что изменилось?

**Раньше:**
- Нужно было вручную инициировать создание Stripe аккаунта
- Использовался Standard тип (более сложный, ~10 мин)
- Данные нужно было вводить вручную, без предзаполнения

**Теперь:**
- ✨ Аккаунт Stripe создается автоматически
- 🎯 Используется Express тип (упрощенный onboarding, ~3-5 мин)
- 📝 Имя и телефон предзаполняются из профиля
- ⚡ Быстрее и удобнее!

**Важно:** Stripe все равно требует минимальные KYC данные (имя, дата рождения, адрес, последние 4 цифры SSN) согласно финансовым требованиям США. Это законодательное требование, которое нельзя обойти.

---

## Как артисту подключить выплаты?

### Вариант 1: Через приложение (рекомендуется)

1. В настройках профиля артиста нажмите **"Настроить выплаты"** или **"Добавить банковские реквизиты"**

2. Приложение автоматически:
   - Создаст Stripe Connect аккаунт
   - Откроет защищенную страницу Stripe

3. **Первый раз (новый аккаунт):**
   - Откроется упрощенная форма Stripe Express onboarding
   - Имя и телефон будут предзаполнены из вашего профиля ✨
   - Заполните оставшиеся данные:
     - Дата рождения
     - Адрес
     - Последние 4 цифры SSN (для США)
     - Банковский счет
   - Express тип проще Standard - меньше полей, быстрее (~3-5 мин)

4. **Последующие разы (аккаунт уже настроен):**
   - Откроется Stripe Express Dashboard
   - Можете обновить банковские реквизиты
   - Посмотреть историю выплат

5. Готово! Теперь вы можете получать платежи

### Вариант 2: Через GraphQL API (для разработчиков)

```graphql
mutation {
  getStripeDashboardUrl {
    url
    accountId
  }
}
```

Откройте полученный `url` в браузере и добавьте банковские реквизиты.

---

## Важная информация

### Безопасность
- Ссылка на Stripe Dashboard временная и действует только один раз
- Все данные карты хранятся в Stripe, не в нашей системе
- Stripe сертифицирован по стандарту PCI DSS

### Проверка статуса

Чтобы проверить, активны ли выплаты:

```graphql
mutation {
  checkStripeAccountStatus {
    onboarded
    payoutsEnabled
    chargesEnabled
  }
}
```

- `onboarded` - завершена ли настройка
- `payoutsEnabled` - включены ли выплаты
- `chargesEnabled` - можно ли принимать платежи

### Тестовые данные (для разработки)

Для тестирования в режиме разработки используйте:

**Тестовый банковский счет (США):**
- Routing number: `110000000`
- Account number: `000123456789`

**Тестовые карты Stripe:**
- Успешная: `4242 4242 4242 4242`
- Требует аутентификации: `4000 0025 0000 3155`
- Отклонена: `4000 0000 0000 9995`

---

## Часто задаваемые вопросы

### Почему нужно заполнять так много данных?

Stripe требует минимальные данные для соблюдения финансовых требований США (KYC - Know Your Customer):
- **Имя и фамилия** - идентификация владельца
- **Дата рождения** - проверка возраста (18+)
- **Адрес** - требование FinCEN
- **SSN (последние 4 цифры)** - налоговая идентификация (IRS)
- **Телефон** - верификация безопасности
- **Банковские реквизиты** - куда переводить деньги

Это **законодательное требование**, не Stripe. Express тип уже минимизирует количество полей.

📖 **Подробное объяснение:** [STRIPE_EXPRESS_ONBOARDING_EXPLAINED.md](./STRIPE_EXPRESS_ONBOARDING_EXPLAINED.md)

### Когда я получу деньги?

После того как клиент завершит бронирование:
1. Деньги сначала блокируются на карте клиента
2. После вашего подтверждения бронирования они списываются
3. Stripe переводит деньги на ваш счет согласно расписанию выплат (обычно 2-7 дней)

### Какую комиссию берет Stripe?

- Комиссия Stripe: ~2.9% + $0.30 за транзакцию
- Комиссия платформы: устанавливается в настройках

### Нужно ли проходить верификацию?

На начальном этапе достаточно добавить банковские реквизиты. Однако Stripe может запросить дополнительную информацию для верификации, если:
- Сумма транзакций превысит определенный лимит
- Потребуется для соблюдения финансовых требований

### Что делать, если ссылка на Dashboard истекла?

Просто запросите новую ссылку через приложение или API. Новая ссылка генерируется мгновенно.

### Поддержка

Если возникли проблемы:
1. Проверьте статус аккаунта через `checkStripeAccountStatus`
2. Запросите новую ссылку на Dashboard
3. Свяжитесь с поддержкой Stripe: https://support.stripe.com

---

## Для разработчиков

### Интеграция в React Native

```typescript
import { gql, useMutation } from '@apollo/client';
import { Linking } from 'react-native';

const GET_DASHBOARD_URL = gql`
  mutation {
    getStripeDashboardUrl {
      url
      accountId
    }
  }
`;

function StripeSetupButton() {
  const [getDashboardUrl, { loading }] = useMutation(GET_DASHBOARD_URL);

  const handleSetup = async () => {
    try {
      const { data } = await getDashboardUrl();
      // Open in browser
      await Linking.openURL(data.getStripeDashboardUrl.url);
    } catch (error) {
      console.error('Failed to get dashboard URL:', error);
    }
  };

  return (
    <Button 
      title="Настроить выплаты" 
      onPress={handleSetup}
      disabled={loading}
    />
  );
}
```

### Интеграция в React (Web)

```typescript
import { gql, useMutation } from '@apollo/client';

const GET_DASHBOARD_URL = gql`
  mutation {
    getStripeDashboardUrl {
      url
      accountId
    }
  }
`;

function StripeSetupButton() {
  const [getDashboardUrl, { loading }] = useMutation(GET_DASHBOARD_URL);

  const handleSetup = async () => {
    try {
      const { data } = await getDashboardUrl();
      // Open in new tab
      window.open(data.getStripeDashboardUrl.url, '_blank');
    } catch (error) {
      console.error('Failed to get dashboard URL:', error);
    }
  };

  return (
    <button onClick={handleSetup} disabled={loading}>
      Настроить выплаты
    </button>
  );
}
```

### Проверка статуса перед бронированием

```typescript
const CHECK_STATUS = gql`
  mutation {
    checkStripeAccountStatus {
      onboarded
      payoutsEnabled
    }
  }
`;

function BookingButton({ artistId }) {
  const [checkStatus] = useMutation(CHECK_STATUS);

  const handleBooking = async () => {
    // Check if artist can receive payments
    const { data } = await checkStatus();
    
    if (!data.checkStripeAccountStatus.payoutsEnabled) {
      alert('Артист еще не настроил получение платежей');
      return;
    }

    // Proceed with booking...
  };

  return <button onClick={handleBooking}>Забронировать</button>;
}
```

---

## Технические детали

### GraphQL Schema

```graphql
type StripeDashboardUrl {
  url: String!        # Temporary dashboard URL
  accountId: String!  # Stripe Connect account ID
}

type Mutation {
  # Get dashboard URL (auto-creates account if needed)
  getStripeDashboardUrl: StripeDashboardUrl!
  
  # Check account status
  checkStripeAccountStatus: StripeAccountStatus!
}
```

### Workflow

1. Artist calls `getStripeDashboardUrl` mutation
2. Backend checks if user has Stripe account:
   - If **NO**: Creates Express account automatically
   - If **YES**: Uses existing account
3. Backend checks if account completed onboarding:
   - **New account** → Generates Account Link (simplified onboarding form)
   - **Existing account** → Generates Login Link (direct dashboard access)
4. Artist opens the link:
   - **First time**: Fills simplified onboarding form + adds bank details
   - **Returning**: Accesses dashboard to update details or view payouts
5. Stripe handles verification and compliance
6. Artist can now receive payments!

### Account Type

We use **Stripe Express** accounts because:
- ✅ Simplified onboarding
- ✅ Stripe handles compliance
- ✅ Better UX for connected accounts
- ✅ Automatic dashboard access

Alternative: **Standard** accounts give more control to artists but require full onboarding.

