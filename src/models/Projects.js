const Sequelize = require('sequelize');
const database = require('../config/db');

const Projects = database.define('projects', {
	title: {
		type: Sequelize.STRING,
		allowNull: false,
		unique: true
	},
	description: {
		type: Sequelize.TEXT,
		allowNull: false
	},
	admin_name: {
		type: Sequelize.STRING,
		allowNull: false
	},
	admin_sid: {
		type: Sequelize.STRING,
		allowNull: false
	}
}, {
    timestamps: false
});

module.exports = Projects;
