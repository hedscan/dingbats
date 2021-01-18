require('dotenv').config();
const express = require('express');
const exphbs = require('express-handlebars');
const helmet = require('helmet');
const path = require('path');
const https = require('https');
const fs = require('fs');
const db = require('./dataLayer/db');
const cache = require('./dataLayer/redis');
const { player, quizmaster, auth  } = require('./routes');
const socketeer = require('./socketeer/socketeer');
const messageHandler = require('./gameController/messageHandler');

const app = express();
const port = process.env.PORT || 443;
const httpPort = process.env.HTTPPORT || 80;
app.use(express.static(path.join(__dirname, 'static'))); // Set static assets folder
app.use(express.json()); // Use JSON HTTP body parser
// redirect http to https
app.use((req, res, next) => {
  if (!req.secure) {
    return res.redirect(`https://${req.get('Host')}${req.baseUrl}`);
  }
  next();
});
app.set('views', 'src/views'); // Set view folder
app.engine('hbs', exphbs({ extname: 'hbs' })); // Set up Handlebars view engine
app.set('view engine', 'hbs');
// Use Helmet (for setting HTTP headers)
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      // allow MDL scripts to run
      'script-src': ["'self'", 'https://code.getmdl.io/1.3.0/material.min.js'],
    },
  }),
);

db.start();
cache.start();

app.get('/', (req, res) => {
  res.render('index');
});
app.post('/auth', auth.route);
app.get('/play', auth.verifyToken, player);
app.get('/ctrl', auth.verifyToken, quizmaster);

// Set server to listen
server = https.createServer(
  {
    key: fs.readFileSync(process.env.SERVER_KEY),
    cert: fs.readFileSync(process.env.SERVER_CERT),
  },
  app,
);

server.listen(port, () => console.log(`App listening to port ${port}`));
socketeer.start(server, messageHandler);

// HTTP server
app.listen(httpPort, () => console.log(`HTTP listening to port ${httpPort}`));

const gracefulShutdown = () => {
  Promise.all([db.teardown(), cache.teardown()])
    .catch(() => {})
    .then(() => process.exit());
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // Sent by nodemon
