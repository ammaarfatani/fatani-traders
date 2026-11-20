import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

async function connectWithRetry(retries = 5, delay = 3000) {
  const url = process.env.DATABASE_URL!.replace(/\"/g, '');
  console.log('Attempting connection to MongoDB Atlas with Google DNS (8.8.8.8)...');
  for (let i = 1; i <= retries; i++) {
    const client = new MongoClient(url, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 15000,
    });
    try {
      await client.connect();
      console.log(`✓ Connected successfully on attempt ${i}!`);
      const dbs = await client.db().admin().listDatabases();
      console.log('Databases available:', dbs.databases.map((d: any) => d.name));
      await client.close();
      return true;
    } catch (err: any) {
      console.log(`Attempt ${i} failed: ${err.message}`);
      await client.close();
      if (i < retries) {
        console.log(`Waiting ${delay / 1000}s before retry...`);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }
  return false;
}

connectWithRetry();
