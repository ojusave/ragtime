import type {
  CostController,
  CostOperationKind,
  WithReceipt,
} from "../ports.js";
import { CostOperationError } from "../errors.js";

export async function runCostedOperation<T extends WithReceipt<unknown>>(args: {
  controller?: CostController;
  operationKey: string;
  kind: CostOperationKind;
  call: (maxCostUsd?: number) => Promise<T>;
}): Promise<T> {
  if (!args.controller) return args.call();

  const reservation = await args.controller.reserve(args.operationKey, args.kind);
  if (reservation.replayAvailable) {
    return reservation.replayResult as T;
  }

  let result: T;
  try {
    result = await args.call(reservation.maxCostUsd);
  } catch (error) {
    const definitelyUnbilled =
      typeof error === "object" &&
      error !== null &&
      "billingAmbiguous" in error &&
      error.billingAmbiguous === false;
    if (definitelyUnbilled) {
      await args.controller.release(args.operationKey);
    } else {
      await args.controller.settle(
        args.operationKey,
        reservation.maxCostUsd
      );
      throw new CostOperationError(
        error instanceof Error ? error.message : "Paid provider call failed",
        false,
        error
      );
    }
    throw error;
  }

  const settledResult = result.receipt.costUnknown
    ? ({
        ...result,
        receipt: {
          ...result.receipt,
          costUsd: reservation.maxCostUsd,
        },
      } as T)
    : result;
  await args.controller.settle(
    args.operationKey,
    settledResult.receipt.costUsd,
    settledResult
  );
  return settledResult;
}
