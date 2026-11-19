import { MongoClient } from 'mongodb';

async function initReplSet() {
  const uri = 'mongodb://127.0.0.1:27018/?directConnection=true';
  console.log('Connecting to', uri);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected! Checking replica set status...');
    const adminDb = client.db('admin');

    try {
      const status = await adminDb.command({ replSetGetStatus: 1 });
      console.log('Replica set already initialized:', status.set);
      return;
    } catch (e: any) {
      console.log('Replica set not initialized yet. Initiating rs0...');
    }

    const result = await adminDb.command({
      replSetInitiate: {
        _id: 'rs0',
        members: [{ _id: 0, host: '127.0.0.1:27018' }],
      },
    });

    console.log('Replica set initiated successfully:', result);
  } catch (err: any) {
    console.error('Error initiating replica set:', err.message);
  } finally {
    await client.close();
  }
}

initReplSet();
