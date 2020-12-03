/*CONTIENE LA CONFIGURACION DE LA BBDD*/


module.exports = {
    server: 'MQVSDB01',
    user: process.env.SERVERUSR,
    password: process.env.SERVERPASS,
    database: 'MQSISX_AMH',
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    "options": {
        "encrypt": false,
        "enableArithAbort": false
    }
}