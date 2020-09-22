const { 
	getProjAdminToSayHello, 
	createProjectSprint, 
	openCreateSprintModel,
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

		default:
			console.log('no match');
			break;
	}
};

const trackerActionRoutes = (app) => {
	app.view('create_sprint_model', createProjectSprint);

	app.action('close_message', removeMessageBlock);
	app.action('close_ephemeral', removeEphemeralBlock);
};

module.exports = { trackCommandRoutes, trackerActionRoutes };