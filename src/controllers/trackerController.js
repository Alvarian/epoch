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

const createProjectSprint =  async ({ ack, body, client }) => {
  // Acknowledge the command request
  await ack();

  try {
    // Call views.open with the built-in client
    // FIELDS: title, description, admin_name, admin_email, admin_sid
    const result = await client.views.open({
		// Pass a valid trigger_id within 3 seconds of receiving it
		trigger_id: body.trigger_id,
		// View payload
		view: {
			type: 'modal',
			// View identifier
			callback_id: 'view_1',
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
						multiline: false
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
						action_id: 'descripton_input',
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
    console.log(result);
  }
  catch (error) {
    console.error(error);
  }
};


module.exports = { getProjAdminToSayHello, createProjectSprint };