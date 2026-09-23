// Keep the tested service's prepared-statement API while using Postgres transactions.
export function postgresSQL(sql) {
 let index=0;
 return sql.replace(/'(?:''|[^'])*'|\?|\bMAX\(|\bjson_object\(/gi, token => {
  if(token[0]==="'")return token;
  if(token==='?')return '$'+(++index);
  return token.toLowerCase()==='max('?'GREATEST(':'json_build_object(';
 });
}
const numeric=new Set(['started_at','ended_at','expires','until','at','recorded_at','captured_at']);
function result(r){return {results:r.rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,numeric.has(k)&&v!==null?Number(v):v]))),meta:{changes:r.rowCount??r.affectedRows??0}}}
export class PostgresAdapter {
 constructor(pool){this.pool=pool}
 prepare(sql){const db=this;return {sql:postgresSQL(sql),args:[],bind(...args){return {...this,args}},async first(){return (await this.all()).results[0]??null},async all(){return result(await db.pool.query(this.sql,this.args))},async run(){return this.all()}}}
 async transaction(fn){const client=await this.pool.connect();try{
  await client.query('BEGIN');const value=await fn(client);await client.query('COMMIT');return value;
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
 async batch(statements){return this.transaction(async client=>{
  // Serialize studio mutations so consuming a session and writing its audit stay atomic.
  await client.query('SELECT pg_advisory_xact_lock(7284062026)');
  const results=[];for(const s of statements)results.push(result(await client.query(s.sql,s.args)));
  return results;
 })}
}
