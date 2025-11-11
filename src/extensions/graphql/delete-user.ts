/**
 * GraphQL extension for custom user deletion with cascade cleanup
 * Automatically removes all user-related data before deleting the user
 */

export const deleteUserExtension = ({ strapi }) => ({
  typeDefs: /* GraphQL */ ``,
  resolvers: {
    Mutation: {
      /**
       * Custom delete resolver for users with cascade cleanup
       * Removes all related data: bookings, portfolios, opening hours,
       * device tokens, invites, and handles user relations
       */
      deleteUsersPermissionsUser: async (parent, args, context) => {
        const { id } = args;
        
        if (!id) {
          throw new Error('User ID is required');
        }

        // Get user documentId from id
        // id can be either numeric id or documentId (UID string)
        let userDocumentId: string;
        let userId: number;

        try {
          // First, try to find user by documentId (if id is a UID string)
          let user = await strapi.documents('plugin::users-permissions.user').findOne({
            documentId: id,
          });

          if (!user) {
            // If not found by documentId, try to find by numeric id
            const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
            if (!isNaN(numericId) && Number.isInteger(numericId)) {
              const userByNumericId = await strapi.db.query('plugin::users-permissions.user').findOne({
                where: { id: numericId },
              });

              if (userByNumericId) {
                userDocumentId = userByNumericId.documentId;
                userId = userByNumericId.id;
              } else {
                throw new Error('User not found');
              }
            } else {
              throw new Error('User not found');
            }
          } else {
            userDocumentId = user.documentId;
            userId = user.id;
          }
        } catch (error) {
          strapi.log.error('Error finding user for deletion:', error);
          if (error instanceof Error && error.message === 'User not found') {
            throw error;
          }
          throw new Error('User not found');
        }

        strapi.log.info(`Starting cascade deletion for user ${userId} (${userDocumentId})`);

        // 1. Handle user relations (parent/childs)
        try {
          const userWithRelations = await strapi.documents('plugin::users-permissions.user').findOne({
            documentId: userDocumentId,
            populate: ['parent', 'childs'],
          });

          if (userWithRelations) {
            // If user has parent, we need to remove this user from parent's childs
            // Use db.query to directly update the relation
            if (userWithRelations.parent) {
              try {
                // Get all childs of the parent except the user being deleted
                const parentChilds = await strapi.db.query('plugin::users-permissions.user').findMany({
                  where: {
                    parent: { id: userWithRelations.parent.id },
                    id: { $ne: userId },
                  },
                });

                // Update parent's childs relation using entityService
                const childIds = parentChilds.map((child: any) => child.id);
                await strapi.entityService.update('plugin::users-permissions.user', userWithRelations.parent.id, {
                  data: {
                    childs: childIds,
                  },
                });
              } catch (error) {
                strapi.log.error('Error updating parent childs relation:', error);
              }
            }

            // If user has childs, set their parent to null
            if (userWithRelations.childs && userWithRelations.childs.length > 0) {
              for (const child of userWithRelations.childs) {
                try {
                  await strapi.entityService.update('plugin::users-permissions.user', child.id, {
                    data: {
                      parent: null,
                    },
                  });
                } catch (error) {
                  strapi.log.error(`Error updating child user ${child.id}:`, error);
                }
              }
            }
          }
        } catch (error) {
          strapi.log.error('Error handling user relations:', error);
          // Continue with deletion even if relations update fails
        }

        // 2. Delete all bookings where user is artist or owner
        try {
          const bookingsAsArtist = await strapi.db.query('api::booking.booking').findMany({
            where: {
              artist: { id: userId },
            },
          });

          const bookingsAsOwner = await strapi.db.query('api::booking.booking').findMany({
            where: {
              owner: { id: userId },
            },
          });

          const allBookings = [...bookingsAsArtist, ...bookingsAsOwner];
          const uniqueBookings = Array.from(
            new Map(allBookings.map((b: any) => [b.documentId, b])).values()
          );

          for (const booking of uniqueBookings) {
            try {
              await strapi.documents('api::booking.booking').delete({
                documentId: booking.documentId,
              });
            } catch (error) {
              strapi.log.error(`Error deleting booking ${booking.documentId}:`, error);
            }
          }

          if (uniqueBookings.length > 0) {
            strapi.log.info(`Deleted ${uniqueBookings.length} booking(s) for user ${userId}`);
          }
        } catch (error) {
          strapi.log.error('Error deleting bookings:', error);
        }

        // 3. Delete all portfolios with ownerDocumentId matching user's documentId
        try {
          const portfolios = await strapi.db.query('api::portfolio.portfolio').findMany({
            where: {
              ownerDocumentId: userDocumentId,
            },
          });

          for (const portfolio of portfolios) {
            try {
              await strapi.documents('api::portfolio.portfolio').delete({
                documentId: portfolio.documentId,
              });
            } catch (error) {
              strapi.log.error(`Error deleting portfolio ${portfolio.documentId}:`, error);
            }
          }

          if (portfolios.length > 0) {
            strapi.log.info(`Deleted ${portfolios.length} portfolio(s) for user ${userId}`);
          }
        } catch (error) {
          strapi.log.error('Error deleting portfolios:', error);
        }

        // 4. Delete all opening hours
        try {
          const openingHours = await strapi.db.query('api::opening-hour.opening-hour').findMany({
            where: {
              user: { id: userId },
            },
          });

          for (const openingHour of openingHours) {
            try {
              await strapi.documents('api::opening-hour.opening-hour').delete({
                documentId: openingHour.documentId,
              });
            } catch (error) {
              strapi.log.error(`Error deleting opening hour ${openingHour.documentId}:`, error);
            }
          }

          if (openingHours.length > 0) {
            strapi.log.info(`Deleted ${openingHours.length} opening hour(s) for user ${userId}`);
          }
        } catch (error) {
          strapi.log.error('Error deleting opening hours:', error);
        }

        // 5. Delete all device tokens
        try {
          const deviceTokens = await strapi.db.query('api::device-token.device-token').findMany({
            where: {
              user: { id: userId },
            },
          });

          for (const deviceToken of deviceTokens) {
            try {
              await strapi.documents('api::device-token.device-token').delete({
                documentId: deviceToken.documentId,
              });
            } catch (error) {
              strapi.log.error(`Error deleting device token ${deviceToken.documentId}:`, error);
            }
          }

          if (deviceTokens.length > 0) {
            strapi.log.info(`Deleted ${deviceTokens.length} device token(s) for user ${userId}`);
          }
        } catch (error) {
          strapi.log.error('Error deleting device tokens:', error);
        }

        // 6. Delete all invites where user is sender or recipient
        try {
          const invitesAsSender = await strapi.db.query('api::invite.invite').findMany({
            where: {
              sender: { id: userId },
            },
          });

          const invitesAsRecipient = await strapi.db.query('api::invite.invite').findMany({
            where: {
              recipient: { id: userId },
            },
          });

          const allInvites = [...invitesAsSender, ...invitesAsRecipient];
          const uniqueInvites = Array.from(
            new Map(allInvites.map((i: any) => [i.documentId, i])).values()
          );

          for (const invite of uniqueInvites) {
            try {
              await strapi.documents('api::invite.invite').delete({
                documentId: invite.documentId,
              });
            } catch (error) {
              strapi.log.error(`Error deleting invite ${invite.documentId}:`, error);
            }
          }

          if (uniqueInvites.length > 0) {
            strapi.log.info(`Deleted ${uniqueInvites.length} invite(s) for user ${userId}`);
          }
        } catch (error) {
          strapi.log.error('Error deleting invites:', error);
        }

        // 7. Clear Stripe data (don't delete Stripe account, just clear references)
        try {
          await strapi.documents('plugin::users-permissions.user').update({
            documentId: userDocumentId,
            data: {
              stripeAccountID: null,
              payoutsEnabled: false,
            },
          });
          strapi.log.info(`Cleared Stripe data for user ${userId}`);
        } catch (error) {
          strapi.log.error('Error clearing Stripe data:', error);
          // Continue with deletion even if Stripe cleanup fails
        }

        // 8. Finally, delete the user itself
        // Call the default Strapi delete mutation
        try {
          const deletedUser = await strapi.documents('plugin::users-permissions.user').delete({
            documentId: userDocumentId,
          });

          strapi.log.info(`Successfully deleted user ${userId} (${userDocumentId})`);
          return deletedUser;
        } catch (error) {
          strapi.log.error('Error deleting user:', error);
          throw error;
        }
      },
    },
  },
  resolversConfig: {
    'Mutation.deleteUsersPermissionsUser': {
      auth: true, // Require authentication
    },
  },
});
