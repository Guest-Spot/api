/**
 * Trip ownership policy
 * Uses global ownership policy with trip-specific configuration
 */

import globalOwnershipPolicy from '../../../policies/is-owner';

export default (policyContext, config, { strapi }) => {
  const tripConfig = {
    ownerField: ['ownerDocumentId' as const],
    serviceName: 'api::trip.trip'
  };

  return globalOwnershipPolicy(policyContext, tripConfig, { strapi });
};
