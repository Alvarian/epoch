const cacheClient = require('../config/cache');
const { Sprint, Assigned, Workers, Tickets } = require('../models/Tracker');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const { inHours, inDays, convertFullDate, todayFullDate } = require('../assets/formatDate');



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

function cachePayloadBetweenActions(key, payload) {
	return new Promise((resolve, reject) => {
		cacheClient.get(key, async (err, cachedData) => {
			if (err) throw err;

			if (cachedData !== null) {	
				resolve(JSON.parse(cachedData));
			} else {
				try {
					// cache
					cacheClient.setex(key, 60, JSON.stringify(payload));
					
					resolve(payload);
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
				const fullDatePayload = convertFullDate(new Date(createdAt));

				blocksPayload.blocks.push({
					"type": "section",
					"text": {
						"type": "mrkdwn",
						"text": `${(status) ? ':heavy_check_mark:' : ':x:'} *${title}* | Admin: <@${admin_sid}> | Posted on ${fullDatePayload.mm}/${fullDatePayload.dd}/${fullDatePayload.yyyy}`
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



const openCreateSprintModel =  async (ack, channelID, responseURL, triggerID, client, sprintName, isFromList) => {
	try {
		await ack();

		const result = await client.views.open({
			trigger_id: triggerID,
			view: {
				type: 'modal',
				private_metadata: JSON.stringify({
					channelID, 
					responseURL,
					isFromList
				}),
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
    const { title, description, admin_name, admin_sid } = {
		title: view['state']['values']['project_name_block']['title_input']['value'],
		description: view['state']['values']['project_desc_block']['description_input']['value'],
		admin_name: body['user']['name'],
		admin_sid: body['user']['id']	
	};
	const { channelID, responseURL, isFromList } = JSON.parse(view.private_metadata);

	try {
		let msg = '';
		
		const results = await Sprint.create({
			title,
			description,
			admin_name,
			admin_sid,
			status: false
		});

		if (results) {
			msg = 'Your submission was successful';

			openSprintCard(ack, client, context.botToken, channelID, body.user.id, title, responseURL, isFromList);
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
			admin: data[0].admin_sid,
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
							"text": `Create on ${createdAt} by <@${admin}>`,
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
				const { title, deadline, createdAt, updatedAt, creator_sid, status } = ticket;
				
				const updatedFormatPayload = {
					flatDaysLeft: inDays(new Date(updatedAt)),
					exactDaysLeft: inHours(new Date(updatedAt))/24,
				};
				const updatedRemainder = Math.floor((updatedFormatPayload.exactDaysLeft - updatedFormatPayload.flatDaysLeft)*24);

				const deadlineFormatPayload = {
					flatDaysLeft: inDays(new Date(deadline)),
					exactDaysLeft: inHours(new Date(deadline))/24,
				};
				const deadlineRemainder = Math.floor((deadlineFormatPayload.exactDaysLeft - deadlineFormatPayload.flatDaysLeft)*24);
				
				const ticketListStats = () => {
					const icon = `${(deadlineRemainder < 0 && !status) ? ':warning:' : (status) ? ':star2:' : ':clock7:'} `;
					const middleText = `*${title}* | <@${creator_sid}> | `;
					const dueFormat = `${(deadlineRemainder < 0 && !status) ? 
							`PAST DUE ${Math.floor(Math.abs(deadlineFormatPayload.flatDaysLeft))} day(s) ago` 
						 : 
							(status) ? 
								`Finished ${Math.floor(Math.abs(updatedFormatPayload.flatDaysLeft))} day(s) ago` 
							 : 
								`Due in ${deadlineFormatPayload.flatDaysLeft} d ${deadlineRemainder} hr`
						}
					`;
					const fullText = icon + middleText + dueFormat;

					return fullText;
				};
				
				blocksPayload.blocks.push({
					"type": "section",
					"text": {
						"type": "mrkdwn",
						"text": ticketListStats()
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
		if (admin == userID) {
			redirectPayload.blockID = id;
			finalBlock.elements.push({
				"type": "button",
				"text": {
					"type": "plain_text",
					"text": "DELETE",
					"emoji": true
				},
				"style": "danger",
				confirm: {
					"title": {
						"type": "plain_text",
						"text": "Confirm delete"
					},
					text: {
						type: "plain_text",
						text: `Are you sure you want to delete sprint ${title.toUpperCase()}?`
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
				value: JSON.stringify(redirectPayload),
				"action_id": "redirect_from_delete"
			});
		}
		blocksPayload.blocks.push(finalBlock);

		return blocksPayload;
	} catch (err) {
		console.log(err)
	}
};

const openSprintCard = async (ack, client, botToken, channelID, userID, sprintName, responseURL, requestFromList) => {
	try {
		await ack();

		const blocksPayload = await makeSprintBlock(botToken, channelID, userID, sprintName);

		if (!requestFromList) {
			await client.chat.postEphemeral(blocksPayload);
		} else {
			await replaceEphemeralBlock(responseURL, blocksPayload);
		}
	} catch (err) {
		console.log(err);
	}
};

const deleteSprint = async (id) => {
	const sprint = await Sprint.findOne({ where: { id } });

	await sprint.destroy();
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
	const { 
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
				msg = 'Your submission was successful';

				replaceEphemeralBlock(body.response_url, {
					replace_original: true,
					text: `:heavy_check_mark: You accepted request for ticket *"${title.toUpperCase()}"*, due on ${deadline}`				
				});

				client.chat.postMessage({
					token: client.token,
					channel: creator_sid,
					text: `:heavy_check_mark: <@${su || iu}> accepted request for ticket *"${title.toUpperCase()}"*, due on ${deadline}`
				});
			} else {
				msg = 'There was an error with your submission';
			}
			
			console.log(msg)
		} else {
			replaceEphemeralBlock(body.response_url, {
				replace_original: true,
				text: `:x: You rejected request for ticket *"${title.toUpperCase()}"*, due on ${deadline}`
			});

			client.chat.postMessage({
				token: client.token,
				channel: creator_sid,
				text: `:x: <@${su || iu}> rejected request for ticket *"${title.toUpperCase()}"*, due on ${deadline}`				
			});
		}
	}
	catch (error) {
		console.error(error.code, error);
	}
};

const openNewDateModel = async (ack, triggerID, client, ticketConfirmationPayload, selectedDate) => {
	try {
		await ack();

		const { yyyy, mm, dd } = todayFullDate;

		const result = await client.views.open({
			trigger_id: triggerID,
			view: {
				type: 'modal',
				private_metadata: JSON.stringify(ticketConfirmationPayload),
				callback_id: 'change_date_model',
				title: {
					type: 'plain_text',
					text: 'Select new deadline'
				},
				blocks: [
					{
						type: "section",
						block_id: "blah",
						"text": {
							"type": "mrkdwn",
							"text": "Pick a new date for the deadline."
						},
						accessory: {
							"type": "datepicker",
							"initial_date": selectedDate || `${yyyy}-${mm}-${dd}`,
							action_id: "redirect_newdate_change",
							"placeholder": {
								"type": "plain_text",
								"text": "Select a date",
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
	} catch (err) {
		console.log(err)
	}
};

const updateNewDateModelOnSelectChange = async (ack, client, botToken, id, ticketConfirmationPayload, selectedDate) => {
	try {
		await ack();

		const openedPayload = JSON.parse(ticketConfirmationPayload)
		openedPayload.newDeadline = selectedDate+" 8:00";

		ticketConfirmationPayload = openedPayload;

		const result = await client.views.update({
			token: botToken,
			view: {
				type: 'modal',
				private_metadata: JSON.stringify(ticketConfirmationPayload),
				callback_id: 'change_date_model',
				title: {
					type: 'plain_text',
					text: 'Select new deadline'
				},
				blocks: [
					{
						type: "section",
						block_id: "blah",
						"text": {
							"type": "mrkdwn",
							"text": "Pick a new date for the deadline."
						},
						accessory: {
							"type": "datepicker",
							"initial_date": selectedDate || `${yyyy}-${mm}-${dd}`,
							action_id: "redirect_newdate_change",
							"placeholder": {
								"type": "plain_text",
								"text": "Select a date",
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

		console.log(result.ok);
	} catch (err) {
		console.log(err)
	}
};

const createTicketCard = async (ack, body, view, context, client, selectedDate, key) => {
	try {
		await ack();

		if (!view) {
			const results = await cachePayloadBetweenActions(body.key, null);

			view = results;
		} 

	    const ticketParams = {
	    	si, ci, ru, iu, su, cs
	    } = view.pm;

		const data = await cacheIfFieldDoesNotExist(si, 'sprintByID');

		const content = { title, description, creator_sid, sprint_name, deadline, si, ci, ru, iu, su } = {
			title: view.title,
			description: view.description,
			creator_sid: body.user.id,
			status: false,
			deadline: selectedDate || `${yyyy}-${mm}-${dd} 8:00`,
			sprint_name: data[0].title,
			si,
			ci,
			ru,
			iu,
			su,
			selectedDate
		};

		key = uuidv4();	
		cachePayloadBetweenActions(key, {
			title,
			description,
			pm: {si, ci, ru, iu, su, cs}
		});

		const ticketContentPayload = (decision) => {
			content.decision = decision;

			return content;
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
					block_id: JSON.stringify({userID: body.user.id, key, response_url: body.response_url}),
					"text": {
						"type": "mrkdwn",
						"text": "Pick a date for the deadline."
					},
					accessory: {
						"type": "datepicker",
						"initial_date": deadline,
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
			ticketID,
			initialStatus: status
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

const changeTicketStatus = async (selectedStatus, ticketID, newDeadline=null) => {
	try {
		const ticket = await Tickets.findOne({ where: { id: ticketID } });

		ticket.status = selectedStatus;

		if (newDeadline) {
			ticket.deadline = newDeadline;
		}

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
	deleteSprint,

	openCreateTicketModel,
	createTicketConfirmation,
	openNewDateModel,
	updateNewDateModelOnSelectChange,
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