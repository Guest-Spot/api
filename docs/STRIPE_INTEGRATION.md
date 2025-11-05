# Stripe Payment Integration Documentation

## Overview

This document describes the Stripe payment integration for the GuestSpot booking system. The implementation uses **pre-authorization (manual capture)** to hold funds when a booking is created and only charge the customer when the artist accepts the booking.

## Architecture

### Payment Flow with Pre-Authorization

```
1. Guest creates booking
   ↓
2. Guest calls POST /api/bookings/:id/create-payment
   ↓
3. System creates Stripe Checkout Session (capture_method: manual)
   ↓
4. Guest is redirected to Stripe Checkout page
   ↓
5. Guest enters payment details and confirms
   ↓
6. Stripe authorizes payment (funds held, not charged)
   ↓
7. Webhook: checkout.session.completed → Save payment intent ID
   ↓
8. Webhook: payment_intent.amount_capturable_updated → Update status to "authorized"
   ↓
9. Artist receives notification and reviews booking
   ↓
10a. Artist ACCEPTS:                    10b. Artist REJECTS:
     - Capture payment intent                - Cancel payment intent
     - Funds transferred to artist           - Funds released immediately
     - Status: "paid"                        - Status: "cancelled"
   ↓                                    ↓
11. Both parties receive email notifications
```

### Auto-Cancellation (7 Days)

If the artist doesn't respond within 7 days:
- Cron job runs hourly to check for expired authorizations
- Payment intent is automatically cancelled
- Booking is rejected with note "Automatically rejected due to expired payment authorization"
- Guest receives notification that funds have been released

## API Endpoints

### 1. Create Payment Session

**Endpoint:** `POST /api/bookings/:id/create-payment`

**Authentication:** Required (JWT token)

**Authorization:** Only the booking owner (guest) can create payment

