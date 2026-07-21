import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReplyReviewDto {
  @ApiProperty({ example: 'Thank you so much for your kind words!' })
  @IsNotEmpty()
  @IsString()
  providerReply: string;
}
