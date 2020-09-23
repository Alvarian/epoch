const Sequelize = require('sequelize');
const database = require('../config/db');
// const Ticket = require('./Tickets');
// const Assigned = require('./Assigned.js');


const Sprint = database.define('sprints', 
	{
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
		},
		
		// Timestamps
		createdAt: {
			type: Sequelize.DATE,
			field: 'created_at'
		},
		updatedat: {
			type: Sequelize.DATE,
			field: 'updated_at'
		}
	}
	,{
		timestamps: true,
		underscored: true,
		freezeTableName: true
	}
);

const Assigned = database.define('workers_assigned', 
	{
		worker_id: {
			type: Sequelize.INTEGER,
			allowNull: false
		},
		sprint_id: {
			type: Sequelize.INTEGER,
			allowNull: false
		}
	}
	,{
		timestamps: false,
		underscored: true,
		freezeTableName: true
	}
);

const Workers = database.define('workers', 
	{
		name: {
			type: Sequelize.STRING,
			allowNull: false,
			unique: true
		},
		role: {
			type: Sequelize.STRING,
			allowNull: false
		},
		sid: {
			type: Sequelize.STRING,
			allowNull: false,
			unique: true
		}
	},
	{
		timestamps: false,
		underscored: true,
		freezeTableName: true
	}
);

Sprint.hasMany(Assigned);
Workers.hasMany(Assigned);
Assigned.belongsTo(Sprint);
Assigned.belongsTo(Workers);


module.exports = { Sprint, Assigned, Workers };
