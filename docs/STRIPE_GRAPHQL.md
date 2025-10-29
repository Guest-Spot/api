# Stripe Payment GraphQL API

## Overview

This document describes the GraphQL API for Stripe payment operations in the GuestSpot booking system.

## GraphQL Mutations

### createBookingPayment

Creates a Stripe Checkout Session for a booking. This mutation should be called immediately after a booking is created to initiate the payment flow.

**Signature:**
```graphql
mutation createBookingPayment($bookingId: ID!): PaymentSession!
```

**Authentication:** Required (JWT token)

**Authorization:** Only the booking owner (guest) can create a payment session

**Arguments:**
- `bookingId` (ID!) - The ID or documentId of the booking to create payment for

**Returns:** `PaymentSession` object containing:
- `sessionId` (String!) - Stripe Checkout Session ID
- `sessionUrl` (String!) - URL to redirect user to Stripe Checkout
- `booking` (Booking) - Updated booking object with payment details

## Types

### PaymentSession

```graphql
type PaymentSession {
  sessionId: String!
  sessionUrl: String!
  booking: Booking
}
```

### Booking (Extended)

The existing `Booking` type is automatically extended with the following payment fields from the schema:

```graphql
type Booking {
  # ... existing fields ...
  
  # Payment fields
  currency: String
  paymentStatus: ENUM_BOOKING_PAYMENTSTATUS
  stripePaymentIntentId: String
  stripeCheckoutSessionId: String
  authorizedAt: DateTime
  
  artist: UsersPermissionsUser
}
```

> Deposit amount is available on `booking.artist.depositAmount`.

**Payment Status Enum:**
```graphql
enum ENUM_BOOKING_PAYMENTSTATUS {
  unpaid
  authorized
  paid
  cancelled
  failed
}
```

## Usage Examples

### Create Payment Session

**Query:**
```graphql
mutation CreateBookingPayment {
  createBookingPayment(bookingId: "abc123") {
    sessionId
    sessionUrl
    booking {
      id
      documentId
      currency
      paymentStatus
      stripeCheckoutSessionId
      artist {
        username
        email
        depositAmount
      }
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "createBookingPayment": {
      "sessionId": "cs_test_a1b2c3d4e5f6...",
      "sessionUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
      "booking": {
        "id": 123,
        "documentId": "abc123",
        "currency": "usd",
        "paymentStatus": "unpaid",
        "stripeCheckoutSessionId": "cs_test_a1b2c3d4e5f6...",
        "artist": {
          "username": "johndoe",
          "email": "john@example.com",
          "depositAmount": 10000
        }
      }
    }
  }
}
```

### Query Booking with Payment Info

**Query:**
```graphql
query GetBooking {
  booking(documentId: "abc123") {
    id
    documentId
    name
    email
    description
    day
    start
    reaction
    
    # Payment information
    currency
    paymentStatus
    authorizedAt
    
    artist {
      username
      email
      stripeAccountID
      payoutsEnabled
      depositAmount
    }
    
    owner {
      username
      email
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "booking": {
      "id": 123,
      "documentId": "abc123",
      "name": "John Smith",
      "email": "john@example.com",
      "description": "Dragon tattoo on arm",
      "day": "2024-12-01",
      "start": "14:00",
      "reaction": "pending",
      "currency": "usd",
      "paymentStatus": "authorized",
      "authorizedAt": "2024-10-28T10:30:00.000Z",
      "artist": {
        "username": "tattooartist",
        "email": "artist@example.com",
        "stripeAccountID": "acct_1234567890",
        "payoutsEnabled": true,
        "depositAmount": 10000
      },
      "owner": {
        "username": "johnsmith",
        "email": "john@example.com"
      }
    }
  }
}
```

### Update Booking Reaction (Accept/Reject)

When you update the booking reaction, the payment is automatically captured or cancelled:

**Query:**
```graphql
mutation UpdateBooking {
  updateBooking(
    documentId: "abc123"
    data: {
      reaction: accepted
    }
  ) {
    id
    documentId
    reaction
    paymentStatus
    artist {
      username
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "updateBooking": {
      "id": 123,
      "documentId": "abc123",
      "reaction": "accepted",
      "paymentStatus": "paid",
      "artist": {
        "username": "tattooartist"
      }
    }
  }
}
```

