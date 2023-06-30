import {Decimal} from "@prisma/client/runtime";
import cheerio, {Cheerio} from 'cheerio';
import {PrismaClient} from "@prisma/client";
import {WorkSheet} from "xlsx";

const superagent = require('./superagent');
const utils = require('../utils/index');
const tc = require('../utils/type_converter');
const mailer = require("../utils/emailer");
const xlsx = require("xlsx");
const env = require('../utils/env');

const prisma = new PrismaClient({
    log: ["query", "info", "warn", "error"],
});

class ShopUrl {
    url_shop_info: string;
    url_shop_review: string;
}

/**
 * 美国站URL
 */
const usa_url: ShopUrl = {
    url_shop_info: 'https://www.amazon.com/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/dp/{ASIN}/ref=cm_cr_arp_d_product_top?ie=UTF8',
    url_shop_review: 'https://www.amazon.com/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/product-reviews/{ASIN}/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews'
}

/**
 * 加拿大站URL
 */
const canada_url: ShopUrl = {
    url_shop_info: 'https://www.amazon.ca/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/dp/{ASIN}/ref=cm_cr_arp_d_product_top?ie=UTF8',
    url_shop_review: 'https://www.amazon.ca/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/product-reviews/{ASIN}/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews'
}

/**
 * 德国站URL
 */
const de_url: ShopUrl = {
    url_shop_info: 'https://www.amazon.de/-/en/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/dp/{ASIN}/ref=cm_cr_arp_d_product_top?ie=UTF8&deliveryCountryCode=DE',
    url_shop_review: 'https://www.amazon.de/-/en/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/product-reviews/{ASIN}/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews&deliveryCountryCode=DE'
}

/**
 * 英国站URL
 */
const uk_url: ShopUrl = {
    url_shop_info: 'https://www.amazon.co.uk/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/dp/{ASIN}/ref=cm_cr_arp_d_product_top?ie=UTF8&deliveryCountryCode=GB',
    url_shop_review: 'https://www.amazon.co.uk/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/product-reviews/{ASIN}/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews&deliveryCountryCode=GB'
}

const de: string = "de";
const uk: string = "uk";

const url_map: Map<String, ShopUrl> = new Map();
url_map.set("usa", usa_url);
url_map.set("canada", canada_url);
url_map.set(de, de_url);
url_map.set(uk, uk_url);

const country_map: Map<String, String> = new Map();
country_map.set("美国", "usa");
country_map.set("加拿大", "canada");
country_map.set("德国", de);
country_map.set("英国", uk);

const country_map_reverse: Map<String, String> = new Map();

country_map.forEach((value, key) => {
    country_map_reverse.set(value, key);
});

const chineseReg: RegExp = new RegExp('^[\u4E00-\u9FFF]+');

const decimalReg = new RegExp('([1-9]\\d*\\.?\\d*)|(0\\.\\d*[1-9])');


// 延时函数，防止检测出类似机器人行为操作
const delay = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms));

export class ShopInfo {
    country: string;
    asin: string;
    first: string;
    basisPrice: string;
    offset: string;
    offsetPrice: string;
    coupon: number;
    couponUnit: string;
    deliveryPrice: string;
    remark: string;
    createDt: Date;
    lastUpdateDt: Date;
    review: ShopReviewInfo | undefined;
    //是否来自数据库 默认为false
    fromDB: boolean = false;
    //标题
    title: string;
    //品牌名
    brand: string;
    //商品链接
    url: string;
    //封面URL地址
    coverUrl: string;

    // 构造函数
    constructor(asin: string,
                first: string,
                basisPrice: string,
                offset: string,
                offsetPrice: string,
                coupon: number,
                couponUnit: string,
                deliveryPrice: string,
                remark: string,
                title: string,
                brand: string,
                url: string,
                coverUrl: string,
                fromDB?: boolean) {
        this.asin = asin;
        this.first = first;
        this.basisPrice = basisPrice.replace(',', '');
        this.offset = offset.replace(',', '');
        this.offsetPrice = offsetPrice.replace(',', '');
        this.coupon = coupon;
        this.couponUnit = couponUnit;
        this.deliveryPrice = deliveryPrice.replace(',', '');
        this.remark = remark;
        this.title = title;
        this.brand = brand;
        this.url = url;
        this.coverUrl = coverUrl;
        this.createDt = new Date();
        this.lastUpdateDt = new Date();
        if (fromDB) {
            this.fromDB = fromDB;
        }
    }

}

