'use strict';

const mssql = require('mssql');
const database = require('../keys');
const pool1 = new mssql.ConnectionPool(database);

/**
 * OBTIENE EL LISTADO DE CUENTAS CORRIENTES
 */
async function getListado_CtaCte() {
    try {

        let rs = await pool1.connect(); // Obtenemos la conexion        
        let qListado = `SELECT codigo, 
             nombrectacte, cuentacerrada 
             FROM cuentascorrientes 
             WHERE cuentacerrada = 'NO' AND codigo < 50000
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
        let qPeriodo = ` Select distinct num_cuentacte, periodo, fecha 
         from tb_liquidacion_detalle 
         where periodo not like '%ANTIGUO%' and num_cuentacte = ` + xNumCuenta + `
         order by fecha desc `;

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

            }

            let qResumenCtaCte = `
                    SELECT TIPO,CASE WHEN ARRENDATARIO = '' THEN 'Otros Movimientos' ELSE ARRENDATARIO END AS ARRENDATARIO 
                        ,CASE WHEN INMUEBLE = '' THEN 'Otros' ELSE INMUEBLE END AS INMUEBLE 
                        ,INGRESOS,EGRESOS,[SALDO A LIQUIDAR] as TOTAL_RESUMEN,COD
                    FROM(
                        SELECT 'RESUMEN' as TIPO
                            ,	CONCAT(LTRIM(RTRIM(ARREN.nombres)), ' ',LTRIM(RTRIM(ARREN.apellido_pat)), ' ',LTRIM(RTRIM(ARREN.apellido_mat))) as ARRENDATARIO
                            ,	CONCAT(PRO.direccion , ' ' ,PRO.n_direccion , ' ' ,PRO.unidad , ' ' , PRO.n_unidad) as INMUEBLE
                            ,   CONCAT(PRO.cod_propiedad,ARREN.cod_arrendatario) as COD
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

                        ) as tmp_libro_arren_propiet
                            LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
                            LEFT JOIN arrendatario ARREN on ARREN.cod_arrendatario = tmp_libro_arren_propiet.cod_arrendatario
                        
                        GROUP BY concat(LTRIM(RTRIM(ARREN.nombres)), ' ',LTRIM(RTRIM(ARREN.apellido_pat)), ' ',LTRIM(RTRIM(ARREN.apellido_mat)))
                            ,concat(PRO.direccion , ' ' ,PRO.n_direccion , ' ' ,PRO.unidad , ' ' , PRO.n_unidad)
                            ,CONCAT(PRO.cod_propiedad,ARREN.cod_arrendatario)
                    ) as tem
                    Where /*LTRIM(RTRIM(ISNULL(ARRENDATARIO,''))) != '' */
					LTRIM(RTRIM(ISNULL(INMUEBLE,''))) != ''
                    order by CASE WHEN INMUEBLE = '' THEN 'OTROS' ELSE INMUEBLE END asc; `;
            // console.log('QUERY:::', qResumenCtaCte);

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
                        AND isnull(l.cod_propiedad,'0') = '0'

                ) as tmp_libro_arren_propiet
                    LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
                    LEFT JOIN arrendatario ARREN on ARREN.cod_arrendatario = tmp_libro_arren_propiet.cod_arrendatario
                WHERE isnull(tmp_libro_arren_propiet.cod_propiedad,'0') = '0'                 
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

async function getDetalleMovimiento(numCuenta, periodo, cod) {
    try {

        if (parseInt(numCuenta) > 9999) {
            let qFiltro = '';
            let filtroArrenPropiedad = '';
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
            }

            if(cod != '')
            {
                filtroArrenPropiedad = ` WHERE CONCAT(PRO.cod_propiedad,'', ARREN.cod_arrendatario) = '` + cod + `' `;
            }

            let qDetalle = `
                SELECT TIPO, FECHA
                        ,   concat(PRO.direccion , ' ' , PRO.n_direccion , ' ' , PRO.unidad , ' ' , PRO.n_unidad) as PROPIEDAD
                        ,   tmp_libro_arren_propiet.codigo as [N° CUENTA]
                        /*, ISNULL(tm.nom_mov,'') as DESCRIPCION */
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
                    ) as tmp_libro_arren_propiet
                    INNER JOIN tipo_documento td ON cod_tipdocto = td.idtipdoc
                    LEFT JOIN tipo_movimiento tm ON cod_tipmovto = tm.id_mov
                    LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
                    LEFT JOIN arrendatario ARREN on ARREN.cod_arrendatario = tmp_libro_arren_propiet.cod_arrendatario
                ` + filtroArrenPropiedad + `
                ORDER BY concat(PRO.direccion , ' ' , PRO.n_direccion , ' ' , PRO.unidad , ' ' , PRO.n_unidad),fchaFormat asc
            `;
            
            // console.log('qDetalle::',qDetalle);

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


async function infoOrdenAdministracion(xNumCuenta)
{
    try {

        if(xNumCuenta.trim() != '' && parseInt(xNumCuenta) > 9999 )
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
            }

            let qDetalle = `
                SELECT TIPO, FECHA
                    /*,   concat(PRO.direccion , ' ' , PRO.n_direccion , ' ' , PRO.unidad , ' ' , PRO.n_unidad) as PROPIEDAD
                    ,   tmp_libro_arren_propiet.codigo as [N° CUENTA]*/
                    /*, ISNULL(tm.nom_mov,'') as DESCRIPCION                         
                    ,   CASE WHEN ISNULL(tm.nom_mov,'') = '' THEN td.nom_doc ELSE ISNULL(tm.nom_mov,'')END as DESCRIPCION */
                    ,   tm.id_mov
                    ,   case when GENERA = 'salida' then monto else 0 end as CARGO
                    ,   case when GENERA = 'entrada' then monto else 0 end as ABONO
                    ,   PRO.cod_propiedad
                    /*,   
                    ,   ARREN.cod_arrendatario
                    ,   glosa
                    ,   idmovcaj
                    ,   numRecibo
                    ,   fchaFormat
                    ,   CONCAT(tmp_libro_arren_propiet.cod_arrendatario,'-',tmp_libro_arren_propiet.cod_propiedad) as COD */
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
                    ) as tmp_libro_arren_propiet
                    INNER JOIN tipo_documento td ON cod_tipdocto = td.idtipdoc
                    LEFT JOIN tipo_movimiento tm ON cod_tipmovto = tm.id_mov
                    LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
                    LEFT JOIN arrendatario ARREN on ARREN.cod_arrendatario = tmp_libro_arren_propiet.cod_arrendatario
                WHERE case when GENERA = 'salida' then monto else 0 end  > 0 OR 
                    case when GENERA = 'entrada' then monto else 0 end > 0                
            `;

            // console.log('getInfoComision qDetalle::',qDetalle);
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
 * Calculo de comision de administración, de acuerdo a las reglas de las cuentas corrientes.
 * @param {Numero de la cuenta corriente} numCta 
 * @param {Periodo de la liquidación} periodo 
 */
async function calculoComision(numCta, periodo) {
    try {
        
        const dOrdenAdmin = await infoOrdenAdministracion(numCta);
        const dComision = await getInfoComision(numCta,periodo);
        const propSanCamilo = await getPropiedadesArrendadasXSanCamilo();

        let codPropiedadSanCamilo = [];
        if(parseInt(numCta) == 10203) {

            if(propSanCamilo.status) {

                for (let z = 0; z < propSanCamilo.data.length; z++) {

                    codPropiedadSanCamilo.push(propSanCamilo.data[z].cod_propiedad);                    
                }
            }
        }

        let totalComision = 0;
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
                            dComision.data[i].id_mov == 42 ) {

                            calcComision += parseInt(dComision.data[i].ABONO);
                            totalCargos += parseInt(dComision.data[i].CARGO);
                        }
                    }
                }

                //Calculamos el porcentaje de Comision
                totalComision = ((porcentComision / 100) * (calcComision - totalCargos));
                
                //Calculamos y Sumamos el IVA 19%                
                totalComision = (totalComision + ( (19 / 100) * totalComision)).toFixed(0);
            
            }
        }
    
        return {
            status : true,
            resultOAD,
            totalComision,
            porcentComision
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
        if(xncuenta !== 0) {
            filter = `  AND l.codigo = ${ xncuenta } `;
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
        }

        let qy = `
            SELECT codigo
                ,SUM(CARGO) as TOTALCARGO
                ,SUM(ABONO) as TOTALABONO
                ,SUM(ISNULL(ABONO,0)) - SUM(ISNULL(CARGO,0)) as montoaliq
                ,ISNULL(comision_admin.por_comision,0) as comi_admin
                ,ISNULL(CAST(
                    (comision_admin.por_comision * ( SUM(ABONO) -SUM(CARGO)) /100) + (19 * (comision_admin.por_comision * ( SUM(ABONO) -SUM(CARGO)) /100) /100)
                as decimal(18,0)),0) as total_comi_adm
                , isnull(porcentaje_comision,0) as comi_asesor
                ,ISNULL(CAST(CASE WHEN isnull(porcentaje_comision,0) != 0
                        THEN
                            (porcentaje_comision * ( SUM(ABONO) -SUM(CARGO)) /100)
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
                        SELECT  DISTINCT 'COMISION' as  TIPO, idmovcaj
                            , l.cod_propiedad, l.monto, l.genera as GENERA, l.codigo, convert(varchar(10),l.fecha,105) as FECHA,l.fecha as fchaFormat
                            ,l.glosa
                            ,l.n_recibo as numRecibo
                            ,l.cod_tipdocto,l.cod_tipmovto
                        FROM libro_ctacte l
                        WHERE nulo IS NULL 
                            /* AND l.fecha > getdate() -40 */
                            
                            ${ filPeriodo }

                            AND isnull(l.cod_tipmovto,0) in (1,3,4,14,15,42)
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
                    ) as tmp_libro_arren_propiet
                    INNER JOIN tipo_documento td ON cod_tipdocto = td.idtipdoc
                    LEFT JOIN tipo_movimiento tm ON cod_tipmovto = tm.id_mov
                    LEFT JOIN propiedad PRO on PRO.cod_propiedad = tmp_libro_arren_propiet.cod_propiedad
                WHERE case when GENERA = 'salida' then monto else 0 end  > 0 OR
                    case when GENERA = 'entrada' then monto else 0 end > 0
            
            ) as DP
            left join (
            
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
            )as comision_admin on DP.codigo = comision_admin.NCtaCte
            left join tb_comision_asesorias on NCtaCte = nctacte
            where codigo is not null
            GROUP BY codigo,comision_admin.por_comision,porcentaje_comision
        `;
                            
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


module.exports = {
    getListado_CtaCte,
    getResumenCtaCte_x_nCuenta,
    getPeriodo_ctaCte,
    getGastosGlobales_numCuenta,
    getDetalleMovimiento,
    getInfoPropietario,
    guardaInfoPdfCreado,
    getDetalleAbono,
    infoOrdenAdministracion,
    getInfoComision,
    calculoComision,
    getPropiedadesArrendadasXSanCamilo,
    comisiones_por_ctacte_periodoactual,
    getCtacte_Config_AcumSaldo,
    saveConfigSaldoAcum

}