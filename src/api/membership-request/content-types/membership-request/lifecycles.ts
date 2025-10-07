/**
 * Shop lifecycle hooks
 * Automatically handle user assignment without custom controllers
 */

import { UserType } from '../../../../interfaces/enums';

export default {
  // Before updating, prevent changing the user (except from admin panel)
  async beforeCreate(event) {
    const { data } = event.params;

    const isDraft = !data.publishedAt;

    if (isDraft) {
      data.tempPassword = Math.random().toString(36).substring(2, 8);
    } else {
      try {
        await strapi.documents('plugin::users-permissions.user').create({
          data: {
            username: data.name,
            email: data.email,
            password: data.tempPassword,
            type: UserType.SHOP,
          },
          status: 'published',
        });
        await strapi.documents('api::membership-request.membership-request').delete({
          documentId: data.documentId,
        });
        // TODO: add template for email
        await strapi.plugins.email.services.email.send({
          to: data.email,
          subject: 'Hello from Strapi!',
          text: 'This is a test email from Strapi v5.',
        });
      } catch (error) {
        console.error(error);
      }
    }
  },
};