//excel headers
export const ExcelHeadersReviewSimple: string[] = ["地区", "asin", "封面", "标题", "品牌名", "价格", "小排名", "大排名", "总评分", "ratingsCount", "ratingsReviewCount", "日期", "商品链接"];

class ShopReviewInfo {
    asin: string;
    sellersRankBig: string | undefined;
    sellersRankSmall: string | undefined;
    ratingsTotal: string | undefined;
    ratingsCount: string | undefined;
    ratingsReviewCount: string | undefined;
    createDt: Date;
    lastUpdateDt: Date;

    // 构造函数
    constructor(asin: string,
                sellersRankBig?: string | undefined,
                sellersRankSmall?: string | undefined,
                ratingsTotal?: string | undefined,
                ratingsCount?: string | undefined,
                ratingsReviewCount?: string | undefined) {
        this.asin = asin;
        this.sellersRankBig = sellersRankBig;
        this.sellersRankSmall = sellersRankSmall;
        this.ratingsTotal = ratingsTotal;
        this.ratingsCount = ratingsCount;
        this.ratingsReviewCount = ratingsReviewCount;
        this.createDt = new Date();
        this.lastUpdateDt = new Date();
    }
}


/**
 * 计算优惠价格并四舍五入取两位小数返回字符串，如果没有优惠返回空字符串
 * @param offsetPrice 最终折扣价格
 * @param coupon 优惠券信息
 * @param couponUnit 优惠券单位
 */
function getCouponPrice(offsetPrice: Decimal, coupon: Decimal, couponUnit: string | any): string {
    if (couponUnit && coupon.toNumber() > 0) {
        if (couponUnit === CHAR_PERCENT) {
            return offsetPrice.mul(coupon.div(100)).toNumber().toFixed(2);
        }
        return coupon.toNumber().toFixed(2);
    }
    return '';
}

/**
 * 获取商品信息
 * @param asinList asin编码列表
 * @param se 是否发送邮件
 * @param country 地区
 */
export async function getShopInfo(asinList: any[], se: boolean, country: string): Promise<ShopInfo[] | undefined[]> {
    // 获取商品信息
    let result: ShopInfo[] | undefined[] = [];
    var i: number;
    var length = asinList.length;
    for (i = 0; i < length; i++) {
        let item = asinList[i];
        if (typeof item === 'string') {
            let asin: string = item;
            if (asin) {
                asin = asin.trim();
                await delay(2000);
                //判断asin中是否携带中文地区
                let matchChinese: RegExpMatchArray | null = asin.match(chineseReg);
                if (matchChinese) {
                    let chinese: String | undefined = matchChinese.at(0);
                    if (chinese) {
                        let v: String | undefined = country_map.get(chinese);
                        if (v) {
                            country = v.toString().trim();
                        }
                    }
                    asin = asin.replace(chineseReg, '').trim();
                }

                //如果没有地区 默认为美国
                if (!country || country.length == 0) {
                    country = country_map_reverse.keys().next().value;
                }
                result[i] = await reqShopInfo(asin, country);
                let e = result[i];
                if (e) {
                    e.country = country_map_reverse.get(country).toString();
                    await delay(2000);
                    e.review = await reqShopReview(asin, country, e.review);
                }
            }
        }
    }

    for (let e of result) {
        if (e && !e.fromDB) {
            //保存result
            const created = await prisma.amazon_goods_price.create({
                data: {
                    asin: e.asin,
                    date: utils.formatDateYYYYMMDD(e.createDt),
                    basis_price: e.basisPrice === '' ? 0 : e.basisPrice,
                    offset_price: e.offsetPrice === '' ? 0 : e.offsetPrice,
                    delivery_price: e.deliveryPrice === '' ? 0 : e.deliveryPrice,
                    coupon: e.coupon,
                    coupon_unit: e.couponUnit,
                    remark: e.remark,
                    title: e.title,
                    brand: e.brand
                },
            });

            var reviewTmp = e.review;

            if (reviewTmp) {
                const createdGoodsReview = await prisma.amazon_goods_review.create({
                    data: {
                        asin: reviewTmp.asin,
                        date: utils.formatDateYYYYMMDD(reviewTmp.createDt),
                        sellers_rank_big: reviewTmp.sellersRankBig ? parseInt(reviewTmp.sellersRankBig) : 0,
                        sellers_rank_small: reviewTmp.sellersRankSmall ? parseInt(reviewTmp.sellersRankSmall) : 0,
                        ratings_total: reviewTmp.ratingsTotal ? parseInt(reviewTmp.ratingsTotal) : 0,
                        ratings_count: reviewTmp.ratingsCount ? parseInt(reviewTmp.ratingsCount) : 0,
                        ratings_review_count: reviewTmp.ratingsReviewCount ? parseInt(reviewTmp.ratingsReviewCount) : 0
                    },
                });
            }
        }
    }
    if (se) {
        await sendEmail(result);
    }
    return result;
}

