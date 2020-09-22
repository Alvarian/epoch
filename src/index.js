const { App } = require('@slack/bolt');

require('dotenv').config();
const { BOT_ACCESS_TOKEN, OAUTH_ACCESS_TOKEN, CHANNEL, SIGNING_SECRET } = process.env;


// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.BOT_ACCESS_TOKEN,
  signingSecret: process.env.SIGNING_SECRET
});

// Bug Tracker
const { trackCommandRoutes, trackerActionRoutes } = require('./routes/trackerRoute');
app.command('/track', trackCommandRoutes);
// Action
trackerActionRoutes(app);

// Scheduler
const schedulerRoute = require('./routes/schedulerRoute');
app.command('/schedule', schedulerRoute);

// Message Archiver
const archiverRoute = require('./routes/archiverRoute');
app.command('/search', archiverRoute);



(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  console.log('⚡️ Bolt app is running!');
})();