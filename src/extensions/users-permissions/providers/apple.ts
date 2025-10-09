import type { Core } from '@strapi/strapi';
import jwt, { type JwtHeader } from 'jsonwebtoken';
import { createPublicKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type AppleProviderRuntimeConfig = {
  enabled: boolean;
  clientId?: string;
  keyId?: string;
  teamId?: string;
  privateKey?: string;
  privateKeyPath?: string;
  scope: string[];
  redirectUri?: string;
  audience: string;
  responseMode: string;
  responseType: string;
};

type AppleProviderStoreConfig = Record<string, unknown>;

type AppleUserProfile = {
  email?: string;
  name?: {
    firstName?: string;
    lastName?: string;
  };
};

type AppleIdTokenPayload = {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
};

type AppleTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
};

type AppleTokenError = {
  error: string;
  error_description?: string;
};

type AppleJwk = {
  kid: string;
  alg: string;
  [key: string]: unknown;
};

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_KEY_CACHE_TTL_MS = 60 * 60 * 1000;

let appleKeyCache: { keys: AppleJwk[]; expiresAt: number } | undefined;

const getString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = getString(item);
      if (resolved) {
        return resolved;
      }
    }
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('value' in record) {
      return getString(record.value);
    }
  }

  return undefined;
};

const normalizeScope = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => getString(entry))
      .filter(Boolean) as string[];
  }

  if (typeof value === 'string') {
    return value
      .split(/[\s,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
};

const pickString = (...inputs: unknown[]) => {
  for (const input of inputs) {
    const result = getString(input);
    if (result) {
      return result;
    }
  }
  return undefined;
};

const isJwt = (token: string | undefined): token is string => {
  if (!token) {
    return false;
  }
  return token.split('.').length === 3;
};

const parseAppleUser = (input: unknown): AppleUserProfile | undefined => {
  const raw = getString(input);

  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as AppleUserProfile;
    }
  } catch {
    // ignore parsing issues, Apple only sends the payload once
  }

  return undefined;
};

const buildDisplayName = (
  profile: AppleUserProfile | undefined,
  fallbackEmail: string | undefined,
  subject: string
) => {
  const firstName = profile?.name?.firstName?.trim();
  const lastName = profile?.name?.lastName?.trim();

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  if (fullName) {
    return fullName;
  }

  if (profile?.email) {
    return profile.email.split('@')[0];
  }

  if (fallbackEmail) {
    return fallbackEmail.split('@')[0];
  }

  return subject;
};

const resolvePrivateKey = async ({
  configuredKey,
  keyPath,
  appDir,
}: {
  configuredKey?: string;
  keyPath?: string;
  appDir: string;
}) => {
  if (configuredKey && configuredKey.trim()) {
    return configuredKey.replace(/\\n/g, '\n').trim();
  }

  if (keyPath && keyPath.trim()) {
    const absolutePath = path.isAbsolute(keyPath) ? keyPath : path.join(appDir, keyPath);
    const fileContents = await readFile(absolutePath, 'utf8');
    return fileContents.toString().trim();
  }

  throw new Error('Apple Sign-In private key is not configured');
};

const createClientSecret = ({
  teamId,
  keyId,
  privateKey,
  clientId,
  audience,
}: {
  teamId: string;
  keyId: string;
  privateKey: string;
  clientId: string;
  audience: string;
}) => {
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iss: teamId,
      iat: now,
      exp: now + 60 * 5,
      aud: audience,
      sub: clientId,
    },
    privateKey,
    {
      algorithm: 'ES256',
      keyid: keyId,
    }
  );
};

const fetchAppleKeys = async (): Promise<AppleJwk[]> => {
  if (appleKeyCache && appleKeyCache.expiresAt > Date.now()) {
    return appleKeyCache.keys;
  }

  const response = await fetch(APPLE_KEYS_URL);

  if (!response.ok) {
    throw new Error(`Unable to load Apple public keys (${response.status})`);
  }

  const payload = (await response.json()) as { keys: AppleJwk[] };

  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new Error('Apple public keys response was invalid');
  }

  appleKeyCache = {
    keys: payload.keys,
    expiresAt: Date.now() + APPLE_KEY_CACHE_TTL_MS,
  };

  return appleKeyCache.keys;
};

