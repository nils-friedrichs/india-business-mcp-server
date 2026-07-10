import { lookupIfsc } from "./tools/ifsc.js";
import { lookupPincode } from "./tools/pincode.js";
import { validateGstin } from "./tools/gstin.js";
import { validatePan } from "./tools/pan.js";
import { checkPincodeServiceability } from "./tools/serviceability.js";
import { calculateGstTax } from "./tools/gstCalculator.js";

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING INDIAN BUSINESS DATA TOOLS TESTS");
  console.log("=========================================\n");

  // Test PAN validation
  console.log("--- 1. Testing PAN Validation ---");
  const validPan = "AAPFU0939F";
  const invalidPan1 = "AAPFU0939"; // short
  
  console.log(`Valid PAN (${validPan}):`, JSON.stringify(validatePan(validPan), null, 2));
  console.log(`Invalid PAN (${invalidPan1}):`, JSON.stringify(validatePan(invalidPan1), null, 2));
  console.log("\n");

  // Test GSTIN validation
  console.log("--- 2. Testing GSTIN Validation ---");
  const validGstin = "27AAPFU0939F1ZV";
  console.log(`Testing GSTIN (${validGstin}):`, JSON.stringify(validateGstin(validGstin), null, 2));
  console.log("\n");

  // Test IFSC lookup + Caching
  console.log("--- 3. Testing IFSC Lookup & Caching ---");
  const validIfsc = "HDFC0000123";
  
  console.log("First IFSC lookup (should be network fetch):");
  const t1 = Date.now();
  const ifscFetch1 = await lookupIfsc(validIfsc);
  const d1 = Date.now() - t1;
  console.log(`Time taken: ${d1}ms | Valid: ${ifscFetch1.isValid} | Cache: ${ifscFetch1.fromCache}`);

  console.log("Second IFSC lookup (should be from cache):");
  const t2 = Date.now();
  const ifscFetch2 = await lookupIfsc(validIfsc);
  const d2 = Date.now() - t2;
  console.log(`Time taken: ${d2}ms | Valid: ${ifscFetch2.isValid} | Cache: ${ifscFetch2.fromCache}`);
  console.log("\n");

  // Test PIN code lookup + Caching
  console.log("--- 4. Testing PIN code Lookup & Caching ---");
  const validPin = "560001";

  console.log("First PIN lookup (network fetch):");
  const t3 = Date.now();
  const pinFetch1 = await lookupPincode(validPin);
  const d3 = Date.now() - t3;
  console.log(`Time taken: ${d3}ms | Valid: ${pinFetch1.isValid} | Cache: ${pinFetch1.fromCache}`);

  console.log("Second PIN lookup (cache check):");
  const t4 = Date.now();
  const pinFetch2 = await lookupPincode(validPin);
  const d4 = Date.now() - t4;
  console.log(`Time taken: ${d4}ms | Valid: ${pinFetch2.isValid} | Cache: ${pinFetch2.fromCache}`);
  console.log("\n");

  // Test Serviceability Check
  console.log("--- 5. Testing PIN code Serviceability Check ---");
  console.log("Checking 560001 (Karnataka) against allowedStates=['Karnataka'] (Should succeed):");
  console.log(JSON.stringify(await checkPincodeServiceability("560001", ["Karnataka"]), null, 2));

  console.log("\nChecking 560001 against allowedStates=['Maharashtra'] (Should fail):");
  console.log(JSON.stringify(await checkPincodeServiceability("560001", ["Maharashtra"]), null, 2));
  console.log("\n");

  // Test GST Calculator
  console.log("--- 6. Testing GST Tax Calculator ---");
  const seller = "27AAPFU0939F1ZV"; // Maharashtra (27)
  
  console.log(`Intra-state check (Seller: Maharashtra, Buyer: Maharashtra):`);
  console.log(JSON.stringify(calculateGstTax(1000, 18, seller, "Maharashtra"), null, 2));

  console.log(`\nInter-state check (Seller: Maharashtra, Buyer: Karnataka):`);
  console.log(JSON.stringify(calculateGstTax(1000, 18, seller, "Karnataka"), null, 2));

  console.log(`\nInclusive tax check (Seller: Maharashtra, Buyer: Karnataka, inclusive=true):`);
  console.log(JSON.stringify(calculateGstTax(1180, 18, seller, "29", true), null, 2)); // 29 is Karnataka
  console.log("\n=========================================");
}

runTests().catch(err => console.error("Test execution failed:", err));
