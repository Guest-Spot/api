/**
 * Portfolio ownership policy
 * Uses global ownership policy with portfolio-specific configuration
 */

import globalOwnershipPolicy from '../../../policies/is-owner';

export default (policyContext, config, { strapi }) => {
  const portfolioConfig = {
    ownerField: ['ownerDocumentId' as const],
    serviceName: 'api::portfolio.portfolio'
  };

  return globalOwnershipPolicy(policyContext, portfolioConfig, { strapi });
};
