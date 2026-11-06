import { MongoClient } from 'mongodb'

export async function connectDatabase(config) {
  const client = new MongoClient(config.mongodbUri, { serverSelectionTimeoutMS: 10000 })
  try {
    await client.connect()
    const db = client.db(config.mongodbDb)
    await db.command({ ping: 1 })
    await db.collection('users').createIndex({ userId: 1 }, { unique: true })
    await db.collection('users').createIndex({ uid: 1 }, { unique: true })
    await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    return { client, db }
  } catch (error) {
    await client.close()
    throw error
  }
}

export function createSessionStore(db) {
  const sessions = db.collection('sessions')
  return {
    get: (key) => sessions.findOne({ _id: key }),
    set: (key, value) => sessions.updateOne({ _id: key }, { $set: value }, { upsert: true }),
    destroy: (key) => sessions.deleteOne({ _id: key }),
  }
}
