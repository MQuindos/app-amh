// var express = require('express');
// var router = express.Router();

// /* GET home page. */
// router.get('/', function(req, res, next) {
//   res.render('index', { title: 'Express' });
// });

// module.exports = router;
const { exec } = require('child_process');
const express = require('express');
const router = express.Router();

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');

//const pool = require('../database');
const mssql = require('mssql');
const database = require('../keys');

const pool1 = new mssql.ConnectionPool(database);

var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, path.join(__dirname, '../public/upload/'))
    },
    filename: function(req, file, cb) {

        let today = new Date();
        let dd = today.getDate();
        let mm = today.getMonth() + 1;
        let yyyy = today.getFullYear();
        let h = today.getHours();
        let m = today.getMinutes();
        let s = today.getSeconds();
        let nameFile = 'file_' + dd + '-' + mm + '-' + yyyy + '_' + h + '' + m + '' + s + '_' + file.originalname;
        nameFile = nameFile.replace(/\s/g, "_");

        cb(null, nameFile);

    }
});

var upload = multer({
    storage: storage,
    fileFilter: function(req, file, callback) { //file filter
            if (['xls', 'xlsx'].indexOf(file.originalname.split('.')[file.originalname.split('.').length - 1]) === -1) {

                return callback(new Error('Tipo archivo no permitido'));
            }

            callback(null, true);
        }
        /*dest: __dirname + '/public/upload/'*/
});


router.post('/fileprocesa', (req, res) => {

    let arrResponse;
    let dataInsert = [];
    let dataRetorno_problemas = [];
    let dataRetorno_procesado = [];
    try {

        upload.single('file')(req, res, async function(err) {
            if (err) {
                arrResponse = {
                    status: false,
                    message: 'Solo se permiten archivos EXCEL.'
                }

                res.send(arrResponse);
                return;
            }

            var filePath = req.file.path;
            var fileName = req.file.originalname;
            var fileExtens = path.extname(req.file.originalname);
            //console.log('filePath::', filePath, 'fileName::', fileName, ' fileExtens::', fileExtens, ' fileField::', fileField);
            //filePath:: C:\Users\mtoro\work\app-cargaprocesa-amh\routes\public\upload\file_11-5-2020_14728_Cambio_GGCC_Lizzette.xlsx

            //Leemos el archivo
            var workbook = XLSX.readFile(filePath);
            var sheet_name_list = workbook.SheetNames;
            var xlData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

            try {

                if (!xlData[0].hasOwnProperty('MONTO_PAGADO') ||
                    !xlData[0].hasOwnProperty('NUMERO_OPERACION') ||
                    !xlData[0].hasOwnProperty('FECHA_PAGO')) throw new Error('Error en el archivo, algunos nombres de las columnas no tienen un NOMBRE válido!!');

                // if (!xlData[0].hasOwnProperty('NUMERO_OPERACION')) throw new Error('Error en archivo, revisar nombres de las columnas!!');
                // if (!xlData[0].hasOwnProperty('FECHA_PAGO')) throw new Error('Error en archivo, revisar nombres de las columnas!!');

            } catch (e) {
                res.json({
                    'status': false,
                    'message': e.message
                });

                return;
            }

            //Obtenemos la data del archivo
            let monto = 0;
            let fechapago;
            let fecharendicion;
            let tA;
            let tB;

            let resulValid = await validaDataExcel(xlData);
            if (resulValid.status) {

                for (let row in xlData) {
                    // console.log('row:::', xlData[row].MONTO_PAGADO);

                    fechapago = new Date(xlData[row].FECHA_PAGO);
                    fecharendicion = new Date(xlData[row].FECHA_RENDICION);

                    tA = fechapago.getFullYear() + '-' + fechapago.getDate() + '-' + (fechapago.getMonth() + 1) + ' ' + fechapago.getHours() + ':' + fechapago.getMinutes();
                    tB = fecharendicion.getFullYear() + '-' + fecharendicion.getDate() + '-' + (fecharendicion.getMonth() + 1) + ' ' + fecharendicion.getHours() + ':' + fecharendicion.getMinutes();

                    monto = xlData[row].MONTO_PAGADO.toString().replace(',', '.');

                    dataInsert = [
                        xlData[row].NROCARTERA,
                        xlData[row].MONEDA,
                        xlData[row].RUT,
                        xlData[row].DV,
                        xlData[row].NOMBREARRENDATARIO,
                        xlData[row].CUENTACLIENTE,
                        xlData[row].NUMERO_OPERACION,
                        xlData[row].NUMERO_CUOTA,
                        xlData[row].CANAL_PAGO,
                        tA,
                        monto,
                        xlData[row].CODIGO_CONVENIO,
                        xlData[row].NOMBRE_CONVENIO,
                        tB,
                        xlData[row].RUT
                    ];

                    await saveDataExcel(dataInsert).then((res) => {

                        if (!res.status) {

                            dataRetorno_problemas.push({ 'ncontrato': xlData[row].NUMERO_OPERACION, 'arrendatario': xlData[row].NOMBREARRENDATARIO });

                        } else {

                            dataRetorno_procesado.push({ 'ncontrato': xlData[row].NUMERO_OPERACION, 'arrendatario': xlData[row].NOMBREARRENDATARIO });

                        }

                    }).catch((err) => {

                        dataRetorno_problemas.push({ 'ncontrato': xlData[row].NUMERO_OPERACION, 'arrendatario': xlData[row].NOMBREARRENDATARIO });

                    });

                }

                res.json({
                    'status': true,
                    'message': 'Subido Correctamente.',
                    dataOK: dataRetorno_procesado,
                    dataProblem: dataRetorno_problemas
                });

                /*
                xlData.forEach(function(row) {

                    fechapago = new Date(row.FECHA_PAGO);
                    fecharendicion = new Date(row.FECHA_RENDICION);

                    tA = fechapago.getFullYear() + '-' + fechapago.getDate() + '-' + (fechapago.getMonth() + 1) + ' ' + fechapago.getHours() + ':' + fechapago.getMinutes();
                    tB = fecharendicion.getFullYear() + '-' + fecharendicion.getDate() + '-' + (fecharendicion.getMonth() + 1) + ' ' + fecharendicion.getHours() + ':' + fecharendicion.getMinutes();

                    monto = row.MONTO_PAGADO.toString().replace(',', '.');

                    dataInsert = [
                        row.NROCARTERA,
                        row.MONEDA,
                        row.RUT,
                        row.DV,
                        row.NOMBREARRENDATARIO,
                        row.CUENTACLIENTE,
                        row.NUMERO_OPERACION,
                        row.NUMERO_CUOTA,
                        row.CANAL_PAGO,
                        tA,
                        monto,
                        row.CODIGO_CONVENIO,
                        row.NOMBRE_CONVENIO,
                        tB,
                        row.RUT
                    ];

                    saveDataExcel(dataInsert).then((res) => {

                        if (!res.status) {

                            dataRetorno_problemas.push({ 'ncontrato': row.NUMERO_OPERACION, 'arrendatario': row.NOMBREARRENDATARIO });

                        } else {

                            dataRetorno_procesado.push({ 'ncontrato': row.NUMERO_OPERACION, 'arrendatario': row.NOMBREARRENDATARIO });

                        }

                    }).catch((err) => {

                        dataRetorno_problemas.push({ 'ncontrato': row.NUMERO_OPERACION, 'arrendatario': row.NOMBREARRENDATARIO });

                    });

                });

                res.json({
                    'status': true,
                    'message': 'Subido Correctamente.'
                });

                */
            } else {

                res.json({
                    'status': false,
                    'message': 'PROBLEMAS AL VALIDAR ARCHIVO.'
                });

                return;

            }

        });

    } catch (error) {

        res.json({
            'status': false,
            'message': error.message
        });

        return;

    }

});


