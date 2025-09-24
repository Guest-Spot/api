export default async (userId: string) => {
  const entity = await strapi.entityService.findOne(
    'plugin::users-permissions.user',
    userId,
    {
      populate: {
        shop: {
          populate: {
            pictures: true,
            links: true,
            location: true,
            openingHours: true,
            artists: {
              populate: {
                avatar: true,
                links: true,
                location: true,
              },
            },
          },
        },
        artist: {
          populate: {
            avatar: true,
            links: true,
            location: true,
            shop: {
              populate: {
                pictures: true,
                links: true,
                location: true,
                openingHours: true,
              },
            },
          },
        },
      },
    }
  ) as any;

  if (!entity) return null;

  let profile = null;
  if (entity.type === 'shop' && entity.shop) {
    profile = {
      ...entity.shop,
      pictures: entity.shop.pictures?.map((picture: any) => ({
        ...picture,
        id: picture.id || picture.documentId,
      })) || [],
    };
  } else if (entity.type === 'artist' && entity.artist) {
    profile = {
      ...entity.artist,
      avatar: entity.artist.avatar ? {
        ...entity.artist.avatar,
        id: entity.artist.avatar?.id || entity.artist.avatar?.documentId,
      } : null,
    };
  }

  delete entity.shop;
  delete entity.artist;

  return {
    ...entity,
    profile,
  };
};
