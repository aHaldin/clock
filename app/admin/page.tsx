import {getDatabase,getConfig} from '@/lib/database.mjs';
import {headers} from 'next/headers';
import {getPasswordAdmin} from '@/lib/admin-auth.mjs';
import {adminAllowed} from '@/lib/security.mjs';
import Dashboard from './dashboard';
import AdminLogin from './login';
export const dynamic='force-dynamic';
export default async function Admin(){const config={...getConfig(),DB:getDatabase()};const user=await getPasswordAdmin(config.DB,config,(await headers()).get('cookie'));if(!adminAllowed(user,config.ADMIN_USER_IDS))return <AdminLogin/>;return <Dashboard adminName={user!.displayName}/>}
