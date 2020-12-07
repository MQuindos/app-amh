require('dotenv').config();
const childProcess  = require('child_process');
const express = require('express');
const router = express.Router();
const session = require('express-session');
const moment = require('moment');
const nodeoutlook = require('nodemailer');

const amhController = require('../controllers/amhController');
const pdfCrea = require('../pdfcreate/pdf');

const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const mssql = require('mssql');
const database = require('../keys');
const pool1 = new mssql.ConnectionPool(database);

const transporter = nodeoutlook.createTransport({
    host: process.env.HSTMAIL,
    port: process.env.PORTMAIL,
    secure: false,
    auth: {
        user: process.env.USERMAIL,
        pass: process.env.PASSMAIL
    }
});


var ssn;

router.post('/amh/fileprocesa', (req, res) => {

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

                return res.send(arrResponse);

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

            } catch (e) {

                return res.json({
                    'status': false,
                    'message': e.message
                });

            }

            //Obtenemos la data del archivo
            let resulValid = await validaDataExcel(xlData);
            let dataProcess = resulValid.data;

            if (resulValid.status) {

                for (let row in dataProcess) {

  //                  console.log('dataProcess[row].VALIDO:',dataProcess[row].VALIDO);
                    if (dataProcess[row].VALIDO) {
//console.log('Antes de sava data excel... then()');
                        await saveDataExcel(dataProcess[row]).then((res) => {

                            if (!res.status) {

                                dataRetorno_problemas.push({ 'ncontrato': dataProcess[row].NUMERO_OPERACION, 'arrendatario': dataProcess[row].NOMBREARRENDATARIO });

                            } else {

                                dataRetorno_procesado.push({ 'ncontrato': dataProcess[row].NUMERO_OPERACION, 'arrendatario': dataProcess[row].NOMBREARRENDATARIO });

                            }

                        }).catch((err) => {

                            dataRetorno_problemas.push({ 'ncontrato': dataProcess[row].NUMERO_OPERACION, 'arrendatario': dataProcess[row].NOMBREARRENDATARIO });

                        });

                    } else {

                        dataRetorno_problemas.push({ 'ncontrato': dataProcess[row].NUMERO_OPERACION, 'arrendatario': dataProcess[row].NOMBREARRENDATARIO });

                    }
                }

                return res.json({
                    status: true,
                    message: 'Subido Correctamente.',
                    dataOK: dataRetorno_procesado,
                    dataProblem: dataRetorno_problemas
                });

            } else {

                return res.json({
                    status: false,
                    message: 'PROBLEMAS AL VALIDAR ARCHIVO.'
                });

            }

        });

    } catch (error) {

        console.log('Error carga::',error);

        return res.json({
            'status': false,
            'message': error.message
        });

    }

});

