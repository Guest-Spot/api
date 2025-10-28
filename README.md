# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

## 🔐 Environment Variables

### Stripe Payment Integration

The following environment variables are required for Stripe payment integration:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...                    # Your Stripe secret key (test or live)
STRIPE_WEBHOOK_SECRET=whsec_...                  # Webhook signing secret from Stripe Dashboard

# Payment Configuration
BOOKING_AMOUNT=10000                              # Default booking amount in cents (10000 = $100.00)
STRIPE_PLATFORM_FEE_PERCENT=10                   # Platform commission percentage (10 = 10%)
DEFAULT_CURRENCY=usd                              # Default payment currency (usd, eur, etc.)

# Payment URLs (for mobile app deep links or web redirects)
STRIPE_SUCCESS_URL=https://yourapp.com/booking-success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://yourapp.com/booking-cancelled

# Frontend URL (for Stripe Connect onboarding redirects)
FRONTEND_URL=https://yourapp.com                 # Base URL of your frontend application

# Required for Stripe Connect
# Artists need to create their Stripe Connect accounts via GraphQL API
# See docs/STRIPE_CONNECT_ONBOARDING.md for details
```

### Stripe Connect Setup

1. **Create a Stripe Connect Platform Account**: [Stripe Connect Dashboard](https://dashboard.stripe.com/connect/accounts/overview)
2. **Configure Webhook Endpoint**: Add `https://your-api-domain.com/api/webhooks/stripe` in Stripe Dashboard
3. **Enable Required Webhook Events**:
   - `checkout.session.completed`
   - `payment_intent.amount_capturable_updated`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `account.updated` (for Stripe Connect onboarding status)

### Artist Onboarding

Artists must complete Stripe Connect onboarding before receiving payments:

1. **Artist calls GraphQL mutation** `createStripeOnboardingUrl`
2. **System creates Stripe Connect account** (if new)
3. **Artist redirected to Stripe** to complete onboarding
4. **Artist provides bank details** and identity verification
5. **Stripe webhook notifies system** when onboarding complete
6. **System updates** `payoutsEnabled: true` → artist can receive payments

See [Stripe Connect Onboarding Guide](./docs/STRIPE_CONNECT_ONBOARDING.md) for details.

### Payment Flow

1. **Guest creates booking** → Calls `POST /api/bookings/:id/create-payment` or GraphQL `createBookingPayment`
2. **System creates Stripe Checkout Session** with manual capture (pre-authorization)
3. **Guest completes payment** → Funds are held (not captured)
4. **Artist accepts booking** → Payment is captured, funds transferred to artist's account
5. **Artist rejects booking** → Payment is cancelled, funds released
6. **7 days timeout** → Automatic cancellation via cron job

### Security & PCI DSS Compliance

- ✅ No card data stored on server
- ✅ Stripe Checkout handles all sensitive data
- ✅ Webhook signature verification prevents fraud
- ✅ Pre-authorization prevents unauthorized charges
- ✅ Automatic fund distribution via Stripe Connect

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## ⚙️ Deployment

Strapi gives you many possible deployment options for your project including [Strapi Cloud](https://cloud.strapi.io). Browse the [deployment section of the documentation](https://docs.strapi.io/dev-docs/deployment) to find the best solution for your use case.

```
yarn strapi deploy
```

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
