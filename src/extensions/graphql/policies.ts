export const grapqlPolicies = ({ strapi }) => ({
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
      policies: ['api::notify.is-owner']
    },
    'Mutation.deleteNotify': { 
      policies: ['api::notify.is-owner']
    },
    // INVITE Policies
    'Mutation.createInvite': { 
      policies: []
    },
    'Mutation.updateInvite': { 
      policies: ['api::invite.is-owner']
    },
    'Mutation.deleteInvite': { 
      policies: ['api::invite.is-owner']
    },
    // SHOP Policies
    'Mutation.createShop': { 
      policies: []
    },
    'Mutation.updateShop': { 
      policies: ['api::shop.is-owner']
    },
    'Mutation.deleteShop': { 
      policies: ['api::shop.is-owner']
    },
    // ARTIST Policies
    'Mutation.createArtist': { 
      policies: []
    },
    'Mutation.updateArtist': { 
      policies: ['api::artist.is-owner']
    },
    'Mutation.deleteArtist': { 
      policies: ['api::artist.is-owner']
    },
    // TRIP Policies
    'Mutation.createTrip': { 
      policies: []
    },
    'Mutation.updateTrip': { 
      policies: ['api::trip.is-owner']
    },
    'Mutation.deleteTrip': { 
      policies: ['api::trip.is-owner']
    },
    // PORTFOLIO Policies
    'Mutation.createPortfolio': { 
      policies: []
    },
    'Mutation.updatePortfolio': { 
      policies: ['api::portfolio.is-owner']
    },
    'Mutation.deletePortfolio': { 
      policies: ['api::portfolio.is-owner']
    },
  },
});
