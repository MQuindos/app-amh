require('dotenv').config();

let DB_USERNAME = null
let ROOT_PASSWORD = null
let DATABASE = null
let DB_PORT = null

if (process.env.DIALEC === "postgres") {
    DB_USERNAME = process.env.POSTGRES_USER
    ROOT_PASSWORD = process.env.POSTGRES_PASSWORD
    DATABASE = process.env.POSTGRES_DB
    DB_PORT = process.env.POSTGRES_DB_PORT
}


if (process.env.DIALEC === "mysql") {
    DB_USERNAME = process.env.DEV_MYSQL_USER
    ROOT_PASSWORD = process.env.DEV_MYSQL_PASSWORD
    DATABASE = process.env.DEV_MYSQL_DATABASE
    DB_PORT = process.env.DEV_MYSQL_DB_PORT
}

if (process.env.DIALEC === "mssql") {
    DB_USERNAME = process.env.SERVERUSR
    ROOT_PASSWORD = process.env.SERVERPASS
    DATABASE = process.env.SERVERBD
    DB_PORT = process.env.SERVERPORT
}


module.exports = {
    username: DB_USERNAME,
    password: ROOT_PASSWORD,
    database: DATABASE,
    host: process.env.SERVERBBDD,
    port: DB_PORT,
    dialect: process.env.DIALEC,
    logging: (process.env.NODE_ENV === 'development' ? console.log : null),
    logging: false,
};