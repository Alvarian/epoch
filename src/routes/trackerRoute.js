const { 
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

	removeEphemeralBlock,
	replaceEphemeralBlock,
	removeMessageBlock
} = require('../controllers/trackerController');


const trackCommandRoutes = (module) => {
	const { message, say, command } = module;

	// params to point to controller
	const pointerDigest = command.text.split(' ');
	const pointer = pointerDigest.slice(0, pointerDigest.length-1).join(' ');
	const project = pointerDigest[pointerDigest.length-1];
	switch (pointer) {
		case 'say hello from':
			getProjAdminToSayHello(module, project);
			
			break;

		case 'create sprint':
			openCreateSprintModel(module, project);
			
			break;
		// client, botToken, responseURL, channelID, userID, sprintName
		case 'open sprint':
			const { client, context, body, ack } = module;

			openSprintCard(ack, client, context.botToken, body.response_url, body.channel_id, body.user_id, project);
			
			break;

		default:
			console.log('no match');
			break;
	}
};

const trackerActionRoutes = (app) => {
	app.view('create_sprint_model', createSprintCard);
	app.view('create_ticket_model', createTicketCard);


	app.action('ticket_declined', createTicketConfirmation);
	app.action('ticket_accepted', createTicketConfirmation);

	app.action('select_input', updateTicketModelOnSelectChange);

	app.action('open_ticket_model', async ({ ack, client, body, payload }) => {
		const sprintPayload = {
			sprint_id: payload.value, 
			channel_id: body.channel.id, 
			responseURL: body.response_url,
			initialUser: body.user.id,
			selectedUser: false
		};

		openCreateTicketModel(ack, client, sprintPayload, body.trigger_id);
	});

	app.action('open_ticket', async (module) => {
		const {ack, client, body, context, payload} = module;

		openTicketCard(ack, client, body.response_url, payload.value, body.user.id);
	});

	app.action('redirect', async ({client, context, body, payload}, blocks=null) => {
		const { blockSrc, blockID } = {
			blockSrc: payload.value.split('_')[0],
			blockID: payload.value.split('_')[1]
		};

		switch (blockSrc) {
			case 'sprint':
				blocks = await makeSprintBlock(client, context.botToken, body.container.channel_id, body.user.id, blockID);
				break;
		}

		replaceEphemeralBlock(body.response_url, blocks);
	});
	

	app.action('close_message', removeMessageBlock);
	app.action('close_ephemeral', removeEphemeralBlock);
};

module.exports = { trackCommandRoutes, trackerActionRoutes };