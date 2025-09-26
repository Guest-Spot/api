/**
 * Notification helper for shop-related events
 * Handles creation of notifications when artists are removed from shops
 */

import { NotifyType } from '../../../interfaces/enums';

// Map to track processed notifications and prevent duplicates
// Key: "shopId_artistId", Value: timestamp
const processedNotifications = new Map<string, number>();

/**
 * Create notification when artist is removed from shop
 * @param shop - Shop object containing shop data
 * @param artist - Artist object containing artist data
 */
export async function createArtistRemovedNotification(shop: any, artist: any): Promise<void> {
  try {
    // Create unique key for this specific artist-shop combination
    const notificationKey = `${shop.id}_${artist.id}`;
    const now = Date.now();
    
    // Check if we already processed this exact notification recently (within 3 seconds)
    const lastProcessed = processedNotifications.get(notificationKey);
    if (lastProcessed && (now - lastProcessed) < 3000) {
      strapi.log.info(`Skipping duplicate notification for artist removal: ${artist.name} from ${shop.name}`);
      return;
    }

    await strapi.entityService.create('api::notify.notify', {
      data: {
        title: `Artist removed from shop`,
        description: `Artist "${artist.name}" was removed from shop "${shop.name}"`,
        ownerDocumentId: shop.documentId || shop.id.toString(),
        type: NotifyType.DELETE,
        publishedAt: new Date()
      }
    });

    // Record this notification as processed
    processedNotifications.set(notificationKey, now);
    
    // Clean up old entries (older than 30 seconds)
    cleanupOldNotifications(now);

    strapi.log.info(`Notification created for artist removal: ${artist.name} from ${shop.name}`);
  } catch (error) {
    strapi.log.error('Error creating artist removal notification:', error);
  }
}

/**
 * Process artist removal from shop and create notifications
 * @param data - Update data containing disconnect information
 * @param where - Where clause for finding the shop
 */
export async function processArtistRemoval(data: any, where: any): Promise<void> {
  // Check if artists are being disconnected (removed)
  if (data.artists && data.artists.disconnect && data.artists.disconnect.length > 0) {
    try {
      // Get current shop data
      const currentShop: any = await strapi.entityService.findOne('api::shop.shop', where.id, {
        populate: { artists: true }
      });

      if (currentShop) {
        // Process each disconnected artist
        for (const disconnectedArtist of data.artists.disconnect) {
          const artistId = disconnectedArtist.id || disconnectedArtist;
          
          // Find the artist details from current shop data
          const removedArtist = currentShop.artists?.find((artist: any) => artist.id === artistId);

          if (removedArtist) {
            await createArtistRemovedNotification(currentShop, removedArtist);
          } else {
            console.log(`Artist with ID ${artistId} not found in current shop artists`);
          }
        }
      }
    } catch (error) {
      strapi.log.error('Error tracking artist removal:', error);
    }
  } else {
    console.log('No artist disconnections to process');
  }
}

/**
 * Clean up old notification entries from the processed map
 * @param currentTime - Current timestamp in milliseconds
 */
function cleanupOldNotifications(currentTime: number): void {
  const thirtySecondsAgo = currentTime - 30000;
  for (const [key, timestamp] of processedNotifications.entries()) {
    if (timestamp < thirtySecondsAgo) {
      processedNotifications.delete(key);
    }
  }
}
