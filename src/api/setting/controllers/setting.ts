/**
 * setting controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::setting.setting', ({ strapi }) => ({
  /**
   * Override find method to include total fee percent
   */
  async find(ctx) {
    // Get default find result (for singleType it sets ctx.body directly)
    await super.find(ctx);

    const body = ctx.body as any;
    const setting = body?.data || body;

    if (!setting) {
      return ctx.body;
    }

    // Get total fee percent data
    try {
      const feeData = await strapi.service('api::setting.setting').getTotalFeePercent();
      
      // Add fee fields to the response
      const updatedSetting = {
        ...setting,
        stripeFeePercent: feeData.stripeFeePercent,
        totalFeePercent: feeData.totalFeePercent,
      };

      // Maintain the same response structure
      if (body?.data) {
        body.data = updatedSetting;
      } else {
        ctx.body = updatedSetting;
      }
    } catch (error) {
      strapi.log.error('Error getting total fee percent in find:', error);
      // Keep original data if error occurs
    }

    return ctx.body;
  },
}));
