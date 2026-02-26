import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { detectAndCropCards } from "./batchDetect";
import { scrapePrice } from "./jobs/scrapePrice";

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

const GROUPED_CARDS_PROMPT = `You are an expert One Piece Trading Card Game identifier. You are given multiple individual card images. Identify each card image in the order they appear.

For each card, extract:
1. card_id - The card number printed on the card (e.g., "EB04-012", "OP01-025", "ST01-012")
2. name - The character or card name
3. rarity - The rarity symbol (C, UC, R, SR, SEC, L, SP)
4. type - The card type (CHARACTER, EVENT, STAGE, LEADER)
5. is_alt_art - Whether this appears to be an alternate/parallel art version (true/false)

Return a JSON array with one entry per image, in the same order. If a card cannot be identified, use null for that position.

Respond ONLY with a valid JSON array, no markdown or extra text:
[{"card_id": "...", "name": "...", "rarity": "...", "type": "...", "is_alt_art": false}, ...]`;

async function enrichWithPrice(card: { card_id: string; name: string; [key: string]: any }) {
  try {
    const priceData = await scrapePrice(card.card_id, card.name);
    if (priceData.marketPrice !== null) {
      return {
        ...card,
        current_price: priceData.marketPrice,
        lowest_price: priceData.lowestPrice,
      };
    }
  } catch (err: any) {
    console.log(`Price lookup failed for ${card.card_id}: ${err.message}`);
  }
  return { ...card, current_price: null, lowest_price: null };
}

async function enrichCardsWithPrices(cards: any[]): Promise<any[]> {
  return Promise.all(cards.map((card) => enrichWithPrice(card)));
}

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

      const enriched = await enrichWithPrice(cardData);
      return res.json(enriched);
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
        console.log(`CV detected ${croppedCards.length} card(s), sending grouped Gemini call...`);

        try {
          const imageParts = croppedCards.map((card) => ({
            inlineData: {
              data: card.base64,
              mimeType: "image/jpeg",
            },
          }));

          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          const result = await model.generateContent([
            ...imageParts,
            { text: GROUPED_CARDS_PROMPT },
          ]);

          const responseText = result.response.text().trim();
          const jsonStr = responseText.replace(/```json\n?|\n?```/g, "").trim();
          const cardsArray = JSON.parse(jsonStr);

          if (Array.isArray(cardsArray)) {
            const validCards: any[] = [];
            let failedCount = 0;
            for (let i = 0; i < croppedCards.length; i++) {
              const c = cardsArray[i];
              if (c && c.card_id && c.name) {
                validCards.push({
                  card_id: c.card_id,
                  name: c.name,
                  rarity: c.rarity || "",
                  type: c.type || "",
                  is_alt_art: c.is_alt_art || false,
                });
              } else {
                failedCount++;
              }
            }

            if (validCards.length > 0) {
              const pricedCards = await enrichCardsWithPrices(validCards.slice(0, 20));
              return res.json({
                cards: pricedCards,
                count: pricedCards.length,
                method: "cv",
                totalDetected: croppedCards.length,
                failedCount,
              });
            }
          }
        } catch (err: any) {
          console.error("Grouped Gemini call failed:", err.message);
        }

        console.log("Grouped CV identification failed, falling back to AI-native...");
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

      const pricedCards = await enrichCardsWithPrices(validCards);
      return res.json({
        cards: pricedCards,
        count: pricedCards.length,
        method: "ai",
        totalDetected: pricedCards.length,
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
