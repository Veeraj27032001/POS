export const SOURCE_TYPE_CONFIG = {
  stock_inward_item: {
    label: "Stock Inward",
    mainDelegate: "stockInwardMain",
    itemDelegate: "stockInwardItem",
    itemMainIdField: "stockInwardMainId",
    correctableField: "quantityAccepted",
    fieldLabel: "Accepted quantity",
    // +1 = adds to available stock, -1 = subtracts — used to check a
    // correction can't push available stock below zero.
    sign: 1,
  },
  stock_damage_item: {
    label: "Stock Damage",
    mainDelegate: "stockDamageMain",
    itemDelegate: "stockDamageItem",
    itemMainIdField: "stockDamageMainId",
    correctableField: "quantity",
    fieldLabel: "Quantity",
    sign: -1,
  },
  stock_positive_adjustment_item: {
    label: "Positive Adjustment",
    mainDelegate: "stockPositiveAdjustmentMain",
    itemDelegate: "stockPositiveAdjustmentItem",
    itemMainIdField: "stockPositiveAdjustmentMainId",
    correctableField: "quantity",
    fieldLabel: "Quantity",
    sign: 1,
  },
  stock_negative_adjustment_item: {
    label: "Negative Adjustment",
    mainDelegate: "stockNegativeAdjustmentMain",
    itemDelegate: "stockNegativeAdjustmentItem",
    itemMainIdField: "stockNegativeAdjustmentMainId",
    correctableField: "quantity",
    fieldLabel: "Quantity",
    sign: -1,
  },
  stock_opening_item: {
    label: "Opening Balance",
    mainDelegate: "stockOpeningMain",
    itemDelegate: "stockOpeningItem",
    itemMainIdField: "stockOpeningMainId",
    correctableField: "quantity",
    fieldLabel: "Quantity",
    sign: 1,
  },
} as const;

export type SourceItemType = keyof typeof SOURCE_TYPE_CONFIG;

export function isSourceItemType(value: string): value is SourceItemType {
  return value in SOURCE_TYPE_CONFIG;
}
