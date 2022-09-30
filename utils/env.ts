import * as fs from 'fs-extra';
import * as path from 'path';

const env_map = new Map();
const env = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
const lineList: string[] = env.split(new RegExp('\n'));

for (let line of lineList) {
    line = line.trim();
    if (line.startsWith('#')) {
        continue;
    }
    if (line.includes('=')) {
        let keyValueStr: string[] = line.split('=');
        if (keyValueStr.length == 2) {
            let key: string = keyValueStr[0];
            let value: string = keyValueStr[1];
            if (key && key != '') {
                value = value ? value : '';
                value = value.substring(value.indexOf("\"") + 1, value.lastIndexOf("\""));
                env_map.set(key, value);
            }
        }
    }
}

export function getValue(key: string): string {
    return env_map.get(key);
}

export default class Env {

    public getValue(key: string): string {
        return env_map.get(key);
    }
}
