/**
 * Invite lifecycle hooks
 * Automatically handle owner assignment without custom controllers
 */

import { InviteType, InviteReaction, NotifyType } from '../../../../interfaces/enums';
import { sendFirebaseNotificationToUser } from '../../../../utils/push-notification';
import isAdmin from '../../../../utils/isAdmin';
import { createNotification } from '../../../../utils/notification';

type InviteUserRelation = {
  documentId: string;
};

type PopulatedInvite = {
  sender: InviteUserRelation;
  recipient: InviteUserRelation;
  type?: InviteType;
  reaction?: InviteReaction | null;
  documentId?: string;
};

const isPopulatedInvite = (invite: unknown): invite is PopulatedInvite => {
  if (!invite || typeof invite !== 'object') {
    return false;
  }

  const current = invite as Record<string, unknown>;
  const sender = current.sender as InviteUserRelation | undefined;
  const recipient = current.recipient as InviteUserRelation | undefined;

  return Boolean(sender?.documentId && recipient?.documentId);
};

type StrapiUser = {
  id?: number | string;
  documentId?: string;
  name?: string | null;
  contactName?: string | null;
  username?: string | null;
  email?: string | null;
};

const fetchUserByDocumentId = async (documentId: string): Promise<StrapiUser | null> => {
  try {
    return await strapi.documents('plugin::users-permissions.user').findOne({
      documentId,
    });
  } catch (error) {
    strapi.log.error(`Failed to fetch user by documentId ${documentId}:`, error);
    return null;
  }
};

const getUserId = (user: StrapiUser | null): number | null => {
  if (!user || user.id === null || user.id === undefined) {
    return null;
  }

  if (typeof user.id === 'number') {
    return user.id;
  }

  const parsed = Number(user.id);

  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  return null;
};

const getUserDisplayName = (user: StrapiUser | null, fallback: string): string => {
  if (!user || typeof user !== 'object') {
    return fallback;
  }

  const preferredKeys: Array<keyof StrapiUser> = ['name', 'contactName', 'username', 'email'];

  for (const key of preferredKeys) {
    const raw = user[key];

    if (typeof raw === 'string') {
      const value = raw.trim();

      if (value) {
        return value;
      }
    }
  }

  return fallback;
};

export default {
  async beforeUpdate(event) {
    const { where, data } = event.params;

    const currentInvite = await strapi.entityService.findOne('api::invite.invite', where.id, {
      populate: ['sender', 'recipient'],
    });

    event.state = {
      ...(event.state || {}),
      previousInvite: currentInvite,
    };

    if (!isPopulatedInvite(currentInvite)) {
      return;
    }

    // Check if invite type is artist-to-shop
    if (currentInvite && currentInvite.type === InviteType.INVITE_CREATED) {
      try {
        // Get current shop data to access existing artists
        const shop = await strapi.documents('plugin::users-permissions.user').findOne({
          documentId: currentInvite.sender.documentId,
          populate: ['childs']
        });

        // Get current artists array or initialize empty array
        const currentArtists = (shop as any).childs ? (shop as any).childs.map((artist: any) => artist.documentId) : [];
        
        if (data.reaction === InviteReaction.ACCEPTED) {
          // Add new artist ID if not already present
          if (!currentArtists.includes(currentInvite.recipient.documentId)) {
            currentArtists.push(currentInvite.recipient.documentId);
            
            // Update the shop's artists field
            await strapi.documents('plugin::users-permissions.user').update({
              documentId: currentInvite.sender.documentId,
              data: {
                childs: currentArtists
              },
              status: 'published',
            });
          }
        } else if (data.reaction === InviteReaction.PENDING || data.reaction === InviteReaction.REJECTED) {
          // Remove artist from shop if invite is pending or rejected
          const updatedArtists = currentArtists.filter((artistDocumentId: string) => artistDocumentId !== currentInvite.recipient.documentId);

          // Update the shop's artists field only if there was a change
          if (updatedArtists.length !== currentArtists.length) {
            await strapi.documents('plugin::users-permissions.user').update({
              documentId: currentInvite.sender.documentId,
              data: {
                childs: updatedArtists
              },
              status: 'published',
            });
          }
        }
      } catch (error) {
        console.error('Error updating artist-shop relationship:', error);
      }
    }
  },
  async afterCreate(event) {
    const createdInvite = event.result;
    const isDraft = !createdInvite.publishedAt;

    if (isDraft || isAdmin()) {
      return;
    }

    if (!createdInvite?.id) {
      return;
    }

    const invite = await strapi.entityService.findOne('api::invite.invite', createdInvite.id, {
      populate: ['sender', 'recipient'],
    });

    if (!isPopulatedInvite(invite)) {
      return;
    }

    const [recipientUser, senderUser] = await Promise.all([
      fetchUserByDocumentId(invite.recipient.documentId),
      fetchUserByDocumentId(invite.sender.documentId),
    ]);

    const recipientUserId = getUserId(recipientUser);

    if (!recipientUserId) {
      return;
    }

    const senderName = getUserDisplayName(senderUser, 'Sender');
    const recipientName = getUserDisplayName(recipientUser, 'Recipient');
    const senderUserId = getUserId(senderUser);

    if (invite.reaction === InviteReaction.PENDING) {
      await createNotification({
        ownerDocumentId: invite.sender.documentId,
        recipientDocumentId: invite.recipient.documentId,
        type: NotifyType.INVITE_CREATED,
        body: invite,
      });
  
      await sendFirebaseNotificationToUser(recipientUserId, {
        title: 'New invite',
        body: `You have received an invite from ${senderName}`,
        data: {
          notifyType: NotifyType.INVITE_CREATED,
          inviteDocumentId: invite.documentId ?? undefined,
          senderDocumentId: invite.sender.documentId,
        },
      });
    } else {
      const isAccepted = invite.reaction === InviteReaction.ACCEPTED;
      await createNotification({
        ownerDocumentId: invite.recipient.documentId,
        recipientDocumentId: invite.sender.documentId,
        type: isAccepted ? NotifyType.INVITE_ACCEPTED : NotifyType.INVITE_REJECTED,
        body: invite,
      });

      await sendFirebaseNotificationToUser(senderUserId, {
        title: isAccepted ? 'Invite accepted' : 'Invite rejected',
        body: `${recipientName} ${isAccepted ? 'accepted' : 'rejected'} your invite.`,
        data: {
          notifyType: isAccepted ? NotifyType.INVITE_ACCEPTED : NotifyType.INVITE_REJECTED,
          inviteDocumentId: invite.documentId ?? undefined,
          recipientDocumentId: invite.recipient.documentId,
        },
      });
    }
  },
};
