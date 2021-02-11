/**
 * Entrega numero del mes de acuerdo al parametro. 
 * @param {STRING Nombre del mes} mes 
 */
async function monthToNumber(mes)
{
    let numMes = 0;
    mes = mes.trim();
    mes = mes.toUpperCase();
    if(mes != '')
    {        
        if(mes == 'ENERO')
            numMes = 1;
        else if(mes == 'FEBRERO')
            numMes = 2;
        else if(mes == 'MARZO')
            numMes = 3;
        else if(mes == 'ABRIL')
            numMes = 4;
        else if(mes == 'MAYO')
            numMes = 5;
        else if(mes == 'JUNIO')
            numMes = 6;
        else if(mes == 'JULIO')
            numMes = 7;
        else if(mes == 'AGOSTO')
            numMes = 8;
        else if(mes == 'SEPTIEMBRE')
            numMes = 9;
        else if(mes == 'OCTUBRE')
            numMes = 10;
        else if(mes == 'NOVIEMBRE')
            numMes = 11;
        else if(mes == 'DICIEMBRE')
            numMes = 12;

        return {
            numMes
        }
        
    }    
    
}

module.exports = {
    monthToNumber
}
