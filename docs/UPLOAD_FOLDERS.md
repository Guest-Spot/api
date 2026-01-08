# Upload API with Folder Support

This document describes the custom upload endpoint with folder support for Strapi v5.

## Overview

The upload API has been extended to support uploading files to specific folders in the Strapi media library. The endpoint supports both folder ID and folder path, with automatic folder creation if the specified path doesn't exist.

## Features

- **Standard Upload**: Upload files to root folder (default behavior)
- **Folder by ID**: Upload files to existing folder by specifying folder ID
- **Folder by Path**: Upload files to folder by path (creates folders automatically if they don't exist)
- **Nested Folders**: Automatically creates nested folder structure when needed
- **Optional Authentication**: Works with or without authentication token
- **Multiple Files**: Supports uploading multiple files in a single request

## Endpoint

**URL:** `POST /api/upload`

**Content-Type:** `multipart/form-data`

**Authentication:** Optional

## Request Parameters

### Files (Required)

- **Field name:** `files`
- **Type:** File or Array of Files
- **Description:** One or more files to upload

### Folder Parameters (Optional)

You can use either `folder` or `path` parameter (they work the same way):

- **Field name:** `folder` or `path`
- **Type:** Number (folder ID) or String (folder path)
- **Description:** 
  - If number: ID of existing folder
  - If string: Path to folder (will be created if doesn't exist)

## Usage Examples

### 1. Standard Upload (No Folder)

Upload files to root folder:

**cURL:**
```bash
curl -X POST http://localhost:1337/api/upload \
  -F "files=@/path/to/image.jpg" \
  -F "files=@/path/to/image2.png"
```

**JavaScript (Fetch API):**
```javascript
const formData = new FormData();
formData.append('files', fileInput.files[0]);
formData.append('files', fileInput.files[1]);

const response = await fetch('http://localhost:1337/api/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log(result.data); // Array of uploaded files
```

**JavaScript (Axios):**
```javascript
import axios from 'axios';

const formData = new FormData();
formData.append('files', file1);
formData.append('files', file2);

const response = await axios.post('http://localhost:1337/api/upload', formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

console.log(response.data.data);
```

### 2. Upload to Folder by ID

Upload files to existing folder by ID:

**cURL:**
```bash
curl -X POST http://localhost:1337/api/upload \
  -F "files=@/path/to/image.jpg" \
  -F "folder=123"
```

**JavaScript:**
```javascript
const formData = new FormData();
formData.append('files', fileInput.files[0]);
formData.append('folder', '123'); // Folder ID

const response = await fetch('http://localhost:1337/api/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
```

**Note:** If folder with specified ID doesn't exist, returns `404 Not Found` error.

### 3. Upload to Folder by Path

Upload files to folder by path (creates folder automatically if it doesn't exist):

**cURL:**
```bash
# Simple folder
curl -X POST http://localhost:1337/api/upload \
  -F "files=@/path/to/image.jpg" \
  -F "folder=my-folder"

# Nested folder
curl -X POST http://localhost:1337/api/upload \
  -F "files=@/path/to/image.jpg" \
  -F "folder=my-folder/subfolder"
```

**JavaScript:**
```javascript
const formData = new FormData();
formData.append('files', fileInput.files[0]);
formData.append('folder', 'my-folder/subfolder'); // Folder path

const response = await fetch('http://localhost:1337/api/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
```

**Features:**
- Path can start with `/` or without (both work)
- If path `my-folder/subfolder` is specified, both folders will be created if they don't exist
- Path is automatically normalized

### 4. Using `path` Parameter (Alternative to `folder`)

The `path` parameter works exactly the same as `folder`:

```javascript
const formData = new FormData();
formData.append('files', fileInput.files[0]);
formData.append('path', 'my-folder/subfolder'); // Alternative to folder

const response = await fetch('http://localhost:1337/api/upload', {
  method: 'POST',
  body: formData,
});
```

## Response Format

### Success Response

```json
{
  "data": [
    {
      "id": 1,
      "name": "image.jpg",
      "alternativeText": null,
      "caption": null,
      "width": 1920,
      "height": 1080,
      "formats": {
        "thumbnail": { ... },
        "large": { ... },
        "medium": { ... },
        "small": { ... }
      },
      "hash": "image_abc123",
      "ext": ".jpg",
      "mime": "image/jpeg",
      "size": 245.76,
      "url": "/uploads/image_abc123.jpg",
      "previewUrl": null,
      "provider": "local",
      "provider_metadata": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Error Responses

**400 Bad Request** - No files provided:
```json
{
  "error": {
    "status": 400,
    "message": "No files provided"
  }
}
```

**404 Not Found** - Folder with specified ID not found:
```json
{
  "error": {
    "status": 404,
    "message": "Folder with ID 123 not found"
  }
}
```

## Complete Examples

### React Component Example

```javascript
import { useState } from 'react';

function FileUpload() {
  const [files, setFiles] = useState(null);
  const [folder, setFolder] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!files) return;

    setUploading(true);
    const formData = new FormData();
    
    // Add all selected files
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    // Add folder if specified
    if (folder) {
      formData.append('folder', folder);
    }

    try {
      const response = await fetch('http://localhost:1337/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      console.log('Uploaded files:', result.data);
      alert('Files uploaded successfully!');
    } catch (error) {
      console.error('Error:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleUpload}>
      <input
        type="file"
        multiple
        onChange={(e) => setFiles(e.target.files)}
      />
      <input
        type="text"
        placeholder="Folder path (optional)"
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
      />
      <button type="submit" disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
    </form>
  );
}
```

### Node.js Example

```javascript
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function uploadFile(filePath, folderPath = null) {
  const formData = new FormData();
  formData.append('files', fs.createReadStream(filePath));

  if (folderPath) {
    formData.append('folder', folderPath);
  }

  try {
    const response = await axios.post('http://localhost:1337/api/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        // Add authorization token if required
        // 'Authorization': `Bearer ${token}`
      },
    });

    console.log('Uploaded:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('Upload error:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
uploadFile('./image.jpg', 'my-folder/subfolder');
```

### Python Example

```python
import requests

def upload_file(file_path, folder_path=None):
    url = 'http://localhost:1337/api/upload'
    
    files = {
        'files': open(file_path, 'rb')
    }
    
    data = {}
    if folder_path:
        data['folder'] = folder_path
    
    response = requests.post(url, files=files, data=data)
    
    if response.status_code == 200:
        return response.json()['data']
    else:
        raise Exception(f"Upload failed: {response.text}")

# Usage
uploaded = upload_file('./image.jpg', 'my-folder/subfolder')
print(uploaded)
```

### Complete Example with Error Handling

```javascript
async function uploadFilesWithErrorHandling(files, folder = null) {
  const formData = new FormData();
  
  // Add files
  Array.from(files).forEach(file => {
    formData.append('files', file);
  });

  // Add folder if specified
  if (folder) {
    formData.append('folder', folder);
  }

  try {
    const response = await fetch('http://localhost:1337/api/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      // Handle errors
      if (response.status === 400) {
        throw new Error('No files provided');
      } else if (response.status === 404) {
        throw new Error('Folder not found');
      } else {
        throw new Error(result.error?.message || 'Upload failed');
      }
    }

    return result.data;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}
```

## Important Notes

1. **File Field Name**: Must be `files` (can be single file or array)
2. **Folder Parameters**: `folder` or `path` work the same way
3. **Folder Format**:
   - Number: ID of existing folder
   - String: Path to folder (created automatically if doesn't exist)
4. **Nested Folders**: Automatically created when specifying path like `folder1/folder2/folder3`
5. **Authentication**: Optional, but you can add token in headers:
   ```javascript
   headers: {
     'Authorization': `Bearer ${yourToken}`
   }
   ```

## Implementation Details

### Files Created

1. **`src/extensions/upload/strapi-server.ts`**: Plugin extension that merges standard and custom upload controllers
2. **`src/extensions/upload/controllers/upload.ts`**: Custom controller with folder support
3. **`src/extensions/upload/routes/content-api/upload.ts`**: Custom route definition

### How It Works

1. The extension automatically loads when Strapi starts (Strapi v5 auto-loads extensions from `src/extensions/{plugin-name}/strapi-server.ts`)
2. Custom controller extends the standard upload controller
3. When `folder` or `path` parameter is provided:
   - If number: Validates folder exists by ID
   - If string: Finds folder by path or creates it (including nested folders)
4. Files are uploaded using Strapi's standard upload service with folder association

### Folder Creation Logic

When a folder path is provided:
- Path is normalized (removes leading `/` if present)
- Path is split into parts (e.g., `my-folder/subfolder` → `['my-folder', 'subfolder']`)
- Each part is checked and created if it doesn't exist
- Parent-child relationships are maintained automatically
- `pathId` is generated automatically (simplified implementation)

## Troubleshooting

### "No files provided" Error

- Ensure files are sent with field name `files`
- Check that files are actually included in the request
- Verify multipart/form-data encoding

### "Folder with ID X not found" Error

- Verify folder ID exists in Strapi media library
- Check folder ID is correct
- Ensure folder hasn't been deleted

### Files Not Appearing in Folder

- Check folder ID or path is correct
- Verify upload was successful (check response)
- Refresh media library in Strapi admin panel

### Folder Not Created

- Check path format (should be like `folder/subfolder`)
- Verify no special characters in path
- Check Strapi logs for errors

## Notes

- The endpoint maintains backward compatibility with standard Strapi upload behavior
- If no folder is specified, files are uploaded to root folder (standard behavior)
- Folder creation is automatic and doesn't require separate API calls
- Nested folder structure is created recursively when needed

