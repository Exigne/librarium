const { neon } = require('@neondatabase/serverless')

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  const sql = neon(process.env.DATABASE_URL)

  // Ensure table exists
  await sql`
    CREATE TABLE IF NOT EXISTS books (
      id          SERIAL PRIMARY KEY,
      title       VARCHAR(500)  NOT NULL,
      author      VARCHAR(500)  DEFAULT 'Unknown',
      filename    VARCHAR(500)  NOT NULL,
      file_type   VARCHAR(20)   NOT NULL,
      file_size   INTEGER,
      file_content TEXT         NOT NULL,
      created_at  TIMESTAMPTZ  DEFAULT NOW()
    )
  `

  // GET — list books (no content)
  if (event.httpMethod === 'GET') {
    try {
      const books = await sql`
        SELECT id, title, author, filename, file_type, file_size, created_at
        FROM books
        ORDER BY created_at DESC
      `
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ books }),
      }
    } catch (err) {
      console.error(err)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch books' }),
      }
    }
  }

  // POST — upload new book
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}')
      const { title, author, filename, file_type, file_size, file_content } = body

      if (!title || !filename || !file_content) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'title, filename and file_content are required' }),
        }
      }

      // Size guard: base64 of ~4MB raw = ~5.3MB string
      if (file_content.length > 6_000_000) {
        return {
          statusCode: 413,
          headers,
          body: JSON.stringify({ error: 'File too large. Maximum supported size is ~4 MB.' }),
        }
      }

      const [book] = await sql`
        INSERT INTO books (title, author, filename, file_type, file_size, file_content)
        VALUES (${title}, ${author || 'Unknown'}, ${filename}, ${file_type}, ${file_size || 0}, ${file_content})
        RETURNING id, title, author, filename, file_type, file_size, created_at
      `

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ book }),
      }
    } catch (err) {
      console.error(err)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to save book' }),
      }
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
}
