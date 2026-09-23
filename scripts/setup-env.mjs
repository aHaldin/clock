import {writeFileSync,existsSync} from 'node:fs';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {hashAdminPassword} from '../lib/admin-auth.mjs';
if(!process.stdin.isTTY)throw Error('Run in an interactive terminal.');
if(existsSync('.env.local')||existsSync('.env.netlify'))throw Error('Private settings already exist. Preserve them and edit runtime settings explicitly.');
const hidden=new Writable({write(_chunk,_encoding,done){done()}});
const input=createInterface({input:process.stdin,output:hidden,terminal:true});
let password,confirmation;
try{process.stdout.write('Admin password (hidden): ');password=await input.question('');process.stdout.write('\nConfirm password (hidden): ');confirmation=await input.question('');}finally{input.close();process.stdout.write('\n')}
if(password!==confirmation||password.length<12||password.length>512)throw Error('Passwords must match and contain 12–512 characters.');
const hash=await hashAdminPassword(password),pepper=crypto.randomUUID()+crypto.randomUUID();
const config=h=>`ADMIN_PASSWORD_HASH='${h}'\nPIN_PEPPER=${pepper}\nANY_DEVICE_CLOCKING=true\nBROWSER_CLOCKING=true\n`;
// Next.js expands dotenv dollars; the Netlify import file uses the unescaped value.
writeFileSync('.env.local',config(hash.replaceAll('$','\\$'))+'DATABASE_URL=\n',{mode:0o600});
writeFileSync('.env.netlify',config(hash),{mode:0o600});
console.log('Created private .env.local and .env.netlify. Add DATABASE_URL locally, or import .env.netlify into Netlify environment variables. Never commit either file.');
