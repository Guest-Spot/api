# Booking GraphQL API

This document describes how to use GraphQL mutations to manage bookings with automatic payment handling.

## Overview

The booking system now supports GraphQL mutations with automatic payment processing when the artist accepts or rejects a booking. The custom GraphQL resolver implements the same logic as the REST API controller.

## Features

- **Custom Update Resolver**: Intercepts `updateBooking` mutation to handle payment capture/cancellation
- **Automatic Payment Processing**: When artist changes reaction to "accepted" or "rejected", the payment is automatically captured or cancelled
- **Security Policies**: Access control policies ensure users can only access their own bookings

## GraphQL Mutations

### Update Booking (Accept/Reject)

When an artist accepts or rejects a booking, the mutation automatically handles the payment:

**Mutation:**
```graphql
mutation UpdateBooking($documentId: ID!, $data: BookingInput!) {
  updateBooking(documentId: $documentId, data: $data) {
    documentId
    reaction
    paymentStatus
    currency
  }
}
```

**Variables (Accept):**
```json
{
  "documentId": "booking_document_id_here",
  "data": {
    "reaction": "accepted"
  }
}
```

**Variables (Reject):**
```json
{
  "documentId": "booking_document_id_here",
  "data": {
    "reaction": "rejected",
    "rejectNote": "Optional rejection reason"
  }
}
```

## Payment Flow

### 1. When Artist Accepts (`reaction: "accepted"`)

- ✅ Payment is **captured** from the pre-authorized amount
- ✅ Payment status changes to `paid`
- ✅ Artist receives the payment (minus platform fee)
- ✅ Success log entry created

### 2. When Artist Rejects (`reaction: "rejected"`)

- ❌ Payment is **cancelled**
- ❌ Payment status changes to `cancelled`
- ❌ Customer is not charged
- ❌ Cancellation log entry created

## Security & Access Control

### Policies Applied

1. **Query.bookings**: Only returns bookings where the user is owner or artist
2. **Query.booking**: Only allows access if user is owner or artist
3. **Mutation.updateBooking**: Only allows update if user is owner or artist
4. **Mutation.deleteBooking**: Only allows deletion if user is owner or artist

### Custom Policies

- `is-booking-participant`: Checks if user is either owner or artist of the booking
- `filter-booking-data`: Filters bookings list to show only relevant bookings

## Error Handling

The resolver handles errors gracefully:

- **Booking not found**: Returns error message
- **Payment processing failure**: Logs error and throws exception
- **Unauthorized access**: Blocked by policies before reaching resolver

## Implementation Details

### Files Created/Modified

1. **`src/extensions/graphql/booking.ts`**: Custom GraphQL resolver for booking updates
2. **`src/policies/is-booking-participant.ts`**: Policy to check if user is owner or artist
3. **`src/policies/filter-booking-data.ts`**: Policy to filter bookings by participation
4. **`src/extensions/graphql/guards.ts`**: Updated with booking policies
5. **`src/index.ts`**: Registered booking extension

### Payment Status Transitions

```
unpaid → authorized → paid (when accepted)
                   → cancelled (when rejected)
```

## Example Usage

### Complete Flow with GraphQL

```graphql
# 1. Create booking payment session (by owner)
mutation CreatePayment($bookingId: ID!) {
  createBookingPayment(bookingId: $bookingId) {
    sessionId
    sessionUrl
    booking {
      documentId
      paymentStatus
    }
  }
}

# 2. Customer completes checkout (redirected to sessionUrl)
# -> Webhook updates paymentStatus to "authorized"

# 3. Artist accepts the booking
mutation AcceptBooking($documentId: ID!) {
  updateBooking(
    documentId: $documentId
    data: { reaction: "accepted" }
  ) {
    documentId
    reaction
    paymentStatus  # Will be "paid"
    currency
  }
}

# OR Artist rejects the booking
mutation RejectBooking($documentId: ID!) {
  updateBooking(
    documentId: $documentId
    data: { 
      reaction: "rejected"
      rejectNote: "Schedule conflict"
    }
  ) {
    documentId
    reaction
    paymentStatus  # Will be "cancelled"
  }
}
```

## Query Bookings

Get all bookings where you are owner or artist:

```graphql
query GetMyBookings {
  bookings {
    documentId
    reaction
    paymentStatus
    currency
    day
    start
    owner {
      documentId
      username
      email
    }
    artist {
      documentId
      username
      email
      depositAmount
    }
  }
}
```

Get a specific booking:

```graphql
query GetBooking($documentId: ID!) {
  booking(documentId: $documentId) {
    documentId
    reaction
    paymentStatus
    currency
    day
    start
    location
    description
    placement
    size
    owner {
      documentId
      username
      email
    }
    artist {
      documentId
      username
      email
      stripeAccountID
      payoutsEnabled
      depositAmount
    }
  }
}
```

## Notes

- Payment capture/cancellation only happens when `paymentStatus` is `authorized`
- Reaction changes from any status other than the new status trigger payment processing
- Both REST API (`PUT /api/bookings/:id`) and GraphQL mutations use the same payment logic
- Webhooks handle the initial payment authorization after checkout completion
