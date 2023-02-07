import {Decimal} from "@prisma/client/runtime";

const superagent = require('./superagent');
const utils = require('../utils/index');
const tc = require('../utils/type_converter');
const mailer = require("../utils/emailer");
const xlsx = require("xlsx");
const env = require('../utils/env');

import cheerio, {Cheerio} from 'cheerio';
import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient({
    log: ["query", "info", "warn", "error"],
});

const url_shop_info: string = 'https://www.amazon.com/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/dp/{ASIN}/ref=cm_cr_arp_d_product_top?ie=UTF8';
const url_shop_review: string = 'https://www.amazon.com/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/product-reviews/{ASIN}/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews';

// 延时函数，防止检测出类似机器人行为操作
const delay = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms));

export class ShopInfo {
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
        this.createDt = new Date();
        this.lastUpdateDt = new Date();
        if (fromDB) {
            this.fromDB = fromDB;
        }
    }

    async sendEmail(shopInfoList: ShopInfo[] | undefined[]): Promise<void> {
        await sendEmail(shopInfoList);
    }
}

//excel headers
export const ExcelHeadersReviewSimple: string[] = ["asin", "标题", "品牌名", "价格", "小排名", "大排名", "总评分", "ratingsCount", "ratingsReviewCount", "日期", "商品链接"];

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
        if (couponUnit === CHAR_DOLLAR) {
            return coupon.toNumber().toFixed(2);
        }
    }
    return '';
}

/**
 * 获取商品信息
 * @param asinList asin编码列表
 * @param se 是否发送邮件
 */
