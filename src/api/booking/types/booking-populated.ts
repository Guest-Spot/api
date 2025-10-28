/**
 * Extended types for Booking with populated relations
 */

import { Schema, Struct } from '@strapi/strapi';

// User type from plugin::users-permissions.user
export interface UserProfile {
  id: number;
  username: string;
  email: string;
  stripeAccountID?: string;
  payoutsEnabled?: boolean;
}

// Booking with populated artist and owner relations
export interface BookingWithRelations {
  id: number;
  documentId: string;
  name?: string;
  phone?: string;
  email?: string;
  amount?: number;
  currency?: string;
  platformFee?: number;
  location?: string;
  description?: string;
  placement?: string;
  size?: string;
  day?: string;
  start?: string;
  reaction?: 'pending' | 'accepted' | 'rejected';
  rejectNote?: string;
  paymentStatus?: 'unpaid' | 'authorized' | 'paid' | 'cancelled' | 'failed';
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  authorizedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  locale?: string;
  artist?: UserProfile;
  owner?: UserProfile;
}

