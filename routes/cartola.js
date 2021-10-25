
require('dotenv').config();
const express = require('express');
const router = express.Router();
const session = require('express-session');
const moment = require('moment');

const pdfCrea = require('../pdfcreate/pdfcreatecartola');
const cartolaControl = require('../controllers/cartolaController');
const liqControl = require('../controllers/liquidacionController');

var ssn;

router.get('/cartola/vistagenerarcartola', async(req, res) => {

    //return await cartolaControl.getVistaCartola(req,res);
    ssn = req.session;
    let resultCtaCte = await liqControl.getListado_CtaCte();

    return res.render('cartola/cartola', {
        name_user: ssn.nombre,
        nombrelog: 'ssd',
        dataCtaCte: (resultCtaCte.status ? resultCtaCte.data : null),
        namebbdd:process.env.SERVERBD
    });

});

router.get('/cartola/generacartola',async (req, res) => {

    return await pdfCrea.creaCartola(req,res);    

});

router.post('/cartola/getResumenCta', async(req, res) => {

    let numCta = req.body.nCtaCte;
    let periodo = req.body.periodo;

    if (numCta != 0) {

        const resultCtaCte = await cartolaControl.getResumenCtaCte_x_nCuentaYPeriodo(numCta, periodo);
        const resultGastoGlobal = await cartolaControl.getGastosGlobales_numCuentaYPeriodo(numCta, periodo);
        const calculoComision = await liqControl.calculoComision(numCta, periodo);
        const calculoAsesoria = await liqControl.comisiones_por_ctacte_periodoactual(numCta,periodo);

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

        //41 asesoria ,17 Cargo Liqui, 6 administracion

        if (resultCtaCte.status) {

            return res.json({
                    status: true,
                    message : 'Información correcta.',
                    dataOK  : resultCtaCte.data,
                    dataGB  : resultGB,                    
                    porcComision : calculoComision.porcentComision,
                    porcentAsesoria
                    //dataOAD : calculoComision.resultOAD,
                    //totalcomisionAdministracion : calculoComision.totalComision,
                    //comiAsesoria,
                    
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


router.get('/cartola/getDetalleMovimiento_Cartola', async(req, res) => {

    let { nCtaCte, periodo, cod } = req.query;
    let respDetalle = await cartolaControl.getDetalleMovimiento_Cartola(nCtaCte, periodo, cod);

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
            let resp = await cartolaControl.getDetalleAbono_Cartola(ids);
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

module.exports = router;