const { 
	getProjAdminToSayHello,
	 
	openSprintList,
	openCreateSprintModel,
	createSprintCard,
	makeSprintListBlock,
	makeSprintBlock,
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

	removeEphemeralBlock,
	replaceEphemeralBlock,
	removeMessageBlock
} = require('../controllers/trackerController');


const trackCommandRoutes = module => {
	const { message, say, command, client, context, body, ack } = module;

	// params to point to controller
	const pointerDigest = command.text.split(' ');
	const pointer = (pointerDigest.length > 2) ? pointerDigest.slice(0, pointerDigest.length-1).join(' ') : command.text;
	const project = pointerDigest[pointerDigest.length-1];
	
	switch (pointer) {
		case 'say hello from':
			getProjAdminToSayHello(module, project);
			
			break;

		case 'create sprint':
			openCreateSprintModel(ack, body.channel_id, body.response_url, body.trigger_id, client, project);
			
			break;

		case 'open sprint':
			openSprintCard(ack, client, context.botToken, body.channel_id, body.user_id, project, body.response_url);
			//ack, client, botToken, channelID, userID, sprintName, responseURL
			break;

		case 'open sprints':
			openSprintList(ack, client, context.botToken, body.response_url, body.channel_id, body.user_id);
			
			break;

		default:
			console.log('no match');
			break;
	}
};

const trackerActionRoutes = app => {
	app.view('create_sprint_model', createSprintCard);
	app.view('create_ticket_model', async ({ack, body, view, context, client}) => {
		const viewPayload = { 
			title: view['state']['values']['ticket_name_block']['title_input']['value'], 
			description: view['state']['values']['ticket_desc_block']['description_input']['value'], 
			pm: JSON.parse(view.private_metadata) 
		};
		
		createTicketCard(ack, body, viewPayload, context, client, null);
	});
	app.view('change_date_model', async ({ack, view, payload}) => {
		const { responseURL, blocks, userID, ticketID, newDeadline } = JSON.parse(view.private_metadata);

		changeTicketStatus(selectedStatus, ticketID, newDeadline)
			.then(async () => {
				const blocks = await makeTicketBlock(ticketID, userID);

				replaceEphemeralBlock(responseURL, blocks);
			});
		
		ack();
	});

	app.action('redirect_newdate_change', async ({ack, client, body, payload, context}) => {
		updateNewDateModelOnSelectChange(ack, client, context.botToken, body.view.id, body.view.private_metadata, payload.selected_date);
	});

	app.action('ticket_declined', createTicketConfirmation);
	app.action('ticket_accepted', createTicketConfirmation);

	app.action('select_input', updateTicketModelOnSelectChange);

	app.action('open_ticket_model', async ({ ack, client, body, payload }) => {
		const sprintPayload = {
			si: payload.value, 
			ci: body.channel.id, 
			ru: body.response_url,
			iu: body.user.id,
			su: false,
			cs: body.user.id
		};

		openCreateTicketModel(ack, client, sprintPayload, body.trigger_id);
	});

	app.action('open_ticket', async (module) => {
		const {ack, client, body, context, payload} = module;

		openTicketCard(ack, client, body.response_url, payload.value, body.user.id);
	});

	app.action('open_sprint_model', async ({ ack, body, client }) => {
		openCreateSprintModel(ack, body.channel.id, body.response_url, body.trigger_id, client, null, true);
	});

	app.action('open_sprint', async ({ack, client, context, body, payload}) => {
		const blocks = await makeSprintBlock(context.botToken, body.channel.id, body.user.id, payload.value);
						
		replaceEphemeralBlock(body.response_url, blocks);
	});

	app.action('redirect_from_back', async ({context, body, payload}, blocks=null) => {
		const redirectPayload = { 
			blockSrc, 
			blockID,  
			ticketID 
		} = JSON.parse(payload.value);

		switch (blockSrc) {
			case 'sprint':
				blocks = await makeSprintBlock(context.botToken, body.container.channel_id, body.user.id, blockID);
				break;
				
			case 'sprintList':
				blocks = await makeSprintListBlock(context.botToken, body.container.channel_id, body.user.id)
		}

		replaceEphemeralBlock(body.response_url, blocks);
	});

	app.action('redirect_date_change', async ({ack, body, payload, context, client}) => {
		const { userID, key } = JSON.parse(payload.block_id);

		createTicketCard(ack, { user: {id: userID}, key, response_url: body.response_url }, null, context, client, payload.selected_date);
	});

	app.action('redirect_from_status', async ({ack, context, body, payload, client}) => {
		const redirectPayload = {
			blockSrc, 
			blockID,
			selectedStatus, 
			ticketID,
			initialStatus
		} = JSON.parse(payload.value);

		switch (blockSrc) {
			case 'sprint':
				changeTicketStatus(selectedStatus, ticketID)
					.then(async () => {
						const blocks = await makeSprintBlock(context.botToken, body.container.channel_id, body.user.id, blockID);
						
						replaceEphemeralBlock(body.response_url, blocks);
					});

				break;

			case 'ticket':
				if (initialStatus && !selectedStatus) {
					openNewDateModel(ack, body.trigger_id, client, {responseURL: body.response_url, userID: body.user.id, ticketID})
				} else {
					changeTicketStatus(selectedStatus, ticketID)
						.then(async () => {
							const blocks = await makeTicketBlock(ticketID, body.user.id);

							replaceEphemeralBlock(body.response_url, blocks);
						});
				}

				break;
		}
	});

	app.action('redirect_from_delete', async ({context, body, payload}) => {
		const redirectPayload = {
			blockSrc, 
			blockID,
			ticketID 
		} = JSON.parse(payload.value);

		switch (blockSrc) {
			case 'sprint':
				deleteTicket(ticketID)
					.then(async () => {
						const blocks = await makeSprintBlock(context.botToken, body.container.channel_id, body.user.id, blockID);
						
						replaceEphemeralBlock(body.response_url, blocks);
					});

				break;

			case 'sprintList':
				deleteSprint(blockID)
					.then(async () => {
						const blocks = await makeSprintListBlock(context.botToken, body.container.channel_id, body.user.id);

						replaceEphemeralBlock(body.response_url, blocks);
					})

				break;
		}
	});

	app.action('close_message', removeMessageBlock);
	app.action('close_ephemeral', removeEphemeralBlock);
};

module.exports = { trackCommandRoutes, trackerActionRoutes };