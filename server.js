
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "user-management-local-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, "public")));

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Please login first." });
  }
  next();
}

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required."
      });
    }

    const user = db.prepare(
      "SELECT * FROM users WHERE email = ?"
    ).get(email.trim().toLowerCase());

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    req.session.userId = user.id;

    res.json({
      message: "Login successful!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed." });
  }
});

// GET LOGGED-IN USER
app.get("/api/me", requireLogin, (req, res) => {
  const user = db.prepare(
    "SELECT id, name, email FROM users WHERE id = ?"
  ).get(req.session.userId);

  if (!user) {
    return res.status(401).json({ message: "User not found." });
  }

  res.json(user);
});

// ADD USER
app.post("/api/users", requireLogin, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "All fields are required."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const duplicate = db.prepare(
      "SELECT id FROM users WHERE email = ?"
    ).get(normalizedEmail);

    if (duplicate) {
      return res.status(409).json({
        message: "Email already exists."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.prepare(`
      INSERT INTO users (name, email, password, status)
      VALUES (?, ?, ?, 'Active')
    `).run(name.trim(), normalizedEmail, hashedPassword);

    res.status(201).json({
      message: "User added successfully!",
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error(error);

    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        message: "Email already exists."
      });
    }

    res.status(500).json({ message: "Unable to add user." });
  }
});

// GET ALL USERS
app.get("/api/users", requireLogin, (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, status, created_at
    FROM users
    ORDER BY id DESC
  `).all();

  res.json(users);
});

// EDIT USER
app.put("/api/users/:id", requireLogin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, status } = req.body;

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      !name.trim() ||
      !email.trim()
    ) {
      return res.status(400).json({
        message: "Name and email are required."
      });
    }

    if (!["Active", "Inactive"].includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const existing = db.prepare(
      "SELECT id FROM users WHERE id = ?"
    ).get(id);

    if (!existing) {
      return res.status(404).json({ message: "User not found." });
    }

    const duplicate = db.prepare(
      "SELECT id FROM users WHERE email = ? AND id != ?"
    ).get(email.trim().toLowerCase(), id);

    if (duplicate) {
      return res.status(409).json({
        message: "Email already exists."
      });
    }

    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, status = ?
      WHERE id = ?
    `).run(name.trim(), email.trim().toLowerCase(), status, id);

    res.json({ message: "User updated successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update user." });
  }
});

// DELETE USER
app.delete("/api/users/:id", requireLogin, (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    if (id === req.session.userId) {
      return res.status(400).json({
        message: "You cannot delete your own logged-in account."
      });
    }

    const result = db.prepare(
      "DELETE FROM users WHERE id = ?"
    ).run(id);

    if (result.changes === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ message: "User deleted successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete user." });
  }
});

// USERS PAGE
app.get("/users", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/");
  }

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>User Management</title>
<style>
* { box-sizing: border-box; }

body {
  font-family: Arial, sans-serif;
  background: #f3f4f6;
  margin: 0;
  padding: 30px;
  color: #222;
}

.container {
  max-width: 1150px;
  margin: auto;
  background: white;
  padding: 25px;
  border-radius: 10px;
  box-shadow: 0 2px 12px #00000012;
}

.topbar, .toolbar, .pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

h1 { margin-top: 0; }

input, select, button {
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #ccc;
  font-size: 14px;
}

input { width: 100%; }

button {
  cursor: pointer;
  border: none;
  background: #2563eb;
  color: white;
}

button:hover { opacity: 0.9; }
button:disabled { opacity: 0.5; cursor: not-allowed; }

