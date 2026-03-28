const { Client } = require('pg')

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
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

  const id = event.queryStringParameters?.id

  if (!id || isNaN(Number(id))) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Valid book id is required' }),
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

  // GET — fetch full book including content
  if (event.httpMethod === 'GET') {
    try {
      const result = await client.query(
        'SELECT id, title, author, filename, file_type, file_size, file_content, created_at FROM books WHERE id = $1',
        [Number(id)]
      )

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Book not found' }),
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows[0]),
      }
    } catch (err) {
      console.error('Fetch book error:', err)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch book: ' + err.message }),
      }
    } finally {
      await client.end()
    }
  }

  // DELETE — remove book
  if (event.httpMethod === 'DELETE') {
    try {
      await client.query('DELETE FROM books WHERE id = $1', [Number(id)])
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true }),
      }
    } catch (err) {
      console.error('Delete book error:', err)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to delete book: ' + err.message }),
      }
    } finally {
      await client.end()
    }
  }

  await client.end()
  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
}
