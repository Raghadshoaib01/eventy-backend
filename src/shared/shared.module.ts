import { Module, Global } from '@nestjs/common';
import { CloudinaryService } from './services/cloudinary.service';
import { EngagementService } from './services/engagement.service';

@Global()
@Module({
  providers: [CloudinaryService, EngagementService],
  exports: [CloudinaryService, EngagementService],
})
export class SharedModule {}
