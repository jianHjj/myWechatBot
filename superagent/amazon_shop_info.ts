const superagent = require('./superagent');

import cheerio from 'cheerio';

const url_shop_info: string = 'http://www.amazon.com/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/dp/{ASIN}/ref=cm_cr_arp_d_product_top?ie=UTF8';
const url_shop_review: string = 'https://www.amazon.com/Computer-Desk-inches-Writing-Frame%EF%BC%8CBrown/product-reviews/{ASIN}/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews';

class ShopInfo {
    asin: string;
    first: string;
    basisPrice: string;
    offset: string;
    offsetPrice: string;
    deliveryPrice: string;
    createDt: Date;
    lastUpdateDt: Date;
    review: ShopReviewInfo | undefined;

    // 构造函数
    constructor(asin: string,
                first: string,
                basisPrice: string,
                offset: string,
                offsetPrice: string,
                deliveryPrice: string) {
        this.asin = asin;
        this.first = first;
        this.basisPrice = basisPrice;
        this.offset = offset;
        this.offsetPrice = offsetPrice;
        this.deliveryPrice = deliveryPrice;
        this.createDt = new Date();
        this.lastUpdateDt = new Date();
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

//获取商品信息
export async function getShopInfo(asinList: string[]): Promise<ShopInfo[] | undefined[]> {
    // 获取商品信息
    let result: ShopInfo[] | undefined[] = [];
    var i: number;
    var length = asinList.length;
    for (i = 0; i < length; i++) {
        let asin = asinList[i];
        result[i] = await reqShopInfo(asin);
        let e = result[i];
        if (e) {
            e.review = await reqShopReview(asin, e.review);
        }
    }
    return result;
}

async function reqShopInfo(asin: string): Promise<ShopInfo | undefined> {
    try {
        //url asin替换
        var url: string = url_shop_info.replace("{ASIN}", asin)
        let res = await superagent.req({url: url, method: 'GET', spider: true});
        let $ = cheerio.load(res);
        //价格信息
        let price = $('#corePriceDisplay_desktop_feature_div');
        //真实价格-折扣价
        let offsetPrice = price
            .find('.a-spacing-none .priceToPay .a-offscreen')
            .text()
            .replace(/(^\s*)|(\s*$)/g, '').replace('$', '');
        let basisPrice = price
            .find('.a-spacing-small .basisPrice .a-text-price .a-offscreen')
            .text()
            .replace(/(^\s*)|(\s*$)/g, '').replace('$', '');
        //获取折扣
        let offset = parseInt(basisPrice) - parseInt(offsetPrice);
        let deliveryPrice = $('#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE')
            .find('.data-csa-c-delivery-price')
            .text()
            .replace(/(^\s*)|(\s*$)/g, '').replace('$', '');
        let first: string = `${basisPrice}-${offset}`;
        if (deliveryPrice !== '') {
            first += `${deliveryPrice}`;
        }
        var shopInfo = new ShopInfo(asin, first, basisPrice, offset + '', offsetPrice, deliveryPrice);
        //获取review信息
        var ratingsTotal: string = $('#acrPopover .a-declarative .a-popover-trigger .a-icon-star .a-icon-alt').eq(0).text().replace('out of 5 stars', '').trim();
        var ratingsCount: string = $('#acrCustomerReviewText').eq(0).text().replace('ratings', '').trim();
        //获取商品详情
        let tdArray = $('#productDetails_detailBullets_sections1').find('td');
        //从商品详情中抽取排名
        var topList = tdArray.eq(tdArray.length - 2).text().replace(',', '').split("#");
        var topBigMatch = topList[1].trim().match(new RegExp('^\\d*'));
        let topBig = "";
        if (topBigMatch) {
            topBig = topBigMatch[0].trim();
        }
        var topSmallMatch = topList[2].trim().match(new RegExp('^\\d*'));
        let topSmall = "";
        if (topSmallMatch) {
            topSmall = topSmallMatch[0].trim();
        }
        shopInfo.review = new ShopReviewInfo(asin, topBig, topSmall, ratingsTotal, ratingsCount, '');
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
