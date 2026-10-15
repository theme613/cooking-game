export const TICKET_STATUS = {
    OPEN: 'open',
    TAKEN_WAITER: 'taken_waiter',
    READY_FOR_COOK: 'ready_for_cook',
    COOKING: 'cooking',
    SERVED: 'served',
    REVIEWED: 'reviewed',
    PAID: 'paid'
};

export const STALE_MS = 5 * 60 * 1000;

export function splitPayout(total) {
    const waiter = Math.round(total * 0.5);
    return { waiter, chef: total - waiter };
}
