import { v2 as cloudinary } from 'cloudinary';

/**
 * Configure Cloudinary Node SDK with environment variables
 */
export const configureCloudinary = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn(
      '[Cloudinary] Warning: Cloudinary credentials missing in environment variables.'
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return cloudinary;
};

/**
 * Check Cloudinary reachability and API credential validity
 * @returns {Promise<{status: string, message: string, cloudName: string|null}>}
 */
export const checkCloudinaryConnection = async () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return {
      status: 'unconfigured',
      message:
        'Cloudinary environment variables are missing (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)',
      cloudName: cloudName || null,
    };
  }

  try {
    const result = await cloudinary.api.ping();
    return {
      status: result.status === 'ok' ? 'up' : 'degraded',
      message: 'Cloudinary API is reachable and credentials are valid',
      cloudName,
    };
  } catch (error) {
    return {
      status: 'down',
      message: `Cloudinary reachability check failed: ${error.message}`,
      cloudName,
    };
  }
};

export default cloudinary;
