#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { lookupIfsc } from "./tools/ifsc.js";
import { lookupPincode } from "./tools/pincode.js";
import { validateGstin, STATE_CODES } from "./tools/gstin.js";
import { validatePan } from "./tools/pan.js";
import { checkPincodeServiceability } from "./tools/serviceability.js";
import { calculateGstTax } from "./tools/gstCalculator.js";
import { verifyFreelanceContractor } from "./tools/compliance.js";
import { bulkValidateGstins, bulkValidatePans, bulkLookupIfscs } from "./tools/batch.js";

const server = new Server(
  {
    name: "india-business-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Register and list available static resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "india-business://gst-slabs",
        name: "Indian GST Rate Slabs Reference",
        description: "Official GST tax rate slabs in India (5%, 12%, 18%, 28%) and which goods/services they apply to.",
        mimeType: "text/markdown",
      },
      {
        uri: "india-business://state-codes",
        name: "GST State Codes Reference",
        description: "Mapping of 2-digit GST state codes to Indian States and Union Territories.",
        mimeType: "text/markdown",
      }
    ]
  };
});

// Handle reading resource contents
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "india-business://gst-slabs") {
    const gstSlabsMarkdown = `# Indian GST Slabs Reference

| Rate | Category | General Examples / Product Classes |
| :---: | :--- | :--- |
| **0%** (Exempt) | Essential Goods | Fresh fruits, vegetables, milk, salt, grain/flour, newspapers, books. |
| **5%** | Common Items | Sugar, tea, coffee, edible oil, spices, life-saving drugs, economy air travel. |
| **12%** | Standard (Low) | Butter, cheese, ghee, fruit juices, mobile phones, business air travel. |
| **18%** | Standard (High) | Services (IT, consulting, SaaS, telecom, banking), capital goods, restaurants. |
| **28%** | Luxury & Sin Goods | Automobiles, motorcycles, air conditioners, pan masala, soft drinks, luxury stays. |`;

    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: gstSlabsMarkdown
        }
      ]
    };
  }

  if (uri === "india-business://state-codes") {
    const stateCodesList = Object.entries(STATE_CODES)
      .map(([code, name]) => `| **${code}** | ${name} |`)
      .join("\n");

    const stateCodesMarkdown = `# GST State Codes Reference

| Code | State / Union Territory |
| :---: | :--- |
${stateCodesList}`;

    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: stateCodesMarkdown
        }
      ]
    };
  }

  throw new Error(`Resource not found: ${uri}`);
});

