import type { Schema, Struct } from '@strapi/strapi';

export interface ContactSocialLinks extends Struct.ComponentSchema {
  collectionName: 'components_contact_social_links';
  info: {
    displayName: 'social-links';
  };
  attributes: {
    type: Schema.Attribute.Enumeration<
      [
        'instagram',
        'telegram',
        'whatsapp',
        'facebook',
        'tiktok',
        'youtube',
        'vk',
        'other',
      ]
    >;
    value: Schema.Attribute.String;
  };
}

export interface GeoLocation extends Struct.ComponentSchema {
  collectionName: 'components_geo_locations';
  info: {
    displayName: 'location';
  };
  attributes: {
    address: Schema.Attribute.String;
    city: Schema.Attribute.String;
    latitude: Schema.Attribute.String;
    longitude: Schema.Attribute.String;
  };
}

export interface GuestSpotGuestSpotPricing extends Struct.ComponentSchema {
  collectionName: 'components_guest_spot_guest_spot_pricings';
  info: {
    description: 'Pricing option for a guest spot slot (hourly, daily, flat)';
    displayName: 'GuestSpotPricing';
  };
  attributes: {
    amount: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    description: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<['hourly', 'daily', 'flat']> &
      Schema.Attribute.Required;
  };
}

export interface TimeOpeningHour extends Struct.ComponentSchema {
  collectionName: 'components_time_opening_hours';
  info: {
    displayName: 'opening-hour';
  };
  attributes: {
    day: Schema.Attribute.Enumeration<
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    >;
    end: Schema.Attribute.Time;
    start: Schema.Attribute.Time;
    timezone: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'contact.social-links': ContactSocialLinks;
      'geo.location': GeoLocation;
      'guest-spot.guest-spot-pricing': GuestSpotGuestSpotPricing;
      'time.opening-hour': TimeOpeningHour;
    }
  }
}
