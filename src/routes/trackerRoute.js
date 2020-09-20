const { getProjAdminToSayHello } = require('../controllers/trackerController');


const sayhelloToSlackProjAdmin = (module) => {
	// console.log(module.payload);
	const { message, say, command } = module;

	// params to point to controller
	const pointerDigest = command.text.split(' ');
	const pointer = pointerDigest.slice(0, pointerDigest.length-1).join(' ');

	switch (pointer) {
		case 'say hello from':
			const project = pointerDigest[pointerDigest.length-1];

			getProjAdminToSayHello(module, project);
			
			break;
		default:
			console.log('no match');
			break;
	}
};

module.exports = sayhelloToSlackProjAdmin;