/**
 * setting service
 */

import { factories } from '@strapi/strapi';
import { getPlatformFeePercent, STRIPE_FEE_PERCENT } from '../../../utils/stripe';

export default factories.createCoreService('api::setting.setting', ({ strapi }) => ({
  /**
   * Get total fee percentage (platform fee + Stripe commission)
   * Stripe standard commission is 2.9%
   * @returns {Promise<{ platformFeePercent: number; stripeFeePercent: number; totalFeePercent: number }>}
   */
  async getTotalFeePercent() {
    const platformFeePercent = await getPlatformFeePercent();
    
    return {
      platformFeePercent,
      stripeFeePercent: STRIPE_FEE_PERCENT,
      totalFeePercent: platformFeePercent + STRIPE_FEE_PERCENT,
    };
  },
}));
