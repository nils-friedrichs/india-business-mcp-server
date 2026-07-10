import { validatePan } from "./pan.js";
import { validateGstin } from "./gstin.js";

export interface ContractorComplianceResult {
  panValid: boolean;
  gstinValid: boolean | null;
  gstinProvided: boolean;
  entityType: string;
  entityTypeName: string;
  isIndividualFreelancer: boolean;
  panGstinMatch: boolean | null;
  tdsWithholdingSection: string;
  tdsStandardRatePercent: string;
  tdsRateAppliedPercent: number;
  complianceStatus: "MATCHED" | "MISMATCHED" | "GSTIN_NOT_PROVIDED" | "INVALID_PAN";
  warnings: string[];
  recommendations: string[];
}

export function verifyFreelanceContractor(pan: string, gstin?: string): ContractorComplianceResult {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // 1. Validate PAN
  const panResult = validatePan(pan);
  if (!panResult.isValid) {
    return {
      panValid: false,
      gstinValid: gstin ? false : null,
      gstinProvided: !!gstin,
      entityType: "Unknown",
      entityTypeName: "Unknown",
      isIndividualFreelancer: false,
      panGstinMatch: null,
      tdsWithholdingSection: "Section 206AA (Penalty TDS)",
      tdsStandardRatePercent: "N/A",
      tdsRateAppliedPercent: 20,
      complianceStatus: "INVALID_PAN",
      warnings: ["Invalid PAN code provided. Under Section 206AA of the Income Tax Act, a statutory 20% penalty TDS rate applies to all payouts."],
      recommendations: ["Request a valid, structurally correct PAN card from the contractor before initiating any payments."]
    };
  }

  const normalizedPan = panResult.pan!;
  const entityType = panResult.details!.entityType;
  const entityTypeName = panResult.details!.entityTypeName;
  const isIndividual = entityType === "P"; // 'P' is Individual (Proprietorship)

  // 2. Validate GSTIN if provided
  let gstinValid = null;
  let panGstinMatch = null;
  let normalizedGstin = "";
  
  if (gstin && gstin.trim().length > 0) {
    const gstinResult = validateGstin(gstin);
    gstinValid = gstinResult.isValid;
    if (gstinResult.isValid) {
      normalizedGstin = gstinResult.gstin!;
      // Extract PAN from GSTIN (chars 3 to 12)
      const panInGstin = normalizedGstin.substring(2, 12);
      panGstinMatch = panInGstin === normalizedPan;
      
      if (!panGstinMatch) {
        warnings.push(`GSTIN-PAN Mismatch: The PAN embedded in the GSTIN (${panInGstin}) does not match the provided PAN (${normalizedPan}). This suggests the GSTIN belongs to a different legal entity.`);
        recommendations.push("Ask the contractor to provide a GSTIN that matches their PAN card registration, or verify if the vendor is onboarding under a different business name.");
      }
    } else {
      warnings.push(`Invalid GSTIN format: The provided GSTIN "${gstin}" failed structural validation checks.`);
      recommendations.push("Request the contractor to check and resubmit a correct 15-character GSTIN.");
    }
  }

  // 3. Determine TDS sections and rates
  let tdsWithholdingSection = "Section 194J / Section 194C";
  let tdsStandardRatePercent = "";
  let tdsRateAppliedPercent = 0;

  if (isIndividual) {
    tdsWithholdingSection = "Section 194J (Technical Services) / Section 194C (Contractor)";
    tdsStandardRatePercent = "2% (Technical Services/Software) or 1% (General Contract)";
    tdsRateAppliedPercent = 2; // Default to 2% for software developers/technical consultants under 194J
    recommendations.push("For software development or coding consulting, deduct 2% TDS under Section 194J.");
    recommendations.push("For general outsourcing contracts (non-technical), deduct 1% TDS under Section 194C.");
  } else {
    // Company, LLP, or Firm
    tdsWithholdingSection = "Section 194J (Technical Services) / Section 194C (Contractor)";
    tdsStandardRatePercent = "2% (Technical Services/Software) or 2% (General Contract)";
    tdsRateAppliedPercent = 2;
    warnings.push(`Corporate Entity Flag: The contractor is registered as a Corporate Entity (${entityTypeName}), not an Individual Freelancer.`);
    recommendations.push("Ensure payments are routed to their registered corporate bank account (not a personal savings account).");
    recommendations.push("Deduct 2% TDS under either Section 194J (Technical Services) or Section 194C (Contract).");
  }

  // GST warnings & recommendations
  if (!gstin || gstin.trim().length === 0) {
    warnings.push("No GSTIN provided. The contractor cannot bill for GST.");
    recommendations.push("Confirm that the freelancer's annual domestic turnover is under the statutory GST threshold of ₹20 Lakhs. If they exceed this, they must register for GST and provide a GSTIN.");
  } else if (gstinValid) {
    recommendations.push("The contractor has a valid GSTIN. Verify that their invoices charge the standard 18% GST for services and display their GSTIN.");
  }

  // Determine compliance status
  let complianceStatus: "MATCHED" | "MISMATCHED" | "GSTIN_NOT_PROVIDED" = "GSTIN_NOT_PROVIDED";
  if (gstin && gstin.trim().length > 0) {
    complianceStatus = panGstinMatch ? "MATCHED" : "MISMATCHED";
  }

  return {
    panValid: true,
    gstinValid,
    gstinProvided: !!(gstin && gstin.trim().length > 0),
    entityType,
    entityTypeName,
    isIndividualFreelancer: isIndividual,
    panGstinMatch,
    tdsWithholdingSection,
    tdsStandardRatePercent,
    tdsRateAppliedPercent,
    complianceStatus,
    warnings,
    recommendations
  };
}
