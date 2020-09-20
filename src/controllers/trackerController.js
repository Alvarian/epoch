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

const openCreateSprintModel =  async ({ ack, body, client }, sprintName) => {
  // Acknowledge the command request

  try {
	await ack();
    
    // Call views.open with the built-in client
    // FIELDS: title, description, admin_name, admin_email, admin_sid
    const result = await client.views.open({
		// Pass a valid trigger_id within 3 seconds of receiving it
		trigger_id: body.trigger_id,
		// View payload
		view: {
			type: 'modal',
			// View identifier
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
						initial_value: sprintName
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
    console.log(result);
  }
  catch (error) {
    console.error(error);
  }
};

const createProjectSprint =  async (module) => {
	const { ack, body, view, context } = module;
    // FIELDS: title, description, admin_name, admin_email, admin_sid
	const title = view['state']['values']['project_name_block']['title_input']['value'];
	const description = view['state']['values']['project_desc_block']['description_input']['value'];
	const admin_name = body['user']['name'];
	const admin_sid = body['user']['id'];
	
	// Message the user
	try {
		// Acknowledge the view_submission event
		await ack();
		
		// Message to send user
		let msg = '';
		// Save to DB
		const results = await Projects.create({
			title,
			description,
			admin_name,
			admin_sid
		});

		if (results) {
			// DB save was successful
			msg = 'Your submission was successful';
		} else {
			msg = 'There was an error with your submission';
		}
		
		console.log("LOG: ", results)
	}
	catch (error) {
		console.error(error);
	}
}


module.exports = { getProjAdminToSayHello, createProjectSprint, openCreateSprintModel };