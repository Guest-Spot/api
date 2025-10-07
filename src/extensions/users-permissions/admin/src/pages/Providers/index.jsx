import * as React from 'react';

import { useTracking, Layouts } from '@strapi/admin/strapi-admin';
import {
  IconButton,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
  VisuallyHidden,
  useCollator,
  Button,
  Modal,
  Grid,
  Flex,
  Field,
  TextInput,
  Toggle,
  Loader,
  Box,
  Breadcrumbs,
  Crumb,
} from '@strapi/design-system';
import { Pencil } from '@strapi/icons';
import {
  Page,
  useAPIErrorHandler,
  useNotification,
  useFetchClient,
  useRBAC,
} from '@strapi/strapi/admin';
import upperFirst from 'lodash/upperFirst';
import { useIntl } from 'react-intl';
import { useMutation, useQuery, useQueryClient } from 'react-query';

import FormModal from '../../components/FormModal';
import { PERMISSIONS } from '../../constants';
import forms from './utils/forms';

const pluginId = 'users-permissions';
const getTrad = (id) => `${pluginId}.${id}`;

const APPLE_PROVIDER_NAME = 'apple';
const APPLE_SETTINGS_ENDPOINT = '/strapi-plugin-apple-provider/settings';

const getAppleCallbackUrl = () => `${window.strapi.backendURL}/api/connect/${APPLE_PROVIDER_NAME}/callback`;

const createInitialAppleForm = () => ({
  enabled: false,
  clientId: '',
  teamId: '',
  keyId: '',
  redirectUrl: '',
  authKeyFilename: null,
});

