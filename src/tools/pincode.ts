import { TtlCache } from "../utils/cache.js";

export interface PostOfficeInfo {
  name: string;
  branchType: string;
  deliveryStatus: string;
  circle: string;
  district: string;
  division: string;
  region: string;
  state: string;
  country: string;
}

export interface PincodeResult {
  isValid: boolean;
  error?: string;
  fromCache?: boolean;
  pincode?: string;
  postOffices?: PostOfficeInfo[];
}

// Cache PIN code results for 24 hours (1440 minutes)
const pincodeCache = new TtlCache<PostOfficeInfo[]>(1440);

export async function lookupPincode(pincode: string): Promise<PincodeResult> {
  const normalizedPin = pincode.trim();

  // Indian PIN codes are exactly 6 digits, not starting with 0
  const pinRegex = /^[1-9][0-9]{5}$/;
  if (!pinRegex.test(normalizedPin)) {
    return {
      isValid: false,
      error: "Invalid PIN code format. Expected exactly 6 digits not starting with 0 (e.g., '560001')."
    };
  }

  // Check cache first
  const cachedData = pincodeCache.get(normalizedPin);
  if (cachedData) {
    return {
      isValid: true,
      fromCache: true,
      pincode: normalizedPin,
      postOffices: cachedData
    };
  }

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${normalizedPin}`);
    
    if (response.status === 429) {
      return {
        isValid: false,
        error: "Rate limit exceeded on the upstream PIN code API. Please try again in a few moments."
      };
    }

    if (!response.ok) {
      return {
        isValid: false,
        error: `Failed to fetch PIN code details. Server returned status: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json() as any;

    if (!Array.isArray(data) || data.length === 0) {
      return {
        isValid: false,
        error: "Received empty response from the PIN code API."
      };
    }

    const status = data[0].Status;
    const message = data[0].Message;
    const postOfficeList = data[0].PostOffice;

    if (status === "Error" || !postOfficeList) {
      return {
        isValid: false,
        error: message || "No records found for the given PIN code."
      };
    }

    const postOffices: PostOfficeInfo[] = postOfficeList.map((po: any) => ({
      name: po.Name?.trim() || "Unknown",
      branchType: po.BranchType || "Unknown",
      deliveryStatus: po.DeliveryStatus || "Unknown",
      circle: po.Circle || "Unknown",
      district: po.District || "Unknown",
      division: po.Division || "Unknown",
      region: po.Region || "Unknown",
      state: po.State || "Unknown",
      country: po.Country || "Unknown"
    }));

    // Cache the successful result
    pincodeCache.set(normalizedPin, postOffices);

    return {
      isValid: true,
      fromCache: false,
      pincode: normalizedPin,
      postOffices
    };
  } catch (error: any) {
    return {
      isValid: false,
      error: `Network or system error occurred while fetching PIN code details: ${error.message || error}`
    };
  }
}
