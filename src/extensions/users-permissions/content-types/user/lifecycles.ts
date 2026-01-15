/**
 * User lifecycle hooks
 * Automatically create profile when user is created
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
};
