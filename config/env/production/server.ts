export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS', '8RX093hj2JS/wMuWLglK0Q==,uHrjVTi6tNmk/E+MwSkIxw==,bX9SWSiinrXzcbb6vpy6mw==,hujLkyAHTym+O8IUg5RNUA=='),
  },
  url: env('PUBLIC_URL', 'https://api.getguestspot.app'),
});
