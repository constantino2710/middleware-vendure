export interface AppConfig {
    httpPort: number;
    paymentServiceUrl: string;
    rabbitmqUrl: string;
    jwtSecret: string;
    logLevel: string;
}

export const APP_CONFIG = 'APP_CONFIG';

export default (): { [APP_CONFIG]: AppConfig } => ({
    [APP_CONFIG]: {
        httpPort: parseInt(process.env.HTTP_PORT ?? '8080', 10),
        paymentServiceUrl: process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:8081',
        rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672/',
        jwtSecret: process.env.JWT_SECRET ?? '',
        logLevel: process.env.LOG_LEVEL ?? 'info',
    },
});
