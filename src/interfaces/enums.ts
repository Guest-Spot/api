export enum InviteType {
  ARTIST_TO_SHOP = 'artist_to_shop',
}

export enum InviteReaction {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export enum BookingReaction {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export enum NotifyType {
  REMOVE_ARTIST_FROM_SHOP = 'remove_artist_from_shop',
  ADD_ARTIST_TO_SHOP = 'add_artist_to_shop',
  BOOKING_CREATED = 'booking_created',
  BOOKING_ACCEPTED = 'booking_accepted',
  BOOKING_REJECTED = 'booking_rejected',
  INVITE_CREATED = 'invite_created',
  INVITE_ACCEPTED = 'invite_accepted',
  INVITE_REJECTED = 'invite_rejected',
}

export enum UserType {
  SHOP = 'shop',
  ARTIST = 'artist',
  GUEST = 'guest',
}
