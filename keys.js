/*CONTIENE LA CONFIGURACION DE LA BBDD*/


module.exports = {
    server: 'MQVSDB01',
    user: process.env.SERVERUSR,
    password: process.env.SERVERPASS,
    database: process.env.SERVERBD,
    options: {
        "encrypt": false,
        "enableArithAbort": false
    },
	pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 60000
    }
}