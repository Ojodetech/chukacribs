const express = require('express');
const app = express();

app.get('/test', (req, res) => {
  res.json({ message: 'Server works!' });
});

const PORT = 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
