import { citiesExtension } from './extensions/graphql/cities';
import { usersPermissionsExtension } from './extensions/users-permissions';

export default {
  register({ strapi }) {
    strapi.plugin('graphql').service('extension').use(citiesExtension);
    strapi.plugin('graphql').service('extension').use(usersPermissionsExtension);
  },
};