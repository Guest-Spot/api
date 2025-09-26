/**
 * Notification helper for shop-related events
 * Handles creation of notifications when artists are added to shops
 */

import { NotifyType } from '../../../interfaces/enums';

// Map to track processed notifications and prevent duplicates
// Key: "shopId_artistId", Value: timestamp
const processedNotifications = new Map<string, number>();

/**
 * Create notification when artist is added to shop
 * @param shop - Shop object containing shop data
 * @param artist - Artist object containing artist data
 */
export async function createArtistAddedNotification(shop: any, artist: any): Promise<void> {
  try {
    // Create unique key for this specific artist-shop combination
    const notificationKey = `${shop.id || shop.documentId}_${artist.id || artist.documentId}`;
    const now = Date.now();
    
    // Check if we already processed this exact notification recently (within 3 seconds)
    const lastProcessed = processedNotifications.get(notificationKey);
    if (lastProcessed && (now - lastProcessed) < 3000) {
      strapi.log.info(`Skipping duplicate notification for artist addition: ${artist.name} to ${shop.name}`);
      return;
    }

    await strapi.entityService.create('api::notify.notify', {
      data: {
        ownerDocumentId: shop.documentId || shop.id.toString(),
        recipientDocumentId: artist.documentId || artist.id.toString(),
        type: NotifyType.ADD_ARTIST_TO_SHOP,
        publishedAt: new Date()
      }
    });

    // Record this notification as processed
    processedNotifications.set(notificationKey, now);
    
    // Clean up old entries (older than 30 seconds)
    cleanupOldNotifications(now);

    strapi.log.info(`Notification created for artist addition: ${artist.name} to ${shop.name}`);
  } catch (error) {
    strapi.log.error('Error creating artist addition notification:', error);
  }
}

/**
 * Process artist addition to shop and create notifications
 * @param data - Update data containing connect information
 * @param where - Where clause for finding the shop
 */
export async function processArtistAddition(data: any, where: any): Promise<void> {
  // Check if artists are being connected (added)
  if (data.artists && data.artists.connect && data.artists.connect.length > 0) {
    try {
      // Get current shop data
      const currentShop: any = await strapi.entityService.findOne('api::shop.shop', where.id, {
        populate: { artists: true }
      });

      if (currentShop) {
        // Process each connected artist
        for (const connectedArtist of data.artists.connect) {
          const artistId = connectedArtist.id || connectedArtist;
          
          // Find the artist details from the connected artist data
          let addedArtist;
          if (typeof connectedArtist === 'object' && connectedArtist.id) {
            // If connectedArtist is an object with id, fetch the full artist data
            addedArtist = await strapi.entityService.findOne('api::artist.artist', artistId);
          } else {
            // If connectedArtist is just an id, fetch the full artist data
            addedArtist = await strapi.entityService.findOne('api::artist.artist', artistId);
          }

          if (addedArtist) {
            await createArtistAddedNotification(currentShop, addedArtist);
          } else {
            console.log(`Artist with ID ${artistId} not found`);
          }
        }
      }
    } catch (error) {
      strapi.log.error('Error tracking artist addition:', error);
    }
  } else {
    console.log('No artist connections to process');
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
