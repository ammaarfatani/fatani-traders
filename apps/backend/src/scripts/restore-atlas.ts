import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

async function restoreAtlas() {
  const backupFile = process.argv[2];
  if (!backupFile) {
    console.error('Usage: tsx restore-atlas.ts <path-to-backup-json>');
    process.exit(1);
  }

  const filePath = path.resolve(backupFile);
  if (!fs.existsSync(filePath)) {
    console.error(`Backup file not found at: ${filePath}`);
    process.exit(1);
  }

  const backupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`Loaded backup from ${filePath}`);
  console.log(`Database target: ${backupData._metadata?.database || 'fatani_traders'}`);

  const atlasUrl = (process.env.ATLAS_DATABASE_URL || process.env.DATABASE_URL || '').replace(/\"/g, '');
  const client = new MongoClient(atlasUrl);

  try {
    await client.connect();
    const db = client.db('fatani_traders');

    for (const [colName, docs] of Object.entries(backupData.collections)) {
      const records = docs as any[];
      if (records.length > 0) {
        await db.collection(colName).deleteMany({});
        await db.collection(colName).insertMany(records);
        console.log(`✓ Restored ${colName}: ${records.length} records`);
      }
    }
    console.log('✓ Full Atlas Restore completed successfully!');
  } catch (err: any) {
    console.error('Restore failed:', err.message);
  } finally {
    await client.close();
  }
}

restoreAtlas();
