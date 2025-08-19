const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../config/database');

class FileUploadService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
    this.allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    this.allowedDocumentTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    this.initializeUploadDirectory();
  }

  // Initialize upload directory
  async initializeUploadDirectory() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'images'), { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'documents'), { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'temp'), { recursive: true });
      logger.info('Upload directories initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize upload directories:', error);
    }
  }

  // Configure multer storage
  getStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        const tempPath = path.join(this.uploadDir, 'temp');
        cb(null, tempPath);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    });
  }

  // File filter function
  fileFilter(req, file, cb) {
    const allowedTypes = [...this.allowedImageTypes, ...this.allowedDocumentTypes];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  }

  // Get multer instance for single file upload
  getSingleUpload(fieldName = 'file') {
    return multer({
      storage: this.getStorage(),
      fileFilter: this.fileFilter,
      limits: {
        fileSize: this.maxFileSize
      }
    }).single(fieldName);
  }

  // Get multer instance for multiple file upload
  getMultipleUpload(fieldName = 'files', maxCount = 5) {
    return multer({
      storage: this.getStorage(),
      fileFilter: this.fileFilter,
      limits: {
        fileSize: this.maxFileSize,
        files: maxCount
      }
    }).array(fieldName, maxCount);
  }

  // Process and move uploaded file
  async processUploadedFile(file, category = 'documents') {
    try {
      const tempPath = file.path;
      const fileName = path.basename(file.path);
      const targetDir = path.join(this.uploadDir, category);
      const targetPath = path.join(targetDir, fileName);

      // Ensure target directory exists
      await fs.mkdir(targetDir, { recursive: true });

      // Move file from temp to target directory
      await fs.rename(tempPath, targetPath);

      // Process image if it's an image file
      let processedInfo = null;
      if (this.allowedImageTypes.includes(file.mimetype)) {
        processedInfo = await this.processImage(targetPath);
      }

      const fileInfo = {
        originalName: file.originalname,
        filename: fileName,
        mimetype: file.mimetype,
        size: file.size,
        path: targetPath,
        url: `/uploads/${category}/${fileName}`,
        category: category,
        uploadedAt: new Date(),
        ...(processedInfo && { processed: processedInfo })
      };

      logger.info(`File processed successfully: ${fileName}`);
      return { success: true, file: fileInfo };

    } catch (error) {
      logger.error('Failed to process uploaded file:', error);
      return { success: false, error: error.message };
    }
  }

  // Process image with Sharp
  async processImage(imagePath) {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      // Generate thumbnail
      const thumbnailPath = imagePath.replace(/\.[^/.]+$/, '_thumb.jpg');
      await image
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      // Generate medium size
      const mediumPath = imagePath.replace(/\.[^/.]+$/, '_medium.jpg');
      await image
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(mediumPath);

      return {
        thumbnail: path.basename(thumbnailPath),
        medium: path.basename(mediumPath),
        dimensions: {
          width: metadata.width,
          height: metadata.height
        },
        format: metadata.format,
        size: metadata.size
      };

    } catch (error) {
      logger.error('Failed to process image:', error);
      return null;
    }
  }

  // Extract metadata from uploaded file
  async extractMetadata(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      let metadata = {};

      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        const image = sharp(filePath);
        const imageMetadata = await image.metadata();
        metadata = {
          type: 'image',
          width: imageMetadata.width,
          height: imageMetadata.height,
          format: imageMetadata.format,
          size: imageMetadata.size,
          hasAlpha: imageMetadata.hasAlpha,
          hasProfile: imageMetadata.hasProfile
        };
      } else if (ext === '.pdf') {
        // Basic PDF metadata - could be enhanced with pdf-parse
        metadata = {
          type: 'pdf',
          size: (await fs.stat(filePath)).size
        };
      } else if (['.doc', '.docx'].includes(ext)) {
        metadata = {
          type: 'document',
          size: (await fs.stat(filePath)).size
        };
      } else {
        metadata = {
          type: 'other',
          size: (await fs.stat(filePath)).size
        };
      }

      return metadata;

    } catch (error) {
      logger.error('Failed to extract file metadata:', error);
      return { type: 'unknown', error: error.message };
    }
  }

  // Delete uploaded file
  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      logger.info(`File deleted successfully: ${filePath}`);
      return { success: true, message: 'File deleted successfully' };
    } catch (error) {
      logger.error('Failed to delete file:', error);
      return { success: false, error: error.message };
    }
  }

  // Clean up temporary files
  async cleanupTempFiles() {
    try {
      const tempDir = path.join(this.uploadDir, 'temp');
      const files = await fs.readdir(tempDir);
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        // Delete files older than 1 hour
        if (Date.now() - stats.mtime.getTime() > 60 * 60 * 1000) {
          await fs.unlink(filePath);
          logger.info(`Cleaned up temp file: ${file}`);
        }
      }
      
      return { success: true, message: 'Temporary files cleaned up' };
    } catch (error) {
      logger.error('Failed to cleanup temp files:', error);
      return { success: false, error: error.message };
    }
  }

  // Get file info
  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const metadata = await this.extractMetadata(filePath);
      
      return {
        success: true,
        file: {
          path: filePath,
          name: path.basename(filePath),
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          ...metadata
        }
      };
    } catch (error) {
      logger.error('Failed to get file info:', error);
      return { success: false, error: error.message };
    }
  }

  // Validate file size
  validateFileSize(fileSize) {
    return fileSize <= this.maxFileSize;
  }

  // Validate file type
  validateFileType(mimetype) {
    const allowedTypes = [...this.allowedImageTypes, ...this.allowedDocumentTypes];
    return allowedTypes.includes(mimetype);
  }

  // Get allowed file types
  getAllowedFileTypes() {
    return {
      images: this.allowedImageTypes,
      documents: this.allowedDocumentTypes,
      maxFileSize: this.maxFileSize
    };
  }
}

module.exports = FileUploadService;
