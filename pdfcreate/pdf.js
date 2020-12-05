const fs = require("fs-extra");
const path = require("path");
const puppeteer = require('puppeteer');
const hbs = require("handlebars");
const moment = require('moment');

const liquidacion = require('../controllers/liquidacionController');
const amh = require('../controllers/amhController');


/***###################################################################
 *      AMH
 * ####################################################################
 */


 /**
  * CREA ARCHIVO PDF - MOVIMIENTOS DE CAJA  
  */
async function createPDFMovimientoCaja(xArr) {
    try {

        //let nameFilePdf = `movimiento_caja_${moment().format('YYYYMMDD_HHmmss')}.pdf`;
        let namesPdf = [];

        let folderFilePdf = '/public/download/';

        //recorremos xArr
        for (let i = 0; i < xArr.length; i++) {
            //Recuperamos la fecha
            let fecha = xArr[i].toString();

            //Creamos y guardamos el nombre del archivo
            let nameFilePdf = `mov_caja_${fecha.replace('-','')}.pdf`;
            namesPdf.push({namesPdf});

            //Creamos path Folder save file pdf            
            let pathPdf = path.join(process.cwd(),folderFilePdf,nameFilePdf);

            //Buscamos la data a procesar
            let resp = await amh.getMovCajaEnt_PorFecha(fecha);

            //Preparamos herramienta para crear arcjhivo...
            const browser = await puppeteer.launch();
            const page = await browser.newPage();

            //Preparar data para generar pdf

            let dataFile = {
                fc : fecha
            }

            //Creamos el archivo pdf con la informacion recopilada
            const content = await compile('formatAmhMovimientosCaja',dataFile);
            await page.setContent(content);

            await page.pdf({
                path: pathPdf,
                format: '',
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:38px;">                                
                                    <span style="margin-left: 10px;"></span>
                                </div>`,
                footerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:38px;width:100%;text-align:center;">
                                Por Montalva Quindos - www.mq.cl - info@mq.cl
                                <span style="display:inline-block;float:right;margin-right:10px;">
                                    <span class="pageNumber"></span> / <span class="totalPages"></span>
                                </span>
                            </div>`,
                margin: {
                    top: '10px',
                    right: '18px',
                    bottom: '38px',
                    left: '10px'
                }
            });

            await browser.close();

        }       


        return {
            status : true,
            pathfile : namesPdf
        }

        
    } catch (error) {
        
        return {
            status : false,
            message : error.message
        }
    }
    
}



/***###################################################################
 *      LIQUIDACION
 * ####################################################################
 */
async function getData(numCuenta,xPeriodo) {
    try {       
        
        let xdataGB = await liquidacion.getGastosGlobales_numCuenta(numCuenta,xPeriodo);
        let dataGBFormat = await formatGastosGlobales(xdataGB.data);

        let xdataRes = await liquidacion.getResumenCtaCte_x_nCuenta(numCuenta,xPeriodo);

        let xdataDetalle =  await liquidacion.getDetalleMovimiento(numCuenta,xPeriodo,'');
        let dataDetalleFormat = await formatDetalle(xdataDetalle.data);
        
        return {
            status:true,
            xdataGB: xdataGB.data,
            xdataRes: xdataRes.data,
            xdataDetalle: dataDetalleFormat,
            xdataGastoComisionLiquida: dataGBFormat
        }

    } catch (error) {
        console.log('Problema en getData(),pdf.js ',error);
        return {
            status:false
        }
    }
}

function formatGastosGlobales(xDataGb)
{
    let result = [];
    let totalComision = 0;
    let totalLiquidacion = 0;
    for (var i = 0; i < xDataGb.length; i++) {

        if(parseInt(xDataGb[i].id_mov) === 6) //6 - Comisión Administración
        {
            totalComision += parseInt(xDataGb[i].MONTO);
        }
        else if(parseInt(xDataGb[i].id_mov) === 17) // 17 - Cargo por Liquidación
        {
            totalLiquidacion += parseInt(xDataGb[i].MONTO);
        }
    }

    result.push({ 'id_mov':6,'MOV':'Comisión Administración','MONTO':totalComision  });
    result.push({ 'id_mov':17,'MOV':'Cargo por Liquidación','MONTO':totalLiquidacion  });

    return result;

}

