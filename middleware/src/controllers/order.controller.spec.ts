import { OrderService } from '../services/order.service';
import { ProcessOrderDto, ProcessOrderResponse } from './dto/process-order.dto';
import { OrderController } from './order.controller';

const dto = (): ProcessOrderDto => ({
    orderId: 'ORD-1',
    customerId: 'CUST-1',
    total: 99.9,
    currency: 'BRL',
});

describe('OrderController', () => {
    let service: jest.Mocked<Pick<OrderService, 'process'>>;
    let controller: OrderController;

    beforeEach(() => {
        service = { process: jest.fn() };
        controller = new OrderController(service as unknown as OrderService);
    });

    it('repassa o X-Correlation-ID recebido para o service', async () => {
        const expected: ProcessOrderResponse = { status: 'SUCCESS', message: 'ok' };
        service.process.mockResolvedValue(expected);

        const result = await controller.process(dto(), 'cid-do-cliente');

        expect(service.process).toHaveBeenCalledWith(dto(), 'cid-do-cliente');
        expect(result).toEqual(expected);
    });

    it('gera um UUID quando o header X-Correlation-ID está ausente', async () => {
        service.process.mockResolvedValue({ status: 'PENDING', message: 'x' });

        await controller.process(dto(), undefined);

        expect(service.process).toHaveBeenCalledTimes(1);
        const cid = service.process.mock.calls[0][1];
        // formato UUID v4
        expect(cid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('retorna a resposta do service tal qual', async () => {
        const expected: ProcessOrderResponse = { status: 'FAILED', message: 'sem saldo' };
        service.process.mockResolvedValue(expected);

        const result = await controller.process(dto(), 'cid');

        expect(result).toEqual(expected);
    });
});
