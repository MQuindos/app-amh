'use strict'

const XLSX = require('xlsx');
const fs = require('fs');
const moment = require('moment');
const path = require('path');
const liquidacionCtller = require('../controllers/liquidacionController');

async function getDataLiquidacion(req,res) {

    try {
        moment.locale('es');

        let { xCtaSelec } = req.query;
        
        console.log('Llegamos::::::::::::::::');

        //Comprobamos exitencia de carpeta        
        let folderFilePdf = '/public/download/borradorcartola/'+moment().format('MMMM-YYYY')+'/';        
        let patCreate = path.join(process.cwd(),folderFilePdf);
        let respues = await fs.promises.mkdir(patCreate, { recursive: true })

        //Preparamos la data para la creacion del archivo...
        
        let resumen = [];
        let detalleMov = [];

        let dataResumen = await liquidacionCtller.getResumenCtaCte_x_nCuenta(xCtaSelec,'init');
        resumen = [dataResumen.data];

        let detalleMovimiento = await liquidacionCtller.getDetalleMovimiento(xCtaSelec,'init','');
        detalleMov = [detalleMovimiento.data];

        let ws;
        let wb;
        resumen.forEach((array, i) => {
            ws = XLSX.utils.json_to_sheet(array);
            wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, "Resumen")
        });

        detalleMov.forEach((array, i) => {
            //ws = XLSX.utils.json_to_sheet(array,{finalHeadersX});
            ws = XLSX.utils.json_to_sheet(array);
            XLSX.utils.book_append_sheet(wb, ws, "Detalle Movimientos")
        });

        let namefile = moment().format('MMMM-YYYY')+`/BDOR_CTA_${xCtaSelec}_`+ moment().format('Hmmss')+`.xls`;
        let exportFileName = path.join(__dirname,'../public/download/borradorcartola/'+namefile);
        XLSX.writeFile(wb, exportFileName);



/*
let ws;
        let wb;
        data.forEach((array, i) => {
            ws = XLSX.utils.json_to_sheet(array);
            wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, "Liquidacion")
            //XLSX.utils.book_append_sheet(wb, ws, "Cartola")
            
            let namefile = moment().format('MMMM-YYYY')+`/BDOR_CTA_${xCtaSelec}_`+ moment().format('Hmmss')+`.xls`;            
            let exportFileName = path.join(__dirname,'../public/download/borradorcartola/'+namefile);
            XLSX.writeFile(wb, exportFileName);
        });
 */


        return res.json({
            status:true
        });

    } catch (error) {

        console.log('Error getDataLiquidacion::',error.message);
        return;
    }

}

module.exports = {
    getDataLiquidacion
}

