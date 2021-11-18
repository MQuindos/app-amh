'use strict';

const mssql = require('mssql');
const database = require('../keys');
const moment = require('moment');
const pool1 = new mssql.ConnectionPool(database);
const functions = require('../functions/funciones');
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


async function getResumenCtaCte_x_nCuentaYPeriodo(numCuenta, periodo) {
    try {

        if (parseInt(numCuenta) > 9999) {

            periodo = periodo.trim();
            let arPeriodo = periodo.split(' ');
            let mes = arPeriodo[0];
            let anio = arPeriodo[1];
            let numMes = 0;
            let resnumMes = await functions.monthToNumber(mes);            
                numMes = resnumMes.numMes;
            let rs = await pool1.connect(); // Obtenemos la conexion

            let qResumenCtaCte = `                
        
                SELECT TIPO,CASE WHEN ARRENDATARIO = '' THEN 'Otros' ELSE ARRENDATARIO END AS ARRENDATARIO
                    ,CASE WHEN INMUEBLE = '' THEN 'Otros' ELSE INMUEBLE END AS INMUEBLE
                    ,INGRESOS,EGRESOS,[SALDO A LIQUIDAR] as TOTAL_RESUMEN,COD
                FROM(
                    SELECT 'RESUMEN' as TIPO
                        ,   CONCAT(LTRIM(RTRIM(ARREN.nombres)), ' ',LTRIM(RTRIM(ARREN.apellido_pat)), ' ',LTRIM(RTRIM(ARREN.apellido_mat))) as ARRENDATARIO
                        ,   CONCAT(PRO.direccion , ' ' ,PRO.n_direccion , ' ' ,PRO.unidad , ' ' , PRO.n_unidad) as INMUEBLE
                        ,   CONCAT(PRO.cod_propiedad,ARREN.cod_arrendatario) as COD
                        ,   SUM(case when genera = 'entrada' then monto else 0 end) as [INGRESOS]
                        ,   SUM(case when genera = 'salida' then monto else 0 end) as [EGRESOS]
                        ,   SUM(case when genera = 'entrada' then monto else 0 end) - SUM(case when genera = 'salida' then monto else 0 end) AS [SALDO A LIQUIDAR]
                    FROM
                    (
                        SELECT idmovcaj, case when isnull(l.cod_arrendatario,0) = 0 then tmp_prop_arrend.codarrendatario else isnull(l.cod_arrendatario,0) end as cod_arrendatario
                            ,l.cod_propiedad, l.monto, l.genera, l.codigo
                        FROM libro_ctacte l
                            LEFT JOIN
                            (
                                Select distinct isnull(cod_arrendatario,'') as codarrendatario, isnull(cod_propiedad,'') as codpropiedad
                                from libro_ctacte
                                WHERE  nulo IS NULL AND codigo = ${numCuenta}
                                    AND isnull(monto,0) > 0 
                                    --AND isnull(cod_arrendatario,0) != 0
                                    AND estado = 1
                                    AND YEAR(fecha) = ${anio}
                                    AND MONTH(fecha) = ${numMes}
                                    AND isnull(cod_tipmovto,0) not in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40)
                
                            ) as tmp_prop_arrend on l.cod_propiedad = tmp_prop_arrend.codpropiedad
                            WHERE nulo IS NULL AND l.codigo = ${numCuenta}
                                AND YEAR(fecha) = ${anio}
                                AND MONTH(fecha) = ${numMes}
                                AND isnull(l.cod_tipmovto,0) not in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40)
                                AND estado = 1				
                
                    ) as tmp_libro_arren_propiet
                        LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
                        LEFT JOIN arrendatario ARREN on ARREN.cod_arrendatario = tmp_libro_arren_propiet.cod_arrendatario
                
                    GROUP BY concat(LTRIM(RTRIM(ARREN.nombres)),' ',LTRIM(RTRIM(ARREN.apellido_pat)), ' ',LTRIM(RTRIM(ARREN.apellido_mat)))
                        ,concat(PRO.direccion , ' ' ,PRO.n_direccion , ' ' ,PRO.unidad , ' ' , PRO.n_unidad)
                        ,CONCAT(PRO.cod_propiedad,ARREN.cod_arrendatario)
                ) as tem
                --Where LTRIM(RTRIM(ISNULL(INMUEBLE,''))) != ''
                order by CASE WHEN INMUEBLE = '' THEN 'OTROS' ELSE INMUEBLE END asc;
            `;


            // console.log('QUERY CARTOLA:::', qResumenCtaCte);

            let data = await pool1.query(qResumenCtaCte);

            return {
                status: true,
                message: 'Ejecución Correcta',
                data: data.recordset
            }

        } else {

            return {
                status: false,
                message: 'Parametros no válidos'
            }
        }

    } catch (err) {

        return {
            status: false,
            message: err.message
        };

    }
}


