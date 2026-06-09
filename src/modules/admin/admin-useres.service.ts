import { Injectable } from '@nestjs/common';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

@Injectable()
export class AdminUseresService {

    async getPendingProviders(  paginationDto: PaginationDto,) {
        //مع  + paginationfindManyapprovalStatus: PENDING
  return {
    message: 'Get pending providers is not implemented yet',
  };
}

async getProviderDetails(  providerId: string,) {
    // جلب provider مع user + service + serviceType + files
  return {
    message: 'Get provider details is not implemented yet',
  };
}
}
