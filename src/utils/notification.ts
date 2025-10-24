/**
 * Notification utility module
 * Provides standardized functions for creating in-app notifications
 * 
 * @module notification
 * 
 * @description
 * This module provides a centralized and standardized way to create in-app notifications
 * across the application. It ensures consistency in notification creation and provides
 * better error handling and logging.
 * 
 * @example
 * // Single notification
 * import { createNotification } from '../utils/notification';
 * import { NotifyType } from '../interfaces/enums';
 * 
 * await createNotification({
 *   ownerDocumentId: 'user-123',
 *   recipientDocumentId: 'user-456',
 *   type: NotifyType.BOOKING_CREATED,
 *   body: { bookingId: '789', date: '2024-10-24' },
 * });
 * 
 * @example
 * // Batch notifications
 * import { createNotifications } from '../utils/notification';
 * 
 * await createNotifications([
 *   { ownerDocumentId: '1', recipientDocumentId: '2', type: NotifyType.BOOKING_CREATED },
 *   { ownerDocumentId: '1', recipientDocumentId: '3', type: NotifyType.BOOKING_CREATED },
 * ]);
 */

import { NotifyType } from '../interfaces/enums';

/**
 * Notification creation parameters
 */
export interface CreateNotificationParams {
  ownerDocumentId: string;
  recipientDocumentId: string;
  type: NotifyType;
  body?: any;
  publishedAt?: Date;
}

/**
 * Create a notification entity with provided payload
 * 
 * @param params - Notification parameters
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * await createNotification({
 *   ownerDocumentId: 'user-123',
 *   recipientDocumentId: 'user-456',
 *   type: NotifyType.BOOKING_CREATED,
 *   body: bookingData,
 * });
 * ```
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const {
    ownerDocumentId,
    recipientDocumentId,
    type,
    body,
    publishedAt = new Date(),
  } = params;

  try {
    const notificationData: any = {
      ownerDocumentId,
      recipientDocumentId,
      type,
      publishedAt,
    };

    // Only include body if it's provided
    if (body !== undefined) {
      notificationData.body = body;
    }

    await strapi.entityService.create('api::notify.notify', {
      data: notificationData,
    });

    strapi.log.debug(`Notification created: type=${type}, recipient=${recipientDocumentId}`);
  } catch (error) {
    strapi.log.error(`Error creating notification of type ${type}:`, error);
    throw error;
  }
}

/**
 * Create multiple notifications in batch
 * 
 * @param notifications - Array of notification parameters
 * @returns Promise<void>
 */
export async function createNotifications(notifications: CreateNotificationParams[]): Promise<void> {
  const results = await Promise.allSettled(
    notifications.map((params) => createNotification(params))
  );

  const failed = results.filter((r) => r.status === 'rejected');
  
  if (failed.length > 0) {
    strapi.log.warn(`Failed to create ${failed.length} of ${notifications.length} notifications`);
  }
}

