// src/modules/notifications/dto/save-device-token.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Platform } from '@prisma/client';

export class SaveDeviceTokenDto {
  @ApiProperty({
    description: 'FCM / APNs device token',
    example: 'fYHh3W...long-token...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    enum: Platform,
    description: 'The client platform this token belongs to',
    example: Platform.ANDROID,
  })
  @IsEnum(Platform)
  platform: Platform;
}
