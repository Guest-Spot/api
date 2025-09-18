/**
 * Shop ownership policy
 * Uses global ownership policy with shop-specific configuration
 */

import globalOwnershipPolicy from '../../../policies/is-owner';

export default (policyContext, config, { strapi }) => {
  const shopConfig = {
    userRelation: 'users_permissions_user',
    serviceName: 'api::shop.shop'
  };

  return globalOwnershipPolicy(policyContext, shopConfig, { strapi });
};
