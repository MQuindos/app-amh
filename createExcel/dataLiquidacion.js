'use strict'

const XLSX = require('xlsx');
const fs = require('fs');


async function getDataLiquidacion(req,res) {

    try {

        let { xCtaSelec } = req.query;
        
        console.log('Llegamos::::::::::::::::');

        let finalHeaders = ['colA', 'colB', 'colC'];
        let data = [
            [ { colA: 1, colB: 2, colC: 3 }, { colA: 4, colB: 5, colC: 6 }, { colA: 7, colB: 8, colC: xCtaSelec } ]
            
        ];
        
        data.forEach((array, i) => {
            // let ws = XLSX.utils.json_to_sheet(array, {header: finalHeaders});
            // let wb = XLSX.utils.book_new()
            // XLSX.utils.book_append_sheet(wb, ws, "SheetJS")
            // let exportFileName = `C:\\\\Users\\mtoro\\OneDrive - Montalva Quindos\\Documents\\Otros\\workbook_${i}.xls`;
            // //let exportFileName = `\\\\Mqvsfs01\\Ctas Ctes\\workbook_${i}.xls`;
            // XLSX.writeFile(wb, exportFileName);

            let ws = XLSX.utils.json_to_sheet(array, {header: finalHeaders});
            let wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, "Liquidacion")
            XLSX.utils.book_append_sheet(wb, ws, "Cartola")
            let exportFileName = `C:\\\\Users\\mtoro\\OneDrive - Montalva Quindos\\Documents\\Otros\\workbook_${i}.xls`;
            //let exportFileName = `\\\\Mqvsfs01\\Ctas Ctes\\workbook_${i}.xls`;
            XLSX.writeFile(wb, exportFileName);

        });

    } catch (error) {

        console.log('Error getDataLiquidacion::',error.message);
        return;
    }

}

module.exports = {
    getDataLiquidacion
}

