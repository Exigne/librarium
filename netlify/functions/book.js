const { neon } = require('@neondatabase/serverless')

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  const sql = neon(process.env.DATABASE_URL)
  const id = event.queryStringParameters?.id

  if (!id || isNaN(Number(id))) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Valid book id is required' }),
    }
  }

  // GET — fetch full book including content
  if (event.httpMethod === 'GET') {
    try {
      const [book] = await sql`
        SELECT id, title, author, filename, file_type, file_size, file_content, created_at
        FROM books
        WHERE id = ${Number(id)}
      `

      if (!book) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Book not found' }),
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(book),
      }
    } catch (err) {
      console.error(err)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch book' }),
      }
    }
  }

  // DELETE — remove book
  if (event.httpMethod === 'DELETE') {
    try {
      await sql`DELETE FROM books WHERE id = ${Number(id)}`
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true }),
      }
    } catch (err) {
      console.error(err)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to delete book' }),
      }
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
}
