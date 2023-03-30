// noinspection DuplicatedCode

/**
 * WechatBot
 *  - https://github.com/jianHjj/myWechatBot
 */
require("./web/amazon_controller");
const {WechatyBuilder} = require('wechaty');
const schedule = require('node-schedule');
const config = require('./config/index');
const utils = require('./utils/index');
const superagent = require('./superagent/index');
const amazon_shop_info = require('./superagent/amazon_shop_info');
const amazon_best_sellers = require('./superagent/amazon_best_sellers');
const converterCn = require("nzh/cn");

// 延时函数，防止检测出类似机器人行为操作
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 二维码生成
// noinspection JSUnusedLocalSymbols
async function onScan(qrcode, status) {
  require('qrcode-terminal').generate(qrcode); // 在console端显示二维码
  const qrcodeImageUrl = [
    'https://api.qrserver.com/v1/create-qr-code/?data=',
    encodeURIComponent(qrcode),
  ].join('');

  console.log(qrcodeImageUrl);
}

// 登录
async function onLogin(user) {
  console.log(`贴心小助理${user}登录了`);
  const date = new Date()
  console.log(`当前容器时间:${date}`);
  if (config.AUTOREPLY) {
    console.log(`已开启机器人自动聊天模式`);
  }

  // 登陆后创建定时任务
  await initDay();
}

// 登出
function onLogout(user) {
  console.log(`小助手${user} 已经登出`);
}