// Register and list available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "lookup_ifsc",
        description: "Retrieves details about an Indian bank branch using its IFSC code (e.g. Bank Name, Branch, Address, Contact, and features like UPI, RTGS, NEFT, IMPS support). Uses caching to optimize response times.",
        inputSchema: {
          type: "object",
          properties: {
            ifsc: {
              type: "string",
              description: "The 11-character Indian Financial System Code (e.g., 'HDFC0000123')",
            },
          },
          required: ["ifsc"],
        },
      },
      {
        name: "lookup_pincode",
        description: "Retrieves location details for an Indian Postal PIN code (e.g., Post Office name, Block, Circle, District, State). Uses caching to optimize response times.",
        inputSchema: {
          type: "object",
          properties: {
            pincode: {
              type: "string",
              description: "The 6-digit PIN code (e.g., '560001')",
            },
          },
          required: ["pincode"],
        },
      },
      {
        name: "validate_gstin",
        description: "Validates the structure, format, and checksum of a GSTIN (Goods and Services Tax Identification Number), and extracts the State, PAN, Entity Type, and Checksum status.",
        inputSchema: {
          type: "object",
          properties: {
            gstin: {
              type: "string",
              description: "The 15-character GSTIN (e.g., '27AAPFU0939F1ZV')",
            },
          },
          required: ["gstin"],
        },
      },
      {
        name: "validate_pan",
        description: "Validates the format and structure of a Permanent Account Number (PAN), and extracts the legal entity/holder type (e.g., Individual, Company, Firm, Trust).",
        inputSchema: {
          type: "object",
          properties: {
            pan: {
              type: "string",
              description: "The 10-character PAN card number (e.g., 'ABCDE1234F')",
            },
          },
          required: ["pan"],
        },
      },
      {
        name: "check_pincode_serviceability",
        description: "Checks if a given Indian PIN code is serviceable based on lists of allowed states or districts. Extremely useful for e-commerce checkout and shipping verification.",
        inputSchema: {
          type: "object",
          properties: {
            pincode: {
              type: "string",
              description: "The 6-digit PIN code (e.g., '560001')",
            },
            allowedStates: {
              type: "array",
              items: { type: "string" },
              description: "Optional list of allowed state names (e.g., ['Karnataka', 'Maharashtra'])",
            },
            allowedDistricts: {
              type: "array",
              items: { type: "string" },
              description: "Optional list of allowed district names (e.g., ['Bangalore', 'Mumbai'])",
            },
          },
          required: ["pincode"],
        },
      },
      {
        name: "calculate_gst_tax",
        description: "Calculates GST (CGST, SGST, IGST) breakdown based on transaction amount, GST rate, seller's GSTIN and buyer's location/state. Determines inter-state vs intra-state routing automatically.",
        inputSchema: {
          type: "object",
          properties: {
            amount: {
              type: "number",
              description: "The transaction amount (price of goods/services).",
            },
            rate: {
              type: "number",
              description: "The GST tax rate percentage (e.g. 5, 12, 18, 28).",
            },
            sellerGstin: {
              type: "string",
              description: "The 15-character GSTIN of the seller.",
            },
            buyerStateCodeOrName: {
              type: "string",
              description: "The state name or 2-digit state code of the buyer (e.g., 'Delhi' or '07').",
            },
            inclusive: {
              type: "boolean",
              description: "Whether the provided amount is inclusive of GST. Defaults to false (exclusive).",
            },
          },
          required: ["amount", "rate", "sellerGstin", "buyerStateCodeOrName"],
        },
      },
      {
        name: "verify_freelance_contractor",
        description: "Evaluates an Indian contractor/freelancer for onboarding tax and compliance. Performs structural checks on PAN and GSTIN, matches them, extracts entity type, and computes Section 194J/194C TDS (withholding tax) brackets.",
        inputSchema: {
          type: "object",
          properties: {
            pan: {
              type: "string",
              description: "The 10-character PAN number of the contractor (e.g. 'ABCDE1234F').",
            },
            gstin: {
              type: "string",
              description: "Optional 15-character GSTIN of the contractor (e.g. '27AAPFU0939F1ZV').",
            },
          },
          required: ["pan"],
        },
      },
      {
        name: "bulk_validate_gstins",
        description: "Validates a list of GSTINs in bulk (maximum 50 items). Returns status, extracted PAN, entity type, and state information for each.",
        inputSchema: {
          type: "object",
          properties: {
            gstins: {
              type: "array",
              items: { type: "string" },
              description: "Array of 15-character GSTIN strings.",
            },
          },
          required: ["gstins"],
        },
      },
      {
        name: "bulk_validate_pans",
        description: "Validates a list of PAN card numbers in bulk (maximum 50 items). Returns structural status and legal entity types.",
        inputSchema: {
          type: "object",
          properties: {
            pans: {
              type: "array",
              items: { type: "string" },
              description: "Array of 10-character PAN strings.",
            },
          },
          required: ["pans"],
        },
      },
      {
        name: "bulk_lookup_ifsc",
        description: "Performs real-time lookups for multiple IFSC bank branch codes in bulk (maximum 50 items). Returns cached or live branch details.",
        inputSchema: {
          type: "object",
          properties: {
            ifscs: {
              type: "array",
              items: { type: "string" },
              description: "Array of 11-character IFSC codes.",
            },
          },
          required: ["ifscs"],
        },
      },
    ],
  };
});

