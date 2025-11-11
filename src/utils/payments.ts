/**
 * Helper functions for payment-related checks
 */

export interface ArtistPaymentsState {
  payoutsEnabled?: boolean;
  verified?: boolean;
}

export const canArtistReceivePayments = (artist?: ArtistPaymentsState | null): boolean => {
  if (!artist) return false;
  return artist.payoutsEnabled === true && artist.verified === true;
};
