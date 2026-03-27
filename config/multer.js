const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');

// Create upload directories if they don't exist
const uploadsDir = path.join(__dirname, '../uploads');
const imagesDir = path.join(uploadsDir, 'images');
const videosDir = path.join(uploadsDir, 'videos');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

[uploadsDir, imagesDir, videosDir, thumbnailsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Combined storage configuration
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Route images to images directory, videos to videos directory
        if (file.fieldname === 'images' || file.fieldname.startsWith('image')) {
            cb(null, imagesDir);
        } else if (file.fieldname === 'video' || file.fieldname.startsWith('video')) {
            cb(null, videosDir);
        } else {
            cb(null, uploadsDir);
        }
    },
    filename: (req, file, cb) => {
        // Use a UUID-based filename to avoid trusting original filename
        const id = uuidv4();
        // Map mimetype to safe extension
        const mimeToExt = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'image/gif': '.gif',
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'video/quicktime': '.mov'
        };
        const ext = mimeToExt[file.mimetype] || path.extname(file.originalname) || '';
        cb(null, id + ext);
    }
});

// Enhanced file filter with stricter validation
const fileFilter = (req, file, cb) => {
    // Accept image files
    if (file.fieldname === 'images' || file.fieldname.startsWith('image')) {
        const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        const hasImageExtension = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname);
        const isImageMime = allowedImageTypes.includes(file.mimetype);
        
        if (isImageMime || hasImageExtension) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid image format. Allowed: JPG, PNG, WebP, GIF. Got: ${path.extname(file.originalname)}`));
        }
    } 
    // Accept video files
    else if (file.fieldname === 'video' || file.fieldname.startsWith('video')) {
        const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
        const hasVideoExtension = /\.(mp4|webm|mov)$/i.test(file.originalname);
        const isVideoMime = allowedVideoTypes.includes(file.mimetype);
        
        if (isVideoMime || hasVideoExtension) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid video format. Allowed: MP4, WebM, MOV. Got: ${path.extname(file.originalname)}`));
        }
    } else {
        cb(new Error('Unknown file field'));
    }
};

// Single upload middleware for both images and videos
// Basic per-user upload quota enforcement (in-memory, ephemeral)
const userUploadQuota = new Map(); // key: userId or IP, value: bytesUploaded
const MAX_USER_UPLOAD_BYTES = (process.env.MAX_FILE_SIZE_MB ? parseInt(process.env.MAX_FILE_SIZE_MB) : 10) * 1024 * 1024;

const quotaMiddleware = (req, res, next) => {
    try {
        const key = req.user && req.user.id ? `user:${req.user.id}` : `ip:${req.ip}`;
        const current = userUploadQuota.get(key) || 0;
        if (current >= MAX_USER_UPLOAD_BYTES) {
            return res.status(413).json({ message: 'Upload quota exceeded' });
        }
        req._uploadQuotaKey = key;
        next();
    } catch (err) {
        next(err);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: (process.env.MAX_FILE_SIZE_MB ? parseInt(process.env.MAX_FILE_SIZE_MB) : 10) * 1024 * 1024 // default 10MB
    }
});

// Helper to update quota after upload completes
const updateQuotaAfterUpload = (req, file) => {
    try {
        const key = req._uploadQuotaKey || `ip:${req.ip}`;
        const prev = userUploadQuota.get(key) || 0;
        userUploadQuota.set(key, prev + (file.size || 0));
    } catch (err) {
        // swallow
    }
};

/**
 * Optimize uploaded image
 * Compresses and resizes images to web-friendly formats
 */
async function optimizeImage(filePath, options = {}) {
    try {
        const {
            maxWidth = 1920,
            maxHeight = 1080,
            quality = 80,
            format = 'jpeg' // Use JPEG format to avoid Snappy dependency issues
        } = options;

        const outputPath = filePath.replace(/\.[^.]+$/, `.${format}`);

        let transform = sharp(filePath)
            .resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            });

        if (format === 'webp') {
            transform = transform.webp({ quality });
        } else if (format === 'jpeg') {
            transform = transform.jpeg({ quality });
        } else {
            transform = transform.png({ quality });
        }

        await transform.toFile(outputPath);
        
        // Delete original if different from output
        if (filePath !== outputPath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return outputPath;
    } catch (error) {
        console.error('Image optimization error:', error);
        throw error;
    }
}

/**
 * Generate video thumbnail
 * Creates a thumbnail image from video file
 */
async function generateVideoThumbnail(videoPath, options = {}) {
    return new Promise((resolve, reject) => {
        const {
            size = '320x180',
            timestamp = '00:00:01'
        } = options;

        const thumbnailPath = path.join(
            thumbnailsDir,
            `thumb-${  Date.now()  }.jpg`
        );

        ffmpeg(videoPath)
            .on('error', reject)
            .screenshots({
                timestamps: [timestamp],
                filename: path.basename(thumbnailPath),
                folder: path.dirname(thumbnailPath),
                size: size
            })
            .on('end', () => {
                // Optimize thumbnail
                sharp(path.join(path.dirname(thumbnailPath), path.basename(thumbnailPath)))
                    .jpeg({ quality: 60 })
                    .toFile(thumbnailPath)
                    .then(() => resolve(thumbnailPath))
                    .catch(reject);
            });
    });
}

/**
 * Get file metadata (size, dimensions, duration)
 */
async function getFileMetadata(filePath) {
    try {
        const stats = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const metadata = {
            size: stats.size,
            path: filePath,
            type: ext.startsWith('video') ? 'video' : 'image'
        };

        if (metadata.type === 'image') {
            const image = sharp(filePath);
            const data = await image.metadata();
            metadata.width = data.width;
            metadata.height = data.height;
            metadata.format = data.format;
        }

        return metadata;
    } catch (error) {
        console.error('Metadata extraction error:', error);
        throw error;
    }
}

module.exports = {
    upload,
    optimizeImage,
    generateVideoThumbnail,
    getFileMetadata,
    imagesDir,
    videosDir,
    thumbnailsDir
};
