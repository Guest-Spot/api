/**
 * Global ownership policy
 * Checks ownership for update and delete operations based on different ownership patterns
 */

interface OwnershipConfig {
  // For entities that use ownerDocumentId field (like portfolio, trip)
  ownerField?: string;
  // For entities that use users_permissions_user relation (like artist, shop)
  userRelation?: string;
  // Service name to use in entity operations
  serviceName: string;
}

export default (policyContext, config: OwnershipConfig, { strapi }) => {
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
        const entityId = policyContext.params.id;
        
        if (!entityId) {
          resolve(false);
          return;
        }

        // Determine populate options based on ownership pattern
        const populateOptions = config.userRelation ? { populate: [config.userRelation] } : {};

        // Find the entity by ID
        const entity = await strapi.entityService.findOne(
          config.serviceName,
          entityId,
          populateOptions
        );

        if (!entity) {
          resolve(false);
          return;
        }

        let isOwner = false;

        // Check ownership based on the configured pattern
        if (config.ownerField && config.ownerField === 'ownerDocumentId') {
          // For entities using ownerDocumentId field
          isOwner = entity.ownerDocumentId === user.documentId;
        } else if (config.userRelation) {
          // For entities using users_permissions_user relation
          isOwner = entity[config.userRelation]?.id === user.id;
        }

        resolve(isOwner);
        
      } catch (error) {
        strapi.log.error(`Ownership policy error for ${config.serviceName}:`, error);
        resolve(false);
      }
    });
  }

  // For other operations, allow if user is authenticated
  return true;
};
