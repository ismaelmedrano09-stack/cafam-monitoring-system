const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

function readSql(fileName) {
  const filePath = path.join(__dirname, '..', 'database', fileName);
  return fs
    .readFileSync(filePath, 'utf8')
    .replace(/CREATE DATABASE IF NOT EXISTS[\s\S]*?;\s*/i, '')
    .replace(/USE\s+[`"]?cafam_monitoring[`"]?\s*;\s*/gi, '');
}

async function run() {
  const reset = process.env.INIT_DATABASE_CONFIRM === 'RESET';
  if (!reset) {
    console.error('Este comando reinicia tablas y datos. Ejecuta con INIT_DATABASE_CONFIRM=RESET para continuar.');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    ...env.db,
    multipleStatements: true
  });

  try {
    console.log(`Inicializando base de datos ${env.db.database} en ${env.db.host}:${env.db.port}`);
    await connection.query(readSql('schema.sql'));
    await connection.query(readSql('seed.sql'));
    console.log('Base de datos inicializada correctamente.');
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error('No fue posible inicializar la base de datos:', error.message);
  process.exit(1);
});
