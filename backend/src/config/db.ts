import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DB_SERVER || !process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error('FATAL ERROR: DB_SERVER, DB_NAME, DB_USER, and DB_PASSWORD environment variables are required.');
  process.exit(1);
}

const dbConfig: sql.config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  requestTimeout: 60000,
  connectionTimeout: 30000,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;
let poolPromise: Promise<sql.ConnectionPool> | null = null;

export const getDbPool = async (): Promise<sql.ConnectionPool> => {
  if (pool && pool.connected) {
    return pool;
  }
  if (!poolPromise) {
    poolPromise = sql.connect(dbConfig).then((p) => {
      pool = p;
      return p;
    }).catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
};

export { sql };
