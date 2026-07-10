import { TtlCache } from "../utils/cache.js";

export interface IfscResult {
  isValid: boolean;
  error?: string;
  fromCache?: boolean;
  data?: {
    ifsc: string;
    bank: string;
    branch: string;
    address: string;
    city: string;
    district: string;
    state: string;
    contact: string;
    micr?: string;
    swift?: string;
    upi: boolean;
    rtgs: boolean;
    neft: boolean;
    imps: boolean;
  };
}

// Cache IFSC results for 24 hours (1440 minutes)
const ifscCache = new TtlCache<any>(1440);

export async function lookupIfsc(ifsc: string): Promise<IfscResult> {
  const normalizedIfsc = ifsc.trim().toUpperCase();

  // IFSC format: 4 alphabetic characters, followed by a '0', followed by 6 alphanumeric characters
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(normalizedIfsc)) {
    return {
      isValid: false,
      error: "Invalid IFSC format. Expected 11 characters, e.g., 'HDFC0000123' (4 letters, 0, 6 alphanumeric characters)."
    };
  }

  // Check cache first
  const cachedData = ifscCache.get(normalizedIfsc);
  if (cachedData) {
    return {
      isValid: true,
      fromCache: true,
      data: cachedData
    };
  }

  try {
    const response = await fetch(`https://ifsc.razorpay.com/${normalizedIfsc}`);
    
    if (response.status === 404) {
      return {
        isValid: false,
        error: `IFSC code '${normalizedIfsc}' not found.`
      };
    }

    if (response.status === 429) {
      return {
        isValid: false,
        error: "Rate limit exceeded on the upstream IFSC API. Please try again in a few moments."
      };
    }

    if (!response.ok) {
      return {
        isValid: false,
        error: `Failed to fetch IFSC details. Server returned status: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json() as any;
    
    const structuredData = {
      ifsc: normalizedIfsc,
      bank: data.BANK || "Unknown",
      branch: data.BRANCH || "Unknown",
      address: data.ADDRESS || "Unknown",
      city: data.CITY || "Unknown",
      district: data.DISTRICT || "Unknown",
      state: data.STATE || "Unknown",
      contact: data.CONTACT || "Unknown",
      micr: data.MICR || undefined,
      swift: data.SWIFT || undefined,
      upi: !!data.UPI,
      rtgs: !!data.RTGS,
      neft: !!data.NEFT,
      imps: !!data.IMPS
    };

    // Cache the successful response
    ifscCache.set(normalizedIfsc, structuredData);

    return {
      isValid: true,
      fromCache: false,
      data: structuredData
    };
  } catch (error: any) {
    return {
      isValid: false,
      error: `Network or system error occurred while fetching IFSC details: ${error.message || error}`
    };
  }
}
