// backend/server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const { initDB } = require('./src/db'); 
const routes = require('./src/routes'); // [NEW] Import the router

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize Database Tables
initDB();

// Health Check
app.get('/', (req, res) => res.send('🚀 Syncraft Backend Running'));

// [NEW] Use the Routes
app.use('/', routes);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});