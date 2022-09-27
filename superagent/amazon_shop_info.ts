import {Decimal} from "@prisma/client/runtime";

const superagent = require('./superagent');
const utils = require('../utils/index');
const tc = require('../utils/type_converter');

import cheerio, {Cheerio} from 'cheerio';
import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient({
    log: ["query", "info", "warn", "error"],
});

const url_shop_info: string = 'http://www.amazon.com/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/dp/{ASIN}/ref=cm_cr_arp_d_product_top?ie=UTF8';
const url_shop_review: string = 'https://www.amazon.com/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/product-reviews/{ASIN}/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews';

// 延时函数，防止检测出类似机器人行为操作
const delay = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms));

class ShopInfo {
    asin: string;
    first: string;
    basisPrice: string;
    offset: string;
    offsetPrice: string;
    coupon: number;
    couponUnit: string;
    deliveryPrice: string;
    createDt: Date;
    lastUpdateDt: Date;
    review: ShopReviewInfo | undefined;
    //是否来自数据库 默认为false
    fromDB: boolean = false;

    // 构造函数
    constructor(asin: string,
                first: string,
                basisPrice: string,
                offset: string,
                offsetPrice: string,
                coupon: number,
                couponUnit: string,
                deliveryPrice: string,
                fromDB?: boolean) {
        this.asin = asin;
        this.first = first;
        this.basisPrice = basisPrice;
        this.offset = offset;
        this.offsetPrice = offsetPrice;
        this.coupon = coupon;
        this.couponUnit = couponUnit;
        this.deliveryPrice = deliveryPrice;
        this.createDt = new Date();
        this.lastUpdateDt = new Date();
        if (fromDB) {
            this.fromDB = fromDB;
        }
    }
}

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

async function getGoods(asin: string, date: Date) {
    return await prisma.amazon_goods_price.findUnique({
        where: {
            asin_date: {
                asin: asin,
                date: utils.formatDateYYYYMMDD(date),
            },
        },
    });
}

async function getGoodReview(asin: string, date: Date) {
    return await prisma.amazon_goods_review.findUnique({
        where: {
            asin_date: {
                asin: asin,
                date: utils.formatDateYYYYMMDD(date),
            },
        },
    });
}

function getCouponPrice(offsetPrice: Decimal, coupon: Decimal, couponUnit: string | any): string {
    return couponUnit && couponUnit === '%' && coupon.toNumber() > 0 ? offsetPrice.mul(coupon.div(100)).toNumber().toFixed(2) : coupon.toNumber().toFixed(2);
}

//获取商品信息
export async function getShopInfo(asinList: string[]): Promise<ShopInfo[] | undefined[]> {
    // 获取商品信息
    let result: ShopInfo[] | undefined[] = [];
    var i: number;
    var length = asinList.length;
    for (i = 0; i < length; i++) {
        let asin = asinList[i];
        if (asin) {
            asin = asin.trim();
            const goods = await getGoods(asin, new Date());
            if (goods) {
                //已经爬取到商品信息，直接返回数据
                let offset = goods.basis_price.toNumber() - goods.offset_price.toNumber();
                let couponPrice: string = getCouponPrice(goods.offset_price, goods.coupon, goods.coupon_unit);
                result[i] = new ShopInfo(goods.asin, `${goods.offset_price.toNumber().toFixed(2)}-${couponPrice}`,
                    tc.number2string(goods.basis_price),
                    offset.toFixed(2),
                    tc.number2string(goods.offset_price),
                    tc.number2string(goods.coupon),
                    goods.coupon_unit,
                    tc.number2string(goods.delivery_price));
                var r_item = result[i];
                const r = await getGoodReview(asin, new Date());
                if (r && r_item) {
                    //存在review信息
                    r_item.review = new ShopReviewInfo(r.asin, tc.number2string(r.sellers_rank_big), tc.number2string(r.sellers_rank_small), tc.number2string(r.ratings_total), tc.number2string(r.ratings_count), tc.number2string(r.ratings_review_count));
                    //如果商品信息都已经存在才不需要重新爬取
                    r_item.fromDB = true;
                    continue;
                }
            }
            await delay(2000);
            result[i] = await reqShopInfo(asin);
            let e = result[i];
            if (e) {
                await delay(2000);
                e.review = await reqShopReview(asin, e.review);
            }
        }
    }

    for (let e of result) {
        if (e && !e.fromDB) {
            //保存result
            const goods = await getGoods(e.asin, e.createDt);

            if (goods) {
                //存在商品信息跳过insert
                continue;
            }

            const created = await prisma.amazon_goods_price.create({
                data: {
                    asin: e.asin,
                    date: utils.formatDateYYYYMMDD(e.createDt),
                    basis_price: e.basisPrice === '' ? 0 : e.basisPrice,
                    offset_price: e.offsetPrice === '' ? 0 : e.offsetPrice,
                    delivery_price: e.deliveryPrice === '' ? 0 : e.deliveryPrice,
                    coupon: e.coupon,
                    coupon_unit: e.couponUnit
                },
            });

            const goodReview = await getGoodReview(e.asin, e.createDt);

            if (goodReview) {
                //存在商品review信息跳过insert
                continue;
            }

            var reviewTmp = e.review;

            if (reviewTmp) {
                const createdGoodsReview = await prisma.amazon_goods_review.create({
                    data: {
                        asin: reviewTmp.asin,
                        date: utils.formatDateYYYYMMDD(reviewTmp.createDt),
                        sellers_rank_big: reviewTmp.sellersRankBig ? parseInt(reviewTmp.sellersRankBig) : undefined,
                        sellers_rank_small: reviewTmp.sellersRankSmall ? parseInt(reviewTmp.sellersRankSmall) : undefined,
                        ratings_total: reviewTmp.ratingsTotal,
                        ratings_count: reviewTmp.ratingsCount ? parseInt(reviewTmp.ratingsCount) : undefined,
                        ratings_review_count: reviewTmp.ratingsReviewCount ? parseInt(reviewTmp.ratingsReviewCount) : undefined
                    },
                });
            }
        }
    }
    return result;
}

