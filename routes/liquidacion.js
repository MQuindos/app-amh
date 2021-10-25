const express = require('express');
const router = express.Router();
var session = require('express-session');
const liquidacionController = require('../controllers/liquidacionController');
const creaXlsx = require('../createExcel/dataLiquidacion');

const pdfcreate = require('../pdfcreate/pdf');
// const fs = require('fs');
// const path = require("path");

var ssn;

router.get('/liquidacion/info', async(req, res) => {
    ssn = req.session;
    let resultCtaCte = await liquidacionController.getListado_CtaCte();

    return res.render('liquidaciones/liquidacion', {
        name_user: ssn.nombre,
        nombrelog: 'ssd',
        dataCtaCte: (resultCtaCte.status ? resultCtaCte.data : null),
        namebbdd:process.env.SERVERBD
    });

});


router.post('/liquidacion/getPeriodo', async(req, res) => {

    let numCta = req.body.nCtaCte;
    let periodoCtaCte = await liquidacionController.getPeriodo_ctaCte(numCta);
    let configCtaCteSaldoAcum = await liquidacionController.getCtacte_Config_AcumSaldo(numCta);    
    let saldoAcumulado = 0;

    //VALIDAMOS EL ESTADO DE SALDO ACUMULADO...
    if(configCtaCteSaldoAcum.status && configCtaCteSaldoAcum.data.length) {
        saldoAcumulado = configCtaCteSaldoAcum.data[0].acumula_saldo
    }

    if (periodoCtaCte.status) {

        return res.json({
            status: true,
            message: 'Información correcta.',
            dataOK: periodoCtaCte.data,
            dataConfigSaldoAcum: saldoAcumulado
        });

    } else {

        return res.json({
            status: false,
            message: 'Problemas al obtener la información, intente nuevamente.'
        });
    }

});

router.post('/liquidacion/saveConfigAcumSaldo',async(req,res) => {
    return await liquidacionController.saveConfigSaldoAcum(req,res);
});


router.get('/liquidacion/getDetalleCuenta', async(req, res) => {

    let { nCtaCte, periodo, cod } = req.query;
    let respDetalle = await liquidacionController.getDetalleMovimiento(nCtaCte, periodo, cod);

    let dt = {};

    if (respDetalle.status) {
        let ids='';
        for (let i = 0; i < respDetalle.data.length; i++) {
            ids += respDetalle.data[i].idmovcaj.toString() + ',';            
        }

        /** Obtenemos el detalle del monto pagado.(lo que se pagó con el monto, canon,ggcc,servicios,etc.) */
        if(ids.length > 1)
        {
            ids = ids.substring(0,(ids.length -1));
            let resp = await liquidacionController.getDetalleAbono(ids);
            if(resp.status) {
                dt = resp.data;
            }            
        }
        
        //console.log('Response Detalle::',dt);
        return res.json({
            status: true,
            message: 'Información correcta.',
            data: respDetalle.data,
            dataDetalle: dt
        });

    } else {

        return res.json({
            status: false,
            message: 'Problemas al obtener la información, intenta nuevamente.'
        });
    }
});

router.post('/liquidacion/getResumenCta', async(req, res) => {

    let numCta = req.body.nCtaCte;
    let periodo = req.body.periodo;

    if (numCta != 0) {

        const resultCtaCte = await liquidacionController.getResumenCtaCte_x_nCuenta(numCta, periodo);
        const resultGastoGlobal = await liquidacionController.getGastosGlobales_numCuenta(numCta, periodo);
        const calculoComision = await liquidacionController.calculoComision(numCta, periodo);
        const calculoAsesoria = await liquidacionController.comisiones_por_ctacte_periodoactual(numCta,periodo);

        let resultGB = null;
        let comiAsesoria = 0;
        let porcentAsesoria = 0;
        if(calculoAsesoria.status) {
            if(calculoAsesoria.data.length > 0) {
                //comiAsesoria = calculoAsesoria.data[0].total_comi_asesor;
                comiAsesoria = calculoComision.totalcomisionasesoria;
                porcentAsesoria = calculoAsesoria.data[0].comi_asesor;
            }
        }

        if (resultGastoGlobal.status) {
            resultGB = resultGastoGlobal.data;
        }

        if (resultCtaCte.status) {

            return res.json({
                    status: true,
                    message : 'Información correcta.',
                    dataOK  : resultCtaCte.data,
                    dataGB  : resultGB,
                    dataOAD : calculoComision.resultOAD,
                    totalcomisionAdministracion : calculoComision.totalComision,
                    porcComision : calculoComision.porcentComision,
                    comiAsesoria,
                    porcentAsesoria
            });

        } else {

            return res.json({
                status: false,
                message: 'Problemas al obtener la información, intenta nuevamente.'
            });
        }

    } else {

        return res.json({
            status: false,
            message: 'Problema con el Número de Cta. Cte. Favor Actualiza el sitio.'
        });

    }

});


router.get('/liquidacion/getFilePdf', async(req, res) => {

    try {
        ssn = req.session;
    
        let { xCtaSelec,xPeriodoSelec } = req.query;
        let resp = await pdfcreate.createPDF( xCtaSelec, xPeriodoSelec, ssn.nombre);
        let respComprobante = await pdfcreate.createComprobanteCargoLiquidacion(xCtaSelec);

        return res.json({
            status:resp.status,
            pathfile:resp.pathPdf,
            pathPdf: respComprobante.pathPdf,
            pathPdfCargoComAdm : respComprobante.pathCrgComiAdm,
            pathPdfCargoComAsesor : respComprobante.pathCrgAsesor,
            message:resp.message
        });    

    } catch (error) {

        console.log(error);
        return res.json({
            status:false,
            message:error.message
        });
        
    }    

});


/**
 * COMPROBANTES
*/
router.get('/liquidacion/getComprobanteLiqCargo', async(req, res) => {

    ssn = req.session;

    try {
        
        let { xCtaSelec } = req.query;
        let resp = await pdfcreate.createComprobanteCargoLiquidacion(xCtaSelec);
        if(resp.status) {

            res.json({
                status : resp.status,
                pathPdf: resp.pathPdf,
                pathPdfCargoComAdm : resp.pathCrgComiAdm,
                pathPdfCargoComAsesor : resp.pathCrgAsesor,
                message :resp.message
            });
            
        }
        else
        {
            res.json({
                status : false,
                message : resp.message
            });
        }    
    } catch (error) {
        res.json( {
            status : false,
            message: error.message
        });
    }

});


/**
 * COMISIONES : ADMINISTRACION - ASESORIAS
 */
router.get('/liquidacion/comisionCtaCte',async(req,res) => {
    ssn = req.session;
    //let respDetalle = await liquidacionController.comisiones_por_ctacte_periodoactual(0,'init');

    return res.render('liquidaciones/comisionctas', {
        name_user: ssn.nombre,
        nombrelog: 'ssd',
        namebbdd:process.env.SERVERBD
        //data:respDetalle.data
    });

});

router.get('/liquidacion/comisionCtaCtePorDiaLiquidacion',async(req,res) => {

    return await liquidacionController.getDataVista_ComisionPorCuenta(req,res);

});


router.get('/liquidacion/getDataExcel', async(req, res) => {

        ssn = req.session;        
        return await creaXlsx.getDataLiquidacion(req,res);         

});

module.exports = router;