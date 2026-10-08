import { runIngestion } from "./ingest";

// Run every 15 minutes
const FIFTEEN_MINUTES = 15 * 60 * 1000;

console.log("Starting 15-minute ingestion scheduler...");
runIngestion().then(() => console.log("Initial ingestion complete."));

setInterval(() => {
  console.log("Running scheduled ingestion...");
  runIngestion();
}, FIFTEEN_MINUTES);