async function getGastosGlobales_numCuentaYPeriodo(numCuenta, periodo) {
    try {
        
        if (parseInt(numCuenta) > 9999) {

            periodo = periodo.trim();
            let arPeriodo = periodo.split(' ');
            let mes = arPeriodo[0];
            let anio = arPeriodo[1];
            let numMes = 0;
            let resnumMes = await functions.monthToNumber(mes);
            numMes = resnumMes.numMes;

            let rs = await pool1.connect(); // Obtenemos la conexion

            let qGastos = `
                SELECT 'GASTOS GLOBALES' as TIPO
                    ,   CONVERT(varchar(10),fecha_movi,105) as FECHA                                        
                    ,   monto as MONTO
                    ,   id_mov
                    ,   nom_mov as MOV
                    ,   fecha_movi
                    ,   glosa
                    ,   genera
                FROM
                (
                    SELECT idmovcaj		
                        ,	case when isnull(l.cod_arrendatario,0) = 0 then isnull(tmp_prop_arrend.codarrendatario,'0') else isnull(l.cod_arrendatario,0) end as cod_arrendatario			
                        ,	isnull(l.cod_propiedad,'0') as cod_propiedad, isnull(l.monto,0) as monto, l.genera
                        ,	l.codigo,tm.id_mov, tm.nom_mov, l.fecha as fecha_movi,l.glosa
                    FROM libro_ctacte l
                        INNER join tipo_documento td ON l.cod_tipdocto = td.idtipdoc
				        LEFT join tipo_movimiento tm ON l.cod_tipmovto = tm.id_mov
                        LEFT JOIN 
                        (
                            Select distinct isnull(cod_arrendatario,'') as codarrendatario, isnull(cod_propiedad,'') as codpropiedad 
                            from libro_ctacte  
                            WHERE nulo IS NULL AND codigo = ` + numCuenta + ` 
                                AND isnull(monto,0) > 0 
                                AND isnull(cod_arrendatario,0) != 0
                                AND YEAR(fecha) = ${anio}
                                AND MONTH(fecha) = ${numMes}
                                AND cod_tipmovto in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40)
                                AND estado = 1

                        ) as tmp_prop_arrend on l.cod_propiedad = tmp_prop_arrend.codpropiedad
                    WHERE nulo IS NULL AND l.codigo = ` + numCuenta + ` AND isnull(monto,0) > 0	
                        AND YEAR(fecha) = ${anio}
                        AND MONTH(fecha) = ${numMes}
                        AND tm.id_mov in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40)
                        AND estado = 1
                    UNION ALL

                    SELECT 	idmovcaj		
                        ,	case when isnull(l.cod_arrendatario,0) = 0 then isnull(tmp_prop_arrend.codarrendatario,'0') else isnull(l.cod_arrendatario,0) end as cod_arrendatario			
                        ,	isnull(l.cod_propiedad,'0') as cod_propiedad, l.monto, l.genera,l.codigo,tm.id_mov, tm.nom_mov, l.fecha as fecha_movi,l.glosa
                    FROM libro_ctacte l           
                        INNER join tipo_documento td ON l.cod_tipdocto = td.idtipdoc
                        LEFT join tipo_movimiento tm ON l.cod_tipmovto = tm.id_mov                     
                        LEFT JOIN 
                        (
                            Select distinct isnull(cod_arrendatario,'') as codarrendatario, isnull(cod_propiedad,'') as codpropiedad 
                            from libro_ctacte  
                            WHERE  nulo IS NULL AND codigo = ` + numCuenta + ` AND isnull(monto,0) > 0 
                                AND YEAR(fecha) = ${anio}
                                AND MONTH(fecha) = ${numMes}
                                AND cod_tipmovto not in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40)
                                AND estado = 1

                        ) as tmp_prop_arrend on l.cod_propiedad = tmp_prop_arrend.codpropiedad
                    WHERE nulo IS NULL AND l.codigo = ` + numCuenta + ` AND isnull(monto,0) > 0
                        AND estado = 1
                        AND YEAR(fecha) = ${anio}
                        AND MONTH(fecha) = ${numMes}
                        AND l.cod_tipmovto not in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40)
                        AND case when isnull(l.cod_arrendatario,0) = 0 then isnull(tmp_prop_arrend.codarrendatario,'0') else isnull(l.cod_arrendatario,0) end = '0'
                        AND isnull(l.cod_propiedad,'0') = '0'                        

                ) as tmp_libro_arren_propiet
                    LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
                    LEFT JOIN arrendatario ARREN on ARREN.cod_arrendatario = tmp_libro_arren_propiet.cod_arrendatario
                WHERE isnull(tmp_libro_arren_propiet.cod_propiedad,'0') = '0'       
                ORDER BY fecha_movi
                `;

            // console.log('GASTOS GLOBALES:::',qGastos);
            let data = await pool1.query(qGastos);

            return {
                status: true,
                message: 'Ejecución Correcta',
                data: data.recordset
            }

        } else {

            return {
                status: false,
                message: 'Parametros no válidos'
            }
        }

    } catch (err) {

        return {
            status: false,
            message: err.message
        };

    }
}

