# Stripe Integration Quick Start Guide

## Prerequisites

1. ✅ Stripe account (create at [stripe.com](https://stripe.com))
2. ✅ Stripe package already installed (`stripe@^19.1.0`)
3. ✅ Node.js 18+ running

## Setup Steps

### 1. Get Stripe API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Secret Key** (starts with `sk_test_...`)
3. Add to `.env`:

```bash
STRIPE_SECRET_KEY=sk_test_your_key_here
```

### 2. Configure Webhook

#### Option A: Production/Staging

1. Go to [Webhooks Dashboard](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Set URL: `https://your-api-domain.com/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.amount_capturable_updated`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `account.updated` (for Stripe Connect onboarding)
5. Copy **Signing secret** (starts with `whsec_...`)
6. Add to `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

#### Option B: Local Development

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Other platforms
# Download from: https://github.com/stripe/stripe-cli/releases
```

2. Login to Stripe:

```bash
stripe login
```

3. Forward webhooks to your local server:

```bash
stripe listen --forward-to localhost:1337/api/webhooks/stripe
```

4. Copy the webhook signing secret from the output
5. Add to `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Configure Payment Settings

Add to your `.env`:

```bash
# Booking amount in cents (10000 = $100.00)
BOOKING_AMOUNT=10000

# Platform commission percentage
STRIPE_PLATFORM_FEE_PERCENT=10

# Currency
DEFAULT_CURRENCY=usd

# Redirect URLs (adjust for your app)
STRIPE_SUCCESS_URL=https://yourapp.com/booking-success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://yourapp.com/booking-cancelled

# Frontend URL (for Stripe Connect onboarding redirects)
FRONTEND_URL=https://yourapp.com

# Your API URL
PUBLIC_URL=https://api.yourapp.com
```

### 4. Setup Stripe Connect

For artists to receive payments:

1. Go to [Connect Settings](https://dashboard.stripe.com/settings/connect)
2. Enable **Express accounts** (recommended for easier onboarding)
3. Configure branding and settings
4. Artists will use GraphQL API to complete onboarding

**Note:** Artists no longer need manual Stripe account creation. The system automatically creates accounts via `createStripeOnboardingUrl` mutation.

### 5. Start the Server

```bash
npm run develop
# or
yarn develop
```

## Testing the Integration

### 1. Setup Test Artist with Stripe Connect

**Option A: Automated Onboarding (Recommended)**

Create an artist and complete Stripe onboarding via GraphQL:

1. Create a new user with `type: "artist"`

2. Use GraphQL Playground (`http://localhost:1337/graphql`) with artist's JWT token:

```graphql
mutation {
  createStripeOnboardingUrl {
    url
    accountId
    expiresAt
  }
}
```

3. Open the returned URL in browser

4. Fill Stripe form with test data:
   - **Routing number:** `110000000`
   - **Account number:** `000123456789`
   - **SSN:** `000-00-0000`
   - **Date of Birth:** `01/01/1990`

5. Complete onboarding and return to app

6. Verify status:

```graphql
mutation {
  checkStripeAccountStatus {
    onboarded
    payoutsEnabled
  }
}
```

**Option B: Manual Setup (For Quick Testing)**

If you need to skip onboarding for testing:

1. Go to [Connect Test Accounts](https://dashboard.stripe.com/test/connect/accounts/overview)
2. Click **Add account**
3. Copy the account ID (starts with `acct_...`)
4. Update the artist user in your database:

```json
{
  "stripeAccountID": "acct_your_test_account_id",
  "payoutsEnabled": true
}
```

### 2. Create a Test Booking

**POST** `/api/bookings`

```json
{
  "data": {
    "artist": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "description": "Want to get a dragon tattoo",
    "placement": "arm",
    "size": "medium",
    "day": "2024-12-01",
    "start": "14:00"
  }
}
```

Response will include booking ID (e.g., `123`)

### 3. Create Payment Session

**POST** `/api/bookings/123/create-payment`

**Headers:**
```
Authorization: Bearer <user_jwt_token>
```

Response:
```json
{
  "sessionId": "cs_test_...",
  "sessionUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
  "booking": {
    "id": 123,
    "paymentStatus": "unpaid",
    "amount": 10000,
    "currency": "usd"
  }
}
```

### 4. Complete Payment

1. Open the `sessionUrl` in a browser
2. Use test card: **4242 4242 4242 4242**
3. Expiry: Any future date
4. CVC: Any 3 digits
5. ZIP: Any valid ZIP code

### 5. Verify Payment Authorization

Check the booking:

**GET** `/api/bookings/123`

Should show:
```json
{
  "paymentStatus": "authorized",
  "stripePaymentIntentId": "pi_...",
  "authorizedAt": "2024-10-28T10:00:00.000Z"
}
```

### 6. Artist Accepts Booking

**PUT** `/api/bookings/123`

```json
{
  "data": {
    "reaction": "accepted"
  }
}
```

This will automatically:
- Capture the payment
- Transfer funds to artist (minus platform fee)
- Update `paymentStatus` to `"paid"`
- Send email notifications to both parties

### 7. Verify Payment Captured

Check in [Stripe Dashboard](https://dashboard.stripe.com/test/payments):
- Payment should show as **Succeeded**
- Transfer should be visible in [Transfers](https://dashboard.stripe.com/test/connect/transfers)

## Common Test Scenarios

### Test Artist Onboarding

1. Create artist user
2. Call `createStripeOnboardingUrl` mutation
3. Open URL and complete Stripe form
4. Verify `account.updated` webhook received
5. Check `checkStripeAccountStatus` shows `onboarded: true`

**Test URL expiration:**
```graphql
# After 30 minutes, try to use old URL - should fail
# Then call:
mutation {
  refreshStripeOnboardingUrl {
    url
  }
}
```

### Test Rejection

1. Create booking and authorize payment (steps 2-5)
2. Artist rejects:

```json
PUT /api/bookings/123
{
  "data": {
    "reaction": "rejected",
    "rejectNote": "Booked up for that time slot"
  }
}
```

3. Payment intent is cancelled
4. Funds released immediately
5. `paymentStatus` → `"cancelled"`

### Test Expiration (7 Days)

1. Create booking and authorize payment
2. Wait (or manually trigger cron job)
3. System automatically:
   - Cancels payment intent
   - Updates booking to rejected
   - Notifies guest

To manually trigger cron:
```typescript
// In Strapi console
await strapi.config.functions.cron['cancelExpiredAuthorizations']({ strapi });
```

## Monitoring

### View Logs

```bash
# Development
tail -f .tmp/data.db.log

# Check Strapi console for payment logs
# Look for: "Payment authorized for booking X"
```

### Stripe Dashboard

Monitor in real-time:
- [Payments](https://dashboard.stripe.com/test/payments)
- [Events](https://dashboard.stripe.com/test/events)
- [Logs](https://dashboard.stripe.com/test/logs)
- [Webhooks](https://dashboard.stripe.com/test/webhooks)

## Troubleshooting

### "Invalid webhook signature"

- Ensure `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- For local dev, use secret from `stripe listen` output
- Restart server after changing .env

### "Artist does not have a Stripe account configured"

- Artist needs to complete Stripe Connect onboarding
- Call `createStripeOnboardingUrl` mutation as artist
- Complete Stripe form and verify `payoutsEnabled: true`
- Check [Connect Accounts](https://dashboard.stripe.com/test/connect/accounts/overview) in Stripe Dashboard

### Payment not captured when artist accepts

- Check booking `paymentStatus` is `"authorized"` before accepting
- Verify `stripePaymentIntentId` is saved
- Check Strapi logs for errors
- Check Stripe Dashboard for payment intent status

### Webhook events not received

For local development:
```bash
# Verify Stripe CLI is running
stripe listen --forward-to localhost:1337/api/webhooks/stripe

# In another terminal, test webhook
stripe trigger checkout.session.completed
```

## Going to Production

### 1. Switch to Live Keys

Replace test keys with live keys in `.env`:

```bash
STRIPE_SECRET_KEY=sk_live_...  # NOT sk_test_
```

### 2. Configure Live Webhook

1. Go to [Production Webhooks](https://dashboard.stripe.com/webhooks)
2. Add production endpoint: `https://api.yourapp.com/api/webhooks/stripe`
3. Update `STRIPE_WEBHOOK_SECRET` with live secret

### 3. Update URLs

```bash
PUBLIC_URL=https://api.yourapp.com
FRONTEND_URL=https://yourapp.com
STRIPE_SUCCESS_URL=https://yourapp.com/booking-success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://yourapp.com/booking-cancelled
```

### 4. Test in Production

**Test Artist Onboarding:**
1. Artist creates account in app
2. Artist calls `createStripeOnboardingUrl`
3. Artist completes real Stripe onboarding
4. Verify `payoutsEnabled: true`

**Test Payment Flow:**
1. Create booking
2. Complete payment with real card
3. Accept/reject booking
4. Verify transfers in [Stripe Dashboard](https://dashboard.stripe.com/connect/transfers)

### 5. Monitor

Set up monitoring:
- Stripe email alerts
- Webhook failure notifications
- Application error tracking (e.g., Sentry)

## Additional Documentation

- **[Stripe Connect Onboarding Guide](./STRIPE_CONNECT_ONBOARDING.md)** - Complete guide for artist onboarding
- **[GraphQL API Documentation](./STRIPE_GRAPHQL.md)** - GraphQL mutations for payments and onboarding
- **[Full Integration Guide](./STRIPE_INTEGRATION.md)** - Detailed technical documentation
- **[Stripe Official Docs](https://stripe.com/docs)** - Stripe documentation
- **[Stripe Connect Docs](https://stripe.com/docs/connect)** - Stripe Connect documentation

## Need Help?

- [Stripe Support](https://support.stripe.com)
- [Stripe Community](https://github.com/stripe)
- Check [Stripe Dashboard Logs](https://dashboard.stripe.com/logs) for errors

---

✅ Integration complete! You're ready to accept payments and onboard artists.

