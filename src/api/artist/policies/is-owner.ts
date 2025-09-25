/**
 * Artist ownership policy
 * Uses global ownership policy with artist-specific configuration
 */

import globalOwnershipPolicy from '../../../policies/is-owner';

export default (policyContext, config, { strapi }) => {
  const artistConfig = {
    ownerField: ['documentId'],
    serviceName: 'api::artist.artist'
  };

  return globalOwnershipPolicy(policyContext, artistConfig, { strapi });
};
