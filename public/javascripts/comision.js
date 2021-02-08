function separadorMiles(val) {
    return val.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ".");        
}

    document.getElementById('btnBuscar').addEventListener('click', function () {

        var eCta = document.getElementById("sl_dialiquidacion");
        var xFecha = eCta.options[eCta.selectedIndex].value;

        document.getElementById("idLoad").hidden = false;

        if(xFecha != 'init') {
            $('#tbInfoLiquidacion').html('');
            
            $.ajax({
                method: 'GET',
                url: '/liquidacion/comisionCtaCtePorDiaLiquidacion',
                data:{ xFecha },
                success: function (resp) {
                    if(resp.status)
                    {
                        document.getElementById("idLoad").hidden = true;
                        let xHtmlTbLiqui = '';
                        let x = 0;
                        $('#tbInfoLiquidacion').html('');
                        for(let reg in resp.data)
                        {
                            x++;
                            xHtmlTbLiqui += `
                            <tr>
                                <th scope="row">` + x + `</th>
                                <td>` + resp.data[reg].numcta + `</td>
                                <td>$ ` + separadorMiles(resp.data[reg].abonototal) + `</td>
                                <td>$ ` + separadorMiles(resp.data[reg].cargototal) + `</td>
                                <td>$ ` + separadorMiles(resp.data[reg].montoliq) + `</td>
                                <td>` + resp.data[reg].comi_admin + `</td>
                                <td>$ ` + separadorMiles(resp.data[reg].montoadmin) + `</td>
                                <td>` + resp.data[reg].comi_asesoria + `</td>
                                <td>$ ` + separadorMiles(resp.data[reg].montoasesoria) + `</td>
                            </tr>`;
                        }

                        $('#tbInfoLiquidacion').html(xHtmlTbLiqui);
                        
                    }
                    else
                    {
                        document.getElementById("idLoad").hidden = true;
                        let html = resp.message;
                        $('#txtResult').html(html);
                        $("#modalMessage").modal('show');
                    }                    
                }
            });
        } 
        else 
        {

            document.getElementById("idLoad").hidden = true;

            $('#txtResult').html('Debe seleccionar fecha');
            $("#modalMessage").modal('show');

        }
        
        

    });