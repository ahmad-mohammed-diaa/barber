import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import * as multer from 'multer';
import * as dotenv from 'dotenv';
import { UnsupportedMediaTypeException } from '@nestjs/common';
import { extname } from 'path';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const formats = ['jpg', 'jpeg', 'png'];

export const multerConfig = (folder: string): multer.Options => {
  return {
    storage: new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => {
        const extension = file.mimetype.split('/')[1].toLowerCase();
        if (!formats.includes(extension)) {
          throw new UnsupportedMediaTypeException('Invalid image format!');
        }
        return {
          folder: 'barber',
          format: extension,
          public_id: `${folder}/${Date.now()}-${file.originalname.split(/\.(?=[^\.]+$)/)[0]}`,
          transformation: [{ width: 500, height: 500, crop: 'limit' }],
        };
      },
    }),
    fileFilter: (
      req,
      file,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const mimeType = file.mimetype;
      const ext = extname(file.originalname).toLowerCase().replace('.', '');

      if (
        !mimeType ||
        !mimeType.startsWith('image/') ||
        !formats.includes(ext)
      ) {
        return callback(
          new UnsupportedMediaTypeException('Only image files are allowed!'),
          false,
        );
      }

      callback(null, true);
    },

    limits: {
      fileSize: 1024 * 1024 * 5, // 5 MB
    },
  };
};
