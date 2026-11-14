import { normalizeVote, pairKey } from './league';
import type { Pair, Person, Vote } from './types';

export type PairFilters = {
  query:string;
  own:'any'|'pending'|'answered'|'skipped';
  partner:'any'|'pending'|'answered';
  answer:'any'|'tie'|'decisive';
  agreement:'any'|'same'|'different';
  nameId:string;
  order:'schedule'|'recent';
};
export const defaultPairFilters=():PairFilters=>({query:'',own:'any',partner:'any',answer:'any',agreement:'any',nameId:'',order:'schedule'});
export function leagueVoteIndex(votes:Vote[]) {
  const index=new Map<string,Vote>();
  for(const input of votes){const vote=normalizeVote(input),key=vote.person+':'+pairKey(vote.a,vote.b),old=index.get(key);if(!old||old.updatedAt<=vote.updatedAt)index.set(key,vote);}
  return index;
}
export function filterLeaguePairs(pairs:Pair[],votes:Vote[],person:Person,filters:PairFilters,queryIds:Set<string>,skippedKeys:Set<string>=new Set()):Pair[] {
  const index=leagueVoteIndex(votes),other=person==='first'?'second':'first';
  const result=pairs.filter(pair=>{
    const key=pairKey(pair.a,pair.b),own=index.get(person+':'+key),partner=index.get(other+':'+key);
    if(filters.query&&!queryIds.has(pair.a)&&!queryIds.has(pair.b))return false;
    if(filters.nameId&&pair.a!==filters.nameId&&pair.b!==filters.nameId)return false;
    if(filters.own==='pending'&&own||filters.own==='answered'&&!own||filters.own==='skipped'&&(own||!skippedKeys.has(key)))return false;
    if(filters.partner==='pending'&&partner||filters.partner==='answered'&&!partner)return false;
    if(filters.answer==='tie'&&own?.choice!=='tie'||filters.answer==='decisive'&&(!own||own.choice==='tie'))return false;
    if(filters.agreement!=='any'&&(!own||!partner||(own.choice===partner.choice)!==(filters.agreement==='same')))return false;
    return true;
  });
  if(filters.order==='recent')result.sort((a,b)=>{
    const stamp=(p:Pair)=>[index.get('first:'+pairKey(p.a,p.b))?.updatedAt||'',index.get('second:'+pairKey(p.a,p.b))?.updatedAt||''].sort().pop()!;
    return stamp(b).localeCompare(stamp(a));
  });
  return result;
}
