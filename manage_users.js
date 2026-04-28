#!/usr/bin/env node
/**
 * User Management Script
 * 
 * Usage:
 *   node manage_users.js add <email> <password> [name]
 *   node manage_users.js remove <email>
 *   node manage_users.js list
 */

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

function ensureDataDir() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '[]', 'utf8');
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

const [,, command, ...args] = process.argv;

switch (command) {
  case 'add': {
    const [email, password, name] = args;
    if (!email || !password) {
      console.error('Usage: node manage_users.js add <email> <password> [name]');
      process.exit(1);
    }
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      console.error(`Error: User "${email}" already exists.`);
      process.exit(1);
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    users.push({
      email: email.toLowerCase(),
      passwordHash,
      name: name || email.split('@')[0],
      createdAt: new Date().toISOString()
    });
    saveUsers(users);
    console.log(`✓ User "${email}" added successfully.`);
    break;
  }
  case 'remove': {
    const [emailToRemove] = args;
    if (!emailToRemove) {
      console.error('Usage: node manage_users.js remove <email>');
      process.exit(1);
    }
    let users = getUsers();
    const before = users.length;
    users = users.filter(u => u.email.toLowerCase() !== emailToRemove.toLowerCase());
    if (users.length === before) {
      console.error(`Error: User "${emailToRemove}" not found.`);
      process.exit(1);
    }
    saveUsers(users);
    console.log(`✓ User "${emailToRemove}" removed successfully.`);
    break;
  }
  case 'list': {
    const users = getUsers();
    if (users.length === 0) {
      console.log('No registered users.');
    } else {
      console.log(`\nRegistered Users (${users.length}):`);
      console.log('─'.repeat(50));
      users.forEach(u => {
        console.log(`  ${u.name || '—'}  <${u.email}>  (added ${u.createdAt || 'unknown'})`);
      });
      console.log('');
    }
    break;
  }
  default:
    console.log(`
User Management Script
═══════════════════════

Commands:
  node manage_users.js add <email> <password> [name]   Add a new user
  node manage_users.js remove <email>                   Remove a user
  node manage_users.js list                             List all users
`);
}