function formatDetalle(xdataDetalle)
{    
    let result = [];
    let totalDetalle = 0;
    for (var i = 0; i < xdataDetalle.length; i++) 
    { 
        totalDetalle += parseInt(xdataDetalle[i].ABONO) - parseInt(xdataDetalle[i].CARGO);
        result.push(
            {
                ID : i + 1,
                TIPO : xdataDetalle[i].TIPO,
                FECHA : xdataDetalle[i].FECHA,
                PROPIEDAD : xdataDetalle[i].PROPIEDAD,
                NUM_CUENTA : xdataDetalle[i]['N° CUENTA'],
                DESCRIPCION : xdataDetalle[i].DESCRIPCION,
                CARGO : xdataDetalle[i].CARGO,
                ABONO : xdataDetalle[i].ABONO,
                TOTALDETALLE : totalDetalle
            }
        );
    }

    return result;
}

const compile = async function(templateName, data) {
    const filePath = path.join(process.cwd(),'pdfcreate',`${templateName}.hbs`);
    const html = await fs.readFile(filePath,'utf-8');
    
    return await hbs.compile(html)(data);
};

async function createPDF(numCuenta, xPeriodo , xnombreUsuario) {
    try {      
        
        let data = await getData(numCuenta, xPeriodo);        
        //let pathRed = '\\\\mqvsfs01\\MQSIS\\SISX\\';
        let nameFilePdf = `liq_${numCuenta}_${moment().format('YYYYMMDD_HHmmss')}.pdf`;

        //Guarda información del archivo a crear...
        let result = await liquidacion.guardaInfoPdfCreado(xnombreUsuario,numCuenta,xPeriodo,nameFilePdf);

        //Informacion del propiedatario
        let rNombrePropietaro = await liquidacion.getInfoPropietario(numCuenta);
        if(result.status)
        {            
            let folderFilePdf = '/public/download/';        
            let pathPdf = path.join(process.cwd(),folderFilePdf,nameFilePdf);        
            //let pathPdf = path.join(pathRed,'Liquidaciones_pdf',`file.pdf`);
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            let ress = {
                    idpdf : result.idpdf,
                    nombrePropietario : rNombrePropietaro.nombrePropietario,
                    resu : data.xdataRes,
                    gb : data.xdataGB,
                    det : data.xdataDetalle,
                    totalLiquidacionComision : data.xdataGastoComisionLiquida
                }

            const content = await compile('format',ress);
            await page.setContent(content);

            await page.pdf({
                path: pathPdf,
                format: '',
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:38px;">                                
                                    <span style="margin-left: 10px;"></span>
                                </div>`,
                footerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:38px;width:100%;text-align:center;">
                                Por Montalva Quindos - www.mq.cl - info@mq.cl
                                <span style="display:inline-block;float:right;margin-right:10px;">
                                    <span class="pageNumber"></span> / <span class="totalPages"></span>
                                </span>
                            </div>`,
                margin: {
                    top: '10px',
                    right: '18px',
                    bottom: '38px',
                    left: '10px'
                }
            });

            await browser.close();

            return {
                status : true,
                pathPdf : nameFilePdf,
                message:'Ok'
            }
        }
        else
        {
            return {
                status : false,
                message : 'Problemas al crear archivo pdf, favor intenta nuevamente.'
            }
        }

    } catch (error) {       

        return {
            status : false,
            message: error
        }
        
    }
}

module.exports = { 
    createPDF,
    createPDFMovimientoCaja 
};