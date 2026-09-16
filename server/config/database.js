const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFilePath = path.join(dataDir, 'aapna_tiffin.db');

let sqlJsInstance = null;
let rawDb = null;
let txnDepth = 0;

function getRawDb() {
  if (rawDb) return rawDb;
  throw new Error('Database not initialized yet. Call initDatabase() first.');
}

function saveDbToDisk() {
  if (rawDb && txnDepth === 0) {
    const data = rawDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
  }
}

function formatParams(params) {
  if (!params || params.length === 0) return [];
  return params;
}

const db = {
  async init() {
    if (rawDb) return this;
    sqlJsInstance = await initSqlJs();
    if (fs.existsSync(dbFilePath)) {
      const fileBuffer = fs.readFileSync(dbFilePath);
      rawDb = new sqlJsInstance.Database(fileBuffer);
    } else {
      rawDb = new sqlJsInstance.Database();
    }
    
    // Enable foreign keys
    rawDb.run('PRAGMA foreign_keys = ON;');

    // Load schema
    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      rawDb.exec(schemaSql);
      
      // Auto-migrate sound_type column if needed
      try {
        rawDb.exec(`ALTER TABLE notifications ADD COLUMN sound_type TEXT DEFAULT 'notification';`);
      } catch (e) {
        // column may already exist
      }
      
      saveDbToDisk();
    }
    return this;
  },

  prepare(sql) {
    return {
      all(...params) {
        const d = getRawDb();
        const stmt = d.prepare(sql);
        try {
          if (params.length > 0) {
            stmt.bind(formatParams(params));
          }
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          return results;
        } finally {
          stmt.free();
        }
      },

      get(...params) {
        const d = getRawDb();
        const stmt = d.prepare(sql);
        try {
          if (params.length > 0) {
            stmt.bind(formatParams(params));
          }
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },

      run(...params) {
        const d = getRawDb();
        d.run(sql, formatParams(params));
        saveDbToDisk();
        const rowsModified = d.getRowsModified();
        return { changes: rowsModified };
      }
    };
  },

  exec(sql) {
    const d = getRawDb();
    d.exec(sql);
    saveDbToDisk();
  },

  transaction(fn) {
    return (...args) => {
      const d = getRawDb();
      const isTopLevel = (txnDepth === 0);
      txnDepth++;
      if (isTopLevel) {
        d.exec('BEGIN TRANSACTION;');
      }
      try {
        const result = fn(...args);
        txnDepth--;
        if (isTopLevel) {
          d.exec('COMMIT;');
          saveDbToDisk();
        }
        return result;
      } catch (err) {
        txnDepth = 0;
        try {
          d.exec('ROLLBACK;');
        } catch (rbErr) {
          // ignore rollback error if already rolled back
        }
        console.error('[DATABASE TRANSACTION ERROR]', err.message);
        throw err;
      }
    };
  },

  save() {
    saveDbToDisk();
  }
};

module.exports = db;