function validaDataExcel(xdata) {

    try {

        for (let row in xdata) {
            console.log('row:::', xdata[row].MONTO_PAGADO);

        }


        return {
            status: true,
            message: 'OK'
        }

    } catch (error) {

        return {
            status: false,
            message: error.message
        }
    }

}


async function saveDataExcel(row) {

    try {

        let rs = await pool1.connect(); // Obtenemos la conexion
        // console.log('ROW 9', row[9]);
        let qy = 'INSERT INTO amh_data_retorno(proces_fecha_carga,archi_nro_cartera	,archi_moneda ,archi_rut ' +
            ' ,archi_dv	,archi_nombre_arrendatario,archi_cuenta_cliente	,archi_numero_operacion	,archi_numero_cuota ' +
            ' ,archi_canal_pago	,archi_fecha_pago,archi_monto_pago,archi_codigo_convenio ' +
            ' ,archi_nombre_convenio,archi_fecha_rendicion	,proces_estado ) ' +
            ' VALUES (getdate(),' + row[0] + ',\'' + row[1] + '\',\'' + row[2] + '\',\'' + row[3] + '\' ,\'' +
            row[4] + '\',' + row[5] + ',' + row[6] + ',' + row[7] + ',\'' +
            row[8] + '\',\'' + row[9] + '\',' + row[10] + ',' +
            row[11] + ',\'' + row[12] + '\',\'' +
            row[13] + '\',1);  SELECT SCOPE_IDENTITY() AS idInsert; ';
        let rsQy = await pool1.query(qy); //Ejecutamos la insercion data excel
        let id_InsertDataRetorno = rsQy.recordset[0].idInsert;


        let rsDetalle = await pool1.connect(); // Obtenemos la conexion
        let qyDetalle = ' Insert into amh_detallepago_ccierta_dataretorno( ' +
            ' cc_num_contrato,cc_arr_rut,cc_arr_dv,cc_tipo_contrato,cc_arrendatario,cc_arr_mail ' +
            ' ,cc_propiedades,cc_propiedad,cc_fecha_pago,cc_tipo_moneda ' +
            ' ,cc_num_cuota	,cc_canon_saldo_anterior,cc_ggcc_saldo_anterior ' +
            ' ,cc_servbasicos_saldo_anterior,cc_multas_saldo_anterior,cc_periodo_cobro,cc_canon ' +
            ' ,cc_ggcc	,cc_servbasicos	,cc_multas	,cc_total_pagar,ret_proces_id	) ' +
            ' Select [N° CONTRATO],RUT,DV,[TIPO CONTRATO],ARRENDATARIO,[E-MAIL] ' +
            '     , PROPIEDADES,PROPIEDAD,[FECHA DE PAGO],[TIPO DE MONEDA] ' +
            '     , [N° CUOTA],[CANON S. ANTERIOR],[GGCC S. ANTERIOR],[SERVICIOS BASICOS S. ANTERIOR] ' +
            '     ,	[MULTAS S. ANTERIOR],[PERIODO DE COBRO],CANON,GGCC ' +
            '     , [SERVICIOS BÁSICOS],[MULTAS A COBRAR MES],[TOTAL A PAGAR], ' + id_InsertDataRetorno + ' ' +
            ' from amh_cartera_cierta ' +
            ' where [N° CONTRATO] = ' + row[6] + '; SELECT SCOPE_IDENTITY() AS idInsertDetalle;';

        let rsqyDetalle = await pool1.query(qyDetalle);
        let id_InsertDetalle = rsqyDetalle.recordset[0].idInsertDetalle;
        // console.log('rsqyDetalle::', rsqyDetalle);

        let rsDetalleUPDATE = await pool1.connect(); // Obtenemos la conexion
        let qyUpdateDetalle = ' UPDATE amh_detallepago_ccierta_dataretorno set ret_proces_fecha_carga = ADR.proces_fecha_carga, ' +
            ' ret_archi_nro_cartera = ADR.archi_nro_cartera, ' +
            ' ret_archi_moneda = ADR.archi_moneda, ' +
            ' ret_archi_rut = ADR.archi_rut, ' +
            ' ret_archi_dv = ADR.archi_dv, ' +
            ' ret_archi_nombre_arrendatario = ADR.archi_nombre_arrendatario, ' +
            ' ret_archi_cuenta_cliente = ADR.archi_cuenta_cliente, /*Cuenta Corriente*/ ' +
            ' ret_archi_numero_operacion = ADR.archi_numero_operacion, /*Numero de contrato*/ ' +
            ' ret_archi_numero_cuota = ADR.archi_numero_cuota, ' +
            ' ret_archi_canal_pago = ADR.archi_canal_pago, ' +
            ' ret_archi_fecha_pago = ADR.archi_fecha_pago, ' +
            ' ret_archi_monto_pago = ADR.archi_monto_pago, ' +
            ' ret_archi_codigo_convenio = ADR.archi_codigo_convenio, ' +
            ' ret_archi_nombre_convenio = ADR.archi_nombre_convenio, ' +
            ' ret_archi_fecha_rendicion = ADR.archi_fecha_rendicion, ' +
            ' ret_proces_estado = ADR.proces_estado ' +
            ' from amh_detallepago_ccierta_dataretorno ACC ' +
            ' inner join amh_data_retorno ADR on ADR.proces_id = ACC.ret_proces_id ' +
            ' where ADR.proces_id = ' + id_InsertDataRetorno + '  AND ACC.id = ' + id_InsertDetalle + ' AND ADR.proces_estado = 1; ';

        let rsqyDetalleUpdate = await pool1.query(qyUpdateDetalle);
        //        console.log('rsqyDetalleUpdate::', rsqyDetalleUpdate);

        return {
            status: true,
            message: 'PROCESO CORRECTO'
        };

    } catch (err) {

        return {
            status: false,
            message: err.message

        };

    }
}


