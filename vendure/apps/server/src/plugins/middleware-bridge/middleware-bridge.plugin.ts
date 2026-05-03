import { OnApplicationBootstrap } from '@nestjs/common';
import {
    EventBus,
    Logger,
    OrderStateTransitionEvent,
    PluginCommonModule,
    VendurePlugin,
} from '@vendure/core';
import { randomUUID } from 'crypto';
import { filter } from 'rxjs/operators';

const loggerCtx = 'MiddlewareBridgePlugin';

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
                const jwt = process.env.MIDDLEWARE_JWT ?? '';

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
