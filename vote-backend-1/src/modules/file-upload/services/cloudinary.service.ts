import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from 'cloudinary';
import { BadRequestException, Injectable } from "@nestjs/common";
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';


@Injectable()
export class CloudinaryService {
    constructor(private configService: ConfigService) {
        cloudinary.config({
            cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
            api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
            api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
        });
    }

    async uploadCandidatePhoto(
        file: Express.Multer.File,
        candidateId: string,
    ): Promise<UploadApiResponse> {
        try {
            const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            const result = await cloudinary.uploader.upload(dataUri, {
                folder: `pax-romana/candidates/${candidateId}`,
                public_id: `candidate-${candidateId}-${Date.now()}`,
                transformation: [
                    { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                    { quality: 'auto:good' },
                    { format: 'jpg' },
                ],
                resource_type: 'image',
            });

            return result;
        } catch (error) {
            throw new BadRequestException('Failed to upload image to Cloudinary');
        }
    }

    async uploadNominationDocument(
        file: Express.Multer.File,
        nominationId: string,
    ): Promise<UploadApiResponse> {
        try {
            const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            const result = await cloudinary.uploader.upload(dataUri, {
                folder: `pax-romana/nominations/${nominationId}`,
                public_id: `nomination-${nominationId}-${Date.now()}`,
                resource_type: 'auto',
            });

            return result;
        } catch (error) {
            throw new BadRequestException('Failed to upload document to Cloudinary');
        }
    }

    async deleteFile(publicId: string): Promise<void> {
        try {
            await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            throw new BadRequestException('Failed to delete file from Cloudinary');
        }
    }

    async getFileInfo(publicId: string) {
        try {
            return await cloudinary.api.resource(publicId);
        } catch (error) {
            throw new BadRequestException('Failed to get file info from Cloudinary');
        }
    }
}