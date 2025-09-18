/**
 * Trip ownership policy - simplified version
 * Only checks ownership for update and delete operations
 */

export default (policyContext, config, { strapi }) => {
  const { user } = policyContext.state;
  
  // If no user is authenticated, deny access
  if (!user) {
    return false;
  }

  // For update and delete operations, check ownership
  if (policyContext.request.method === 'PUT' || 
      policyContext.request.method === 'DELETE') {
    
    return new Promise(async (resolve) => {
      try {
        const tripId = policyContext.params.id;
        
        if (!tripId) {
          resolve(false);
          return;
        }

        // Find the trip by ID
        const trip = await strapi.entityService.findOne(
          'api::trip.trip',
          tripId
        );

        if (!trip) {
          resolve(false);
          return;
        }

        // Check if the current user is the owner
        const isOwner = trip.ownerDocumentId === user.documentId;
        resolve(isOwner);
        
      } catch (error) {
        strapi.log.error('Trip ownership policy error:', error);
        resolve(false);
      }
    });
  }

  // For other operations, allow if user is authenticated
  return true;
};