export const ProvidersPage = () => {
  const { formatMessage, locale } = useIntl();
  const queryClient = useQueryClient();
  const { trackUsage } = useTracking();
  const [isOpen, setIsOpen] = React.useState(false);
  const [providerToEditName, setProviderToEditName] = React.useState(null);
  const { toggleNotification } = useNotification();
  const { get, post, put } = useFetchClient();
  const { formatAPIError } = useAPIErrorHandler();
  const formatter = useCollator(locale, {
    sensitivity: 'base',
  });

  const [appleForm, setAppleForm] = React.useState(createInitialAppleForm());
  const [appleSelectedFile, setAppleSelectedFile] = React.useState(null);
  const [isAppleLoading, setIsAppleLoading] = React.useState(false);
  const [isAppleSubmitting, setIsAppleSubmitting] = React.useState(false);

  const {
    isLoading: isLoadingPermissions,
    allowedActions: { canUpdate },
  } = useRBAC({ update: PERMISSIONS.updateProviders });

  const { isLoading: isLoadingData, data } = useQuery(
    ['users-permissions', 'get-providers'],
    async () => {
      const { data } = await get('/users-permissions/providers');

      return data;
    },
    {
      initialData: {},
    }
  );

  const submitMutation = useMutation((body) => put('/users-permissions/providers', body), {
    async onSuccess() {
      await queryClient.invalidateQueries(['users-permissions', 'get-providers']);

      toggleNotification({
        type: 'success',
        message: formatMessage({ id: getTrad('notification.success.submit') }),
      });

      trackUsage('didEditAuthenticationProvider');

      handleToggleModal(false);
    },
    onError(error) {
      toggleNotification({
        type: 'danger',
        message: formatAPIError(error),
      });
    },
    refetchActive: false,
  });

  const providers = Object.entries(data)
    .reduce((acc, [name, provider]) => {
      const { icon, enabled, subdomain } = provider;

      acc.push({
        name,
        icon: icon === 'envelope' ? ['fas', 'envelope'] : ['fab', icon],
        enabled,
        subdomain,
      });

      return acc;
    }, [])
    .sort((a, b) => formatter.compare(a.name, b.name));

  const isLoading = isLoadingData || isLoadingPermissions;
  const isAppleProvider = providerToEditName === APPLE_PROVIDER_NAME;

  const isProviderWithSubdomain = React.useMemo(() => {
    if (!providerToEditName) {
      return false;
    }

    const providerToEdit = providers.find((obj) => obj.name === providerToEditName);

    return !!providerToEdit?.subdomain;
  }, [providers, providerToEditName]);

  const layoutToRender = React.useMemo(() => {
    if (providerToEditName === 'email') {
      return forms.email;
    }

    if (isProviderWithSubdomain) {
      return forms.providersWithSubdomain;
    }

    return forms.providers;
  }, [providerToEditName, isProviderWithSubdomain]);

  const handleToggleModal = (forcedState) => {
    setIsOpen((prev) => {
      const next = typeof forcedState === 'boolean' ? forcedState : !prev;
      if (!next) {
        setProviderToEditName(null);
        setAppleSelectedFile(null);
      }

      return next;
    });
  };

  const handleClickEdit = (provider) => {
    if (canUpdate) {
      setProviderToEditName(provider.name);
      setAppleSelectedFile(null);
      handleToggleModal(true);
    }
  };

  const handleSubmit = async (values) => {
    trackUsage('willEditAuthenticationProvider');

    submitMutation.mutate({ providers: { ...data, [providerToEditName]: values } });
  };

  const loadAppleSettings = React.useCallback(async () => {
    setIsAppleLoading(true);
    try {
      const { data: appleSettings } = await get(APPLE_SETTINGS_ENDPOINT);
      setAppleForm({
        enabled: Boolean(appleSettings.enabled),
        clientId: appleSettings.clientId ?? '',
        teamId: appleSettings.teamId ?? '',
        keyId: appleSettings.keyId ?? '',
        redirectUrl: appleSettings.redirectUrl ?? '',
        authKeyFilename: appleSettings.authKeyFilename ?? null,
      });
      setAppleSelectedFile(null);
    } catch (error) {
      toggleNotification({
        type: 'danger',
        message: formatAPIError(error),
      });
    } finally {
      setIsAppleLoading(false);
    }
  }, [get, toggleNotification, formatAPIError]);

  React.useEffect(() => {
    if (isOpen && isAppleProvider) {
      loadAppleSettings();
    }
  }, [isOpen, isAppleProvider, loadAppleSettings]);

  const handleAppleFieldChange = (name, value) => {
    setAppleForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAppleFileChange = (file) => {
    setAppleSelectedFile(file);
  };

  const handleAppleSubmit = async () => {
    trackUsage('willEditAuthenticationProvider');
    setIsAppleSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('enabled', String(appleForm.enabled));
      formData.append('clientId', appleForm.clientId);
      formData.append('teamId', appleForm.teamId);
      formData.append('keyId', appleForm.keyId);
      formData.append('redirectUrl', appleForm.redirectUrl);
      if (appleSelectedFile) {
        formData.append('authKey', appleSelectedFile);
      }

      await post(APPLE_SETTINGS_ENDPOINT, formData);

      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: 'apple-provider.notifications.save-success',
          defaultMessage: 'Settings saved',
        }),
      });

      await Promise.all([
        queryClient.invalidateQueries(['users-permissions', 'get-providers']),
        loadAppleSettings(),
      ]);

      trackUsage('didEditAuthenticationProvider');

      handleToggleModal(false);
    } catch (error) {
      toggleNotification({
        type: 'danger',
        message: formatAPIError(error),
      });
    } finally {
      setIsAppleSubmitting(false);
    }
  };

  if (isLoading) {
    return <Page.Loading />;
  }

  return (
    <Layouts.Root>
      <Page.Title>
        {formatMessage(
          { id: 'Settings.PageTitle', defaultMessage: 'Settings - {name}' },
          {
            name: formatMessage({
              id: getTrad('HeaderNav.link.providers'),
              defaultMessage: 'Providers',
            }),
          }
        )}
      </Page.Title>
      <Page.Main>
        <Layouts.Header
          title={formatMessage({
            id: getTrad('HeaderNav.link.providers'),
            defaultMessage: 'Providers',
          })}
        />
        <Layouts.Content>
          <Table colCount={3} rowCount={providers.length + 1}>
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma" textColor="neutral600">
                    {formatMessage({ id: 'global.name', defaultMessage: 'Name' })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma" textColor="neutral600">
                    {formatMessage({ id: getTrad('Providers.status'), defaultMessage: 'Status' })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">
                    <VisuallyHidden>
                      {formatMessage({
                        id: 'global.settings',
                        defaultMessage: 'Settings',
                      })}
                    </VisuallyHidden>
                  </Typography>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {providers.map((provider) => (
                <Tr
                  key={provider.name}
                  onClick={() => (canUpdate ? handleClickEdit(provider) : undefined)}
                >
                  <Td width="45%">
                    <Typography fontWeight="semiBold" textColor="neutral800">
                      {provider.name}
                    </Typography>
                  </Td>
                  <Td width="65%">
                    <Typography
                      textColor={provider.enabled ? 'success600' : 'danger600'}
                      data-testid={`enable-${provider.name}`}
                    >
                      {provider.enabled
                        ? formatMessage({
                            id: 'global.enabled',
                            defaultMessage: 'Enabled',
                          })
                        : formatMessage({
                            id: 'global.disabled',
                            defaultMessage: 'Disabled',
                          })}
                    </Typography>
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    {canUpdate && (
                      <IconButton
                        onClick={() => handleClickEdit(provider)}
                        variant="ghost"
                        label="Edit"
                      >
                        <Pencil />
                      </IconButton>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Layouts.Content>
      </Page.Main>
      {!isAppleProvider && providerToEditName ? (
        <FormModal
          initialData={data[providerToEditName]}
          isOpen={isOpen}
          isSubmiting={submitMutation.isLoading}
          layout={layoutToRender}
          headerBreadcrumbs={[
            formatMessage({
              id: getTrad('PopUpForm.header.edit.providers'),
              defaultMessage: 'Edit Provider',
            }),
            upperFirst(providerToEditName),
          ]}
          onToggle={handleToggleModal}
          onSubmit={handleSubmit}
          providerToEditName={providerToEditName}
        />
      ) : null}
      {isAppleProvider ? (
        <AppleProviderModal
          isOpen={isOpen}
          isLoading={isAppleLoading}
          isSubmitting={isAppleSubmitting}
          values={appleForm}
          selectedFile={appleSelectedFile}
          onToggle={handleToggleModal}
          onChange={handleAppleFieldChange}
          onFileChange={handleAppleFileChange}
          onSubmit={handleAppleSubmit}
        />
      ) : null}
    </Layouts.Root>
  );
};

const AppleProviderModal = ({
  isOpen,
  isLoading,
  isSubmitting,
  onToggle,
  onSubmit,
  values,
  selectedFile,
  onChange,
  onFileChange,
}) => {
  const { formatMessage } = useIntl();

  const breadcrumbs = React.useMemo(
    () => [
      formatMessage({
        id: getTrad('PopUpForm.header.edit.providers'),
        defaultMessage: 'Edit Provider',
      }),
      upperFirst(APPLE_PROVIDER_NAME),
    ],
    [formatMessage]
  );

  return (
    <Modal.Root open={isOpen} onOpenChange={onToggle}>
      <Modal.Content>
        <Modal.Header>
          <Breadcrumbs label={breadcrumbs.join(', ')}>
            {breadcrumbs.map((crumb, index, arr) => (
              <Crumb isCurrent={index === arr.length - 1} key={crumb}>
                {crumb}
              </Crumb>
            ))}
          </Breadcrumbs>
        </Modal.Header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Modal.Body>
            {isLoading ? (
              <Flex justifyContent="center" paddingTop={8} paddingBottom={8}>
                <Loader />
              </Flex>
            ) : (
              <Flex direction="column" gap={6}>
                <Field.Root
                  hint={formatMessage({
                    id: 'apple-provider.settings.enabled.hint',
                    defaultMessage:
                      'Allow users to log in with Sign in with Apple once configuration is complete.',
                  })}
                  name="enabled"
                >
                  <Field.Label>
                    {formatMessage({
                      id: 'apple-provider.settings.enabled.label',
                      defaultMessage: 'Enable Sign in with Apple',
                    })}
                  </Field.Label>
                  <Toggle
                    aria-label="enabled"
                    checked={values.enabled}
                    offLabel={formatMessage({
                      id: 'apple-provider.settings.toggle.off',
                      defaultMessage: 'Off',
                    })}
                    onLabel={formatMessage({
                      id: 'apple-provider.settings.toggle.on',
                      defaultMessage: 'On',
                    })}
                    onChange={(event) => onChange('enabled', event.target.checked)}
                  />
                  <Field.Hint />
                </Field.Root>

                <Grid.Root gap={5}>
                  <Grid.Item col={6} xs={12}>
                    <Field.Root name="clientId">
                      <Field.Label>
                        {formatMessage({
                          id: 'apple-provider.settings.client-id.label',
                          defaultMessage: 'Client ID (Service ID)',
                        })}
                      </Field.Label>
                      <TextInput
                        value={values.clientId}
                        onChange={(event) => onChange('clientId', event.target.value)}
                      />
                      <Field.Hint>
                        {formatMessage({
                          id: 'apple-provider.settings.client-id.hint',
                          defaultMessage: 'The Service ID configured for Sign in with Apple.',
                        })}
                      </Field.Hint>
                    </Field.Root>
                  </Grid.Item>
                  <Grid.Item col={6} xs={12}>
                    <Field.Root name="teamId">
                      <Field.Label>
                        {formatMessage({
                          id: 'apple-provider.settings.team-id.label',
                          defaultMessage: 'Team ID',
                        })}
                      </Field.Label>
                      <TextInput
                        value={values.teamId}
                        onChange={(event) => onChange('teamId', event.target.value)}
                      />
                      <Field.Hint>
                        {formatMessage({
                          id: 'apple-provider.settings.team-id.hint',
                          defaultMessage:
                            'Find it in the top-right corner of your Apple Developer account.',
                        })}
                      </Field.Hint>
                    </Field.Root>
                  </Grid.Item>
                  <Grid.Item col={6} xs={12}>
                    <Field.Root name="keyId">
                      <Field.Label>
                        {formatMessage({
                          id: 'apple-provider.settings.key-id.label',
                          defaultMessage: 'Key ID',
                        })}
                      </Field.Label>
                      <TextInput
                        value={values.keyId}
                        onChange={(event) => onChange('keyId', event.target.value)}
                      />
                      <Field.Hint>
                        {formatMessage({
                          id: 'apple-provider.settings.key-id.hint',
                          defaultMessage:
                            'The identifier of the AuthKey used for generating the client secret.',
                        })}
                      </Field.Hint>
                    </Field.Root>
                  </Grid.Item>
                  <Grid.Item col={6} xs={12}>
                    <Field.Root name="redirectUrl">
                      <Field.Label>
                        {formatMessage({
                          id: 'apple-provider.settings.redirect-url.label',
                          defaultMessage: 'The redirect URL to your front-end app',
                        })}
                      </Field.Label>
                      <TextInput
                        value={values.redirectUrl}
                        placeholder="https://your-app.example.com/auth/apple"
                        onChange={(event) => onChange('redirectUrl', event.target.value)}
                      />
                      <Field.Hint>
                        {formatMessage({
                          id: 'apple-provider.settings.redirect-url.hint',
                          defaultMessage:
                            'Your users will be redirected to this URL with the Apple authorization code.',
                        })}
                      </Field.Hint>
                    </Field.Root>
                  </Grid.Item>
                </Grid.Root>

                <Field.Root name="callback">
                  <Field.Label>
                    {formatMessage({
                      id: 'apple-provider.settings.callback.label',
                      defaultMessage: 'Strapi callback URL',
                    })}
                  </Field.Label>
                  <TextInput value={getAppleCallbackUrl()} readOnly disabled />
                  <Field.Hint>
                    {formatMessage({
                      id: 'apple-provider.settings.callback.hint',
                      defaultMessage: 'Add this URL to the Apple Developer console as an allowed return URL.',
                    })}
                  </Field.Hint>
                </Field.Root>

                <Field.Root name="authKey">
                  <Field.Label>
                    {formatMessage({
                      id: 'apple-provider.settings.auth-key.label',
                      defaultMessage: 'AuthKey_XXXXXXXXXX.p8 file',
                    })}
                  </Field.Label>
                  <Box>
                    <input
                      type="file"
                      accept=".p8"
                      onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                    />
                  </Box>
                  <Field.Hint>
                    {formatMessage({
                      id: 'apple-provider.settings.auth-key.hint',
                      defaultMessage:
                        'Upload the private key downloaded from the Apple Developer portal.',
                    })}
                  </Field.Hint>
                  {values.authKeyFilename ? (
                    <Typography variant="pi" textColor="neutral600">
                      {formatMessage(
                        {
                          id: 'apple-provider.settings.auth-key.current',
                          defaultMessage: 'Current file: {file}',
                        },
                        { file: values.authKeyFilename }
                      )}
                    </Typography>
                  ) : (
                    <Typography variant="pi" textColor="neutral600">
                      {formatMessage({
                        id: 'apple-provider.settings.auth-key.none',
                        defaultMessage: 'No key has been uploaded yet.',
                      })}
                    </Typography>
                  )}
                  {selectedFile ? (
                    <Typography variant="pi" textColor="neutral600">
                      {formatMessage(
                        {
                          id: 'apple-provider.settings.auth-key.pending',
                          defaultMessage: 'Selected file: {file}',
                        },
                        { file: selectedFile.name }
                      )}
                    </Typography>
                  ) : null}
                </Field.Root>
              </Flex>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" type="button" onClick={() => onToggle(false)}>
              {formatMessage({
                id: 'app.components.Button.cancel',
                defaultMessage: 'Cancel',
              })}
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={isLoading}>
              {formatMessage({ id: 'global.save', defaultMessage: 'Save' })}
            </Button>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
};

const ProtectedProvidersPage = () => (
  <Page.Protect permissions={PERMISSIONS.readProviders}>
    <ProvidersPage />
  </Page.Protect>
);

export default ProtectedProvidersPage;
