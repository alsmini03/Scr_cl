import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT id, email, is_approved FROM users WHERE email = 'alsmini03@gmail.com'");
    console.log("User Status:", res.rows);

    if (res.rows.length > 0 && !res.rows[0].is_approved) {
        console.log("Approving user...");
        await client.query("UPDATE users SET is_approved = TRUE WHERE email = 'alsmini03@gmail.com'");
        console.log("User approved.");
    } else if (res.rows.length === 0) {
        console.log("User not found.");
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

check();