async function validaDataExcel(xdata) {

    try {

        //OBTENEMOS LA FECHA DE PAGO, ULTIMO PROCESADO
        let qy = 'Select top 1 case when concat(convert(varchar(10), max(archi_fecha_pago),105),\' \' ' +
            ' ,convert(varchar(10), max(archi_fecha_pago),108)) = \'\' ' +
            ' then concat(convert(varchar(10), getdate() - 590, 105), \' \', convert(varchar(10), getdate() - 590, 108)) ' +
            ' else concat(convert(varchar(10), max(archi_fecha_pago), 105), \' \', convert(varchar(10), max(archi_fecha_pago), 108)) end as fechapago_max ' +
            ' from amh_data_retorno ' +
            ' where proces_estado in(1,2); ';

        let rs = await pool1.connect(); // Obtenemos la conexion
        let rsQy = await pool1.query(qy); //Ejecutamos la insercion data excel

        //let fcTestBBDD = new Date(rsQy.recordset[0].fechapago_max); // La fecha viene en texto
        let fcTestBBDD = rsQy.recordset[0].fechapago_max; // La fecha viene en texto
        let fc_ultimoBBDD = new Date(moment(fcTestBBDD, 'DD/MM/YYYY HH:mm:ss').format("YYYY-MM-DD HH:mm:ss"));
        // let fc_ultimoBBDD = fcTest.getFullYear() + '-' + fcTest.getDate() + '-' + (fcTest.getMonth() + 1) + ' ' + fcTest.getHours() + ':' + fcTest.getMinutes() + ':' + fcTest.getSeconds();
        let dataReturn = [];
        let statusRow = false;

        //console.log('ultimo BBDD::',fc_ultimoBBDD, ' fechapago::', xdata[0].FECHA_PAGO );

        for (let row in xdata) {

            let numcontrato = xdata[row].NUMERO_OPERACION;
            let monto = xdata[row].MONTO_PAGADO.toString().replace(',', '.');
            let fechapago = xdata[row].FECHA_PAGO;
            let fc_pago = moment(fechapago, 'DD/MM/YYYY HH:mm').format("YYYY/MM/DD HH:mm");
            let fecharendicion = xdata[row].FECHA_RENDICION;
            let fc_rendicion = moment(fecharendicion, 'DD/MM/YYYY HH:mm').format("YYYY/MM/DD HH:mm");

            if (new Date(fc_pago) > fc_ultimoBBDD && parseInt(monto) > 0 && parseInt(numcontrato) > 0) {
                statusRow = true;
            } else {
                statusRow = false;
            }

            dataReturn.push({
                NROCARTERA: xdata[row].NROCARTERA,
                MONEDA: xdata[row].MONEDA,
                RUT: xdata[row].RUT,
                DV: xdata[row].DV,
                NOMBREARRENDATARIO: xdata[row].NOMBREARRENDATARIO,
                CUENTACLIENTE: xdata[row].CUENTACLIENTE,
                NUMERO_OPERACION: xdata[row].NUMERO_OPERACION,
                NUMERO_CUOTA: xdata[row].NUMERO_CUOTA,
                CANAL_PAGO: xdata[row].CANAL_PAGO,
                FECHA_PAGO: fc_pago,
                MONTO_PAGADO: monto,
                CODIGO_CONVENIO: xdata[row].CODIGO_CONVENIO,
                NOMBRE_CONVENIO: xdata[row].NOMBRE_CONVENIO,
                FECHA_RENDICION: fc_rendicion,
                VALIDO: statusRow
            });

        }

        return {
            status: true,
            message: 'OK',
            data: dataReturn
        }

    } catch (error) {

        console.log('error:::', error.message);

        return {
            status: false,
            message: error.message
        }
    }

}

