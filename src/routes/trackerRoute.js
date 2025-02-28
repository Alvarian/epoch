const { 
	getProjAdminToSayHello,
	getNewestMember,
	setNewestMember,
	 
	openSprintList,
	openCreateSprintModel,
	updateSprintModelOnSelectChange,
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
	removeMessageBlock,
	handleIncorrectCommand,
	openHelpIndexCard,
	// openIntroCard
} = require('../controllers/trackerController');


const trackCommandRoutes = module => {
	const { command, client, context, body, ack } = module;

	// params to point to controller
	const pointerDigest = command.text.split(' ');
	const pointer = (pointerDigest.length > 2) ? pointerDigest.slice(0, pointerDigest.length-1).join(' ') : command.text;
	const project = (pointerDigest.length > 2) ? pointerDigest.slice(2, pointerDigest.length) : null;

	switch (pointer) {
		case 'say hello':
			getProjAdminToSayHello(module, project);
			
			break;

		case 'new':
			openCreateSprintModel(ack, body.channel_id, body.response_url, body.trigger_id, client, project, false);
			
			break;

		case 'sprint':
			openSprintCard(ack, client, context.botToken, body.channel_id, body.user_id, project, body.response_url);

			break;

		case 'sprints':
			openSprintList(ack, client, context.botToken, body.response_url, body.channel_id, body.user_id);
			
			break;

		case 'help':
			openHelpIndexCard(ack, client, context.botToken, body.channel_id, body.user_id, body.response_url, body.user_name);
		
			break;

		default:
			handleIncorrectCommand(ack, client, context.botToken, body.response_url, body.channel_id, body.user_id, body.text);

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

	app.action('redirect_newdate_sprint_change', async ({ack, body, payload, context, client}) => {
		// ack, channelID, responseURL, botToken, client, sprintName, selectedDate
		const pm = JSON.parse(body.view.private_metadata);
		const { channelID, responseURL, botToken, viewID, selectedDate } = {
			channelID: pm.channelID,
			responseURL: pm.responseURL,
			botToken: context.botToken,
			viewID: body.view.id,
			selectedDate: payload.selected_date
		};

		updateSprintModelOnSelectChange(ack, channelID, responseURL, botToken, client, viewID, selectedDate);
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

	// app.action('open_help_index', async (module) => {
	// 	console.log(module)
	// 	const {context, body, payload} = module;

		// botToken, channelID, userID, responseURL
		// switch (payload.value) {
		// 	case "fromDir":
		// 		openHelpIndexCard(context.botToken, body.channel_id, body.user_id, body.response_url);

		// 		break;
		// 	case "fromIntro":
		// 		openHelpIndexCard(context.botToken, body.channel_id, body.user_id, body.response_url);
				
		// 		break;
		// }
	// });


	app.action('close_message', removeMessageBlock);
	app.action('close_ephemeral', removeEphemeralBlock);
};

const trackerEventRoutes = app => {
	app.event('team_join', async ({ payload }) => {
		setNewestMember([payload.user.id, payload.user.name]);
	});
};

const trackerWorkflowRoutes = (app, Wf) => {
	const openHelpFromIntro = new Wf('open_help_from_intro', {
		edit: async ({ ack, step, configure }) => { await ack(); },
		save: async ({ ack, step, view, update }) => {
		  try {
			await ack();
	  
			const inputs = {
			  taskName: {value: "helpdirectory"},
			  taskDescription: {value: "Open help directory from intro"}
			};
	  
			const outputs = [
			  {
				type: 'text',
				name: 'taskName',
				label: 'Task name',
			  },
			  {
				type: 'text',
				name: 'taskDescription',
				label: 'Task description',
			  }
			];
	  
			await update({ inputs, outputs });
		  } catch (err) {
			console.log(err)
		  }
		},
		execute: async ({ step, complete, fail, client, context }) => {
		  const { inputs } = step;
	  
		  const outputs = {
			taskName: inputs.taskName.value,
			taskDescription: inputs.taskDescription.value,
		  };
		  const newUserID = await getNewestMember();
		  
		  try {
			// signal back to Slack that everything was successful

			await complete({ outputs });
		  } catch (err) {
			await fail({ error: { message: err } });
		  } finally {
			openHelpIndexCard(() => {}, client, context.botToken, "C01B377AM0U", newUserID[0], false, newUserID[1]);
		  }
		},
	}); app.step(openHelpFromIntro);
}

module.exports = { trackCommandRoutes, trackerActionRoutes, trackerEventRoutes, trackerWorkflowRoutes };