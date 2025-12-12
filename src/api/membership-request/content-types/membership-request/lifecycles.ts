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

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { documentId: data.userId },
    });

    if (isDraft) {
      data.tempPassword = Math.random().toString(36).substring(2, 8);
      if (data.email) {
        await sendMembershipRequestEmail({
          ...data,
          type: data.type || user?.type,
        });
      }
    } else {
      try {
        const authenticatedRole = await strapi.db
          .query('plugin::users-permissions.role')
          .findOne({ where: { type: 'authenticated' } });

        if (!authenticatedRole) {
          throw new Error('Authenticated role not found');
        }

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
            username: data.username || user?.username,
            email: data.email || user?.email,
            name: data.name || user?.name,
            tempPassword: data.tempPassword,
            type: data.type || user?.type,
          });
        }
      } catch (error) {
        console.error(error);
      }
    }
  },
};
