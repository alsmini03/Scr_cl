import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Seeding process started...");

    // Default tabs are removed as per user request to start with a clean state.
    // Users can now manually add their preferred channels.

  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
