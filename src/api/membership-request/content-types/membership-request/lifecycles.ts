/**
 * Shop lifecycle hooks
 * Automatically handle user assignment without custom controllers
 */

import { sendMembershipRequestEmail } from '../../../../utils/email/membership-request';
import { sendRequestApprovedEmail } from '../../../../utils/email/request-approved';

function removeNullValues(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== null));
}

function excludeFields(obj: Record<string, unknown>, fields: string[]) {
  return Object.fromEntries(Object.entries(obj).filter(([key]) => !fields.includes(key)));
}

export default {
  // Before updating, prevent changing the user (except from admin panel)
  async beforeCreate(event) {
    const { data } = event.params;

    const isDraft = !data.publishedAt;

    if (isDraft) {
      data.tempPassword = Math.random().toString(36).substring(2, 8);
      if (data.email) {
        await sendMembershipRequestEmail(data);
      }
    } else {
      try {
        const authenticatedRole = await strapi.db
          .query('plugin::users-permissions.role')
          .findOne({ where: { type: 'authenticated' } });

        if (!authenticatedRole) {
          throw new Error('Authenticated role not found');
        }

        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { documentId: data.userId },
        });

        if (user) {
          const userData = excludeFields(data, ['documentId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'publishedAt']);
          await strapi.entityService.update('plugin::users-permissions.user', user.id, {
            data: removeNullValues({
              ...userData,
              password: userData.tempPassword,
              provider: 'local',
              confirmed: true,
              role: authenticatedRole.id,
            }),
          });
        } else {
          await strapi.plugin('users-permissions').service('user').add({
            ...removeNullValues({
              ...data,
              username: data.username || data.email,
              password: data.tempPassword,
              provider: 'local',
              confirmed: true,
              role: authenticatedRole.id,
            }),
          });
        }
        await strapi.documents('api::membership-request.membership-request').delete({
          documentId: data.documentId,
        });
        if (data.email) {
          await sendRequestApprovedEmail({
            email: data.email,
            name: data.name,
            tempPassword: data.tempPassword,
            type: data.type,
          });
        }
      } catch (error) {
        console.error(error);
      }
    }
  },
};
