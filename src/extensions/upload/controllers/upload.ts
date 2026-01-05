/**
 * Custom upload controller with folder support
 */

export default {
  /**
   * Upload files with optional folder support
   * Supports both folder ID and folder path
   */
  async upload(ctx: any) {
    const files = ctx.request.files?.files || ctx.request.files;
    const { folder, path: folderPath } = ctx.request.body || {};

    if (!files || (Array.isArray(files) && files.length === 0)) {
      return ctx.badRequest('No files provided');
    }

    try {
      // Get upload service
      const uploadService = strapi.plugin('upload').service('upload');

      // Resolve folder ID if folder or path is provided
      let folderId: number | null = null;

      if (folder || folderPath) {
        const folderParam = folder || folderPath;

        if (typeof folderParam === 'number' || /^\d+$/.test(String(folderParam))) {
          // Folder ID provided
          folderId = Number(folderParam);

          // Verify folder exists
          const folderExists = await strapi.db
            .query('plugin::upload.folder')
            .findOne({ where: { id: folderId } });

          if (!folderExists) {
            return ctx.notFound(`Folder with ID ${folderId} not found`);
          }
        } else if (typeof folderParam === 'string') {
          // Folder path provided - find or create folder
          const normalizedPath = folderParam.startsWith('/')
            ? folderParam.slice(1)
            : folderParam;

          let folderEntity = await strapi.db
            .query('plugin::upload.folder')
            .findOne({ where: { path: normalizedPath } });

          if (!folderEntity) {
            // Create folder if it doesn't exist
            // Parse path to create nested folders if needed
            const pathParts = normalizedPath.split('/').filter(Boolean);
            let parentId: number | null = null;

            for (let i = 0; i < pathParts.length; i++) {
              const part = pathParts[i];
              const currentPath = pathParts.slice(0, i + 1).join('/');
              
              let currentFolder = await strapi.db
                .query('plugin::upload.folder')
                .findOne({ where: { path: currentPath } });

              if (!currentFolder) {
                // Generate pathId (simplified - in production should be more robust)
                const count = await strapi.db
                  .query('plugin::upload.folder')
                  .count();
                const pathId = count + 1;

                currentFolder = await strapi.db
                  .query('plugin::upload.folder')
                  .create({
                    data: {
                      name: part,
                      path: currentPath,
                      pathId,
                      parent: parentId,
                    },
                  });
              }

              parentId = currentFolder.id;
            }

            folderEntity = await strapi.db
              .query('plugin::upload.folder')
              .findOne({ where: { path: normalizedPath } });
          }

          folderId = folderEntity?.id || null;
        }
      }

      // Upload files using Strapi's upload service
      const fileArray = Array.isArray(files) ? files : [files];
      const uploadedFiles = await uploadService.upload({
        data: folderId ? { folder: folderId } : {},
        files: fileArray,
      });

      // Update files with folder association if folderId is provided
      if (folderId && uploadedFiles && uploadedFiles.length > 0) {
        // Get folder to get its path for folderPath
        const folderEntity = await strapi.db
          .query('plugin::upload.folder')
          .findOne({ where: { id: folderId } });

        if (folderEntity) {
          const fileIds = uploadedFiles.map((file: any) => file.id);
          
          // Update each file to associate with folder and set folderPath using db.query
          // This preserves all file data and only updates folder-related fields
          for (const fileId of fileIds) {
            await strapi.db.query('plugin::upload.file').update({
              where: { id: fileId },
              data: {
                folder: folderId,
                folderPath: folderEntity.path,
              },
            });
          }

          // Update the folder reference in the returned files
          const updatedFiles = uploadedFiles.map((file: any) => ({
            ...file,
            folder: {
              id: folderEntity.id,
              name: folderEntity.name,
              path: folderEntity.path,
            },
            folderPath: folderEntity.path,
          }));

          // Return updated files
          ctx.send({
            data: updatedFiles,
          });
        } else {
          // Folder not found, return files as is
          ctx.send({
            data: uploadedFiles,
          });
        }
      } else {
        // Return uploaded files in Strapi format
        ctx.send({
          data: uploadedFiles,
        });
      }
    } catch (error: any) {
      strapi.log.error('Error uploading files:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload files';
      
      if (errorMessage.includes('not found')) {
        return ctx.notFound(errorMessage);
      }
      
      return ctx.badRequest(errorMessage);
    }
  },
};

