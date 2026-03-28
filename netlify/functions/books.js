const { Client } = require('pg')

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

async function getClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  return client
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (!process.env.DATABASE_URL) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'DATABASE_URL environment variable is not set' }),
    }
  }

  let client
  try {
    client = await getClient()
  } catch (err) {
    console.error('DB connect error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to connect to database: ' + err.message }),
    }
  }

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS books (
        id           SERIAL PRIMARY KEY,
        title        VARCHAR(500)  NOT NULL,
        author       VARCHAR(500)  DEFAULT 'Unknown',
        filename     VARCHAR(500)  NOT NULL,
        file_type    VARCHAR(20)   NOT NULL,
        file_size    INTEGER,
        file_content TEXT          NOT NULL,
        created_at   TIMESTAMPTZ   DEFAULT NOW()
      )
    `)
  } catch (err) {
    await client.end()
    console.error('Create table error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Database setup failed: ' + err.message }),
    }
  }

  // GET — list books (no file content)
  if (event.httpMethod === 'GET') {
    try {
      const result = await client.query(
        'SELECT id, title, author, filename, file_type, file_size, created_at FROM books ORDER BY created_at DESC'
      )
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ books: result.rows }),
      }
    } catch (err) {
      console.error('Fetch books error:', err)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch books: ' + err.message }),
      }
    } finally {
      await client.end()
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

      if (file_content.length > 6_000_000) {
        return {
          statusCode: 413,
          headers,
          body: JSON.stringify({ error: 'File too large. Maximum supported size is ~4 MB.' }),
        }
      }

      const result = await client.query(
        `INSERT INTO books (title, author, filename, file_type, file_size, file_content)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, author, filename, file_type, file_size, created_at`,
        [title, author || 'Unknown', filename, file_type, file_size || 0, file_content]
      )

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ book: result.rows[0] }),
      }
    } catch (err) {
      console.error('Save book error:', err)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to save book: ' + err.message }),
      }
    } finally {
      await client.end()
    }
  }

  await client.end()
  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
}
