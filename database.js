const mssql = require('mssql');
//const { promisify } = require('util');

const database = require('./keys');

//connect to your database
const pool = new mssql.ConnectionPool(database)
    .connect()
    .then(pool => {
        console.log('Connected DB')
        return pool
    })
    .catch(err => console.log('Database Connection Failed! Bad Config: ', err))

//poolPromise.query = promisify(poolPromise.query); /*Gracias a esta linea de codigo, podemos utilizar promesas*/

module.exports = pool;




//const pool = mssql.connect(database);
// const pool = new mssql.ConnectionPool(database);

// pool.connect((err, connection) => {
//     console.log('err  ', err);

//     if (err) {
//         if (err.code === 'ELOGIN') {
//             console.error('Login failed DB.');

//         }
//         if (err.code === 'ETIMEOUT ') {
//             console.error('Connection timeout');

//         }
//     }

//     if (connection) connection.release();
//     console.log('DB IS CONNECT');
//     return;
// });


// pool.query = promisify(pool.query); /*Gracias a esta linea de codigo, podemos utilizar promesas*/

// module.exports = pool;