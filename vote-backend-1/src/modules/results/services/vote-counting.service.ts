import {Injectable, Logger} from "@nestjs/common";
import {PrismaService} from "../../../../db";
import {CacheService} from "../../caches/cache.service";
import {PositionResult, VoteCount} from "../types/results.types";
import {Candidate_Position, UserRole} from "@prisma/client/index";
import {CertificationStatus, ResultStatus} from "../enums/result-status.enum";

@Injectable()
export class VoteCountingService {
    private readonly logger = new Logger(VoteCountingService.name);
    private readonly UNOPPOSED_THRESHOLD = 0.5; // 50% threshold for unopposed candidates

    constructor(
        private prisma: PrismaService,
        private cacheService: CacheService,
    ) {}

    /**
     * Count votes for all positions
     */
    async countAllVotes(): Promise<PositionResult[]> {
        const positions = Object.values(Candidate_Position);
        const results: PositionResult[] = [];

        for (const position of positions) {
            const result = await this.countVotesForPosition(position);
            results.push(result);
        }

        return results;
    }

    /**
     * Count votes for specific position
     */
    async countVotesForPosition(position: Candidate_Position, useCache = true): Promise<PositionResult> {
        const cacheKey = `position_results:${position}`;

        if (useCache) {
            const cached = await this.cacheService.get(cacheKey);
            if (cached) {
                return cached as PositionResult;
            }
        }

        this.logger.log(`Counting votes for position: ${position}`);

        // Get candidates for this position
        const candidates = await this.prisma.candidate.findMany({
            where: { position, isActive: true },
            include: { nomination: true },
            orderBy: { candidateNumber: 'asc' },
        });

        if (candidates.length === 0) {
            return this.createEmptyPositionResult(position);
        }

        // Get total eligible voters
        const totalEligibleVoters = await this.prisma.user.count({
            where: { role: UserRole.VOTER, isActive: true },
        });

        // Count from anonymous Ballot rows (post-close tally, ADR-0004)
        const ballotGroups = await this.prisma.ballot.groupBy({
            by: ['candidateId'],
            where: { position },
            _count: { candidateId: true },
        });

        const positionVotes: string[] = ballotGroups.flatMap(g =>
            Array(g._count.candidateId).fill(g.candidateId)
        );

        const totalVotes = positionVotes.length;
        const turnoutPercentage = totalEligibleVoters > 0
            ? (totalVotes / totalEligibleVoters) * 100
            : 0;

        // Count votes per candidate
        const voteCounts = this.countVotesPerCandidate(candidates, positionVotes, totalVotes);

        // Determine winners and status
        const isUnopposed = candidates.length === 1;
        const winner = this.determineWinner(voteCounts, isUnopposed, totalEligibleVoters);
        const requiresRunoff = this.checkRunoffRequired(voteCounts);
        const unopposedThresholdMet = isUnopposed
            ? voteCounts[0]?.voteCount >= (totalEligibleVoters * this.UNOPPOSED_THRESHOLD)
            : true;

        const result: PositionResult = {
            position,
            totalVotes,
            totalEligibleVoters,
            turnoutPercentage: Math.round(turnoutPercentage * 100) / 100,
            candidates: voteCounts,
            status: this.determineResultStatus(voteCounts, isUnopposed, unopposedThresholdMet),
            certificationStatus: CertificationStatus.NOT_CERTIFIED,
            winner,
            requiresRunoff,
            unopposedThresholdMet,
        };

        // Cache result for 1 minute
        await this.cacheService.set(cacheKey, result, 60);

        return result;
    }

    /**
     * Clear all result cache
     */
    async clearResultsCache(): Promise<void> {
        const positions = Object.values(Candidate_Position);
        for (const position of positions) {
            await this.cacheService.del(`position_results:${position}`);
        }
        await this.cacheService.del('all_results_summary');
        this.logger.log('Results cache cleared');
    }

    /**
     * Count votes per candidate
     */
    private countVotesPerCandidate(
        candidates: any[],
        positionVotes: string[],
        totalVotes: number
    ): VoteCount[] {
        const voteCounts: VoteCount[] = [];

        for (const candidate of candidates) {
            const voteCount = positionVotes.filter(vote => vote === candidate.id).length;
            const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

            voteCounts.push({
                candidateId: candidate.id,
                candidateName: candidate.name,
                candidateNumber: candidate.candidateNumber,
                position: candidate.position,
                voteCount,
                percentage: Math.round(percentage * 100) / 100,
                isWinner: false, // Will be determined later
                isRunnerUp: false, // Will be determined later
                isUnopposed: candidates.length === 1,
            });
        }

        // Sort by vote count (descending)
        voteCounts.sort((a, b) => b.voteCount - a.voteCount);

        // Mark winner and runner-up
        if (voteCounts.length > 0) {
            voteCounts[0].isWinner = true;
            if (voteCounts.length > 1 && voteCounts[1].voteCount > 0) {
                voteCounts[1].isRunnerUp = true;
            }
        }

        return voteCounts;
    }

    /**
     * Determine winner based on rules
     */
    private determineWinner(
        voteCounts: VoteCount[],
        isUnopposed: boolean,
        totalEligibleVoters: number
    ): VoteCount | undefined {
        if (voteCounts.length === 0) return undefined;

        const topCandidate = voteCounts[0];

        if (isUnopposed) {
            // Unopposed candidate must get 50% of eligible voters
            const threshold = totalEligibleVoters * this.UNOPPOSED_THRESHOLD;
            return topCandidate.voteCount >= threshold ? topCandidate : undefined;
        } else {
            // Contested position - simple majority wins
            return topCandidate.voteCount > 0 ? topCandidate : undefined;
        }
    }

    /**
     * Check if a runoff election is required
     */
    private checkRunoffRequired(voteCounts: VoteCount[]): boolean {
        if (voteCounts.length < 2) return false;

        // Runoff required if the top two candidates are tied
        return voteCounts[0].voteCount === voteCounts[1].voteCount && voteCounts[0].voteCount > 0;
    }

    /**
     * Determine overall result status
     */
    private determineResultStatus(
        voteCounts: VoteCount[],
        isUnopposed: boolean,
        unopposedThresholdMet: boolean
    ): ResultStatus {
        if (voteCounts.length === 0) return ResultStatus.PENDING;

        if (isUnopposed && !unopposedThresholdMet) {
            return ResultStatus.DISPUTED; // Unopposed candidate didn't reach a threshold
        }

        if (this.checkRunoffRequired(voteCounts)) {
            return ResultStatus.DISPUTED; // Tie requires runoff
        }

        return ResultStatus.PROVISIONAL; // Clear winner, pending certification
    }

    /**
     * Create an empty result for positions with no candidates
     */
    private createEmptyPositionResult(position: Candidate_Position): PositionResult {
        return {
            position,
            totalVotes: 0,
            totalEligibleVoters: 0,
            turnoutPercentage: 0,
            candidates: [],
            status: ResultStatus.PENDING,
            certificationStatus: CertificationStatus.NOT_CERTIFIED,
            requiresRunoff: false,
            unopposedThresholdMet: false,
        };
    }

}