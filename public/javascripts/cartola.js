

document.getElementById('btnCreaCartola').addEventListener('click', function () {
    $('#xFileCartola').html('');
    document.getElementById("idLoadCartola").hidden= false;
    $.ajax({
        type: "GET",
        url: "/cartola/generacartola",        
        success:function(datos){ //success es una funcion que se utiliza si el servidor retorna informacion

            let html ='';
            if(datos.status) {

                for(let reg in datos.archivos)
                {
                    
                    html += ` 
                        <tr>
                            <td>`+ datos.archivos[reg].codigo +`</td>                            
                            <td>` + datos.archivos[reg].nombrectacte + `</td>
                            <td><a href='`+ datos.archivos[reg].path +`' id='lnk_file' target='_blank' class='btn btn-info'>Ver </a></td>
                        </tr>
                    `;
                }

                $('#xFileCartola').html(html);
                $('#txtResult').html('Cartolas creadas');
                $("#modalMessage").modal('show');

                document.getElementById("idLoadCartola").hidden= true;
            }
            else
            {
                document.getElementById("idLoadCartola").hidden= true;
                $('#txtResult').html('Atención::',datos.message);
                $("#modalMessage").modal('show');
            }                
            
        }            
    });
        
    
    
});
