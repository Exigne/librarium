const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
  if (!process.env.DATABASE_URL) {
    return { statusCode: 500, body: JSON.stringify({ error: "DATABASE_URL environment variable is missing." }) };
  }

  const id = event.queryStringParameters.id;
  if (!id) return { statusCode: 400, body: JSON.stringify({ error: "Missing book ID parameter" }) };

  try {
    if (event.httpMethod === 'GET') {
      const res = await pool.query('SELECT * FROM books WHERE id = $1', [id]);
      if (res.rows.length === 0) return { statusCode: 404, body: JSON.stringify({ error: 'Book not found' }) };
      return { statusCode: 200, body: JSON.stringify(res.rows[0]) };
    }

    if (event.httpMethod === 'DELETE') {
      await pool.query('DELETE FROM books WHERE id = $1', [id]);
      return { statusCode: 200, body: JSON.stringify({ message: 'Book deleted successfully' }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (error) {
    console.error("Database Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || "A database error occurred" }) };
  }
};
