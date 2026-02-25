import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/scan-card", async (req, res) => {
    try {
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({ error: "No image provided" });
      }

      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: `You are an expert One Piece Trading Card Game identifier. Analyze this card image and extract the following information:

1. card_id - The card number printed on the card (e.g., "EB04-012", "OP01-025", "ST01-012")
2. name - The character or card name
3. rarity - The rarity symbol (C, UC, R, SR, SEC, L, SP)
4. type - The card type (CHARACTER, EVENT, STAGE, LEADER)
5. is_alt_art - Whether this appears to be an alternate/parallel art version (true/false). Alt arts typically have different artwork, special borders, or holographic effects compared to the standard version.

Respond ONLY with valid JSON in this exact format, no markdown or extra text:
{"card_id": "...", "name": "...", "rarity": "...", "type": "...", "is_alt_art": false}

If you cannot identify the card, respond with:
{"error": "Could not identify card"}`,
        },
      ]);

      const responseText = result.response.text().trim();
      const jsonStr = responseText.replace(/```json\n?|\n?```/g, "").trim();
      const cardData = JSON.parse(jsonStr);

      if (cardData.error) {
        return res.status(422).json({ error: cardData.error });
      }

      return res.json(cardData);
    } catch (error: any) {
      console.error("Scan error:", error.message);
      return res.status(500).json({ error: "Failed to analyze card image" });
    }
  });

  return httpServer;
}
