import type {
  CostController,
  CostOperationKind,
  WithReceipt,
} from "../ports.js";

export async function runCostedOperation<T extends WithReceipt<unknown>>(args: {
  controller?: CostController;
  operationKey: string;
  kind: CostOperationKind;
  call: (maxCostUsd?: number) => Promise<T>;
}): Promise<T> {
  if (!args.controller) return args.call();

  const reservation = await args.controller.reserve(args.operationKey, args.kind);
  const result = await args.call(reservation.maxCostUsd);
  if (result.receipt.costUnknown) {
    throw new Error(`Provider cost is unknown for ${args.operationKey}`);
  }
  await args.controller.settle(args.operationKey, result.receipt.costUsd);
  return result;
}
