// 配置文件
module.exports = {
// 每日说配置项（必填项）
  ALIAS: '公主殿下', //女朋友备注姓名
  NICKNAME: '公主殿下', //女朋友昵称
  MEMORIAL_DAY: '2021/10/23', //你和女朋友的纪念日
  BIRTHDAY: [3, 29], //女朋友生日-农历
  CITY: '广州', //女朋友所在城市（城市名称，不要带“市”）
  CRON_EXP: {tz: 'Asia/Shanghai', rule: '13 20 5 * * *'}, //定时发送时间 每天13点14分0秒发送，规则见 /schedule/index.js
  TXAPIKEY: 'bc3cd84973cd8218a526d756a79fe891', //此处须填写个人申请的天行apikey,请替换成自己的 申请地址https://www.tianapi.com/signup.html?source=474284281

// 高级功能配置项（非必填项）
  AUTOREPLY: true, //自动聊天功能 默认开启, 关闭设置为: false
  DEFAULTBOT: '3', //设置默认聊天机器人 0 天行机器人 1 图灵机器人 2 天行对接的图灵机器人，需要到天行机器人官网充值（50元/年，每天1000次）3 openai
  AUTOREPLYPERSON: ['公主殿下'], //指定多个好友开启机器人聊天功能   指定好友的备注，最好不要带有特殊字符
  TULINGKEY: '357d7bd975264980a418ce6dde16e740',//图灵机器人apikey,需要自己到图灵机器人官网申请，并且需要认证

// (自定义) 如果你有 DIY 和基本的编程基础, 可以在这自己定义变量, 用于 js 文件访问, 包括设置简单的定时任务, 例如可以定义 task 数组
  tasks: [{
    alias: '公主殿下',
    taskMsg: '宝宝，国庆节到了\n除了要开心，我们也要安排起来，说走就走咱有的是时间~\n娟娟童鞋天天爱你哦 Salute!',
    date: new Date(2022, 9, 1, 5, 20, 0)
  }],
  amazonTask: {
    //asin配置
    asins: [
      ["B093357KFY", "B09W5LLQXL", "B08JGGJZY2", "B088H63254", "B07V8ZMFDQ", "B082L1F4MS", "B0BPGYZYKZ", "B0BK8R5HXZ", "B09YRHMQN8", "B07T291QPJ", "B09R3RDVRF", "", "B0977J877K", "B07TJ418SN", "B099RMSC1Y", "B099RPKZY7", "B099RPPKGV", "B09Y1TNW28", "B09Y1W1JRH", "", "B09GV9717M", "B09GVFF6WF", "B08B4KBST6", "B08B4MP21V", "B08B4MR6R7", "B0BPYF5MT8", "B09B21N27B", "B08BHSPJV7", "B07H2WGFQN", "B09FQ3MTVC", "B08HMTD26S", "B08HMSVGHH", "B08HMSLPW9", "B097T2Z1NB", "B097T2SFPL", "B0BRQFPFX2", "B0BRQD695S", "", "", "B07Y4TBSG3", "B07DNVC3QM", "B07Y4PLV72", "B07Y4NDPX4", "B09PMT9VCV", "B09XRBX93H", "B09J4SVSPM", "B0977J877K", "B09BHHCVF3", "B08211MDK7", "B08QCM6NJ5", "B08RYPPT82", "B0BCJYWMDG", "", "B097P2RVVQ", "B08H8HTMPD", "B0B8695TNB", "B09MQJ5B7Z", "B09LM2GMDL", "B0B8NYNKXD", "B0BP7ZD7RN", "", "B097T6QX5J", "B0B14CX62F", "B0B1456HDN", "B07YTNMCVC", "B08DR1YGRK"],
      ["B08MTN8SR4", "B09M6D6YS8", "B08MWBW394", "B08MW8S56T", "B08P5LT1B6", "B08P5KCFNR", "B08RRLQ9ZH", "B08RRRZ28D", "B08RS6GW6P", "B0BFJMJ9WV", "B08PZ2QTRZ", "B08PYZ5D6G", "B08PZ1PDXF", "B08PZ2L3XB", "B0BFJCX5XL", "B0BFJ93CSR", "B0BFJDDNSK", "B0BFJM71PW", "B0BFJ85BWD", "B0BG2HXMCN", "B0BG29WVV3", "B0BQ72TG2B", "B0BQ6YKN27", "B08RS53P2M", "B08RS593P8", "B08RS2YMGY"],
      ["B08MT93ZPM", "B08MW8L6C2", "B08RRNVWCN", "B08PYZ46FT", "B08RSC6Y88", "B08RSJ46W7", "B0BFJCX5XL", "B0BWR93D8L", "B0BFJ531J8", "B0BSN1VFDZ", "B0BQ6XSBN4"]
    ],
    urls: [
      "https://www.amazon.com/Best-Sellers-Office-Products-Managerial-Chairs-Executive-Chairs/zgbs/office-products/1069132/ref=zg_bs_pg_1?_encoding=UTF8&pg=1",
      "https://www.amazon.com/Best-Sellers-Home-Kitchen-Home-Office-Desks/zgbs/home-garden/3733671/ref=zg_bs_pg_1?_encoding=UTF8&pg=1"
    ],
    dateTime: {tz: 'Asia/Shanghai', rule: '1 10 8 * * *'}
  },
  // 测试node-schedule 时区问题
  // month 从 0-11 代表 1-12 月 , day alias date
  // example : 2022-9-13 14:21:00 => new Date(2022, 8, 13, 14, 21, 0) / {year: 2022, month: 8, date: 13, hour: 14, minute: 21, second: 0, tz: 'Asia/Shanghai'}
  testTask: [{
    testMsg: '测试定时任务时区',
    testDate: new Date(2022, 8, 13, 14, 49, 0)
  }],
}
