import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getStatus() {
    return this.appService.getApplicationStatus();
  }

  @Public()
  @Get('health')
  getHealthCheck() {
    return this.appService.getHealthCheck();
  }

  @Public()
  @Get('timeline')
  getElectionTimeline() {
    return this.appService.getElectionTimeline();
  }
}