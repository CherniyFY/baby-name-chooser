import { authorize,body,json,route,ApiError } from '@/lib/server';
export const dynamic='force-dynamic';
import { familyDefaults as defaults } from '@/lib/catalog';
export const GET=route(async(request)=>{
  const {db}=await authorize(request);
  const row=await db.prepare("SELECT payload,updated_at FROM family_settings WHERE id = 'family'").first<{payload:string;updated_at:string}>();
  return json({profile:row?{...defaults,...JSON.parse(row.payload)}:defaults,updatedAt:row?.updated_at??null,inferred:!row});
});
export const POST=route(async(request)=>{
  const {db,user}=await authorize(request,true);const data=await body(request);
  if(!data.profile||typeof data.profile!=='object'||Array.isArray(data.profile))throw new ApiError(400,'Enter a family profile.');
  const input=data.profile as Record<string,unknown>;const profile:Record<string,string>={};
  for(const key of Object.keys(defaults)){
    const value=input[key];if(typeof value!=='string'||value.length>120)throw new ApiError(400,'Each field may contain at most 120 characters.');
    profile[key]=value.trim();
  }
  const updatedAt=new Date().toISOString();
  await db.prepare("INSERT INTO family_settings(id,payload,updated_at,updated_by) VALUES('family',?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(JSON.stringify(profile),updatedAt,user.userId).run();
  return json({profile,updatedAt,inferred:false});
});
