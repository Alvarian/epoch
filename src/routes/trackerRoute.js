const { 
	getProjAdminToSayHello, 
	createSprintCard, 
	openCreateSprintModel,
	openSprintCard,
	removeEphemeralBlock,
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

	app.action('close_message', removeMessageBlock);
	app.action('close_ephemeral', removeEphemeralBlock);
};

module.exports = { trackCommandRoutes, trackerActionRoutes };