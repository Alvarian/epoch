const cacheClient = require('../config/cache');
const { Sprint, Assigned, Workers, Tickets } = require('../models/Tracker');
const fetch = require('node-fetch');


function cacheIfFieldDoesNotExist(paramFromRequest, paramType, queryObj=null) {
	switch (paramType) {
		case 'ticketByID':
			queryObj = {
				include: [
					{
						model: Assigned,
						include: [Workers]
					},
					{
						model: Tickets,
						where: {
							id: paramFromRequest
						},
						include: [Workers]
					}
				]
			};
			break;

		case 'sprintByID':
			queryObj = {
				where: {
					id: paramFromRequest
				},
				include: [
					{
						model: Assigned,
						include: [Workers]
					},
					{
						model: Tickets,
						include: [Workers]
					}
				]
			};
			break;

		case 'sprintByTitle':
			queryObj = {
				where: {
					title: paramFromRequest
				},
				include: [
					{
						model: Assigned,
						include: [Workers]
					},
					{
						model: Tickets,
						include: [Workers]
					}
				]
			};
			break;
	}

	return new Promise((resolve, reject) => {
		cacheClient.get(paramFromRequest, async (err, cachedData) => {
			if (err) throw err;

			if (cachedData !== null) {	
				resolve(JSON.parse(cachedData));
			} else {
				try {
					const dbData = await Sprint.findAll(queryObj);

					// cache
					cacheClient.setex(paramType.concat(paramFromRequest), 60, JSON.stringify(dbData[0]));
					
					resolve(dbData[0]);
				} catch (err) {
					reject(err);
				}
			}
		});
	});
}

const getProjAdminToSayHello = async ({ say, ack }, param) => {
	try {
		await ack();

		const data = await cacheIfFieldDoesNotExist(param, 'sprintByTitle');

		await say(`Hi, I am <@${data.admin_sid}>.`);
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

const createSprintCard =  async ({ ack, body, view, context, client }) => {
    // FIELDS: title, description, admin_name, admin_email, admin_sid

	const { title, description, admin_name, admin_sid } = {
		title: view['state']['values']['project_name_block']['title_input']['value'],
		description: view['state']['values']['project_desc_block']['description_input']['value'],
		admin_name: body['user']['name'],
		admin_sid: body['user']['id']	
	};

	// Message the user
	try {
		// Message to send user
		let msg = '';
		
		// Save to DB
		const results = await Sprint.create({
			title,
			description,
			admin_name,
			admin_sid,
			status: false
		});

		if (results) {
			// DB save was successful
			msg = 'Your submission was successful';

			openSprintCard(ack, client, context.botToken, body.response_url, view.private_metadata, body.user.id, title);
		} else {
			msg = 'There was an error with your submission';
		}
		
		console.log(msg)
	}
	catch (error) {
		console.error(error.code, error);
	}
};

const makeSprintBlock = async (client, botToken, channelID, userID, sprintName) => {
	try {
		const data = await cacheIfFieldDoesNotExist(sprintName, 'sprintByTitle');

		const sprintPayload = { id, title, description, admin, createdAt, updatedAt, tickets } = {
			id: data.id,
			title: data.title.toUpperCase(),
			description: data.description,
			admin: data.admin_name,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
			workers_assigned: data.workers_assigneds,  //array
			tickets: data.tickets  // array
		};

		const blocksPayload = {
			// The token you used to initialize your app is stored in the `context` object
			token: botToken,
			// Payload message should be posted in the channel where original message was heard
			channel: channelID,
			user: userID,
			"blocks": [
				{
					"type": "header",
					"text": {
						"type": "plain_text",
						"text": `${title}`
					}
				},
				{
					"type": "context",
					"elements": [
						{
							"text": `${description}`,
							"type": "mrkdwn"
						}
					]
				},
				{
					"type": "context",
					"elements": [
						{
							"text": `Create on ${createdAt}`,
							"type": "mrkdwn"
						}
					]
				},
				{
					"type": "divider"
				},
				{
					"type": "section",
					"text": {
						"type": "mrkdwn",
						"text": " :checkered_flag: *TICKETS* :checkered_flag:"
					}
				}
			]
		};

		if (!tickets.length) {
			blocksPayload.blocks.push({
				"type": "context",
				"elements": [
					{
						"text": "No tickets have been created",
						"type": "mrkdwn"
					}
				]
			})
		} else {
			tickets.forEach(ticket => {
				const { title, createdAt, creator_sid, status } = ticket;

				blocksPayload.blocks.push({
					"type": "section",
					"text": {
						"type": "mrkdwn",
						"text": `*${title}* ${createdAt} <@${creator_sid}> ${status}`
					},
					"accessory": {
						"type": "button",
						"text": {
							"type": "plain_text",
							"text": "Review Ticket",
							"emoji": true
						},
						value: `${ticket.id}`,
						"action_id": "open_ticket"
					}
				});
			});
		}
		
		const finalBlock = {
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Create Ticket",
						"emoji": true
					},
					value: `${id}`,
					"style": "primary",
					"action_id": "open_ticket_model"
				},
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
		};
		blocksPayload.blocks.push(finalBlock);

		return blocksPayload;
	} catch (err) {
		console.log(err)
	}
};

