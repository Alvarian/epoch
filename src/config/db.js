require('dotenv').config();
const { PSQL_URL } = process.env;

const Sequelize = require('sequelize');
const db = new Sequelize(PSQL_URL, {logging: false});

db.authenticate()
	.then(() => console.log('Database connected...'))
	.catch(err => console.log('Error: '+err));

module.exports = db;