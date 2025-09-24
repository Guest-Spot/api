/**
 * Shop ownership policy
 * Uses global ownership policy with shop-specific configuration
 */

import globalOwnershipPolicy from '../../../policies/is-owner';

export default (policyContext, config, { strapi }) => {
  const shopConfig = {
    ownerField: 'documentId',
    serviceName: 'api::shop.shop'
  };

  return globalOwnershipPolicy(policyContext, shopConfig, { strapi });
};
