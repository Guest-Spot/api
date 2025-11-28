import fs from 'fs';
import path from 'path';
import admin, { ServiceAccount } from 'firebase-admin';

const FIREBASE_APP_NAME = 'guestspot-api';
const SERVICE_ACCOUNT_JSON_ENV_KEYS = ['FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT_JSON'];
const SERVICE_ACCOUNT_PATH_ENV_KEYS = ['FIREBASE_SERVICE_ACCOUNT_PATH', 'GOOGLE_APPLICATION_CREDENTIALS'];

type RawServiceAccount = Record<string, unknown>;

const normalizeServiceAccount = (raw: RawServiceAccount): ServiceAccount | null => {
  if (!raw) {
    return null;
  }

  const normalized: RawServiceAccount = { ...raw };

  if (normalized.private_key && !normalized.privateKey) {
    normalized.privateKey = normalized.private_key;
  }

  if (typeof normalized.privateKey === 'string') {
    normalized.privateKey = normalized.privateKey.replace(/\\n/g, '\n');
  }

  if (!normalized.projectId && typeof normalized.project_id === 'string') {
    normalized.projectId = normalized.project_id;
  }

  if (!normalized.clientEmail && typeof normalized.client_email === 'string') {
    normalized.clientEmail = normalized.client_email;
  }

  const { projectId, clientEmail, privateKey } = normalized;

  if (
    typeof projectId !== 'string' ||
    typeof clientEmail !== 'string' ||
    typeof privateKey !== 'string'
  ) {
    strapi.log.error('[FirebaseAdmin] Service account JSON is missing required fields.');
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
};

const tryParseJson = (raw: string): ServiceAccount | null => {
  try {
    const parsed = JSON.parse(raw) as RawServiceAccount;
    return normalizeServiceAccount(parsed);
  } catch (error) {
    strapi.log.error('[FirebaseAdmin] Failed to parse service account JSON:', error);
    return null;
  }
};

const maybeDecodeBase64 = (raw: string): string | null => {
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    return decoded.trim().startsWith('{') ? decoded : null;
  } catch {
    return null;
  }
};

const readFileContent = (filePath: string): string | null => {
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(strapi.dirs.app.root, filePath);

  try {
    if (!fs.existsSync(resolvedPath)) {
      strapi.log.warn(`[FirebaseAdmin] Service account file not found at path: ${resolvedPath}`);
      return null;
    }

    return fs.readFileSync(resolvedPath, 'utf-8');
  } catch (error) {
    strapi.log.error(`[FirebaseAdmin] Failed to read service account file at ${resolvedPath}:`, error);
    return null;
  }
};

const loadServiceAccountFromEnvString = (): ServiceAccount | null => {
  for (const envKey of SERVICE_ACCOUNT_JSON_ENV_KEYS) {
    const rawValue = process.env[envKey];

    if (!rawValue) {
      continue;
    }

    const trimmed = rawValue.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith('{')) {
      const parsed = tryParseJson(trimmed);
      if (parsed) {
        return parsed;
      }
    }

    const decoded = maybeDecodeBase64(trimmed);

    if (decoded) {
      const parsed = tryParseJson(decoded);
      if (parsed) {
        return parsed;
      }
    }

    const fileContent = readFileContent(trimmed);

    if (fileContent) {
      const parsed = tryParseJson(fileContent);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
};

const loadServiceAccountFromFile = (): ServiceAccount | null => {
  for (const envKey of SERVICE_ACCOUNT_PATH_ENV_KEYS) {
    const filePath = process.env[envKey];

    if (!filePath) {
      continue;
    }

    const content = readFileContent(filePath);

    if (!content) {
      continue;
    }

    const parsed = tryParseJson(content);

    if (parsed) {
      return parsed;
    }
  }

  return null;
};

const loadServiceAccount = (): ServiceAccount | null => {
  const fromString = loadServiceAccountFromEnvString();

  if (fromString) {
    return fromString;
  }

  const fromFile = loadServiceAccountFromFile();

  if (fromFile) {
    return fromFile;
  }

  if (process.env.SERVICE_ACCOUNT_BASE64) {
    const fallbackJson =
      maybeDecodeBase64(process.env.SERVICE_ACCOUNT_BASE64) ?? process.env.SERVICE_ACCOUNT_BASE64;
    const fallback = tryParseJson(fallbackJson);

    if (fallback) {
      strapi.log.warn(
        '[FirebaseAdmin] Using hard-coded Firebase service account. Replace with env configuration as soon as possible.',
      );
      return fallback;
    }
  }

  strapi.log.warn('[FirebaseAdmin] Firebase service account credentials are not configured. SERVICE_ACCOUNT_BASE64 is not set.');

  return null;
};

export const getFirebaseApp = (): admin.app.App | null => {
  const existing = admin.apps.find((app) => app.name === FIREBASE_APP_NAME);

  if (existing) {
    return existing;
  }

  const serviceAccount = loadServiceAccount();

  if (!serviceAccount) {
    return null;
  }

  try {
    return admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
      },
      FIREBASE_APP_NAME,
    );
  } catch (error) {
    strapi.log.error('[FirebaseAdmin] Failed to initialize Firebase app:', error);
    return null;
  }
};

export const getFirebaseMessaging = (): admin.messaging.Messaging | null => {
  const app = getFirebaseApp();

  if (!app) {
    return null;
  }

  try {
    return app.messaging();
  } catch (error) {
    strapi.log.error('[FirebaseAdmin] Failed to initialize Firebase messaging service:', error);
    return null;
  }
};
