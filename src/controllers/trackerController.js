const cacheClient = require('../config/cache');
const { Sprint, Assigned, Workers, Tickets } = require('../models/Tracker');
const fetch = require('node-fetch');



function cacheIfFieldDoesNotExist(paramFromRequest, paramType, queryObj={}) {
	switch (paramType) {
		case 'allSprints':

			break;

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
					cacheClient.setex(paramType.concat(paramFromRequest), 60, JSON.stringify(dbData));
					
					resolve(dbData);
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



const makeSprintListBlock = async (botToken, channelID, userID) => {
	try {
		const sprints = await cacheIfFieldDoesNotExist('noParams', 'allSprints');

		const blocksPayload = {
			token: botToken,
			channel: channelID,
			user: userID,
			"blocks": [
				{
					"type": "header",
					"text": {
						"type": "plain_text",
						"text": ":pushpin: SPRINT LIST :pushpin:"
					}
				},
				{
					"type": "divider"
				}
			]
		};

		if (!sprints.length) {
			blocksPayload.blocks.push({
				"type": "context",
				"elements": [
					{
						"text": "No sprints have been created",
						"type": "mrkdwn"
					}
				]
			})
		} else {
			sprints.forEach(sprint => {
				const {id, title, admin_sid, createdAt, status} = sprint;

				blocksPayload.blocks.push({
					"type": "section",
					"text": {
						"type": "mrkdwn",
						"text": `*${title}* ${createdAt} <@${admin_sid}> ${status}`
					},
					"accessory": {
						"type": "button",
						"text": {
							"type": "plain_text",
							"text": "Open Sprint",
							"emoji": true
						},
						value: `${title}`,
						"action_id": "open_sprint"
					}
				});
			});
		}

		const lastBlock = {
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Create Sprint",
						"emoji": true
					},
					"style": "primary",
					"action_id": "open_sprint_model"
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
		blocksPayload.blocks.push(lastBlock);

		return blocksPayload;
	} catch (err) {
		console.log(err);
	}
};

const openSprintList = async (ack, client, botToken, response_url, channel_id, user_id) => {
	try {
		await ack();
	
		const blocksPayload = await makeSprintListBlock(botToken, channel_id, user_id);

		await client.chat.postEphemeral(blocksPayload);
	} catch (err) {
		console.log(err);
	}
};



const openCreateSprintModel =  async ({ ack, body, client, payload }, sprintName) => {
	try {
		await ack();

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
							initial_value: sprintName || ''
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
	} catch (error) {
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

const makeSprintBlock = async (botToken, channelID, userID, sprintName) => {
	try {
		const data = await cacheIfFieldDoesNotExist(sprintName, 'sprintByTitle');

		const sprintPayload = { id, title, description, admin, createdAt, updatedAt, tickets } = {
			id: data[0].id,
			title: data[0].title.toUpperCase(),
			description: data[0].description,
			admin: data[0].admin_name,
			createdAt: data[0].createdAt,
			updatedAt: data[0].updatedAt,
			workers_assigned: data[0].workers_assigneds,  //array
			tickets: data[0].tickets  // array
		};

		const blocksPayload = {
			token: botToken,
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
		
		const redirectPayload = {
			blockSrc: 'sprintList',
			blockID: null,
			ticketID: null
		};

		const finalBlock = {
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Sprint List",
						"emoji": true
					},
					value: JSON.stringify(redirectPayload),
					"action_id": "redirect_from_back"
				},
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

		const blocksPayload = await makeSprintBlock(botToken, channelID, userID, sprintName);

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
							initial_user: sprintPayload.su || sprintPayload.iu,
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
	const guuh = { 
		title, 
		description,
		creator_name,
		creator_sid,
		status,
		deadline,
		si,
		ci,
		ru,
		iu,
		su,
		selectedDate,
		decision
	} = JSON.parse(payload.value);

	try {
		await ack();

		if (decision) {
			const findOrRegisterWorker = async () => {
				const worker = await client.users.info({
					token: client.token,
					user: su || iu
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
				deadline,
				sprint_id: si,
				worker_id: await findOrRegisterWorker()
			});

			let msg = '';
			
			if (ticketResults) {
				// DB save was successful
				msg = 'Your submission was successful';

				replaceEphemeralBlock(body.response_url, {
					replace_original: true,
					text: `:heavy_check_mark: You accepted request for ticket *"${title.toUpperCase()}"*, DUE: ${deadline}`				
				});

				client.chat.postMessage({
					token: client.token,
					channel: creator_sid,
					text: `:heavy_check_mark: <@${su || iu}> accepted request for ticket *"${title.toUpperCase()}"*, DUE:${deadline}`
				});
			} else {
				msg = 'There was an error with your submission';
			}
			
			console.log(msg)
		} else {
			replaceEphemeralBlock(body.response_url, {
				replace_original: true,
				text: `:x: You rejected request for ticket *"${title.toUpperCase()}"*, DUE: ${deadline}`
			});

			client.chat.postMessage({
				token: client.token,
				channel: creator_sid,
				text: `:x: <@${su || iu}> rejected request for ticket *"${title.toUpperCase()}"*, DUE: ${deadline}`				
			});
		}
	}
	catch (error) {
		console.error(error.code, error);
	}
};

const createTicketCard = async (ack, body, view, context, client, selectedDate) => {
	try {
		await ack();

	    const ticketParams = {
	    	si, ci, ru, iu, su, cs
	    } = view.pm;

		const data = await cacheIfFieldDoesNotExist(si, 'sprintByID');

		const content = { title, description, creator_sid, sprint_name, si, ci, ru, iu, su } = {
			title: view.title,
			description: view.description,
			creator_sid: body.user.id,
			status: false,
			deadline: selectedDate,
			sprint_name: data[0].title,
			si,
			ci,
			ru,
			iu,
			su,
			selectedDate
		};

		const ticketContentPayload = (decision) => {
			content.decision = decision;

			return content;
		};
		
		const today = new Date();
		const {yyyy, mm, dd} = {	
			dd: String(today.getDate()).padStart(2, '0'),
			mm: String(today.getMonth() + 1).padStart(2, '0'), //January is 0!
			yyyy: today.getFullYear()
		};

		const blocksPayload = {
			token: context.botToken,
			channel: su || iu,
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
						"text": "```Sprint Name: "+data[0].title.toUpperCase()+"\nSprint Admin: <@"+creator_sid+">```"
					}
				},
				{
					type: "section",
					block_id: JSON.stringify({
						title,
						description,
						pm: {si, ci, ru, iu, su, cs}
					}),
					"text": {
						"type": "mrkdwn",
						"text": "Pick a date for the deadline."
					},
					accessory: {
						"type": "datepicker",
						"initial_date": selectedDate || `${yyyy}-${mm}-${dd}`,
						action_id: "redirect_date_change",
						"placeholder": {
							"type": "plain_text",
							"text": "Select a date",
							"emoji": true
						}
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
		}

		if (!selectedDate) {	
			client.chat.postMessage(blocksPayload);
		} else {
			replaceEphemeralBlock(body.response_url, blocksPayload);
		}
	} catch (err) {
		console.log(err);
	}
};

const makeTicketBlock = async (ticketID, userID) => {
	try {
		const data = await cacheIfFieldDoesNotExist(ticketID, 'ticketByID');

		const ticketPayload = { 
			id, title, description, creator_sid, createdAt, updatedAt, worker_sid, worker_role, status 
		} = {
			id: data[0].tickets[0].id,
			title: data[0].tickets[0].title.toUpperCase(),
			description: data[0].tickets[0].description,
			creator_sid: data[0].tickets[0].creator_sid,
			createdAt: data[0].tickets[0].createdAt,
			updatedAt: data[0].tickets[0].updatedAt,
			worker_sid: data[0].tickets[0].worker.sid,
			worker_role: data[0].tickets[0].worker.role,
			status: data[0].tickets[0].status
		};

		const redirectPayload = {
			blockSrc: 'sprint',
			blockID: data[0].title,
			ticketID
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
							"text": `*Status:*\n${(status) ? "Done" : "In progress"}`
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
							value: JSON.stringify(redirectPayload),
							"action_id": "redirect_from_back"
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

		if (userID === worker_sid) {
			redirectPayload.selectedStatus = !status;
			redirectPayload.blockSrc = (redirectPayload.selectedStatus) ? 'sprint' : 'ticket';

			blocks.blocks[blocks.blocks.length-1].elements.push({
				"type": "button",
				"text": {
					"type": "plain_text",
					"text": "Change Status",
					"emoji": true
				},
				value: JSON.stringify(redirectPayload),
				"style": "primary",
				"action_id": "redirect_from_status"
			});
		}

		if (userID === creator_sid) {
			blocks.blocks[blocks.blocks.length-1].elements.push({
				"type": "button",
				"text": {
					"type": "plain_text",
					"text": "DELETE",
					"emoji": true
				},
				value: JSON.stringify(redirectPayload),
				"style": "danger",
				confirm: {
					"title": {
						"type": "plain_text",
						"text": "Confirm delete"
					},
					text: {
						type: "plain_text",
						text: `Are you sure you want to delete ticket ${title.toUpperCase()}?`
					},
					"confirm": {
						"type": "plain_text",
						"text": "Delete"
					},
					style: "danger",
					"deny": {
						"type": "plain_text",
						"text": "Cancel"
					}
				},
				"action_id": "redirect_from_delete"
			},
			{
				"type": "button",
				"text": {
					"type": "plain_text",
					"text": "EDIT",
					"emoji": true
				},
				value: JSON.stringify(redirectPayload),
				confirm: {
					"title": {
						"type": "plain_text",
						"text": "Are you sure?"
					},
					"text": {
						"type": "mrkdwn",
						"text": "Wouldn't you prefer a good game of _chess_?"
					},
					"confirm": {
						"type": "plain_text",
						"text": "Do it"
					},
					"deny": {
						"type": "plain_text",
						"text": "Stop, I've changed my mind!"
					}
				},
				"action_id": "redirect_from_edit"
			});
		}

		return blocks;
	} catch (err) {
		console.log(err);
	}
};

const openTicketCard = async (ack, client, responseURL, ticketID, userID) => {
	try {
		await ack();

		const blocks = await makeTicketBlock(ticketID, userID);

		replaceEphemeralBlock(responseURL, blocks);
	} catch (err) {
		console.log(err);
	}
};

const changeTicketStatus = async (selectedStatus, ticketID) => {
	try {
		const ticket = await Tickets.findOne({ where: { id: ticketID } });

		ticket.status = selectedStatus;

		await ticket.save();
	} catch (err) {
		console.log(err)
	}
};

const updateTicketModelOnSelectChange = async ({ ack, client, body: {view: {id, private_metadata}}, payload, context }) => {
	const { si, ci, ru, cs } = JSON.parse(private_metadata);
	const sprintPayload = {
		si, 
		ci, 
		ru,
		iu: payload.initial_user,
		su: payload.selected_user,
		cs
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
							initial_user: sprintPayload.su || sprintPayload.iu,
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

const deleteTicket = async (id) => {
	const ticket = await Tickets.findOne({ where: { id } });

	await ticket.destroy();
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
	
	openSprintList,
	openCreateSprintModel,
	createSprintCard,
	makeSprintBlock,
	makeSprintListBlock,
	openSprintCard,

	openCreateTicketModel,
	createTicketConfirmation,
	createTicketCard,
	makeTicketBlock,
	openTicketCard,
	changeTicketStatus,
	updateTicketModelOnSelectChange,
	deleteTicket,

	replaceEphemeralBlock,
	removeEphemeralBlock,
	removeMessageBlock
};