//断货的备注
const OUT_OF_STOCK = '断货';

export class ShopInfoSheet {
    sheetName: string;
    shopInfoList: ShopInfo[] | undefined[];

    constructor(sheetName: string, shopInfoList: ShopInfo[] | undefined[]) {
        this.sheetName = sheetName;
        this.shopInfoList = shopInfoList;
    }
}

export class ShopInfoBook {

    bookName: string;
    shopInfoSheetList: ShopInfoSheet[] | undefined[];

    constructor(bookName: string, shopInfoSheetList: ShopInfoSheet[] | undefined[]) {
        this.bookName = bookName;
        this.shopInfoSheetList = shopInfoSheetList;
    }
}

function writeInSheet(shopInfoList: ShopInfo[]): WorkSheet {
    //发送邮件
    let length = shopInfoList.length + 1;
    let columns = [ExcelHeadersReviewSimple];
    for (let i = 1; i < length; i++) {
        let item = shopInfoList[i - 1];
        if (!item) {
            continue;
        }
        let review = item.review;
        let first = '=' + item.first;
        columns[i] = review ? [item.country, review.asin, item.coverUrl, item.title, item.brand, first, review.sellersRankSmall, review.sellersRankBig, review.ratingsTotal, review.ratingsCount, review.ratingsReviewCount, utils.formatDateYYYYMMDD(review.createDt), item.url] : [];
    }
    /* Create a simple workbook and write XLSX to buffer */
    return xlsx.utils.aoa_to_sheet(columns);
}

export async function sendEmailCompact(shopInfoBook: ShopInfoBook): Promise<void> {
    let wb = xlsx.utils.book_new();
    var shopInfoSheetList = shopInfoBook.shopInfoSheetList;
    for (let shopInfoSheet of shopInfoSheetList) {
        let shopInfoList: ShopInfo[] | undefined[] = shopInfoSheet.shopInfoList;
        if (!shopInfoList) {
            return;
        }
        let ws: WorkSheet = writeInSheet(shopInfoList);
        xlsx.utils.book_append_sheet(wb, ws, shopInfoSheet.sheetName);
    }

    let body = xlsx.write(wb, {type: "buffer", bookType: "xlsx"});
    let mailAttachment = new mailer.MailAttachment(`排名-${utils.formatDateYYYYMMDD(new Date())}.xlsx`, Buffer.from(body));

    let text: string = "";
    for (let shopInfoSheet of shopInfoSheetList) {
        //文本内容
        let firstInfoList = [];
        let length: number = shopInfoSheet.shopInfoList.length;
        for (let i = 0; i < length; i++) {
            var shopInfo = shopInfoSheet.shopInfoList[i];
            if (shopInfo) {
                firstInfoList[i] = OUT_OF_STOCK === shopInfo.remark ? shopInfo.remark : '=' + shopInfo.first;
            }
        }
        text = text !== "" ? text + "\n\n" + shopInfoSheet.sheetName + "\n" : shopInfoSheet.sheetName + "\n";
        text = text + firstInfoList.join("\n");
    }
    await mailer.send(new mailer.MailBody(env.getValue('EMAIL_TO'), shopInfoBook.bookName, text, [mailAttachment]));
}


