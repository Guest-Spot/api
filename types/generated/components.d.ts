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
        'site',
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
      'time.opening-hour': TimeOpeningHour;
    }
  }
}
