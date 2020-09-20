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

const getProjAdminToSayHello = async ({ say, ack }, param) => {
	try {
		await ack();

		const adminName = await cacheIfFieldDoesNotExist(param);

		await say(`Hi, I am ${adminName}.`);
	} catch (err) {
		console.log(err);
	}
};

const createProjectSprint = async ({ say, ack, payload }, param) => {
	try {
		await ack();
		// MODAL REQUESTING title, description, admin_name, admin_email, admin_sid
		// ONSUBMIT 
		await say({
			blocks: [
				{
					"type": "section",
					"text": {
						"type": "mrkdwn",
						"text": `Hey there <@${payload.user_id}>!`
					},
					"accessory": {
						"type": "button",
						"text": {
							"type": "plain_text",
							"text": "Create Project Sprint"
						},
						"action_id": "button_click"
					}
				}
			],
			text: `Hey there <@${payload.user_id}>!`
		});
	} catch (err) {
		console.log(err);
	}
};


module.exports = { getProjAdminToSayHello, createProjectSprint };