## Client Implementation Example

### React/Apollo Client

```typescript
import { gql, useMutation } from '@apollo/client';

const CREATE_BOOKING_PAYMENT = gql`
  mutation CreateBookingPayment($bookingId: ID!) {
    createBookingPayment(bookingId: $bookingId) {
      sessionId
      sessionUrl
      booking {
        id
        documentId
        paymentStatus
        currency
      }
    }
  }
`;

function BookingPayment({ bookingId }) {
  const [createPayment, { loading, error, data }] = useMutation(
    CREATE_BOOKING_PAYMENT
  );

  const handlePayment = async () => {
    try {
      const result = await createPayment({
        variables: { bookingId },
      });

      // Redirect to Stripe Checkout
      window.location.href = result.data.createBookingPayment.sessionUrl;
    } catch (err) {
      console.error('Payment error:', err);
    }
  };

  return (
    <button onClick={handlePayment} disabled={loading}>
      {loading ? 'Processing...' : 'Pay Now'}
    </button>
  );
}
```

### React Native/Apollo Client

```typescript
import { gql, useMutation } from '@apollo/client';
import { Linking } from 'react-native';

const CREATE_BOOKING_PAYMENT = gql`
  mutation CreateBookingPayment($bookingId: ID!) {
    createBookingPayment(bookingId: $bookingId) {
      sessionUrl
    }
  }
`;

function BookingPaymentButton({ bookingId }) {
  const [createPayment, { loading }] = useMutation(CREATE_BOOKING_PAYMENT);

  const handlePayment = async () => {
    try {
      const result = await createPayment({
        variables: { bookingId },
      });

      // Open Stripe Checkout in browser or WebView
      const url = result.data.createBookingPayment.sessionUrl;
      await Linking.openURL(url);
    } catch (err) {
      console.error('Payment error:', err);
    }
  };

  return (
    <TouchableOpacity onPress={handlePayment} disabled={loading}>
      <Text>{loading ? 'Processing...' : 'Pay Now'}</Text>
    </TouchableOpacity>
  );
}
```

## Error Handling

The mutation will throw GraphQL errors in the following cases:

