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


/**
 * Retorna información de los movimientos de entrada a la caja, de acuerdo a la fecha enviada.
 * @param {Fecha de los movimientos formato(dd-mm-aaaa)} xfecha 
 */
async function getMovCajaEnt_PorFecha(xfecha)
{
    try 
    {
        if(xfecha.trim() !== '') 
        {        
            let rs = await pool1.connect(); // Obtenemos la conexion
            //[sp_movcajaent_now_LeerXFecha]
            let qy = `
                    SELECT idmovcaj,idmovcajdia,idcomprobante,codigo,cod_propiedad,cod_arrendatario
                        ,cod_tipdocto,cod_tipcta,cod_tipmovto,glosa,monto,fecha,hora
                        ,persona,nulo,genera
                        ,case when genera = 'entrada' then monto else 0 end as entrada
	                    ,case when genera = 'salida' then monto else 0 end as salida
                        ,estado,fecha_liq,liq_temp,liq_acum,sel_movarr,comi_cobrada
                    FROM movcajaent_now
                    WHERE fecha = '${xfecha}'
                    ORDER BY idmovcajdia;
                `;
                //'${xfecha.replace('-','/').replace('-','/').replace('-','/')}
                // console.log(qy);

            let data = await pool1.query(qy);

            return {
                status : true,
                data : data.recordset
            }

        } 
        else 
        {

            return {
                status: false,
                message:'Parámetro vacío'
            }    
        }

    } catch (error) {
console.log('Problemas::',error.message);
        return {
            status: false,
            message:error.message
        }
    }
}


async function getDataVista() {

    try {
        //NO PROCESADOS
        let rs = await pool1.connect(); // Obtenemos la conexion
        let qy = 'Select proces_id id ' +
            ' ,concat(convert(varchar(10),proces_fecha_carga,105),\' \'' +
            ' ,convert(varchar(5),proces_fecha_carga,108)) fechacarga ' +
            ' ,archi_nombre_arrendatario as arrendatarrio,archi_numero_operacion as numcontrato ' +
            ' ,concat(convert(varchar(15),archi_fecha_pago,105), \' \',convert(varchar(5),archi_fecha_pago,108) ) as fechapago ' +
            ' , archi_monto_pago totalpagado,\'Pendiente\' as estado' +
            ' ,DR.archi_cuenta_cliente as ctacte ' +
            ' ,DCD.cc_propiedades as propiedad ' +
            ' from amh_data_retorno DR ' +
            ' inner join amh_detallepago_ccierta_dataretorno DCD on DR.proces_id = DCD.ret_proces_id ' +
            ' where proces_estado = 1 ';
        let requestAdd = pool1.request(); // or: new sql.Request(pool1)
        let links = await requestAdd.query(qy);
        let linksReturn = links.recordsets[0];

        //PROCESADOS
        let rsP = await pool1.connect(); // Obtenemos la conexion
        let qyP = 'Select proces_id id ' +
            ' ,concat(convert(varchar(10),proces_fecha_carga,105),\' \'' +
            ' ,convert(varchar(5),proces_fecha_carga,108)) fechacarga ' +
            ' ,archi_nombre_arrendatario as arrendatarrio,archi_numero_operacion as numcontrato ' +
            ' ,concat(convert(varchar(15),archi_fecha_pago,105), \' \',convert(varchar(5),archi_fecha_pago,108) ) as fechapago ' +
            ' , archi_monto_pago totalpagado,\'Procesado\' as estado' +
            ' ,DR.archi_cuenta_cliente as ctacte ' +
            ' ,DCD.cc_propiedades as propiedad ' +
            ' ,concat(convert(varchar(15),proces_fecha_procesado,105), \' \',convert(varchar(5),proces_fecha_procesado,108) ) as fechaprocesado ' +
            ' from amh_data_retorno DR ' +
            ' inner join amh_detallepago_ccierta_dataretorno DCD on DR.proces_id = DCD.ret_proces_id ' +
            ' where proces_estado = 2 order by proces_fecha_procesado desc; ';
        let requestAddP = pool1.request(); // or: new sql.Request(pool1)
        let linksProcesado = await requestAddP.query(qyP);
        let linksProcess = linksProcesado.recordsets[0];

        return {
            status: true,
            linksProcess,
            linksReturn
        }

    } catch (err) {

        console.error('SQL error', err);
        return {
            status: false,
            linksProcess,
            linksReturn
        }
    }
}

module.exports = {
    getPathComprobantePago_Amh,
    getMovCajaEnt_PorFecha,
    getDataVista
}