async function getDetalleMovimiento_Cartola(numCuenta, periodo, cod) {
    try {

        // console.log('Periodo getDetalleMovimiento_Cartola::',periodo);
        if (parseInt(numCuenta) > 9999) {
            
            periodo = periodo.trim();
            let arPeriodo = periodo.split(' ');
            let mes = arPeriodo[0];
            let anio = arPeriodo[1];
            let numMes = 0;
            let resnumMes = await functions.monthToNumber(mes);
            numMes = resnumMes.numMes;



            let qFiltro = '';
            let filtroArrenPropiedad = '';
            let qFiltroPeriodo = '';
            let rs = await pool1.connect(); // Obtenemos la conexion     
            // if (periodo != 'init') {

            //     qFiltro = ` in (
            //         Select libro_idmovcaj from tb_liquidacion_detalle 
            //         where num_cuentacte = ` + numCuenta + ` AND periodo = '` + periodo + `'
            //     )`;
            // } else {
            //     qFiltro = ` not in (
            //         Select libro_idmovcaj from tb_liquidacion_detalle 
            //         where num_cuentacte = ` + numCuenta + ` 
            //     ) `;

            //     qFiltroPeriodo = ' AND l.estado = 0 AND l.fecha > getdate() -35 ';
            // }

            if(cod != '')
            {
                filtroArrenPropiedad = ` WHERE CONCAT(PRO.cod_propiedad,'', ARREN.cod_arrendatario) = '` + cod + `' `;
            }

            let qDetalle = `
                SELECT TIPO, FECHA
                        ,   concat(PRO.direccion , ' ' , PRO.n_direccion , ' ' , PRO.unidad , ' ' , PRO.n_unidad) as PROPIEDAD
                        ,   tmp_libro_arren_propiet.codigo as [N° CUENTA]                        
                        ,   CASE WHEN ISNULL(tm.nom_mov,'') = '' THEN td.nom_doc ELSE ISNULL(tm.nom_mov,'')END as DESCRIPCION
                        ,   case when GENERA = 'salida' then monto else 0 end as [CARGO]
                        ,   case when GENERA = 'entrada' then monto else 0 end as [ABONO]
                        ,   PRO.cod_propiedad
                        ,   ARREN.cod_arrendatario
                        ,   glosa
                        ,   idmovcaj
                        ,   numRecibo
                        ,   fchaFormat
                        ,   CONCAT(tmp_libro_arren_propiet.cod_arrendatario,'-',tmp_libro_arren_propiet.cod_propiedad) as COD
                FROM
                    (
                        SELECT  DISTINCT 'DETALLE' as  TIPO, idmovcaj
                            , case when isnull(convert(varchar(20),l.cod_arrendatario),'') = '' then convert(varchar(20)
                            ,tmp_prop_arrend.codarrendatario) else isnull(convert(varchar(20),l.cod_arrendatario),'') end as cod_arrendatario
                            , l.cod_propiedad, l.monto, l.genera as GENERA, l.codigo, convert(varchar(10),l.fecha,105) as FECHA,l.fecha as fchaFormat
                            ,l.glosa
                            ,l.n_recibo as numRecibo
                            ,l.cod_tipdocto,l.cod_tipmovto
                        FROM libro_ctacte l
                            LEFT JOIN
                            (
                                Select distinct isnull(cod_arrendatario,'') as codarrendatario, isnull(cod_propiedad,'') as codpropiedad
                                    ,fecha
                                from libro_ctacte                    
                                WHERE nulo IS NULL AND codigo = ` + numCuenta + ` /*AND isnull(monto,0) > 0 AND isnull(cod_arrendatario,0) != 0*/                                            
                                    AND isnull(cod_tipmovto,0) not in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40,41)
                                    AND estado = 1
                                    AND YEAR(fecha) = ${anio}
                                    AND MONTH(fecha) = ${numMes}

                            ) as tmp_prop_arrend on l.cod_propiedad = tmp_prop_arrend.codpropiedad
                        WHERE nulo IS NULL AND l.codigo = ` + numCuenta + ` /*AND isnull(monto,0) > 0	*/
                            AND estado = 1
                            AND YEAR(l.fecha) = ${anio}
                            AND MONTH(l.fecha) = ${numMes}
                            AND isnull(l.cod_tipmovto,0) not in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40,41)
                            
                    ) as tmp_libro_arren_propiet
                    INNER JOIN tipo_documento td ON cod_tipdocto = td.idtipdoc
                    LEFT JOIN tipo_movimiento tm ON cod_tipmovto = tm.id_mov
                    LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
                    LEFT JOIN arrendatario ARREN on ARREN.cod_arrendatario = tmp_libro_arren_propiet.cod_arrendatario
                ` + filtroArrenPropiedad + `
                ORDER BY concat(PRO.direccion , ' ' , PRO.n_direccion , ' ' , PRO.unidad , ' ' , PRO.n_unidad),fchaFormat asc
            `;

            // console.log('qDetalle Cartola::',qDetalle);

            let data = await pool1.query(qDetalle);

            return {
                status: true,
                message: 'Ejecución Correcta',
                data: data.recordset
            }

        } else {

            return {
                status: false,
                message: 'Parametros no válidos'
            }
        }

    } catch (err) {

        return {
            status: false,
            message: err.message
        };

    }
}


