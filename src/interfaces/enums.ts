export enum InviteType {
  INVITE_CREATED = 'invite_created',
  INVITE_ACCEPTED = 'invite_accepted',
  INVITE_REJECTED = 'invite_rejected',
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
  BOOKING_CREATED = 'booking_created',
  BOOKING_ACCEPTED = 'booking_accepted',
  BOOKING_REJECTED = 'booking_rejected',
  INVITE_CREATED = 'invite_created',
  INVITE_ACCEPTED = 'invite_accepted',
  INVITE_REJECTED = 'invite_rejected',
  PAYMENT_SUCCEEDED = 'payment_succeeded',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_CANCELLED = 'payment_cancelled',
  STRIPE_ACCOUNT_ACTIVATED = 'stripe_account_activated',
}

export enum UserType {
  SHOP = 'shop',
  ARTIST = 'artist',
  GUEST = 'guest',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  AUTHORIZED = 'authorized',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}
