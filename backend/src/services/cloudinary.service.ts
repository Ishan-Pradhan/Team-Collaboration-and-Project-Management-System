import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

cloudinary.config({
  cloud_name: env.CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = (
  fileBuffer: Buffer,
  options: { folder: string; resourceType?: 'image' | 'video' | 'raw' | 'auto' },
): Promise<{ url: string; publicId: string; format: string; bytes: number }> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: options.folder,
          resource_type: options.resourceType ?? 'auto',
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error('Upload failed'));
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            bytes: result.bytes,
          });
        },
      )
      .end(fileBuffer);
  });
};

export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image',
): Promise<void> => {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};