.logout, .delete { background: #dc2626; }
.edit { background: #0f766e; }
.cancel { background: #6b7280; }

.toolbar { margin: 20px 0; }
.toolbar input { max-width: 350px; }

.form-box {
  display: none;
  background: #f9fafb;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 18px;
  margin: 20px 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin: 12px 0;
}

.form-box h2 { margin-top: 0; }
.table-wrap { overflow-x: auto; }

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

th, td {
  padding: 12px;
  border-bottom: 1px solid #ddd;
  text-align: left;
}

th { background: #eff6ff; }
.actions { display: flex; gap: 6px; }
.actions button { padding: 8px 10px; }
.pagination { justify-content: center; margin-top: 20px; }
#message { margin: 12px 0; }
.error { color: #dc2626; }
.success { color: #15803d; }

@media(max-width: 600px) {
  body { padding: 10px; }
  .container { padding: 15px; }
}
</style>
</head>
<body>
<div class="container">
  <div class="topbar">
    <h1>User Management</h1>
    <button class="logout" id="logoutBtn">Logout</button>
  </div>

  <div class="toolbar">
    <input id="searchInput" type="search"
      placeholder="Search by name or email..." aria-label="Search users">
    <button id="addUserBtn">+ Add User</button>
    <button id="fibonacciBtn">Fibonacci Table</button>
  </div>

  <div id="message" role="status"></div>

  <section class="form-box" id="userFormBox">
    <h2 id="formTitle">Add New User</h2>
    <form id="userForm">
      <div class="form-grid">
        <input id="name" name="name" placeholder="Full name"
          required maxlength="100">
        <input id="email" name="email" type="email"
          placeholder="Email address" required maxlength="254">
        <input id="password" name="password" type="password"
          placeholder="Password (minimum 8 characters)" minlength="8">
        <select id="status" name="status">
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>
      <p id="passwordHelp">Password is required for a new user.</p>
      <button type="submit" id="saveBtn">Save User</button>
      <button type="button" class="cancel" id="cancelBtn">Cancel</button>
    </form>
  </section>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Name</th><th>Email</th>
          <th>Status</th><th>Created At</th><th>Actions</th>
        </tr>
      </thead>
      <tbody id="userTableBody">
        <tr><td colspan="6">Loading users...</td></tr>
      </tbody>
    </table>
  </div>

  <div class="pagination">
    <button id="prevBtn">Previous</button>
    <span id="pageInfo">Page 1 of 1</span>
    <button id="nextBtn">Next</button>
  </div>
</div>

<script>
const searchInput = document.getElementById("searchInput");
const tableBody = document.getElementById("userTableBody");
const pageInfo = document.getElementById("pageInfo");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const message = document.getElementById("message");
const userFormBox = document.getElementById("userFormBox");
const userForm = document.getElementById("userForm");
const passwordInput = document.getElementById("password");
const statusInput = document.getElementById("status");

let allUsers = [];
let currentPage = 1;
let editingId = null;
const pageSize = 5;

function showMessage(text, type) {
  message.textContent = text;
  message.className = type || "";
}

function makeCell(value) {
  const td = document.createElement("td");
  td.textContent = value == null ? "" : String(value);
  return td;
}

function renderUsers() {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = allUsers.filter(user =>
    user.name.toLowerCase().includes(term) ||
    user.email.toLowerCase().includes(term)
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  tableBody.replaceChildren();

  if (visible.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "No users found.";
    tr.appendChild(td);
    tableBody.appendChild(tr);
  } else {
    visible.forEach(user => {
      const tr = document.createElement("tr");
      tr.appendChild(makeCell(user.id));
      tr.appendChild(makeCell(user.name));
      tr.appendChild(makeCell(user.email));
      tr.appendChild(makeCell(user.status));
      tr.appendChild(makeCell(user.created_at));

      const actions = document.createElement("td");
      actions.className = "actions";

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.className = "edit";
      editBtn.addEventListener("click", () => openEditForm(user));

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.className = "delete";
      deleteBtn.addEventListener("click", () => deleteUser(user));

      actions.append(editBtn, deleteBtn);
      tr.appendChild(actions);
      tableBody.appendChild(tr);
    });
  }

  pageInfo.textContent = "Page " + currentPage + " of " + totalPages;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;
}

async function loadUsers() {
  try {
    const response = await fetch("/api/users");
    const data = await response.json();

    if (response.status === 401) {
      window.location.href = "/";
      return;
    }

    if (!response.ok) {
      throw new Error(data.message || "Could not load users.");
    }

    allUsers = data;
    renderUsers();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function openAddForm() {
  editingId = null;
  userForm.reset();
  document.getElementById("formTitle").textContent = "Add New User";
  document.getElementById("saveBtn").textContent = "Save User";
  passwordInput.required = true;
  passwordInput.placeholder = "Password (minimum 8 characters)";
  document.getElementById("passwordHelp").textContent =
    "Password is required for a new user.";
  statusInput.value = "Active";
  userFormBox.style.display = "block";
  document.getElementById("name").focus();
}

function openEditForm(user) {
  editingId = user.id;
  userForm.reset();
  document.getElementById("formTitle").textContent = "Edit User";
  document.getElementById("saveBtn").textContent = "Update User";

  document.getElementById("name").value = user.name;
  document.getElementById("email").value = user.email;
  statusInput.value = user.status;

  passwordInput.required = false;
  passwordInput.value = "";
  passwordInput.placeholder = "Password not needed for editing";
  document.getElementById("passwordHelp").textContent =
    "Leave password blank to keep the existing password.";

  userFormBox.style.display = "block";
  document.getElementById("name").focus();
}

async function deleteUser(user) {
  const confirmed = window.confirm(
    'Delete user "' + user.name + '" (' + user.email + ')?'
  );

  if (!confirmed) return;

  try {
    const response = await fetch("/api/users/" + user.id, {
      method: "DELETE"
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Unable to delete user.");
    }

    showMessage(result.message, "success");
    await loadUsers();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

document.getElementById("addUserBtn").addEventListener("click", openAddForm);
document.getElementById("fibonacciBtn").addEventListener("click", () => {
  window.location.href = "/fibonacci.html";
});

document.getElementById("cancelBtn").addEventListener("click", () => {
  userForm.reset();
  userFormBox.style.display = "none";
  editingId = null;
  showMessage("", "");
});

searchInput.addEventListener("input", () => {
  currentPage = 1;
  renderUsers();
});

prevBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderUsers();
  }
});

nextBtn.addEventListener("click", () => {
  currentPage++;
  renderUsers();
});

userForm.addEventListener("submit", async event => {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = passwordInput.value;
  const status = statusInput.value;

  const data = { name, email, status };

  let url = "/api/users";
  let method = "POST";

  if (editingId !== null) {
    url = "/api/users/" + editingId;
    method = "PUT";
  } else {
    data.password = password;
  }

  showMessage("Saving...", "");

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Unable to save user.");
    }

    userForm.reset();
    userFormBox.style.display = "none";
    editingId = null;
    passwordInput.required = true;
    searchInput.value = "";
    currentPage = 1;

    await loadUsers();
    showMessage(result.message, "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    const response = await fetch("/api/logout", { method: "POST" });

    if (response.ok) {
      window.location.href = "/";
    } else {
      showMessage("Logout failed. Please try again.", "error");
    }
  } catch (error) {
    showMessage("Unable to connect to server.", "error");
  }
});

loadUsers();
</script>
</body>
</html>
  `);
});

// LOGOUT
app.post("/api/logout", (req, res) => {
  req.session.destroy(error => {
    if (error) {
      return res.status(500).json({ message: "Logout failed." });
    }

    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully." });
  });
});

// START SERVER
app.listen(PORT, () => {
  console.log("Server running at http://localhost:" + PORT);
});