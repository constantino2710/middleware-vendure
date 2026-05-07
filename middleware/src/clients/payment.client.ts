// Pessoa 2 — Resiliência + HTTP Client
//
// Requisitos (seção 10 contexto-geral):
//   - Retry: 3 tentativas com backoff 1s → 2s → 4s
//   - Timeout: 2s por tentativa
//   - Fallback: { status: 'fallback' } quando todas as tentativas falham
//   - (opcional) opossum para circuit breaker

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import { PaymentClient, PaymentResult } from '../services/order.service';

@Injectable()
export class HttpPaymentClient implements PaymentClient {
    private readonly logger = new Logger(HttpPaymentClient.name);
    private readonly baseUrl = process.env.PAYMENT_SERVICE_URL!;

    // Config de retry. Variáveis de env existem só pra acelerar testes
    // unitários (PAYMENT_RETRY_MIN_TIMEOUT=1). Em produção usa os defaults.
    private readonly retry = {
        retries: parseInt(process.env.PAYMENT_RETRIES ?? '3', 10),
        factor: parseInt(process.env.PAYMENT_RETRY_FACTOR ?? '2', 10),
        minTimeout: parseInt(process.env.PAYMENT_RETRY_MIN_TIMEOUT ?? '1000', 10),
    };

    async pay(orderId: string, total: number): Promise<PaymentResult> {
        // p-retry v6 é ESM-only — import dinâmico evita ERR_REQUIRE_ESM em runtime CJS
        const { default: pRetry } = await import('p-retry');

        const makeRequest = async (): Promise<PaymentResult> => {
            const response = await axios.post(
                `${this.baseUrl}/pay`,
                { orderId, amount: total },
                { timeout: 2000 },
            );
            const status = response.data?.status;
            if (status !== 'approved' && status !== 'declined') {
                throw new Error(
                    `unexpected payment-service response: ${JSON.stringify(response.data)}`,
                );
            }
            return { status };
        };

        try {
            return await pRetry(makeRequest, {
                retries: this.retry.retries,
                factor: this.retry.factor,
                minTimeout: this.retry.minTimeout,
                onFailedAttempt: error => {
                    this.logger.warn(
                        `payment retry order=${orderId} attemptsLeft=${error.retriesLeft} err=${error.message}`,
                    );
                },
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`payment fallback order=${orderId} err=${message}`);
            return { status: 'fallback', message };
        }
    }
}
