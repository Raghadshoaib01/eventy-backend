import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsArray, IsUUID } from 'class-validator';

// DTO للموافقة/رفض انضمام مزود خدمة جديد
export class ApproveProviderJoinDto {
  @ApiProperty({ 
    example: 'uuid-of-provider',
    description: 'معرف مزود الخدمة'
  })
  @IsUUID()
  @IsNotEmpty()
  providerId: string;

  @ApiProperty({ 
    example: 'uuid-of-service',
    description: 'معرف الخدمة الأولية'
  })
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ 
    example: true,
    description: 'true للقبول، false للرفض'
  })
  @IsBoolean()
  @IsNotEmpty()
  isApproved: boolean;

  @ApiProperty({ 
    example: 'يرجى تحديث معلومات الترخيص',
    required: false,
    description: 'رسالة إدارية اختيارية (سبب الرفض أو ملاحظات)'
  })
  @IsString()
  @IsOptional()
  adminMessage?: string;
}

// DTO للموافقة/رفض خدمة جديدة
export class ApproveServiceDto {
  @ApiProperty({ 
    example: 'uuid-of-service',
    description: 'معرف الخدمة'
  })
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ 
    example: true,
    description: 'true للقبول، false للرفض'
  })
  @IsBoolean()
  @IsNotEmpty()
  isApproved: boolean;

  @ApiProperty({ 
    example: ['uuid-sub1', 'uuid-sub2'],
    required: false,
    description: 'معرفات الخدمات الفرعية المقبولة'
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  approvedSubServiceIds?: string[];

  @ApiProperty({ 
    example: ['uuid-sub3', 'uuid-sub4'],
    required: false,
    description: 'معرفات الخدمات الفرعية المرفوضة'
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  rejectedSubServiceIds?: string[];

  @ApiProperty({ 
    example: 'يرجى تحسين جودة الصور',
    required: false,
    description: 'رسالة إدارية اختيارية'
  })
  @IsString()
  @IsOptional()
  adminMessage?: string;
}

// DTO للموافقة/رفض خدمة فرعية جديدة
export class ApproveSubServiceDto {
  @ApiProperty({ 
    example: 'uuid-of-subservice',
    description: 'معرف الخدمة الفرعية'
  })
  @IsUUID()
  @IsNotEmpty()
  subServiceId: string;

  @ApiProperty({ 
    example: true,
    description: 'true للقبول، false للرفض'
  })
  @IsBoolean()
  @IsNotEmpty()
  isApproved: boolean;

  @ApiProperty({ 
    example: 'السعر غير مناسب',
    required: false,
    description: 'رسالة إدارية اختيارية'
  })
  @IsString()
  @IsOptional()
  adminMessage?: string;
}
