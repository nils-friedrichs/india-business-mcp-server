export interface GstinValidationResult {
  isValid: boolean;
  error?: string;
  gstin?: string;
  details?: {
    stateCode: string;
    stateName: string;
    pan: string;
    entityType: string;
    entityTypeName: string;
    registrationNumber: string; // 13th char
    checksumValid: boolean;
    calculatedChecksumChar: string;
    providedChecksumChar: string;
  };
}

export const STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu (Old)",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh (New)",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction"
};

const ENTITY_TYPES: Record<string, string> = {
  "A": "Association of Persons (AOP)",
  "B": "Body of Individuals (BOI)",
  "C": "Company",
  "F": "Firm",
  "G": "Government Agency",
  "H": "Hindu Undivided Family (HUF)",
  "L": "Local Authority",
  "J": "Artificial Juridical Person",
  "P": "Individual (Proprietorship)",
  "T": "Trust",
  "E": "LLP (Limited Liability Partnership)"
};

export function validateGstin(gstin: string): GstinValidationResult {
  const normalizedGstin = gstin.trim().toUpperCase();

  // GSTIN Regex:
  // - First 2: State Code (numeric)
  // - Next 10: PAN (5 letters, 4 numbers, 1 letter)
  // - 13th: Registration entity number (1-9 or A-Z)
  // - 14th: Default 'Z' character
  // - 15th: Checksum character (alphanumeric)
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  if (!gstinRegex.test(normalizedGstin)) {
    return {
      isValid: false,
      error: "Invalid GSTIN format. Expected 15 characters following format: '27AAPFU0939F1ZV'."
    };
  }

  const stateCode = normalizedGstin.substring(0, 2);
  const stateName = STATE_CODES[stateCode] || "Unknown State";

  const pan = normalizedGstin.substring(2, 12);
  const entityTypeChar = normalizedGstin.charAt(5); // 4th character of PAN is index 5 in GSTIN
  const entityTypeName = ENTITY_TYPES[entityTypeChar] || "Unknown Entity Type";

  const registrationNumber = normalizedGstin.charAt(12);

  // Mod-36 Checksum Validation
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;

  for (let i = 0; i < 14; i++) {
    const char = normalizedGstin.charAt(i);
    const charValue = chars.indexOf(char);
    if (charValue === -1) {
      return {
        isValid: false,
        error: `GSTIN contains invalid character '${char}' at position ${i + 1}.`
      };
    }

    // Weight alternates: 1 for odd index (1st, 3rd, 5th... positions), 2 for even index
    // i is 0-indexed: index 0 (1st pos) -> 1, index 1 (2nd pos) -> 2
    const factor = (i % 2 === 0) ? 1 : 2;
    const product = charValue * factor;
    
    // Split and sum digits of product in base 36
    const digitSum = Math.floor(product / 36) + (product % 36);
    sum += digitSum;
  }

  const remainder = sum % 36;
  const checksumValue = (36 - remainder) % 36;
  const calculatedChecksumChar = chars.charAt(checksumValue);
  const providedChecksumChar = normalizedGstin.charAt(14);
  const checksumValid = (calculatedChecksumChar === providedChecksumChar);

  if (!checksumValid) {
    return {
      isValid: false,
      error: `GSTIN checksum verification failed. Provided '${providedChecksumChar}', calculated '${calculatedChecksumChar}'.`,
      details: {
        stateCode,
        stateName,
        pan,
        entityType: entityTypeChar,
        entityTypeName,
        registrationNumber,
        checksumValid: false,
        calculatedChecksumChar,
        providedChecksumChar
      }
    };
  }

  return {
    isValid: true,
    gstin: normalizedGstin,
    details: {
      stateCode,
      stateName,
      pan,
      entityType: entityTypeChar,
      entityTypeName,
      registrationNumber,
      checksumValid: true,
      calculatedChecksumChar,
      providedChecksumChar
    }
  };
}
