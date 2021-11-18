'use strict';

const mssql = require('mssql');
const database = require('../keys');
const numpalabra = require('./numPalabra');
const moment = require('moment');
const pool1 = new mssql.ConnectionPool(database);
var session = require('express-session');

var ssn;

/**
 * OBTIENE EL LISTADO DE CUENTAS CORRIENTES
 */
async function getListado_CtaCte() {
    try {        

        let rs = await pool1.connect(); // Obtenemos la conexion        
        let qListado = `
            SELECT codigo, 
                nombrectacte, cuentacerrada 
            FROM cuentascorrientes 
            WHERE cuentacerrada = 'NO' 
                AND codigo < 50000             
            ORDER BY codigo; `;

        let data = await pool1.query(qListado);

        return {
            status: true,
            message: 'Ejecución Correcta',
            data: data.recordset
        }

    } catch (err) {

        return {
            status: false,
            message: err.message
        };

    }
}

/**
 * Retorna periodo de la cuenta corriente
 */
async function getPeriodo_ctaCte(xNumCuenta) {
    try {

        let rs = await pool1.connect(); // Obtenemos la conexion        
        let qPeriodo = ` 
            Select distinct num_cuentacte, periodo, fecha 
            from tb_liquidacion_detalle 
            where periodo not like '%ANTIGUO%' and num_cuentacte = ` + xNumCuenta + `
            order by fecha desc 
        `;

        //  console.log('object::',qPeriodo);
        let data = await pool1.query(qPeriodo);

        return {
            status: true,
            message: 'Ejecución Correcta',
            data: data.recordset
        }

    } catch (err) {

        return {
            status: false,
            message: err.message
        };

    }
}

/**
 * RETORNA RESUMEN DE CTA CTE
 */
async function getResumenCtaCte_x_nCuenta(numCuenta, periodo) {
    try {

        if (parseInt(numCuenta) > 9999) {
            let qFiltro = '';
            let qFiltroPeriodo = '';
            let rs = await pool1.connect(); // Obtenemos la conexion     
            if (periodo != 'init') {

                qFiltro = ` in (
                    Select libro_idmovcaj from tb_liquidacion_detalle 
                    where num_cuentacte = ` + numCuenta + ` AND periodo = '` + periodo + `'
                )`;                

            } else {
                qFiltro = ` not in (
                    Select libro_idmovcaj from tb_liquidacion_detalle 
                    where num_cuentacte = ` + numCuenta + ` 
                )  `;                

                qFiltroPeriodo = ' AND l.estado = 0 AND l.fecha > getdate() -35 ';
            }

            let qResumenCtaCte = `
                    SELECT TIPO,CASE WHEN ARRENDATARIO = '' THEN 'Otros Movimientos' ELSE ARRENDATARIO END AS ARRENDATARIO 
                        ,CASE WHEN INMUEBLE = '' THEN 'Otros' ELSE INMUEBLE END AS INMUEBLE 
                        ,INGRESOS,EGRESOS,[SALDO A LIQUIDAR] as TOTAL_RESUMEN,COD
                        ,CANON,MONEDA
                    FROM(
                        SELECT 'RESUMEN' as TIPO
                            ,	CONCAT(LTRIM(RTRIM(ARREN.nombres)), ' ',LTRIM(RTRIM(ARREN.apellido_pat)), ' ',LTRIM(RTRIM(ARREN.apellido_mat))) as ARRENDATARIO
                            ,	CONCAT(PRO.direccion , ' ' ,PRO.n_direccion , ' ' ,PRO.unidad , ' ' , PRO.n_unidad) as INMUEBLE
                            ,   CONCAT(PRO.cod_propiedad,ARREN.cod_arrendatario) as COD
                            ,	MAX(CASE WHEN PRO.idtipomoneda = 1 THEN '$' ELSE 'UF' END) as MONEDA
							,	MAX(ISNULL(PRO.precio,0)) as CANON
                            ,	SUM(case when genera = 'entrada' then monto else 0 end) as [INGRESOS]
                            ,	SUM(case when genera = 'salida' then monto else 0 end) as [EGRESOS]	
                            ,	SUM(case when genera = 'entrada' then monto else 0 end) - SUM(case when genera = 'salida' then monto else 0 end) AS [SALDO A LIQUIDAR] 			
                        FROM
                        (
                            SELECT 	idmovcaj, case when isnull(l.cod_arrendatario,0) = 0 then tmp_prop_arrend.codarrendatario else isnull(l.cod_arrendatario,0) end as cod_arrendatario			
                                ,	l.cod_propiedad, l.monto, l.genera,	l.codigo			
                            FROM libro_ctacte l                                
                                LEFT JOIN 
                                (
                                    Select distinct isnull(cod_arrendatario,'') as codarrendatario, isnull(cod_propiedad,'') as codpropiedad 
                                    from libro_ctacte  
                                    WHERE  nulo IS NULL AND codigo = ` + numCuenta + ` AND isnull(monto,0) > 0 AND isnull(cod_arrendatario,0) != 0
                                    AND idmovcaj ` + qFiltro + ` AND isnull(cod_tipmovto,0) not in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40)

                                ) as tmp_prop_arrend on l.cod_propiedad = tmp_prop_arrend.codpropiedad
                            WHERE nulo IS NULL AND l.codigo = ` + numCuenta + ` /*AND isnull(monto,0) > 0	*/
                                AND idmovcaj ` + qFiltro + ` AND isnull(l.cod_tipmovto,0) not in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40)
                                ` + qFiltroPeriodo + `

                        ) as tmp_libro_arren_propiet
                            LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
                            LEFT JOIN arrendatario ARREN on ARREN.cod_arrendatario = tmp_libro_arren_propiet.cod_arrendatario
                        
                        GROUP BY concat(LTRIM(RTRIM(ARREN.nombres)), ' ',LTRIM(RTRIM(ARREN.apellido_pat)), ' ',LTRIM(RTRIM(ARREN.apellido_mat)))
                            ,concat(PRO.direccion , ' ' ,PRO.n_direccion , ' ' ,PRO.unidad , ' ' , PRO.n_unidad)
                            ,CONCAT(PRO.cod_propiedad,ARREN.cod_arrendatario)
                    ) as tem
                    Where /*LTRIM(RTRIM(ISNULL(ARRENDATARIO,''))) != '' */
					LTRIM(RTRIM(ISNULL(INMUEBLE,''))) != ''
                    ORDER BY CASE WHEN INMUEBLE = '' THEN 'OTROS' ELSE INMUEBLE END asc; `;

            // console.log('RESUMEN CUENTA:::', qResumenCtaCte);
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


async function getGastosGlobales_numCuenta(numCuenta, periodo) {
    try {
        
        if (parseInt(numCuenta) > 9999) {
            let qFiltro = '';
            let qFiltroPeriodo = '';
            let rs = await pool1.connect(); // Obtenemos la conexion     
            if (periodo != 'init') {

                qFiltro = ` in (
                    Select libro_idmovcaj from tb_liquidacion_detalle 
                    where num_cuentacte = ` + numCuenta + ` AND periodo = '` + periodo + `'
                )`;
            } else {
                qFiltro = ` not in (
                    Select libro_idmovcaj from tb_liquidacion_detalle 
                    where num_cuentacte = ` + numCuenta + ` 
                ) `;

                qFiltroPeriodo = ' AND l.estado = 0 AND l.fecha > getdate() -35 ';
            }

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
                            WHERE nulo IS NULL AND codigo = ` + numCuenta + ` AND isnull(monto,0) > 0 AND isnull(cod_arrendatario,0) != 0
                            AND idmovcaj ` + qFiltro + ` AND cod_tipmovto in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40)

                        ) as tmp_prop_arrend on l.cod_propiedad = tmp_prop_arrend.codpropiedad
                    WHERE nulo IS NULL AND l.codigo = ` + numCuenta + ` AND isnull(monto,0) > 0	
                        AND idmovcaj ` + qFiltro + ` AND tm.id_mov in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40)                        
                        ${ qFiltroPeriodo }

                    UNION ALL

                    SELECT 	idmovcaj		
                        ,	case when isnull(l.cod_arrendatario,0) = 0 then isnull(tmp_prop_arrend.codarrendatario,'0') else isnull(l.cod_arrendatario,0) end as cod_arrendatario			
                        ,	isnull(l.cod_propiedad,'0') as cod_propiedad, l.monto, l.genera,	l.codigo,tm.id_mov, tm.nom_mov, l.fecha as fecha_movi,l.glosa
                    FROM libro_ctacte l           
                        INNER join tipo_documento td ON l.cod_tipdocto = td.idtipdoc
                        LEFT join tipo_movimiento tm ON l.cod_tipmovto = tm.id_mov                     
                        LEFT JOIN 
                        (
                            Select distinct isnull(cod_arrendatario,'') as codarrendatario, isnull(cod_propiedad,'') as codpropiedad 
                            from libro_ctacte  
                            WHERE  nulo IS NULL AND codigo = ` + numCuenta + ` AND isnull(monto,0) > 0 
                            AND idmovcaj ` + qFiltro + ` AND cod_tipmovto not in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40)

                        ) as tmp_prop_arrend on l.cod_propiedad = tmp_prop_arrend.codpropiedad
                    WHERE nulo IS NULL AND l.codigo = ` + numCuenta + ` AND isnull(monto,0) > 0 	
                        AND idmovcaj ` + qFiltro + ` AND l.cod_tipmovto not in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40)
                        AND case when isnull(l.cod_arrendatario,0) = 0 then isnull(tmp_prop_arrend.codarrendatario,'0') else isnull(l.cod_arrendatario,0) end = '0'
                        AND (isnull(l.cod_propiedad,'0') = '0' or isnull(l.cod_propiedad,'') = '')
                        ${ qFiltroPeriodo }

                ) as tmp_libro_arren_propiet
                    LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
                    LEFT JOIN arrendatario ARREN on ARREN.cod_arrendatario = tmp_libro_arren_propiet.cod_arrendatario
                WHERE (isnull(tmp_libro_arren_propiet.cod_propiedad,'0') = '0' or isnull(tmp_libro_arren_propiet.cod_propiedad,'') = '')
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


