const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- User Data Store ---
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

function ensureDataDir() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    const defaultAdmin = [{
      "email": "admin@company.com",
      "passwordHash": "$2a$10$2iZhJZelizBwVgt3uHA4QuRP3rL5puGbY09LogtckInwO9sdkvotW", // Hash for 'password123'
      "name": "Admin",
      "role": "admin",
      "createdAt": new Date().toISOString()
    }];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultAdmin, null, 2), 'utf8');
  }
}

function getUsers() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'lamp-selection-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true behind HTTPS proxy
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// --- Auth Middleware ---
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden: Admin access required' });
}

// --- Auth Routes ---
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const valid = bcrypt.compareSync(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  req.session.user = { 
    email: user.email, 
    name: user.name, 
    role: user.role || 'user' 
  };
  return res.json({ 
    success: true, 
    user: req.session.user 
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ authenticated: true, user: req.session.user });
  }
  return res.json({ authenticated: false });
});

// --- User Management API (Admin Only) ---
app.get('/api/users', requireAdmin, (req, res) => {
  const users = getUsers().map(u => ({
    email: u.email,
    name: u.name,
    role: u.role || 'user',
    createdAt: u.createdAt
  }));
  res.json(users);
});

app.post('/api/users', requireAdmin, (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const users = getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'User already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const newUser = {
    email: email.toLowerCase(),
    passwordHash,
    name: name || email.split('@')[0],
    role: role === 'admin' ? 'admin' : 'user',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);
  res.json({ success: true, user: { email: newUser.email, name: newUser.name, role: newUser.role } });
});

app.delete('/api/users/:email', requireAdmin, (req, res) => {
  const emailToDelete = req.params.email;
  if (!emailToDelete) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  // Prevent admin from deleting themselves
  if (emailToDelete.toLowerCase() === req.session.user.email.toLowerCase()) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  let users = getUsers();
  const before = users.length;
  users = users.filter(u => u.email.toLowerCase() !== emailToDelete.toLowerCase());
  
  if (users.length === before) {
    return res.status(404).json({ error: 'User not found.' });
  }

  saveUsers(users);
  res.json({ success: true });
});

app.put('/api/users/:email', requireAdmin, (req, res) => {
  const emailToUpdate = req.params.email;
  const { password, role, name } = req.body;

  if (!emailToUpdate) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  let users = getUsers();
  const userIndex = users.findIndex(u => u.email.toLowerCase() === emailToUpdate.toLowerCase());

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Update name if provided
  if (name) users[userIndex].name = name;
  
  // Update role if provided (prevent admin from demoting themselves)
  if (role) {
    if (emailToUpdate.toLowerCase() === req.session.user.email.toLowerCase() && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot demote yourself from admin.' });
    }
    users[userIndex].role = role;
  }

  // Update password if provided
  if (password) {
    users[userIndex].passwordHash = bcrypt.hashSync(password, 10);
  }

  saveUsers(users);
  res.json({ success: true, user: { email: users[userIndex].email, name: users[userIndex].name, role: users[userIndex].role } });
});

// --- Protected API: Calculate ---
app.post('/api/calculate', requireAuth, (req, res) => {
  const { coilWidth, coilHeight } = req.body;
  const width = parseFloat(coilWidth);
  const height = parseFloat(coilHeight);

  if (isNaN(width) || isNaN(height) || width < 14 || height <= 0) {
    return res.status(400).json({ error: 'Invalid inputs. Width must be >= 14 and Height > 0.' });
  }

  const result = calculateLampSelection(width, height);
  return res.json(result);
});

