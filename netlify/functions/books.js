const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
  if (!process.env.DATABASE_URL) {
    return { statusCode: 500, body: JSON.stringify({ error: "DATABASE_URL is missing." }) };
  }

  try {
    // Auto-create table on first run
    await pool.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title TEXT,
        author TEXT,
        filename TEXT,
        filetype TEXT,
        content TEXT,
        cover TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (event.httpMethod === 'GET') {
      const res = await pool.query('SELECT id, title, author, filename, filetype, cover, created_at FROM books ORDER BY created_at DESC');
      return { statusCode: 200, body: JSON.stringify(res.rows) };
    }

    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      const res = await pool.query(
        'INSERT INTO books (title, author, filename, filetype, content, cover) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [data.title, data.author, data.filename, data.filetype, data.content, data.cover]
      );
      return { statusCode: 201, body: JSON.stringify({ id: res.rows[0].id, message: 'Book uploaded' }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (error) {
    console.error("Database Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || "Database error" }) };
  }
};
