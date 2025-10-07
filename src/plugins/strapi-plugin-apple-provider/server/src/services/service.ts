import path from 'node:path';
import { promises as fs } from 'node:fs';

import type { Core } from '@strapi/strapi';

type StoredSettings = {
  redirectUrl: string;
  authKeyFilename: string | null;
};

type SettingsInput = {
  redirectUrl?: unknown;
  authKey?: unknown;
};

type UploadedFile = {
  filepath: string;
  originalFilename?: string;
  newFilename?: string;
  mimetype?: string;
  size: number;
};

const SETTINGS_KEY = 'settings';

const getDefaultSettings = (): StoredSettings => ({
  redirectUrl: '',
  authKeyFilename: null,
});

const normalizeSettings = (value: Partial<StoredSettings> | null | undefined): StoredSettings => ({
  redirectUrl: value?.redirectUrl ?? '',
  authKeyFilename: value?.authKeyFilename ?? null,
});

const service = ({ strapi }: { strapi: Core.Strapi }) => {
  const getPluginStore = () =>
    strapi.store({
      type: 'plugin',
      name: 'strapi-plugin-apple-provider',
      key: SETTINGS_KEY,
    });

  const getAppRoot = () => strapi.dirs?.app?.root ?? process.cwd();

  const copyUploadedFile = async (fileInput: UploadedFile | UploadedFile[] | undefined | null) => {
    if (!fileInput) {
      return null;
    }

    const file = Array.isArray(fileInput) ? fileInput[0] : fileInput;

    if (!file) {
      return null;
    }

    const candidateName =
      file.originalFilename ?? file.newFilename ?? `AuthKey_${Date.now().toString(36)}.p8`;
    const safeFilename = path.basename(candidateName);

    if (!safeFilename.toLowerCase().endsWith('.p8')) {
      const error = new Error('Uploaded file must have the .p8 extension.');
      // @ts-expect-error custom status for downstream usage
      error.status = 400;
      throw error;
    }

    const destinationPath = path.join(getAppRoot(), safeFilename);
    await fs.copyFile(file.filepath, destinationPath);

    try {
      await fs.chmod(destinationPath, 0o600);
    } catch {
      // noop if chmod fails (e.g. on Windows)
    }

    try {
      await fs.unlink(file.filepath);
    } catch {
      // ignore temporary file cleanup issues
    }

    return safeFilename;
  };

  const removePreviousFile = async (filename: string | null | undefined, keepFilename: string) => {
    if (!filename || filename === keepFilename) {
      return;
    }

    const previousPath = path.join(getAppRoot(), filename);

    try {
      await fs.unlink(previousPath);
    } catch {
      // ignore missing file errors
    }
  };

  const validateRedirectUrl = (value: unknown) => {
    if (value === undefined || value === null || value === '') {
      return '';
    }

    if (typeof value !== 'string') {
      const error = new Error('Redirect URL must be a string.');
      // @ts-expect-error custom status for downstream usage
      error.status = 400;
      throw error;
    }

    const trimmed = value.trim();

    if (trimmed === '') {
      return '';
    }

    try {
      // eslint-disable-next-line no-new
      new URL(trimmed);
    } catch {
      const error = new Error('Redirect URL must be a valid absolute URL.');
      // @ts-expect-error custom status for downstream usage
      error.status = 400;
      throw error;
    }

    return trimmed;
  };

  return {
    async getSettings(): Promise<StoredSettings> {
      const pluginStore = getPluginStore();
      const storedValue = await pluginStore.get();

      if (!storedValue) {
        const defaults = getDefaultSettings();
        await pluginStore.set({ value: defaults });
        return defaults;
      }

      return normalizeSettings(storedValue);
    },

    async updateSettings({ redirectUrl, authKey }: SettingsInput): Promise<StoredSettings> {
      const pluginStore = getPluginStore();
      const currentSettings = normalizeSettings(await pluginStore.get());

      const nextRedirectUrl = validateRedirectUrl(redirectUrl);
      let nextAuthKeyFilename = currentSettings.authKeyFilename;

      if (authKey) {
        const newFilename = await copyUploadedFile(authKey as UploadedFile | UploadedFile[]);

        if (newFilename) {
          await removePreviousFile(currentSettings.authKeyFilename, newFilename);
          nextAuthKeyFilename = newFilename;
        }
      }

      const mergedSettings: StoredSettings = {
        redirectUrl: nextRedirectUrl,
        authKeyFilename: nextAuthKeyFilename,
      };

      await pluginStore.set({ value: mergedSettings });

      return mergedSettings;
    },

    async callback(ctx) {
      const codeFromRequest =
        (ctx.request.query?.code as string | undefined) ??
        (ctx.request.body?.code as string | undefined);

      if (!codeFromRequest) {
        ctx.throw(400, 'Missing authorization code.');
      }

      const settings = await this.getSettings();

      const redirectBase =
        settings.redirectUrl || (strapi.config.get('custom.siteBaseUrl') as string | undefined);

      if (!redirectBase) {
        ctx.throw(500, 'Redirect URL is not configured.');
      }

      const redirectUrlObject = new URL(redirectBase);
      redirectUrlObject.searchParams.set('code', codeFromRequest);

      ctx.redirect(redirectUrlObject.toString());
    },
  };
};

export default service;
