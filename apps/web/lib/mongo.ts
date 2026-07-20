import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI!;
const dbName = "cation";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export async function getCollection<T extends object>(name: string) {
  const database = await getDb();
  return database.collection<T>(name);
}
