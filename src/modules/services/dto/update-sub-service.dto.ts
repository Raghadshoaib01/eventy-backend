import { PartialType } from '@nestjs/swagger';
import { CreateSubServiceDto } from './create-sub-service.dto';

export class UpdateSubServiceDto extends PartialType(
  CreateSubServiceDto,
) {
  
}