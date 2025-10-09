/**
 * Shop lifecycle hooks
 * Automatically handle user assignment without custom controllers
 */

import { UserType } from '../../../../interfaces/enums';
import { sendMembershipRequestEmail } from '../../../../utils/email/membership-request';
import { sendRequestApprovedEmail } from '../../../../utils/email/request-approved';

export default {
  // Before updating, prevent changing the user (except from admin panel)
  async beforeCreate(event) {
    const { data } = event.params;

    const isDraft = !data.publishedAt;

    if (isDraft) {
      data.tempPassword = Math.random().toString(36).substring(2, 8);
      await sendMembershipRequestEmail(data);
    } else {
      try {
        await strapi.documents('plugin::users-permissions.user').create({
          data: {
            username: data.name,
            email: data.email,
            password: data.tempPassword,
            type: UserType.SHOP,
            confirmed: true,
          },
          status: 'published',
        });
        await strapi.documents('api::membership-request.membership-request').delete({
          documentId: data.documentId,
        });
        await sendRequestApprovedEmail({
          email: data.email,
          name: data.name,
          tempPassword: data.tempPassword,
          type: data.type,
        });
      } catch (error) {
        console.error(error);
      }
    }
  },
};
