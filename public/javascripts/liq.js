
    function separadorMiles(val) {
        return val.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ".");        
    }

    function clearValores()
    {
        $('#val_liq').html('');
        $('#val_comis').html('');
        $('#rs_footertotal').html('');              
        $('#xResumenGB').html('');
        $('#mg_footertotal').html('');
        $('#xResumen').html('');       
        
    }
/*
    function getDeAbono(xid)
    {

        $.ajax({
            method: 'GET',        
            data: { 'idlib':xid },
            url: '/liquidacion/getDetalleAbono',
            success: function (response) {
                console.log(response);
                if(response.status) {

                    let html =  `                
                        <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Fecha Deuda</th>
                                <th>Tipo</th>
                                <th>Pago $</th>
                                <th>Pago UF</th>                                
                            </tr>
                        </thead>
                        <tbody>
                    `;
                    let tb = ``;
                    let i = 1;
                    for(let reg in response.data)
                    {   
                        tb += `<tr> 
                                <th scope="row">`+ i +`</th>
                                <td>`+response.data[reg].fechadeuda+`</td>
                                <td>`+response.data[reg].item+`</td>                                
                                <td>`+ separadorMiles(parseInt(response.data[reg].pagopeso)) +`</td>
                                <td>`+ separadorMiles(parseInt(response.data[reg].pagouf)) +`</td>
                            </tr>`;
                        i++;

                    }

                    html += tb + `</tbody> </table>`;
                    // console.log(html);
                    $('#detalleContenidoAbono').html(html);                    
                    //$("#btnclickmodal").trigger();
                    $('#modalAbono').modal({show:true});
                    //$('#modalAbono').modal('show');                   
                    
                }
                else {

                    let hmlError = response.message;
                    $('#txtResult').html(hmlError);
                    $("#modalMessage").modal('show'); 

                }
            }

        });

    }

*/

    function verInfo(x,nomPropiedad) {

        var eCta = document.getElementById("sl_ctacte");
        var xCta = eCta.options[eCta.selectedIndex].value;
        var e = document.getElementById("sl_periodo");
        var xPeriodo = e.options[e.selectedIndex].value;

        $.ajax({
            method: 'GET',        
            data: { 'nCtaCte':xCta, 'periodo':xPeriodo, 'cod':x },
            url: '/liquidacion/getDetalleCuenta',
            success: function (response) {

                //console.log('response::',response);

                if(response.status) {

                    let htmlDetalle = `                
                            <table class="table table-hover" id="mTable">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Fecha</th>
                                    <th>Tipo</th>
                                    <th>Glosa</th>
                                    <th>Cargo</th>
                                    <th>Abono</th>
                                    <th>Saldo</th>
                                </tr>
                            </thead>
                            <tbody class="panel">
                    `;

                    let tb = ``;    
                    let i = 1;
                    let saldoDet = 0;
                    let abono = 0;
                    let cargo = 0;
                    let idmovcaj = 0;
                    for(let reg in response.data)
                    {   
                        idmovcaj = response.data[reg].idmovcaj
                        cargo = parseInt(response.data[reg].CARGO);
                        abono = parseInt(response.data[reg].ABONO);

                        if(abono > 0)
                            saldoDet += abono;
                        else
                            saldoDet -= cargo;
                        
                        /**
                         * Recorremos la data del detalle y creamos el cuerpo de la tabla con la info. 
                         */    
                        let bodyTableDetalle = '';
                        if(response.dataDetalle.length > 0)
                        {                        
                            for(let row in response.dataDetalle) {

                                if(idmovcaj == response.dataDetalle[row].idmovcaj )
                                {
                                    bodyTableDetalle += `
                                        <tr>
                                            <th scope="row" class="pclass">` + response.dataDetalle[row].id_recibo + `</th>
                                            <td class="pclass">` + response.dataDetalle[row].fechadeuda +`</td>
                                            <td class="pclass">` + response.dataDetalle[row].item +`</td>
                                            <td class="pclass">` + separadorMiles(response.dataDetalle[row].pagopeso) +`</td>
                                            <td class="pclass">` + response.dataDetalle[row].pagouf +`</td>
                                        </tr>
                                    `;
                                }                                
                            }
                        }

                        let iddatatarget = 'd'+idmovcaj;
                        tb += `<tr data-toggle="collapse" data-target="#`+ iddatatarget+`" data-parent="#mTable"> 
                                <th scope="row">`+ i +`.-</th>
                                <td>`+response.data[reg].FECHA+`</td>
                                <td>`+response.data[reg].DESCRIPCION+`</td>
                                <td><p class="overflow-visible pclass">`+ response.data[reg].glosa +`</p></td>
                                <td>`+ separadorMiles(cargo) +`</td>
                                <td>`+ separadorMiles(abono) +`</td>
                                <td>`+ separadorMiles(saldoDet) +`</td>
                            </tr>
                            <tr id="`+ iddatatarget+`" class="collapse">
                                <td colspan="1" class="hiddenRow"></td>
                                <td colspan="6" class="hiddenRow">                                    
                                    <table class="table table-sm table-hover" >
                                        <thead>
                                            <tr>
                                                <th class="pclass">N° Recibo</th>
                                                <th class="pclass">Fecha Deuda</th>
                                                <th class="pclass">Item</th>
                                                <th class="pclass">Monto Pagado $</th>
                                                <th class="pclass">Monto Pagado UF</th>
                                            </tr>
                                        </thead>  
                                        <tbody>
                                        `+
                                        bodyTableDetalle
                                        +
                                        `                                            
                                        </tbody>
                                    </table>                                    
                                </td>
                            </tr>
                            `;

                        i++;
                    }
                   
                    htmlDetalle += tb + `</tbody> </table>`;
                    $('#detalleContenido').html(htmlDetalle);
                    $('#titlePropiedad').html(nomPropiedad);
                    
                    $('#modalCart').modal('show');
                }
                else
                {
                    console.log('response::',response);
                    let hmlError = response.message;
                    $('#txtResult').html(hmlError);
                    $("#modalMessage").modal('show');                
                }
            }
        });

    }

    document.getElementById('sl_ctacte').addEventListener('change', function () {
         
        document.getElementById("lnk_file").hidden = true;
        let nCtaCte = this.selectedOptions[0].value;        
        if(nCtaCte.trim() !== 'init' && nCtaCte.trim() !== '')
        {            
            $('#divOpcionSaldo').toggle(true);
            clearValores();

            $.ajax({
                method: 'POST',        
                data: {'nCtaCte' : nCtaCte},
                url: '/liquidacion/getPeriodo',
                success: function (response) {

                    if(response.status)
                    {
                        let html = '<option selected="selected" value="init">-- Periodo actual --</option>';

                        for(let reg in response.dataOK)
                        {   
                            html += '<option value="'+response.dataOK[reg].periodo+'">'+response.dataOK[reg].periodo+'</option> ';                        
                        }

                        $('#sl_periodo').html(html);
                        $('#sl_periodo').selectpicker('refresh');

                        //Marcamos el radio correspondeiente a saldo acumulado (si/no)
                        (parseInt(response.dataConfigSaldoAcum) === 1) ? $("#customRadioInline1").prop("checked", true) : $("#customRadioInline2").prop("checked", true);
                        
                    }    
                    else
                    {
                        let html = response.message;
                        $('#txtResult').html(html);
                        $("#modalMessage").modal('show');
                    }           
                }
            });
        }
        else
        {
            $('#divOpcionSaldo').toggle(false);
            $("#customRadioInline2").prop("checked", true);
            // document.getElementById("btnCargo").hidden = true;
            document.getElementById("btnGeneraLiq").hidden = true;
            
            let html = '<option selected="selected" value="init">-- Selecciona Cuenta Corriente --</option>';
            $('#sl_periodo').html(html);
            clearValores();        
        }
        
    });

    document.getElementById('btnEnviar').addEventListener('click', function () {

        var eCta = document.getElementById("sl_ctacte");
        var xCtaSelec = eCta.options[eCta.selectedIndex].value;
        var e = document.getElementById("sl_periodo");
        var xPeriodoSelec = e.options[e.selectedIndex].value;

        if(xCtaSelec.trim() != 'init' && xCtaSelec.trim() != '')
        {
            if(xPeriodoSelec == 'init' || xPeriodoSelec == '') {
                // document.getElementById("btnCargo").hidden = false;
                document.getElementById("btnGeneraLiq").hidden = false;
            }
            else 
            {
                // document.getElementById("btnCargo").hidden = true;
                document.getElementById("btnGeneraLiq").hidden = true;
            }

            document.getElementById("idLoad").hidden = false;            

            $.ajax({
                method: 'POST',        
                data: {'nCtaCte' : xCtaSelec,'periodo':xPeriodoSelec},
                url: '/liquidacion/getResumenCta',
                success: function (response) {     
                    
                    console.log(response);
                    if(response.status)
                    {
                        //RESUMEN
                        let data = response.dataOK;
                        let comisionAdmin = response.totalcomisionAdministracion;
                        let porceComision = response.porcComision;
                        let proceAsesoria = response.porcentAsesoria;
                        let comiAsesoria = response.comiAsesoria;
                        let xHtml = '';
                        let i = 0;
                        let saldoFormat = 0;
                        let ingresoFormat = 0;
                        let egresoFormat = 0;
                        
                        $('#valEnContra').html('$ 0');
                        $('#valAcum').html('$ 0');

                        for(let reg in data)
                        {
                            i++;
                            saldoFormat += parseInt(data[reg].TOTAL_RESUMEN);
                            ingresoFormat += parseInt(data[reg].INGRESOS);
                            egresoFormat += parseInt(data[reg].EGRESOS);
                            xHtml += `<tr>          
                                        <th scope="row">`+ i +`</th>                          
                                        <td class="titulos">  <a title="Ver detalle" class="text-primary" onclick="verInfo('` + data[reg].COD +`','`+data[reg].INMUEBLE + `')" style="cursor:pointer;">` + data[reg].INMUEBLE + ` </a> </td>
                                        <td>` + data[reg].ARRENDATARIO+`</td>                                    
                                        
                                        <td style="`+(parseInt(data[reg].TOTAL_RESUMEN) < 0 ? 'color:#F40E26':'')+`"> $ ` + separadorMiles(data[reg].TOTAL_RESUMEN)+`</td>                                        
                                    </tr> `;

                        } /** FIN FOR data */

                        /** FOOTER TABLA RESUMEN */
                        let xFooter = `<div class="col-sm-3" ><b>Total</b> </div>
                                    <div class="col-sm-3" ></div>                 
                                    <div class="col-sm-3" ></div>
                                    <div class="col-sm-3" ><b>Saldo: $ ` + separadorMiles(saldoFormat) +`</b></div>
                                     `;

                                    // <div class="col-sm-3" ><b>Ingresos: $ ` + separadorMiles(ingresoFormat) +`</b></div>                 
                                    // <div class="col-sm-3" ><b>Egresos: $ ` + separadorMiles(egresoFormat) +`</b></div>
                
                        $('#rs_footertotal').html(xFooter);
                        $('#xResumen').html(xHtml);

                        //GASTOS GENERALES
                        let dataGB = response.dataGB;
                        let xHtmlGB = '';
                        let x = 0;
                        let totalIng = 0;
                        let totalSal = 0;
                        let saldoTotal = 0;
                        // let calcComision = 0;
                        // let calcLiquidacion = 0;
                        // let totalItems = 0;
                        
                        for(let regGB in dataGB)
                        {                            

                            /* 
                                6 - Comisión Administración  
                                ||  17 - Cargo por Liquidación  
                                || 41 - Comisiones 
                                || 37 - Saldo a favor acumulado
                                || 38 - Saldo en contra acumulado
                            */
                            if(parseInt(dataGB[regGB].id_mov) != 6 
                                && parseInt(dataGB[regGB].id_mov) != 17 
                                && parseInt(dataGB[regGB].id_mov) != 41 
                                && parseInt(dataGB[regGB].id_mov) != 37 
                                && parseInt(dataGB[regGB].id_mov) != 38 
                                )
                            {
                                
                                if(dataGB[regGB].genera == 'entrada')
                                {
                                    saldoTotal += parseInt(dataGB[regGB].MONTO);
                                    totalIng += parseInt(dataGB[regGB].MONTO);
                                } else {
                                    totalSal += parseInt(dataGB[regGB].MONTO);
                                    saldoTotal -= parseInt(dataGB[regGB].MONTO);
                                }

                                x++;
                                xHtmlGB += `
                                        <tr>          
                                            <th scope="row">`+ x +`</th>                          
                                            <td>` + dataGB[regGB].FECHA+`</td>
                                            <td title='` + dataGB[regGB].glosa + `'>` + dataGB[regGB].MOV+`</td>  
                                            
                                            <td>$ ` + separadorMiles(saldoTotal) +`</td>
                                        </tr> `;          

                                        // <td>$ ` + separadorMiles((dataGB[regGB].genera == 'entrada'? dataGB[regGB].MONTO : 0)) +`</td>
                                        //     <td>$ ` + separadorMiles((dataGB[regGB].genera == 'salida'?  dataGB[regGB].MONTO : 0)) +`</td>
                            }

                            
                            //SALDOS ACUMULADOS
                            if(parseInt(dataGB[regGB].id_mov) === 37 ) {
                                $('#valAcum').html('$ ' + separadorMiles(dataGB[regGB].MONTO));
                            }

                            //SALDOS ACUMULADOS EN CONTRA...
                            if(parseInt(dataGB[regGB].id_mov) === 38) {
                                
                                $('#valEnContra').html('$ ' + separadorMiles(dataGB[regGB].MONTO));
                            }
                            // else //OBTIENE EL VALOR DE COMISION Y MONTO LIQUIDADO INGRESADO EN MQSIS
                            // {
                            //     if(parseInt(dataGB[regGB].id_mov) == 6)    
                            //     {
                            //         $('#val_comis').html(`<p class="text-secondary">$ ` + separadorMiles(dataGB[regGB].MONTO) +  `</p>`);
                            //     }
                            //     else if(parseInt(dataGB[regGB].id_mov) == 17) {
                            //         $('#val_liq').html(` <b> $ ` + separadorMiles( dataGB[regGB].MONTO)+  `</b> `);    
                            //     }
                            // }

                        } /** FIN FOR  dataGB */


                        /** TOTAL GASTOS GENERALES */
                        if(x > 0) {
                            $('#xResumenGB').html(xHtmlGB);

                            let xFooterMg = `<div class="col-sm-3" ><b>Total</b> </div>
                                <div class="col-sm-3" ><b></b></div>                 
                                <div class="col-sm-2" ><b></b></div>
                                <div class="col-sm-3" ><b>Saldo: $ ` + separadorMiles(saldoTotal) +`</b></div>
                             `;

                                // <div class="col-sm-3" ><b>Ingresos: $ ` + separadorMiles(totalIng) +`</b></div>                 
                                // <div class="col-sm-3" ><b>Egresos: $ ` + separadorMiles(totalSal) +`</b></div>

                            $('#mg_footertotal').html(xFooterMg);

                        }
                        
                        /** TOTAL ASESORIA */
                        $('#val_asesoria').html(`<b><p class="text-secondary">$ ` + separadorMiles(comiAsesoria) + `</p></b>`);
                        $('#txtPorcentAsesoria').html('<b><p>Comisión Asesoria (' + proceAsesoria + '%)</p></b>');

                        /** TOTAL LIQUIDACION */
                        $('#val_comis').html(`<b><p class="text-secondary">$ ` + separadorMiles(comisionAdmin) + `</p></b>`);
                        $('#txtPorcentComision').html('<b><p>Comisión Administración (' + porceComision + '%) + IVA</p></b>');
                        $('#val_liq').html(`<b> $ ` + separadorMiles(parseInt(saldoFormat) - parseInt(comisionAdmin) + parseInt(saldoTotal) - parseInt(comiAsesoria)) +  `</b> `);                        

                        document.getElementById("idLoad").hidden = true;
                    }
                    else
                    {
                        // console.log('response::',response);
                        let hmlError = response.message ;
                        $('#txtResult').html(hmlError);
                        $("#modalMessage").modal('show');     
                        document.getElementById("idLoad").hidden= true;
                        document.getElementById("btnGeneraLiq").hidden = true;                        
                        
                    }
                }
            });
        }
        else
        {
            $("#btnGeneraLiq").attr("hidden",true);
            $('#txtResult').html('Debes seleccionar una cuenta corriente.');
            $("#modalMessage").modal('show');
        }
    });

    
    document.getElementById('sl_periodo').addEventListener('change', function () { 
        clearValores();
        document.getElementById("lnk_file").hidden = true;
        let cuenta = document.getElementById("sl_ctacte");
        var xCtaSelec = cuenta.options[cuenta.selectedIndex].value;
        let periodo =  this.selectedOptions[0].value;

        if(periodo.trim() == 'init' || periodo.trim() == '') {

            // document.getElementById("btnCargo").hidden = false;
            document.getElementById("btnGeneraLiq").hidden = false;
        }
        else
        {
            // document.getElementById("btnCargo").hidden = true;
            document.getElementById("btnGeneraLiq").hidden = true;
        }
    });

    document.getElementById('btnGeneraLiq').addEventListener('click', function () {

        var eCta = document.getElementById("sl_ctacte");
        var xCtaSelec = eCta.options[eCta.selectedIndex].value;

        var e = document.getElementById("sl_periodo");
        var xPeriodoSelec = e.options[e.selectedIndex].value;

        document.getElementById("idLoadGeneraLiq").hidden = false;

        $.ajax({
                method: 'GET',
                url: '/liquidacion/getFilePdf',
                data:{ xCtaSelec,xPeriodoSelec },
                success: function (resp) {
                    if(resp.status)
                    {
                        var a = document.getElementById('lnk_file');                    
                        a.href = '/download/comprobantes/'+resp.pathfile;

                        document.getElementById("idLoadGeneraLiq").hidden = true;
                        document.getElementById("lnk_file").hidden = false;
                    }
                    else
                    {
                        let html = resp.message;
                        $('#txtResult').html(html);
                        $("#modalMessage").modal('show');
                    }                    
                }
        });

    });

    document.getElementById('btnSaveConfig').addEventListener('click', function () {

        var eCta = document.getElementById("sl_ctacte");
        var xCtaSelec = eCta.options[eCta.selectedIndex].value;

        var acumSal =  $("input[name=customRadioInline1]:checked").val();

        $.ajax({
                method: 'POST',
                url: '/liquidacion/saveConfigAcumSaldo',
                data:{ xCtaSelec,acumSal},
                success: function (resp) {
                    
                    if(resp.status)
                    {                        
                        $('#txtResult').html('Guardado Correctamente!!');
                        $("#modalMessage").modal('show');    
                    }
                    else
                    {                        
                        $('#txtResult').html('Problemas al guardar...');
                        $("#modalMessage").modal('show');
                    }                    
                }
        });

    });

    // document.getElementById('btnCargo').addEventListener('click', function () {

    //     document.getElementById("idLoadGeneraLiq").hidden = false;
    //     let cuenta = document.getElementById("sl_ctacte");
    //     var xCtaSelec = cuenta.options[cuenta.selectedIndex].value;

    //     $.ajax({
    //             method: 'GET',
    //             url: '/liquidacion/getComprobanteLiqCargo',
    //             data:{ xCtaSelec },
    //             success: function (resp) {

    //                 console.log('respresp:: ',resp);
    //                 if(resp.status)
    //                 {
    //                     document.getElementById("idLoadGeneraLiq").hidden = true;
    //                 }
    //                 else
    //                 {
    //                     document.getElementById("idLoadGeneraLiq").hidden = true;
    //                     let html = resp.message;
    //                     $('#txtResult').html(html);
    //                     $("#modalMessage").modal('show');
    //                 }                    
    //             }
    //     });

    // });


