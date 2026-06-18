import {CanActivate, ExecutionContext, ForbiddenException, Injectable} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { EcConsensusService } from "../utils/ec-consensus.service";

@Injectable()
export class EcConsensusGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private ecConsensusService: EcConsensusService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const { user, body } = request;

        if (!user) {
            throw new ForbiddenException('Authentication required');
        }

        if (!body?.nominationId) {
            throw new ForbiddenException('nominationId is required');
        }

        const canProceed = await this.ecConsensusService.canMemberVote(
            user.id,
            body.nominationId,
        );

        if (!canProceed) {
            throw new ForbiddenException('You have already voted on this nomination');
        }

        return true;
    }
}