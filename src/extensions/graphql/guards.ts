export const grapqlGuards = () => ({
  resolversConfig: {
    // FILTER BLOCKED
    'Query.shops': {
      policies: ['global::filter-blocked']
    },
    'Query.shops_connection': {
      policies: ['global::filter-blocked']
    },
    'Query.artists': {
      policies: ['global::filter-blocked']
    },
    'Query.artists_connection': {
      policies: ['global::filter-blocked']
    },
    'Query.guests': {
      policies: ['global::filter-blocked']
    },
    'Query.guests_connection': {
      policies: ['global::filter-blocked']
    },
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
    'Mutation.updateInvite': { 
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['sender', 'recipient'],
          serviceName: 'api::invite.invite'
        }
      }]
    },
    'Mutation.deleteInvite': { 
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['sender', 'recipient'],
          serviceName: 'api::invite.invite'
        }
      }]
    },
    // SHOP Policies
    'Mutation.createShop': { 
      policies: []
    },
    'Mutation.updateShop': { 
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::shop.shop'
        }
      }]
    },
    'Mutation.deleteShop': { 
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::shop.shop'
        }
      }]
    },
    // ARTIST Policies
    'Mutation.createArtist': { 
      policies: []
    },
    'Mutation.updateArtist': { 
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::artist.artist'
        }
      }]
    },
    'Mutation.deleteArtist': { 
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::artist.artist'
        }
      }]
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
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::portfolio.portfolio'
        }
      }]
    },
    'Mutation.deletePortfolio': { 
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::portfolio.portfolio'
        }
      }]
    },
  },
});
