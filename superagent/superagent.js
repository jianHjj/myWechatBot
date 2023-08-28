const superagent = require('superagent')

require('superagent-proxy')(superagent)

var proxy = process.env.http_proxy || 'http://127.0.0.1:10810';

let cookieMap = new Map();

const mailer = require("../utils/emailer");
const env = require('../utils/env');

// 延时函数，防止检测出类似机器人行为操作
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let sendDt;
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
    let cookieTemp = cookieMap.get(domain);
    let cookie = cookieTemp && cookieTemp !== '' ? cookieTemp : '';
    return new Promise(function (resolve, reject) {
        superagent(method, url)
            .timeout({
              response: 6000,  // Wait 6 seconds for the server to start sending,
              deadline: 60000, // but allow 1 minute for the file to finish loading.
            })
            .query(params)
            .proxy(proxy)
            .send(data)
            .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36')
            .set('Referer', url)
            .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7')
            .set('Accept-Encoding', 'gzip, deflate, br')
            .set('Accept-Language', 'en,zh-CN;q=0.9,zh;q=0.8')
            .set('Device-Memory', '8')
            .set('Dnt', '1')
            .set('Downlink', '1.85')
            .set('Ect', '4g')
            .set('Rtt', '300')
            .set('Viewport-Width', '1073')
            .set('Sec-Ch-Device-Memory', '8')
            .set('Sec-Ch-Dpr', '1')
            .set('Sec-Ch-Ua', 'Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115')
            .set('Sec-Ch-Ua-Mobile', '?0')
            .set('Sec-Ch-Ua-Platform', 'Windows')
            .set('Sec-Ch-Ua-Platform-Version', '7.0.0')
            .set('Sec-Ch-Viewport-Width', '1073')
            .set('Sec-Fetch-Dest', 'document')
            .set('Sec-Fetch-Mode', 'navigate')
            .set('Sec-Fetch-Site', 'same-origin')
            .set('Sec-Fetch-User', '?1')
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
                        let expiresTemp = getCookieValue(cookieTemp,'Expires');
                        let expiresCache = getCookieValue(cookieCache,'Expires');
                        if (expiresTemp) {
                            //对比过期时间
                            if (!expiresCache || expiresTemp > expiresCache) {
                                //过期时间为空 or 过期时间小于最新cookie 更新cookie
                                console.log(new Date().toLocaleString() + " info 更新cookie");
                                cookieMap.set(domain, cookieTemp);
                            }
                        }

                        //防止设置失败，二次判断
                        cookieCache = cookieMap.get(domain);
                        if (!cookieCache || cookieCache === '') {
                            let c = cookieTemp && cookieTemp !== '' ? cookieTemp : '';
                            console.log(new Date().toLocaleString() + " info 首次缓存cookie");
                            cookieMap.set(domain, c);
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

function getCookieValue(cookieHeaders, cookieName) {
    if (cookieHeaders) {
        for (let i = 0; i < cookieHeaders.length; i++) {
            const cookieHeader = cookieHeaders[i];
            if (cookieHeader) {
                const cookies = cookieHeader.split(';');
                for (const cookie of cookies) {
                    const [name, value] = cookie.trim().split('=');
                    if (name === cookieName) {
                        return value;
                    }
                }
            }
        }
    }
    return null;
}

module.exports = {
    req
}
