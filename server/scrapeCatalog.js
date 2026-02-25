import axios from "axios";
import * as cheerio from "cheerio";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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

const URL = "https://en.onepiece-cardgame.com/cardlist/?series=569114";

async function scrapeCards() {
  console.log("Fetching card catalog page...");
  const { data: html } = await axios.get(URL);
  const $ = cheerio.load(html);

  const cards = [];
  const seenIds = new Set();

  $("dl.modalCol").each((_, el) => {
    const infoSpans = $(el).find(".infoCol span");
    if (infoSpans.length < 3) return;

    const rawId = $(el).attr("id") || "";
    const card_id = infoSpans.eq(0).text().trim();
    const rarity = infoSpans.eq(1).text().trim();
    const type = infoSpans.eq(2).text().trim();
    const name = $(el).find(".cardName").first().text().trim();

    if (!card_id || !name) return;

    const is_alt_art = seenIds.has(card_id);
    seenIds.add(card_id);

    cards.push({ card_id, name, rarity, type, is_alt_art });
  });

  console.log(`Scraped ${cards.length} card entries (${seenIds.size} unique card IDs).`);
  return cards;
}

async function uploadToFirestore(cards) {
  console.log("Uploading cards to Firestore...");
  let count = 0;

  for (const card of cards) {
    const suffix = card.is_alt_art ? "alt" : "standard";
    const docId = `${card.card_id}-${suffix}`;

    const docRef = doc(db, "Official_Catalog", docId);
    await setDoc(docRef, card);

    count++;
    if (count % 10 === 0) {
      console.log(`  Uploaded ${count}/${cards.length} cards...`);
    }
  }

  console.log(`Successfully uploaded all ${count} cards to Firestore collection "Official_Catalog".`);
}

async function main() {
  try {
    const cards = await scrapeCards();
    if (cards.length === 0) {
      console.log("No cards found. Exiting.");
      return;
    }
    await uploadToFirestore(cards);
    console.log("Scrape and upload complete!");
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
