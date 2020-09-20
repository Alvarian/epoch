const { getProjAdminToSayHello, createProjectSprint } = require('../controllers/trackerController');


const trackerRoute = (module) => {
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
			createProjectSprint(module, project);
			
			break;
		default:
			console.log('no match');
			break;
	}
};

const trackerActions = (app) => {
	app.action('button_click', async ({ body, ack, say }) => {
		// Acknowledge the action
		await ack();
		await say(`<@${body.user.id}> clicked the button`);
	});
}

module.exports = { trackerRoute, trackerActions };