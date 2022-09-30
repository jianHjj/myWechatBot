const mailer = require('nodemailer');
import Env from './env';

const env = new Env();

const config = {
    service: "smtp.163.com",
    host: "smtp.163.com",
    secureConnection: true,
    port: 465,
    auth: {
        // 发件人邮箱账号
        user: env.getValue('EMAIL_USER'),
        //发件人邮箱的授权码 这里可以通过qq邮箱获取 并且不唯一
        pass: env.getValue('EMAIL_PASS')
    },
    logger: true
};

const transporter = mailer.createTransport(config);

export class MailBody {
    from: string = config.auth.user;
    to: string;
    subject: string;
    text: string;
    attachments: MailAttachment[] = [];


    constructor(to: string, subject: string, text: string, attachments?: MailAttachment[], from?: string) {
        this.from = from ? from : this.from;
        this.to = to;
        this.subject = subject;
        this.text = text;
        this.attachments = attachments ? attachments : this.attachments;
    }
}

export class MailAttachment {
    filename: string;
    content: Buffer | null;


    constructor(filename: string, content: Buffer | null) {
        this.filename = filename;
        this.content = content;
    }
}

export async function send(mail: MailBody) {
    transporter.sendMail(mail, (error: any, info: any) => {
        if (error) {
            console.log('Error occurred');
            console.log(error.message);
        }else {
            console.log('Message sent successfully!');
        }

        // only needed when using pooled connections
        transporter.close();
    });
}
