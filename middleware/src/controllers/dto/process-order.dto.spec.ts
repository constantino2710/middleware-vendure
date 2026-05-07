import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ProcessOrderDto } from './process-order.dto';

const validateDto = async (input: unknown) => {
    const obj = plainToInstance(ProcessOrderDto, input);
    return validate(obj);
};

const valid = { orderId: 'ORD-1', customerId: 'CUST-1', total: 99.9, currency: 'BRL' };

describe('ProcessOrderDto', () => {
    it('aceita payload válido', async () => {
        const errors = await validateDto(valid);
        expect(errors).toHaveLength(0);
    });

    it.each<[string, Record<string, unknown>, string]>([
        ['orderId vazio', { ...valid, orderId: '' }, 'orderId'],
        ['orderId não-string', { ...valid, orderId: 123 }, 'orderId'],
        ['customerId vazio', { ...valid, customerId: '' }, 'customerId'],
        ['total negativo', { ...valid, total: -10 }, 'total'],
        ['total zero', { ...valid, total: 0 }, 'total'],
        ['total não-número', { ...valid, total: 'cem' }, 'total'],
        ['currency com 2 letras', { ...valid, currency: 'BR' }, 'currency'],
        ['currency com 4 letras', { ...valid, currency: 'BRAZ' }, 'currency'],
    ])('rejeita: %s', async (_label, input, propEsperada) => {
        const errors = await validateDto(input);
        const propsComErro = errors.map(e => e.property);
        expect(propsComErro).toContain(propEsperada);
    });

    it('rejeita múltiplos campos inválidos de uma só vez', async () => {
        const errors = await validateDto({ orderId: '', customerId: '', total: -1, currency: 'XX' });
        const props = errors.map(e => e.property).sort();
        expect(props).toEqual(['currency', 'customerId', 'orderId', 'total']);
    });
});