async function sendEmail(shopInfoList: ShopInfo[] | undefined[]): Promise<void> {
    if (!shopInfoList) {
        return;
    }
    //发送邮件
    let ws = writeInSheet(shopInfoList);
    let wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "sheet1");
    let body = xlsx.write(wb, {type: "buffer", bookType: "xlsx"});
    let mailAttachment = new mailer.MailAttachment(`排名-${utils.formatDateYYYYMMDD(new Date())}.xlsx`, Buffer.from(body));

    //文本内容
    var firstInfoList = [];
    for (let i = 0; i < shopInfoList.length; i++) {
        var shopInfo = shopInfoList[i];
        if (shopInfo) {
            firstInfoList[i] = OUT_OF_STOCK === shopInfo.remark ? shopInfo.remark : '=' + shopInfo.first;
        }
    }
    let text: string = firstInfoList.join("\n");
    await mailer.send(new mailer.MailBody(env.getValue('EMAIL_TO'), "排名 & 价格", text, [mailAttachment]));
}

/*百分比符号*/
const CHAR_PERCENT: string = '%';
/*欧元符号*/
const EURO_CHAR: string = '€';
/*排名 talbe->th 内容*/
const RANK_DESC: string = 'Best Sellers Rank';
/*桌子类商品的小排名*/
const HOME_OFFICE_DESKS: string = 'Home Office Desks';
/*花园软管卷盘小排名*/
const GARDEN_HOSE_REELS: string = 'Garden Hose Reels';
/*电动桌小排名*/
const COMPUTER_WORKSTATIONS: string = 'Computer Workstations';
const ASIN: string = 'ASIN';

//拼接优惠券信息
function concatCouponPrice(s: string, couponPrice: string | any) {
    return couponPrice && couponPrice !== '' ? `${s}-${couponPrice}` : `${s}`;
}

//拼接配送费信息
function concatDeliveryPrice(s: string, deliveryPrice: string | any) {
    return deliveryPrice && deliveryPrice !== '' ? `${s}+${deliveryPrice}` : `${s}`;
}

async function reqShopInfo(asin: string, country: string): Promise<ShopInfo | undefined> {
    //url asin替换
    let shopUrl: ShopUrl | undefined = url_map.get(country);
    if (!shopUrl) {
        throw new Error("地区不存在！请检查地区是否合法");
    }
    var url: string = shopUrl.url_shop_info.replace("{ASIN}", asin);

    let shopInfo: ShopInfo | undefined = await reqShopInfoByUrl(asin, url);

    //特殊处理，部分地区不计算运费
    if (shopInfo && shopInfo.first != OUT_OF_STOCK) {
        //拼接微信返回信息
        let couponPrice: string = shopInfo.offsetPrice && shopInfo.offsetPrice !== ''
            ? getCouponPrice(new Decimal(shopInfo.offsetPrice), new Decimal(shopInfo.coupon), shopInfo.couponUnit)
            : '';

        //德国 | 英国 不拼接运费
        let first: String = country == uk || country == de
            ? concatCouponPrice(shopInfo.offsetPrice, couponPrice)
            : concatDeliveryPrice(concatCouponPrice(shopInfo.offsetPrice, couponPrice), shopInfo.deliveryPrice);
        if (first) {
            shopInfo.first = first.toString();
            shopInfo.remark = first.toString();
        }
    }
    return shopInfo;
}