// --- Calculation Logic (ported from Excel) ---
function calculateLampSelection(coilWidth, coilHeight) {
  const LAMP_LENGTHS = [14, 20, 26, 32, 42, 52, 62];
  const DISTANCE_BETWEEN_ROWS = 32;
  const MAX_LAMPS_PER_ROW_SHORT = 2; // for lamp lengths <= 42
  
  // C5: =ROUNDUP(Sheet1!B4/70,0)
  const maxLampsPerRow70Rule = Math.ceil(coilWidth / 70);

  // B6 / C6: =ROUNDUP(Sheet1!B5/B2,0)
  const idealRows = Math.ceil(coilHeight / DISTANCE_BETWEEN_ROWS);

  // B9 / C9: Selected # Rows = idealRows
  const selectedRows = idealRows;

  // Build the lamp table (rows 12-18 of Sheet2)
  const lampTable = LAMP_LENGTHS.map(length => {
    // B12-B18: =MIN(ROUNDDOWN(Sheet1!$B$4/A12,0))
    // MIN of a single value = the value itself
    const lampsPerRow = Math.floor(coilWidth / length);
    
    // C12-C18: =B12*A12
    const totalLampWidth = lampsPerRow * length;
    
    // D12-D18: validity check
    // For lengths 14-42: =IF(AND(C<=coilWidth, B<=2),1,0)
    // For lengths 52,62: =IF(AND(C<=coilWidth, B<=maxLampsPerRow70Rule),1,0)
    let maxAllowed;
    if (length >= 52) {
      maxAllowed = maxLampsPerRow70Rule;
    } else {
      maxAllowed = MAX_LAMPS_PER_ROW_SHORT;
    }
    const valid = (totalLampWidth <= coilWidth && lampsPerRow <= maxAllowed) ? 1 : 0;
    
    // E12-E18: =C*D (valid coverage)
    const validCoverage = totalLampWidth * valid;
    
    // F12-F18: =D*A (valid lamp length)
    const validLampLength = valid * length;

    return { length, lampsPerRow, totalLampWidth, valid, validCoverage, validLampLength };
  });

  // --- Option 1 (First / Best Coverage) ---
  // G2: =MAX(IF(D=1, C)) — maximum valid coverage
  const validEntries = lampTable.filter(r => r.valid === 1);
  const maxValidCoverage = validEntries.length > 0 
    ? Math.max(...validEntries.map(r => r.totalLampWidth))
    : 0;

  // G3: =MAX(IF((C=G2)*(D=1), A)) — longest lamp achieving that coverage
  const longestLampOpt1 = validEntries.length > 0
    ? Math.max(...validEntries.filter(r => r.totalLampWidth === maxValidCoverage).map(r => r.length))
    : 0;

  // G4: =INDEX(B12:B18, MATCH(G3, A12:A18, 0)) — lamps per row for that lamp
  const opt1Entry = lampTable.find(r => r.length === longestLampOpt1);
  const lampsPerRowOpt1 = opt1Entry ? opt1Entry.lampsPerRow : 0;

  // Sheet1 B8: =(Sheet2!G3)-2  — lamp length displayed is actual length minus 2
  const lampLengthOpt1 = longestLampOpt1 > 0 ? longestLampOpt1 - 2 : 0;
  
  // Sheet1 B9: =Sheet2!G4
  // Sheet1 B10: =Sheet2!B9 = selectedRows
  // Sheet1 B11: =B9*B10
  const totalLampsOpt1 = lampsPerRowOpt1 * selectedRows;

  // --- Option 2 (Alternative Coverage) ---
  // G8: =IF(LARGE(E12:E18,2)=0, LARGE(E12:E18,1), LARGE(E12:E18,2))
  const validCoverages = lampTable.map(r => r.validCoverage).sort((a, b) => b - a);
  const secondLargest = validCoverages.length >= 2 ? validCoverages[1] : 0;
  const firstLargest = validCoverages.length >= 1 ? validCoverages[0] : 0;
  const altMaxCoverage = secondLargest === 0 ? firstLargest : secondLargest;

  // G9: =MAX(IF((C=G8)*(D=1), A)) — longest lamp achieving alt coverage
  const longestLampOpt2 = validEntries.length > 0
    ? Math.max(...validEntries.filter(r => r.totalLampWidth === altMaxCoverage).map(r => r.length), 0)
    : 0;

  // G10: =INDEX(B12:B18, MATCH(G9, A12:A18, 0))
  const opt2Entry = lampTable.find(r => r.length === longestLampOpt2);
  const lampsPerRowOpt2 = opt2Entry ? opt2Entry.lampsPerRow : 0;

  // Sheet1 E8: =(Sheet2!G9)-2
  const lampLengthOpt2 = longestLampOpt2 > 0 ? longestLampOpt2 - 2 : 0;
  
  // Sheet1 E10: =Sheet2!C9 = selectedRows (same as opt1)
  // Sheet1 E11: =E9*E10
  const totalLampsOpt2 = lampsPerRowOpt2 * selectedRows;

  return {
    option1: {
      lampLength: lampLengthOpt1,
      lampsPerRow: lampsPerRowOpt1,
      numberOfRows: selectedRows,
      totalLamps: totalLampsOpt1
    },
    option2: {
      lampLength: lampLengthOpt2,
      lampsPerRow: lampsPerRowOpt2,
      numberOfRows: selectedRows,
      totalLamps: totalLampsOpt2
    },
    debug: { lampTable, maxValidCoverage, altMaxCoverage }
  };
}

// --- Fallback: serve index.html for any non-API route ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start Server ---
app.listen(PORT, () => {
  ensureDataDir();
  console.log(`\n  ╔══════════════════════════════════════════════╗`);
  console.log(`  ║  UVC Lamp Selection System                   ║`);
  console.log(`  ║  Server running at http://localhost:${PORT}      ║`);
  console.log(`  ╚══════════════════════════════════════════════╝\n`);
});
