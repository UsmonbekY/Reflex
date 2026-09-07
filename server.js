const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // serves the HTML too

// Serve AimTrainer.html when someone visits the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'AimTrainer.html'));
});

const DB_FILE = path.join(__dirname, 'db.json');

// Initialize database
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: {}, leaderboard: [] }, null, 2));
}

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function hash(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Register
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3) return res.status(400).json({ error: 'Username too short' });
  if (password.length < 3) return res.status(400).json({ error: 'Password too short' });

  const db = readDB();
  const key = username.toLowerCase().trim();
  if (db.users[key]) return res.status(400).json({ error: 'Username already taken' });

  db.users[key] = { password: hash(password), created: Date.now() };
  writeDB(db);
  res.json({ success: true, username: key });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const key = username.toLowerCase().trim();
  const user = db.users[key];

  if (!user || user.password !== hash(password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  res.json({ success: true, username: key });
});

// Delete account
app.delete('/api/account', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const db = readDB();
  const key = username.toLowerCase().trim();
  const user = db.users[key];

  if (!user || user.password !== hash(password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  delete db.users[key];
  db.leaderboard = db.leaderboard.filter(e => e.username !== key);
  writeDB(db);

  res.json({ success: true });
});

// Submit score (ranked only)
app.post('/api/score', (req, res) => {
  const { username, score } = req.body;
  if (!username || typeof score !== 'number') {
    return res.status(400).json({ error: 'Invalid data' });
  }

  const db = readDB();
  const key = username.toLowerCase().trim();
  if (!db.users[key]) return res.status(401).json({ error: 'User not found' });

  const existing = db.leaderboard.find(e => e.username === key);
  if (existing) {
    if (score > existing.score) existing.score = score;
  } else {
    db.leaderboard.push({ username: key, score });
  }

  db.leaderboard.sort((a, b) => b.score - a.score);
  db.leaderboard = db.leaderboard.slice(0, 50); // top 50
  writeDB(db);

  res.json({ success: true });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  const db = readDB();
  res.json(db.leaderboard);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});