async function reqShopInfoByUrl(asin: string, url: string): Promise<ShopInfo | undefined> {
    try {
        let res = await superagent.req({url: url, method: 'GET', spider: true});
        let $ = cheerio.load(res);
        //价格信息
        let shopInfo = undefined;
        //货币符号 默认美元
        let charDollar: string = '$';
        let price = $('#corePriceDisplay_desktop_feature_div');
        if (price) {
            //先获取货币符号
            let charDollarList = price.find('.a-spacing-none .priceToPay .a-price-symbol');
            if (charDollarList) {
                charDollar = charDollarList.eq(0).text().trim();
            }
            //真实价格-折扣价
            let offsetPriceList = price
                .find('.a-spacing-none .priceToPay .a-offscreen');
            let offsetPrice = '';
            if (offsetPriceList) {
                offsetPrice = offsetPriceList.eq(0)
                    .text()
                    .replace(/(^\s*)|(\s*$)/g, '').replace(charDollar, '');
            }

            let basisPrice = '';
            if (!offsetPrice || offsetPrice === '') {
                //兼容另外一种显示风格
                let pricesStr: string = $('#corePrice_desktop').find('.a-spacing-small').children().children().children().find('.a-text-price .a-offscreen').text();
                if (!charDollar) {
                    charDollar = pricesStr.replace(decimalReg, '');
                }

                //判断价格是否异常
                if (charDollar) {
                    if (charDollar.length != 1) {
                        return new ShopInfo(asin, '价格异常：价格区间', '', '', '', 0, '', '', '', '', '', url, '')
                    }
                }
                let priceArr: string[] = pricesStr.replace(charDollar, '').split(charDollar);
                if (priceArr && priceArr.length == 1) {
                    basisPrice = priceArr[0];
                    offsetPrice = priceArr[0];
                }
                if (priceArr && priceArr.length >= 2) {
                    basisPrice = priceArr[0];
                    offsetPrice = priceArr[1];
                }
            } else {
                let basisPriceList = price
                    .find('.a-spacing-small .basisPrice .a-text-price .a-offscreen');
                if (basisPriceList) {
                    basisPrice = basisPriceList.eq(0)
                        .text()
                        .replace(/(^\s*)|(\s*$)/g, '').replace(charDollar, '');
                }
            }

            //兼容 有 [Join Prime to buy this item at ?] 这行字的情况
            let combineOffsetPrice1: string = $('#primeExclusivePricingMessage .a-size-base').text();
            if (combineOffsetPrice1 && combineOffsetPrice1 !== '') {
                offsetPrice = combineOffsetPrice1.replace(/(^\s*)|(\s*$)/g, '').replace(charDollar, '');
            }

            //获取折扣
            if (!basisPrice || basisPrice === '') {
                basisPrice = offsetPrice;
            }

            //获取优惠券信息
            let coupon: number = 0;
            let couponUnit: string = '';
            let couponClassName2 = 'promoPriceBlockMessage_OneTimePurchase';
            let couponRoot: Cheerio<any> = $('#promoPriceBlockMessage_feature_div .promoPriceBlockMessage').children();
            if (couponRoot.length == 0) {
                couponRoot = $('#promoPriceBlockMessage_feature_div .' + couponClassName2 + '').children();
            }
            let isCoupon: string | undefined = couponRoot.attr('data-csa-c-coupon');
            if (isCoupon && isCoupon === 'true') {
                //是优惠券信息
                let complexText: string = couponRoot.find('.a-color-success').find('label').text();

                if (EURO_CHAR === charDollar || complexText === '') {
                    //兼容欧元区优惠券H5
                    complexText = couponRoot.find('label').text();
                }

                //开始匹配优惠券价格
                //优惠券存在两种单位
                if (complexText.includes(charDollar)) {
                    //货币符号
                    couponUnit = charDollar;
                    let couponMatchArr: string[] | null = complexText.split(charDollar)[1]
                        .match(new RegExp('\\b\\d*\\.?\\d\\b'));
                    if (couponMatchArr && couponMatchArr.length > 0) {
                        let couponItem: string = couponMatchArr[0];
                        if (couponItem) {
                            coupon = parseInt(couponItem);
                        }
                    }
                } else if (complexText.includes(CHAR_PERCENT)) {
                    //百分比
                    couponUnit = CHAR_PERCENT;
                    let couponMatchArr: string[] | null = complexText.split(CHAR_PERCENT)[0]
                        .match(new RegExp('\\b\\d*\\.?\\d\\b'));
                    if (couponMatchArr && couponMatchArr.length > 0) {
                        let pcItem: string = couponMatchArr[0];
                        if (pcItem) {
                            coupon = parseInt(pcItem);
                        }
                    }
                }
            }

            //避免,号问题
            basisPrice = basisPrice && basisPrice !== '' ? basisPrice.replace(',', '') : basisPrice;
            offsetPrice = offsetPrice && offsetPrice !== '' ? offsetPrice.replace(',', '') : offsetPrice;

            let offset = parseInt(basisPrice) - parseInt(offsetPrice);
            var deliveryPriceAttr = $('#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE').children()
                .attr('data-csa-c-delivery-price');
            let deliveryPriceMatch = deliveryPriceAttr ? deliveryPriceAttr
                    .replace(/(^\s*)|(\s*$)/g, '').replace(charDollar, '').match(new RegExp('\\b\\d*\\.?\\d*\\b'))
                : undefined;

            //获取配送费
            let deliveryPrice = '';
            if (deliveryPriceMatch) {
                deliveryPrice = deliveryPriceMatch[0].trim();
            }

            //获取标题、品牌名
            let title, brand: string = '';
            let microTable = $('.a-spacing-micro');
            if (microTable) {
                let microTrs = microTable.find('tr');
                for (let i = 0; i < microTrs.length; i++) {
                    let tr = microTrs.eq(i);
                    if (tr.hasClass('po-brand')) {
                        brand = tr.children().eq(1).text().trim();
                        break;
                    }
                }
            }
            title = $('#productTitle').text().trim();

            //获取封面
            let coverImgDom = $('#imgTagWrapperId');
            let coverImgUrl: string = coverImgDom.children().eq(0).attr('data-old-hires');

            shopInfo = new ShopInfo(asin, '', basisPrice, offset + '', offsetPrice, coupon, couponUnit, deliveryPrice, '', title, brand, url, coverImgUrl);
        }

        //获取review信息
        let ratingsTotal: string = $('#acrPopover .a-declarative .a-popover-trigger .a-icon-star .a-icon-alt').eq(0).text()
            .replace('out of 5 stars', '').trim();
        let ratingsCount: string = $('#acrCustomerReviewText').eq(0).text()
            .replace('ratings', '')
            .replace(',', '').trim();

        //获取商品详情
        var table = $('#productDetails_detailBullets_sections1');
        let tdArray = table.find('td');
        let thArray = table.find('th');
        var tableLength = thArray.length;
        let topBig = "";
        let topSmall = "";
        for (let i = 0; i < tableLength; i++) {
            let th: string = thArray.eq(i).text();
            if (th.includes(RANK_DESC)) {
                //从商品详情中抽取排名
                let topList: string[] = [];
                let spanArray = tdArray.eq(i).find('span').find('span');
                for (let j = 0; j < spanArray.length; j++) {
                    topList[j] = spanArray.eq(j).text().replace(/(,)/g, '').replace('#', '').trim();
                }
                // var topList = tdArray.eq(i).text().replace(/(,)/g, '').split("#");
                let topSmallIndex: number = 1;
                let topSmallMatch: RegExpMatchArray | null;

                //按照英文描述匹配小排名
                if ((!topSmall || topSmall === "")) {
                    for (let topEle of topList) {
                        if (topEle.includes(GARDEN_HOSE_REELS)) {
                            //软管卷盘小排名
                            topSmallMatch = topEle.trim().match(new RegExp('^\\d*'));
                            if (topSmallMatch) {
                                topSmall = topSmallMatch[0].trim();
                            }
                            break;
                        }
                        if (topEle.includes(COMPUTER_WORKSTATIONS)) {
                            //电动桌小排名
                            topSmallMatch = topEle.trim().match(new RegExp('^\\d*'));
                            if (topSmallMatch) {
                                topSmall = topSmallMatch[0].trim();
                            }
                            break;
                        }
                    }
                }

                //按照出现顺序赋值大小排名
                if (topList.length === 3) {
                    //出现三排
                    topSmallIndex = 2;
                }

                //大排名
                if ((!topBig || topBig === "")) {
                    let t1 = topList[0];
                    if (t1) {
                        var topBigMatch = t1.trim().match(new RegExp('^\\d*'));
                        if (topBigMatch) {
                            topBig = topBigMatch[0].trim();
                        }
                    }
                }

                //小排名
                if ((!topSmall || topSmall === "")) {
                    let t2 = topList[topSmallIndex];
                    if (t2) {
                        topSmallMatch = t2.trim().match(new RegExp('^\\d*'));
                        if (topSmallMatch) {
                            topSmall = topSmallMatch[0].trim();
                        }
                    }
                }
                break;
            }

            if (th.includes(ASIN)) {
                let asin_code: string = tdArray.eq(i).text().trim();
                if (asin !== asin_code && shopInfo) {
                    shopInfo.first = OUT_OF_STOCK;
                    shopInfo.remark = shopInfo.first;
                }
            }
        }

        //获取商品详情兼容情况-fixed
        if ((!topBig || topBig === "") && (!topSmall || topSmall === "")) {
            let detailList = $('#detailBulletsWrapper_feature_div');
            let li = detailList.find('ul').find('li');
            for (let i = 0; i < li.length; i++) {
                let e = li.eq(i);
                let attrName = e.find('span.a-list-item').find('span.a-text-bold').text()
                if (attrName.includes(RANK_DESC)) {
                    //从商品详情中抽取排名
                    var topList_2 = e.text().replace(/(,)/g, '').split("#");
                    let topSmallIndex: number = 2;
                    if (topList_2.length === 4) {
                        //出现三排
                        topSmallIndex = 3;
                    }
                    var t1_2 = topList_2[1];
                    if (t1_2) {
                        var topBigMatch_2 = t1_2.trim().match(new RegExp('^\\d*'));
                        if (topBigMatch_2) {
                            topBig = topBigMatch_2[0].trim();
                        }
                    }

                    var t2_2 = topList_2[topSmallIndex];
                    if (t2_2) {
                        var topSmallMatch_2 = t2_2.trim().match(new RegExp('^\\d*'));
                        if (topSmallMatch_2) {
                            topSmall = topSmallMatch_2[0].trim();
                        }
                    }
                    break;
                }
            }
        }

        if (shopInfo) {
            shopInfo.review = new ShopReviewInfo(asin, topBig, topSmall, ratingsTotal, ratingsCount, '');
        }
        return shopInfo;
    } catch (err) {
        console.log('获取商品信息出错', err);
    }
    return undefined;
}


async function reqShopReview(asin: string, country: string, review?: ShopReviewInfo | undefined): Promise<ShopReviewInfo | undefined> {
    var newReview: boolean = false;
    if (!review) {
        review = new ShopReviewInfo(asin);
        newReview = true;
    }
    try {
        //url asin替换
        let shopUrl: ShopUrl | undefined = url_map.get(country);
        if (!shopUrl) {
            throw new Error("地区不存在！请检查地区是否合法");
        }
        var url: string = shopUrl.url_shop_review.replace("{ASIN}", asin)
        let res = await superagent.req({url: url, method: 'GET', spider: true});
        let $ = cheerio.load(res);

        //获取评论数
        let ratingsStr: any = $('#filter-info-section .a-row').text()
            .replace(new RegExp(',', 'g'), '')
            .split("ratings")[1];

        //避免空指针问题
        let reviewCountMatch = ratingsStr ? ratingsStr.match('\\b\\d*\\b') : null;
        if (reviewCountMatch) {
            review.ratingsReviewCount = reviewCountMatch[0].trim();
        }
        if (newReview) {
            //todo 新建的review 需要填充其余review信息
        }
        return review;
    } catch (err) {
        console.log('获取商品信息出错', err);
    }
    return review;
}
