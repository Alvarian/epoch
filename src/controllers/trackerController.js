const cacheClient = require('../config/cache');
const Projects = require('../models/Projects');
const fetch = require('node-fetch');
const axios = require('axios');


function cacheIfFieldDoesNotExist(paramFromRequest) {
	return new Promise((resolve, reject) => {
		cacheClient.get(paramFromRequest, async (err, data) => {
			if (err) throw err;

			if (data !== null) {				
				resolve(data);
			} else {
				const { admin_name } = await Projects.findOne({ where: { title: paramFromRequest } });
				
				// cache
				cacheClient.setex(paramFromRequest, 60, `${admin_name} <- CACHED`);
				
				resolve(admin_name);
			}
		});
	});
}

const getProjAdminToSayHello = async ({ say, ack }, param) => {
	try {
		await ack();

		const adminName = await cacheIfFieldDoesNotExist(param);

		await say(`Hi, I am ${adminName}.`);
	} catch (err) {
		console.log(err);
	}
};

const openCreateSprintModel =  async ({ ack, body, client, payload }, sprintName) => {
  // Acknowledge the command request

  try {
	await ack();
    
    // Call views.open with the built-in client
    // FIELDS: title, description, admin_name, admin_email, admin_sid
    const result = await client.views.open({
		// Pass a valid trigger_id within 3 seconds of receiving it
		trigger_id: body.trigger_id,
		// View payload
		view: {
			type: 'modal',
			// View identifier
			private_metadata: payload.channel_id,
			callback_id: 'create_sprint_model',
			title: {
				type: 'plain_text',
				text: 'Start Sprint'
			},
			blocks: [
				{
					type: 'input',
					block_id: 'project_name_block',
					label: {
						type: 'plain_text',
						text: 'Project Name'
					},
					element: {
						type: 'plain_text_input',
						action_id: 'title_input',
						multiline: false,
						initial_value: sprintName
					}
				},
				{
					type: 'input',
					block_id: 'project_desc_block',
					label: {
						type: 'plain_text',
						text: 'Description'
					},
					element: {
						type: 'plain_text_input',
						action_id: 'description_input',
						multiline: true
					}
				}
			],
			submit: {
			    type: 'plain_text',
			    text: 'Submit'
			}
		}
    });
    console.log(result.ok);
  }
  catch (error) {
    console.error(error);
  }
};

const createProjectSprint =  async (module) => {
	const { ack, body, view, context, client } = module;
    // FIELDS: title, description, admin_name, admin_email, admin_sid
	const title = view['state']['values']['project_name_block']['title_input']['value'];
	const description = view['state']['values']['project_desc_block']['description_input']['value'];
	const admin_name = body['user']['name'];
	const admin_sid = body['user']['id'];

	// Message the user
	try {
		// Acknowledge the view_submission event
		await ack();
		
		// // Message to send user
		// let msg = '';
		
		// // Save to DB
		// const results = await Projects.create({
		// 	title,
		// 	description,
		// 	admin_name,
		// 	admin_sid
		// });

		// if (results) {
		// 	// DB save was successful
		// 	msg = 'Your submission was successful';

			const result = await client.chat.postEphemeral({
				// The token you used to initialize your app is stored in the `context` object
				token: context.botToken,
				// Payload message should be posted in the channel where original message was heard
				channel: view.private_metadata,
				user: body.user.id,
				private_metadata: body.response_url,
				"blocks": [
					{
						"type": "section",
						"text": {
							"type": "mrkdwn",
							"text": "Danny Torrence left the following review for your property:"
						}
					},
					{
						"type": "section",
						"block_id": "section567",
						"text": {
							"type": "mrkdwn",
							"text": "<https://google.com|Overlook Hotel> \n :star: \n Doors had too many axe holes, guest in room 237 was far too rowdy, whole place felt stuck in the 1920s."
						},
						"accessory": {
							"type": "image",
							"image_url": "https://is5-ssl.mzstatic.com/image/thumb/Purple3/v4/d3/72/5c/d3725c8f-c642-5d69-1904-aa36e4297885/source/256x256bb.jpg",
							"alt_text": "Haunted hotel image"
						}
					},
					{
						"type": "section",
						"block_id": "section789",
						"fields": [
							{
							"type": "mrkdwn",
							"text": "*Average Rating*\n1.0"
							}
						]
					},
					{
						"type": "actions",
						"elements": [
							{
								"type": "button",
								"text": {
									"type": "plain_text",
									"text": "Close",
									"emoji": true
								},
								"style": "danger",
								"action_id": "close_ephemeral"
							}
						]
					}
				]
			});

			console.log(result.ok);
		// 	// Open sprint card with fields of: title, description, admin, workersInvolved, status, createdAt, updatedAt, buttons(edit, delete, addNewTicket) 

		// } else {
		// 	msg = 'There was an error with your submission';
		// }
		
		// console.log(msg)
	}
	catch (error) {
		console.error(error.code, error);
	}

}

const removeMessageBlock = async (module) => {
	const { ack, body, context, client } = module;
	console.log(module)

	try {
		await ack();

		const result = await client.chat.delete({
			// The token you used to initialize the app, stored in context
			"token": context.botToken,
			"channel": body.container.channel_id,
			"ts": body.container.message_ts
		});

		// Print result
		console.log(result);
	} catch (err) {
		console.log(err.data);
	}
};

const removeEphemeralBlock = async (module) => {
	const { ack, body, context, client, axios, respond } = module;

	try {
		await ack();

		const payload = {
		    'response_type': 'ephemeral',
		    'text': '',
		    'replace_original': true,
		    'delete_original': true
		};

		const response = await fetch(body.response_url, {
		    method: 'post',
		    body:    JSON.stringify(payload),
		    headers: { 'Content-Type': 'application/json' },
		});
		
		const result = reponse.json();
		console.log(result);
	} catch (err) {
		console.log(err);
	}
};


module.exports = { 
	getProjAdminToSayHello, 
	createProjectSprint, 
	openCreateSprintModel, 
	removeEphemeralBlock,
	removeMessageBlock
};