async function getDetalleAbono_Cartola(xidmovcaj)
{
    try {

        if(xidmovcaj.trim() != '' )
        {
            let rs = await pool1.connect(); // Obtenemos la conexion     

            let qy = `
                Select distinct lb.idmovcaj,xyz.cod_contrato,xyz.id_recibo,xyz.cod_ctacte
                    ,	CONVERT(VARCHAR,xyz.fecha_arr,105) AS fechadeuda		
                    ,	xyz.id_item,ia.nom_item AS item,xyz.id_moneda
                    ,	xyz.item_deuda_mes_peso
                    ,	xyz.item_deuda_mes_uf
                    ,	ISNULL(xyz.item_pago_mes_peso,0) AS pagopeso
                    ,	ISNULL(xyz.item_pago_mes_uf,0) AS pagouf
                from libro_ctacte lb
                    left join Recibo_Arriendo ra on lb.n_recibo = ra.Id_ReciboArr 
                    left join detalle_pagosarriendoXYZ_subX xyz on xyz.id_recibo = ra.Id_ReciboArr
                    AND lb.monto = xyz.item_pago_mes_peso
                    AND month(xyz.fecha_arr) = MONTH(lb.f_referencia)
	                AND YEAR(xyz.fecha_arr) = YEAR(lb.f_referencia)
                    left join item_arriendo ia on xyz.id_item = ia.id_item_arriendo
                where lb.idmovcaj in (`+ xidmovcaj +`) 
                    AND ra.Estado_Pago = 'vigente' AND lb.nulo IS NULL
                    AND (ISNULL(xyz.item_pago_mes_peso,0) > 0 or ISNULL(xyz.item_pago_mes_uf,0) > 0)
            `;

            //console.log('DETALLLE::',qy);
            let data = await pool1.query(qy);

            return {
                status: true,
                message: 'Ejecución Correcta',
                data: data.recordset
            }
        }
        else {

            return {
                status: false,
                message: 'Problema con el parámetro enviado.'
            }
        }

    } catch (err) {

        return {
            status: false,
            message: err.message
        };

    }
    
}

module.exports = {    
    getVistaCartola,
    getResumenCtaCte_x_nCuentaYPeriodo,
    getGastosGlobales_numCuentaYPeriodo,
    getDetalleMovimiento_Cartola,
    getDetalleAbono_Cartola
    /*,getMovimiento_formatoCartola*/
}