import { STATE_CODES, validateGstin } from "./gstin.js";

export interface GstTaxResult {
  isValid: boolean;
  error?: string;
  sellerState?: string;
  buyerState?: string;
  isInterState?: boolean;
  breakdown?: {
    baseAmount: number;
    cgstRate: number;
    cgstAmount: number;
    sgstRate: number;
    sgstAmount: number;
    igstRate: number;
    igstAmount: number;
    totalGstRate: number;
    totalGstAmount: number;
    totalAmount: number;
  };
}

export function calculateGstTax(
  amount: number,
  rate: number,
  sellerGstin: string,
  buyerStateCodeOrName: string,
  inclusive = false
): GstTaxResult {
  // Validate seller GSTIN first
  const sellerValidation = validateGstin(sellerGstin);
  if (!sellerValidation.isValid || !sellerValidation.details) {
    return {
      isValid: false,
      error: `Invalid seller GSTIN: ${sellerValidation.error}`
    };
  }

  const sellerStateCode = sellerValidation.details.stateCode;
  const sellerStateName = sellerValidation.details.stateName;

  // Resolve buyer state
  let buyerStateName = "";
  const normalizedBuyerInput = buyerStateCodeOrName.trim().toUpperCase();

  // Check if buyer input is a 2-digit code
  if (/^[0-9]{2}$/.test(normalizedBuyerInput)) {
    buyerStateName = STATE_CODES[normalizedBuyerInput];
  } else {
    // Search by state name
    const stateEntry = Object.entries(STATE_CODES).find(([_, name]) => 
      name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedBuyerInput.toLowerCase().replace(/[^a-z0-9]/g, "")
    );
    if (stateEntry) {
      buyerStateName = stateEntry[1];
    }
  }

  if (!buyerStateName) {
    return {
      isValid: false,
      error: `Could not resolve buyer state code or name: '${buyerStateCodeOrName}'`
    };
  }

  // Determine if it is interstate or intrastate
  const buyerStateCode = Object.keys(STATE_CODES).find(key => STATE_CODES[key] === buyerStateName) || "";
  const isInterState = (sellerStateCode !== buyerStateCode);

  let baseAmount = 0;
  let totalGstAmount = 0;

  if (inclusive) {
    baseAmount = amount / (1 + rate / 100);
    totalGstAmount = amount - baseAmount;
  } else {
    baseAmount = amount;
    totalGstAmount = amount * (rate / 100);
  }

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstRate = rate;
    igstAmount = totalGstAmount;
  } else {
    cgstRate = rate / 2;
    cgstAmount = totalGstAmount / 2;
    sgstRate = rate / 2;
    sgstAmount = totalGstAmount / 2;
  }

  // Round amounts to 2 decimal places for financial calculations
  const round = (num: number) => Math.round(num * 100) / 100;

  return {
    isValid: true,
    sellerState: sellerStateName,
    buyerState: buyerStateName,
    isInterState,
    breakdown: {
      baseAmount: round(baseAmount),
      cgstRate: round(cgstRate),
      cgstAmount: round(cgstAmount),
      sgstRate: round(sgstRate),
      sgstAmount: round(sgstAmount),
      igstRate: round(igstRate),
      igstAmount: round(igstAmount),
      totalGstRate: rate,
      totalGstAmount: round(totalGstAmount),
      totalAmount: round(inclusive ? amount : amount + totalGstAmount)
    }
  };
}