async function saveDataExcel(row) {

    try {

        let rs = await pool1.connect(); // Obtenemos la conexion        
        let qy = 'INSERT INTO amh_data_retorno(proces_fecha_carga,archi_nro_cartera	,archi_moneda ,archi_rut ' +
            ' ,archi_dv	,archi_nombre_arrendatario,archi_cuenta_cliente	,archi_numero_operacion	,archi_numero_cuota ' +
            ' ,archi_canal_pago	,archi_fecha_pago,archi_monto_pago,archi_codigo_convenio ' +
            ' ,archi_nombre_convenio,archi_fecha_rendicion	,proces_estado ) ' +
            ' VALUES (getdate(),' + row.NROCARTERA + ',\'' + row.MONEDA + '\',\'' + row.RUT + '\',\'' + row.DV + '\' ,\'' +
            row.NOMBREARRENDATARIO + '\',' + row.CUENTACLIENTE + ',' + row.NUMERO_OPERACION + ',' + row.NUMERO_CUOTA + ',\'' +
            row.CANAL_PAGO + '\',\'' + row.FECHA_PAGO + '\',' + row.MONTO_PAGADO + ',' +
            row.CODIGO_CONVENIO + ',\'' + row.NOMBRE_CONVENIO + '\',\'' +
            row.FECHA_RENDICION + '\',1);  SELECT SCOPE_IDENTITY() AS idInsert; ';
        let rsQy = await pool1.query(qy); //Ejecutamos la insercion data excel
        let id_InsertDataRetorno = rsQy.recordset[0].idInsert;

        let rsDetalle = await pool1.connect(); // Obtenemos la conexion
        let qyDetalle = ' Insert into amh_detallepago_ccierta_dataretorno(  ' +
        ' cc_num_contrato,cc_arr_rut,cc_arr_dv,cc_tipo_contrato,cc_arrendatario,cc_arr_mail  ' +
        ' ,cc_propiedad,cc_fecha_pago,cc_tipo_moneda  ' +
        ' ,cc_num_cuota	,cc_deuda_anterior,cc_ggcc_saldo_anterior  ' +
        ' ,cc_periodo_cobro, cc_arriendo,cc_ggcc	 ' +
        ' ,cc_multas ,cc_total_pagar,ret_proces_id	)  ' +
        ' Select [Numero Contrato],Rut,Dv,[Tipo Contrato],Arrendatario,[E-mail]  ' +
        ' , Propiedad,[Fecha Pago],[TIPO MONEDA]  ' +
        ' , [N Cuota],[Deuda Atrasada],[Gastos Comunes SA] ' +
        ' , [PERIODO DE COBRO] , [Arriendo]	 ,[Gastos Comunes CM] ,Multas ' +
        ' ,[TOTAL A PAGAR], ' + id_InsertDataRetorno + ' ' +
        ' from amh_cartera_cierta_uf_peso ' +
        ' where [Numero Contrato]  = ' + row.NUMERO_OPERACION + '; SELECT SCOPE_IDENTITY() AS idInsertDetalle;';
        let rsqyDetalle = await pool1.query(qyDetalle);
        let id_InsertDetalle = rsqyDetalle.recordset[0].idInsertDetalle;

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

        return {
            status: true,
            message: 'PROCESO CORRECTO'
        };

    } catch (err) {
        console.log('ERROR CARGA:::', err.message);
        return {
            status: false,
            message: err.message
        };

    }
}

router.post('/amh/procesarPagoMQSISX', (req, res) => {

    let data = dataToEXE().then((resp) => {

        if (resp.data.length > 0) {

            res.json({
                status: true,
                message: 'Procesando'
            });

        } else {

            return res.json({
                status: true,
                message: 'No hay registros para procesar, favor actualice la página e intente nuevamente.'
            });

        }

    });

    prepareExecuteEXE();

});