router.post('/procesarPagoMQSISX', (req, res) => {

    let data = dataToEXE().then((resp) => {

        if (resp.data.length > 0) {

            res.json({
                status: true,
                message: 'Procesando'
            });


        } else {

            res.json({
                status: true,
                message: 'No hay registros para procesar.'
            });


        }

    });

    executeEXE();

});


function executeEXE() {

    dataToEXE().then((res) => {
        let dataProcess = res.data;
        let i = 0;
        if (dataProcess.length > 0) {

            if (res.status) {

                for (let item of dataProcess) {

                    i++;

                    setTimeout(function() {

                        let directorioEXE = path.join(__dirname, '../exe/Exe/procesarpago4.exe');
                        let cmd = `start ${directorioEXE} ${item.id},${item.fc_pago},${item.fc_pago} `;
                        //console.log('cmd::', cmd);

                        exec(cmd, (err, stdout, stderr) => {
                            if (err) {
                                //      console.error(`exec error: ${err}`);
                                return;
                            }

                            //console.log(`Number of files ${stdout}`);

                        });

                    }, 8000 * i);

                }

                return {
                    status: true,
                    message: 'Registros procesados correctamente.'
                }


            } else {
                console.log('res error::', res.message);
                return {
                    status: false,
                    message: res.message
                }
            }
        } else {

            return {
                status: true,
                message: 'No hay registros para procesar.'
            }

        }


    }).catch((err) => {

        return {
            status: false,
            message: err.message
        }
    });

}


