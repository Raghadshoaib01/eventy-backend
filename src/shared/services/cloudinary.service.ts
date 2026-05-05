import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

export type UploadFolder =
  | 'eventy/profiles'
  | 'eventy/services'
  | 'eventy/halls'
  | 'eventy/documents'
  | 'eventy/videos';

type FileType = 'image' | 'video' | 'document';

interface UploadOptions {
  folder: UploadFolder;
  fileType?: FileType;
}

interface UploadResult {
  url: string;
  publicId: string;
  fileType: string;
  size: number;
  format: string;
}

@Injectable()
export class CloudinaryService {
  // ── تكوين الملفات المسموحة ──────────────────────────────
  private readonly allowedTypes: Record<FileType, string[]> = {
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

  private readonly maxSizes: Record<FileType, number> = {
    image: 5 * 1024 * 1024, // 5MB
    video: 100 * 1024 * 1024, // 100MB
    document: 10 * 1024 * 1024, // 10MB
  };

  // ── رفع ملف ─────────────────────────────────────────────
  async upload(
    file: Express.Multer.File,
    options: UploadOptions,
  ): Promise<UploadResult> {
    if (!file) throw new BadRequestException('No file provided');

    const fileType = options.fileType ?? this.detectFileType(file.mimetype);

    this.validateFile(file, fileType);

    const cloudinaryOptions = this.buildUploadOptions(options.folder, fileType);

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        cloudinaryOptions,
        (error, result: UploadApiResponse) => {
          if (error) {
            reject(new BadRequestException(`Upload failed: ${error.message}`));
          } else {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              fileType: result.resource_type,
              size: result.bytes,
              format: result.format,
            });
          }
        },
      );

      streamifier.createReadStream(file.buffer).pipe(stream);
    });
  }

  // ── حذف ملف ─────────────────────────────────────────────
  async delete(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch {
      console.error(`Failed to delete: ${publicId}`);
    }
  }

  // ── استخراج publicId من URL ──────────────────────────────
  extractPublicId(url: string): string {
    // https://res.cloudinary.com/cloud/image/upload/v123/eventy/profiles/abc.jpg
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    // نأخذ كل شيء بعد upload/vXXX
    const relevant = parts.slice(uploadIndex + 2).join('/');
    // نحذف الامتداد
    return relevant.replace(/\.[^/.]+$/, '');
  }

  // ── Validation ───────────────────────────────────────────
  private validateFile(file: Express.Multer.File, fileType: FileType): void {
    const allowed = this.allowedTypes[fileType];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${allowed.join(', ')}`,
      );
    }

    const maxSize = this.maxSizes[fileType];
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      throw new BadRequestException(`File too large. Max size: ${maxMB}MB`);
    }
  }

  // ── تحديد نوع الملف من mimetype ─────────────────────────
  private detectFileType(mimetype: string): FileType {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    return 'document';
  }

  // ── خيارات الرفع حسب النوع ───────────────────────────────
  private buildUploadOptions(folder: UploadFolder, fileType: FileType) {
    const base = { folder, resource_type: 'auto' as const };

    if (fileType === 'image') {
      return {
        ...base,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      };
    }

    if (fileType === 'video') {
      return {
        ...base,
        resource_type: 'video' as const,
        transformation: [{ quality: 'auto' }],
      };
    }

    // document / pdf / excel
    return {
      ...base,
      resource_type: 'raw' as const,
    };
  }
}
/*
// صورة بروفايل مستخدم
await this.cloudinaryService.upload(file, {
  folder: 'eventy/profiles',
});

// صور خدمة
await this.cloudinaryService.upload(file, {
  folder: 'eventy/services',
});

// صور قاعة
await this.cloudinaryService.upload(file, {
  folder: 'eventy/halls',
});

// وثيقة PDF أو Excel
await this.cloudinaryService.upload(file, {
  folder:   'eventy/documents',
  fileType: 'document',
});

// فيديو
await this.cloudinaryService.upload(file, {
  folder:   'eventy/videos',
  fileType: 'video',
});
*/
