import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { PrismaService } from '../../../db';
import { CacheModule } from '../caches/cache.module';
import { FileUploadModule } from '../file-upload/file-upload.module';

@Module({
    imports: [
        CacheModule,
        FileUploadModule,
    ],
    controllers: [CandidatesController],
    providers: [CandidatesService, PrismaService],
    exports: [CandidatesService],
})
export class CandidatesModule {}