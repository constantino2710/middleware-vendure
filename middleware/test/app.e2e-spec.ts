import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import {
    PAYMENT_CLIENT,
    PUBLISHER,
    PaymentClient,
    Publisher,
} from '../src/services/order.service';

const SECRET = 'test-secret';

describe('Middleware (E2E)', () => {
    let app: INestApplication;
    let payment: jest.Mocked<PaymentClient>;
    let publisher: jest.Mocked<Publisher>;

    beforeAll(async () => {
        process.env.JWT_SECRET = SECRET;
        process.env.PAYMENT_SERVICE_URL = 'http://test:8081';
        process.env.RABBITMQ_URL = 'amqp://test';

        const paymentMock = { pay: jest.fn() } as jest.Mocked<PaymentClient>;
        const publisherMock = { publish: jest.fn() } as jest.Mocked<Publisher>;
        payment = paymentMock;
        publisher = publisherMock;

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(PAYMENT_CLIENT)
            .useValue(paymentMock)
            .overrideProvider(PUBLISHER)
            .useValue(publisherMock)
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        payment.pay.mockReset();
        publisher.publish.mockReset();
    });

    const validJwt = (roles: string[] = ['service']) =>
        sign({ sub: 'tester', roles }, SECRET, { expiresIn: '1h' });

    const validBody = () => ({
        orderId: 'TEST-1',
        customerId: 'C1',
        total: 99.9,
        currency: 'BRL',
    });

    // -------------------------------------------------------------- /health
    describe('GET /health', () => {
        it('200 sem JWT (rota pública)', async () => {
            const res = await request(app.getHttpServer()).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(typeof res.body.uptime).toBe('number');
        });
    });

    // ------------------------------------------------- /process-order [SEC]
    describe('POST /process-order — segurança (P5)', () => {
        it('401 sem Authorization', async () => {
            const res = await request(app.getHttpServer())
                .post('/process-order')
                .send(validBody());
            expect(res.status).toBe(401);
        });

        it('401 com JWT inválido (assinatura errada)', async () => {
            const badJwt = sign({ sub: 'x', roles: ['service'] }, 'outro-secret');
            const res = await request(app.getHttpServer())
                .post('/process-order')
                .set('Authorization', `Bearer ${badJwt}`)
                .send(validBody());
            expect(res.status).toBe(401);
        });

        it('403 com JWT válido mas sem role "service"', async () => {
            const res = await request(app.getHttpServer())
                .post('/process-order')
                .set('Authorization', `Bearer ${validJwt(['user'])}`)
                .send(validBody());
            expect(res.status).toBe(403);
        });

        it('403 sem nenhum role no token', async () => {
            const res = await request(app.getHttpServer())
                .post('/process-order')
                .set('Authorization', `Bearer ${validJwt([])}`)
                .send(validBody());
            expect(res.status).toBe(403);
        });
    });

    // ------------------------------------------------ /process-order [VAL]
    describe('POST /process-order — validação do DTO (P1)', () => {
        const auth = () => ({ Authorization: `Bearer ${validJwt()}` });

        it('400 com corpo vazio', async () => {
            const res = await request(app.getHttpServer())
                .post('/process-order')
                .set(auth())
                .send({});
            expect(res.status).toBe(400);
        });

        it('400 com total negativo', async () => {
            const res = await request(app.getHttpServer())
                .post('/process-order')
                .set(auth())
                .send({ ...validBody(), total: -1 });
            expect(res.status).toBe(400);
        });

        it('400 com currency fora do ISO 4217 (4 letras)', async () => {
            const res = await request(app.getHttpServer())
                .post('/process-order')
                .set(auth())
                .send({ ...validBody(), currency: 'BRAZ' });
            expect(res.status).toBe(400);
        });

        it('400 com campo extra (whitelist)', async () => {
            const res = await request(app.getHttpServer())
                .post('/process-order')
                .set(auth())
                .send({ ...validBody(), hack: 'yes' });
            expect(res.status).toBe(400);
        });
    });

    // ----------------------------------------- /process-order [HAPPY PATH]
    describe('POST /process-order — fluxo (P1 + P2 mockado)', () => {
        const auth = () => ({ Authorization: `Bearer ${validJwt()}` });

        it('200 SUCCESS quando PaymentClient aprova', async () => {
            payment.pay.mockResolvedValue({ status: 'approved' });
            const res = await request(app.getHttpServer())
                .post('/process-order')
                .set(auth())
                .set('X-Correlation-ID', 'e2e-approved')
                .send(validBody());
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ status: 'SUCCESS', message: 'payment approved' });
            expect(payment.pay).toHaveBeenCalledWith('TEST-1', 99.9);
        });

        it('200 FAILED quando PaymentClient recusa', async () => {
            payment.pay.mockResolvedValue({ status: 'declined', message: 'sem saldo' });
            const res = await request(app.getHttpServer())
                .post('/process-order')
                .set(auth())
                .send(validBody());
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ status: 'FAILED' });
        });

        it('200 PENDING quando PaymentClient cai em fallback', async () => {
            payment.pay.mockResolvedValue({ status: 'fallback', message: 'gateway down' });
            const res = await request(app.getHttpServer())
                .post('/process-order')
                .set(auth())
                .send(validBody());
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ status: 'PENDING' });
        });

        it('200 PENDING quando PaymentClient lança exceção', async () => {
            payment.pay.mockRejectedValue(new Error('boom'));
            const res = await request(app.getHttpServer())
                .post('/process-order')
                .set(auth())
                .send(validBody());
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('PENDING');
            expect(res.body.message).toContain('boom');
        });
    });
});
