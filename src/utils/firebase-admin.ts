import fs from 'fs';
import path from 'path';
import admin, { ServiceAccount } from 'firebase-admin';

const FIREBASE_APP_NAME = 'guestspot-api';
const SERVICE_ACCOUNT_JSON_ENV_KEYS = ['FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT_JSON'];
const SERVICE_ACCOUNT_PATH_ENV_KEYS = ['FIREBASE_SERVICE_ACCOUNT_PATH', 'GOOGLE_APPLICATION_CREDENTIALS'];
const HARDCODED_SERVICE_ACCOUNT_BASE64 =
  'ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiZ3Vlc3RzcG90LTFlZWE5IiwKICAicHJpdmF0ZV9rZXlfaWQiOiAiMzc5OGViZTA5NTIyYTFkYzYyMTU0OTU1ZjkzZGEyOTQ3NjNkMjNlZCIsCiAgInByaXZhdGVfa2V5IjogIi0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLVxuTUlJRXZRSUJBREFOQmdrcWhraUc5dzBCQVFFRkFBU0NCS2N3Z2dTakFnRUFBb0lCQVFDbGt5VjhOK1VLZFRpR1xuQllwSGM5bkhvYnB3ZE1wWXVJVURKRFhESU9pZTJJT3dsbVNWNGZrSktzd1lZZ01NbnR5R0dGRU5KUnMwQUQzcFxuNFVtMmxwQnJ2R3FGbkh5WWZ0TnhkMi8rRlVKMENLVGsyaFBMbmNNQkJCNzd6ZUR5bjdHT2xmS1JpYU12ckE3bVxuMTN3K2p3eTNuMUZaVE8rQmNyY3Z0MTFaNjVCbmx5MTFCV2hnVm1uU3Q4eXc3S1pjeGNWbG0wWUpYZWJvYmIyclxuUHJsOWxiZjBvamswUEFkV1ZHQ1ZvOG4zMTJJaUQvUUFYellJYkxXOUtiZ1dHaitmUTVCOEc4YlFhN1g4ZnJ2NlxueGtYdDROdnd0SzdwblV2MmZmWjhHMWlIcEdnMVJ4WkJpV1Frb2hZMUh2NVc4REtKTDQ2SlppQ20zVHpyZ2RtRlxuTDM5QTluZjFBZ01CQUFFQ2dnRUFEVUZDNG5kZERDSEhOUjl6YXZYd3pNVDdObTU3Rm5BckljMi95Zyt6MzZlSVxubjFYaTFvYmhGMlZJTW5tQ01mdnp2bjVxMnFrS1RQYnAvZk90b1lMYksrekpBRW8vUlR2OTlGcng2YjdNODVvUFxualV5U0FoNXVrb0hBY3pzUGs0ektPNVp3ZFVzMTk2YUlDTjNlVWVuRXhGeHFPRUpxK0F0MWM4bnpuTE81ZXpsalxuWUFFZGE5L0YwTEhxMERpVmJCMTd0R2NBSk9CN3V2NTdSN1FJU0pnWHFmb1pjN3hiVG9wbm1VTm5DeXhoc1VFN1xuWGpTckprNzRLZURzRUF4b2lJdy90TXdBR2dFUzJkdVE1SjZWc0EwYy9kRVU3elpwcEt1UitOMVJWeWhhWEQ3MVxuakJGb0hSbUd6ZmFyY3Bkbk9FSC9BL3UrQmNxMlhlTHJRRzJSWjlVeS93S0JnUURsU3Vad1VrWXdpTjUwWUErUlxud2M5RzBWckRXWmVObldBVGFqMWRsQTFELy9HRS9OQ2NiMmNpOEkyVDBpR01MVEttSFlVQks3dXdBeURLUmhZM1xuQVlOUUFuUjhWaXI1Rm0zVFUwY0hzQ3B2c240eXlGalJmY29jSWhhQVc2SFZKTnhIejZVUFlwOXdTQnFjZ3VLTVxuRHltb1JEeFhabU9MV3FVU0RRSlNXL3dTcndLQmdRQzQzRXRaNDJoV1dOM0k3VHI2ZDFqNGJLVXlEMDdlMGZ2cVxuTnVPOXorWEl1NWFCTy8zQUFTcjFmbjJFek52NXBKbndBam0wU2pSdFdWNXhybE1aM2YvZURmcDlpbXR3cVNaMlxudGRHOVVjMGNNdnlOdXZvNFpsaHQrMzF1QzVPanNyMmU1TFVkRlVWdGtab2N1UUVMMEprbDAyOXFYcEh2ekdDd1xuTFhUakRJVlltd0tCZ1FDVkNITHhUTGlzY1RuT0FHWCtRaStjZ3hUd1pqbzRaTEwreTQzcFZnS3RVUjFGYUNHYlxubkZrMy80eTJLTjEvUkIxb2xVVk85b0wrcTNuVG4yeHZBais4Y0d3UUtOMnpteDExUHVxckY1anRrdUd0MWtUTVxubldzUmtDSjUrWlVkZWVEbm1CSmNCcWxGRE1pbk0vZFdPOERDeXQ5Qm01NVdCR3ZJYU1ZNmkra3lwd0tCZ0dYblxuVWtaUDNMRlV0WlhRYUdXdnFzVHZKelZzU043OXhDKzlhRmUzSmdVOG0xL01VVG9wcXFPL3diT1dObURzZ3N0U1xuZnJySytSR2FaVHluaXpuRUxnc2JpNHp1NUFFcnpYODlCVXltcmptd1JaWmZqeFhPSFVzcmlsNUNWWFcwejJDcVxuMU1nZWRMSk14RGEzS1VONUR5TlI1YVl1VWFadDlKTEp6QmhwUzR5bkFvR0FYcmxmclVoUEJJYjhCOVEzZHdUaFxudW1hKzhSVklBOUloUXlnYW5VcWtlUDVuMU1CbzJzT1lrVkNCbjlJNk9wcnJMRmJVdkl5bERKa3BINFExemx2RVxudnl5QzFYMzc2ZnoxWHVYNXl5Q3FGQXUrV2xHbTV2dU1RMHJNbkk5TVFSVlVHeHNLa3M2Z2plUm9UNG4vZm5oelxuc01VTTUyUXRqNkxDcHgvdERZZC85OEE9XG4tLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tXG4iLAogICJjbGllbnRfZW1haWwiOiAiZmlyZWJhc2UtYWRtaW5zZGstZmJzdmNAZ3Vlc3RzcG90LTFlZWE5LmlhbS5nc2VydmljZWFjY291bnQuY29tIiwKICAiY2xpZW50X2lkIjogIjEwNTA5OTM3NTQ4MjMwNDY0MjY0OCIsCiAgImF1dGhfdXJpIjogImh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbS9vL29hdXRoMi9hdXRoIiwKICAidG9rZW5fdXJpIjogImh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwKICAiYXV0aF9wcm92aWRlcl94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL29hdXRoMi92MS9jZXJ0cyIsCiAgImNsaWVudF94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL3JvYm90L3YxL21ldGFkYXRhL3g1MDkvZmlyZWJhc2UtYWRtaW5zZGstZmJzdmMlNDBndWVzdHNwb3QtMWVlYTkuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K';

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

  if (HARDCODED_SERVICE_ACCOUNT_BASE64) {
    const fallbackJson =
      maybeDecodeBase64(HARDCODED_SERVICE_ACCOUNT_BASE64) ?? HARDCODED_SERVICE_ACCOUNT_BASE64;
    const fallback = tryParseJson(fallbackJson);

    if (fallback) {
      strapi.log.warn(
        '[FirebaseAdmin] Using hard-coded Firebase service account. Replace with env configuration as soon as possible.',
      );
      return fallback;
    }
  }

  strapi.log.warn('[FirebaseAdmin] Firebase service account credentials are not configured.');

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
