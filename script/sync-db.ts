import pg from "pg";
const { Client } = pg;

const DATABASE_URL = "postgresql://neondb_owner:npg_0qrnkFExlM7B@ep-lucky-shadow-accxmlyi.sa-east-1.aws.neon.tech/neondb?sslmode=require";

const sql = `
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  body_image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_visible BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

`;

async function sync() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log("Connected to database");
    await client.query(sql);
    console.log("Tables created successfully");
  } catch (err) {
    console.error("Error creating tables:", err);
  } finally {
    await client.end();
  }
}

sync();
