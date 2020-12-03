$(document).ready(function() {

    alert("Llelgamos a principal.js");
});

function fn_Obtiene(inFile) {

    console.log(inFile.files[0].file);
    document.getElementById("textFileUpload").innerHTML = inFile.files[0].name;
    //inFile[0].files[0].name

}


function getData() {

    alert("Click en btn");

    document.getElementById('show').addEventListener('click', function() {


        //var source = document.getElementById('text-template').innerHTML;
        //var template = Handlebars.compile(source);
        //var html = template(data);
        //document.getElementById('content').innerHTML = html;
    });

}