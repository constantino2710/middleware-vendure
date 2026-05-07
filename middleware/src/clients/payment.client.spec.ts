import axios from 'axios';

import { HttpPaymentClient } from './payment.client';

jest.mock('axios');

// p-retry@6 é ESM-only e não roda dentro do Jest sem transform extra.
// O mock abaixo replica o comportamento (1 + retries tentativas, chama
// onFailedAttempt em cada falha) sem usar setTimeout real — testes rápidos.
jest.mock('p-retry', () => ({
    __esModule: true,
    default: async (fn: () => Promise<unknown>, options: {
        retries: number;
        onFailedAttempt?: (e: { retriesLeft: number; message: string }) => void | Promise<void>;
    }) => {
        const total = options.retries + 1;
        let lastErr: unknown;
        for (let i = 0; i < total; i++) {
            try {
                return await fn();
            } catch (err) {
                lastErr = err;
                if (options.onFailedAttempt) {
                    await options.onFailedAttempt({
                        retriesLeft: total - 1 - i,
                        message: err instanceof Error ? err.message : String(err),
                    });
                }
            }
        }
        throw lastErr;
    },
}));

const mockAxios = axios as jest.Mocked<typeof axios>;

describe('HttpPaymentClient', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        process.env = {
            ...ORIGINAL_ENV,
            PAYMENT_SERVICE_URL: 'http://test',
        };
        jest.clearAllMocks();
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('retorna approved e POSTa em /pay com payload correto', async () => {
        mockAxios.post.mockResolvedValueOnce({
            data: { status: 'approved' },
        } as never);

        const client = new HttpPaymentClient();
        const result = await client.pay('O1', 100);

        expect(result).toEqual({ status: 'approved' });
        expect(mockAxios.post).toHaveBeenCalledTimes(1);
        expect(mockAxios.post).toHaveBeenCalledWith(
            'http://test/pay',
            { orderId: 'O1', amount: 100 },
            { timeout: 2000 },
        );
    });

    it('retorna declined sem retry', async () => {
        mockAxios.post.mockResolvedValueOnce({
            data: { status: 'declined' },
        } as never);

        const client = new HttpPaymentClient();
        const result = await client.pay('O2', 50);

        expect(result).toEqual({ status: 'declined' });
        expect(mockAxios.post).toHaveBeenCalledTimes(1);
    });

    it('faz 4 tentativas (1 + 3 retries) e retorna fallback em erro persistente', async () => {
        mockAxios.post.mockRejectedValue(
            new Error('Request failed with status code 500'),
        );

        const client = new HttpPaymentClient();
        const result = await client.pay('O3', 10);

        expect(result.status).toBe('fallback');
        expect(result.message).toContain('500');
        expect(mockAxios.post).toHaveBeenCalledTimes(4);
    });

    it('retorna fallback quando payment-service responde formato inesperado', async () => {
        mockAxios.post.mockResolvedValue({
            data: { status: 'unknown' },
        } as never);

        const client = new HttpPaymentClient();
        const result = await client.pay('O4', 1);

        expect(result.status).toBe('fallback');
        // formato inesperado é tratado como erro e dispara retry — 4 tentativas
        expect(mockAxios.post).toHaveBeenCalledTimes(4);
    });

    it('retorna fallback em timeout do axios', async () => {
        const timeoutError = new Error('timeout of 2000ms exceeded');
        (timeoutError as Error & { code: string }).code = 'ECONNABORTED';
        mockAxios.post.mockRejectedValue(timeoutError);

        const client = new HttpPaymentClient();
        const result = await client.pay('O5', 1);

        expect(result.status).toBe('fallback');
        expect(result.message).toContain('timeout');
        expect(mockAxios.post).toHaveBeenCalledTimes(4);
    });
});
