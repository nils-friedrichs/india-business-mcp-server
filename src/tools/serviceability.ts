import { lookupPincode } from "./pincode.js";

export interface ServiceabilityResult {
  isServiceable: boolean;
  pincode: string;
  state?: string;
  district?: string;
  details?: string;
  error?: string;
}

export async function checkPincodeServiceability(
  pincode: string,
  allowedStates?: string[],
  allowedDistricts?: string[]
): Promise<ServiceabilityResult> {
  const pincodeDetails = await lookupPincode(pincode);
  
  if (!pincodeDetails.isValid || !pincodeDetails.postOffices || pincodeDetails.postOffices.length === 0) {
    return {
      isServiceable: false,
      pincode,
      error: pincodeDetails.error || "Pincode lookup failed or pincode is invalid."
    };
  }

  // Get the state and district from the first post office
  const firstOffice = pincodeDetails.postOffices[0];
  const state = firstOffice.state;
  const district = firstOffice.district;

  // Check state eligibility
  let stateMatches = true;
  if (allowedStates && allowedStates.length > 0) {
    stateMatches = allowedStates.some(allowed => 
      state.toLowerCase().trim() === allowed.toLowerCase().trim()
    );
  }

  // Check district eligibility
  let districtMatches = true;
  if (allowedDistricts && allowedDistricts.length > 0) {
    districtMatches = allowedDistricts.some(allowed => 
      district.toLowerCase().trim() === allowed.toLowerCase().trim()
    );
  }

  const isServiceable = stateMatches && districtMatches;

  let details = `Pincode belongs to state: '${state}', district: '${district}'. `;
  if (!isServiceable) {
    const reasons: string[] = [];
    if (!stateMatches) reasons.push(`state '${state}' is not in allowed list`);
    if (!districtMatches) reasons.push(`district '${district}' is not in allowed list`);
    details += `Not serviceable because: ${reasons.join(" and ")}.`;
  } else {
    details += `Serviceable.`;
  }

  return {
    isServiceable,
    pincode,
    state,
    district,
    details: details.trim()
  };
}
