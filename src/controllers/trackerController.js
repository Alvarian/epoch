const cacheClient = require('../config/cache');
const Projects = require('../models/Projects');


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

const getProjAdminToSayHello = async (module, param) => {
	const { say, ack } = module;

	try {
		await ack();

		const adminName = await cacheIfFieldDoesNotExist(param);

		await say(`Hi, I am ${adminName}.`);
	} catch (err) {
		console.log(err);

		return;
	}
}

module.exports = { getProjAdminToSayHello };