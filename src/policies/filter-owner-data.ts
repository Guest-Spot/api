import getUserWithProfile from '../utils/getUserWithProfile';

interface OwnershipFilterConfig {
  ownerField?: string;
  userRelation?: string;
}

export default async (policyContext, config: OwnershipFilterConfig) => {
  const { state, args } = policyContext;

  const user = await getUserWithProfile(state?.user?.id);

  if (!user?.profile?.documentId) return false;

  args.filters = {
    ...args.filters,
    [config.ownerField]: { eq: user?.profile?.documentId },
  };
  
  return true;
};