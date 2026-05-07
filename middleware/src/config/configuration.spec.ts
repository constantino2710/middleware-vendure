import configuration, { APP_CONFIG } from './configuration';

describe('configuration', () => {
    const ORIGINAL = process.env;

    afterEach(() => {
        process.env = ORIGINAL;
    });

    it('lê valores das variáveis de ambiente', () => {
        process.env = {
            ...ORIGINAL,
            HTTP_PORT: '9090',
            PAYMENT_SERVICE_URL: 'http://x:1',
            RABBITMQ_URL: 'amqp://y',
            JWT_SECRET: 'sek',
            LOG_LEVEL: 'debug',
        };

        const cfg = configuration()[APP_CONFIG];

        expect(cfg).toEqual({
            httpPort: 9090,
            paymentServiceUrl: 'http://x:1',
            rabbitmqUrl: 'amqp://y',
            jwtSecret: 'sek',
            logLevel: 'debug',
        });
    });

    it('aplica defaults quando env não está setada', () => {
        process.env = { ...ORIGINAL };
        delete process.env.HTTP_PORT;
        delete process.env.PAYMENT_SERVICE_URL;
        delete process.env.RABBITMQ_URL;
        delete process.env.JWT_SECRET;
        delete process.env.LOG_LEVEL;

        const cfg = configuration()[APP_CONFIG];

        expect(cfg.httpPort).toBe(8080);
        expect(cfg.paymentServiceUrl).toBe('http://localhost:8081');
        expect(cfg.rabbitmqUrl).toBe('amqp://guest:guest@localhost:5672/');
        expect(cfg.jwtSecret).toBe('');
        expect(cfg.logLevel).toBe('info');
    });

    it('converte HTTP_PORT de string para number', () => {
        process.env = { ...ORIGINAL, HTTP_PORT: '3030' };
        const cfg = configuration()[APP_CONFIG];
        expect(cfg.httpPort).toBe(3030);
        expect(typeof cfg.httpPort).toBe('number');
    });
});
