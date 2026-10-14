export const DISH_PRICES = {
    lajiao: 38,
    gulaorou: 46,
    zhengyu: 68,
    chaoqingcai: 24,
    fanqie: 30,
    chashao: 42
};

export const PATIENCE_MS = 90000;
export const ORDER_COOLDOWN_MS = 15000;
export const STREAK_MIN_STARS = 4;
export const STREAK_TIERS = [
    { streak: 6, multiplier: 0.2 },
    { streak: 3, multiplier: 0.1 }
];
export const TIP_RATE = 0.1;

export function payoutFor({ dishId, stars, streak }) {
    const price = DISH_PRICES[dishId];
    if (stars === 0) {
        return { base: 0, bonus: 0, tip: 0, total: 0, streak: 0 };
    }
    const base = Math.round((price * stars) / 5);
    const nextStreak = stars >= STREAK_MIN_STARS ? streak + 1 : 0;
    const tier = STREAK_TIERS.find(t => nextStreak >= t.streak);
    const bonus = tier ? Math.round(base * tier.multiplier) : 0;
    const tip = stars === 5 ? Math.round(price * TIP_RATE) : 0;
    return { base, bonus, tip, total: base + bonus + tip, streak: nextStreak };
}
