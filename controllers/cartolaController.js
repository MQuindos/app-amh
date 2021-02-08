'use strict';

const mssql = require('mssql');
const database = require('../keys');
const moment = require('moment');
const pool1 = new mssql.ConnectionPool(database);
var session = require('express-session');

var ssn;

/**
 * Entrega movimientos para generar cartola pdf, con los regsitros liquidados del mes en curso.
 */
async function getMovimiento_formatoCartola() {
    try {

        let rs = await pool1.connect(); // Obtenemos la conexion
        let qy = `
            Select top 300 libro_ctacte.codigo
                ,cta.nombrectacte
                ,fecha
                ,convert(varchar(10),fecha,105) as fctexto
                ,isnull(cod_tipmovto,'') as idmovimiento
                ,isnull(tm.nom_mov,'') as movimiento
                ,CONCAT(direccion,' ',n_direccion,' ',unidad,' ',n_unidad) as dirpropiedad            
                ,isnull(genera,'') as genera
                ,case when isnull(genera,'') = 'entrada' then monto else 0 end as entrada
                ,case when isnull(genera,'') = 'salida' then monto else 0 end as salida
                ,monto
                ,glosa	
            from libro_ctacte
                left join tipo_movimiento tm on tm.id_mov = cod_tipmovto
                left join propiedad pro on pro.cod_propiedad = libro_ctacte.cod_propiedad
                left join cuentascorrientes cta on libro_ctacte.codigo = cta.codigo
            where estado = 1
                and month(fecha) = 1
                and YEAR(fecha) = 2021
                and isnull(nulo,'') = ''
            order by codigo,fecha asc
        `;
    
        let resp = await pool1.query(qy);
        
        return {
            status: true,
            message: 'Ejecución Correcta',
            data:resp.recordset
        }

    } catch (error) {
        console.log('Problemas en getMovimiento_formatoCartola::',error.message);
        return {
            status : false,
            message : error.message
        }
        
    }
}

async function getVistaCartola(req,res) {

    ssn = req.session;
    return await res.render('cartola/cartola', {            
        name_user: ssn.nombre,
        nombrelog: 'ssd'
    });

}


module.exports = {    
    getVistaCartola
    ,getMovimiento_formatoCartola
}