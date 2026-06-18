import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { BallotService, BallotSelection } from './ballot.service';

class CastBallotDto {
  ballotToken: string;
  selections: BallotSelection[];
}

// No JwtAuthGuard — the ballot token from check-in IS the credential (ADR-0005)
@Controller('voting')
export class BallotController {
  constructor(private readonly ballotService: BallotService) {}

  @Post('cast')
  @HttpCode(HttpStatus.CREATED)
  cast(@Body() dto: CastBallotDto) {
    return this.ballotService.cast(dto);
  }
}
