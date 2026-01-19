import { errors } from '@strapi/utils';
import {
  getCurrentUserCoordinates,
  orderUserIdsByDistance,
  reorderUsers,
} from '../utils/user-distance';

const extractUsersPayload = (payload: any) => {
  if (Array.isArray(payload)) {
    return {
      users: payload,
      setUsers: (users: any[]) => users,
    };
  }

  if (payload && Array.isArray(payload.data)) {
    return {
      users: payload.data,
      setUsers: (users: any[]) => ({ ...payload, data: users }),
    };
  }

  return null;
};

const customUserController = (originalController: any) => ({
  async find(ctx: any) {
    if (!originalController?.find) {
      throw new errors.ApplicationError('Base users list controller is unavailable');
    }

    await originalController.find(ctx);

    const payloadHandler = extractUsersPayload(ctx.body);
    if (!payloadHandler) {
      return;
    }

    const { users, setUsers } = payloadHandler;
    if (!users.length) {
      return;
    }

    const coords = await getCurrentUserCoordinates(ctx);
    if (!coords) {
      return;
    }

    try {
      const orderedIds = await orderUserIdsByDistance(
        users.map((user: { id: number }) => user.id),
        coords
      );
      ctx.body = setUsers(reorderUsers(users, orderedIds));
    } catch (error) {
      strapi.log?.error?.('[Users] Failed to order users by distance:', error);
    }
  },
});

export default customUserController;
