import { HealthController } from './health.controller';

describe('HealthController', () => {
    it('retorna status ok e uptime', () => {
        const res = new HealthController().check();
        expect(res.status).toBe('ok');
        expect(typeof res.uptime).toBe('number');
        expect(res.uptime).toBeGreaterThanOrEqual(0);
    });
});
