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
  amount: Float
  currency: String
  paymentStatus: ENUM_BOOKING_PAYMENTSTATUS
  stripePaymentIntentId: String
  stripeCheckoutSessionId: String
  platformFee: Float
  authorizedAt: DateTime
}
```

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
      amount
      currency
      paymentStatus
      stripeCheckoutSessionId
      artist {
        username
        email
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
        "amount": 10000,
        "currency": "usd",
        "paymentStatus": "unpaid",
        "stripeCheckoutSessionId": "cs_test_a1b2c3d4e5f6...",
        "artist": {
          "username": "johndoe",
          "email": "john@example.com"
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
    amount
    currency
    paymentStatus
    authorizedAt
    platformFee
    
    artist {
      username
      email
      stripeAccountID
      payoutsEnabled
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
      "amount": 10000,
      "currency": "usd",
      "paymentStatus": "authorized",
      "authorizedAt": "2024-10-28T10:30:00.000Z",
      "platformFee": 1000,
      "artist": {
        "username": "tattooartist",
        "email": "artist@example.com",
        "stripeAccountID": "acct_1234567890",
        "payoutsEnabled": true
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
        amount
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

## Security Notes

- All mutations require authentication via JWT token
- Users can only create payment sessions for their own bookings
- Ownership is verified server-side
- Payment amounts are validated on the server
- Stripe signature verification on webhooks

## Related Documentation

- [Stripe Integration Documentation](./STRIPE_INTEGRATION.md)
- [Stripe Quick Start Guide](./STRIPE_QUICKSTART.md)
- [Stripe Integration (Russian)](./STRIPE_INTEGRATION_RU.md)

---

**Last Updated:** October 28, 2025

