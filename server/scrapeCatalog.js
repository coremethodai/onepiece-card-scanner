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

const BASE_URL = "https://en.onepiece-cardgame.com/cardlist/?series=";

const ALL_SETS = [
  { id: "569302", name: "PREMIUM BOOSTER - ONE PIECE CARD THE BEST vol.2 [PRB-02]" },
  { id: "569301", name: "PREMIUM BOOSTER - ONE PIECE CARD THE BEST [PRB-01]" },
  { id: "569203", name: "EXTRA BOOSTER - ONE PIECE HEROINES EDITION [EB-03]" },
  { id: "569202", name: "EXTRA BOOSTER - Anime 25th Collection [EB-02]" },
  { id: "569201", name: "EXTRA BOOSTER - MEMORIAL COLLECTION [EB-01]" },
  { id: "569114", name: "BOOSTER PACK - THE AZURE SEA'S SEVEN [OP14-EB04]" },
  { id: "569113", name: "BOOSTER PACK - CARRYING ON HIS WILL [OP-13]" },
  { id: "569112", name: "BOOSTER PACK - LEGACY OF THE MASTER [OP-12]" },
  { id: "569111", name: "BOOSTER PACK - A FIST OF DIVINE SPEED [OP-11]" },
  { id: "569110", name: "BOOSTER PACK - ROYAL BLOOD [OP-10]" },
  { id: "569109", name: "BOOSTER PACK - EMPERORS IN THE NEW WORLD [OP-09]" },
  { id: "569108", name: "BOOSTER PACK - TWO LEGENDS [OP-08]" },
  { id: "569107", name: "BOOSTER PACK - 500 YEARS IN THE FUTURE [OP-07]" },
  { id: "569106", name: "BOOSTER PACK - WINGS OF THE CAPTAIN [OP-06]" },
  { id: "569105", name: "BOOSTER PACK - AWAKENING OF THE NEW ERA [OP-05]" },
  { id: "569104", name: "BOOSTER PACK - KINGDOMS OF INTRIGUE [OP-04]" },
  { id: "569103", name: "BOOSTER PACK - PILLARS OF STRENGTH [OP-03]" },
  { id: "569102", name: "BOOSTER PACK - PARAMOUNT WAR [OP-02]" },
  { id: "569101", name: "BOOSTER PACK - ROMANCE DAWN [OP-01]" },
  { id: "569029", name: "STARTER DECK - Egghead [ST-29]" },
  { id: "569028", name: "STARTER DECK - GREEN/YELLOW Yamato [ST-28]" },
  { id: "569027", name: "STARTER DECK - BLACK Marshall.D.Teach [ST-27]" },
  { id: "569026", name: "STARTER DECK - PURPLE/BLACK Monkey.D.Luffy [ST-26]" },
  { id: "569025", name: "STARTER DECK - BLUE Buggy [ST-25]" },
  { id: "569024", name: "STARTER DECK - GREEN Jewelry Bonney [ST-24]" },
  { id: "569023", name: "STARTER DECK - RED Shanks [ST-23]" },
  { id: "569022", name: "STARTER DECK - Ace & Newgate [ST-22]" },
  { id: "569021", name: "STARTER DECK - Sakazuki [ST-21]" },
  { id: "569020", name: "STARTER DECK - Charlotte Katakuri [ST-20]" },
  { id: "569019", name: "STARTER DECK - Black Smoker [ST-19]" },
  { id: "569018", name: "STARTER DECK - Purple Monkey.D.Luffy [ST-18]" },
  { id: "569017", name: "STARTER DECK - Blue Donquixote Doflamingo [ST-17]" },
  { id: "569016", name: "STARTER DECK - Green Uta [ST-16]" },
  { id: "569015", name: "STARTER DECK - Red Edward.Newgate [ST-15]" },
  { id: "569014", name: "STARTER DECK - 3D2Y [ST-14]" },
  { id: "569013", name: "ULTRA DECK - The Three Brothers [ST-13]" },
  { id: "569012", name: "STARTER DECK - Zoro and Sanji [ST-12]" },
  { id: "569011", name: "STARTER DECK - Uta [ST-11]" },
  { id: "569010", name: "ULTRA DECK - The Three Captains [ST-10]" },
  { id: "569009", name: "STARTER DECK - Yamato [ST-09]" },
  { id: "569008", name: "STARTER DECK - Monkey D. Luffy [ST-08]" },
  { id: "569007", name: "STARTER DECK - Big Mom Pirates [ST-07]" },
  { id: "569006", name: "STARTER DECK - Absolute Justice [ST-06]" },
  { id: "569005", name: "STARTER DECK - ONE PIECE FILM edition [ST-05]" },
  { id: "569004", name: "STARTER DECK - Animal Kingdom Pirates [ST-04]" },
  { id: "569003", name: "STARTER DECK - The Seven Warlords of the Sea [ST-03]" },
  { id: "569002", name: "STARTER DECK - Worst Generation [ST-02]" },
  { id: "569001", name: "STARTER DECK - Straw Hat Crew [ST-01]" },
  { id: "569901", name: "Promotion card" },
  { id: "569801", name: "Other Product Card" },
];

