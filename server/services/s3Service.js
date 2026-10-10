const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Read configuration from environment
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || 'mybucketutkarsha-13';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';

// Local uploads directory for fallback & local asset caching
const localUploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(localUploadDir)) {
  fs.mkdirSync(localUploadDir, { recursive: true });
}

// Check if valid AWS credentials are provided
const hasValidCredentials = Boolean(
  AWS_ACCESS_KEY_ID && 
  AWS_SECRET_ACCESS_KEY && 
  !AWS_ACCESS_KEY_ID.includes('your_aws_access_key') &&
  !AWS_SECRET_ACCESS_KEY.includes('your_aws_secret')
);

// Initialize S3 Client
let s3Client = null;
let credentialMode = 'none';

if (hasValidCredentials) {
  try {
    s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
      }
    });
    credentialMode = 'static_env';
    console.log(`[AWS S3] Initialized S3 Client with explicit credentials for bucket "${AWS_S3_BUCKET}" in region "${AWS_REGION}".`);
  } catch (err) {
    console.error('[AWS S3 INIT ERROR]', err.message);
  }
} else {
  // Support AWS default credential provider chain (e.g. attached IAM role on EC2 instance)
  try {
    s3Client = new S3Client({
      region: AWS_REGION
    });
    credentialMode = 'default_chain_or_iam';
    console.log(`[AWS S3] Initialized S3 Client using default credential provider chain (EC2 IAM Role / AWS environment) for bucket "${AWS_S3_BUCKET}" in region "${AWS_REGION}".`);
  } catch (err) {
    console.warn('[AWS S3 DEFAULT CHAIN INIT ERROR]', err.message);
  }
}

/**
 * Upload a file buffer to AWS S3 or fallback to local disk
 * @param {Object} file - Multer file object or { buffer, originalname, mimetype }
 * @param {string} folder - Destination folder prefix in S3 (e.g. 'profiles', 'menu', 'delivery')
 * @returns {Promise<{ key: string, presignedUrl: string, storage: 's3'|'local' }>}
 */
async function uploadFileToS3(file, folder = 'uploads') {
  if (!file || (!file.buffer && !file.path)) {
    throw new Error('No valid file buffer or path provided for upload.');
  }

  const ext = path.extname(file.originalname || file.name || '.jpg').toLowerCase();
  const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(ext) ? ext : '.jpg';
  const uniqueId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const filename = `${folder.replace(/[^a-zA-Z0-9_-]/g, '')}-${uniqueId}${safeExt}`;
  const s3Key = `uploads/${folder}/${filename}`;
  const mimeType = file.mimetype || 'image/jpeg';

  let buffer = file.buffer;
  if (!buffer && file.path && fs.existsSync(file.path)) {
    buffer = fs.readFileSync(file.path);
  }

  // If S3 client with credentials is active, upload to AWS S3
  if (s3Client && buffer) {
    try {
      const command = new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: {
          originalName: encodeURIComponent(file.originalname || filename),
          uploadedAt: new Date().toISOString()
        }
      });

      await s3Client.send(command);
      console.log(`[AWS S3] Successfully uploaded object to s3://${AWS_S3_BUCKET}/${s3Key}`);

      // Generate a secure short-lived presigned URL for immediate display
      const presignedUrl = await getPresignedImageUrl(s3Key);

      return {
        key: s3Key,
        presignedUrl,
        bucket: AWS_S3_BUCKET,
        storage: 's3'
      };
    } catch (s3Err) {
      console.error(`[AWS S3 UPLOAD ERROR] s3://${AWS_S3_BUCKET}/${s3Key}:`, s3Err.message);
      // Fall through to local fallback if S3 network error occurred
    }
  }

  // Local fallback
  const localTarget = path.join(localUploadDir, filename);
  if (buffer) {
    fs.writeFileSync(localTarget, buffer);
  } else if (file.path && fs.existsSync(file.path)) {
    fs.copyFileSync(file.path, localTarget);
  }

  const localKey = `uploads/${filename}`;
  const presignedUrl = `/uploads/${filename}`;

  return {
    key: localKey,
    presignedUrl,
    bucket: 'local',
    storage: 'local'
  };
}

/**
 * Generate a short-lived presigned URL for reading an S3 object
 * @param {string} keyOrUrl - The S3 key (e.g. 'uploads/profiles/xyz.jpg') or existing URL
 * @param {number} expiresIn - Expiration in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>}
 */
async function getPresignedImageUrl(keyOrUrl, expiresIn = 3600) {
  if (!keyOrUrl) return null;

  // If already an external absolute URL (e.g., Unsplash placeholder), return as is
  if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
    return keyOrUrl;
  }

  // Normalize S3 key
  let s3Key = keyOrUrl.replace(/^\/+/, ''); // Remove leading slash

  // If S3 is active, generate presigned URL
  if (s3Client) {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: s3Key
      });

      const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn });
      return signedUrl;
    } catch (err) {
      console.warn(`[AWS S3 PRESIGN WARNING] Could not presign key "${s3Key}":`, err.message);
    }
  }

  // Local fallback: Return /uploads/filename
  if (s3Key.startsWith('uploads/')) {
    const parts = s3Key.split('/');
    const basename = parts[parts.length - 1];
    return `/uploads/${basename}`;
  }

  return `/${s3Key}`;
}

/**
 * Helper to resolve image fields in DB objects to Presigned URLs
 * @param {Object|Array} data - Single object or array of objects
 * @param {string[]} fields - List of property names to resolve
 * @returns {Promise<Object|Array>}
 */
async function resolveImageFields(data, fields = ['profile_photo', 'photo_url', 'delivery_proof_url', 'kitchen_proof_url', 'attachment_url']) {
  if (!data) return data;

  if (Array.isArray(data)) {
    return Promise.all(data.map(item => resolveImageFields(item, fields)));
  }

  if (typeof data !== 'object') return data;

  const resolved = { ...data };
  for (const field of fields) {
    if (resolved[field] && typeof resolved[field] === 'string') {
      resolved[field] = await getPresignedImageUrl(resolved[field]);
    }
  }

  return resolved;
}

/**
 * Delete an object from S3 or local storage
 * @param {string} keyOrPath 
 */
async function deleteFileFromS3(keyOrPath) {
  if (!keyOrPath) return;
  const s3Key = keyOrPath.replace(/^\/+/, '');

  if (s3Client) {
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: s3Key
      }));
      console.log(`[AWS S3] Deleted object s3://${AWS_S3_BUCKET}/${s3Key}`);
    } catch (err) {
      console.warn(`[AWS S3 DELETE WARNING] Failed to delete "${s3Key}":`, err.message);
    }
  }

  // Also clean up local file if it exists
  const basename = path.basename(s3Key);
  const localPath = path.join(localUploadDir, basename);
  if (fs.existsSync(localPath)) {
    try {
      fs.unlinkSync(localPath);
    } catch (e) {}
  }
}

module.exports = {
  uploadFileToS3,
  getPresignedImageUrl,
  resolveImageFields,
  deleteFileFromS3,
  AWS_S3_BUCKET,
  AWS_REGION,
  isS3Configured: () => hasValidCredentials
};
