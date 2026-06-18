import { BadRequestException, Injectable } from "@nestjs/common";
import { FileValidationDto } from "../dto/upload-response.dto";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp');


@Injectable()
export class ImageValidationService {
    private readonly ALLOWED_MIME_TYPES = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
    ];

    private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    private readonly MIN_DIMENSIONS = { width: 200, height: 200 };
    private readonly MAX_DIMENSIONS = { width: 2000, height: 2000 };

    validateFile(file: Express.Multer.File): FileValidationDto {
        this.validateMimeType(file.mimetype);
        this.validateFileSize(file.size);
        this.validateFileName(file.originalname);

        return {
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
        };
    }

    private validateMimeType(mimetype: string): void {
        if (!this.ALLOWED_MIME_TYPES.includes(mimetype)) {
            throw new BadRequestException(
                `Invalid file type. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`
            );
        }
    }

    private validateFileSize(size: number): void {
        if (size > this.MAX_FILE_SIZE) {
            throw new BadRequestException(
                `File too large. Maximum size: ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`
            );
        }
    }

    private validateFileName(filename: string): void {
        const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, '');
        if (sanitizedName !== filename) {
            throw new BadRequestException('Invalid characters in filename');
        }
    }

    async validateImageDimensions(file: Express.Multer.File): Promise<void> {
        const { width = 0, height = 0 } = await sharp(file.buffer).metadata();
        if (width < this.MIN_DIMENSIONS.width || height < this.MIN_DIMENSIONS.height) {
            throw new BadRequestException(
                `Image too small. Minimum dimensions: ${this.MIN_DIMENSIONS.width}×${this.MIN_DIMENSIONS.height}px`,
            );
        }
        if (width > this.MAX_DIMENSIONS.width || height > this.MAX_DIMENSIONS.height) {
            throw new BadRequestException(
                `Image too large. Maximum dimensions: ${this.MAX_DIMENSIONS.width}×${this.MAX_DIMENSIONS.height}px`,
            );
        }
    }
}