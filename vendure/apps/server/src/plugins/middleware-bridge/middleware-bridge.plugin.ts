import { OnApplicationBootstrap } from '@nestjs/common';
import {
    EventBus,
    Logger,
    OrderStateTransitionEvent,
    PluginCommonModule,
    VendurePlugin,
} from '@vendure/core';
import { randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';
import { filter } from 'rxjs/operators';

const loggerCtx = 'MiddlewareBridgePlugin';

// Sub e roles do JWT que o Vendure assina pra chamar o middleware.
// Tem que bater com o que o middleware exige (@Roles('service') no OrderController).
const JWT_SUBJECT = 'vendure-bridge';
const JWT_ROLES = ['service'];
const JWT_EXPIRES_IN = '1h';

@VendurePlugin({
    imports: [PluginCommonModule],
    compatibility: '^3.0.0',
})
export class MiddlewareBridgePlugin implements OnApplicationBootstrap {
    constructor(private eventBus: EventBus) {}

    onApplicationBootstrap() {
        this.eventBus
            .ofType(OrderStateTransitionEvent)
            .pipe(filter(event => event.toState === 'ArrangingPayment'))
            .subscribe(async event => {
                const order = event.order;
                const correlationId = randomUUID();

                const middlewareUrl = process.env.MIDDLEWARE_URL ?? 'http://middleware:8080';
                const jwtSecret = process.env.JWT_SECRET;
                if (!jwtSecret) {
                    Logger.error(
                        `JWT_SECRET não definido — não vou chamar o middleware. cid=${correlationId}`,
                        loggerCtx,
                    );
                    return;
                }

                // Assina o token no momento da chamada — token é válido por 1h.
                // Em produção isso viria de um serviço de auth dedicado (Keycloak/Auth0).
                const jwt = sign(
                    { sub: JWT_SUBJECT, roles: JWT_ROLES },
                    jwtSecret,
                    { expiresIn: JWT_EXPIRES_IN },
                );

                const payload = {
                    orderId: order.code,
                    customerId: order.customer?.id?.toString() ?? 'guest',
                    total: order.totalWithTax / 100,
                    currency: order.currencyCode,
                };

                Logger.info(
                    `→ middleware /process-order  order=${order.code}  cid=${correlationId}`,
                    loggerCtx,
                );

                try {
                    const res = await fetch(`${middlewareUrl}/process-order`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${jwt}`,
                            'X-Correlation-ID': correlationId,
                        },
                        body: JSON.stringify(payload),
                    });

                    const body = await res.text();
                    Logger.info(
                        `← middleware status=${res.status} cid=${correlationId} body=${body}`,
                        loggerCtx,
                    );
                } catch (err) {
                    Logger.error(
                        `middleware call failed cid=${correlationId} err=${String(err)}`,
                        loggerCtx,
                    );
                }
            });
    }
}