/*美元符号*/
const CHAR_DOLLAR: string = '$';
/*百分比符号*/
const CHAR_PERCENT: string = '%';

async function reqShopInfo(asin: string): Promise<ShopInfo | undefined> {
    try {
        //url asin替换
        var url: string = url_shop_info.replace("{ASIN}", asin)
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
            let offset = parseInt(basisPrice) - parseInt(offsetPrice);
            var deliveryPriceAttr = $('#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE').children()
                .attr('data-csa-c-delivery-price');
            let deliveryPriceMatch = deliveryPriceAttr ? deliveryPriceAttr
                    .replace(/(^\s*)|(\s*$)/g, '').replace(CHAR_DOLLAR, '').match(new RegExp('\\b\\d*\\.?\\d*\\b'))
                : undefined;
            let couponPrice: string = getCouponPrice(new Decimal(offsetPrice), new Decimal(coupon), couponUnit);
            let first: string = coupon && coupon > 0 ? `${offsetPrice}-${couponPrice}` : `${offsetPrice}`;
            let deliveryPrice = '';
            if (deliveryPriceMatch) {
                deliveryPrice = deliveryPriceMatch[0].trim();
                if (deliveryPrice && deliveryPrice !== '') {
                    first += `+${deliveryPrice}`;
                }
            }
            shopInfo = new ShopInfo(asin, first, basisPrice, offset + '', offsetPrice, coupon, couponUnit, deliveryPrice);
        }

        //获取review信息
        var ratingsTotal: string = $('#acrPopover .a-declarative .a-popover-trigger .a-icon-star .a-icon-alt').eq(0).text().replace('out of 5 stars', '').trim();
        var ratingsCount: string = $('#acrCustomerReviewText').eq(0).text().replace('ratings', '').trim();
        //获取商品详情
        let tdArray = $('#productDetails_detailBullets_sections1').find('td');
        //从商品详情中抽取排名
        var topList = tdArray.eq(tdArray.length - 2).text().replace(',', '').split("#");

        var t1 = topList[1];
        let topBig = "";
        if (t1) {
            var topBigMatch = t1.trim().match(new RegExp('^\\d*'));
            if (topBigMatch) {
                topBig = topBigMatch[0].trim();
            }
        }

        var t2 = topList[2];
        let topSmall = "";
        if (t2) {
            var topSmallMatch = t2.trim().match(new RegExp('^\\d*'));
            if (topSmallMatch) {
                topSmall = topSmallMatch[0].trim();
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
        let reviewCountMatch = $('#filter-info-section .a-row').text().split(",")[1].match('\\b\\d*\\b');
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
