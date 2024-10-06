const express = require('express');
const app = express();

app.use('/test', (req, res) => {
  res.send('I am present');
});

app.listen('7777', () => {
  console.log('I am running');
});
