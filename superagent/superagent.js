const superagent = require('superagent')

require('superagent-proxy')(superagent)

let https = require('https');

let proxy = process.env.http_proxy || 'http://127.0.0.1:10810';

const options = {
    keepAlive: true,
    keepAliveMsecs: 6000,
    // maxSockets: 60,
    // maxFreeSockets: 30,
    // totalSocketCount: 60
}

//https 代理对象缓存
let httpsAgentMap = new Map();

let cookieMap = new Map();

const mailer = require("../utils/emailer");
const env = require('../utils/env');

// 延时函数，防止检测出类似机器人行为操作
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let sendDt;

// const session_id = 'session-id';
// const ubid_main = 'ubid-main';
// const session_id_time = 'session-id-time';
// const i18n_prefs = 'i18n-prefs';
// const sp_cdn = 'sp-cdn';
// const session_token = 'session-token';

/**
 *
 * @param url 请求地址
 * @param method 请求方法
 * @param params 请求参数
 * @param data 请求body
 * @param domain 域名 or 其它关键字
 * @param cookies cookies
 * @param spider 是否需要爬取数据
 * @param platform 请求哪个平台 tx 天行数据  tl 图灵机器人
 * @returns {Promise}
 */
function req({url, method, params, data, domain, cookies, spider = false, platform = 'tx'}) {
    let splitUrl = url.split('/');
    let urlDomain;
    if(splitUrl[2]) {
        urlDomain = splitUrl[2];
    } else {
        urlDomain = ''; //如果url不正确就取空

    }

    //https 获取代理对象
    let agent = httpsAgentMap.get(domain);
    if (!agent) {
        agent = superagent.agent(new https.Agent(options));
        httpsAgentMap.set(domain, agent);
    }

    let cookieTemp = cookieMap.get(domain);
    let cookie = cookieTemp && cookieTemp !== '' ? cookieTemp : '';
    return new Promise(function (resolve, reject) {
        agent
            // .method(method)
            .get(url)
            .timeout({
              response: 6000,  // Wait 6 seconds for the server to start sending,
              deadline: 60000, // but allow 1 minute for the file to finish loading.
            })
            .query(params)
            .agent(agent)
            .proxy(proxy)
            .retry(3)
            .send(data)
            .set('Connection', 'keep-alive')
            .set('Origin', "https://" + urlDomain)
            .set('Referer', url)
            .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7')
            .set('Accept-Encoding', 'gzip, deflate, br, zstd')
            .set('Accept-Language', 'en-US,en;q=0.9')
            .set('Cache-Control', 'max-age=0')
            .set('Device-Memory', '8')
            .set('Dnt', '1')
            .set('Downlink', '1.5')
            .set('Dpr', '1')
            .set('Ect', '3g')
            .set('Rtt', '350')
            .set('Sec-Ch-Device-Memory', '8')
            .set('Sec-Ch-Dpr', '0.9')
            .set('Sec-Ch-Ua', '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"')
            .set('Sec-Ch-Ua-Mobile', '?0')
            .set('Sec-Ch-Ua-Platform', 'Windows')
            .set('Sec-Ch-Ua-Platform-Version', '7.0.0')
            .set('Sec-Ch-Viewport-Width', '1035')
            .set('Sec-Fetch-Dest', 'document')
            .set('Sec-Fetch-Mode', 'navigate')
            .set('Sec-Fetch-Site', 'same-origin')
            .set('Sec-Fetch-User', '?1')
            .set('Upgrade-Insecure-Requests', '1')
            .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36')
            .set('Viewport-Width', '1035')
            .set('Priority', 'u=0, i')
            .set('Cookie',cookie)
            .end(function (err, response) {
                if (err) {
                    reject(err)
                }
                if (spider) { // 如果是爬取内容，直接返回页面html
                    if (response && response.text) {
                        resolve(response.text);

                        if (response.text.length < 10000 && response.text.includes('not a robot')) {
                            //爬取失败
                            let currentCookie = cookieMap.get(domain);
                            console.log(new Date().toLocaleString() + " error 弹出人机验证页 [url = " + url + ";current cookie = " + currentCookie + "]");
                            let now = new Date();
                            if (!sendDt || (sendDt.getFullYear() < now.getFullYear() || sendDt.getMonth() < now.getMonth() || sendDt.getDate() < now.getDate())) {
                                mailer.send(new mailer.MailBody(env.getValue('EMAIL_USER'), '警告：出现人机验证页', ''))
                                    .then(r => console.log(new Date().toLocaleString() + " info 发送提醒邮件成功"));
                                //更新发送时间
                                sendDt = now;
                            }

                            delay(2000).then(r => console.log(new Date().toLocaleString() + " info 延时执行当前请求"));
                        }

                        //获取cookie
                        let cookieTemp = response.headers["set-cookie"];
                        let cookieCache = cookieMap.get(domain);
                        cookieMap.set(domain, checkExpire(cookieTemp,cookieCache));

                        //防止设置失败，避免直接set undefined
                        cookieCache = cookieMap.get(domain);
                        if (!cookieCache) {
                            cookieMap.set(domain, '');
                        }
                    }
                } else { // 如果是非爬虫，返回格式化后的内容
                    const res = JSON.parse(response.text);
                    if (res.code !== 200 && platform === 'tx' || res.code !== 100000 && platform === 'tl') {
                        console.error('接口请求失败', res.msg || res.text)
                    }
                    resolve(res)
                }
            })
    })
}

