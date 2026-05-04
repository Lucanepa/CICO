export const ACTIVITY_SOURCES = ['oura', 'huawei', 'strava', 'frontier_x', 'manual'] as const
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number]

export const FOOD_SOURCES = ['usda', 'fsvo', 'off', 'custom'] as const
export type FoodSource = (typeof FOOD_SOURCES)[number]
