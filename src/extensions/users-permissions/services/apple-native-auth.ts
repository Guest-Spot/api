import type { Core } from '@strapi/strapi';
import jwt, { type JwtHeader } from 'jsonwebtoken';
import { createPublicKey } from 'node:crypto';

type AppleIdentityTokenPayload = {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
};

type AppleJwk = {
  kid: string;
  alg: string;
  [key: string]: unknown;
};

export type AppleNativeAuthInput = {
  identityToken: string;
};

const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';
const KEY_CACHE_TTL_MS = 60 * 60 * 1000;

let cachedAppleKeys: { keys: AppleJwk[]; expiresAt: number } | undefined;

const getString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = getString(entry);
      if (candidate) {
        return candidate;
      }
    }
  }

  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    return getString((value as Record<string, unknown>).value);
  }

  return undefined;
};

const fetchAppleKeys = async (): Promise<AppleJwk[]> => {
  if (cachedAppleKeys && cachedAppleKeys.expiresAt > Date.now()) {
    return cachedAppleKeys.keys;
  }

  const response = await fetch(APPLE_KEYS_URL);

  if (!response.ok) {
    throw new Error(`Unable to load Apple public keys (${response.status})`);
  }

  const payload = (await response.json()) as { keys: AppleJwk[] };

  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new Error('Apple public keys response was invalid');
  }

  cachedAppleKeys = {
    keys: payload.keys,
    expiresAt: Date.now() + KEY_CACHE_TTL_MS,
  };

  return cachedAppleKeys.keys;
};

const normalizeAudienceList = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => getString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  const str = getString(value);

  if (!str) {
    return [];
  }

  return str
    .split(/[\s,]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
};

const resolveAppleConfig = (strapi: Core.Strapi) => {
  const rawConfig =
    (strapi.config.get('plugin::users-permissions.providers.apple') as Record<string, unknown> | undefined) ||
    {};

  const clientId =
    getString(rawConfig.key) ?? getString(rawConfig.clientId) ?? 'com.guestspot.service';

  const primaryAudience = getString(rawConfig.audience);

  const nativeAudience = getString(rawConfig.nativeClientId) ?? getString(rawConfig.bundleId);

  const configuredAudiences = normalizeAudienceList(
    rawConfig.allowedAudiences ?? rawConfig.additionalAudiences ?? rawConfig.audiences
  );

  const audiencesSet = new Set<string>();

  [clientId, primaryAudience, nativeAudience, ...configuredAudiences].forEach((entry) => {
    if (entry) {
      audiencesSet.add(entry);
    }
  });

  if (!audiencesSet.size) {
    audiencesSet.add('https://appleid.apple.com');
  }

  const audiences = Array.from(audiencesSet);

  return {
    clientId,
    audiences,
  };
};

const verifyIdentityToken = async ({
  identityToken,
  audience,
}: {
  identityToken: string;
  audience: string | [string, ...string[]];
}): Promise<AppleIdentityTokenPayload> => {
  const decoded = jwt.decode(identityToken, { complete: true });

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

  const verified = jwt.verify(identityToken, pem, {
    algorithms: ['RS256'],
    audience,
    issuer: APPLE_ISSUER,
  });

  return verified as AppleIdentityTokenPayload;
};

const resolveDisplayName = ({ email, sub }: { email?: string; sub: string }) => {
  if (email) {
    return email.split('@')[0];
  }

  return `apple-${sub.slice(0, 8)}`;
};

const normalizeEmail = (email?: string | null) => {
  return email ? email.trim().toLowerCase() : undefined;
};

export const ensureAppleUser = async (
  strapi: Core.Strapi,
  input: AppleNativeAuthInput
) => {
  const { identityToken } = input;

  if (!identityToken || typeof identityToken !== 'string') {
    throw new Error('Missing Apple identity token');
  }

  const { clientId, audiences: expectedAudiences } = resolveAppleConfig(strapi);

  if (!expectedAudiences.length) {
    throw new Error('Apple Sign-In audience is not configured');
  }

  const audienceForVerification =
    expectedAudiences.length === 1
      ? expectedAudiences[0]
      : ([expectedAudiences[0], ...expectedAudiences.slice(1)] as [string, ...string[]]);

  const payload = await verifyIdentityToken({
    identityToken,
    audience: audienceForVerification,
  });

  if (typeof payload.aud === 'string' && !expectedAudiences.includes(payload.aud)) {
    throw new Error(
      `Apple identity token audience mismatch (got "${payload.aud}", expected one of: ${expectedAudiences.join(
        ', '
      )})`
    );
  }

  if (!payload.sub) {
    throw new Error('Apple identity token payload is missing subject');
  }

  const normalizedEmail = normalizeEmail(payload.email);

  const displayName = resolveDisplayName({
    email: normalizedEmail,
    sub: payload.sub,
  });

  const userQuery = strapi.db.query('plugin::users-permissions.user');

  let user = await userQuery.findOne({
    where: { appleSub: payload.sub },
  });

  if (!user && normalizedEmail) {
    user = await userQuery.findOne({
      where: { email: normalizedEmail },
    });
  }

  const advancedSettings = (await strapi
    .store({ type: 'plugin', name: 'users-permissions', key: 'advanced' })
    .get()) as {
    allow_register: boolean;
    unique_email: boolean;
    default_role: string;
  };

  if (!user && advancedSettings && advancedSettings.allow_register === false) {
    throw new Error('Register action is currently disabled');
  }

  const defaultRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: advancedSettings.default_role } });

  if (!defaultRole) {
    throw new Error('Default role not found');
  }

  const effectiveEmail = normalizedEmail ?? `${payload.sub}@apple.local`;
  const username = normalizedEmail ?? `apple-${payload.sub}`;

  if (user) {
    const updates: Record<string, unknown> = {};

    if (!user.appleSub) {
      updates.appleSub = payload.sub;
    }

    if (normalizedEmail && user.email !== normalizedEmail) {
      if (advancedSettings?.unique_email) {
        const conflicts = await userQuery.findMany({
          where: { email: normalizedEmail },
        });

        const conflict = conflicts.find((candidate) => candidate.id !== user.id);

        if (conflict) {
          throw new Error('Email is already taken');
        }
      }

      updates.email = normalizedEmail;
    }

    if (!user.provider || user.provider !== 'apple') {
      updates.provider = 'apple';
    }

    if (!user.confirmed) {
      updates.confirmed = true;
    }

    if (!user.role) {
      updates.role = defaultRole.id;
    }

    if (displayName && user.name !== displayName) {
      updates.name = displayName;
    }

    if (Object.keys(updates).length > 0) {
      user = await strapi.entityService.update(
        'plugin::users-permissions.user',
        user.id,
        {
          data: updates,
        }
      );
    }
  } else {
    const newUserData: Record<string, unknown> = {
      email: effectiveEmail,
      username,
      provider: 'apple',
      confirmed: true,
      role: defaultRole.id,
      appleSub: payload.sub,
    };

    if (displayName) {
      newUserData.name = displayName;
    }

    user = await strapi.entityService.create('plugin::users-permissions.user', {
      data: newUserData as any,
    });
  }

  return {
    user,
  };
};
