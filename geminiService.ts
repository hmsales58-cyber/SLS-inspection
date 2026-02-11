import { GoogleGenAI, Type, Schema } from "@google/genai";
import { InspectionItem } from "../types";

const SYSTEM_INSTRUCTION = `
Role: Senior Forensic Data Integrity Expert for "Secured Logistics Solution".

STRICT AUDIT PROTOCOL:
1. DEEP LOOKUP: Treat the SPEC (Part Number) as the primary key. If you detect "SM-A366BZKPMEA", you MUST return:
   - Model: "Samsung Galaxy A36 5G"
   - RAM/GB: "8/128GB"
   - Color: "Awesome Black"
2. CONSISTENCY: Ensure that identical SPEC codes always result in identical Model/RAM/Color mappings.
3. RAM/GB FORMAT: Use "RAM/Storage" format (e.g., 8/128GB). If only storage is present, use storage capacity (e.g., 256GB).
4. ZERO GUESSING: If the image is blurry and the SPEC is not 100% readable, return empty strings (""). Do not invent data.
5. NO HALLUCINATION: Accuracy is more important than filling all fields. Manual entry is the fallback.

Output JSON Structure:
- company: string
- customerCode: string
- items: Array of objects with { model, gb, pcs, color, coo, spec, remarks }
`;

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    company: { type: Type.STRING },
    customerCode: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          model: { type: Type.STRING },
          gb: { type: Type.STRING },
          pcs: { type: Type.INTEGER },
          color: { type: Type.STRING },
          coo: { type: Type.STRING },
          spec: { type: Type.STRING },
          remarks: { type: Type.STRING },
        },
        required: ["model", "gb", "pcs", "color", "coo", "spec", "remarks"],
      },
    },
  },
  required: ["items"],
};

export interface ExtractedData {
  company?: string;
  customerCode?: string;
  items: Omit<InspectionItem, 'id'>[];
}

export const extractDataFromImage = async (base64Image: string): Promise<ExtractedData> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Identify the device. Focus on Part Number (SPEC) SM-A366BZKPMEA lookup. Accuracy is mandatory." },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) return { items: [] };
    return JSON.parse(text) as ExtractedData;
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};
