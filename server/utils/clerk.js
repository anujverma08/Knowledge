// src/app.js or a dedicated file (e.g., src/utils/clerkClient.js)
import { Clerk } from "@clerk/clerk-sdk-node";
import dotenv from "dotenv";

dotenv.config();

const clerk = new Clerk({
  apiKey: process.env.CLERK_API_KEY,  // ← your secret key used here
});

export default clerk;
