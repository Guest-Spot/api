import { factories } from '@strapi/strapi';

type UserId = number | string;
type UserReference = { id?: UserId; documentId?: string } | null;

type DeviceTokenInput = {
  token?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  publishedAt?: string | Date | null;
  user?: unknown;
};

type DeviceTokenEntity = {
  id: UserId;
  token?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  publishedAt?: string | Date | null;
  user?: { id?: UserId } | null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const numericValue = Number(trimmed);

    return Number.isFinite(numericValue) ? numericValue : null;
  }

  return null;
};

const normalizeUserId = (value: unknown): UserId | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const numericValue = toNumber(trimmed);

    if (numericValue !== null) {
      return numericValue;
    }

    return trimmed;
  }

  return null;
};

const extractUserReference = (data: Record<string, any>, ctx: any): UserReference => {
  const stateUser = ctx?.state?.user as Record<string, unknown> | undefined;

  const stateId = normalizeUserId(stateUser?.id);

  if (stateId !== null) {
    return { id: stateId };
  }

  const stateDocumentId = typeof stateUser?.documentId === 'string' ? stateUser.documentId.trim() : null;

  if (stateDocumentId) {
    return { documentId: stateDocumentId };
  }

  const userInput = data?.user;

  if (!userInput) {
    return null;
  }

  const resolve = (input: unknown): UserReference => {
    if (!input) {
      return null;
    }

    if (typeof input === 'object') {
      const candidate = input as Record<string, unknown>;
      const documentIdValue = candidate.documentId;

      if (typeof documentIdValue === 'string' && documentIdValue.trim()) {
        return { documentId: documentIdValue.trim() };
      }

      const idValue = normalizeUserId(candidate.id);

      if (idValue !== null) {
        return { id: idValue };
      }
    }

    const numericId = toNumber(input);

    if (numericId !== null) {
      return { id: numericId };
    }

    if (typeof input === 'string' && input.trim()) {
      return { documentId: input.trim() };
    }

    return null;
  };

  const connectInput = (userInput as Record<string, unknown>)?.connect;

  if (Array.isArray(connectInput) && connectInput.length > 0) {
    for (const candidate of connectInput) {
      const reference = resolve(candidate);

      if (reference) {
        return reference;
      }
    }
  }

  return resolve(userInput);
};

export default factories.createCoreController('api::device-token.device-token', ({ strapi }) => ({
  async create(ctx) {
    const body = (ctx.request?.body ?? {}) as Record<string, unknown>;
    const rawData = ((body.data ?? body) as DeviceTokenInput & Record<string, any>) ?? {};

    await this.validateInput(rawData, ctx);
    const sanitizedData = (await this.sanitizeInput(rawData, ctx)) as DeviceTokenInput & Record<string, any>;

    const tokenCandidate =
      typeof sanitizedData.token === 'string' && sanitizedData.token
        ? sanitizedData.token
        : typeof rawData.token === 'string'
          ? rawData.token
          : null;
    const token = tokenCandidate ? tokenCandidate.trim() : '';

    if (!token) {
      return super.create(ctx);
    }

    const userReference = extractUserReference(rawData, ctx);

    const filters: Record<string, unknown> = { token };

    if (userReference?.id !== undefined) {
      const normalizedId = normalizeUserId(userReference.id);

      if (normalizedId !== null) {
        filters.user = { id: normalizedId };
      }
    } else if (userReference?.documentId) {
      filters.user = { documentId: userReference.documentId };
    }

    const existingEntries = (await strapi.entityService.findMany(
      'api::device-token.device-token',
      {
        filters,
        publicationState: 'preview',
        populate: { user: true },
        limit: 1,
      },
    )) as DeviceTokenEntity[];

    if (existingEntries.length === 0) {
      return super.create(ctx);
    }

    const existingToken = existingEntries[0];
    const updates: Record<string, unknown> = {};

    if (sanitizedData.platform !== undefined && sanitizedData.platform !== existingToken.platform) {
      updates.platform = sanitizedData.platform;
    }

    if (sanitizedData.appVersion !== undefined && sanitizedData.appVersion !== existingToken.appVersion) {
      updates.appVersion = sanitizedData.appVersion;
    }

    if (sanitizedData.publishedAt !== undefined && sanitizedData.publishedAt !== existingToken.publishedAt) {
      updates.publishedAt = sanitizedData.publishedAt;
    }

    let userIdForUpdate: UserId | null = null;

    if (userReference?.id !== undefined) {
      userIdForUpdate = normalizeUserId(userReference.id);
    } else if (userReference?.documentId) {
      const query = {
        filters: { documentId: userReference.documentId },
        publicationState: 'preview',
        limit: 1,
        fields: ['id'],
      };

      const [userByDocumentId] = (await strapi.entityService.findMany(
        'plugin::users-permissions.user',
        query as any,
      )) as Array<{ id?: UserId }>;

      const normalizedId = normalizeUserId(userByDocumentId?.id);

      if (normalizedId !== null) {
        userIdForUpdate = normalizedId;
      }
    }

    const existingUserId = normalizeUserId(existingToken.user?.id);

    if (
      userIdForUpdate !== null &&
      (existingUserId === null || existingUserId !== userIdForUpdate)
    ) {
      updates.user = userIdForUpdate;
    }

    let finalToken: DeviceTokenEntity = existingToken;

    if (Object.keys(updates).length > 0) {
      finalToken = (await strapi.entityService.update(
        'api::device-token.device-token',
        existingToken.id,
        {
          data: updates,
          populate: { user: true },
        },
      )) as DeviceTokenEntity;
    }

    const sanitizedEntity = await this.sanitizeOutput(finalToken, ctx);
    return this.transformResponse(sanitizedEntity);
  },
}));