// 监听对话
async function onMessage(msg) {
  const contact = msg.talker(); // 发消息人
  const content = msg.text().trim(); // 消息内容
  const room = msg.room(); // 是否是群消息
  const alias = await contact.alias() || await contact.name(); // 发消息人备注
  const isText = msg.type() === bot.Message.Type.Text;
  if (msg.self()) {
    return;
  }

  if (room && isText) {
    // 如果是群消息 目前只处理文字消息
    const topic = await room.topic();
    console.log(`群名: ${topic} 发消息人: ${await contact.name()} 内容: ${content}`);
  } else if (isText) {
    // 如果非群消息 目前只处理文字消息
    console.log(`发消息人: ${alias} 消息内容: ${content}`);

    //是否是想要获取商品信息
    if (content.substr(0, 1) === '=' && alias === config.ALIAS) {
      let asinList = content.split('<br/>');
      //是否发送邮件
      let sendEmail = content.substr(0, 2) === '=@';
      //删除第一个值
      asinList = asinList.slice(1, asinList.length + 1);
      var shopInfoList = await amazon_shop_info.getShopInfo(asinList, sendEmail);
      var firstInfoList = [];
      for (let i = 0; i < shopInfoList.length; i++) {
        var shopInfo = shopInfoList[i];
        if (shopInfo) {
          firstInfoList[i] = '=' + shopInfo.first;
        }
      }

      await delay(2000);
      await contact.say(firstInfoList.join(`\n`));
    }
    if (content.substr(0, 1) === '?' || content.substr(0, 1) === '？') {
      let contactContent = content.replace('?', '').replace('？', '');
      if (contactContent) {
        let res = await superagent.getRubbishType(contactContent);
        await delay(2000);
        await contact.say(res);
      }
    } else if (config.AUTOREPLY && config.AUTOREPLYPERSON.indexOf(alias) > -1) {
      // 如果开启自动聊天且已经指定了智能聊天的对象才开启机器人聊天\
      if (content) {
        let reply;
        if (config.DEFAULTBOT === '0') {
          // 天行聊天机器人逻辑
          reply = await superagent.getReply(content);
          console.log('天行机器人回复：', reply);
        } else if (config.DEFAULTBOT === '1') {
          // 图灵聊天机器人
          reply = await superagent.getTuLingReply(content);
          console.log('图灵机器人回复：', reply);
        } else if (config.DEFAULTBOT === '2') {
          // 天行对接的图灵聊
          reply = await superagent.getTXTLReply(content);
          console.log('天行对接的图灵机器人回复：', reply);
        } else if (config.DEFAULTBOT === '3') {
          // openai
          reply = await superagent.getOpenAIReply(content);
          console.log('openai对接的机器人回复：', reply);
        }
        try {
          await delay(2000);
          await contact.say(reply);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
}

async function sendMsg(str, contact) {
  let logMsg;
  try {
    logMsg = str;
    await delay(2000);
    await contact.say(str); // 发送消息
  } catch (e) {
    logMsg = e.message;
  } finally {
    console.log(logMsg);
  }
}

// 创建微信每日说定时任务
async function initDay() {
  console.log(`已经设定每日说任务`);

  //设置定时任务
  config.tasks.forEach(task => {
    console.log('已经设定定时任务！');
    schedule.scheduleJob(task.date, async () => {
      console.log('定时任务开始工作啦！');
      let logMsg;
      let contact = (await bot.Contact.find({alias: task.alias})); // 获取你要发送的联系人

      // 你可以修改下面的 str 来内容和格式
      // PS: 如果需要插入 emoji(表情), 可访问 "https://getemoji.com/" 复制插入
      let str = task.taskMsg;
      try {
        logMsg = str;
        await delay(2000);
        await contact.say(str); // 发送消息
      } catch (e) {
        logMsg = e.message;
      }
      console.log(logMsg);
    })
  });

  //设定每日说任务
  schedule.scheduleJob(config.CRON_EXP, async () => {
    console.log('你的贴心小助理开始工作啦！');
    let contact =
        (await bot.Contact.find({name: config.NICKNAME})) ||
        (await bot.Contact.find({alias: config.ALIAS})); // 获取你要发送的联系人
    let one = await superagent.getOne(); //获取每日一句
    let weather = await superagent.getTXweather(); //获取天气信息
    let today = await utils.formatDate(new Date()); //获取今天的日期
    let memorialDay = utils.getDay(config.MEMORIAL_DAY); //获取纪念日天数
    let isMemorialDay = utils.cmpOnMonthDay(config.MEMORIAL_DAY); //当前日期是否是纪念日
    let sweetWord = await superagent.getSweetWord();

    // 你可以修改下面的 str 来自定义每日说的内容和格式
    // PS: 如果需要插入 emoji(表情), 可访问 "https://getemoji.com/" 复制插入
    let str = `${today}\n我们在一起的第${memorialDay}天\n\n九月小邓同学也要注意防晒哦！\n\n元气满满的一天开始啦,今天也要开心噢^_^\n\n今日天气\n${weather.weatherTips}\n${weather.todayWeather}\n每日一句:\n${one}\n\n每日土味情话：\n${sweetWord}\n\n————————爱你的噗噗同学`;
    await sendMsg(str, contact);
    if (isMemorialDay) {
      //是纪念日，发送纪念日消息
      let yearCn = converterCn.nzhcn.encodeS(new Date().getFullYear() - new Date(config.MEMORIAL_DAY).getFullYear())
      await sendMsg(`宝宝，今天是${today}，是我们在一起的第${yearCn}个春夏秋冬~~\n 感谢所有的星星，让我在茫茫人海中偶遇到你，宝宝陪伴着我的时光里我无比的快乐，我很贪心的说，就这样的时光多久都不够呀。当每一次醒来望着你熟睡的脸庞，就觉得岁月静好不过如此惹。宝宝，${yearCn}周年快乐！！！`, contact);
    }
  });

  //设定生日监听器-农历 每天零点过一秒触发比较当前日期农历是否匹配农历生日
  schedule.scheduleJob('1 0 0 * * *', async () => {
    console.log("定时任务启动-当前日期农历匹配农历生日");
    let [month, day] = utils.getLunarDateNumber(new Date());
    let [birthdayMonth, birthdayDay] = config.BIRTHDAY;
    if (month === birthdayMonth
        && day === birthdayDay) {
      //生日匹配成功
      console.log("生日匹配成功 生日为：" + month + "月" + day);
      //送上生日祝福
      let logMsg;
      let contact =
          (await bot.Contact.find({name: config.NICKNAME})) ||
          (await bot.Contact.find({alias: config.ALIAS})); // 获取你要发送的联系人
      let str = "别怕光阴漫长，我都会在你身边，哪怕白发苍苍，宝宝，生日快乐~";
      try {
        logMsg = str;
        await delay(2000);
        await contact.say(str); // 发送消息
      } catch (e) {
        logMsg = e.message;
      }
      console.log(logMsg);
    }
  });
}

const bot = WechatyBuilder.build({
  name: 'WechatEveryDay',
  puppet: 'wechaty-puppet-wechat', // 如果有token，记得更换对应的puppet
  puppetOptions: {
    uos: true
  }
})

bot.on('scan', onScan);
bot.on('login', onLogin);
bot.on('logout', onLogout);
bot.on('message', onMessage);

// bot
//     .start()
//     .then(() => {
//       console.log('开始登陆微信');
//     })
//     .catch((e) => console.error(e));

console.log('你的亚马逊工具定时任务在初始化了！');

//设定亚马逊爬虫任务
schedule.scheduleJob(config.amazonTask.dateTime, async () => {
  console.log('你的亚马逊工具开始工作啦！');

  let asinBook = new amazon_shop_info.ShopInfoBook("asin", []);
  let asins = config.amazonTask.asins;
  for (let i = 0; i < asins.length; i++) {
    let result = await amazon_shop_info.getShopInfo(asins[i].asins, false);
    asinBook.shopInfoSheetList[i] = new amazon_shop_info.ShopInfoSheet(asins[i].sheetName, result);
    await delay(30000);
  }
  //发送邮件
  await amazon_shop_info.sendEmailCompact(asinBook);
});

// schedule.scheduleJob(config.amazonTask.urlDateTime, async () => {
//   console.log('你的亚马逊工具开始工作啦！');
//
//   let urls = config.amazonTask.urls;
//   let asinsFromUrl = [];
//   for (let i = 0; i < urls.length; i++) {
//     let asins = await amazon_best_sellers.getShopAsins(urls[i].url);
//     asinsFromUrl[i] = {"asins": asins, "sheetName": urls[i].sheetName};
//   }
//
//   await delay(60000 * 10);
//
//   let urlBook = new amazon_shop_info.ShopInfoBook("url", []);
//   for (let i = 0; i < asinsFromUrl.length; i++) {
//     let result = await amazon_shop_info.getShopInfo(asinsFromUrl[i].asins, false);
//     urlBook.shopInfoSheetList[i] = new amazon_shop_info.ShopInfoSheet(asinsFromUrl[i].sheetName, result);
//     await delay(60000);
//   }
//   //发送邮件
//   await amazon_shop_info.sendEmailCompact(urlBook);
// });
//
console.log('你的亚马逊工具定时任务初始化完成！');
