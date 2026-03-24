/**
 * Video Handler Utility
 * Handles video validation, preview generation, and metadata extraction
 */

class VideoHandler {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB
    this.maxDuration = options.maxDuration || 300; // 5 minutes in seconds
    this.allowedFormats = options.allowedFormats || ['mp4', 'webm', 'mov'];
    this.thumbnailTime = options.thumbnailTime || 1; // seconds
  }

  /**
   * Validate video file
   * @param {File} file - Video file
   * @returns {Promise<{valid: boolean, errors: string[]}>}
   */
  async validateVideo(file) {
    const errors = [];

    // Check file size
    if (file.size > this.maxSize) {
      errors.push(`File size exceeds ${this.formatSize(this.maxSize)} limit`);
    }

    // Check file type
    const ext = file.name.split('.').pop().toLowerCase();
    if (!this.allowedFormats.includes(ext)) {
      errors.push(`Invalid format. Allowed: ${this.allowedFormats.join(', ')}`);
    }

    // Check duration
    try {
      const duration = await this.getVideoDuration(file);
      if (duration > this.maxDuration) {
        errors.push(`Video duration exceeds ${this.formatDuration(this.maxDuration)} limit`);
      }
    } catch (error) {
      errors.push('Unable to validate video duration');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get video duration
   * @param {File} file - Video file
   * @returns {Promise<number>} Duration in seconds
   */
  async getVideoDuration(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);

      video.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(video.duration);
      });

      video.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video metadata'));
      });

      video.src = url;
    });
  }

  /**
   * Generate video thumbnail from blob
   * @param {File|Blob} file - Video file
   * @param {number} timestamp - Timestamp in seconds (default: 1)
   * @returns {Promise<string>} Data URL of thumbnail
   */
  async generateThumbnail(file, timestamp = this.thumbnailTime) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const url = URL.createObjectURL(file);

      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        video.currentTime = Math.min(timestamp, video.duration - 0.1);
      });

      video.addEventListener('seeked', () => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      });

      video.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to generate thumbnail'));
      });

      video.src = url;
    });
  }

  /**
   * Get video metadata
   * @param {File} file - Video file
   * @returns {Promise<Object>}
   */
  async getVideoMetadata(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);

      video.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve({
          filename: file.name,
          size: file.size,
          formattedSize: this.formatSize(file.size),
          duration: video.duration,
          formattedDuration: this.formatDuration(video.duration),
          width: video.videoWidth,
          height: video.videoHeight,
          aspect: (video.videoWidth / video.videoHeight).toFixed(2),
          type: file.type
        });
      });

      video.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video metadata'));
      });

      video.src = url;
    });
  }

  /**
   * Create video preview object
   * @param {File} file - Video file
   * @returns {Promise<Object>}
   */
  async createPreview(file) {
    try {
      const metadata = await this.getVideoMetadata(file);
      const thumbnail = await this.generateThumbnail(file, this.thumbnailTime);

      return {
        ...metadata,
        thumbnail,
        status: 'ready'
      };
    } catch (error) {
      throw new Error(`Failed to create preview: ${error.message}`);
    }
  }

  /**
   * Check if browser supports video format
   * @param {string} format - Video format (mp4, webm, ogg)
   * @returns {boolean}
   */
  isFormatSupported(format) {
    const video = document.createElement('video');
    const mimeTypes = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogg': 'video/ogg',
      'mov': 'video/quicktime'
    };

    const mimeType = mimeTypes[format.toLowerCase()];
    if (!mimeType) {return false;}

    return video.canPlayType(mimeType) !== '';
  }

  /**
   * Format duration to HH:MM:SS
   * @param {number} seconds - Duration in seconds
   * @returns {string}
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format file size
   * @param {number} bytes - Size in bytes
   * @returns {string}
   */
  formatSize(bytes) {
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }

  /**
   * Batch generate thumbnails for multiple videos
   * @param {File[]} files - Video files
   * @returns {Promise<Array>}
   */
  async generateThumbnailBatch(files) {
    const results = [];

    for (const file of files) {
      try {
        const thumbnail = await this.generateThumbnail(file);
        results.push({
          filename: file.name,
          thumbnail,
          success: true
        });
      } catch (error) {
        results.push({
          filename: file.name,
          error: error.message,
          success: false
        });
      }
    }

    return results;
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VideoHandler;
}