const verifyAppleIdToken = async ({
  idToken,
  audience,
}: {
  idToken: string;
  audience: string;
}): Promise<AppleIdTokenPayload> => {
  const decoded = jwt.decode(idToken, { complete: true });

  if (!decoded || typeof decoded === 'string') {
    throw new Error('Failed to decode Apple identity token');
  }
  const header = decoded.header as JwtHeader;
  const kid = typeof header.kid === 'string' ? header.kid.trim() : undefined;

  if (!kid) {
    throw new Error('Apple identity token does not contain a key identifier');
  }

  const keys = await fetchAppleKeys();
  const jwk = keys.find((key) => key.kid === kid);

  if (!jwk) {
    throw new Error('Unable to verify Apple identity token signature');
  }

  const pem = createPublicKey({ key: jwk as any, format: 'jwk' })
    .export({ format: 'pem', type: 'spki' })
    .toString();

  const verified = jwt.verify(idToken, pem, {
    algorithms: ['RS256'],
    audience,
    issuer: 'https://appleid.apple.com',
  });

  return verified as AppleIdTokenPayload;
};

const requestAppleTokens = async ({
  code,
  clientId,
  clientSecret,
  redirectUri,
}: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}): Promise<AppleTokenResponse> => {
  const payload = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
  });

  if (redirectUri) {
    payload.append('redirect_uri', redirectUri);
  }

  const response = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  });

  const data = (await response.json()) as AppleTokenResponse | AppleTokenError;

  if (!response.ok || 'error' in data) {
    const errorMessage =
      (data as AppleTokenError).error_description ??
      (data as AppleTokenError).error ??
      'Apple token exchange failed';
    throw new Error(errorMessage);
  }

  return data as AppleTokenResponse;
};

const resolveRuntimeConfig = ({
  baseConfig,
  providerConfig,
  appDir,
}: {
  baseConfig: AppleProviderRuntimeConfig;
  providerConfig?: AppleProviderStoreConfig;
  appDir: string;
}): AppleProviderRuntimeConfig & { appDir: string } => {
  const merged = { ...baseConfig };

  if (providerConfig) {
    const key = getString(providerConfig.key);
    const clientId = getString(providerConfig.clientId);
    const teamId = getString(providerConfig.teamId);
    const keyId = getString(providerConfig.keyId);
    const redirectUri =
      getString(providerConfig.redirectUri) ??
      getString(providerConfig.callbackUrl) ??
      getString(providerConfig.callback);

    const scoped = normalizeScope(providerConfig.scope);
    if (scoped.length) {
      merged.scope = scoped;
    }

    merged.clientId = key ?? clientId ?? merged.clientId;
    merged.teamId = teamId ?? merged.teamId;
    merged.keyId = keyId ?? merged.keyId;
    merged.redirectUri = redirectUri ?? merged.redirectUri;

    const privateKey = getString(providerConfig.privateKey);
    if (privateKey) {
      merged.privateKey = privateKey;
    }

    const privateKeyPath = getString(providerConfig.privateKeyPath);
    if (privateKeyPath) {
      merged.privateKeyPath = privateKeyPath;
    }
  }

  return { ...merged, appDir };
};

