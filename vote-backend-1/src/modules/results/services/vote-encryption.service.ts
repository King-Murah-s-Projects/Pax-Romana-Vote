import * as crypto from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Candidate_Position } from "@prisma/client";
import { PrismaService } from "../../../../db";

// Types for encrypted vote structure
interface EncryptedVoteData {
  encryptedData: string;
  iv: string;
  authTag: string;
  timestamp: number;
}

interface VoteSelections {
  [key: string]: string; // position -> candidateId
}

interface DecryptedVoteContent {
  selections: VoteSelections;
  timestamp: number;
  version: string;
}

interface DecryptedVote {
  sessionId: string;
  voterHash: string;
  selections: Record<Candidate_Position, string>;
  timestamp: Date;
  isValid: boolean;
}

@Injectable()
export class VoteEncryptionService {
  private readonly logger = new Logger(VoteEncryptionService.name);
  private readonly algorithm = "aes-256-gcm";
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits

  private encryptionKey: Buffer;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.initializeEncryptionKey();
  }

  /**
   * Initialize encryption key from environment or generate one
   */
  private initializeEncryptionKey(): void {
    const keyHex = this.configService.get<string>("VOTE_ENCRYPTION_KEY");

    if (keyHex) {
      this.encryptionKey = Buffer.from(keyHex, "hex");
      this.logger.log("Loaded encryption key from environment");
    } else {
      // Generate a new key (for testing only - in production, use a fixed key)
      this.encryptionKey = crypto.randomBytes(this.keyLength);
      this.logger.warn(
        "Generated new encryption key - THIS SHOULD NOT HAPPEN IN PRODUCTION",
      );
      this.logger.warn(
        `Add this to your .env: VOTE_ENCRYPTION_KEY=${this.encryptionKey.toString("hex")}`,
      );
    }
  }

  /**
   * Encrypt vote selections
   */
  encryptVote(selections: Record<Candidate_Position, string>): string {
    try {
      // Create vote data structure
      const voteData: VoteSelections = {};

      // Convert enum keys to strings and validate
      for (const [position, candidateId] of Object.entries(selections)) {
        if (candidateId && candidateId.trim()) {
          voteData[position] = candidateId.trim();
        }
      }

      // Add timestamp for additional verification
      const dataToEncrypt: DecryptedVoteContent = {
        selections: voteData,
        timestamp: Date.now(),
        version: "1.0",
      };

      const plaintext = JSON.stringify(dataToEncrypt);

      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher using createCipheriv
      const cipher = crypto.createCipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );

      // Encrypt data
      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Create final encrypted structure
      const encryptedVoteData: EncryptedVoteData = {
        encryptedData: encrypted,
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
        timestamp: Date.now(),
      };

      return JSON.stringify(encryptedVoteData);
    } catch (error) {
      this.logger.error("Failed to encrypt vote:", error);
      throw new Error("Vote encryption failed");
    }
  }

  /**
   * Decrypt individual vote
   */
  decryptVote(encryptedVote: string): Record<Candidate_Position, string> {
    try {
      // Parse encrypted vote structure
      const encryptedData = JSON.parse(encryptedVote) as EncryptedVoteData;

      // Validate required fields
      if (
        !encryptedData.encryptedData ||
        !encryptedData.iv ||
        !encryptedData.authTag
      ) {
        throw new Error("Invalid encrypted vote structure");
      }

      // Convert hex strings back to buffers
      const iv = Buffer.from(encryptedData.iv, "hex");
      const authTag = Buffer.from(encryptedData.authTag, "hex");

      // Create decipher using createDecipheriv
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );
      decipher.setAuthTag(authTag);

      // Decrypt data
      let decrypted = decipher.update(
        encryptedData.encryptedData,
        "hex",
        "utf8",
      );
      decrypted += decipher.final("utf8");

      // Parse decrypted JSON
      const voteData = JSON.parse(decrypted) as DecryptedVoteContent;

      // Validate structure
      if (!voteData.selections || !voteData.timestamp) {
        throw new Error("Invalid decrypted vote structure");
      }

      // Convert back to enum-keyed record
      const selections: Record<Candidate_Position, string> = {
        PRESIDENT: "",
        VICE_PRESIDENT: "",
        GEN_SECRETARY: "",
        FINANCIAL_SECRETARY: "",
        ORGANIZING_SECRETARY_MAIN: "",
        PRO_MAIN: "",
        WOMEN_COMMISSIONER: "",
      };

      for (const [positionStr, candidateId] of Object.entries(
        voteData.selections,
      )) {
        // Validate position is a valid enum value
        if (
          Object.values(Candidate_Position).includes(
            positionStr as Candidate_Position,
          )
        ) {
          selections[positionStr as Candidate_Position] = candidateId;
        }
      }

      return selections;
    } catch (error) {
      this.logger.error("Failed to decrypt vote:", error);
      // Return an empty object instead of throwing to handle corrupted votes gracefully
      return {} as Record<Candidate_Position, string>;
    }
  }

  /**
   * Decrypt all votes (complete implementation)
   */
  async decryptAllVotes(): Promise<DecryptedVote[]> {
    const votes = await this.prisma.vote.findMany({
      where: { isValid: true },
      include: { session: true },
    });

    const decryptedVotes: DecryptedVote[] = [];
    let successCount = 0;
    let errorCount = 0;

    this.logger.log(`Starting decryption of ${votes.length} votes`);

    for (const vote of votes) {
      try {
        const decrypted = this.decryptVote(vote.encryptedVote);

        // Only include votes with valid selections
        if (Object.keys(decrypted).length > 0) {
          decryptedVotes.push({
            sessionId: vote.sessionId,
            voterHash: vote.voterHash,
            selections: decrypted,
            timestamp: vote.createdAt,
            isValid: vote.isValid,
          });
          successCount++;
        } else {
          this.logger.warn(
            `Vote ${vote.id} decrypted but contains no valid selections`,
          );
          errorCount++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        this.logger.error(
          `Failed to decrypt vote ${vote.id}: ${errorMessage}`,
          error,
        );
        errorCount++;

        // Create audit log for failed decryption
        await this.createDecryptionErrorLog(vote.id, errorMessage);
      }
    }

    this.logger.log(
      `Vote decryption completed: ${successCount} successful, ${errorCount} errors`,
    );

    return decryptedVotes;
  }

  /**
   * Validate encrypted vote structure without decrypting
   */
  validateEncryptedVote(encryptedVote: string): boolean {
    try {
      const encryptedData = JSON.parse(encryptedVote) as EncryptedVoteData;

      return !!(
        encryptedData.encryptedData &&
        encryptedData.iv &&
        encryptedData.authTag &&
        encryptedData.timestamp
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate a new encryption key (admin function)
   */
  generateNewEncryptionKey(): string {
    const newKey = crypto.randomBytes(this.keyLength);
    return newKey.toString("hex");
  }

  /**
   * Test encryption/decryption with sample data
   */
  testEncryption(): Promise<{ success: boolean; message: string }> {
    try {
      const testSelections: Record<Candidate_Position, string> = {
        [Candidate_Position.PRESIDENT]: "candidate-123",
        [Candidate_Position.VICE_PRESIDENT]: "candidate-456",
        [Candidate_Position.GEN_SECRETARY]: "candidate-789",
        [Candidate_Position.FINANCIAL_SECRETARY]: "",
        [Candidate_Position.ORGANIZING_SECRETARY_MAIN]: "",
        [Candidate_Position.PRO_MAIN]: "",
        [Candidate_Position.WOMEN_COMMISSIONER]: "",
      };

      // Test encryption
      const encrypted = this.encryptVote(testSelections);
      this.logger.log("Test encryption successful");

      // Test decryption
      const decrypted = this.decryptVote(encrypted);
      this.logger.log("Test decryption successful");

      // Verify data integrity
      const isValid =
        JSON.stringify(testSelections) === JSON.stringify(decrypted);

      if (isValid) {
        return Promise.resolve({
          success: true,
          message: "Encryption/decryption test passed",
        });
      } else {
        return Promise.resolve({
          success: false,
          message: "Data integrity check failed",
        });
      }
    } catch (error) {
      this.logger.error("Encryption test failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return Promise.resolve({
        success: false,
        message: `Test failed: ${errorMessage}`,
      });
    }
  }

  /**
   * Create audit log for decryption errors
   */
  private async createDecryptionErrorLog(
    voteId: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: "VOTE_DECRYPTION_ERROR",
          entity: "VOTE",
          entityId: voteId,
          newValues: {
            error: errorMessage,
            timestamp: new Date(),
          },
        },
      });
    } catch (error) {
      this.logger.error("Failed to create decryption error audit log:", error);
    }
  }

  /**
   * Batch decrypt votes with progress tracking
   */
  async decryptVotesWithProgress(
    onProgress?: (current: number, total: number) => void,
  ): Promise<DecryptedVote[]> {
    const votes = await this.prisma.vote.findMany({
      where: { isValid: true },
      include: { session: true },
    });

    const decryptedVotes: DecryptedVote[] = [];
    const batchSize = 100; // Process in batches to avoid memory issues

    for (let i = 0; i < votes.length; i += batchSize) {
      const batch = votes.slice(i, i + batchSize);

      for (const vote of batch) {
        try {
          const decrypted = this.decryptVote(vote.encryptedVote);

          if (Object.keys(decrypted).length > 0) {
            decryptedVotes.push({
              sessionId: vote.sessionId,
              voterHash: vote.voterHash,
              selections: decrypted,
              timestamp: vote.createdAt,
              isValid: vote.isValid,
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          this.logger.error(
            `Failed to decrypt vote ${vote.id}: ${errorMessage}`,
            error,
          );
        }

        // Report progress
        if (onProgress) {
          onProgress(i + batch.indexOf(vote) + 1, votes.length);
        }
      }

      // Small delay between batches to prevent overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return decryptedVotes;
  }
}
