/**
 * Global ownership policy
 * Checks ownership for update and delete operations based on different ownership patterns
 */

import getUserWithProfile from "../utils/getUserWithProfile";

interface OwnershipConfig {
  // For entities that use owner field (like portfolio, trip)
  ownerField?: string[];
  // For entities that use users_permissions_user relation (like artist, shop)
  userRelation?: string;
  // Service name to use in entity operations
  serviceName: string;
}

export default (policyContext, config: OwnershipConfig, { strapi }) => {
  const state = policyContext.state;
  
  // If no user is authenticated, deny access
  if (!state?.user?.id) {
    return false;
  }

  return new Promise(async (resolve) => {
    try {
      const user = await getUserWithProfile(state?.user?.id);
      const entityId = policyContext?.args?.id || policyContext?.args?.documentId;
      
      if (!entityId) {
        resolve(false);
        return;
      }

      // Find the entity by ID
      const entity = await strapi.documents(config.serviceName).findOne({
        documentId: entityId,
        ...(config.userRelation ? { populate: [config.userRelation] } : {})
      });

      if (!entity) {
        resolve(false);
        return;
      }

      let isOwner = false;

      // Check ownership based on the configured pattern
      if (config.ownerField) {
        // For entities using owner field
        isOwner = config.ownerField.some(field => entity[field] === user.profile.documentId);
      } else if (config.userRelation) {
        // For entities using users_permissions_user relation
        isOwner = entity[config.userRelation]?.documentId === user.profile.documentId;
      }

      resolve(isOwner);
      
    } catch (error) {
      strapi.log.error(`Ownership policy error for ${config.serviceName}:`, error);
      resolve(false);
    }
  });
};