async function prepareExecuteEXE() {

    try {

        let res = await dataToEXE();    
        let dataProcess = res.data;
        
        if (dataProcess.length > 0) {

            if (res.status) {

                let resp = await executeExe(dataProcess);
                if(resp.status) {
                                    
                    return {
                        status: true,
                        message: 'Registros procesados correctamente.'
                    }

                } else {

                    return {
                        status: false,
                        message: resp.message
                    }

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

    } catch (error) {

        return {
            status: false,
            message: error.message
        }

    }
}

async function executeExe(dataProcess) {
    try {

        let i = 0;
        let x = 0;

        for (let item of dataProcess) {

            i++;
            await setTimeout(function() {
                // console.log('executeExe ejecutando::',item);
                let directorioEXE = path.join(__dirname, '../exe/Exe/procesarpago4.exe');
                let cmd = `start ${directorioEXE} ${item.id},${item.fc_pago},${item.fc_pago} `;

                childProcess.exec(cmd, function(error, stdout, stderr) {                    
                    if (error != null) {

                        console.log('error occurred: ' + error);
                        x++;

                    } else {

                        x++;
                        if(dataProcess.length === x) {
                            //ENVIAMOS MAIL TRAS FINALIZAR EJECUCION
                            prepareMail(); 
                        }                        
                    }                    

                });                

            }, 8000 * i);

        }

        return {
            status: true,
            message: 'Registros procesados correctamente.'
        }
        
    } catch (error) {

        return {
            status: false,
            message: error.message
        }

    }
}


async function prepareMail() {
    try {
        
        const infoPath = await amhController.getPathComprobantePago_Amh();
        let data = [];

        for (let item of infoPath.data) {
            let name = item.pathf.split('\\');
            name = name[name.length - 1];

            data.push({'filename': name, 'path':item.pathf});            
        }

        sendMail(data);
        
        return {
            status:true,
            message : 'Ejecución correcta'
        }

    } catch (error) {
        return {
            status: false,
            message : error.message
        }
    }
}


async function sendMail(attach) {
    try {        
        
        let rs = await transporter.sendMail({
            from: process.env.USERMAIL,
            to: process.env.TOMAIL,
            // cc:'burban.dh@gmail.com',
            subject: 'AMH - Proceso de pago',
            html:  `<!doctype html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                    </head>
                    <body>
                        <p>Estimados,<br>
                        Se adjuntan comprobantes de los pagos realizados a través de empresa de cobranza AMH.</p>
                        <br>
                        <p>Saludos,</p>

                    </body>
                    </html>
            `,
            attachments:attach

        });

        return {
            status : true,
            message : 'ok'
        }

    } catch (error) {

        return {
            status : false,
            message : error.message
        }

    }
}



// function executeEXE() {

//     dataToEXE().then((res) => {
//         let dataProcess = res.data;
//         let i = 0;
//         if (dataProcess.length > 0) {

//             if (res.status) {

//                 for (let item of dataProcess) {

//                     i++;
//                     setTimeout(function() {

//                         let directorioEXE = path.join(__dirname, '../exe/Exe/procesarpago4.exe');
//                         let cmd = `start ${directorioEXE} ${item.id},${item.fc_pago},${item.fc_pago} `;

//                         exec(cmd, (err, stdout, stderr) => {
//                             if (err) {

//                                 return;
//                             }
//                             //console.log(`Number of files ${stdout}`);
//                         });

//                     }, 8000 * i);
//                 }

//                 return {
//                     status: true,
//                     message: 'Registros procesados correctamente.'
//                 }


//             } else {
//                 console.log('res error::', res.message);
//                 return {
//                     status: false,
//                     message: res.message
//                 }
//             }
//         } else {

//             return {
//                 status: true,
//                 message: 'No hay registros para procesar.'
//             }

//         }


//     }).catch((err) => {

//         return {
//             status: false,
//             message: err.message
//         }
//     });

// }

async function dataToEXE() {

    try {
        let rsDetalleUPDATE = await pool1.connect(); // Obtenemos la conexion
        let qyProcesar = '  Select proces_id id ' +
            ' ,archi_moneda moneda ' +
            ' ,replace(convert(varchar(10),archi_fecha_pago,105),\'-\',\'/\') fc_pago ' +
            ', archi_monto_pago as monto /*,cast(case when lower(archi_moneda) = \'pesos\' then archi_monto_pago else archi_monto_pago * UF.valor_uf end as decimal(18,2)) as monto*/ ' +
            ' from amh_data_retorno ADR ' +
            '     /*inner join historico_uf UF on convert(date,ADR.archi_fecha_pago) = convert(date,UF.fecha) */ ' +
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

router.get('/amh/home', async(req, res) => {
    ssn = req.session;
    const data = await amhController.getDataVista();    
    let linksProcess = data.linksProcess;
    let linksReturn = data.linksReturn;

    res.render('amh/list', {
        links: linksReturn,
        dataProcesados: linksProcess,
        name_user: ssn.nombre,
        nombrelog: 'ssd'
    });

});

router.get('/amh/deleteDataAMH', async(req, res) => {

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


router.get('/amh/getMovimientoCaja', async(req,res) => {

    pdfCrea.createPDFMovimientoCaja(req);

    
});


module.exports = router;