import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, NotContains } from 'class-validator';

export class ChangePasswordDto {

  @ApiProperty({ example: '********' })
@IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ example: '********' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
