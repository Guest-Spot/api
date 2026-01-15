/**
 * User lifecycle hooks
 * - Automatically create profile when user is created
 * - Automatically delete profile when user is deleted
 */

export default {
  async afterCreate(event: any) {
    const { result } = event;

    if (!result || !result.id) {
      return;
    }

    try {
      // Check if profile already exists
      const existingProfile = await strapi.db.query('api::profile.profile').findOne({
        where: { user: { id: result.id } },
      });

      if (existingProfile) {
        // Profile already exists, skip creation
        return;
      }

      // Create empty profile linked to the user
      await strapi.entityService.create('api::profile.profile', {
        data: {
          user: result.id,
        },
      });

      strapi.log?.info?.(`Auto-created profile for user ${result.id}`);
    } catch (error) {
      strapi.log?.error?.(
        `Failed to auto-create profile for user ${result.id}:`,
        error
      );
      // Don't throw - we don't want to break user creation if profile creation fails
    }
  },

  async beforeDelete(event: any) {
    const { where } = event.params;
    const userId = where?.id || where?.$and?.[0]?.id;

    if (!userId) {
      return;
    }

    try {
      // Find linked profile
      const profile = await strapi.db.query('api::profile.profile').findOne({
        where: { user: { id: userId } },
      });

      if (profile) {
        // Delete the linked profile
        await strapi.entityService.delete('api::profile.profile', profile.id);
        strapi.log?.info?.(`Auto-deleted profile ${profile.id} for user ${userId}`);
      }
    } catch (error) {
      strapi.log?.error?.(
        `Failed to auto-delete profile for user ${userId}:`,
        error
      );
      // Don't throw - allow user deletion to proceed even if profile deletion fails
    }
  },
};