export async function getShopInfo(asinList: any[], se: boolean): Promise<ShopInfo[] | undefined[]> {
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
                result[i] = await reqShopInfo(asin);
                let e = result[i];
                if (e) {
                    await delay(2000);
                    e.review = await reqShopReview(asin, e.review);
                }
            }
        } else {
            let obj: any = item;
            if (obj) {
                await delay(2000);
                result[i] = await reqShopInfoByUrl(obj.asin, obj.url);
                let e = result[i];
                if (e) {
                    await delay(2000);
                    e.review = await reqShopReview(obj.asin, e.review);
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

async function sendEmail(shopInfoList: ShopInfo[] | undefined[]): Promise<void> {
    if (!shopInfoList) {
        return;
    }
    //发送邮件
    let length = shopInfoList.length + 1;
    let columns = [ExcelHeadersReviewSimple];
    for (let i = 1; i < length; i++) {
        var item = shopInfoList[i - 1];
        if (!item) {
            continue;
        }
        let review = item.review;
        columns[i] = review ? [review.asin, item.title, item.brand, item.first, review.sellersRankSmall, review.sellersRankBig, review.ratingsTotal, review.ratingsCount, review.ratingsReviewCount, utils.formatDateYYYYMMDD(review.createDt), item.url] : [];
    }
    //导出excel
    /* Create a simple workbook and write XLSX to buffer */
    let ws = xlsx.utils.aoa_to_sheet(columns);
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

/*美元符号*/
const CHAR_DOLLAR: string = '$';
/*百分比符号*/
const CHAR_PERCENT: string = '%';
/*排名 talbe->th 内容*/
const RANK_DESC: string = 'Best Sellers Rank';
const ASIN: string = 'ASIN';

//拼接优惠券信息
function concatCouponPrice(s: string, couponPrice: string | any) {
    return couponPrice && couponPrice !== '' ? `${s}-${couponPrice}` : `${s}`;
}

//拼接配送费信息
function concatDeliveryPrice(s: string, deliveryPrice: string | any) {
    return deliveryPrice && deliveryPrice !== '' ? `${s}+${deliveryPrice}` : `${s}`;
}

async function reqShopInfo(asin: string): Promise<ShopInfo | undefined> {
    //url asin替换
    var url: string = url_shop_info.replace("{ASIN}", asin)
    return await reqShopInfoByUrl(asin, url);
}


async function reqShopInfoByUrl(asin: string, url: string): Promise<ShopInfo | undefined> {
    try {
        let res = await superagent.req({url: url, method: 'GET', spider: true});
        let $ = cheerio.load(res);
        //价格信息
        let shopInfo = undefined;
        let price = $('#corePriceDisplay_desktop_feature_div');
        if (price) {
            //真实价格-折扣价
            let offsetPriceList = price
                .find('.a-spacing-none .priceToPay .a-offscreen');
            let offsetPrice = '';
            if (offsetPriceList) {
                offsetPrice = offsetPriceList.eq(0)
                    .text()
                    .replace(/(^\s*)|(\s*$)/g, '').replace(CHAR_DOLLAR, '');
            }

            let basisPrice = '';
            if (!offsetPrice || offsetPrice === '') {
                //兼容另外一种显示风格
                let pricesStr: string = $('#corePrice_desktop').find('.a-spacing-small').children().children().children().find('.a-text-price .a-offscreen').text();
                let priceArr: string[] = pricesStr.replace(CHAR_DOLLAR, '').split(CHAR_DOLLAR);
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
                        .replace(/(^\s*)|(\s*$)/g, '').replace(CHAR_DOLLAR, '');
                }
            }

            //获取折扣
            if (!basisPrice || basisPrice === '') {
                basisPrice = offsetPrice;
            }

            //获取优惠券信息
            let coupon: number = 0;
            let couponUnit: string = '';
            let couponRoot: Cheerio<any> = $('#promoPriceBlockMessage_feature_div .promoPriceBlockMessage').children();
            let isCoupon: string | undefined = couponRoot.attr('data-csa-c-coupon');
            if (isCoupon && isCoupon === 'true') {
                //是优惠券信息
                let complexText: string = couponRoot.find('.a-color-success').find('label').text();
                //开始匹配优惠券价格
                //优惠券存在两种单位
                if (complexText.includes(CHAR_DOLLAR)) {
                    //美元符号
                    couponUnit = CHAR_DOLLAR;
                    let couponMatchArr: string[] | null = complexText.split(CHAR_DOLLAR)[1]
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
                    .replace(/(^\s*)|(\s*$)/g, '').replace(CHAR_DOLLAR, '').match(new RegExp('\\b\\d*\\.?\\d*\\b'))
                : undefined;

            let couponPrice: string = offsetPrice && offsetPrice !== ''
                ? getCouponPrice(new Decimal(offsetPrice), new Decimal(coupon), couponUnit)
                : '';

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
            //拼接微信返回信息
            let first: string = concatDeliveryPrice(concatCouponPrice(offsetPrice, couponPrice), deliveryPrice);
            shopInfo = new ShopInfo(asin, first, basisPrice, offset + '', offsetPrice, coupon, couponUnit, deliveryPrice, first, title, brand, url);
        }

        //获取review信息
        var ratingsTotal: string = $('#acrPopover .a-declarative .a-popover-trigger .a-icon-star .a-icon-alt').eq(0).text()
            .replace('out of 5 stars', '').trim();
        var ratingsCount: string = $('#acrCustomerReviewText').eq(0).text()
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
                var topList = tdArray.eq(i).text().replace(/(,)/g, '').split("#");
                let topSmallIndex: number = 2;
                if (topList.length === 4) {
                    //出现三排
                    topSmallIndex = 3;
                }
                var t1 = topList[1];
                if (t1) {
                    var topBigMatch = t1.trim().match(new RegExp('^\\d*'));
                    if (topBigMatch) {
                        topBig = topBigMatch[0].trim();
                    }
                }

                var t2 = topList[topSmallIndex];
                if (t2) {
                    var topSmallMatch = t2.trim().match(new RegExp('^\\d*'));
                    if (topSmallMatch) {
                        topSmall = topSmallMatch[0].trim();
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


async function reqShopReview(asin: string, review?: ShopReviewInfo | undefined): Promise<ShopReviewInfo | undefined> {
    var newReview: boolean = false;
    if (!review) {
        review = new ShopReviewInfo(asin);
        newReview = true;
    }
    try {
        //url asin替换
        var url: string = url_shop_review.replace("{ASIN}", asin)
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
    return undefined;
}
