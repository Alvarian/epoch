require('dotenv').config();
const { PSQL_DB, PSQL_USER, PSQL_PASS, PSQL_HOST } = process.env;

const Sequelize = require('sequelize');
const db = new Sequelize(PSQL_DB, PSQL_USER, PSQL_PASS, {
	host: PSQL_HOST,
	dialect: 'postgres',
	operatorsAliases: 0,

	pool: {
		max: 5,
		min: 0,
		acquire: 30000,
		idle: 10000
	},
	logging: false
});

db.authenticate()
	.then(() => console.log('Database connected...'))
	.catch(err => console.log('Error: '+err));

module.exports = db;