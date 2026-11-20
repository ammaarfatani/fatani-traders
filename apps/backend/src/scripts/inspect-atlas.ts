import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

async function inspectAtlas() {
  const atlasUrl = (process.env.ATLAS_DATABASE_URL || process.env.DATABASE_URL || '').replace(/\"/g, '');
  
  console.log('Connecting to Atlas Cluster at:');
  const sanitized = atlasUrl.replace(/:[^@/]+@/, ':***@');
  console.log(sanitized);

  const client = new MongoClient(atlasUrl, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 20000,
  });

  try {
    await client.connect();
    console.log('✓ Successfully connected to MongoDB Atlas!');

    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    console.log('Databases on Cluster:', dbs.databases.map((d: any) => `${d.name} (${(d.sizeOnDisk / 1024).toFixed(1)} KB)`));

    const db = client.db('fatani_traders');
    const collections = await db.listCollections().toArray();
    
    console.log('\n--- COLLECTIONS & DOCUMENT COUNTS IN "fatani_traders" ---');
    const counts: Record<string, number> = {};
    for (const col of collections) {
      const c = await db.collection(col.name).countDocuments();
      counts[col.name] = c;
    }

    console.table(Object.entries(counts).map(([collection, count]) => ({ collection, count })));
    console.log('Total collections:', collections.length);

    const users = await db.collection('AdminUser').find({}).project({ passwordHash: 0 }).toArray();
    console.log('\n--- ADMIN USERS IN "fatani_traders" ---');
    console.log(users);
  } catch (err: any) {
    console.error('Failed to inspect Atlas:', err.message);
  } finally {
    await client.close();
  }
}

inspectAtlas();
