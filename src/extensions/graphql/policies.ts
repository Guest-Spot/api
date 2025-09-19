export const grapqlPolicies = ({ strapi }) => ({
  resolversConfig: {
    // Query resolvers - require authentication and ownership check
    'Query.invites': { 
      auth: true,
      policies: [
        {
          name: 'global::filter-owner-data',
          config: { ownerField: 'sender' }
        }
      ]
    },
    'Query.invite': { 
      auth: true,
      policies: []
    },
    
    // INVITE Policies
    'Mutation.createInvite': { 
      auth: true,
      policies: []
    },
    'Mutation.updateInvite': { 
      auth: true,
      policies: ['api::invite.is-owner']
    },
    'Mutation.deleteInvite': { 
      auth: true,
      policies: ['api::invite.is-owner']
    },
    // SHOP Policies
    'Mutation.createShop': { 
      auth: true,
      policies: []
    },
    'Mutation.updateShop': { 
      auth: true,
      policies: ['api::shop.is-owner']
    },
    'Mutation.deleteShop': { 
      auth: true,
      policies: ['api::shop.is-owner']
    },
    // ARTIST Policies
    'Mutation.createArtist': { 
      auth: true,
      policies: []
    },
    'Mutation.updateArtist': { 
      auth: true,
      policies: ['api::artist.is-owner']
    },
    'Mutation.deleteArtist': { 
      auth: true,
      policies: ['api::artist.is-owner']
    },
    // TRIP Policies
    'Mutation.createTrip': { 
      auth: true,
      policies: []
    },
    'Mutation.updateTrip': { 
      auth: true,
      policies: ['api::trip.is-owner']
    },
    'Mutation.deleteTrip': { 
      auth: true,
      policies: ['api::trip.is-owner']
    },
    // PORTFOLIO Policies
    'Mutation.createPortfolio': { 
      auth: true,
      policies: []
    },
    'Mutation.updatePortfolio': { 
      auth: true,
      policies: ['api::portfolio.is-owner']
    },
    'Mutation.deletePortfolio': { 
      auth: true,
      policies: ['api::portfolio.is-owner']
    },
  },
});
