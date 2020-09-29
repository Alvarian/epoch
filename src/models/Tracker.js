const Sequelize = require('sequelize');
const database = require('../config/db');


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
		status: {
			type: Sequelize.BOOLEAN,
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

const Tickets = database.define('tickets', 
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
		creator_sid: {
			type: Sequelize.STRING,
			allowNull: false
		},
		status: {
			type: Sequelize.BOOLEAN,
			allowNull: false
		},
		deadline: {
			type: Sequelize.STRING,
			allowNull: true
		},
		worker_id: {
			type: Sequelize.STRING,
			allowNull: false
		},
		sprint_id: {
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
	},
	{
		timestamps: true,
		underscored: true,
		freezeTableName: true
	}
);

Sprint.hasMany(Assigned);
Sprint.hasMany(Tickets);

Workers.hasMany(Assigned);
Workers.hasMany(Tickets);

Assigned.belongsTo(Sprint);
Assigned.belongsTo(Workers);

Tickets.belongsTo(Workers);
Tickets.belongsTo(Sprint);


module.exports = { Sprint, Assigned, Workers, Tickets };