function getCookieValue(cookieHeader, cookieName) {
    if (cookieHeader) {
        const cookies = cookieHeader.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name && cookieName
                && name.toLowerCase() === cookieName.toLowerCase()) {
                return value;
            }
        }
    }
    return null;
}

function checkExpire(cookieTempArray, cookieCacheArray) {
    let newCookies = cookieCacheArray;

    if (!newCookies) {
        //如果缓存为空 直接返回temp
        if (cookieTempArray) {
          console.log(new Date().toLocaleString() + " info 首次缓存cookie");
        }
        return cookieTempArray;
    }

    let expire = 'Expires';
    let idx = newCookies.length;

    //判断cookie是否是手动设置
    if (cookieCacheArray.length === 1 && !cookieCacheArray[0].includes(expire)) {
        return cookieCacheArray;
    }

    //开始更新缓存
    if (cookieTempArray && cookieTempArray.length > 0) {
        for (let i = 0; i < cookieTempArray.length; i++) {
            const cookieTempHeader = cookieTempArray[i];
            if (cookieTempHeader) {
                const cookieTempSplit = cookieTempHeader.split('=');
                if (cookieTempSplit && cookieTempSplit.length >= 1) {
                    let firstKey = cookieTempSplit[0] ? cookieTempSplit[0].trim() : '';
                    let expireCache = '';
                    let cookieCacheHeader = '';
                    let cookieCacheIdx = '';
                    for (let i = 0; i < cookieCacheArray.length; i++) {
                        cookieCacheHeader = cookieCacheArray[i];
                        if (cookieCacheHeader) {
                            const cookieCacheSplit = cookieCacheHeader.split('=');
                            if (cookieCacheSplit && cookieCacheSplit.length >= 1) {
                                let firstKey2 = cookieCacheSplit[0];
                                if (firstKey2 && firstKey2.trim() === firstKey) {
                                    expireCache = getCookieValue(cookieCacheHeader, expire);
                                    cookieCacheIdx = i;
                                    break;
                                }
                            }
                        }
                    }

                    if (expireCache) {
                        //存在过期时间
                        let expireTemp = getCookieValue(cookieTempHeader, expire);
                        if (expireTemp && expireTemp > expireCache) {
                            newCookies[cookieCacheIdx] = cookieTempHeader;
                        }
                    } else {
                        //新增cookies
                        newCookies[idx] = cookieTempHeader;
                        idx++;
                    }
                }
            }
        }
    }
    return newCookies;
}

/**
 * 设置cookie
 * @param domain 区域
 * @param cookies cookies
 * @param clear 是否清空
 */
function setCookies({domain, cookies, clear}) {
    if (!cookies || !domain) {
        return;
    }

    if (clear) {
        cookieMap.set(domain,'');
    } else {
        cookieMap.set(domain, checkExpire(cookies, cookieMap.get(domain)));
    }
}

module.exports = {
    req,
    setCookies
}
