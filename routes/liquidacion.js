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
        const dOrdenAdmin = await liquidacionController.infoOrdenAdministracion(numCta);
        const dComision = await liquidacionController.getInfoComision(numCta,periodo);
        const propSanCamilo = await liquidacionController.getPropiedadesArrendadasXSanCamilo();
        let codPropiedadSanCamilo = [];
        if(parseInt(numCta) == 10203) {

            if(propSanCamilo.status) {

                for (let z = 0; z < propSanCamilo.data.length; z++) {

                    codPropiedadSanCamilo.push(propSanCamilo.data[z].cod_propiedad);                    
                }
            }
        }        
        
        let resultGB = null;
        let resultOAD = null;

        if (resultGastoGlobal.status) {
            resultGB = resultGastoGlobal.data;
        }

        let totalComision = 0;
        let calcComision = 0;
        let totalCargos = 0;
        let porcentComision = 0;

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
                    else if(numCta == 10203) {
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
                    else {

                        /**
                         * CALCULO COMISION TODAS LAS CUENTAS...
                         *  1:Arriendos, 3:Multas, 14:Rebaja de Arriendos, 15:Rebaja de Multas , 42:Anulacion Arriendos.*/
                        if(dComision.data[i].id_mov == 1 || 
                            dComision.data[i].id_mov == 3 || 
                            dComision.data[i].id_mov == 14 || 
                            dComision.data[i].id_mov == 15 || 
                            dComision.data[i].id_mov == 42 ) {

                            calcComision += parseInt(dComision.data[i].ABONO);
                            // console.log('CARGO::',dComision.data[i].CARGO);
                            totalCargos += parseInt(dComision.data[i].CARGO);
                        }
                    }
                }

                //Calculamos el porcentaje de Comision
                totalComision = ((porcentComision / 100) * (calcComision - totalCargos));
                // console.log('totalComision 1 :',totalComision);
                //Calculamos y Sumamos el IVA 19%
                //console.log('Calculo Comision Asesoria::',( (5 / 100) * (calcComision - totalCargos)));
                totalComision = (totalComision + ( (19 / 100) * totalComision)).toFixed(1);
                
                //console.log('Total para calculo comision',calcComision,' Total comision::',totalComision, ' Total Cargos:',totalCargos);
            }
        }

        if (resultCtaCte.status) {

            return res.json({
                status: true,
                message : 'Información correcta.',
                dataOK  : resultCtaCte.data,
                dataGB  : resultGB,
                dataOAD : resultOAD,
                totalcomisionAdministracion : totalComision,
                porcComision : porcentComision
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
    let respDetalle = await liquidacionController.comisiones_por_ctacte_periodoactual(0);
    
    return res.render('liquidaciones/comisionctas', {
        name_user: ssn.nombre,
        nombrelog: 'ssd',
        data:respDetalle.data
    });

});

module.exports = router;