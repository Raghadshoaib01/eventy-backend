import { Module, Global } from '@nestjs/common';
import { CloudinaryService } from './services/cloudinary.service';

@Global()
@Module({
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class SharedModule {}
