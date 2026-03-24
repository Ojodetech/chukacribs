/**
 * Image Compression Utility
 * Handles image compression before upload with advanced features
 */

class ImageCompressor {
  constructor(options = {}) {
    this.maxWidth = options.maxWidth || 1920;
    this.maxHeight = options.maxHeight || 1080;
    this.quality = options.quality || 0.8;
    this.maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB
    this.thumbnailWidth = options.thumbnailWidth || 320;
    this.thumbnailHeight = options.thumbnailHeight || 240;
    this.compressionLevels = {
      high: { quality: 0.5, maxWidth: 960, maxHeight: 720 },
      medium: { quality: 0.7, maxWidth: 1280, maxHeight: 960 },
      low: { quality: 0.9, maxWidth: 1920, maxHeight: 1080 }
    };
  }

  /**
   * Compress image file with adaptive quality
   * @param {File} file - Image file
   * @param {Object} options - Compression options
   * @returns {Promise<{blob: Blob, metadata: Object}>}
   */
  async compress(file, options = {}) {
    // Validate file
    if (!this.isValidImage(file)) {
      throw new Error('Invalid image file. Supported: JPEG, PNG, WebP, GIF');
    }

    // If file is small enough, return as-is
    if (file.size < 100 * 1024) { // Less than 100KB
      return {
        blob: file,
        metadata: {
          originalSize: file.size,
          compressed: false,
          compressionLevel: 'none'
        }
      };
    }

    // Read file as data URL
    const dataUrl = await this.fileToDataUrl(file);

    // Compress image
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Determine compression level based on file size
          let compressionLevel = 'low';
          if (file.size > 3 * 1024 * 1024) {compressionLevel = 'high';} // > 3MB
          else if (file.size > 1024 * 1024) {compressionLevel = 'medium';} // > 1MB

          const compression = this.compressionLevels[compressionLevel];

          // Calculate new dimensions
          const { width, height } = this.calculateDimensions(
            img.width,
            img.height,
            options.maxWidth || compression.maxWidth,
            options.maxHeight || compression.maxHeight
          );

          canvas.width = width;
          canvas.height = height;

          // Draw image on canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob
          const quality = options.quality || compression.quality;
          canvas.toBlob(
            (blob) => {
              const metadata = {
                originalSize: file.size,
                compressedSize: blob.size,
                originalDimensions: { width: img.width, height: img.height },
                compressedDimensions: { width, height },
                compressionLevel,
                compressed: true,
                ratio: `${((1 - blob.size / file.size) * 100).toFixed(1)  }%`
              };

              if (blob && blob.size <= this.maxSize) {
                resolve({ blob, metadata });
              } else {
                // If still too large, reduce quality further
                const newQuality = quality * 0.8;
                if (newQuality > 0.2) {
                  canvas.toBlob(
                    (newBlob) => {
                      metadata.compressedSize = newBlob.size;
                      metadata.ratio = `${((1 - newBlob.size / file.size) * 100).toFixed(1)  }%`;
                      resolve({ blob: newBlob, metadata });
                    },
                    'image/jpeg',
                    newQuality
                  );
                } else {
                  resolve({ blob, metadata });
                }
              }
            },
            'image/jpeg',
            quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * Compress multiple images
   * @param {FileList|File[]} files - Image files
   * @returns {Promise<Array>} Array of {blob, metadata}
   */
  async compressMultiple(files) {
    const filesArray = Array.from(files);
    const compressed = [];

    for (const file of filesArray) {
      try {
        const result = await this.compress(file);
        compressed.push(result);
      } catch (error) {
        console.error(`Failed to compress ${file.name}:`, error);
        throw error;
      }
    }

    return compressed;
  }

  /**
   * Create thumbnail from image
   * @param {File} file - Image file
   * @returns {Promise<Blob>}
   */
  async createThumbnail(file) {
    const dataUrl = await this.fileToDataUrl(file);

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const { width, height } = this.calculateDimensions(
            img.width,
            img.height,
            this.thumbnailWidth,
            this.thumbnailHeight
          );

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => resolve(blob),
            'image/jpeg',
            0.7
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * Calculate new image dimensions maintaining aspect ratio
   * @param {number} width - Original width
   * @param {number} height - Original height
   * @param {number} maxWidth - Max width
   * @param {number} maxHeight - Max height
   * @returns {Object}
   */
  calculateDimensions(width, height, maxWidth, maxHeight) {
    let newWidth = width;
    let newHeight = height;

    // Scale down if too wide
    if (width > maxWidth) {
      newHeight = Math.round((maxWidth / width) * height);
      newWidth = maxWidth;
    }

    // Scale down if too tall
    if (newHeight > maxHeight) {
      newWidth = Math.round((maxHeight / newHeight) * newWidth);
      newHeight = maxHeight;
    }

    return { width: newWidth, height: newHeight };
  }

  /**
   * Convert file to data URL
   * @param {File} file - File object
   * @returns {Promise<string>}
   */
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Check if file is valid image
   * @param {File} file - File object
   * @returns {boolean}
   */
  isValidImage(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

    const isValidType = validTypes.includes(file.type);
    const isValidExtension = validExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    return isValidType && isValidExtension;
  }

  /**
   * Get human-readable file size
   * @param {number} bytes - File size in bytes
   * @returns {string}
   */
  static formatFileSize(bytes) {
    if (bytes === 0) {return '0 Bytes';}

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }

  /**
   * Create preview from compressed blob
   * @param {Blob} blob - Compressed image blob
   * @returns {Promise<string>}
   */
  static blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Validate image dimensions
   * @param {File} file - Image file
   * @param {Object} constraints - Min/max dimensions
   * @returns {Promise<boolean>}
   */
  async validateDimensions(file, constraints = {}) {
    const { minWidth = 320, minHeight = 240, maxWidth = 4000, maxHeight = 4000 } = constraints;
    const dataUrl = await this.fileToDataUrl(file);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const valid = img.width >= minWidth && img.height >= minHeight &&
                     img.width <= maxWidth && img.height <= maxHeight;
        resolve(valid);
      };
      img.onerror = () => resolve(false);
      img.src = dataUrl;
    });
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageCompressor;
}
