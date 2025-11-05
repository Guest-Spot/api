# Stripe Connect Artist Onboarding

## Overview

This document describes the Stripe Connect onboarding flow for artists in the GuestSpot platform. Artists need to complete Stripe onboarding to receive payments from bookings.

## What is Stripe Connect?

Stripe Connect allows platforms like GuestSpot to:
- Create Stripe accounts for artists (payees)
- Facilitate payments to artists
- Handle platform fees automatically
- Manage payouts to artists' bank accounts

We use **Stripe Express** accounts which are:
- Easy to onboard (minimal information required)
- Stripe-hosted onboarding (PCI compliant)
- Full Stripe Dashboard access for artists
- Automatic payout handling

## GraphQL API

### Mutations

#### 1. createStripeOnboardingUrl

Creates a Stripe Connect account (if doesn't exist) and generates an onboarding URL.

**Query:**
```graphql
mutation {
  createStripeOnboardingUrl {
    url
    accountId
    expiresAt
  }
}
```

**Response:**
```json
{
  "data": {
    "createStripeOnboardingUrl": {
      "url": "https://connect.stripe.com/setup/s/...",
      "accountId": "acct_1234567890",
      "expiresAt": 1698765432
    }
  }
}
```

**Requirements:**
- User must be logged in (JWT token required)
- User type must be `artist`
- Email must be verified

**What it does:**
1. Checks if artist already has a Stripe account
2. Creates new Express account if needed
3. Saves `stripeAccountID` to user record
4. Generates onboarding URL (expires in ~30 minutes)
5. Returns URL for artist to complete onboarding

#### 2. refreshStripeOnboardingUrl

Refreshes an expired onboarding URL.

**Query:**
```graphql
mutation {
  refreshStripeOnboardingUrl {
    url
    accountId
    expiresAt
  }
}
```

**Use case:** If artist doesn't complete onboarding before URL expires (30 minutes).

#### 3. checkStripeAccountStatus

Checks the current status of artist's Stripe account.

**Query:**
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
      "accountId": "acct_1234567890",
      "onboarded": true,
      "payoutsEnabled": true,
      "chargesEnabled": true,
      "detailsSubmitted": true
    }
  }
}
```

**What it checks:**
- `onboarded`: All requirements met, can receive payments
- `payoutsEnabled`: Can receive payouts to bank account
- `chargesEnabled`: Can accept charges
- `detailsSubmitted`: Has submitted all required information

**Important:** This mutation also updates the user's `payoutsEnabled` field if status changed.

## Artist Onboarding Flow

### Step 1: Artist Initiates Onboarding

In your app, add a button/screen for Stripe onboarding:

```typescript
import { gql, useMutation } from '@apollo/client';
import { Linking } from 'react-native';

const CREATE_ONBOARDING_URL = gql`
  mutation {
    createStripeOnboardingUrl {
      url
      expiresAt
    }
  }
`;

function StripeOnboardingScreen() {
  const [createUrl, { loading, error }] = useMutation(CREATE_ONBOARDING_URL);

  const handleStartOnboarding = async () => {
    try {
      const result = await createUrl();
      const { url } = result.data.createStripeOnboardingUrl;
      
      // Open Stripe onboarding in browser
      await Linking.openURL(url);
      
      // Or for web: window.location.href = url;
    } catch (err) {
      console.error('Failed to start onboarding:', err);
      alert('Failed to start onboarding. Please try again.');
    }
  };

  return (
    <View>
      <Text>Connect your bank account to receive payments</Text>
      <Button 
        onPress={handleStartOnboarding} 
        disabled={loading}
        title={loading ? 'Loading...' : 'Connect Stripe Account'}
      />
      {error && <Text>Error: {error.message}</Text>}
    </View>
  );
}
```

### Step 2: Artist Completes Stripe Form

Artist is redirected to Stripe's hosted onboarding page where they provide:

**Required Information:**
- Business/Individual details
- Bank account information (for payouts)
- Tax information (SSN/EIN in US)
- Identity verification (may require photo ID)

**Stripe handles:**
- Form validation
- Identity verification
- Bank account verification
- Compliance checks

### Step 3: Return to App

After completing (or cancelling) onboarding, artist is redirected back to your app:

**Success URL:** `FRONTEND_URL/artist/stripe-onboarding/success`  
**Refresh URL:** `FRONTEND_URL/artist/stripe-onboarding?refresh=true`

Handle these routes in your app:

```typescript
// Success page
function OnboardingSuccess() {
  const [checkStatus] = useMutation(CHECK_STATUS);

  useEffect(() => {
    // Check if onboarding is complete
    const verifyStatus = async () => {
      const result = await checkStatus();
      if (result.data.checkStripeAccountStatus.onboarded) {
        // Show success message
        // Navigate to dashboard
      } else {
        // Onboarding incomplete, show message
      }
    };
    
    verifyStatus();
  }, []);

  return <Text>Verifying your account...</Text>;
}

