const Handlebars = require('handlebars');

Handlebars.registerHelper({
    eq: (v1, v2) => v1 === v2,
    ne: (v1, v2) => v1 !== v2,
    lt: (v1, v2) => v1 < v2,
    gt: (v1, v2) => v1 > v2,
    lte: (v1, v2) => v1 <= v2,
    gte: (v1, v2) => v1 >= v2,
    and() {
        return Array.prototype.every.call(arguments, Boolean);
    },
    or() {
        return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    }
});

Handlebars.registerHelper('inc', function(number, option,number2) {
    if(typeof(number) === 'undefined' || number === null)
        return null;

    if(typeof(number2) === 'undefined' || number2 === null)
        return null;        

    return {
        "+": number + number2,
        "-": number - number2,
        "*": number * number2,
        "/": number / number2,
        "%": number % number2
    }[option];
    
});

Handlebars.registerHelper('numberFormat', function (value, options) {
    // Helper parameters
    var dl = options.hash['decimalLength'] || 0;
    var ts = options.hash['thousandsSep'] || '.';
    var ds = options.hash['decimalSep'] || ',';

    // Parse to float
    var value = parseFloat(value);

    // The regex
    var re = '\\d(?=(\\d{3})+' + (dl > 0 ? '\\D' : '$') + ')';

    // Formats the number with the decimals
    var num = value.toFixed(Math.max(0, ~~dl));

    // Returns the formatted number
    return '$ '+ (ds ? num.replace('.', ds) : num).replace(new RegExp(re, 'g'), '$&' + ts);
});

Handlebars.registerHelper('incremented', function (index) {
    index++;
    return index;
});