const openSprintCard = async (ack, client, botToken, responseURL, channelID, userID, sprintName) => {
	try {
		await ack();

		const blocksPayload = await makeSprintBlock(client, botToken, channelID, userID, sprintName);

		await client.chat.postEphemeral(blocksPayload);
	} catch (err) {
		console.log(err);
	}
};



const openCreateTicketModel = async (ack, client, sprintPayload, triggerID) => {
	try {
		await ack();

		const result = await client.views.open({
			// Pass a valid trigger_id within 3 seconds of receiving it
			trigger_id: triggerID,
			// View payload
			view: {
				type: 'modal',
				// View identifier
				private_metadata: JSON.stringify(sprintPayload),
				callback_id: 'create_ticket_model',
				title: {
					type: 'plain_text',
					text: 'Start Ticket'
				},
				blocks: [
					{
						type: 'input',
						block_id: 'ticket_name_block',
						label: {
							type: 'plain_text',
							text: 'Ticket Name'
						},
						element: {
							type: 'plain_text_input',
							action_id: 'title_input',
							multiline: false,
						}
					},
					{
						type: 'input',
						block_id: 'ticket_desc_block',
						label: {
							type: 'plain_text',
							text: 'Description'
						},
						element: {
							type: 'plain_text_input',
							action_id: 'description_input',
							multiline: true
						}
					},
					{
						"type": "section",
						block_id: 'ticket_select_block',
						"text": {
							"type": "mrkdwn",
							"text": "Assign Developer"
						},
						"accessory": {
							action_id: 'select_input',
							"type": "users_select",
							initial_user: sprintPayload.selectedUser || sprintPayload.initialUser,
							"placeholder": {
								"type": "plain_text",
								"text": "Select a user",
								"emoji": true
							}
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

const createTicketConfirmation = async ({ ack, client, payload, body }) => {
	const { 
		title, 
		description,
		creator_name,
		creator_sid,
		status,
		sprint_id,
		channel_id,
		responseURL,
		initialUser,
		selectedUser,
		decision
	} = JSON.parse(payload.value);

	try {
		await ack();

		if (decision) {
			const findOrRegisterWorker = async () => {
				const worker = await client.users.info({
					token: client.token,
					user: selectedUser || initialUser
				});

				const isWorker = await Workers.findOne({
					where: { name: worker.user.name }
				});

				if (!isWorker) {
					const workerResults = await Workers.create({
						name: worker.user.name,
						role: worker.user.profile.title,
						sid: worker.user.id
					});

					return workerResults.id
				} else {
					return isWorker.id
				}
			};

			const ticketResults = await Tickets.create({
				title,
				description,
				creator_name,
				creator_sid,
				status,
				sprint_id,
				worker_id: await findOrRegisterWorker()
			});

			let msg = '';
			
			if (ticketResults) {
				// DB save was successful
				msg = 'Your submission was successful';

				replaceEphemeralBlock(body.response_url, {
					replace_original: true,
					text: `:heavy_check_mark: You accepted request for ticket *"${title.toUpperCase()}"* at ${new Date()}`				
				});

				client.chat.postMessage({
					token: client.token,
					channel: creator_sid,
					text: `:heavy_check_mark: <@${selectedUser || initialUser}> accepted request for ticket *"${title.toUpperCase()}"* at ${new Date()}`
				});
			} else {
				msg = 'There was an error with your submission';
			}
			
			console.log(msg)
		} else {
			replaceEphemeralBlock(body.response_url, {
				replace_original: true,
				text: `:x: You rejected request for ticket *"${title.toUpperCase()}"* at ${new Date()}`
			});
			
			client.chat.postMessage({
				token: client.token,
				channel: creator_sid,
				text: `:x: <@${selectedUser || initialUser}> rejected request for ticket *"${title.toUpperCase()}"* at ${new Date()}`				
			});
		}
	}
	catch (error) {
		console.error(error.code, error);
	}
};

const createTicketCard = async ({ ack, body, view, context, client }) => {
    const ticketParams = {
    	sprint_id, channel_id, responseURL, initialUser, selectedUser
    } = JSON.parse(view.private_metadata);

	const data = await cacheIfFieldDoesNotExist(sprint_id, 'sprintByID');

	const content = { title, description, creator_sid, sprint_name } = {
		title: view['state']['values']['ticket_name_block']['title_input']['value'],
		description: view['state']['values']['ticket_desc_block']['description_input']['value'],
		creator_name: body['user']['name'],
		creator_sid: body['user']['id'],
		status: false,
		sprint_name: data.title,
		sprint_id,
		channel_id,
		responseURL,
		initialUser,
		selectedUser
	};

	const ticketContentPayload = (decision) => {
		content.decision = decision;

		return content;
	};
	
	client.chat.postMessage({
		token: context.botToken,
		channel: selectedUser || initialUser,
		"blocks": [
			{
				"type": "header",
				"text": {
					"type": "plain_text",
					"text": "New Ticket Request"
				}
			},
			{
				"type": "context",
				"elements": [
					{
						"text": `*${title.toUpperCase()}*`,
						"type": "mrkdwn"
					}
				]
			},
			{
				"type": "context",
				"elements": [
					{
						"text": `${description}`,
						"type": "mrkdwn"
					}
				]
			},
			{
				"type": "section",
				"text": {
					"type": "mrkdwn",
					"text": "```Sprint Name: "+data.title.toUpperCase()+"\nSprint Admin: <@"+creator_sid+">```"
				}
			},
			{
				"type": "actions",
				"elements": [
					{
						"type": "button",
						"text": {
							"type": "plain_text",
							"emoji": true,
							"text": "Approve"
						},
						"style": "primary",
						"value": JSON.stringify(ticketContentPayload(true)),
						action_id: 'ticket_accepted'
					},
					{
						"type": "button",
						"text": {
							"type": "plain_text",
							"emoji": true,
							"text": "Deny"
						},
						"style": "danger",
						"value": JSON.stringify(ticketContentPayload(false)),
						action_id: 'ticket_declined'
					}
				]
			}
		]
	});

	ack();
};

const openTicketCard = async (ack, client, responseURL, ticketID, userID) => {
	try {
		await ack();

		const data = await cacheIfFieldDoesNotExist(ticketID, 'ticketByID');

		const ticketPayload = { id, title, description, creator_sid, createdAt, updatedAt, worker_sid, worker_role, status } = {
			id: data.tickets[0].id,
			title: data.tickets[0].title.toUpperCase(),
			description: data.tickets[0].description,
			creator_sid: data.tickets[0].creator_sid,
			createdAt: data.tickets[0].createdAt,
			updatedAt: data.tickets[0].updatedAt,
			worker_sid: data.tickets[0].worker.sid,
			worker_role: data.tickets[0].worker.role,
			status: (data.tickets[0].status) ? "Done" : "In progress"
		};

		const blocks = {
		    'response_type': 'ephemeral',
		    'replace_original': true,
		    "blocks": [
				{
					"type": "header",
					"text": {
						"type": "plain_text",
						"text": `${title}`
					}
				},
				{
					"type": "context",
					"elements": [
						{
							"text": `${description}`,
							"type": "mrkdwn"
						}
					]
				},
				{
					"type": "context",
					"elements": [
						{
							"text": `Posted on ${createdAt}`,
							"type": "mrkdwn"
						}
					]
				},
				{
					"type": "section",
					"fields": [
						{
							"type": "mrkdwn",
							"text": `*Posted by:*\n <@${creator_sid}>`
						},
						{
							"type": "mrkdwn",
							"text": `*Status:*\n${status}`
						},
						{
							"type": "mrkdwn",
							"text": `*Engineer:*\n <@${worker_sid}> - ${worker_role}`
						}
					]
				},
				{
					"type": "divider"
				},
				{
					"type": "actions",
					"elements": [
						{
							"type": "button",
							"text": {
								"type": "plain_text",
								"text": "Back to sprint",
								"emoji": true
							},
							value: `sprint_${data.title}`,
							"action_id": "redirect"
						},
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
		};

		replaceEphemeralBlock(responseURL, blocks);
	} catch (err) {
		console.log(err);
	}
};

const updateTicketModelOnSelectChange = async ({ ack, client, body: {view:{id, type, title, blocks, submit, private_metadata, callback_id}}, payload, context }) => {
	const { sprint_id, channel_id, responseURL } = JSON.parse(private_metadata);
	const sprintPayload = {
		sprint_id, 
		channel_id, 
		responseURL,
		initialUser: payload.initial_user,
		selectedUser: payload.selected_user
	};

	try {
		await ack();

		const results = await client.views.update({
			token: context.botToken,
			view: {
				type: 'modal',
				// View identifier
				private_metadata: JSON.stringify(sprintPayload),
				callback_id: 'create_ticket_model',
				title: {
					type: 'plain_text',
					text: 'Start Ticket'
				},
				blocks: [
					{
						type: 'input',
						block_id: 'ticket_name_block',
						label: {
							type: 'plain_text',
							text: 'Ticket Name'
						},
						element: {
							type: 'plain_text_input',
							action_id: 'title_input',
							multiline: false,
						}
					},
					{
						type: 'input',
						block_id: 'ticket_desc_block',
						label: {
							type: 'plain_text',
							text: 'Description'
						},
						element: {
							type: 'plain_text_input',
							action_id: 'description_input',
							multiline: true
						}
					},
					{
						"type": "section",
						block_id: 'ticket_select_block',
						"text": {
							"type": "mrkdwn",
							"text": "Assign Developer"
						},
						"accessory": {
							action_id: 'select_input',
							"type": "users_select",
							initial_user: sprintPayload.selectedUser || sprintPayload.initialUser,
							"placeholder": {
								"type": "plain_text",
								"text": "Select a user",
								"emoji": true
							}
						}
					}
				],
				submit: {
				    type: 'plain_text',
				    text: 'Submit'
				}
			},
			view_id: id
		});
	} catch (err) {console.log(err)}
};



const replaceEphemeralBlock = async (responseURL, blocks) => {
	try {
		const response = await fetch(responseURL, {
		    method: 'post',
		    body:    JSON.stringify(blocks),
		    headers: { 'Content-Type': 'application/json' },
		});

		const result = await response.json();
		console.log(result);
	} catch (err) {
		console.log(err);
	}
};

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
	const { ack, body, context, client } = module;

	try {
		await ack();

		const payload = {
		    'delete_original': true
		};

		const response = await fetch(body.response_url, {
		    method: 'post',
		    body:    JSON.stringify(payload),
		    headers: { 'Content-Type': 'application/json' },
		});

		const result = response.json();
		console.log(result);
	} catch (err) {
		console.log(err);
	}
};


module.exports = { 
	getProjAdminToSayHello, 
	
	openCreateSprintModel,
	createSprintCard,
	makeSprintBlock,
	openSprintCard,

	openCreateTicketModel,
	createTicketConfirmation,
	createTicketCard,
	openTicketCard,
	updateTicketModelOnSelectChange,

	replaceEphemeralBlock,
	removeEphemeralBlock,
	removeMessageBlock
};