**Authentication Error:**
```json
{
  "errors": [
    {
      "message": "You must be logged in to create a payment",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

**Authorization Error:**
```json
{
  "errors": [
    {
      "message": "You can only create payment for your own bookings",
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ]
}
```

**Booking Not Found:**
```json
{
  "errors": [
    {
      "message": "Booking not found"
    }
  ]
}
```

**Payment Already Exists:**
```json
{
  "errors": [
    {
      "message": "Payment already authorized"
    }
  ]
}
```

**Artist Not Configured:**
```json
{
  "errors": [
    {
      "message": "Artist does not have a Stripe account configured"
    }
  ]
}
```

## Testing with GraphQL Playground

Access GraphQL Playground at: `http://localhost:1337/graphql`

### Set Authentication Header

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

### Test Mutation

```graphql
mutation {
  createBookingPayment(bookingId: "YOUR_BOOKING_ID") {
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

## Complete Workflow

1. **Create Booking** (REST or GraphQL):
```graphql
mutation {
  createBooking(data: {
    artist: "artist_document_id"
    name: "John Smith"
    email: "john@example.com"
    description: "Dragon tattoo"
    day: "2024-12-01"
    start: "14:00"
  }) {
    id
    documentId
  }
}
```

2. **Create Payment Session**:
```graphql
mutation {
  createBookingPayment(bookingId: "booking_document_id") {
    sessionUrl
  }
}
```

3. **Redirect to Stripe Checkout** (client-side)

4. **User Completes Payment** (Stripe handles this)

5. **Webhook Updates Status** (automatic)

6. **Artist Accepts/Rejects**:
```graphql
mutation {
  updateBooking(
    documentId: "booking_document_id"
    data: { reaction: accepted }
  ) {
    paymentStatus
  }
}
```

7. **Check Final Status**:
```graphql
query {
  booking(documentId: "booking_document_id") {
    reaction
    paymentStatus
  }
}
```

## Stripe Connect Mutations (Artist Onboarding)

### getStripeDashboardUrl (Recommended ⭐)

**NEW:** Simplified artist onboarding - automatically creates Stripe Connect account and provides access to Stripe Dashboard for adding bank details.

**Signature:**
```graphql
mutation getStripeDashboardUrl: StripeDashboardUrl!
```

**Authentication:** Required (JWT token)  
**Authorization:** Only users with `type: "artist"`

**Returns:** `StripeDashboardUrl` object containing:
- `url` (String!) - Temporary URL to Stripe Express Dashboard
- `accountId` (String!) - Stripe Connect account ID

**How it works:**
1. Call this mutation
2. Backend auto-creates Stripe Connect account if it doesn't exist
3. Backend checks account status and returns appropriate link:
   - **New account** → Account Link for simplified onboarding
   - **Completed onboarding** → Login Link for dashboard access
4. Artist completes setup or updates details
5. Done! Artist can now receive payments

**Example:**
```graphql
mutation {
  getStripeDashboardUrl {
    url
    accountId
  }
}
```

**Response:**
```json
{
  "data": {
    "getStripeDashboardUrl": {
      "url": "https://connect.stripe.com/express/acct_abc123/...",
      "accountId": "acct_abc123"
    }
  }
}
```

**Frontend Integration:**
```typescript
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

// Open in browser
window.open(data.getStripeDashboardUrl.url, '_blank');
// or on mobile: Linking.openURL(data.getStripeDashboardUrl.url);
```

---

### createStripeOnboardingUrl (Traditional)

Creates a Stripe Connect onboarding URL for full account setup. Use this if you need complete account verification.

**Signature:**
```graphql
mutation createStripeOnboardingUrl: StripeOnboardingUrl!
```

**Authentication:** Required (JWT token)  
**Authorization:** Only users with `type: "artist"`

**Returns:** `StripeOnboardingUrl` object containing:
- `url` (String!) - URL to Stripe onboarding form
- `accountId` (String!) - Stripe Connect account ID
- `expiresAt` (Int!) - Unix timestamp when URL expires

**Example:**
```graphql
mutation {
  createStripeOnboardingUrl {
    url
    accountId
    expiresAt
  }
}
```

---

### refreshStripeOnboardingUrl

Refreshes an expired onboarding URL.

**Signature:**
```graphql
mutation refreshStripeOnboardingUrl: StripeOnboardingUrl!
```

**Authentication:** Required (JWT token)  
**Authorization:** Only artists with existing Stripe account

**Example:**
```graphql
mutation {
  refreshStripeOnboardingUrl {
    url
    expiresAt
  }
}
```

---

### checkStripeAccountStatus

Checks the current status of artist's Stripe Connect account and updates `payoutsEnabled` field.

**Signature:**
```graphql
mutation checkStripeAccountStatus: StripeAccountStatus!
```

**Authentication:** Required (JWT token)

**Returns:** `StripeAccountStatus` object containing:
- `accountId` (String) - Stripe account ID (null if no account)
- `onboarded` (Boolean!) - Whether account is fully set up
- `payoutsEnabled` (Boolean!) - Whether payouts are enabled
- `chargesEnabled` (Boolean!) - Whether charges are enabled
- `detailsSubmitted` (Boolean!) - Whether account details are submitted

**Example:**
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
```

**Response:**
```json
{
  "data": {
    "checkStripeAccountStatus": {
      "accountId": "acct_abc123",
      "onboarded": true,
      "payoutsEnabled": true,
      "chargesEnabled": true,
      "detailsSubmitted": true
    }
  }
}
```

---

## Security Notes

- All mutations require authentication via JWT token
- Users can only create payment sessions for their own bookings
- Ownership is verified server-side
- Payment amounts are validated on the server
- Stripe signature verification on webhooks
- Artist onboarding mutations restricted to users with `type: "artist"`
- Dashboard URLs are temporary and expire after use

## Related Documentation

- [Stripe Integration Documentation](./STRIPE_INTEGRATION.md)
- [Stripe Quick Start Guide](./STRIPE_QUICKSTART.md)
- [Stripe Integration (Russian)](./STRIPE_INTEGRATION_RU.md)
- [Artist Setup Guide (Russian)](./STRIPE_ARTIST_SETUP_RU.md) - Simplified onboarding instructions ⭐ NEW

---

**Last Updated:** October 28, 2025
