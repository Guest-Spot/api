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
