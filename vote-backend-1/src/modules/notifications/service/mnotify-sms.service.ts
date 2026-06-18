import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { SmsMessageDto, BulkSmsDto } from '../dto/sms-message.dto';

@Injectable()
export class MnotifySmsService {
    private readonly logger = new Logger(MnotifySmsService.name);
    private readonly apiKey: string;
    private readonly apiUrl: string;
    private readonly senderName: string;
    private readonly axiosInstance: AxiosInstance;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('MNOTIFY_API_KEY');
        if (!apiKey) {
            throw new Error('MNOTIFY_API_KEY is not configured');
        }
        this.apiKey = apiKey;
        this.apiUrl = 'https://api.mnotify.com/api/sms/quick';
        this.senderName = this.configService.get<string>('MNOTIFY_SENDER_ID') || 'PAX_ROMANA';

        this.axiosInstance = axios.create({
            baseURL: this.apiUrl,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`
            },
        });

        this.logger.log(`MnotifySmsService initialized with API URL: ${this.apiUrl}, Sender ID: ${this.senderName}`);
    }

    async sendSms(smsDto: SmsMessageDto): Promise<{ success: boolean; messageId?: string; error?: string }> {
        try {
            const response: AxiosResponse = await this.axiosInstance.post('', {
                recipient: [smsDto.to],
                sender: smsDto.senderName || this.senderName,
                message: smsDto.message,
                is_schedule: false,
                schedule_date: '',
            });

            this.logger.log(`SMS sent successfully to ${smsDto.to}: ${JSON.stringify(response.data)}`);
            return {
                success: response.data.status === 'success',
                messageId: response.data.id || response.data.message_id,
            };
        } catch (error: any) {
            this.logger.error(`Failed to send SMS to ${smsDto.to}: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    // async sendBulkSms(bulkSmsDto: BulkSmsDto): Promise<{ success: boolean; results: any[] }> {
    //     const results = [];
    //
    //     for (const recipient of bulkSmsDto.recipients) {
    //         const result = await this.sendSms({
    //             to: recipient,
    //             message: bulkSmsDto.message,
    //             senderName: bulkSmsDto.senderName,
    //         });
    //         // @ts-ignore
    //         results.push({ recipient, ...result });
    //     }
    //
    //     return {
    //         success: results.every(r => r.success),
    //         results,
    //     };
    // }

    async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
        const message = `Your Pax Romana KNUST verification code is: ${code}. Valid for 10 minutes.`;
        const result = await this.sendSms({
            to: phoneNumber,
            message,
        });
        return result.success;
    }

    async sendNominationStatusUpdate(phoneNumber: string, status: string, reason?: string): Promise<boolean> {
        let message = `Pax Romana KNUST: Your nomination status has been updated to ${status}.`;
        if (reason) {
            message += ` Reason: ${reason}`;
        }
        message += ' Visit the portal for more details.';

        const result = await this.sendSms({
            to: phoneNumber,
            message,
        });
        return result.success;
    }
}