async function dataToEXE() {

    try {
        let rsDetalleUPDATE = await pool1.connect(); // Obtenemos la conexion
        let qyProcesar = '  Select proces_id id ' +
            ' ,archi_moneda moneda ' +
            ' ,replace(convert(varchar(10),archi_fecha_pago,105),\'-\',\'/\') fc_pago ' +
            ' ,cast(case when lower(archi_moneda) = \'pesos\' then archi_monto_pago else archi_monto_pago * UF.valor_uf end as decimal(18,2)) as monto ' +
            ' from amh_data_retorno ADR ' +
            '     inner join historico_uf UF on convert(date,ADR.archi_fecha_pago) = convert(date,UF.fecha) ' +
            ' where proces_estado = 1 ';
        let dataaprocesar = await pool1.query(qyProcesar);

        return {
            status: true,
            message: 'PROCESO CORRECTO',
            data: dataaprocesar.recordset
        }

    } catch (error) {
        return {
            status: false,
            message: error.message
        }
    }
}


// router.get('/add', (req, res) => {
//     res.render('links/add');
// });


// router.post('/add', async(req, res) => {
//     //Podriamos enviar el objeto directo del req.body
//     const { title, url, description } = req.body;
//     let newLinks = {
//         title,
//         url,
//         description
//     };

//     const requestAdd = pool1.request(); // or: new sql.Request(pool1)
//     const resultAdd = await requestAdd.query(`INSERT INTO links(title,url,description,user_id,created_at,status) values ('${title}','${url}','${description}',1,getdate(),1)`);

//     //await pool.query('INSERT INTO links set ?', [newLinks]);
//     //req.flash('success', 'Link saved successfully');
//     res.redirect('/');

// });

router.get('/', async(req, res) => {

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


        res.render('links/list', { links: linksReturn, dataProcesados: linksProcess });

        //res.render('links/list', { links });

    } catch (err) {

        console.error('SQL error', err);
    }

});


router.get('/deleteDataAMH', async(req, res) => {

    try {

        let rsConn = await pool1.connect(); // Obtenemos la conexion
        let qyDetallePago = ' UPDATE amh_detallepago_ccierta_dataretorno SET ret_proces_estado = 3 ' +
            ' where ret_proces_id in( ' +
            ' Select proces_id from amh_data_retorno where proces_estado = 1 ) and ret_proces_estado = 1;'
        let resUpdate = await pool1.query(qyDetallePago);

        let rs = await pool1.connect(); // Obtenemos la conexion
        let resulRetorno = await pool1.query('UPDATE amh_data_retorno SET proces_estado = 3 where proces_estado = 1 ');

        res.json({
            status: true,
            message: 'Registros eliminados'
        });

    } catch (error) {

        res.json({
            status: false,
            message: error.message
        });

    }

});

// router.get('/edit/:id', async(req, res) => {
//     let id = req.params.id;
//     const requestEdit = pool1.request(); // or: new sql.Request(pool1)
//     const respEdit = await requestEdit.query(`Select * from links where id = ${id}`);
//     // let link = await pool.query(`Select * from links where id = ${id}`);
//     //req.flash('success', 'Link edited successfully');
//     let linksReturn = respEdit.recordsets[0];
//     res.render('links/edit', { links: linksReturn[0] });

// });

// router.post('/edit/:id', async(req, res) => {
//     let id = req.params.id;
//     let { title, url, description } = req.body;
//     let editLink = {
//         title,
//         url,
//         description
//     };

//     await pool.query('UPDATE links set ? where id = ?', [editLink, id]);
//     req.flash('success', 'Link updated successfully');
//     res.redirect('/links');

// });


module.exports = router;