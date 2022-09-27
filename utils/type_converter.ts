import {Decimal} from "@prisma/client/runtime";

function number2string(n: number | Decimal | undefined): string {
    return n && n > 0 ? n.toString() : '';
}

module.exports = {
    number2string
}
