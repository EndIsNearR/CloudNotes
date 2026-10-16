const path = require('path');
const express = require('express');
const sql = require('mssql');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Provided by Azure App Service > Environment variables (App Settings)
const connectionString = process.env.SQL_CONNECTION_STRING;
let poolPromise = null;

async function ensureSchema(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.Notes', 'U') IS NULL
    CREATE TABLE dbo.Notes (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Text NVARCHAR(500) NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );`);
}

function getPool() {
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is not set');
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(connectionString)
      .connect()
      .then(async (pool) => { await ensureSchema(pool); return pool; })
      .catch((err) => { poolPromise = null; throw err; });
  }
  return poolPromise;
}

// Liveness: does not touch the database
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Readiness: proves database connectivity
app.get('/api/db-status', async (_req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query('SELECT DB_NAME() AS db, SYSUTCDATETIME() AS serverTime');
    res.json({ connected: true, ...r.recordset[0] });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

app.get('/api/notes', async (_req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query('SELECT TOP 50 Id, Text, CreatedAt FROM dbo.Notes ORDER BY Id DESC');
    res.json(r.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes', async (req, res) => {
  const text = (req.body && req.body.text || '').toString().trim();
  if (!text) return res.status(400).json({ error: 'text is required' });
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('text', sql.NVarChar(500), text.slice(0, 500))
      .query('INSERT INTO dbo.Notes (Text) OUTPUT INSERTED.Id, INSERTED.Text, INSERTED.CreatedAt VALUES (@text)');
    res.status(201).json(r.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Listening on ${port}`));
