export const grapqlGuards = () => ({
  resolversConfig: {
    // Query resolvers - require authentication and ownership check
    'Query.invites': {
      policies: []
    },
    'Query.invite': { 
      policies: []
    },
    // NOTIFY Policies
    'Query.notifies': {
      policies: [{
        name: 'global::filter-owner-data',
        config: {
          ownerField: ['ownerDocumentId', 'recipientDocumentId']
        }
      }]
    },
    'Query.notify': { 
      policies: [{
        name: 'global::filter-owner-data',
        config: {
          ownerField: ['ownerDocumentId', 'recipientDocumentId']
        }
      }]
    },
    // NOTIFY Policies
    'Mutation.createNotify': { 
      policies: []
    },
    'Mutation.updateNotify': { 
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['ownerDocumentId', 'recipientDocumentId'],
          serviceName: 'api::notify.notify'
        }
      }]
    },
    'Mutation.deleteNotify': { 
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['ownerDocumentId', 'recipientDocumentId'],
          serviceName: 'api::notify.notify'
        }
      }]
    },
    // INVITE Policies
    'Mutation.createInvite': { 
      policies: []
    },
    // TRIP Policies
    'Mutation.createTrip': { 
      policies: []
    },
    'Mutation.updateTrip': { 
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::trip.trip'
        }
      }]
    },
    'Mutation.deleteTrip': { 
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::trip.trip'
        }
      }]
    },
    // PORTFOLIO Policies
    'Mutation.createPortfolio': { 
      policies: []
    },
    'Mutation.updatePortfolio': { 
      policies: []
    },
    'Mutation.deletePortfolio': { 
      policies: []
    },
    // BOOKING Policies
    'Query.bookings': {
      policies: [{
        name: 'global::filter-booking-data'
      }]
    },
    'Query.booking': {
      policies: [{
        name: 'global::is-booking-participant'
      }]
    },
    'Mutation.createBooking': { 
      policies: []
    },
    'Mutation.updateBooking': { 
      policies: [{
        name: 'global::is-booking-participant'
      }]
    },
    'Mutation.deleteBooking': { 
      policies: [{
        name: 'global::is-booking-participant'
      }]
    },
    // PAYMENT Policies
    'Mutation.createBookingPayment': {
      policies: []
    },
    // STRIPE CONNECT Policies
    'Mutation.createStripeOnboardingUrl': {
      policies: []
    },
    'Mutation.refreshStripeOnboardingUrl': {
      policies: []
    },
    'Mutation.checkStripeAccountStatus': {
      policies: []
    },
  },
});
