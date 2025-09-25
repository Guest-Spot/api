/**
 * Trip ownership policy
 * Uses global ownership policy with trip-specific configuration
 */

import globalOwnershipPolicy from '../../../policies/is-owner';

export default (policyContext, config, { strapi }) => {
  const inviteConfig = {
    ownerField: ['sender' as const, 'recipient' as const],
    serviceName: 'api::invite.invite'
  };

  return globalOwnershipPolicy(policyContext, inviteConfig, { strapi });
};
