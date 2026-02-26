import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { scrapePrice } from "./scrapePrice";

const requiredEnvVars = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
];

const missing = requiredEnvVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  console.error("Ensure all FIREBASE_* env vars are set in your deployment.");
  process.exit(1);
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function timestamp(): string {
  return new Date().toISOString();
}

async function main() {
  console.log(`[${timestamp()}] Starting price update job...`);

  const snapshot = await getDocs(collection(db, "My_Collection"));

  if (snapshot.empty) {
    console.log(`[${timestamp()}] No cards in My_Collection. Exiting.`);
    process.exit(0);
  }

  const cards = snapshot.docs.map((d) => ({
    docId: d.id,
    data: d.data(),
  }));

  console.log(
    `[${timestamp()}] Found ${cards.length} card(s) to update.\n`
  );

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < cards.length; i++) {
    const { docId, data } = cards[i];
    const cardId = (data.card_id as string) || docId;
    const cardName = (data.name as string) || "";

    console.log(
      `[${i + 1}/${cards.length}] Scraping ${cardId} (${cardName})...`
    );

    const result = await scrapePrice(cardId, cardName);

    if (result.error) {
      console.log(`  ⚠ ${result.error}`);
      failCount++;

      if (
        result.error.includes("429") ||
        result.error.includes("403")
      ) {
        console.log(
          `  Pausing for 30s due to rate limiting...`
        );
        await randomDelay(25000, 35000);
      }
    } else if (result.marketPrice !== null) {
      const currentPrice = (data.current_price as number) ?? null;
      const storedLowest = (data.lowest_price as number) ?? null;

      let newLowest = result.lowestPrice;
      if (storedLowest !== null && newLowest !== null) {
        newLowest = Math.min(storedLowest, newLowest);
      } else if (storedLowest !== null) {
        newLowest = storedLowest;
      }

      const updateData: Record<string, any> = {
        current_price: result.marketPrice,
        previous_price: currentPrice,
        lowest_price: newLowest,
        last_updated: timestamp(),
      };

      try {
        await updateDoc(doc(db, "My_Collection", docId), updateData);
        console.log(
          `  ✓ Updated ${cardId}: $${result.marketPrice.toFixed(2)}${
            currentPrice !== null
              ? ` (was $${currentPrice.toFixed(2)})`
              : ""
          }`
        );
        successCount++;
      } catch (err: any) {
        console.log(`  ✗ Failed to update Firestore: ${err.message}`);
        failCount++;
      }
    } else {
      console.log(`  - No price found on TCGPlayer`);
      skipCount++;
    }

    if (i < cards.length - 1) {
      await randomDelay(3000, 8000);
    }
  }

  console.log(`\n[${timestamp()}] Price update job complete.`);
  console.log(`  Successes: ${successCount}`);
  console.log(`  Failures:  ${failCount}`);
  console.log(`  Skipped:   ${skipCount}`);
  console.log(`  Total:     ${cards.length}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(`[${timestamp()}] Fatal error:`, err);
  process.exit(1);
});
