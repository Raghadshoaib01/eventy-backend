import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReplyComplaintDto {
  @ApiProperty({ example: 'Thank you for reporting this — we have addressed it with the provider.' })
  @IsNotEmpty()
  @IsString()
  adminReply: string;
}
