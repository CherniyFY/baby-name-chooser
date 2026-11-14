import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const built=await build({entryPoints:[fileURLToPath(new URL('../lib/pair-filters.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
const {filterLeaguePairs,defaultPairFilters}=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const pairs=[{a:'a',b:'b'},{a:'a',b:'c'},{a:'b',b:'c'}];
const vote=(person,a,b,choice,updatedAt='1')=>({person,a,b,choice,updatedAt,leagueId:'l'});
const votes=[vote('first','a','b','a'),vote('second','b','a','b'),vote('first','a','c','tie'),vote('second','a','c','a')];
test('pair agreement respects reverse-side canonical votes and requires both answers',()=>{
 assert.deepEqual(filterLeaguePairs(pairs,votes,'first',{...defaultPairFilters(),agreement:'same'},new Set()),[pairs[0]]);
 assert.deepEqual(filterLeaguePairs(pairs,votes,'first',{...defaultPairFilters(),agreement:'different'},new Set()),[pairs[1]]);
});
test('pending, skipped, answer type and query intersect without changing schedule or answers',()=>{
 const copy=structuredClone(votes);
 assert.deepEqual(filterLeaguePairs(pairs,votes,'first',{...defaultPairFilters(),own:'pending'},new Set()),[pairs[2]]);
 assert.deepEqual(filterLeaguePairs(pairs,votes,'first',{...defaultPairFilters(),query:'term',own:'skipped'},new Set(['b']),new Set(['b:c'])),[pairs[2]]);
 assert.deepEqual(filterLeaguePairs(pairs,votes,'first',{...defaultPairFilters(),answer:'tie',nameId:'c'},new Set()),[pairs[1]]);
 assert.deepEqual(votes,copy);
});
