import { getFirebaseMessaging } from './firebase-admin';

const MAX_TOKENS_PER_REQUEST = 500;
const INVALID_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  // Firebase sometimes reports malformed tokens with the more generic "invalid-argument" code.
  'messaging/invalid-argument',
]);
const SERVICE_AUTH_ERRORS = new Map<string, string>([
  [
    'messaging/apns-auth-error',
    'APNS authentication failed; verify your APNS key or certificate configuration in Firebase.',
  ],
  [
    'messaging/webpush-auth-error',
    'Web Push authentication failed; verify that your VAPID keys are configured correctly in Firebase.',
  ],
]);

type Primitive = string | number | boolean | null | undefined;

const getFirebaseErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  if ('code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }

  return undefined;
};

export interface PushNotificationMessage {
  title: string;
  body?: string | null;
  data?: Record<string, Primitive>;
}

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  if (chunkSize <= 0) {
    return [items];
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
};

const serializeDataPayload = (data?: Record<string, Primitive>): Record<string, string> | undefined => {
  if (!data) {
    return undefined;
  }

  const entries = Object.entries(data).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === null || value === undefined) {
      return acc;
    }

    acc[key] = typeof value === 'string' ? value : String(value);
    return acc;
  }, {});

  return Object.keys(entries).length ? entries : undefined;
};

const fetchDeviceTokens = async (userId: number): Promise<string[]> => {
  try {
    const tokens = await strapi.entityService.findMany('api::device-token.device-token', {
      filters: { user: { id: userId } },
      fields: ['token'],
      limit: -1,
      publicationState: 'live',
    });

    return (tokens || [])
      .map((tokenRecord: { token?: string | null }) => tokenRecord?.token)
      .filter((token): token is string => typeof token === 'string' && !!token.trim())
      .map((token) => token.trim());
  } catch (error) {
    strapi.log.error(`[FirebasePush] Failed to fetch device tokens for user ${userId}:`, error);
    return [];
  }
};

const removeInvalidTokens = async (tokens: string[]): Promise<void> => {
  if (!tokens.length) {
    return;
  }

  try {
    await strapi.db.query('api::device-token.device-token').deleteMany({
      where: {
        token: { $in: tokens },
      },
    });
  } catch (error) {
    strapi.log.error('[FirebasePush] Failed to remove invalid device tokens:', error);
  }
};

export const sendFirebaseNotificationToUser = async (
  userId: number | null | undefined,
  message: PushNotificationMessage,
): Promise<void> => {
  if (!userId) {
    return;
  }

  const tokens = await fetchDeviceTokens(userId);

  if (!tokens.length) {
    return;
  }

  if (!message?.title?.trim()) {
    strapi.log.warn('[FirebasePush] Cannot send push notification without a title.');
    return;
  }

  const messaging = getFirebaseMessaging();

  if (!messaging) {
    strapi.log.warn('[FirebasePush] Firebase messaging is not available. Push notification skipped.');
    return;
  }

  const dataPayload = serializeDataPayload(message.data);

  const notificationPayload = {
    notification: {
      title: message.title,
      ...(message.body ? { body: message.body } : {}),
    },
  };

  const tokenChunks = chunkArray(tokens, MAX_TOKENS_PER_REQUEST);

  for (const chunk of tokenChunks) {
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        ...notificationPayload,
        ...(dataPayload ? { data: dataPayload } : {}),
      });

      const tokensToRemove: string[] = [];
      let shouldAbortDueToServiceAuthError = false;

      for (let index = 0; index < response.responses.length; index += 1) {
        const sendResponse = response.responses[index];
        const token = chunk[index];

        if (!token) {
          continue;
        }

        if (!sendResponse.success) {
          const errorCode = sendResponse.error?.code;

          if (errorCode && SERVICE_AUTH_ERRORS.has(errorCode)) {
            const message = SERVICE_AUTH_ERRORS.get(errorCode);

            if (message) {
              strapi.log.error(`[FirebasePush] ${message} (code: ${errorCode}).`);
            }

            shouldAbortDueToServiceAuthError = true;
            break;
          }

          if (errorCode && INVALID_TOKEN_ERRORS.has(errorCode)) {
            tokensToRemove.push(token);
            continue;
          }

          if (errorCode) {
            strapi.log.warn(`[FirebasePush] Failed to send notification to token ${token}: ${errorCode}`);
          } else if (sendResponse.error) {
            strapi.log.warn(
              `[FirebasePush] Failed to send notification to token ${token}: ${sendResponse.error.message}`,
            );
          }
        }
      }

      await removeInvalidTokens(tokensToRemove);

      if (shouldAbortDueToServiceAuthError) {
        // Abort further processing; configuration must be fixed before retrying.
        return;
      }
    } catch (error) {
      const errorCode = getFirebaseErrorCode(error);

      if (errorCode && SERVICE_AUTH_ERRORS.has(errorCode)) {
        const message = SERVICE_AUTH_ERRORS.get(errorCode);

        if (message) {
          strapi.log.error(`[FirebasePush] ${message} (code: ${errorCode}).`);
        }

        // Abort further processing; configuration must be fixed before retrying.
        return;
      }

      strapi.log.error('[FirebasePush] Unexpected error while sending push notification:', error);
    }
  }
};