// Refresh page (when URL expires)
function OnboardingRefresh() {
  const [refreshUrl] = useMutation(REFRESH_ONBOARDING_URL);

  useEffect(() => {
    const refresh = async () => {
      const result = await refreshUrl();
      await Linking.openURL(result.data.refreshStripeOnboardingUrl.url);
    };
    
    refresh();
  }, []);

  return <Text>Refreshing...</Text>;
}
```

### Step 4: Webhook Updates Status

When artist completes onboarding, Stripe sends `account.updated` webhook:

```
POST /api/webhooks/stripe
Event: account.updated
```

The webhook handler automatically:
1. Finds user by `stripeAccountID`
2. Checks if account is fully onboarded
3. Updates user's `payoutsEnabled` field
4. Sends push notification to artist

### Step 5: Verify Status in App

After returning from Stripe, check status:

```typescript
const CHECK_STATUS = gql`
  mutation {
    checkStripeAccountStatus {
      onboarded
      payoutsEnabled
    }
  }
`;

function Dashboard() {
  const [checkStatus, { data }] = useMutation(CHECK_STATUS);

  const status = data?.checkStripeAccountStatus;

  if (!status?.onboarded) {
    return (
      <View>
        <Text>⚠️ Complete your Stripe onboarding to receive payments</Text>
        <Button title="Complete Setup" onPress={/* create onboarding URL */} />
      </View>
    );
  }

  return (
    <View>
      <Text>✅ You're ready to receive payments!</Text>
    </View>
  );
}
```

## Environment Variables

Add to your `.env`:

```bash
# Frontend URL for redirects after onboarding
FRONTEND_URL=https://yourapp.com

# For development
# FRONTEND_URL=http://localhost:3000
```

## Webhook Configuration

In Stripe Dashboard, add webhook event:

**Event:** `account.updated`

This webhook is used to automatically update artist's `payoutsEnabled` status when they complete onboarding.

## Testing

### 1. Test in Development

```graphql
mutation {
  createStripeOnboardingUrl {
    url
  }
}
```

### 2. Open Onboarding URL

Copy the URL and open in browser.

### 3. Use Test Data

Stripe provides test data for filling forms in test mode:

**Test Bank Account (US):**
- Routing number: `110000000`
- Account number: `000123456789`

**Test SSN:**
- `000-00-0000`

**Test Date of Birth:**
- `01/01/1990`

### 4. Complete Onboarding

Submit the form and verify redirect back to your app.

### 5. Check Status

```graphql
mutation {
  checkStripeAccountStatus {
    onboarded
    payoutsEnabled
  }
}
```

## User Experience Best Practices

### 1. Show Onboarding Status

Display clear status in artist profile:

```
☐ Connect Stripe Account
  Complete setup to receive payments

☑ Stripe Account Connected
  You're ready to accept bookings
```

### 2. Block Booking Acceptance

Don't allow artists to accept paid bookings until onboarded:

```typescript
const depositAmount = artist.depositAmount ?? 0;

if (depositAmount > 0 && !artist.payoutsEnabled) {
  return error('Complete Stripe onboarding to accept paid bookings');
}
```

### 3. Remind Artists

Send reminders if onboarding incomplete:
- Push notification after 24 hours
- Email after 48 hours
- In-app banner

### 4. Handle Errors Gracefully

```typescript
try {
  await createOnboardingUrl();
} catch (error) {
  if (error.message.includes('Only artists')) {
    showError('Only artists can connect Stripe accounts');
  } else {
    showError('Failed to start onboarding. Please try again.');
  }
}
```

## Troubleshooting

### "Only artists can create Stripe Connect accounts"

User type must be `artist`. Check:
```graphql
query {
  me {
    type
  }
}
```

### "Stripe account not found. Please create one first."

When calling `refreshStripeOnboardingUrl`, artist must have already called `createStripeOnboardingUrl` at least once.

### Onboarding URL Expires

Onboarding URLs expire after ~30 minutes. If expired:
1. Call `refreshStripeOnboardingUrl`
2. Open new URL

Or artist can restart: call `createStripeOnboardingUrl` again.

### Status Not Updating

After artist completes onboarding:
1. Check webhook is configured (`account.updated`)
2. Check webhook logs in Stripe Dashboard
3. Manually call `checkStripeAccountStatus` to sync

### Artist Can't Receive Payouts

Check all status fields:
```graphql
mutation {
  checkStripeAccountStatus {
    onboarded
    payoutsEnabled
    chargesEnabled
    detailsSubmitted
  }
}
```

All should be `true`. If not, artist may need to:
- Complete additional verification
- Add missing information
- Verify bank account

## Security Notes

- ✅ Onboarding URLs expire automatically
- ✅ Only artist can access their own account
- ✅ No sensitive data stored in database
- ✅ All banking info handled by Stripe
- ✅ PCI compliant (Stripe handles everything)

## Monitoring

### Check Onboarding Progress

In Stripe Dashboard:
1. Go to [Connect > Accounts](https://dashboard.stripe.com/connect/accounts/overview)
2. Find artist's account by email
3. View onboarding status and issues

### Common Issues

- **Pending Verification:** Artist may need to provide additional documents
- **Restricted:** Account flagged for review (rare)
- **Rejected:** Information didn't pass verification (need to retry)

## Support

If artist has issues with onboarding:
1. Check Stripe Dashboard for specific requirements
2. Email to artist with specific steps needed
3. For verification issues, artist should contact Stripe Support

---

**Related Documentation:**
- [Stripe Payment Integration](./STRIPE_INTEGRATION.md)
- [Stripe GraphQL API](./STRIPE_GRAPHQL.md)
- [Stripe Official Docs](https://stripe.com/docs/connect)

**Last Updated:** October 28, 2025
