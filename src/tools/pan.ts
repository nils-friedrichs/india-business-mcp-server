export interface PanValidationResult {
  isValid: boolean;
  error?: string;
  pan?: string;
  details?: {
    entityType: string;
    entityTypeName: string;
    surnameInitial: string;
  };
}

const PAN_ENTITY_TYPES: Record<string, string> = {
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

export function validatePan(pan: string): PanValidationResult {
  const normalizedPan = pan.trim().toUpperCase();

  // PAN Regex:
  // - First 3 characters: Alphabetic series (A-Z)
  // - 4th character: Entity status indicator (A, B, C, F, G, H, L, J, P, T, E)
  // - 5th character: Holder's surname/last name/entity name initial (A-Z)
  // - Next 4 characters: Sequential numbers (0001 to 9999)
  // - Last character: Check alphabetic letter (A-Z)
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  if (!panRegex.test(normalizedPan)) {
    return {
      isValid: false,
      error: "Invalid PAN format. Expected exactly 10 characters following format: 'ABCDE1234F' (5 letters, 4 numbers, 1 letter)."
    };
  }

  const entityTypeChar = normalizedPan.charAt(3);
  const entityTypeName = PAN_ENTITY_TYPES[entityTypeChar] || "Unknown Entity Type";
  const surnameInitial = normalizedPan.charAt(4);

  return {
    isValid: true,
    pan: normalizedPan,
    details: {
      entityType: entityTypeChar,
      entityTypeName,
      surnameInitial
    }
  };
}
