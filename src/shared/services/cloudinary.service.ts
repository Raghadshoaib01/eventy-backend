import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import { FileType as PrismaFileType } from '@prisma/client';

export type UploadFolder =
  | 'eventy/profiles'
  | 'eventy/services'
  | 'eventy/sub-services'
  | 'eventy/halls'
  | 'eventy/documents'
  | 'eventy/videos';

/**
 * 🔴 النوع المحلي فقط للرفع
 */
type UploadFileType = 'image' | 'video' | 'document';

/**
 * 🔵 نوع Cloudinary الصحيح
 */
type CloudinaryResourceType = 'image' | 'video' | 'raw';

/**
 * DTO Options
 */
interface UploadOptions {
  folder: UploadFolder;
  fileType?: UploadFileType;
}

/**
 * Output موحّد
 */
interface UploadResult {
  url: string;
  publicId: string;
  fileType: PrismaFileType; // 👈 مهم: Prisma enum
  size: number;
  format: string;
}

@Injectable()
export class CloudinaryService {
  // ── allowed MIME types ─────────────────────────────
  private readonly allowedTypes: Record<UploadFileType, string[]> = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/quicktime', 'video/avi', 'video/mkv'],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  };

  private readonly maxSizes: Record<UploadFileType, number> = {
    image: 5 * 1024 * 1024,
    video: 100 * 1024 * 1024,
    document: 10 * 1024 * 1024,
  };

  // ── MAIN UPLOAD ─────────────────────────────────────
  async upload(
    file: Express.Multer.File,
    options: UploadOptions,
  ): Promise<UploadResult> {
    if (!file) throw new BadRequestException('No file provided');

    const fileType: UploadFileType =
      options.fileType ?? this.detectFileType(file.mimetype);

    this.validateFile(file, fileType);

    const cloudinaryOptions = this.buildUploadOptions(options.folder, fileType);

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        cloudinaryOptions,
        (error, result: UploadApiResponse) => {
          if (error) {
            reject(new BadRequestException(error.message));
            return;
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,

            // 🔴 أهم إصلاح: تحويل Cloudinary → Prisma enum
            fileType: this.mapToPrismaFileType(result.resource_type),

            size: result.bytes,
            format: result.format,
          });
        },
      );

      streamifier.createReadStream(file.buffer).pipe(stream);
    });
  }

  // ── DELETE ──────────────────────────────────────────
  async delete(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (e) {
      console.error(`Failed to delete: ${publicId}`);
    }
  }

  // ── PUBLIC ID ───────────────────────────────────────
  extractPublicId(url: string): string {
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    const relevant = parts.slice(uploadIndex + 2).join('/');
    return relevant.replace(/\.[^/.]+$/, '');
  }

  // ── VALIDATION ──────────────────────────────────────
  private validateFile(file: Express.Multer.File, fileType: UploadFileType) {
    const allowed = this.allowedTypes[fileType];

    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${allowed.join(', ')}`,
      );
    }

    const maxSize = this.maxSizes[fileType];

    if (file.size > maxSize) {
      throw new BadRequestException(
        `File too large. Max size: ${maxSize / (1024 * 1024)}MB`,
      );
    }
  }

  // ── DETECT TYPE ─────────────────────────────────────
  private detectFileType(mimetype: string): UploadFileType {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    return 'document';
  }

  // ── CLOUDINARY OPTIONS ──────────────────────────────
  private buildUploadOptions(
    folder: UploadFolder,
    fileType: UploadFileType,
  ) {
    const base = {
      folder,
      resource_type: this.mapToCloudinaryResourceType(fileType),
    };

    if (fileType === 'image') {
      return {
        ...base,
        transformation: [
          { quality: 'auto', fetch_format: 'auto' },
        ],
      };
    }

    if (fileType === 'video') {
      return {
        ...base,
        transformation: [{ quality: 'auto' }],
      };
    }

    return base;
  }

  // ── MAP Cloudinary → Prisma ─────────────────────────
  private mapToPrismaFileType(resource: string): PrismaFileType {
    switch (resource) {
      case 'image':
        return PrismaFileType.IMAGE;
      case 'video':
        return PrismaFileType.VIDEO;
      default:
        return PrismaFileType.DOCUMENT;
    }
  }

  // ── MAP local → Cloudinary ──────────────────────────
  private mapToCloudinaryResourceType(
    fileType: UploadFileType,
  ): CloudinaryResourceType {
    switch (fileType) {
      case 'image':
        return 'image';
      case 'video':
        return 'video';
      case 'document':
        return 'raw';
    }
  }
}