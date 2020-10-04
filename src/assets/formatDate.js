const today = new Date();
const todayFullDate = {    
    dd: String(today.getDate()).padStart(2, '0'),
    mm: String(today.getMonth() + 1).padStart(2, '0'), //January is 0!
    yyyy: today.getFullYear()
};

function convertFullDate(fullDate) {
    const fullDatePayload = {    
        dd: String(fullDate.getDate()).padStart(2, '0'),
        mm: String(fullDate.getMonth() + 1).padStart(2, '0'), //January is 0!
        yyyy: fullDate.getFullYear()
    };

    return fullDatePayload;
}

function inHours(d1) {
    var t2 = today.getTime();
    var t1 = d1.getTime();

    return parseInt((t1-t2)/(3600*1000));
}

function inDays(d1) {
    var t2 = today.getTime();
    var t1 = d1.getTime();

    return parseInt((t1-t2)/(24*3600*1000));
}

function inWeeks(d1) {
    var t2 = today.getTime();
    var t1 = d1.getTime();

    return parseInt((t1-t2)/(24*3600*1000*7));
}

function inMonths(d1) {
    var d1Y = d1.getFullYear();
    var todayY = today.getFullYear();
    var d1M = d1.getMonth();
    var todayM = today.getMonth();

    return (d1M+12*d1Y)-(todayM+12*todayY);
}

function inYears(d1) {
    return d1.getFullYear()-today.getFullYear();
}


module.exports = {
    inHours, inDays, inWeeks, inMonths, inYears, convertFullDate, todayFullDate
};
