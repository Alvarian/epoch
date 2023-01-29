# Introduction
This project is a Node.js application that automates Slack using the Bolt framework. The application allows users to personalize Slack by using commands in Slack chat to perform tasks such as bug tracking, scheduling, and content storage.

# Getting Started
To get started with this project, you will need to have Node.js and npm installed on your machine. You can install the dependencies by running the following command:
```
npm install
```

Once the dependencies are installed, you will need to create a Slack app and configure it to use the Bolt framework. You can find more information on setting up a Slack app in the Slack API documentation (https://api.slack.com/).

After setting up the Slack app, you will need to configure the application by setting the following environment variables:

    BOT_ACCESS_TOKEN= The Slack bot token
    SIGNING_SECRET= Slack signature
    PORT= Main application port
    REDIS_URL= Redis cloud url
    PSQL_DB= Postgres Database Name
    PSQL_USER= Postgres Main user
    PSQL_PASS= Postgres User Password
    PSQL_HOST= Postgres Host Url

Once the environment variables are set, you can start the application by running the following command:
```
npm run start
```

# Usage
The application can be used in Slack by sending commands in the chat. The following commands are supported:
- `/track help`: List all commands for bug tracking.
- `/track create sprint`: Start a new sprint to track a bug.
- `/track open sprint <SPRINT NAME>`: Open one sprint.
- `/track open sprints`: Open list of all sprints.

# References
- Node.js (https://nodejs.org/)
- npm (https://www.npmjs.com/)
- Slack API (https://api.slack.com/)
- Bolt framework (https://slack.dev/bolt/)


:octocat:

<!-- https://dvj70ijwahy8c.cloudfront.net/Epoch/icon | [{"description": "Using this bot application is through the use of commands, /help being the example.", "image": "https://dvj70ijwahy8c.cloudfront.net/Epoch/slides/image_7"}, {"description": "This is the main directory for a list of all features to use through commands. For the time being these features are for bug tracking.", "image": "https://dvj70ijwahy8c.cloudfront.net/Epoch/slides/image_6"}, {"description": "Upon selecting 'create sprint', a form is prompted to set the descriptions of the sprint and expected time of completion.", "image": "https://dvj70ijwahy8c.cloudfront.net/Epoch/slides/image_5"}, {"description": "On submission, you are redirected to the main sprint directory that depicts status details of all sprints plus the newest one created. For each one you are also able to open sprints that direct you to it's profile card depicting expanded status details, ticket management, and providing CRUD features.", "image": "https://dvj70ijwahy8c.cloudfront.net/Epoch/slides/image_4"}, {"description": "Upon creating tickets, a form is prompted to enter descriptive details and slack members you would want to have this ticket assigned to.", "image": "https://dvj70ijwahy8c.cloudfront.net/Epoch/slides/image_3"}, {"description": "When submitted, the assigned slack member is requested to be the worker of the ticket, and receives an invite that would require a date assignment from the worker before approving assignment.", "image": "https://dvj70ijwahy8c.cloudfront.net/Epoch/slides/image_2"}, {"description": "Here is the 'receipt' page that has all accepted and rejected or pending ticket requests.", "image": "https://dvj70ijwahy8c.cloudfront.net/Epoch/slides/image_1"}, {"description": "And a final over view of a set sprint with a ticket assigned to a worker.", "image": "https://dvj70ijwahy8c.cloudfront.net/Epoch/slides/image_0"}] -->


