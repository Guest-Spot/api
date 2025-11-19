import fs from 'fs';
import path from 'path';

export default (config, { strapi }) => {
  return async (context, next) => {
    const { path: requestPath } = context;

    // Check if the path starts with /.well-known/
    if (requestPath.startsWith('/.well-known/')) {
      const fileName = requestPath.replace('/.well-known/', '');
      const filePath = path.join(strapi.dirs.static.public, '.well-known', fileName);

      try {
        // Check if the file exists
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath);

          // Determine the Content-Type based on the file extension
          if (fileName.endsWith('.json')) {
            context.type = 'application/json';
          } else if (fileName === 'apple-app-site-association') {
            context.type = 'application/json';
          } else if (fileName.endsWith('.txt')) {
            context.type = 'text/plain';
          } else if (fileName.endsWith('.xml')) {
            context.type = 'application/xml';
          } else {
            // For unknown file types, use text/plain
            context.type = 'text/plain';
          }

          context.body = fileContent;
          return;
        }
      } catch (error) {
        // If there is an error, continue to the next middleware
        strapi.log.error('Error serving .well-known file:', error);
      }
    }

    // If the file is not found or the path does not match, pass control to the next middleware
    await next();
  };
};