**Request:** No body required

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "sessionUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
  "booking": {
    "id": 123,
    "stripeCheckoutSessionId": "cs_test_...",
    "currency": "usd",
    "paymentStatus": "unpaid"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - User not logged in
- `403 Forbidden` - User is not the booking owner
- `404 Not Found` - Booking not found
- `400 Bad Request` - Payment already processed or artist not configured

### 2. Webhook Endpoint

**Endpoint:** `POST /api/webhooks/stripe`

**Authentication:** None (verified via Stripe signature)

**Handled Events:**
- `checkout.session.completed` - Save payment intent ID
- `payment_intent.amount_capturable_updated` - Mark as authorized
- `payment_intent.succeeded` - Mark as paid, send notifications
- `payment_intent.payment_failed` - Mark as failed, notify guest
- `payment_intent.canceled` - Mark as cancelled, notify guest
- `account.updated` - Update artist's payoutsEnabled status when Stripe Connect account is updated

## Database Schema

### Booking Model Fields

```typescript
{
  // Existing fields...

// Payment fields
 currency: string;                  // Currency code (default: "usd")
 paymentStatus: enum;               // "unpaid" | "authorized" | "paid" | "cancelled" | "failed"
 stripePaymentIntentId: string;     // Stripe Payment Intent ID
 stripeCheckoutSessionId: string;   // Stripe Checkout Session ID
 authorizedAt: datetime;            // Timestamp when payment was authorized
}

// Artist profile includes:
// depositAmount: number;            // Deposit configured in cents
```

## Environment Variables

Required environment variables:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Deposit Amount
# Each artist configures their deposit in the users table (depositAmount field in cents)

# Redirect URLs
STRIPE_SUCCESS_URL=https://yourapp.com/booking-success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://yourapp.com/booking-cancelled
```

## Stripe Connect Setup

### Artist Onboarding

Artists must complete Stripe Connect onboarding to receive payments:

1. Artist creates a Stripe Connect account
2. Store `stripeAccountID` in user profile
3. Set `payoutsEnabled: true` when onboarding is complete
4. Artist can now receive bookings with payment

### Platform Commission

Commission is automatically deducted via `application_fee_amount`:

```typescript
const platformFee = calculatePlatformFee(amount, platformFeePercent);
// Example: $100 booking with 10% fee = $10 platform, $90 to artist
```

## Security Features

### PCI DSS Compliance

✅ **No card data on server** - All payment details handled by Stripe Checkout
✅ **Webhook signature verification** - Prevents spoofed webhook calls
✅ **Pre-authorization** - Funds held but not charged until artist accepts
✅ **Automatic expiration** - Authorizations expire after 7 days
✅ **Secure transfers** - Stripe Connect handles fund distribution

### Webhook Signature Verification

All webhooks are verified using Stripe signature:

```typescript
const signature = request.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  webhookSecret
);
```

## Testing

### Test Cards

Use Stripe test cards for development:

**Successful payment:**
- Card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits

**Failed payment:**
- Card: `4000 0000 0000 0002`

### Test Webhooks Locally

Use Stripe CLI for local webhook testing:

```bash
stripe listen --forward-to localhost:1337/api/webhooks/stripe
```

## Email Notifications

### Payment Required Email
Sent to guest when artist accepts booking.

**Template:** `src/utils/email/payment-required.html`

**Variables:**
- `guestName` - Guest's name
- `artistName` - Artist's name
- `amount` - Formatted amount
- `paymentUrl` - Stripe Checkout URL
- `bookingId` - Booking ID

### Payment Success Email
Sent to both guest and artist when payment is captured.

**Template:** `src/utils/email/payment-success.html`

**Variables:**
- `userName` - Recipient's name
- `artistName` - Artist's name
- `amount` - Formatted amount
- `bookingId` - Booking ID
- `message` - Custom message (different for guest vs artist)

## Cron Jobs

### Cancel Expired Authorizations

**Schedule:** Every hour (at minute 0)

**Cron Expression:** `0 * * * *`

**Functionality:**
- Finds bookings with `paymentStatus: "authorized"` older than 7 days
- Cancels payment intents in Stripe
- Updates booking status to rejected
- Sends notification to guest

## Error Handling

### Payment Creation Errors

- Artist missing `stripeAccountID` → Error: "Artist does not have a Stripe account configured"
- Artist `payoutsEnabled: false` → Error: "Artist has not enabled payouts yet"
- Payment already processed → Error: "Payment already {status}"

### Webhook Errors

All webhook processing errors are logged but don't return error responses to Stripe (to prevent retries on non-recoverable errors).

## Monitoring & Logging

All payment operations are logged:

```typescript
strapi.log.info('Payment authorized for booking 123');
strapi.log.error('Error capturing payment intent:', error);
```

Monitor Stripe Dashboard for:
- Failed payments
- Disputes/chargebacks
- Transfer failures
- Authorization expiration

## Future Enhancements

Potential improvements:

1. **Dynamic pricing** - Allow artists to set their own rates
2. **Partial payments** - Support deposits and remaining balance
3. **Refunds** - Implement refund functionality for cancellations
4. **Payment methods** - Add support for other payment methods (Apple Pay, Google Pay)
5. **Invoicing** - Generate PDF invoices for completed bookings
6. **Analytics** - Payment success rates, average booking values

## Support & Troubleshooting

### Common Issues

**"Invalid webhook signature"**
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Ensure raw body is passed to verification

**"Payment not captured when artist accepts"**
- Check `stripePaymentIntentId` is saved
- Verify payment status is "authorized" before capture
- Check Stripe logs for API errors

**"Funds not transferred to artist"**
- Verify artist's `stripeAccountID` is valid
- Check artist completed Stripe Connect onboarding
- Review Stripe Connect dashboard for transfer status

### Stripe Dashboard

Monitor your integration:
- [Payments](https://dashboard.stripe.com/payments)
- [Connect Accounts](https://dashboard.stripe.com/connect/accounts/overview)
- [Webhooks](https://dashboard.stripe.com/webhooks)
- [Logs](https://dashboard.stripe.com/logs)

---

**Last Updated:** October 28, 2025
**Integration Version:** 1.0.0