// Handle tool executions
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "lookup_ifsc": {
        if (!args || typeof args.ifsc !== "string") {
          return {
            content: [{ type: "text", text: JSON.stringify({ isValid: false, error: "Missing or invalid 'ifsc' argument." }) }],
            isError: true
          };
        }
        const result = await lookupIfsc(args.ifsc);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.isValid
        };
      }

      case "lookup_pincode": {
        if (!args || typeof args.pincode !== "string") {
          return {
            content: [{ type: "text", text: JSON.stringify({ isValid: false, error: "Missing or invalid 'pincode' argument." }) }],
            isError: true
          };
        }
        const result = await lookupPincode(args.pincode);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.isValid
        };
      }

      case "validate_gstin": {
        if (!args || typeof args.gstin !== "string") {
          return {
            content: [{ type: "text", text: JSON.stringify({ isValid: false, error: "Missing or invalid 'gstin' argument." }) }],
            isError: true
          };
        }
        const result = validateGstin(args.gstin);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.isValid
        };
      }

      case "validate_pan": {
        if (!args || typeof args.pan !== "string") {
          return {
            content: [{ type: "text", text: JSON.stringify({ isValid: false, error: "Missing or invalid 'pan' argument." }) }],
            isError: true
          };
        }
        const result = validatePan(args.pan);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.isValid
        };
      }

      case "check_pincode_serviceability": {
        if (!args || typeof args.pincode !== "string") {
          return {
            content: [{ type: "text", text: JSON.stringify({ isValid: false, error: "Missing or invalid 'pincode' argument." }) }],
            isError: true
          };
        }
        const allowedStates = Array.isArray(args.allowedStates) ? args.allowedStates.map(String) : undefined;
        const allowedDistricts = Array.isArray(args.allowedDistricts) ? args.allowedDistricts.map(String) : undefined;
        
        const result = await checkPincodeServiceability(args.pincode, allowedStates, allowedDistricts);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.isServiceable && !!result.error
        };
      }

      case "calculate_gst_tax": {
        if (!args || typeof args.amount !== "number" || typeof args.rate !== "number" || typeof args.sellerGstin !== "string" || typeof args.buyerStateCodeOrName !== "string") {
          return {
            content: [{ type: "text", text: JSON.stringify({ isValid: false, error: "Missing or invalid arguments." }) }],
            isError: true
          };
        }
        const inclusive = typeof args.inclusive === "boolean" ? args.inclusive : false;
        const result = calculateGstTax(args.amount, args.rate, args.sellerGstin, args.buyerStateCodeOrName, inclusive);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.isValid
        };
      }

      case "verify_freelance_contractor": {
        if (!args || typeof args.pan !== "string") {
          return {
            content: [{ type: "text", text: JSON.stringify({ isValid: false, error: "Missing or invalid 'pan' argument." }) }],
            isError: true
          };
        }
        const gstin = typeof args.gstin === "string" ? args.gstin : undefined;
        const result = verifyFreelanceContractor(args.pan, gstin);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.panValid || (result.gstinProvided && result.gstinValid === false)
        };
      }

      case "bulk_validate_gstins": {
        if (!args || !Array.isArray(args.gstins)) {
          return {
            content: [{ type: "text", text: JSON.stringify({ isValid: false, error: "Missing or invalid 'gstins' array." }) }],
            isError: true
          };
        }
        const result = bulkValidateGstins(args.gstins.map(String));
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: false
        };
      }

      case "bulk_validate_pans": {
        if (!args || !Array.isArray(args.pans)) {
          return {
            content: [{ type: "text", text: JSON.stringify({ isValid: false, error: "Missing or invalid 'pans' array." }) }],
            isError: true
          };
        }
        const result = bulkValidatePans(args.pans.map(String));
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: false
        };
      }

      case "bulk_lookup_ifsc": {
        if (!args || !Array.isArray(args.ifscs)) {
          return {
            content: [{ type: "text", text: JSON.stringify({ isValid: false, error: "Missing or invalid 'ifscs' array." }) }],
            isError: true
          };
        }
        const result = await bulkLookupIfscs(args.ifscs.map(String));
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: false
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: JSON.stringify({ isValid: false, error: error.message || String(error) }, null, 2) }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("India Business MCP Server running on stdio transport");
}

main().catch((error) => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});
