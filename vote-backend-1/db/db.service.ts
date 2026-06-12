import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from "@prisma/client";
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor(private configService: ConfigService) {
        const connectionString = configService.get<string>('DATABASE_URL');
        const pool = new Pool({ connectionString });
        const adapter = new PrismaPg(pool);

        super({
            adapter,
            // Enhanced transaction configuration to prevent P2028 errors
            transactionOptions: {
                maxWait: 5000, // 5 seconds max wait time for transaction to start
                timeout: 15000, // 15 seconds timeout for transaction execution
                isolationLevel: 'ReadCommitted', // Less restrictive isolation level
            },
            log: [
                {
                    emit: 'event',
                    level: 'query',
                },
                {
                    emit: 'event',
                    level: 'error',
                },
                {
                    emit: 'event',
                    level: 'info',
                },
                {
                    emit: 'event',
                    level: 'warn',
                },
            ],
        });

        // Set up log event handlers
        //@ts-ignore
        this.$on('query', (e) => {
            //@ts-ignore
            if (e.duration > 1000) { // Log slow queries (>1s)
                //@ts-ignore
                this.logger.warn(`Slow query detected: ${e.query} (${e.duration}ms)`);
            }
        });

        //@ts-ignore
        this.$on('error', (e) => {
            this.logger.error('Prisma error:', e);
        });

        //@ts-ignore
        this.$on('warn', (e) => {
            this.logger.warn('Prisma warning:', e);
        });

        //@ts-ignore
        this.$on('info', (e) => {
            this.logger.log('Prisma info:', e);
        });

        this.logger.log('Instantiating PrismaService with enhanced transaction configuration');
    }

    async onModuleInit() {
        try {
            await this.$connect();
            this.logger.log('Successfully connected to database');

            // Test connection with a simple query
            await this.isHealthy();
        } catch (error) {
            this.logger.error('Failed to connect to database', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        try {
            await this.$disconnect();
            this.logger.log('Database connection closed');
        } catch (error) {
            this.logger.error('Error closing database connection', error);
        }
    }

    // Enhanced transaction wrapper with retry logic
    async safeTransaction<T>(
        callback: (prisma: PrismaClient) => Promise<T>,
        retries: number = 3,
        options?: {
            maxWait?: number;
            timeout?: number;
            isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
        }
    ): Promise<T> {
        const transactionOptions = {
            maxWait: options?.maxWait || 5000,
            timeout: options?.timeout || 15000,
            isolationLevel: options?.isolationLevel || 'ReadCommitted',
        };

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                this.logger.debug(`Transaction attempt ${attempt}/${retries}`);

                const result = await this.$transaction(callback, transactionOptions);

                if (attempt > 1) {
                    this.logger.log(`Transaction succeeded on attempt ${attempt}`);
                }

                return result;
            } catch (error: any) {
                const isLastAttempt = attempt === retries;
                const isRetryableError = this.isRetryableError(error);

                this.logger.warn(
                    `Transaction attempt ${attempt}/${retries} failed: ${error.message}`,
                    { code: error.code, retryable: isRetryableError }
                );

                if (isLastAttempt || !isRetryableError) {
                    this.logger.error(`Transaction failed after ${attempt} attempts:`, error);
                    throw error;
                }

                // Exponential backoff with jitter
                const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                const jitter = Math.random() * 500; // Add up to 500ms jitter
                const delay = baseDelay + jitter;

                this.logger.debug(`Retrying transaction in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw new Error('This should never be reached');
    }

    // Check if an error is retryable
    private isRetryableError(error: any): boolean {
        const retryableCodes = [
            'P2028', // Transaction API error: Unable to start a transaction in the given time
            'P2034', // The Transaction failed due to a writing conflict or a deadlock
            'P1017', // The Server has closed the connection
            'P1001', // Can't reach database server
        ];

        return retryableCodes.includes(error.code) ||
            error.message?.includes('timeout') ||
            error.message?.includes('connection') ||
            error.message?.includes('deadlock');
    }

    // Optimized batch operations
    async batchOperation<T>(
        operations: (() => Promise<T>)[],
        batchSize: number = 10
    ): Promise<T[]> {
        const results: T[] = [];

        for (let i = 0; i < operations.length; i += batchSize) {
            const batch = operations.slice(i, i + batchSize);
            this.logger.debug(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(operations.length / batchSize)}`);

            try {
                const batchResults = await Promise.all(batch.map(op => op()));
                results.push(...batchResults);
            } catch (error) {
                this.logger.error(`Batch operation failed at batch ${Math.floor(i / batchSize) + 1}:`, error);
                throw error;
            }

            // Small delay between batches to prevent overwhelming the database
            if (i + batchSize < operations.length) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        return results;
    }

    // Helper methods
    async cleanDb() {
        if (process.env.NODE_ENV === 'production') {
            this.logger.warn('Cannot clean database in production environment');
            return;
        }

        this.logger.log('Cleaning database...');

        // Define the order of deletion to respect foreign key constraints
        const tablesToClean = [
            'votes',
            'votingSessions',
            'candidates',
            'ecReviews',
            'guarantorVerifications',
            'nominatorVerifications',
            'nominations',
            'verificationTokens',
            'auditLogs',
            'users',
            'subgroups',
            'programmes',
            'systemConfig',
            'electionTimeline',
        ];

        try {
            // Use safe transaction for cleaning operations
            await this.safeTransaction(async (prisma) => {
                // Delete in batches to prevent long-running transactions
                for (const table of tablesToClean) {
                    if (prisma[table]) {
                        // Delete in smaller chunks for large tables
                        let deletedCount = 0;
                        let batchCount = 0;

                        do {
                            const batch = await prisma[table].deleteMany({
                                take: 1000, // Delete 1000 records at a time
                            });
                            deletedCount = batch.count;
                            batchCount++;

                            if (deletedCount > 0) {
                                this.logger.debug(`Cleaned ${deletedCount} records from ${table} (batch ${batchCount})`);
                            }
                        } while (deletedCount > 0);

                        this.logger.log(`Cleaned ${table} table`);
                    }
                }

                return true;
            }, 1, { timeout: 30000 }); // Longer timeout for cleanup operations

            this.logger.log('Database cleaned successfully');
        } catch (error) {
            this.logger.error('Error cleaning database', error);
            throw error;
        }
    }

    // Enhanced health check method
    async isHealthy(): Promise<boolean> {
        try {
            const start = Date.now();
            await this.$queryRaw`SELECT 1 as health_check`;
            const duration = Date.now() - start;

            if (duration > 1000) {
                this.logger.warn(`Database health check slow: ${duration}ms`);
            }

            return true;
        } catch (error) {
            this.logger.error('Database health check failed', error);
            return false;
        }
    }

    // Connection pool monitoring
    async getConnectionInfo(): Promise<{
        activeConnections: number;
        maxConnections: number;
        waitingConnections: number;
    }> {
        try {
            const result = await this.$queryRaw<Array<{
                active_connections: number;
                max_connections: number;
                waiting_connections: number;
            }>>`
                SELECT 
                    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
                    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
                    0 as waiting_connections
            `;

            const info = {
                activeConnections: result[0]?.active_connections || 0,
                maxConnections: result[0]?.max_connections || 0,
                waitingConnections: result[0]?.waiting_connections || 0,
            };

            this.logger.debug('Connection info:', info);
            return info;
        } catch (error) {
            this.logger.error('Failed to get connection info:', error);
            return {
                activeConnections: -1,
                maxConnections: -1,
                waitingConnections: -1,
            };
        }
    }
}