'use strict';

const fs = require("fs-extra");
const path = require("path");
const puppeteer = require('puppeteer');
const hbs = require("handlebars");
const moment = require('moment');

const liquidacion = require('../controllers/liquidacionController');
const amh = require('../controllers/amhController');


/***###################################################################
 *      COMPROBANTES CARTOLA
 * ####################################################################
 */
async function createComprobanteCargoLiquidacion(xNumCta) {
    try {      
        let numCuenta = parseInt(xNumCta);
        let montoComisionAdmin = 0;
        let montoComisionAsesoria = 0;
        let totalCargosMenosAbonos = 0;
        let montoCargoComision = await liquidacion.comisiones_por_ctacte_periodoactual(numCuenta,'');
        let sumaCargosAbonos = await liquidacion.getTotalCargos_TotalAbonos(numCuenta,'');
        let calculoComision = await liquidacion.calculoComision(numCuenta,'');        
        montoComisionAdmin = calculoComision.totalComision;
        montoComisionAsesoria = calculoComision.totalcomisionasesoria;
        totalCargosMenosAbonos = parseInt(sumaCargosAbonos.data[0].entr) - parseInt(sumaCargosAbonos.data[0].sal);        

        let montoaliquidar = parseInt(totalCargosMenosAbonos - montoComisionAdmin - montoComisionAsesoria);        
        //CARGO COMISION ADMINISTRACION
        let resppp;
        if(montoCargoComision.data[0].comi_admin > 0) {
            resppp = await creaComprobanteCargoLiquidacion_ComisionAdmin(numCuenta,montoCargoComision.data[0].comi_admin,montoCargoComision.data[0].total_comi_adm);
        }

        //CARGO COMISION ASESORIA
        let respAsesoria;
        if(montoCargoComision.data[0].comi_asesor > 0) {
            respAsesoria = await creaComprobanteCargoLiquidacion_ComisionAsesoria(numCuenta,montoCargoComision.data[0].comi_asesor,montoCargoComision.data[0].total_comi_asesor);
        }

        //ACUMULA SALDO
        let acumulaSaldo = await liquidacion.verificaAcumulaSaldo(numCuenta);
        let montoAcumulado = await liquidacion.getMontoAcumulado_EnContra_Favor(numCuenta);   
        let montoSaldoAcumulado_Save = 0;
        let respAbonoAcumSaldo;
        let saldoNegativo = false;
        let glosaFavor = 'Saldo a favor acumulado - ' + moment().format('MMMM-YYYY');
        let glosaContra = 'Saldo en contra acumulado - ' + moment().format('MMMM-YYYY');

        if(acumulaSaldo.acumulaSaldo) {
            moment.locale('es');

            if(montoAcumulado.acumulaSaldo.length > 0)
            {            
                /*  37 - Saldo a favor acumulado */            
                if(montoAcumulado.acumulaSaldo[0].cod === 37 ) {
                    //Si es saldo a favor y se acumula
                    //se genera un abono por "Saldo acumulado a favor" en caso de existir un saldo anterior se suman los montos.

                    if(montoaliquidar < 0) {

                        montoSaldoAcumulado_Save = (montoAcumulado.acumulaSaldo[0].monto - montoaliquidar);
                        if(montoSaldoAcumulado_Save > -1) {                        
                            await creaComprobanteAbono(numCuenta,montoSaldoAcumulado_Save,37,'1 Saldo a favor Acumulado',glosaFavor,'absalfavor');
                        } else {                                 
                            montoSaldoAcumulado_Save = (montoSaldoAcumulado_Save * -1); // El monto se guarda como numero positivo...
                            await creaComprobanteAbono(numCuenta,parseInt(montoSaldoAcumulado_Save),38,'2 Saldo en contra Acumulado',glosaContra,'absalcontra');
                            saldoNegativo = true;
                        }

                    } else {
                        montoSaldoAcumulado_Save = (montoAcumulado.acumulaSaldo[0].monto + montoaliquidar);
                        await creaComprobanteAbono(numCuenta,montoSaldoAcumulado_Save,37,'3 Saldo a favor Acumulado',glosaFavor,'absalfavor');
                    }

                } else if(montoAcumulado.acumulaSaldo[0].cod == 38 /*38 – Saldo Acumulado en contra */)  {
                    
                    //SI es saldo en contra y se acumula,
                    //se genera un cargo por "Saldo en contra acumulado"(con estado 0 no liquidado) sumando el monto a lo existente, 
                    // console.log('En contra montoaliquidar::',montoaliquidar);
                    if(montoaliquidar < 0) {

                        montoSaldoAcumulado_Save = (montoAcumulado.acumulaSaldo[0].monto + parseInt((montoaliquidar * -1)));
                        await creaComprobanteAbono(numCuenta,parseInt(montoSaldoAcumulado_Save),38,'4 Saldo en contra Acumulado',glosaContra,'absalcontra');
                        //Al liquidar un saldo menor a 0 se debe crear un abono por liquidacion.
                        let glosa = 'Liquidación correspondiente a ' + moment().format('MMMM-YYYY');
                        await creaComprobanteAbono(numCuenta,parseInt(montoSaldoAcumulado_Save),39,'4.1 Abono por Liquidación',glosa,'abxliq');
                        
                        saldoNegativo = true;
                    } else {

                        montoSaldoAcumulado_Save = (montoAcumulado.acumulaSaldo[0].monto - montoaliquidar);
                        if(montoSaldoAcumulado_Save === 0) {
                            await creaComprobanteAbono(numCuenta,montoSaldoAcumulado_Save,37,'5 Saldo a favor Acumulado',glosaFavor,'absalfavor');
                        }
                        else if(montoSaldoAcumulado_Save > 0) {
                            await creaComprobanteAbono(numCuenta,parseInt(montoSaldoAcumulado_Save),38,'6 Saldo en contra Acumulado',glosaContra,'absalcontra');
                            saldoNegativo = true;
                            //Al liquidar un saldo menor a 0 se debe crear un abono por liquidacion.
                            let glosa = 'Liquidación correspondiente a ' + moment().format('MMMM-YYYY');
                            await creaComprobanteAbono(numCuenta,parseInt(montoSaldoAcumulado_Save),39,'6.1 Abono por Liquidación',glosa,'abxliq');
                        }
                        else if(montoSaldoAcumulado_Save < 0){
                            montoSaldoAcumulado_Save = (montoSaldoAcumulado_Save * -1);
                            await creaComprobanteAbono(numCuenta,montoSaldoAcumulado_Save,37,'7 Saldo a favor Acumulado',glosaFavor,'absalfavor');
                        }

                    }
                }
            }
            else {

                if(montoaliquidar > -1) {
                    await creaComprobanteAbono(numCuenta,montoaliquidar,37,'8 Saldo a favor Acumulado',glosaFavor,'absalfavor');
                } else {

                    await creaComprobanteAbono(numCuenta,parseInt(montoaliquidar * -1),38,'9 Saldo en contra Acumulado',glosaContra,'absalcontra');
                    moment.locale('es');
                    //Al liquidar un saldo menor a 0 se debe crear un abono por liquidacion.
                    let glosa = 'Liquidación correspondiente a ' + moment().format('MMMM-YYYY');
                    await creaComprobanteAbono(numCuenta,parseInt(montoaliquidar * -1),39,'10 Abono por Liquidación',glosa,'abxliq');
                    saldoNegativo = true;
                }                
                
            }
        //FIN ACUMULA SALDO    
        }
        else 
        {
            //***  ESTA LISTO
            //Si es saldo a favor 
            //se liquida dejando la cuenta en "0"
            //***  ESTA LISTO        

            //SI es saldo en contra, se debe liquidar con monto "0"
            //abonando la misma cantidad del saldo en contra  "Abono por liquidación"        
            if(saldoNegativo || montoaliquidar < 0)
            {            
                moment.locale('es');
                //Al liquidar un saldo menor a 0 se debe crear un abono por liquidacion.
                let glosa = 'Liquidación correspondiente a ' + moment().format('MMMM-YYYY');
                await creaComprobanteAbono(numCuenta,(montoaliquidar * -1),39,'10 Abono por Liquidación',glosa,'abxliq');
            }

            if(!acumulaSaldo.acumulaSaldo.status && montoaliquidar < 0) {
                await creaComprobanteAbono(numCuenta,parseInt(montoaliquidar * -1),38,'11 Saldo en contra Acumulado',glosaContra,'absalcontra');
            }

        }

        // CARGO LIQUIDACION        
        if(montoCargoComision.status && (parseInt(montoaliquidar) > -1)) {
            moment.locale('es');
            let glosa = 'Liquidación correspondiente a ' + moment().format('MMMM-YYYY');
            let nameFilePdf = `cargo_liq_${numCuenta}_${moment().format('YYYYMMDD_HHmmss')}.pdf`;

            if(montoaliquidar < 0)
            montoaliquidar = (montoaliquidar * -1);

            let ts = await liquidacion.saveCargos(numCuenta,montoaliquidar,17,glosa);
            let idCargo = ts.idcargo;

            //Informacion del cargo
            let infoCargo = await liquidacion.getCargos(idCargo);
            if(infoCargo.status)
            {            
                let folderFilePdf = '/public/download/comprobantes/'+moment().format('MMMM-YYYY')+'/';
                let pathPdf = path.join(process.cwd(),folderFilePdf,nameFilePdf);

                let patCreate = path.join(process.cwd(),folderFilePdf);
                let respues = await fs.promises.mkdir(patCreate, { recursive: true })
                
                const browser = await puppeteer.launch();
                const page = await browser.newPage();

                //CREAMOS CODBAR CON ESPACIO ENTRE CARACTERES
                let codBar = '';
                let id = idCargo.toString();
                for(var i=0; i<id.length; i++) {
                    codBar += id.charAt(i) + ' ';     
                }

                //DATA PARA CREAR PDF Cargo
                let ress = {
                        idbar : codBar,
                        fecha:moment().format('DD-MM-YYYY'),
                        codigo: infoCargo.data[0].codigo,
                        nombreTitulCta:infoCargo.data[0].paguesea,
                        monto : infoCargo.data[0].monto,
                        mon_palabras : infoCargo.data[0].mon_palabras,
                        glosa : infoCargo.data[0].glosa,
                        tipoMov:'Cargo por Liquidación',
                        titulo:'CARGO POR LIQUIDACIÓN'
                    }

                //const content = await compile('format_cargo_liquidacion',ress);
                const content = await compile('format_cargo_liquidacion',ress);
                await page.setContent(content);

                await page.pdf({
                    path: pathPdf,
                    format: '',
                    printBackground: true,
                    displayHeaderFooter: false,
                    headerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:48px;">                                
                                        <span style="margin-left: 20px;"></span>
                                    </div>`,
                    footerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:48px;width:100%;text-align:center;">
                                </div>`,
                    margin: {
                        top: '20px',
                        right: '18px',
                        bottom: '28px',
                        left: '20px'
                    }
                });

                await browser.close();

                if(typeof respAbonoAcumSaldo === 'undefined') {
                    respAbonoAcumSaldo = {status : false};
                }
        
                if(typeof resppp === 'undefined') {
                    resppp = {status : false};
                }
        
                if(typeof respAsesoria === 'undefined') {
                    respAsesoria = {status : false};
                }

                return {
                    status : true,
                    pathPdf : nameFilePdf,
                    pathCrgComiAdm : resppp.status ? resppp.pathPdf : '',
                    pathAbonoSaldoAcum : respAbonoAcumSaldo.status ? respAbonoAcumSaldo.pathPdfAbono : '',
                    pathCrgAsesor : respAsesoria.status ? respAsesoria.pathPdf : '',                    
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

        }
        // else 
        // {
        //     return {
        //         status : false,
        //         message: 'Problemas con los parametrosll...! (createComprobanteCargoLiquidacion)'
        //     }
        // }
        if(typeof respAbonoAcumSaldo === 'undefined') {
            respAbonoAcumSaldo = {status : false};
        }

        if(typeof resppp === 'undefined') {
            resppp = {status : false};
        }

        if(typeof respAsesoria === 'undefined') {
            respAsesoria = {status : false};
        }

        return {
            status : true,
            pathPdf : '',
            pathCrgComiAdm : resppp.status ? resppp.pathPdf : '',
            pathAbonoSaldoAcum : respAbonoAcumSaldo.status ? respAbonoAcumSaldo.pathPdfAbono : '',
            pathCrgAsesor : respAsesoria.status ? respAsesoria.pathPdf : '',                    
            message:'Ok'
        }

    } catch (error) {       

        console.log('error (pdf):(createComprobanteCargoLiquidacion):: ',error);
        return  {
            status : false,
            message: 'ESO::' + error.message
        }
        
    }
}


/**
 * Crea cargo por concepto de Comision Administración
 * @param {*} xNumCta 
 */
async function creaComprobanteCargoLiquidacion_ComisionAdmin(xNumCta,comiadmin,montocomi) {
    try {      
                
        let numCuenta = parseInt(xNumCta);           
        
        if(comiadmin > 0) {            
            moment.locale('es');    
            let montoComiAdmin = parseInt(montocomi);
            let glosa = moment().format('MMMM-YYYY');
            
            let ts = await liquidacion.saveCargos(numCuenta,montoComiAdmin,6,glosa);            
            let idCargo = ts.idcargo;            
            let nameFilePdf = `cargo_comi_admin_${numCuenta}_${moment().format('YYYYMMDD_HHmmss')}.pdf`;

            //Informacion del cargo
            let infoCargo = await liquidacion.getCargos(idCargo);
            if(infoCargo.status)
            {            
                let folderFilePdf = '/public/download/comprobantes/'+moment().format('MMMM-YYYY')+'/';
                let pathPdf = path.join(process.cwd(),folderFilePdf,nameFilePdf);

                let patCreate = path.join(process.cwd(),folderFilePdf);
                let respues = await fs.promises.mkdir(patCreate, { recursive: true })
                
                const browser = await puppeteer.launch();
                const page = await browser.newPage();

                //CREAMOS CODBAR CON ESPACIO ENTRE CARACTERES
                let codBar = '';
                let id = idCargo.toString();
                for(var i=0; i<id.length; i++) {
                    codBar += id.charAt(i) + ' ';     
                }

                //DATA PARA CREAR PDF Cargo
                let ress = {
                        idbar : codBar,
                        fecha:moment().format('DD-MM-YYYY'),
                        codigo: infoCargo.data[0].codigo,
                        nombreTitulCta:infoCargo.data[0].paguesea,
                        monto : infoCargo.data[0].monto,
                        mon_palabras : infoCargo.data[0].mon_palabras,
                        glosa : infoCargo.data[0].glosa,
                        tipoMov:'Comisión Administración',
                        titulo:'CARGO'
                    }

                const content = await compile('format_cargo_comision',ress);
                await page.setContent(content);

                await page.pdf({
                    path: pathPdf,
                    format: '',
                    printBackground: true,
                    displayHeaderFooter: false,
                    headerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:48px;">                                
                                        <span style="margin-left: 20px;"></span>
                                    </div>`,
                    footerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:48px;width:100%;text-align:center;">
                                </div>`,
                    margin: {
                        top: '20px',
                        right: '18px',
                        bottom: '28px',
                        left: '20px'
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

        }
        else 
        {
            return {
                status : false,
                message: 'Problemas con los parametros...! (creaComprobanteCargoLiquidacion_ComisionAdmin)'
            }
        }        
        
    } catch (error) {       

        console.log('error (pdf):(creaComprobanteCargoLiquidacion_ComisionAdmin):: ',error);

        return  {
            status : false,
            message: error.message
        }
        
    }
}

/**
 * Crea cargo por comision asesoria
 * @param {*} xNumCta 
 * @param {*} comiadmin 
 * @param {*} montocomi 
 */
async function creaComprobanteCargoLiquidacion_ComisionAsesoria(xNumCta,comiadmin,montocomi) {
    try {      
                
        let numCuenta = parseInt(xNumCta);           
        
        if(comiadmin > 0) {            
            moment.locale('es');    
            let montoComiAdmin = parseInt(montocomi);
            let glosa = moment().format('MMMM-YYYY');
            
            let ts = await liquidacion.saveCargos(numCuenta,montoComiAdmin,41,glosa);            
            let idCargo = ts.idcargo;
            
            let nameFilePdf = `cargo_comi_asesoria_${numCuenta}_${moment().format('YYYYMMDD_HHmmss')}.pdf`;


            //Informacion del cargo
            let infoCargo = await liquidacion.getCargos(idCargo);
            if(infoCargo.status)
            {            
                let folderFilePdf = '/public/download/comprobantes/'+moment().format('MMMM-YYYY')+'/';
                let pathPdf = path.join(process.cwd(),folderFilePdf,nameFilePdf);
    
                let patCreate = path.join(process.cwd(),folderFilePdf);
                let respues = await fs.promises.mkdir(patCreate, { recursive: true })                
                
                const browser = await puppeteer.launch();
                const page = await browser.newPage();

                //CREAMOS CODBAR CON ESPACIO ENTRE CARACTERES
                let codBar = '';
                let id = idCargo.toString();
                for(var i=0; i<id.length; i++) {
                    codBar += id.charAt(i) + ' ';     
                }

                //DATA PARA CREAR PDF Cargo
                let ress = {
                        idbar : codBar,
                        fecha:moment().format('DD-MM-YYYY'),
                        codigo: infoCargo.data[0].codigo,
                        nombreTitulCta:infoCargo.data[0].paguesea,
                        monto : infoCargo.data[0].monto,
                        mon_palabras : infoCargo.data[0].mon_palabras,
                        glosa : infoCargo.data[0].glosa,
                        tipoMov:'Comisión Asesoria',
                        titulo:'CARGO'
                    }

                //const content = await compile('format_cargo_liquidacion',ress);
                const content = await compile('format_cargo_comision',ress);
                await page.setContent(content);

                await page.pdf({
                    path: pathPdf,
                    format: '',
                    printBackground: true,
                    displayHeaderFooter: false,
                    headerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:48px;">                                
                                        <span style="margin-left: 20px;"></span>
                                    </div>`,
                    footerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:48px;width:100%;text-align:center;">
                                </div>`,
                    margin: {
                        top: '20px',
                        right: '18px',
                        bottom: '28px',
                        left: '20px'
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

        }
        else 
        {
            return {
                status : false,
                message: 'Problemas con los parametros...! (creaComprobanteCargoLiquidacion_ComisionAsesoria)'
            }
        }        
        

    } catch (error) {       

        console.log('error (pdf):(creaComprobanteCargoLiquidacion_ComisionAsesoria):: ',error);

        return  {
            status : false,
            message: error.message
        }
        
    }
}

/**
 * Comprobante de abonos
 */

async function creaComprobanteAbono(xNumCta,xmonto,xIdMov,xNameMov,xGlosa,xNomFile) {
    try {      
                
        let numCuenta = parseInt(xNumCta);
        let glosa = xGlosa.trim();
        
        if(xmonto > 0) {            
            moment.locale('es');
            let montoComiAdmin = parseInt(xmonto);            
            
            let ts = await liquidacion.saveAbonos(numCuenta,montoComiAdmin,xIdMov,glosa);            
            let idAbono = ts.idabono;
            let nameFilePdf = `ab_${xNomFile}_${numCuenta}_${moment().format('YYMMDD_HHmmss')}.pdf`;

            //Informacion del abono
            let infoAbono = await liquidacion.getAbono(idAbono);
            if(infoAbono.status)
            {            
                let folderFilePdf = '/public/download/comprobantes/'+moment().format('MMMM-YYYY')+'/';
                let pathPdf = path.join(process.cwd(),folderFilePdf,nameFilePdf);

                let patCreate = path.join(process.cwd(),folderFilePdf);
                let respues = await fs.promises.mkdir(patCreate, { recursive: true })
                
                const browser = await puppeteer.launch();
                const page = await browser.newPage();

                //CREAMOS CODBAR CON ESPACIO ENTRE CARACTERES
                let codBar = '';
                let id = idAbono.toString();
                for(var i=0; i<id.length; i++) {
                    codBar += id.charAt(i) + ' ';     
                }

                //DATA PARA CREAR PDF ABONO
                let ress = {
                        idbar : codBar,
                        fecha:moment().format('DD-MM-YYYY'),
                        codigo: infoAbono.data[0].codigo,
                        nombreTitulCta:infoAbono.data[0].recibide,
                        monto : infoAbono.data[0].monto,
                        mon_palabras : infoAbono.data[0].mon_palabras,
                        glosa : infoAbono.data[0].glosa,
                        tipoMov:xNameMov,
                        titulo:'ABONO'
                    }

                const content = await compile('format_abonos',ress);
                await page.setContent(content);

                await page.pdf({
                    path: pathPdf,
                    format: '',
                    printBackground: true,
                    displayHeaderFooter: false,
                    headerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:48px;">                                
                                        <span style="margin-left: 20px;"></span>
                                    </div>`,
                    footerTemplate: `<div style="font-size:7px;white-space:nowrap;margin-left:48px;width:100%;text-align:center;">
                                </div>`,
                    margin: {
                        top: '20px',
                        right: '18px',
                        bottom: '28px',
                        left: '20px'
                    }
                });

                await browser.close();

                return {
                    status : true,
                    pathPdfAbono : nameFilePdf,
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

        }
        else 
        {
            return {
                status : false,
                message: 'Problemas con los parametros...! (creaComprobanteAbono)'
            }
        }        
        

    } catch (error) {       

        console.log('error (pdf):(creaComprobanteAbono):: ',error);
        return  {
            status : false,
            message: error.message
        }
        
    }
}


 /**
  * CREA ARCHIVO PDF - MOVIMIENTOS DE CAJA  
  */
async function createPDFMovimientoCaja(req,res) {
    try {            
            let namesPdf = [];
            let folderFilePdf = '/public/download/';
            let fc = req.query;
            let arGet;
            for(let ar in fc)
            {            
                arGet = ar;
            }
    
            //VERIFICAMOS QUE TENGA DATA
            if(arGet.length) {
                let arr = arGet.split(',');
    
                for(let d in arr)
                {   

                    //Recuperamos la fecha
                    let fecha = arr[d].replace('"', '').replace('"', '').toString();
                    let fcTitulo = fecha;
                    let fcAdaptado = fecha.split('-');
                    fecha = fcAdaptado[2].toString() + '-' + fcAdaptado[1].toString() + '-' + fcAdaptado[0].toString();

                    //Creamos y guardamos el nombre del archivo
                    let nameFilePdf = `mov_caja_${fecha.replace('-','_').replace('-','_')}.pdf`;
                    namesPdf.push({namesPdf});

                    //Creamos path save file pdf            
                    let pathPdf = path.join(process.cwd(),folderFilePdf,nameFilePdf);                    

                    //Buscamos la data a procesar
                    let resp = await amh.getMovCajaEnt_PorFecha(fecha);
                    
                    //Preparamos herramienta para crear archivo...
                    const browser = await puppeteer.launch();
                    const page = await browser.newPage();

                    //Preparar data para generar pdf
                    let dataFile = {
                        fc : fcTitulo,
                        data : resp.data
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
                                        Por Montalva Quindos - Huérfanos 669 Oficina 605 - Santiago, Chile <br> Fono (56-2) 345 41 00 - Fax (56-2) 345 41 48 - www.mq.cl - info@mq.cl
                                        <span style="display:inline-block;float:right;margin-right:10px;">
                                            <span class="pageNumber"></span> / <span class="totalPages"></span>
                                        </span>
                                    </div>`,
                        margin: {
                            top: '10px',
                            right: '18px',
                            bottom: '40px',
                            left: '10px'
                        }
                    });

                    await browser.close();

                } /* FIN for(let d in arr) */
                
                return {
                    status : true,
                    pathfile : namesPdf
                }

            }
            else
            {
                return {
                    status : false,
                    message : 'Sin parametros'
                }
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
        let resultComision = [];
        let xdataGB = await liquidacion.getGastosGlobales_numCuenta(numCuenta,xPeriodo);
        //let dataGBFormat = await formatGastosGlobales(xdataGB.data);
        let dataGBFormat = await liquidacion.calculoComision(numCuenta,''); 
        let xdataRes = await liquidacion.getResumenCtaCte_x_nCuenta(numCuenta,xPeriodo);
        let xdataDetalle =  await liquidacion.getDetalleMovimiento(numCuenta,xPeriodo,'');
        let dataDetalleFormat = await formatDetalle(xdataDetalle.data);        
        let sumaCargosAbonos = await liquidacion.getTotalCargos_TotalAbonos(numCuenta,'');

        let montoComisionAdmin = dataGBFormat.totalComision;
        let montoComisionAsesoria = dataGBFormat.totalcomisionasesoria;
        let totalCargosMenosAbonos = parseInt(sumaCargosAbonos.data[0].entr) - parseInt(sumaCargosAbonos.data[0].sal);

        let montoaliquidar = parseInt(totalCargosMenosAbonos - montoComisionAdmin - montoComisionAsesoria);

        resultComision.push({ 'id_mov':6,'MOV':'Comisión Administración','MONTO':dataGBFormat.totalComision  });
        resultComision.push({ 'id_mov':41,'MOV':'Comisión Asesoria','MONTO':dataGBFormat.totalcomisionasesoria  });
        resultComision.push({ 'id_mov':17,'MOV':'Liquidación','MONTO':montoaliquidar });
        resultComision.push({ 'id_mov':999,'MOV':'abonototal','MONTO':sumaCargosAbonos.data[0].entr });
        resultComision.push({ 'id_mov':998,'MOV':'cargototal','MONTO':sumaCargosAbonos.data[0].sal });
        

        return {
            status:true,
            xdataGB: xdataGB.data,
            xdataRes: xdataRes.data,
            xdataDetalle: dataDetalleFormat,
            xdataGastoComisionLiquida: resultComision
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
                DESCRIPCION : xdataDetalle[i].DESCRIPCION + ': ' + xdataDetalle[i].glosa,
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
        moment.locale('es');
        let data = await getData(numCuenta, xPeriodo);        
        //let pathRed = '\\\\mqvsfs01\\MQSIS\\SISX\\';
        let nameFilePdf = `liq_${numCuenta}_${moment().format('YYYYMMDD_HHmmss')}.pdf`;

        //Guarda información del archivo a crear...
        let result = await liquidacion.guardaInfoPdfCreado(xnombreUsuario,numCuenta,xPeriodo,nameFilePdf);

        //Informacion del propiedatario
        let rNombrePropietaro = await liquidacion.getInfoPropietario(numCuenta);
        if(result.status)
        {            
            let folderFilePdf = '/public/download/comprobantes/'+moment().format('MMMM-YYYY')+'/';
            let pathPdf = path.join(process.cwd(),folderFilePdf,nameFilePdf);        
            
            let patCreate = path.join(process.cwd(),folderFilePdf);
            let respues = await fs.promises.mkdir(patCreate, { recursive: true })

            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            let ress = {
                    idpdf : numCuenta,
                    nombrePropietario : rNombrePropietaro.nombrePropietario,
                    resu : data.xdataRes,
                    gb : data.xdataGB,
                    det : data.xdataDetalle,
                    totalLiquidacionComision : data.xdataGastoComisionLiquida,
                    periodoMes : moment().format('MMMM').toUpperCase()
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
                pathPdf : moment().format('MMMM-YYYY')+'/'+nameFilePdf,
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

async function getInfoComisionesPorCuenta(xDiaLiq) {

    

}

module.exports = { 
    createPDF,
    createPDFMovimientoCaja,
    createComprobanteCargoLiquidacion,
    creaComprobanteCargoLiquidacion_ComisionAdmin,
    getData
};