
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");

const db = new Database("users.db");

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active'
      CHECK (status IN ('Active', 'Inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create a demo admin account if it doesn't exist
const admin = db.prepare(
  "SELECT id FROM users WHERE email = ?"
).get("admin@example.com");

if (!admin) {
  const hashedPassword = bcrypt.hashSync("Admin123!", 10);

  db.prepare(`
    INSERT INTO users (name, email, password, status)
    VALUES (?, ?, ?, ?)
  `).run("Admin", "admin@example.com", hashedPassword, "Active");
}

console.log("Database is ready!");

module.exports = db;