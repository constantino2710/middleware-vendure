export const ORDERS_EVENTS_EXCHANGE = 'orders.events';
export const ORDER_PAID_ROUTING_KEY = 'order.paid';
export const ORDER_FAILED_ROUTING_KEY = 'order.failed';

export type OrderRoutingKey =
    | typeof ORDER_PAID_ROUTING_KEY
    | typeof ORDER_FAILED_ROUTING_KEY;

export type OrderEventStatus = 'PAID' | 'FAILED';

export interface OrderEvent {
    orderId: string;
    status: OrderEventStatus;
    timestamp: string;
    correlation_id: string;
}
