import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { detectAndCropCards } from "./batchDetect";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const SINGLE_CARD_PROMPT = `You are an expert One Piece Trading Card Game identifier. Analyze this card image and extract the following information:

1. card_id - The card number printed on the card (e.g., "EB04-012", "OP01-025", "ST01-012")
2. name - The character or card name
3. rarity - The rarity symbol (C, UC, R, SR, SEC, L, SP)
4. type - The card type (CHARACTER, EVENT, STAGE, LEADER)
5. is_alt_art - Whether this appears to be an alternate/parallel art version (true/false). Alt arts typically have different artwork, special borders, or holographic effects compared to the standard version.

Respond ONLY with valid JSON in this exact format, no markdown or extra text:
{"card_id": "...", "name": "...", "rarity": "...", "type": "...", "is_alt_art": false}

If you cannot identify the card, respond with:
{"error": "Could not identify card"}`;

const BATCH_CARD_PROMPT = `You are an expert One Piece Trading Card Game identifier. This image contains MULTIPLE One Piece TCG cards laid out on a surface. Identify EVERY card visible in the image.

For each card, extract:
1. card_id - The card number printed on the card (e.g., "EB04-012", "OP01-025", "ST01-012")
2. name - The character or card name
3. rarity - The rarity symbol (C, UC, R, SR, SEC, L, SP)
4. type - The card type (CHARACTER, EVENT, STAGE, LEADER)
5. is_alt_art - Whether this appears to be an alternate/parallel art version (true/false)

Respond ONLY with a valid JSON array, no markdown or extra text:
[{"card_id": "...", "name": "...", "rarity": "...", "type": "...", "is_alt_art": false}, ...]

If you cannot identify any cards, respond with:
[]`;

async function identifySingleCard(
  base64Data: string,
  mimeType: string = "image/jpeg"
): Promise<{ card_id: string; name: string; rarity: string; type: string; is_alt_art: boolean; error?: string }> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
    { text: SINGLE_CARD_PROMPT },
  ]);

  const responseText = result.response.text().trim();
  const jsonStr = responseText.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(jsonStr);
}

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

      const cardData = await identifySingleCard(base64Data, mimeType);

      if (cardData.error) {
        return res.status(422).json({ error: cardData.error });
      }

      return res.json(cardData);
    } catch (error: any) {
      console.error("Scan error:", error.message);
      const msg = error.message?.includes("404")
        ? "AI model unavailable. Please try again shortly."
        : "Failed to analyze card image. Please try again.";
      return res.status(500).json({ error: msg });
    }
  });

  app.post("/api/scan-batch", async (req, res) => {
    try {
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({ error: "No image provided" });
      }

      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";

      let croppedCards = await detectAndCropCards(image);

      if (croppedCards && croppedCards.length > 1) {
        console.log(`CV detected ${croppedCards.length} card(s), identifying each...`);

        const results = await Promise.all(
          croppedCards.map(async (card, index) => {
            try {
              const cardData = await identifySingleCard(card.base64, "image/jpeg");
              if (cardData.error) {
                console.log(`Card ${index} identification returned error: ${cardData.error}`);
                return { ...cardData, _index: index, _failed: true };
              }
              return { ...cardData, _index: index, _failed: false };
            } catch (err: any) {
              console.error(`Failed to identify card ${index}:`, err.message);
              return {
                card_id: "",
                name: "Unknown",
                rarity: "",
                type: "",
                is_alt_art: false,
                error: "Failed to identify",
                _index: index,
                _failed: true,
              };
            }
          })
        );

        const successfulCards = results
          .filter((r) => !r._failed)
          .map(({ _index, _failed, ...card }) => card);

        if (successfulCards.length > 0) {
          return res.json({
            cards: successfulCards,
            count: successfulCards.length,
            method: "cv",
            totalDetected: croppedCards.length,
            failedCount: results.length - successfulCards.length,
          });
        }

        console.log("All CV-detected cards failed identification, falling back to AI-native...");
      }

      console.log("Using AI-native batch detection...");

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        { text: BATCH_CARD_PROMPT },
      ]);

      const responseText = result.response.text().trim();
      const jsonStr = responseText.replace(/```json\n?|\n?```/g, "").trim();
      const cardsArray = JSON.parse(jsonStr);

      if (!Array.isArray(cardsArray)) {
        return res.status(422).json({ error: "Could not identify any cards in the image" });
      }

      const validCards = cardsArray
        .filter((c: any) => c.card_id && c.name)
        .slice(0, 20);

      return res.json({
        cards: validCards,
        count: validCards.length,
        method: "ai",
        totalDetected: validCards.length,
        failedCount: 0,
      });
    } catch (error: any) {
      console.error("Batch scan error:", error.message);
      const msg = error.message?.includes("404")
        ? "AI model unavailable. Please try again shortly."
        : "Failed to analyze batch image. Please try again.";
      return res.status(500).json({ error: msg });
    }
  });

  return httpServer;
}
