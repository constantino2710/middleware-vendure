import { ProcessOrderDto } from '../controllers/dto/process-order.dto';
import { OrderService, PaymentClient, PaymentResult, Publisher } from './order.service';

const dto = (): ProcessOrderDto => ({
    orderId: 'ORD-1',
    customerId: 'CUST-1',
    total: 100,
    currency: 'BRL',
});

const cid = 'cid-test';

const makePaymentClient = (result: PaymentResult): PaymentClient => ({
    pay: jest.fn().mockResolvedValue(result),
});

const makePublisher = (): jest.Mocked<Publisher> => ({
    publish: jest.fn().mockResolvedValue(undefined),
});

describe('OrderService', () => {
    it('returns PENDING when PaymentClient is not registered', async () => {
        const service = new OrderService();
        const res = await service.process(dto(), cid);
        expect(res).toEqual({ status: 'PENDING', message: 'payment client unavailable' });
    });

    it('returns SUCCESS and publishes order.paid when payment is approved', async () => {
        const payment = makePaymentClient({ status: 'approved' });
        const publisher = makePublisher();
        const service = new OrderService(payment, publisher);

        const res = await service.process(dto(), cid);

        expect(res.status).toBe('SUCCESS');
        expect(payment.pay).toHaveBeenCalledWith('ORD-1', 100);
        expect(publisher.publish).toHaveBeenCalledWith(
            'order.paid',
            expect.objectContaining({ orderId: 'ORD-1', status: 'PAID', correlation_id: cid }),
        );
    });

    it('returns FAILED and publishes order.failed when payment is declined', async () => {
        const payment = makePaymentClient({ status: 'declined', message: 'no funds' });
        const publisher = makePublisher();
        const service = new OrderService(payment, publisher);

        const res = await service.process(dto(), cid);

        expect(res).toEqual({ status: 'FAILED', message: 'no funds' });
        expect(publisher.publish).toHaveBeenCalledWith(
            'order.failed',
            expect.objectContaining({ orderId: 'ORD-1', status: 'FAILED', correlation_id: cid }),
        );
    });

    it('returns PENDING and does NOT publish on fallback', async () => {
        const payment = makePaymentClient({ status: 'fallback', message: 'gateway timeout' });
        const publisher = makePublisher();
        const service = new OrderService(payment, publisher);

        const res = await service.process(dto(), cid);

        expect(res).toEqual({ status: 'PENDING', message: 'gateway timeout' });
        expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('returns PENDING when PaymentClient throws', async () => {
        const payment: PaymentClient = {
            pay: jest.fn().mockRejectedValue(new Error('boom')),
        };
        const publisher = makePublisher();
        const service = new OrderService(payment, publisher);

        const res = await service.process(dto(), cid);

        expect(res.status).toBe('PENDING');
        expect(res.message).toContain('boom');
        expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('still returns SUCCESS when Publisher is missing on approved', async () => {
        const payment = makePaymentClient({ status: 'approved' });
        const service = new OrderService(payment, undefined);

        const res = await service.process(dto(), cid);

        expect(res.status).toBe('SUCCESS');
    });

    it('still returns SUCCESS when publishing order.paid fails', async () => {
        const payment = makePaymentClient({ status: 'approved' });
        const publisher: jest.Mocked<Publisher> = {
            publish: jest.fn().mockRejectedValue(new Error('rabbit down')),
        };
        const service = new OrderService(payment, publisher);

        const res = await service.process(dto(), cid);

        expect(res.status).toBe('SUCCESS');
        expect(publisher.publish).toHaveBeenCalledWith(
            'order.paid',
            expect.objectContaining({ orderId: 'ORD-1', status: 'PAID', correlation_id: cid }),
        );
    });
});
