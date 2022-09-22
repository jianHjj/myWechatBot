const ChineseDate = require("date-chinese");

function getDay(date: string): number {
    var date2 = new Date();
    var date1 = new Date(date);
    return Math.floor(Math.abs(date2.getTime() - date1.getTime()) / 1000 / 60 / 60 / 24);
}

/**
 * 比较月份是否相同
 * @param date
 */
function cmpOnMonthDay(date: string): boolean {
    var now = new Date();
    var d = new Date(date);
    return d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();
}

function formatDate(date: string): string {
    var tempDate = new Date(date);
    var year = tempDate.getFullYear();
    var month = tempDate.getMonth() + 1;
    var day = tempDate.getDate();
    var hour: number | string = tempDate.getHours();
    var min: number | string = tempDate.getMinutes();
    var second: number | string = tempDate.getSeconds();
    var week = tempDate.getDay();
    var str = '';
    if (week === 0) {
        str = '星期日';
    } else if (week === 1) {
        str = '星期一';
    } else if (week === 2) {
        str = '星期二';
    } else if (week === 3) {
        str = '星期三';
    } else if (week === 4) {
        str = '星期四';
    } else if (week === 5) {
        str = '星期五';
    } else if (week === 6) {
        str = '星期六';
    }
    if (hour < 10) {
        hour = '0' + hour;
    }
    if (min < 10) {
        min = '0' + min;
    }
    if (second < 10) {
        second = '0' + second;
    }
    return year + '-' + month + '-' + day + '日 ' + hour + ':' + min + ' ' + str;
}

//转换成农历日期
function getLunarDateNumber(date: Date): number[] {
    let d = new ChineseDate.CalendarChinese();
    d.fromGregorian(date.getFullYear(), date.getMonth() + 1, date.getDate());
    // noinspection JSUnusedLocalSymbols
    let [cycle, year, month, leap, day] = d.get()
    console.log("阳历" + date + " 的公历时间：" + month + "月" + day);
    return [month, day];
}

module.exports = {
    getDay,
    formatDate,
    getLunarDateNumber,
    cmpOnMonthDay
};
