'use strict';

const mssql = require('mssql');
const database = require('../keys');
const pool1 = new mssql.ConnectionPool(database);


async function getPathComprobantePago_Amh() {
    try {

        let rs = await pool1.connect(); // Obtenemos la conexion
        let qy = `
            Select
                CONVERT(varchar(10),fecha,105) as fc 
                , ncontrato
                , patharchivo as pathf
            from amh_pathcomprobante 
            where estado = 1 and fecha > getdate() -1;
        `;

        let data = await pool1.query(qy);

        return {
            status: true,
            message: 'Ejecución Correcta',
            data: data.recordset
        }        

    } catch (error) {
        console.log(error);
        return {
            status : false,
            message : error.message
        }
    }
    
}

module.exports = {
    getPathComprobantePago_Amh
}

