import { validateGstin, GstinValidationResult } from "./gstin.js";
import { validatePan, PanValidationResult } from "./pan.js";
import { lookupIfsc, IfscResult } from "./ifsc.js";

const BATCH_LIMIT = 50;

export interface BulkResult<T> {
  totalCount: number;
  validCount: number;
  invalidCount: number;
  results: T[];
}

export function bulkValidateGstins(gstins: string[]): BulkResult<GstinValidationResult & { input: string }> {
  if (gstins.length > BATCH_LIMIT) {
    throw new Error(`Batch size exceeds the limit of ${BATCH_LIMIT} items.`);
  }

  const results = gstins.map(gstin => {
    try {
      const res = validateGstin(gstin);
      return { input: gstin, ...res };
    } catch (e: any) {
      return {
        input: gstin,
        isValid: false,
        error: e.message || "Unknown error during validation"
      };
    }
  });

  const validCount = results.filter(r => r.isValid).length;

  return {
    totalCount: gstins.length,
    validCount,
    invalidCount: gstins.length - validCount,
    results
  };
}

export function bulkValidatePans(pans: string[]): BulkResult<PanValidationResult & { input: string }> {
  if (pans.length > BATCH_LIMIT) {
    throw new Error(`Batch size exceeds the limit of ${BATCH_LIMIT} items.`);
  }

  const results = pans.map(pan => {
    try {
      const res = validatePan(pan);
      return { input: pan, ...res };
    } catch (e: any) {
      return {
        input: pan,
        isValid: false,
        error: e.message || "Unknown error during validation"
      };
    }
  });

  const validCount = results.filter(r => r.isValid).length;

  return {
    totalCount: pans.length,
    validCount,
    invalidCount: pans.length - validCount,
    results
  };
}

export async function bulkLookupIfscs(ifscs: string[]): Promise<BulkResult<IfscResult & { input: string }>> {
  if (ifscs.length > BATCH_LIMIT) {
    throw new Error(`Batch size exceeds the limit of ${BATCH_LIMIT} items.`);
  }

  const promises = ifscs.map(async (ifsc) => {
    try {
      const res = await lookupIfsc(ifsc);
      return { input: ifsc, ...res };
    } catch (e: any) {
      return {
        input: ifsc,
        isValid: false,
        error: e.message || "Failed to lookup IFSC"
      };
    }
  });

  const results = await Promise.all(promises);
  const validCount = results.filter(r => r.isValid).length;

  return {
    totalCount: ifscs.length,
    validCount,
    invalidCount: ifscs.length - validCount,
    results
  };
}
