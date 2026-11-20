import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

async function backupAtlas() {
  const atlasUrl = (process.env.ATLAS_DATABASE_URL || process.env.DATABASE_URL || '').replace(/\"/g, '');
  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `atlas_production_backup_${timestamp}.json`);

  console.log('Connecting to MongoDB Atlas for full production backup...');
  const client = new MongoClient(atlasUrl, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 20000,
  });

  try {
    await client.connect();
    console.log('✓ Connected to Atlas Cluster.');

    const db = client.db('fatani_traders');
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections in 'fatani_traders'.`);

    const fullBackup: Record<string, any> = {
      _metadata: {
        timestamp: new Date().toISOString(),
        cluster: 'cluster0.zvlq9ef.mongodb.net',
        database: 'fatani_traders',
        collectionsCount: collections.length,
      },
      collections: {},
      counts: {},
    };

    for (const col of collections) {
      const docs = await db.collection(col.name).find({}).toArray();
      fullBackup.collections[col.name] = docs;
      fullBackup.counts[col.name] = docs.length;
      console.log(`  - Backed up ${col.name}: ${docs.length} records`);
    }

    fs.writeFileSync(backupPath, JSON.stringify(fullBackup, null, 2), 'utf-8');
    const stats = fs.statSync(backupPath);
    console.log('\n✓ BACKUP COMPLETED AND VERIFIED:');
    console.log(`  File: ${backupPath}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`  Total Collections: ${Object.keys(fullBackup.counts).length}`);
    console.log(`  Total Documents: ${Object.values(fullBackup.counts as Record<string, number>).reduce((a, b) => a + b, 0)}`);

    // Verify file is readable and valid JSON
    const readBack = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    if (readBack._metadata && readBack.collections) {
      console.log('✓ Backup integrity check: SUCCESS (Valid JSON with intact structure)');
    } else {
      throw new Error('Integrity check failed: corrupted backup');
    }
  } catch (err: any) {
    console.error('Backup failed:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

backupAtlas();
