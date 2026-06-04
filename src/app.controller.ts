import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health() {
    return {
      message: 'OK',
      data: {
        port: process.env.PORT || 3000,
        pid: process.pid,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      }
    };
  }
  @Get('lb-test')
  lbTest() {
    return {
      message: 'OK',
      data: {
        instance: process.env.PORT,
        pid: process.pid,
      }
    };
  }
}
