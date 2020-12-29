const express = require('express');
const router = express.Router();
var session = require('express-session');
const liquidacionController = require('../controllers/liquidacionController');
const pdfcreate = require('../pdfcreate/pdf');
const fs = require('fs');
const path = require("path");

var ssn;

router.get('/liquidacion/info', async(req, res) => {
    ssn = req.session;
    let resultCtaCte = await liquidacionController.getListado_CtaCte();

    return res.render('liquidaciones/liquidacion', {
        name_user: ssn.nombre,
        nombrelog: 'ssd',
        dataCtaCte: (resultCtaCte.status ? resultCtaCte.data : null)
    });

});


router.post('/liquidacion/getPeriodo', async(req, res) => {

    let numCta = req.body.nCtaCte;
    let periodoCtaCte = await liquidacionController.getPeriodo_ctaCte(numCta);

    if (periodoCtaCte.status) {

        return res.json({
            status: true,
            message: 'Información correcta.',
            dataOK: periodoCtaCte.data
        });

    } else {

        return res.json({
            status: false,
            message: 'Problemas al obtener la información, intenta nuevamente.'
        });
    }

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
                comiAsesoria = calculoAsesoria.data[0].total_comi_asesor;
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



// router.get('/liquidacion/getDetalleAbono',async(req,res) => {

//     let { idlib } = req.query;
//     let resp = await liquidacionController.getDetalleAbono(idlib);

//     // console.log(resp);

//     if(resp.status)
//     {
//         return res.json({
//             status : true,
//             data: resp.data
//         });
//     }
//     else {

//         return res.json({
//             status : false,
//             message : resp.message
//         });
//     }    

// });


router.get('/liquidacion/getFilePdf', async(req, res) => {

    ssn = req.session;
    
    let { xCtaSelec,xPeriodoSelec } = req.query;
    let resp = await pdfcreate.createPDF( xCtaSelec, xPeriodoSelec, ssn.nombre);
    
    return res.json({
        status:resp.status,
        pathfile:resp.pathPdf,
        message:resp.message
    });   
    

});

/**
 * COMISIONES : ADMINISTRACION - ASESORIAS
 */

router.get('/liquidacion/comisionCtaCte',async(req,res) => {
    ssn = req.session;
    let respDetalle = await liquidacionController.comisiones_por_ctacte_periodoactual(0,'init');
    
    return res.render('liquidaciones/comisionctas', {
        name_user: ssn.nombre,
        nombrelog: 'ssd',
        data:respDetalle.data
    });

});

module.exports = router;