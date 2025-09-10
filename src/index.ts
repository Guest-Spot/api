import { citiesExtension } from './extensions/graphql/cities';
import { shopArtistsExtension } from './extensions/graphql/shop-artists';
import { usersPermissionsExtension } from './extensions/users-permissions';

export default {
  register({ strapi }) {
    strapi.plugin('graphql').service('extension').use(citiesExtension);
    strapi.plugin('graphql').service('extension').use(shopArtistsExtension);
    strapi.plugin('graphql').service('extension').use(usersPermissionsExtension);
  },
};