async function scrapeSet(seriesId, setName) {
  const url = `${BASE_URL}${seriesId}`;
  console.log(`\nScraping: ${setName} (${seriesId})...`);

  const { data: html } = await axios.get(url);
  const $ = cheerio.load(html);

  const cards = [];
  const idCounts = {};

  $("dl.modalCol").each((_, el) => {
    const infoSpans = $(el).find(".infoCol span");
    if (infoSpans.length < 3) return;

    const card_id = infoSpans.eq(0).text().trim();
    const rarity = infoSpans.eq(1).text().trim();
    const type = infoSpans.eq(2).text().trim();
    const name = $(el).find(".cardName").first().text().trim();

    if (!card_id || !name) return;

    const count = idCounts[card_id] || 0;
    idCounts[card_id] = count + 1;

    const is_alt_art = count > 0;
    const alt_art_number = count > 0 ? count : 0;

    cards.push({ card_id, name, rarity, type, is_alt_art, alt_art_number, set_name: setName });
  });

  const uniqueIds = Object.keys(idCounts).length;
  console.log(`  Found ${cards.length} entries (${uniqueIds} unique card IDs)`);
  return cards;
}

async function uploadToFirestore(cards) {
  console.log(`\nUploading ${cards.length} cards to Firestore...`);
  let count = 0;

  for (const card of cards) {
    let docId;
    if (!card.is_alt_art) {
      docId = `${card.card_id}-standard`;
    } else if (card.alt_art_number === 1) {
      docId = `${card.card_id}-alt`;
    } else {
      docId = `${card.card_id}-alt${card.alt_art_number}`;
    }

    const docRef = doc(db, "Official_Catalog", docId);
    await setDoc(docRef, {
      card_id: card.card_id,
      name: card.name,
      rarity: card.rarity,
      type: card.type,
      is_alt_art: card.is_alt_art,
      alt_art_number: card.alt_art_number,
      set_name: card.set_name,
    });

    count++;
    if (count % 50 === 0) {
      console.log(`  Uploaded ${count}/${cards.length} cards...`);
    }
  }

  console.log(`Successfully uploaded all ${count} cards to Firestore.`);
}

async function main() {
  const targetSet = process.argv[2];

  let setsToScrape = ALL_SETS;
  if (targetSet) {
    setsToScrape = ALL_SETS.filter(
      (s) => s.id === targetSet || s.name.toLowerCase().includes(targetSet.toLowerCase())
    );
    if (setsToScrape.length === 0) {
      console.log(`No set found matching "${targetSet}". Available sets:`);
      ALL_SETS.forEach((s) => console.log(`  ${s.id} - ${s.name}`));
      process.exit(1);
    }
  }

  console.log(`Scraping ${setsToScrape.length} set(s)...\n`);

  let allCards = [];
  for (const set of setsToScrape) {
    try {
      const cards = await scrapeSet(set.id, set.name);
      allCards = allCards.concat(cards);
    } catch (err) {
      console.error(`  Error scraping ${set.name}: ${err.message}`);
    }
  }

  console.log(`\nTotal cards scraped: ${allCards.length}`);

  if (allCards.length === 0) {
    console.log("No cards found. Exiting.");
    return;
  }

  await uploadToFirestore(allCards);
  console.log("\nScrape and upload complete!");
}

main();
