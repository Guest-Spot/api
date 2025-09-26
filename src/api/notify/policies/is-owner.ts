/**
 * Trip ownership policy
 * Uses global ownership policy with trip-specific configuration
 */

import globalOwnershipPolicy from '../../../policies/is-owner';

export default (policyContext, config, { strapi }) => {
  const inviteConfig = {
    ownerField: ['ownerDocumentId' as const, 'recipientDocumentId' as const],
    serviceName: 'api::notify.notify'
  };

  return globalOwnershipPolicy(policyContext, inviteConfig, { strapi });
};