//Calculo saldos acumulados / saldos acumulados en contra
async function getSaldoAcumulado_CuentaCorriente(xNumCuenta) {
    try {

        if (parseInt(xNumCuenta) > 9999) {

            let qy = `
                  
            `;

            let data = await pool1.query(qy);

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


async function getDetalleMovimiento(numCuenta, periodo, cod) {
    try {

        // console.log('Periodo::',periodo);
        if (parseInt(numCuenta) > 9999) {
            let qFiltro = '';
            let filtroArrenPropiedad = '';
            let qFiltroPeriodo = '';
            let rs = await pool1.connect(); // Obtenemos la conexion
            if (periodo != 'init') 
            {

                qFiltro = ` in (
                    Select libro_idmovcaj from tb_liquidacion_detalle 
                    where num_cuentacte = ` + numCuenta + ` AND periodo = '` + periodo + `'
                )`;

            } 
            else 
            {
                qFiltro = ` not in (
                    Select libro_idmovcaj from tb_liquidacion_detalle 
                    where num_cuentacte = ` + numCuenta + ` 
                ) `;

                qFiltroPeriodo = ' AND l.estado = 0 AND l.fecha > getdate() -35 ';
            }

            if(cod != '')
            {
                filtroArrenPropiedad = ` WHERE CONCAT(PRO.cod_propiedad,'', ARREN.cod_arrendatario) = '` + cod + `' `;
            }

            let qDetalle = `
                SELECT distinct TIPO, FECHA
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
                                            AND idmovcaj ` + qFiltro + ` AND isnull(cod_tipmovto,0) not in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40,41)

                            ) as tmp_prop_arrend on l.cod_propiedad = tmp_prop_arrend.codpropiedad
                        WHERE nulo IS NULL AND l.codigo = ` + numCuenta + ` /*AND isnull(monto,0) > 0	*/
                            AND idmovcaj ` + qFiltro + ` AND isnull(l.cod_tipmovto,0) not in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40,41)
                            ${ qFiltroPeriodo }
                    ) as tmp_libro_arren_propiet
                    INNER JOIN tipo_documento td ON cod_tipdocto = td.idtipdoc
                    LEFT JOIN tipo_movimiento tm ON cod_tipmovto = tm.id_mov
                    LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
                    LEFT JOIN arrendatario ARREN on ARREN.cod_arrendatario = tmp_libro_arren_propiet.cod_arrendatario
                ` + filtroArrenPropiedad + `
                ORDER BY concat(PRO.direccion , ' ' , PRO.n_direccion , ' ' , PRO.unidad , ' ' , PRO.n_unidad),fchaFormat asc
            `;

            // console.log('getDetalleMovimiento liquidacionControllers::',qDetalle);

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


async function getDetalleAbono(xidmovcaj)
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


async function getInfoPropietario(xncta)
{
    try {   

        let rs = await pool1.connect(); // Obtenemos la conexion     
            
        let q = `
                    Select nombrectacte as Nombre 
                    from cuentascorrientes
                    where codigo = ${xncta};
            `;

        let data = await pool1.query(q);

        let nombrePropietario = data.recordset[0].Nombre;

        return {
            status:true,
            nombrePropietario
        }

    } catch (err) {

        return {
            status: false,
            message: err.message
        };

    }
}


async function guardaIdCartolaCreado(xIds,xPeriodo)
{

    try {

        // console.log('guardaIdCartolaCreado -> REGISTROS xIds:',xIds);
        let valus = ' VALUES ';
        let coma = '';
        for(let row in xIds) { 

            (row == (xIds.length - 1))? coma = '':coma = ',';            
            valus += ` (getdate(), '${xPeriodo}',${xIds[row]['N° CUENTA']},${xIds[row].idmovcaj})${coma}`;
        }
    
        let rs = await pool1.connect(); // Obtenemos la conexion

        let qy = ` INSERT INTO tb_liquidacion_detalle (fecha,periodo,num_cuentacte,libro_idmovcaj) ${valus}`;

        let resp = await pool1.query(qy);

        return {
            status: true,
            message: 'Ejecución Correcta'
        }

    } catch (error) {

        console.log('ERROR guardaIdCartolaCreado ',error.message);
     
        return {
            status: false,
            message: error.message
        };

    }

}


async function guardaInfoPdfCreado(xusr,xncta,xop,xnamefile)
{
    try {   

        let rs = await pool1.connect(); // Obtenemos la conexion     
            
        let q = `Insert into tb_liquidacion_info_pdf_creado(
                    fecha,usuario,numero_cuenta_corriente,opcion_periodo,nombrearchivo,estado
                    ) 
                values(
                    getdate(),'${xusr }',${xncta},'${xop}','${xnamefile}',1
                );                                            
                SELECT SCOPE_IDENTITY() AS idInsert;
            `;

        let data = await pool1.query(q);

        let idRowPdfCreated = data.recordset[0].idInsert;

        return {
            status: true,
            idpdf: idRowPdfCreated
        }

    } catch (err) {

        return {
            status: false,
            message: err.message
        };

    }
}

/**
 * Informacion para comision de administracion
 * @param {*} xNumCuenta 
 * @returns 
 */
async function infoOrdenAdministracion(xNumCuenta)
{
    try {

        if(xNumCuenta != '' && parseInt(xNumCuenta) > 9999 )
        {
            let rs = await pool1.connect(); // Obtenemos la conexion     

            let qy = `
                Select top 1 cod_propietario, fecha_contrato,NCtaCte,duracion_contrato,porcentaje_comision,dia_liq
                from(
                    Select cod_propietario, fecha_contrato,NCtaCte,duracion_contrato,porcentaje_comision,dia_liq
                    from OrdenAdministracion oa
                    left join Detalle_OrdenAdminCtacte_NEW doac on oa.cod_contratoadm = doac.NOrden
                    where /*cod_propietario = '992890009123' */
                        NCtaCte =  ${xNumCuenta} and nulo = 'NO'

                    UNION ALL

                    Select cod_propietario,fecha_contrato,NCtaCte,duracion_contrato,por_comi,dia_liq 
                    from OrdenAdministracionAnexo oaa
                    left join Detalle_AnexoOrdAdm_CtaCte daod on oaa.id_anexo_contadm = daod.Id_AnexoOrdAdm
                    where /*cod_propietario = '992890009123' */
                        NCtaCte = ${xNumCuenta} and nulo = 'NO'
                ) ordenadmin
                order by fecha_contrato desc

            `;

            let data = await pool1.query(qy);

            return {
                status: true,
                message: 'Ejecución Correcta',
                data: data.recordset
            }
        }
        else 
        {
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

/**
 * Obtiene los movimientos de la cuenta corriente según el periodo enviado, para calculo de comisiones
 * Tipo Documentos : 
 * Arriendos, Multas, GGCC, Rebaja de Multas, Rebaja de arriendos, Anulación de Arriendos
 * @param {Numero de la cuenta corriente} numCuenta 
 * @param {Periodo de la liquidación} periodo 
 */
async function getInfoComision(numCuenta, periodo) {
    try {

        if (parseInt(numCuenta) > 9999) {
            let qFiltro = '';
            let qFiltroPeriodo = '';
            let rs = await pool1.connect(); // Obtenemos la conexion     
            if (periodo != 'init' && periodo != '') {

                qFiltro = ` in (
                    Select libro_idmovcaj from tb_liquidacion_detalle 
                    where num_cuentacte = ` + numCuenta + ` AND periodo = '` + periodo + `'
                )`;
            } else {
                qFiltro = ` not in (
                    Select libro_idmovcaj from tb_liquidacion_detalle 
                    where num_cuentacte = ` + numCuenta + ` 
                ) `;

                qFiltroPeriodo = ' AND l.estado = 0 AND l.fecha > getdate() -35 ';
            }

            let qDetalle = `
                SELECT TIPO, FECHA
                    ,   tm.id_mov
                    ,   case when GENERA = 'salida' then monto else 0 end as CARGO
                    ,   case when GENERA = 'entrada' then monto else 0 end as ABONO
                    ,   PRO.cod_propiedad
                
                FROM
                    (
                        SELECT  DISTINCT 'COMISION' as  TIPO, idmovcaj
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
                                WHERE nulo IS NULL AND codigo = ` + numCuenta + ` /*AND isnull(monto,0) > 0*/
                                            AND isnull(cod_arrendatario,0) != 0
                                            AND idmovcaj ` + qFiltro + ` AND isnull(cod_tipmovto,0) in (1,3,4,14,15,42)

                            ) as tmp_prop_arrend on l.cod_propiedad = tmp_prop_arrend.codpropiedad
                        WHERE nulo IS NULL AND l.codigo = ` + numCuenta + ` /*AND isnull(monto,0) > 0	*/
                            AND idmovcaj ` + qFiltro + ` AND isnull(l.cod_tipmovto,0) in (1,3,4,14,15,42)
                            ${ qFiltroPeriodo }
                    ) as tmp_libro_arren_propiet
                    INNER JOIN tipo_documento td ON cod_tipdocto = td.idtipdoc
                    LEFT JOIN tipo_movimiento tm ON cod_tipmovto = tm.id_mov
                    LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
                    LEFT JOIN arrendatario ARREN on ARREN.cod_arrendatario = tmp_libro_arren_propiet.cod_arrendatario
                WHERE case when GENERA = 'salida' then monto else 0 end  > 0 OR 
                    case when GENERA = 'entrada' then monto else 0 end > 0         
                
                    
                 UNION ALL
                 
                 
                Select 'COMISION' as TIPO
                    ,convert(varchar(10),l.fecha,105) as FECHA
                    ,case when tb_rend.api_id_tipo_item = 3 THEN 1
                        when tb_rend.api_id_tipo_item = 5 THEN 3 ELSE 0 END	as id_mov
                    ,case when l.genera = 'salida' then monto else 0 end as CARGO
                    ,case when l.genera = 'entrada' then monto else 0 end as ABONO
                    ,'' as cod_propiedad
                from libro_ctacte l 
                    left join tb_envista_api_rendicion tb_rend on l.idcomprobante = tb_rend.codigo_abono
                    left join tb_envista_relacion_proyecto_ctacte tb_relproyecto on tb_rend.api_Id_Proyecto = tb_relproyecto.nro_proyecto
                where tb_relproyecto.nro_cuenta_corriente = ${numCuenta}
                    AND tb_rend.id_estado_proceso = 14
                    AND l.idmovcaj ` + qFiltro + `                                
                    ${ qFiltroPeriodo }
                    
            `;

            // console.log('getInfoComision::',qDetalle);
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

/**
 * Porcentaje de comision por asesoria
 * @param {*} xNumCuenta 
 * @returns 
 */
async function getComisionAsesoria(xNumCuenta) {
    try {
        if(parseInt(xNumCuenta) > 0) {
            let rs = await pool1.connect(); // Obtenemos la conexion     
            let q = `
                Select nctacte,porcentaje_comision 
                from tb_comision_asesorias where 
                nctacte = ${xNumCuenta}
            `;

            let data = await pool1.query(q);

            return {
                status: true,
                message: 'Ejecución Correcta',
                data: data.recordset
            }
        }
        else {

            return {
                status: false,
                message: 'Parametros no válidos - getComisionAsesoria'
            }
        }        
        
    } catch (error) {
        return {
            status: false,
            message: error.message
        };
    }
}

async function getTotalCargos_TotalAbonos(xNumCta,xPeriodo)
{
    try {

        if(parseInt(xNumCta) > 0) {
            let fCuenta = ` and codigo = ${xNumCta} `;
            let fPeriodo = '';
            if (xPeriodo != 'init' && xPeriodo != '') {

                fPeriodo = ` and idmovcaj in (
                    Select libro_idmovcaj from tb_liquidacion_detalle 
                    where num_cuentacte = ${xNumCta} AND periodo = '` + xPeriodo + `'
                )`;

            } else {

                fPeriodo = ` and idmovcaj not in (
                    Select libro_idmovcaj from tb_liquidacion_detalle 
                    where num_cuentacte = ${xNumCta} 
                ) `;
                
            }

            let rs = await pool1.connect(); // Obtenemos la conexion     
            let q = `
                Select top 1 codigo,sum(entrada) entr,sum(salida) sal
                from(
                    Select codigo,case when genera = 'entrada' then sum(isnull(monto,0)) else 0 end as entrada,
                    case when genera = 'salida' then sum(isnull(monto,0)) else 0 end as salida
                    from libro_ctacte 
                    where estado = 0
                        and isnull(nulo,'') = '' 
                        and fecha > GETDATE() -35
                        and cod_tipmovto not in (6,7,11,17,18,19,22,23,30,41,24,25,26,27,39,40)
                        ${fCuenta}
                        ${fPeriodo}
                    group by genera,codigo
                    ) tm
                group by codigo            
                union all 
                Select ${xNumCta} as codigo,0 entr,0 sal
            `;

            // console.log('getTotalCargos_TotalAbonos :',q);
            let data = await pool1.query(q);

            return {
                status: true,
                message: 'Ejecución Correcta',
                data: data.recordset
            }
        }
        else 
        {

            return {
                status: false,
                message: 'Parametros no válidos'
            }
        }        
        
    } catch (error) {
        return {
            status: false,
            message: error.message
        };
    }
}


/**
 * Calculo de comision de administración, de acuerdo a las reglas de las cuentas corrientes.
 * @param {Numero de la cuenta corriente} numCta 
 * @param {Periodo de la liquidación} periodo 
 */
async function calculoComision(numCta, periodo) {
    try {        

        //PORCENTAJE COMISION ADMINISTRACION 
        const dOrdenAdmin = await infoOrdenAdministracion(numCta);          
        const dComision = await getInfoComision(numCta,periodo);

        let propSanCamilo;
        const porcentComisionAsesoria = await getComisionAsesoria(numCta);

        let codPropiedadSanCamilo = [];
        if(parseInt(numCta) == 10203) {
            propSanCamilo = await getPropiedadesArrendadasXSanCamilo();

            if(propSanCamilo.status) {

                for (let z = 0; z < propSanCamilo.data.length; z++) {

                    codPropiedadSanCamilo.push(propSanCamilo.data[z].cod_propiedad);                    
                }
            }
        }

        let totalComision = 0;
        let totalComisionAsesoria = 0;
        let calcComision = 0;
        let totalCargos = 0;
        let porcentComision = 0;
        let resultOAD = null;

        if(dOrdenAdmin.status) {
            resultOAD = dOrdenAdmin.data;

            /** CALCULO DE COMISION */            
            for (let i = 0; i < resultOAD.length; i++) {
                porcentComision = parseInt(resultOAD[i].porcentaje_comision);
            }
            
            if(dComision.status) {                
                
                for (let i = 0; i < dComision.data.length; i++) {

                    /**SANTO DOMINGO */
                    if(numCta == 10296) { 
                        /**1:arriendos, 3:multas, 4:ggcc, 14:Rebaja de Arriendos, 15:Rebaja de Multas, 42:Anulacion Arriendos.  */
                        if( dComision.data[i].id_mov == 1 || 
                            dComision.data[i].id_mov == 3 || 
                            dComision.data[i].id_mov == 4 || 
                            dComision.data[i].id_mov == 14 || 
                            dComision.data[i].id_mov == 15 ||
                            dComision.data[i].id_mov == 43 || 
                            dComision.data[i].id_mov == 42
                            ) {
                            calcComision += parseInt(dComision.data[i].ABONO);
                            totalCargos += parseInt(dComision.data[i].CARGO);
                        }

                    }
                    else if(numCta == 10203) 
                    {
                        /** CUENTA PACIFICO */
                        if(propSanCamilo.status) {

                            /*  1:Arriendos, 3:Multas, 14:Rebaja de Arriendos, 15:Rebaja de Multas , 42:Anulacion Arriendos.*/
                            if(dComision.data[i].id_mov == 1 || 
                                dComision.data[i].id_mov == 3 || 
                                dComision.data[i].id_mov == 14 || 
                                dComision.data[i].id_mov == 15 ||
                                dComision.data[i].id_mov == 43 || 
                                dComision.data[i].id_mov == 42 ) {

                                /**VERIFICAMOS QUE LA PROPIEDAD NO SEA ARRENDADA POR SAN CAMILO...  */
                                if(!codPropiedadSanCamilo.includes(dComision.data[i].cod_propiedad)) {
                                    calcComision += parseInt(dComision.data[i].ABONO);

                                    totalCargos += parseInt(dComision.data[i].CARGO);
                                }
                            }
                        }
                    }
                    else 
                    {
                        /**
                         * CALCULO COMISION TODAS LAS CUENTAS...
                         *  1:Arriendos, 3:Multas, 14:Rebaja de Arriendos, 15:Rebaja de Multas, 42:Anulacion Arriendos.*/
                        if(dComision.data[i].id_mov == 1 || 
                            dComision.data[i].id_mov == 3 || 
                            dComision.data[i].id_mov == 14 || 
                            dComision.data[i].id_mov == 15 || 
                            dComision.data[i].id_mov == 43 || 
                            dComision.data[i].id_mov == 42 ) {

                            calcComision += parseInt(dComision.data[i].ABONO);
                            totalCargos += parseInt(dComision.data[i].CARGO);
                        }
                    }
                }

                if(parseInt(porcentComisionAsesoria.data.length) > 0) {
                    totalComisionAsesoria = ((parseInt(porcentComisionAsesoria.data[0].porcentaje_comision) / 100) * (calcComision - totalCargos)).toFixed(0);
                }

                //Calculamos el porcentaje de Comision
                totalComision = ((porcentComision / 100) * (calcComision - totalCargos));
                
                //Calculamos y Sumamos el IVA 19%                
                totalComision = (totalComision + ((19 / 100) * totalComision)).toFixed(0);
            
            }
        }

        let porcentComiAsesoria = 0;        
        if(porcentComisionAsesoria.data.length > 0) {
            porcentComiAsesoria = porcentComisionAsesoria.data[0].porcentaje_comision;
        }
        
        return {
            status : true,
            resultOAD,
            totalComision,
            porcentComision,
            totalcomisionasesoria: totalComisionAsesoria,
            porcentComiAsesoria
        }

    } catch (error) {
        return {
            status : false,
            message: error.message
        }
    }
}

/** RETORNA PROPIEDADES DEL CLIENTE PACIFICO(SAN CAMILO), ARRENDADAS POR ELLOS MISMOS */
async function getPropiedadesArrendadasXSanCamilo()
{
    try {
        
        let rs = await pool1.connect(); // Obtenemos la conexion

        let qy = `
            Select distinct arrend.cod_arrendatario,cod_contrato,ar.estado,pro.cod_propiedad,pro.cod_propietario
            From DetalleContratoArren dca
                left join propiedad pro on dca.cod_propiedad = pro.cod_propiedad
                left join arriendocontrato ar on ar.cod_contrato = dca.ncontrato
                left join arrendatario arrend on arrend.cod_arrendatario = ar.cod_arrendatario
            Where codigo = 10203 and ar.estado = 'vigente' 
                AND arrend.cod_arrendatario = '9203500022'
                AND pro.cod_propietario = '8988150048'
        `;

        let data = await pool1.query(qy);

        return {
            status: true,
            message: 'Ejecución Correcta',
            data: data.recordset
        }        

    } catch (err) {

        return {
            status: false,
            message: err.message
        };

    }
}

/**
 * Calcula los montos por concepto de comisión administración y asesorias
 * @param {Numero de cuenta corriente} xncuenta 
 * @param {Periodo de calculo de la comision} periodo 
 */
async function comisiones_por_ctacte_periodoactual(xncuenta,periodo) {
    try {

        let rs = await pool1.connect(); // Obtenemos la conexion
        let filter = '';
        let filPeriodo = '';
        let qFiltroPeriodo = '';
        let fctacte = '';
        if(xncuenta !== 0) {
            filter = ` AND l.codigo = ${ xncuenta } `;
            fctacte = ` AND NCtaCte = ${ xncuenta } `;
        }
        
        if(periodo != 'init' && periodo != '') {
            filPeriodo = `
                AND idmovcaj in (
                    Select libro_idmovcaj from tb_liquidacion_detalle 
                    where periodo = '${periodo}' and num_cuentacte = ${xncuenta}
                )  
            `;
        }
        else
        {
            filPeriodo = `
                AND idmovcaj not in (
                    Select libro_idmovcaj from tb_liquidacion_detalle                    
                )  
            `;

            qFiltroPeriodo = ' AND l.estado = 0 AND l.fecha > getdate() -35';
        }

        let qy = `

            SELECT NCtaCte codigo
                --,SUM(isnull(CARGO,0)) as TOTALCARGO
                --,SUM(isnull(ABONO,0)) as TOTALABONO
                ,SUM(isnull(CARGO,0)) + ISNULL(sal,0) + ISNULL(abonosEnvista.salENV,0) as TOTALCARGO
                ,SUM(isnull(ABONO,0)) + ISNULL(ent,0) + ISNULL(abonosEnvista.entEnv,0) as TOTALABONO
                ,(SUM(ISNULL(ABONO,0) ) + ISNULL(abonosEnvista.entEnv,0) + ISNULL(ent,0)) - (SUM(ISNULL(CARGO,0) )  + ISNULL(sal,0)) as montoaliq
                ,ISNULL(comision_admin.por_comision,0) as comi_admin
                ,ISNULL(CAST(
                                (comision_admin.por_comision * ( SUM(ISNULL(ABONO,0)) +ISNULL(abonosEnvista.entEnv,0) - SUM(isnull(CARGO,0))) /100) 
                                    + 
                                (19 * (comision_admin.por_comision * ( SUM(ISNULL(ABONO,0)) + ISNULL(abonosEnvista.entEnv,0) - SUM(isnull(CARGO,0))) /100) /100)
                    as decimal(18,0)),0
                ) as total_comi_adm

                , isnull(porcentaje_comision,0) as comi_asesor
                ,ISNULL(CAST(CASE WHEN isnull(porcentaje_comision,0) != 0
                        THEN
                            (porcentaje_comision * ( SUM(ISNULL(ABONO,0)) -SUM(isnull(CARGO,0))) /100)
                        ELSE 0 END as decimal(18,0)),0) AS total_comi_asesor

            FROM (
                SELECT TIPO
                    ,   PRO.codigo
                    ,   FECHA
                    ,   tm.id_mov
                    ,   ISNULL(tm.nom_mov,'') as DESCRIPCION
                    ,   case when GENERA = 'salida' then monto else 0 end as CARGO
                    ,   case when GENERA = 'entrada' then monto else 0 end as ABONO
                    ,   PRO.cod_propiedad
                    ,   idmovcaj
                FROM
                    (

                    --############################
                        SELECT  DISTINCT 'COMISION' as  TIPO, idmovcaj
                            , l.cod_propiedad, l.monto, l.genera as GENERA, l.codigo, convert(varchar(10),l.fecha,105) as FECHA,l.fecha as fchaFormat
                            ,l.glosa
                            ,l.n_recibo as numRecibo
                            ,l.cod_tipdocto,l.cod_tipmovto
                        FROM libro_ctacte l
                        left join tb_envista_api_rendicion tbapi_rend on l.idcomprobante = tbapi_rend.codigo_abono
                        WHERE nulo IS NULL
                            ${ qFiltroPeriodo }
                            ${ filPeriodo }
                            AND (isnull(l.cod_tipmovto,0) in (1,3,14,15,42,43) or tbapi_rend.api_id_tipo_item in(3,5))
                            AND l.cod_propiedad not in (
                                /*PROPIEDADES SAN CAMILO*/
                                Select pro.cod_propiedad
                                From DetalleContratoArren dca
                                    left join propiedad pro on dca.cod_propiedad = pro.cod_propiedad
                                    left join arriendocontrato ar on ar.cod_contrato = dca.ncontrato
                                    left join arrendatario arrend on arrend.cod_arrendatario = ar.cod_arrendatario
                                Where codigo = 10203 and ar.estado = 'vigente'
                                    AND arrend.cod_arrendatario = '9203500022'
                                    AND pro.cod_propietario = '8988150048'
                            )

                            ${ filter }

        --############################
                    ) as tmp_libro_arren_propiet
                    INNER JOIN tipo_documento td ON cod_tipdocto = td.idtipdoc
                    LEFT JOIN tipo_movimiento tm ON cod_tipmovto = tm.id_mov
                    LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
                WHERE case when GENERA = 'salida' then monto else 0 end  > 0 OR
                    case when GENERA = 'entrada' then monto else 0 end > 0

            ) as DP
            right join (

                Select NCtaCte,fc_contrato,por_comision,dialiq
                from(
                    Select distinct oa.NCtaCte,
                        CASE WHEN oaa.fecha_contrato IS NULL THEN oa.fecha_contrato ELSE oaa.fecha_contrato END AS fc_contrato
                        ,CASE WHEN oaa.fecha_contrato IS NULL THEN oa.porcentaje_comision ELSE oaa.por_comi END AS por_comision
                        ,CASE WHEN oaa.fecha_contrato IS NULL THEN oa.dia_liq ELSE oaa.dia_liq END AS dialiq
                    from (
                        Select cod_propietario, fecha_contrato,NCtaCte,duracion_contrato,porcentaje_comision,dia_liq
                        from OrdenAdministracion oa
                            left join Detalle_OrdenAdminCtacte_NEW doac on oa.cod_contratoadm = doac.NOrden
                        where nulo = 'NO'
                    ) oa
                    left join (
                            Select id_anexo_contadm,cod_propietario,fecha_contrato,daod.NCtaCte,duracion_contrato,por_comi,dia_liq
                                from OrdenAdministracionAnexo oaa
                                    left join Detalle_AnexoOrdAdm_CtaCte daod on oaa.id_anexo_contadm = daod.Id_AnexoOrdAdm
                                    inner join(
                                        Select max(id_anexo_contadm) id,daod.NCtaCte
                                        from OrdenAdministracionAnexo oaa
                                            left join Detalle_AnexoOrdAdm_CtaCte daod on oaa.id_anexo_contadm = daod.Id_AnexoOrdAdm
                                        where nulo = 'NO'
                                        group by daod.NCtaCte
                                    ) tmp on tmp.id = id_anexo_contadm and tmp.NCtaCte = daod.NCtaCte
                                where nulo = 'NO'
                    ) oaa on oa.NCtaCte = oaa.NCtaCte
                ) as tmp
                where isnull(NCtaCte,0) != 0
                    ${fctacte}
            )as comision_admin on DP.codigo = comision_admin.NCtaCte
            left join tb_comision_asesorias on comision_admin.NCtaCte= nctacte
            left join (
                            Select codigo,sum(ent) ent, sum(sal)sal
                            from(
                                    SELECT
                                            --, idmovcaj, l.cod_propiedad, convert(varchar(10),l.fecha,105) as FECHA,l.fecha as fchaFormat,l.glosa,l.n_recibo as numRecibo,l.cod_tipdocto,l.cod_tipmovto
                                            l.codigo
                                            ,CASE WHEN l.genera = 'entrada' THEN SUM(ISNULL(monto,0)) ELSE 0 END as ent
                                            ,CASE WHEN l.genera = 'salida' THEN SUM(ISNULL(monto,0)) ELSE 0 END as sal
                                    FROM libro_ctacte l										
                                    WHERE nulo IS NULL
                                            AND l.estado = 0 AND l.fecha > getdate() -35
                                            AND idmovcaj not in (
                                                    Select libro_idmovcaj from tb_liquidacion_detalle
                                            )                                                        
                                            AND isnull(l.cod_tipmovto,0) in (1,3,14,15,42,43) 
                                            ${filter}
                                    GROUP BY l.codigo,l.genera
                            ) tmps
                            GROUP BY codigo
                        ) otrosDescuentos on otrosDescuentos.codigo = comision_admin.NCtaCte
                left join (
                        SELECT l.codigo ctacte
                                ,CASE WHEN l.genera = 'entrada' THEN SUM(ISNULL(monto,0)) ELSE 0 END as entEnv
                                ,CASE WHEN l.genera = 'salida' THEN SUM(ISNULL(monto,0)) ELSE 0 END as salENV
                        FROM libro_ctacte l
                            left join tb_envista_api_rendicion tbapi_rend on l.idcomprobante = tbapi_rend.codigo_abono
                        WHERE tbapi_rend.api_id_tipo_item in(3,5)
                            AND l.codigo = 10315
                        GROUP BY l.codigo,l.genera
                ) abonosEnvista on comision_admin.NCtaCte = abonosEnvista.ctacte

            where NCtaCte is not null
            GROUP BY NCtaCte,comision_admin.por_comision,porcentaje_comision,sal,ent,entEnv,salENV
            ORDER BY NCtaCte
            
        `;
                   
        // SELECT NCtaCte codigo
            //     --,SUM(isnull(CARGO,0)) as TOTALCARGO
            //     --,SUM(isnull(ABONO,0)) as TOTALABONO
            //     ,SUM(isnull(CARGO,0)) + sal as TOTALCARGO
            //     ,SUM(isnull(ABONO,0)) + ent as TOTALABONO
            //     ,(SUM(ISNULL(ABONO,0) ) + ent) - (SUM(ISNULL(CARGO,0) )  + sal) as montoaliq
            //     ,ISNULL(comision_admin.por_comision,0) as comi_admin
            //     ,ISNULL(CAST(
            //         (comision_admin.por_comision * ( SUM(ISNULL(ABONO,0)) -SUM(isnull(CARGO,0))) /100) + (19 * (comision_admin.por_comision * ( SUM(ISNULL(ABONO,0)) -SUM(isnull(CARGO,0))) /100) /100)
            //     as decimal(18,0)),0) as total_comi_adm
            //     , isnull(porcentaje_comision,0) as comi_asesor
            //     ,ISNULL(CAST(CASE WHEN isnull(porcentaje_comision,0) != 0
            //             THEN
            //                 (porcentaje_comision * ( SUM(ISNULL(ABONO,0)) -SUM(isnull(CARGO,0))) /100)
            //             ELSE 0 END as decimal(18,0)),0) AS total_comi_asesor
            
            // FROM (
            //     SELECT TIPO
            //         ,   PRO.codigo
            //         ,   FECHA
            //         ,   tm.id_mov
            //         ,   ISNULL(tm.nom_mov,'') as DESCRIPCION
            //         ,   case when GENERA = 'salida' then monto else 0 end as CARGO
            //         ,   case when GENERA = 'entrada' then monto else 0 end as ABONO
            //         ,   PRO.cod_propiedad
            //         ,   idmovcaj
            //     FROM
            //         (
            //             SELECT  DISTINCT 'COMISION' as  TIPO, idmovcaj
            //                 , l.cod_propiedad, l.monto, l.genera as GENERA, l.codigo, convert(varchar(10),l.fecha,105) as FECHA,l.fecha as fchaFormat
            //                 ,l.glosa
            //                 ,l.n_recibo as numRecibo
            //                 ,l.cod_tipdocto,l.cod_tipmovto
            //             FROM libro_ctacte l
            //             WHERE nulo IS NULL                             
            //                 ${ qFiltroPeriodo }
            //                 ${ filPeriodo }
            //                 AND (isnull(l.cod_tipmovto,0) in (1,3,14,15,42,43))
            //                 AND l.cod_propiedad not in (
            //                     /*PROPIEDADES SAN CAMILO*/
            //                     Select pro.cod_propiedad
            //                     From DetalleContratoArren dca
            //                         left join propiedad pro on dca.cod_propiedad = pro.cod_propiedad
            //                         left join arriendocontrato ar on ar.cod_contrato = dca.ncontrato
            //                         left join arrendatario arrend on arrend.cod_arrendatario = ar.cod_arrendatario
            //                     Where codigo = 10203 and ar.estado = 'vigente'
            //                         AND arrend.cod_arrendatario = '9203500022'
            //                         AND pro.cod_propietario = '8988150048'
            //                 )                            
            //                 ${ filter }                                
            //         ) as tmp_libro_arren_propiet
            //         INNER JOIN tipo_documento td ON cod_tipdocto = td.idtipdoc
            //         LEFT JOIN tipo_movimiento tm ON cod_tipmovto = tm.id_mov
            //         LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
            //     WHERE case when GENERA = 'salida' then monto else 0 end  > 0 OR
            //         case when GENERA = 'entrada' then monto else 0 end > 0
            
            // ) as DP
            // right join (
            
            //     Select NCtaCte,fc_contrato,por_comision,dialiq
            //     from(
            //         Select distinct oa.NCtaCte,
            //             CASE WHEN oaa.fecha_contrato IS NULL THEN oa.fecha_contrato ELSE oaa.fecha_contrato END AS fc_contrato
            //             ,CASE WHEN oaa.fecha_contrato IS NULL THEN oa.porcentaje_comision ELSE oaa.por_comi END AS por_comision
            //             ,CASE WHEN oaa.fecha_contrato IS NULL THEN oa.dia_liq ELSE oaa.dia_liq END AS dialiq
            //         from (
            //             Select cod_propietario, fecha_contrato,NCtaCte,duracion_contrato,porcentaje_comision,dia_liq
            //             from OrdenAdministracion oa
            //                 left join Detalle_OrdenAdminCtacte_NEW doac on oa.cod_contratoadm = doac.NOrden
            //             where nulo = 'NO'
            //         ) oa
            //         left join (
            //                 Select id_anexo_contadm,cod_propietario,fecha_contrato,daod.NCtaCte,duracion_contrato,por_comi,dia_liq
            //                     from OrdenAdministracionAnexo oaa
            //                         left join Detalle_AnexoOrdAdm_CtaCte daod on oaa.id_anexo_contadm = daod.Id_AnexoOrdAdm
            //                         inner join(
            //                             Select max(id_anexo_contadm) id,daod.NCtaCte
            //                             from OrdenAdministracionAnexo oaa
            //                                 left join Detalle_AnexoOrdAdm_CtaCte daod on oaa.id_anexo_contadm = daod.Id_AnexoOrdAdm
            //                             where nulo = 'NO'
            //                             group by daod.NCtaCte
            //                         ) tmp on tmp.id = id_anexo_contadm and tmp.NCtaCte = daod.NCtaCte
            //                     where nulo = 'NO'
            //         ) oaa on oa.NCtaCte = oaa.NCtaCte
            //     ) as tmp
            //     where isnull(NCtaCte,0) != 0
            //     ${fctacte}
            // )as comision_admin on DP.codigo = comision_admin.NCtaCte
            // left join tb_comision_asesorias on comision_admin.NCtaCte= nctacte
            // left join (
			// 	Select codigo,sum(ent) ent, sum(sal)sal
			// 	from(
			// 		SELECT  
			// 			--, idmovcaj, l.cod_propiedad, convert(varchar(10),l.fecha,105) as FECHA,l.fecha as fchaFormat,l.glosa,l.n_recibo as numRecibo,l.cod_tipdocto,l.cod_tipmovto
			// 			l.codigo
			// 			,CASE WHEN l.genera = 'entrada' THEN SUM(ISNULL(monto,0)) ELSE 0 END as ent		
			// 			,CASE WHEN l.genera = 'salida' THEN SUM(ISNULL(monto,0)) ELSE 0 END as sal
			// 		FROM libro_ctacte l
			// 		WHERE nulo IS NULL
			// 				AND l.estado = 0 AND l.fecha > getdate() -35
			// 			AND idmovcaj not in (
			// 				Select libro_idmovcaj from tb_liquidacion_detalle
			// 			)
			// 			AND isnull(l.cod_tipmovto,0)not in (1,3,14,15,42,43,38,39,6)
			// 			${filter}	
			// 			GROUP BY l.codigo,l.genera
			// 	) tmps
			// 	GROUP BY codigo
			// ) otrosDescuentos on otrosDescuentos.codigo = comision_admin.NCtaCte

            // where NCtaCte is not null
            // GROUP BY NCtaCte,comision_admin.por_comision,porcentaje_comision,sal,ent
            // ORDER BY NCtaCte


        // console.log('qy:::',qy);
        let data = await pool1.query(qy);

        return {
            status: true,
            message: 'Ejecución Correcta',
            data: data.recordset
        }

    } catch (error) {
        return {
            status :false,
            message : error.message            
        }
    }
}


async function getCtacte_Config_AcumSaldo(xNumCuenta)
{
    try {
        if(parseInt(xNumCuenta) !== 0) {        

            let rs = await pool1.connect(); // Obtenemos la conexion
            let qy = `
                select id,num_ctacte,acumula_saldo
                from tb_config_cartola_ctacte
                where num_ctacte = ${xNumCuenta } ;
            `;

            let data = await pool1.query(qy);

            return {
                status: true,
                message: 'Ejecución Correcta',
                data: data.recordset
            }

        } else {

            return {
                status: false,
                message: 'Parametro no válido...'
            }

        }

    } catch (error) {
        return {
            status :false,
            message : error.message            
        }
    }
}

/**
 * Guarda opcion para acumular saldo en cuenta corriente.
 * @param {*} req 
 * @param {*} res 
 */
async function saveConfigSaldoAcum(req,res)
{
    try {
        
        let xNumCta = req.body.xCtaSelec;
        let xConfigSaldoAcum = req.body.acumSal;
        

        if(parseInt(xNumCta) !== 0) {        
            let rs = await pool1.connect(); // Obtenemos la conexion
            let qy = `
                    select id,num_ctacte,acumula_saldo
                    from tb_config_cartola_ctacte
                    where num_ctacte = ${xNumCta } ;
                `;

            let data = await pool1.query(qy);
            let queryAc = '';
            if(data.recordset.length > 0) {
                queryAc = `
                    UPDATE tb_config_cartola_ctacte 
                    SET acumula_saldo = ${ xConfigSaldoAcum }
                    WHERE num_ctacte = ${xNumCta };
                `;
            } else {
                
                queryAc = `
                    INSERT INTO tb_config_cartola_ctacte(fecha,num_ctacte,acumula_saldo) 
                    VALUES(getdate(),${xNumCta},${ xConfigSaldoAcum });                    
                `;

            }

            let rss = await pool1.connect(); // Obtenemos la conexion

            let respAcum = await pool1.query(queryAc);

            // let rs = await pool1.connect(); // Obtenemos la conexion
            // let qy = `
            //     select id,num_ctacte,acumula_saldo
            //     from tb_config_cartola_ctacte
            //     where num_ctacte = ${xNumCuenta } ;
            // `;

            // let data = await pool1.query(qy);

            return res.json({
                status: true,
                message: 'Ejecución Correcta'
            }) ;

        } else {

            return res.json({
                status :false,
                message : 'Parámetros no válidos!'
            }) ;

        }

    } catch (error) {
        return res.json({
            status :false,
            message : error.message
        }) ;
        
    }
}


async function getInfoCtaCte(xnumcta,xDiaLiq) {
    try {

        let filter = '';
        let filterDia = '';
        if(parseInt(xnumcta) > 0) {
            filter = ` and oad.nctacte = ${xnumcta}`;
        }

        if(xDiaLiq != 0) {
            filterDia = ` and dia_liq = ${xDiaLiq} `;
        }

        let rs = await pool1.connect(); // Obtenemos la conexion
        
        let qy = `
            Select oad.nctacte as numcta
                ,cod_propietario
                ,isnull(id_ejecutiva,0) idejectiva
                ,isnull(nom_ejecutiva,'') as nomejecuti
                ,oad.porcentaje_comision as comi_admin
                ,dia_liq 
                ,duracion_contrato
                ,isnull(tb_asesoria.porcentaje_comision,0) as comi_asesoria
            from [udf_UltimaOrdenAnexoAdmTabla](0) oad 
            left join tb_comision_asesorias tb_asesoria on oad.nctacte = tb_asesoria.nctacte
            where isnull(oad.nctacte,'') != '' 
            ${filter}
                ${filterDia}
            order by oad.nctacte         
        `;


     /*   let qy = `
                Select id_anexo_contadm,cod_propietario
                    ,fecha_contrato
                    ,daod.NCtaCte as numcta
                    ,isnull(ej.nom_real,'') as nomejecuti
                    ,duracion_contrato
                    ,por_comi as comi_admin
                    ,isnull(porcentaje_comision,0) as comi_asesoria
                    ,dia_liq
                from OrdenAdministracionAnexo oaa
                    left join Detalle_AnexoOrdAdm_CtaCte daod on oaa.id_anexo_contadm = daod.Id_AnexoOrdAdm
                    inner join(
                        Select max(id_anexo_contadm) id,daod.NCtaCte
                        from OrdenAdministracionAnexo oaa
                            left join Detalle_AnexoOrdAdm_CtaCte daod on oaa.id_anexo_contadm = daod.Id_AnexoOrdAdm
                        where nulo = 'NO'
                        group by daod.NCtaCte
                    ) tmp on tmp.id = id_anexo_contadm and tmp.NCtaCte = daod.NCtaCte
                    left join (
                        Select * from ejecutiva where estado_ej ='activo'
                    ) ej on id_ejecutiva = ej.cod_ejecutiva
                    left join tb_comision_asesorias on daod.NCtaCte = nctacte
                where nulo = 'NO'
                ${filter}
                ${filterDia}
                order by daod.NCtaCte
        `;
        */
// console.log('qy::',qy);
        let data = await pool1.query(qy);

        return {
            status :true,
            message : 'Correcto',
            data : data.recordset
        }

    } catch (error) {
        return {
            status :false,
            message : error.message
        }
    }
}


async function preparamosInfo_VistaComisionPorCuenta(numCuenta)
{
    try {
        let resultComision = [];
        let dataGBFormat = await calculoComision(numCuenta,''); 
        let sumaCargosAbonos = await getTotalCargos_TotalAbonos(numCuenta,'');      

        let totalCargosMenosAbonos = parseInt(sumaCargosAbonos.data[0].entr) - parseInt(sumaCargosAbonos.data[0].sal);
        let montoComisionAdmin = dataGBFormat.totalComision;
        let montoComisionAsesoria = dataGBFormat.totalcomisionasesoria;

        let montoaliquidar = parseInt(totalCargosMenosAbonos - montoComisionAdmin - montoComisionAsesoria);

        resultComision.push({ 'id_mov':6,'MOV':'Comisión Administración','MONTO':dataGBFormat.totalComision  });
        resultComision.push({ 'id_mov':41,'MOV':'Comisión Asesoria','MONTO':dataGBFormat.totalcomisionasesoria  });
        resultComision.push({ 'id_mov':17,'MOV':'Liquidación','MONTO':montoaliquidar });
        resultComision.push({ 'id_mov':999,'MOV':'abonototal','MONTO':sumaCargosAbonos.data[0].entr });
        resultComision.push({ 'id_mov':998,'MOV':'cargototal','MONTO':sumaCargosAbonos.data[0].sal });
        

        return {
            status:true,
            xdataGastoComisionLiquida: resultComision
        }

    } catch (error) {

        console.log('preparamosInfo_VistaComisionPorCuenta::',error.message);
        return {
            status : false,
            message : 'Problemas con la información.'
        }
    }

    
}


async function comisionCtaCte_PorDiaLiquidacion(xFecha) {
    try {
         
        let dataInfo;
        let dataCuenta = [];

        if(parseInt(xFecha) !== 0 && xFecha !== '') {

            dataInfo = await getInfoCtaCte(0,xFecha);
            // console.log('dataInfo:::',dataInfo);
            if(dataInfo.status) {
                
                for(let arr in dataInfo.data) {

                    let data = await preparamosInfo_VistaComisionPorCuenta(parseInt(dataInfo.data[arr].numcta));                    

                    dataCuenta.push({'numcta':dataInfo.data[arr].numcta
                        ,'comi_admin':dataInfo.data[arr].comi_admin
                        ,'montoadmin':data.xdataGastoComisionLiquida[0].MONTO
                        ,'comi_asesoria':dataInfo.data[arr].comi_asesoria
                        ,'montoasesoria':data.xdataGastoComisionLiquida[1].MONTO
                        ,'montoliq' :data.xdataGastoComisionLiquida[2].MONTO
                        ,'abonototal' :data.xdataGastoComisionLiquida[3].MONTO
                        ,'cargototal' :data.xdataGastoComisionLiquida[4].MONTO
                    });

                }

                return {
                    status :true,
                    data: dataCuenta
                }
            }
            else 
            {
                return {
                    status :false,
                    message : 'Problemas al preparar la información.'
                }   
            }            
        }
        else
        {
            return {
                status :true,
                data: 'Falta el parametro'
            }
        }

    } catch (error) {

        return {
            status : false,
            message : error.message
        }
        
    }
}


async function getDataVista_ComisionPorCuenta(req,res) {

    ssn = req.session;
    let { xDiaLiquidacion } = req.query;
    if(xDiaLiquidacion !== '') {
        let rsp = await comisionCtaCte_PorDiaLiquidacion(xDiaLiquidacion);
        if(rsp.status) {

            return res.json({
                status: true,
                data:rsp.data,
                nombreus : ssn.nombre
            });
        }
        else 
        {

            return res.json({
                status: false,
                data:'Problemas al obtener la información, contacte a su administrador del sistema.',
                nombreus : ssn.nombre
            });

        }
    }
    else
    {
        return res.json({
            status: false,
            data:'Falta el periodo de búsqueda, actualice la página e intente nuevamente.',
            nombreus : ssn.nombre
        });

    }
    
}


/**
 * ####################################################################
 * 
 *  COMPROBANTES CARGOS / ABONOS
 * 
 * ####################################################################
 */
///  CARGOS
async function saveCargos(xNumCuenta,xMonto,xCodMovto,xGlosa ) {
    try {
           
        moment.locale('es');
        let val = numpalabra(xMonto.toString());
        let montoPalabra = val.toUpperCase()+' PESOS';
        let fechaNow = moment().format('YYYY-MM-DD');
        let horaNow = moment().format('HH:mm:ss');        
        
        let nombreCuentaCorriente = await getInfoPropietario(xNumCuenta);        
        let nombreCuenta = nombreCuentaCorriente.nombrePropietario;        
        
        let pool2 = await mssql.connect(database);
        let result2 = await pool2.request()
            .input('codigo', mssql.Int, xNumCuenta)
            .input('cod_propiedad', mssql.VarChar(50), '')
            .input('cod_movto', mssql.Int, xCodMovto)
            .input('paguesea', mssql.VarChar(150), nombreCuenta)
            .input('monto', mssql.Int, xMonto)
            .input('glosa', mssql.VarChar(500), xGlosa)
            .input('hecho_x', mssql.VarChar(50), 'Administrador')
            .input('autor', mssql.VarChar(50), '')
            .input('fecha', mssql.DateTime, fechaNow)
            .input('impreso', mssql.VarChar(50), 'SI')
            .input('saldoctacte', mssql.VarChar(50), '')
            .input('mon_palabras', mssql.VarChar(100), montoPalabra)
            .input('id_usuario', mssql.Int, 77)
            .input('fecha_user', mssql.DateTime, fechaNow)
            .input('hora_user', mssql.VarChar(50),horaNow )
            .input('accion_usuario', mssql.VarChar(50), 'ins')
        .execute('CargoCtaCte_Guardar')

        let nReg = result2.recordset[0].NREG;
        let respp = await updateCodBar_CargoxLiquidacion(nReg);        

        return {
            status:true,
            message : 'Ejecucion correcta',
            idcargo : nReg
        }

    } catch (error) {

        return {
            status:false,
            message : error.message
        }
        
    }
}


async function updateCodBar_CargoxLiquidacion(xIdCod) {
    try {
        
        if(parseInt(xIdCod) !== 0) 
        {
            let rs = await pool1.connect(); // Obtenemos la conexion
            let codbar = `C${xIdCod}C`;
            let queryAc = `
                    UPDATE comp_cargos 
                    SET cdbar = '${codbar}'
                    WHERE idcargo = ${xIdCod};
                `;

            let respAcum = await pool1.query(queryAc);

            return {
                status: true,
                message: 'Ejecución Correcta'
            }

        } else {

            return {
                status :false,
                message : 'Parámetros no válidos!'
            }

        }

    } catch (error) {

        return {
            status :false,
            message : error.message
        }
        
    }
}


async function getCargos(idCargo) {
    try {
        
        if(parseInt(idCargo) !== 0) 
        {
            let rs = await pool1.connect(); // Obtenemos la conexion
            
            let queryAc = `
                    Select * from comp_cargos                     
                    WHERE idcargo = ${idCargo};
                `;

            let resp = await pool1.query(queryAc);

            return {
                status: true,
                message: 'Ejecución Correcta',
                data:resp.recordset
            }

        } else {

            return {
                status :false,
                message : 'Parámetros no válidos!'
            }

        }


    } catch (error) {

        return {
            status : false,
            message: error.message
        }
    }
}


///  ABONOS
/**
 * Guarda abonos
 * @param {*} xNumCuenta 
 * @param {*} xMonto 
 * @param {*} xCodMovto 
 * @param {*} xGlosa 
 */
async function saveAbonos(xNumCuenta,xMonto,xCodMovto,xGlosa ) {
    try {

        moment.locale('es');
        let val = numpalabra(xMonto.toString());
        let montoPalabra = val.toUpperCase()+' PESOS';
        let dia = moment().format('DD');
        let Anoi = moment().format('YYYY');
        let mes = moment().format('MM');
        let hora = moment().format('HH');
        let min = moment().format('mm');
        let seg = moment().format('ss');

        let nombreCuentaCorriente = await getInfoPropietario(xNumCuenta);
        let nombreCuenta = nombreCuentaCorriente.nombrePropietario;
        
        let rs = await pool1.connect(); // Obtenemos la conexion        
        let queryAc = `
                insert comp_abonos(codigo,cod_propiedad,cod_movto,recibide,monto,glosa,hechox,autorizadox
                    ,fecha,impreso,saldo_ctacte,mon_palabras ,id_usuario,fecha_user,hora_user,accion_usuario)
                values
                (
                    ${xNumCuenta},'',${xCodMovto}
                    ,'${nombreCuenta}',${xMonto},'${xGlosa}','Administrador',''
                    ,'${Anoi}-${mes}-${dia}','SI','','${montoPalabra}'
                    ,77                    
                    ,'${Anoi}-${mes}-${dia}'
                    ,'${hora}:${min}:${seg}'                    
                    ,'ins'
                );

                SELECT SCOPE_IDENTITY() AS NREG                    
            `;

        let respAcum = await pool1.query(queryAc.toString());            

        // let pool2 = await mssql.connect(database);
        // let result2 = await pool2.request()
        //     .input('codigo', mssql.Int, xNumCuenta)
        //     .input('cod_propiedad', mssql.VarChar(50), '')
        //     .input('cod_movto', mssql.Int, xCodMovto)
        //     .input('recibide', mssql.VarChar(100), nombreCuenta)
        //     .input('monto', mssql.Int, xMonto)
        //     .input('glosa', mssql.VarChar(500), xGlosa)
        //     .input('hechox', mssql.VarChar(50), 'Administrador')
        //     .input('autorizadox', mssql.VarChar(50), '')
        //     .input('impreso', mssql.VarChar(50), 'SI')
        //     .input('saldoctacte', mssql.VarChar(50), '')
        //     .input('mon_palabras', mssql.VarChar(500), montoPalabra)
        //     .input('id_usuario', mssql.Int, 77)
        // .execute('m_AbonoCtaCte_Guardar');

        let nReg = respAcum.recordset[0].NREG;
        let respp = await updateCodBar_Abono(nReg);

        return {
            status:true,
            message : 'Ejecucion correcta',
            idabono : nReg
        }

    } catch (error) {

        return {
            status:false,
            message : 'Error Abono ' + error.message
        }
        
    }
}


async function updateCodBar_Abono(xIdCod) {
    try {
        
        if(parseInt(xIdCod) !== 0) 
        {
            let rs = await pool1.connect(); // Obtenemos la conexion
            let codbar = `A${xIdCod}C`;
            let queryAc = `
                    UPDATE comp_abonos 
                    SET cdbar = '${codbar}'
                    WHERE idabono = ${xIdCod};
                `;

            let respAcum = await pool1.query(queryAc);

            return {
                status: true,
                message: 'Ejecución Correcta'
            }

        } else {

            return {
                status :false,
                message : 'Parámetros no válidos!'
            }

        }

    } catch (error) {

        return {
            status :false,
            message : error.message
        }
        
    }
}


/**
 * Obtiene abono
 * @param {*} idAbono 
 */
async function getAbono(idAbono) {
    try {
        
        if(parseInt(idAbono) !== 0) 
        {
            let rs = await pool1.connect(); // Obtenemos la conexion
            
            let queryAc = `
                    Select * from comp_abonos                     
                    WHERE idabono = ${idAbono};
                `;

            let resp = await pool1.query(queryAc);

            return {
                status: true,
                message: 'Ejecución Correcta',
                data:resp.recordset
            }

        } else {

            return {
                status :false,
                message : 'Parámetros no válidos!'
            }

        }

    } catch (error) {

        return {
            status : false,
            message: error.message
        }
    }
}


async function verificaAcumulaSaldo(xNumCta) {
    try {
        
        if(parseInt(xNumCta) !== 0) 
        {
            let rs = await pool1.connect(); // Obtenemos la conexion
            
            let queryAc = `
                    Select num_ctacte,acumula_saldo
                    from tb_config_cartola_ctacte
                    where num_ctacte = ${xNumCta}
                `;

            let resp = await pool1.query(queryAc);
            let acumSaldo = false;
            
            if( resp.recordset.length > 0 && 
                resp.recordset[0].acumula_saldo) {

                acumSaldo = true;
                // console.log('resp Acumula saldo::',resp);
            }

            return {
                status: true,
                message: 'Ejecución Correcta',
                acumulaSaldo:acumSaldo
            }

        } else {

            return {
                status :false,
                message : 'Parámetros no válidos!'
            }

        }

    } catch (error) {

        return {
            status : false,
            message: error.message
        }
    }    
}


/**
 * Monto acumulado, ya sea a favor o en contra.
 * @param {*} xNumCta 
 */
async function getMontoAcumulado_EnContra_Favor(xNumCta) {
    try {
        
        if(parseInt(xNumCta) !== 0) 
        {
            let rs = await pool1.connect(); // Obtenemos la conexion            
            let queryAc = `
                    Select top 2 cod_tipmovto as cod,nom_mov as nomMov,monto 
                    from libro_ctacte 
                    left join tipo_movimiento on cod_tipmovto = id_mov
                    where codigo = ${xNumCta}
                        and cod_tipmovto in(38,37)
                        and estado = 0                        
                        and fecha > GETDATE() -50
                    order by fecha desc
                `;

            let resp = await pool1.query(queryAc);            
            return {
                status: true,
                message: 'Ejecución Correcta',
                acumulaSaldo:resp.recordset
            }

        } else {

            return {
                status :false,
                message : 'Parámetros no válidos!'
            }

        }

    } catch (error) {

        return {
            status : false,
            message: error.message
        }
    }
}


/**
 * 
 */
async function getInfo_RendicionEnvista_By_CuentaCorriente(xIdCtaCte)
{
    try {

        let rs = await pool1.connect(); // Obtenemos la conexion      

        let qy = `
            Select distinct
                tb_rel.nro_cuenta_corriente as rel_ctacte
                ,tb_rel.nombre_cuenta_corriente as rel_nombrecuenta
                --,tb_rel.nombre_proyecto
                ,CONCAT(tb_cont.api_tipo_inmueble,' ',tb_cont.api_nro_inmueble) as c_propiedad
                ,tb_cont.api_id_contrato as c_numcontrato
                ,tb_cont.api_estado_contrato as c_estadocontrato
                --,tb_cont.api_precio_arriendo as c_montoarriendo
                , tb_arrend.arrendatario as a_arrendatario
                --,tb_cont.api_precio_ggcc as c_ggcc		
                --,ISNULL(tb_rend.api_Fecha_Pago,'')	as r_fechapago
                --,CAST(ISNULL(tb_rend.api_Monto_Rendido,0) as decimal(18,2)) as r_montorendido
                ,UPPER(CASE WHEN tb_rend.api_Mes_Pago is null 
                    THEN tb_mor.api_mes_cobro
                    ELSE				
                        FORMAT( DATEADD( month , (CONVERT(int,REPLACE(tb_rend.api_Mes_Pago,RIGHT(tb_rend.api_Mes_Pago,5),''))), -1 ), 'MMMM')
                        END) AS Periodo
                --,ISNULL(tipo.nombre_item,'') as Item

                ,CASE WHEN ISNULL(tb_mor.api_tipo,'') = '' 
                        THEN ISNULL(tipo.nombre_item,'')
                        ELSE ISNULL(tb_mor.api_tipo,'') END as tipo
                ,ISNULL(tb_rend.api_monto_pago,0) as r_pagado
                
                --,ISNULL(tb_mor.api_nro_cuota,0) as m_cuota
                ,ISNULL(tb_mor.api_monto_devengado,0) as m_montodevengado
                --,ISNULL(tb_mor.api_tipo,'') as m_tipo
                ,ISNULL(tb_mor.api_descripcion,'') as m_descripcion
                --,ISNULL(tb_mor.api_mes_cupon,'') as m_mescupon
                ,ISNULL(tb_mor.api_mes_cobro,'') as m_mescobro
                ,ISNULL(tb_mor.api_estado_cuota,'') as m_estadocuota
            from tb_envista_relacion_proyecto_ctacte tb_rel
                left join tb_envista_contratos tb_cont on tb_rel.nro_proyecto = tb_cont.api_id_proyecto
                LEFT join (
                        Select api_id_contrato,CONCAT(api_nombre_arrendatario,' ',api_apellido_paterno) as arrendatario 
                        from tb_envista_api_contratoarrendatario
                        where id in(
                            select max(id) id from tb_envista_api_contratoarrendatario where lower(api_tipo_figura) = 'titular'
                            group by api_id_contrato,lower(api_tipo_figura)
                        )
                ) tb_arrend on tb_arrend.api_id_contrato = tb_cont.api_id_contrato
                left join tb_envista_api_rendicion tb_rend on tb_rel.nro_proyecto = tb_rend.api_Id_Proyecto 
                    AND tb_cont.api_id_contrato = tb_rend.api_Num_Contrato
                left join tb_envista_tipo tipo on tipo.id_tipo_item = tb_rend.api_id_tipo_item
                left join tb_envista_morosidad tb_mor on tb_mor.api_nro_contrato = tb_cont.api_id_contrato
            where ISNULL(tb_cont.api_id_contrato,0) != 0
                AND tb_rel.nro_cuenta_corriente = ${xIdCtaCte};
        `;

        let resp = await pool1.query(qy);

        return {
            status: true,
            message: 'Ejecución Correcta',
            rendiciondata:resp.recordset
        }

    } catch (error) {
        console.log('Error getInfo_RendicionEnvista_By_CuentaCorriente::',error.message);
        return {
            status : false,
            message: error.message
        }
    }
}



module.exports = {
    getListado_CtaCte,
    getResumenCtaCte_x_nCuenta,
    getPeriodo_ctaCte,
    getGastosGlobales_numCuenta,
    getDetalleMovimiento,
    getInfoPropietario,
    guardaIdCartolaCreado,
    guardaInfoPdfCreado,
    getDetalleAbono,
    infoOrdenAdministracion,
    getInfoComision,
    calculoComision,
    getPropiedadesArrendadasXSanCamilo,
    comisiones_por_ctacte_periodoactual,
    getCtacte_Config_AcumSaldo,
    saveConfigSaldoAcum,
    saveCargos,
    getCargos,
    saveAbonos,
    getAbono,
    verificaAcumulaSaldo,
    getMontoAcumulado_EnContra_Favor,
    getTotalCargos_TotalAbonos,
    getInfoCtaCte,
    comisionCtaCte_PorDiaLiquidacion,
    getDataVista_ComisionPorCuenta,
    getInfo_RendicionEnvista_By_CuentaCorriente
}