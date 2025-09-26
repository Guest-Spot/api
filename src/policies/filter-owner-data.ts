import getUserWithProfile from '../utils/getUserWithProfile';

interface OwnershipFilterConfig {
  ownerField?: string | string[];
  userRelation?: string;
}

export default async (policyContext, config: OwnershipFilterConfig) => {
  const { state, args } = policyContext;

  const user = await getUserWithProfile(state?.user?.id);

  if (!user?.profile?.documentId) return false;

  // Handle both single field and array of fields
  const ownerFields = Array.isArray(config.ownerField) ? config.ownerField : [config.ownerField];
  
  // Create OR conditions for all owner fields
  const orConditions = ownerFields
    .filter(field => field) // Remove any undefined/null fields
    .map(field => ({ [field]: { eq: user?.profile?.documentId } }));

  if (orConditions.length > 0) {
    args.filters = {
      ...args.filters,
      $or: orConditions,
    };
  }
  
  return true;
};