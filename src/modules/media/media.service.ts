import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get('CLOUDINARY_API_KEY'),
      api_secret: this.config.get('CLOUDINARY_API_SECRET'),
    });
  }

  getUploadSignature(folder = 'tmb/movies') {
    const timestamp = Math.round(Date.now() / 1000);
    const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      return {
        configured: false,
        message: 'Cloudinary not configured. Set CLOUDINARY_* env vars.',
      };
    }

    const params = { timestamp, folder, resource_type: 'video' };
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);

    return {
      configured: true,
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
      resourceType: 'video',
    };
  }
}