const resolveAppleProfile = async ({
  accessToken,
  query,
  config,
}: {
  accessToken?: string;
  query: Record<string, unknown>;
  config: AppleProviderRuntimeConfig & { appDir: string };
}) => {
  const clientId = getString(config.clientId);
  const teamId = getString(config.teamId);
  const keyId = getString(config.keyId);

  if (!clientId || !teamId || !keyId) {
    throw new Error('Apple Sign-In is missing client credentials in configuration');
  }

  const appleUser = parseAppleUser(query.user);
  const code = pickString(
    query.code,
    query.authorizationCode,
    query.authorization_code,
    query.token,
    query.access_token,
    accessToken
  );

  let idToken = pickString(
    query.id_token,
    query.identity_token,
    query.token,
    isJwt(accessToken ?? '') ? accessToken : undefined
  );

  const privateKey = await resolvePrivateKey({
    configuredKey: config.privateKey,
    keyPath: config.privateKeyPath,
    appDir: config.appDir,
  });

  if (code && !isJwt(code)) {
    const clientSecret = createClientSecret({
      teamId,
      keyId,
      privateKey,
      clientId,
      audience: config.audience,
    });

    const tokenResponse = await requestAppleTokens({
      code,
      clientId,
      clientSecret,
      redirectUri: config.redirectUri,
    });

    idToken = tokenResponse.id_token;
  }

  if (!idToken || !isJwt(idToken)) {
    throw new Error('Unable to retrieve a valid Apple identity token');
  }

  const payload = await verifyAppleIdToken({
    idToken,
    audience: config.audience || clientId,
  });

  const email = appleUser?.email ?? payload.email;

  if (!email) {
    throw new Error('Apple did not provide an email address for this account');
  }

  const username = buildDisplayName(appleUser, payload.email, payload.sub);

  return {
    email,
    username,
  };
};

export const registerAppleAuthProvider = ({ strapi }: { strapi: Core.Strapi }) => {
  const providersRegistry = strapi.service('plugin::users-permissions.providers-registry');
  const providersService = strapi.service('plugin::users-permissions.providers');

  const rawConfig =
    (strapi.config.get('plugin::users-permissions.providers.apple') as Record<string, unknown>) ||
    {};

  const baseScope = normalizeScope(rawConfig.scope);

  const normalizedConfig: AppleProviderRuntimeConfig = {
    enabled: rawConfig.enabled === true,
    clientId: getString(rawConfig.key) ?? getString(rawConfig.clientId),
    keyId: getString(rawConfig.keyId),
    teamId: getString(rawConfig.teamId),
    privateKey: getString(rawConfig.privateKey),
    privateKeyPath: getString(rawConfig.privateKeyPath),
    scope: baseScope.length ? baseScope : ['name', 'email'],
    redirectUri:
      getString(rawConfig.redirectUri) ??
      getString(rawConfig.callbackUrl) ??
      providersService.buildRedirectUri('apple'),
    audience: getString(rawConfig.audience) ?? 'https://appleid.apple.com',
    responseMode: getString(rawConfig.responseMode) ?? 'form_post',
    responseType: getString(rawConfig.responseType) ?? 'code',
  };

  providersRegistry.add('apple', {
    enabled: normalizedConfig.enabled,
    icon: 'apple',
    grantConfig: {
      key: normalizedConfig.clientId,
      callbackUrl: normalizedConfig.redirectUri,
      scope: normalizedConfig.scope,
      keyId: normalizedConfig.keyId,
      teamId: normalizedConfig.teamId,
      privateKey: normalizedConfig.privateKey,
      privateKeyPath: normalizedConfig.privateKeyPath,
      audience: normalizedConfig.audience,
      responseMode: normalizedConfig.responseMode,
      responseType: normalizedConfig.responseType,
      custom_params: {
        response_mode: normalizedConfig.responseMode,
        response_type: normalizedConfig.responseType,
        scope: normalizedConfig.scope.join(' '),
      },
    },
    async authCallback({ accessToken, query, providers }) {
      const runtimeConfig = resolveRuntimeConfig({
        baseConfig: normalizedConfig,
        providerConfig: providers?.apple as AppleProviderStoreConfig | undefined,
        appDir: strapi.dirs?.app?.root ?? process.cwd(),
      });

      return resolveAppleProfile({
        accessToken,
        query,
        config: runtimeConfig,
      });
    },
  });
};
