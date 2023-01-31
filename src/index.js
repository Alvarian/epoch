const { App } = require('@slack/bolt');

require('dotenv').config();
const { BOT_ACCESS_TOKEN, SIGNING_SECRET, PORT } = process.env;


// Initializes your app with your bot token and signing secret
const app = new App({
  token: BOT_ACCESS_TOKEN,
  signingSecret: SIGNING_SECRET
});

// Bug Tracker
const { trackCommandRoutes, trackerActionRoutes } = require('./routes/trackerRoute');
app.command('/track', trackCommandRoutes);
// Action
trackerActionRoutes(app);

// Scheduler
const schedulerRoute = require('./routes/schedulerRoute');
app.command('/meet', schedulerRoute);

// Message Archiver
const archiverRoute = require('./routes/archiverRoute');
app.command('/share', archiverRoute);



(async () => {
  // Start your app
  const _PORT = PORT || 3000;
  await app.start(_PORT);

  console.log(`⚡️ Bolt app is running on port ${_PORT}!`);
})();